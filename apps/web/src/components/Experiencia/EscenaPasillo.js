// Escena 3D de Experiencia: un pasillo por trabajo, recorrido en primera persona.
// La cámara sigue el camino de lib/pasillo.js; quien la usa le pasa la distancia objetivo
// (sale del scroll) con `irA(s)` y la escena se acerca suave cuadro a cuadro. En cada cuadro
// llama a `alCuadro` con la posición en pantalla de cada objeto (para los tooltips en HTML).
//
// Realismo (mismo enfoque que Weatherglass, más modelos escaneados):
// - luz basada en imagen: un estudio (RoomEnvironment) prefiltrado con PMREM da reflejos y
//   luz ambiente a todos los materiales PBR;
// - luces de verdad en las lámparas de cada pasillo y un foco que sigue a la cámara y proyecta
//   sombras suaves;
// - modelos reales de Poly Haven y texturas PBR en pisos, paredes y estanterías (recursos.js);
// - postprocesado en equipos con margen: oclusión ambiental (N8AO), bloom suave, SMAA, ACES y
//   viñeta. En celulares se dibuja directo, sin AO.
// Sólo se dibujan y se cargan el pasillo actual y sus vecinos.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BlendFunction, BloomEffect, EffectComposer, EffectPass, KernelSize, OutlineEffect, RenderPass, SMAAEffect, SMAAPreset, ToneMappingEffect, ToneMappingMode, VignetteEffect } from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { ALTO, ANCHO, DESPUES_DE_LA_PUERTA, guinadaDe, pasilloEn, puntoEn, tramoEn } from '@/lib/pasillo.js';
import { AMBIENTES, TEXTURA_TECHO } from '@/data/pasilloAssets.js';
import { construirModelo, fuente, lamina, liberarModelos } from './modelos.js';
import { HUECOS, crearMaterialesPasillo, medida, poblarMueble, rellenarCruce, rellenarPasillo } from './relleno.js';
import { crearRecursos } from './recursos.js';
import { crearEfectos } from './efectosPasillo.js';
import { crearConstruccion } from './construccion.js';
import { crearFondo } from './fondos.js';
import { modoRendimiento } from '@/lib/rendimiento.js';

const ALTURA_OJOS = 1.62;
const MIRADA_ADELANTE = 2.6;
const DISTANCIA_PUNTOS = 12;
// al alejarse del objeto enfocado (con el scroll) más que esto, la cámara vuelve al pasillo
const SOLTAR_FOCO = 0.6;
// metros por repetición de las texturas de piso / pared / techo
const TEXEL = { piso: 2, pared: 2.4, techo: 2.5 };
// luces de lámpara que se mueven a las lámparas más cercanas (cantidad fija: no recompila shaders)
const LUCES = 5;

// Temperatura de luz de cada pasillo (las lámparas reales iluminan con esto).
const LUZ = {
  laboratorio: { color: 0xe8f0ff, intensidad: 7 },
  docencia: { color: 0xfff0d8, intensidad: 6 },
  freelance: { color: 0xffe2bf, intensidad: 6 },
  tecnico: { color: 0xf2f6ff, intensidad: 7 },
  mbrf: { color: 0xeef6ff, intensidad: 8 },
};

const PALETAS = {
  dark: { fondo: '#0b0d12', exposicion: 1.05 },
  light: { fondo: '#f5f6f8', exposicion: 1.12 },
};

const suavizar = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Halo radial suave (luz en el piso).
function texturaHalo() {
  const l = document.createElement('canvas');
  l.width = l.height = 128;
  const ctx = l.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.28)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(l);
}

// Haz de luz: más intenso en el origen (arriba de la textura) y desvanecido a los costados.
function texturaHaz() {
  const l = document.createElement('canvas');
  l.width = 64;
  l.height = 256;
  const ctx = l.getContext('2d');
  const largo = ctx.createLinearGradient(0, 0, 0, 256);
  largo.addColorStop(0, 'rgba(255,255,255,1)');
  largo.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = largo;
  ctx.fillRect(0, 0, 64, 256);
  ctx.globalCompositeOperation = 'destination-in';
  const ancho = ctx.createLinearGradient(0, 0, 64, 0);
  ancho.addColorStop(0, 'rgba(0,0,0,0)');
  ancho.addColorStop(0.5, 'rgba(0,0,0,1)');
  ancho.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = ancho;
  ctx.fillRect(0, 0, 64, 256);
  return new THREE.CanvasTexture(l);
}

// Escala los UV de una geometría (así cada pared repite la textura por metro sin clonarla).
function escalarUV(geo, u, v) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v);
  return geo;
}

// ¿Equipo con margen para postprocesado y vidrio con transmisión?
function calidadAlta() {
  try {
    const pedido = new URLSearchParams(window.location.search).get('calidad');
    if (pedido === 'baja') return false;
    if (pedido === 'alta') return true;
  } catch {
    /* sin URL */
  }
  const angosta = window.matchMedia('(max-width: 760px)').matches;
  const tactil = window.matchMedia('(pointer: coarse)').matches;
  return !angosta && !tactil && (navigator.hardwareConcurrency ?? 4) >= 4;
}

// Vitrina de un objeto interactivo, para que se distinga del relleno: un fondo que se ilumina del
// color del pasillo detrás del objeto (más fuerte abajo), dos columnas de luz a los costados y una
// línea encendida en el piso, delante. Coordenadas del grupo del pasillo.
let texturaVitrina = null;
function vitrina(g, o, modelo, acento, medida = {}) {
  if (!texturaVitrina) {
    const l = document.createElement('canvas');
    l.width = 16;
    l.height = 256;
    const ctx = l.getContext('2d');
    const d = ctx.createLinearGradient(0, 0, 0, 256);
    d.addColorStop(0, 'rgba(255,255,255,0)');
    d.addColorStop(0.45, 'rgba(255,255,255,0.3)');
    d.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = d;
    ctx.fillRect(0, 0, 16, 256);
    texturaVitrina = new THREE.CanvasTexture(l);
    texturaVitrina.colorSpace = THREE.SRGBColorSpace;
  }
  const [anchoPrevisto, , altoPrevisto] = HUECOS[modelo] ?? [1.2, 0, 1.6];
  const ancho = Math.max(anchoPrevisto, (medida.ancho ?? 0) + 0.12);
  const alto = Math.max(altoPrevisto, (medida.alto ?? 0) + 0.08);
  const color = new THREE.Color(acento);
  const grupo = new THREE.Group();
  grupo.position.set(o.lado * (ANCHO / 2), 0, -o.a);
  grupo.rotation.y = o.lado < 0 ? Math.PI / 2 : -Math.PI / 2;
  // (en el grupo: x a lo largo de la pared, z hacia el centro del pasillo)
  const fondo = new THREE.Mesh(
    new THREE.PlaneGeometry(ancho, alto + 0.1),
    new THREE.MeshBasicMaterial({ map: texturaVitrina, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  fondo.position.set(0, (alto + 0.1) / 2, 0.035);
  grupo.add(fondo);
  const luz = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(2.2), toneMapped: false });
  for (const lado of [-1, 1]) {
    const columna = new THREE.Mesh(new THREE.BoxGeometry(0.035, alto + 0.1, 0.035), luz);
    columna.position.set(lado * (ancho / 2 + 0.02), (alto + 0.1) / 2, 0.05);
    grupo.add(columna);
  }
  const linea = new THREE.Mesh(new THREE.BoxGeometry(ancho + 0.08, 0.008, 0.03), luz);
  linea.position.set(0, 0.004, 1.05);
  grupo.add(linea);
  // y un halo de luz en el piso, delante
  const charco = new THREE.Mesh(
    new THREE.PlaneGeometry(ancho + 0.6, 1.4),
    new THREE.MeshBasicMaterial({ map: texturaVitrina, color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  charco.rotation.x = -Math.PI / 2;
  charco.position.set(0, 0.006, 0.7);
  grupo.add(charco);

  g.add(grupo);
  return grupo;
}

// Pósters en las paredes que quedan libres: el vestíbulo de cada pasillo (después del giro) y, en
// el primero, la pared de atrás. Son de la etapa: las portadas de sus proyectos o láminas propias
// del trabajo (las piezas de una PC, Python, diagramas de flujo, el servicio técnico).
const POSTERS = {
  laboratorio: [
    { titulo: 'Partes de una PC', lamina: 'pc' },
    { titulo: 'Desarme seguro', lamina: 'pasos', pasos: ['Desconectar y descargar', 'Pulsera antiestática', 'Tornillos por bandeja', 'Etiquetar cada cable'] },
  ],
  docencia: [
    { titulo: 'Python', lamina: 'codigo', codigo: ['nombre = input("Nombre: ")', 'for i in range(3):', '    print(f"Hola, {nombre}")'] },
    { titulo: 'Diagramas de flujo', lamina: 'flujo' },
  ],
  freelance: [
    { titulo: 'JustPhones', imagen: '/proyectos/justphones/portada.webp', url: 'justphones-fv.vercel.app' },
    { titulo: 'Neifert Automotores', imagen: '/proyectos/neifert/portada.webp', url: 'neifertautomotores.com' },
  ],
  tecnico: [
    { titulo: 'Darío Martínez Computación', imagen: '/proyectos/dario-martinez/portada.webp', url: 'dariomartinezcomputacion.com' },
    { titulo: 'Servicio técnico', lamina: 'pasos', pasos: ['PCs y notebooks', 'Impresoras', 'Teléfonos', 'Hardware y software'] },
  ],
  mbrf: [
    { titulo: 'Trazabilidad en planta', imagen: '/proyectos/mbrf-captura/portada.webp', url: 'sistema interno · MBRF' },
    { titulo: 'Planeamiento de producción', imagen: '/proyectos/mbrf-control/portada.webp', url: 'sistema interno · MBRF' },
  ],
};

// Póster de un proyecto, apaisado como su captura (16:10): la página entera adentro de una ventana
// de navegador, sin recortes, y el nombre abajo.
const CAPTURA = { ancho: 1024, alto: 760, barra: 52, pie: 68 };
function texturaCaptura(dato, acento) {
  const l = document.createElement('canvas');
  l.width = CAPTURA.ancho;
  l.height = CAPTURA.alto;
  const ctx = l.getContext('2d');
  const textura = new THREE.CanvasTexture(l);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 4;
  const { ancho, alto, barra, pie } = CAPTURA;
  const pintar = (imagen) => {
    ctx.fillStyle = '#16181d';
    ctx.fillRect(0, 0, ancho, alto);
    // barra del navegador: tres puntos y la dirección
    ['#ff5f57', '#febc2e', '#28c840'].forEach((c, k) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(30 + k * 26, barra / 2, 8, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = '#23262d';
    ctx.beginPath();
    ctx.roundRect?.(130, 12, ancho - 260, barra - 24, 14);
    ctx.fill();
    ctx.fillStyle = '#9aa0a8';
    ctx.font = `600 18px ${FUENTE_POSTER}`;
    ctx.textAlign = 'center';
    ctx.fillText(dato.url ?? dato.titulo.toLowerCase().replaceAll(' ', ''), ancho / 2, barra / 2 + 6);
    ctx.textAlign = 'left';
    // la captura entera (16:10 = 1024 × 640)
    const zona = alto - barra - pie;
    if (imagen) ctx.drawImage(imagen, 0, barra, ancho, zona);
    // pie con el nombre
    ctx.fillStyle = '#101216';
    ctx.fillRect(0, alto - pie, ancho, pie);
    ctx.fillStyle = acento;
    ctx.fillRect(28, alto - pie / 2 - 4, 40, 8);
    ctx.fillStyle = '#f4f5f7';
    ctx.font = `800 34px ${FUENTE_POSTER}`;
    ctx.fillText(dato.titulo, 84, alto - pie / 2 + 12);
    textura.needsUpdate = true;
  };
  pintar(null);
  const imagen = new Image();
  imagen.onload = () => pintar(imagen);
  imagen.src = dato.imagen;
  return textura;
}

function texturaPoster(dato, acento) {
  const l = document.createElement('canvas');
  l.width = 512;
  l.height = 704;
  const ctx = l.getContext('2d');
  const textura = new THREE.CanvasTexture(l);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 4;
  const pintar = (imagen) => {
    ctx.fillStyle = '#101216';
    ctx.fillRect(0, 0, 512, 704);
    if (imagen) {
      // la portada cubre toda la hoja (recortada al centro); el título va abajo, sobre un degradé
      const escala = Math.max(512 / imagen.width, 704 / imagen.height);
      const w = imagen.width * escala;
      const h = imagen.height * escala;
      ctx.drawImage(imagen, (512 - w) / 2, (704 - h) / 2, w, h);
      const sombra = ctx.createLinearGradient(0, 420, 0, 704);
      sombra.addColorStop(0, 'rgba(10,11,14,0)');
      sombra.addColorStop(1, 'rgba(10,11,14,0.92)');
      ctx.fillStyle = sombra;
      ctx.fillRect(0, 420, 512, 284);
      ctx.fillStyle = acento;
      ctx.fillRect(36, 590, 60, 8);
      ctx.fillStyle = '#f4f5f7';
      ctx.font = `800 44px ${FUENTE_POSTER}`;
      const lineas = partirTexto(ctx, dato.titulo, 440);
      lineas.forEach((t, k) => ctx.fillText(t, 36, 648 - (lineas.length - 1 - k) * 48));
      textura.needsUpdate = true;
      return;
    }
    ctx.fillStyle = acento;
    ctx.fillRect(0, 0, 512, 12);
    ctx.fillStyle = '#f4f5f7';
    ctx.font = `800 52px ${FUENTE_POSTER}`;
    const lineas = partirTexto(ctx, dato.titulo, 440);
    lineas.forEach((t, k) => ctx.fillText(t, 36, 86 + k * 56));
    const y0 = 130 + (lineas.length - 1) * 56;
    const alto = 704 - y0 - 36;
    if (dato.lamina === 'pasos') {
      const paso = alto / dato.pasos.length;
      dato.pasos.forEach((t, k) => {
        const y = y0 + k * paso + paso / 2;
        ctx.fillStyle = acento;
        ctx.beginPath();
        ctx.arc(76, y, 38, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#101216';
        ctx.font = `800 40px ${FUENTE_POSTER}`;
        ctx.textAlign = 'center';
        ctx.fillText(String(k + 1), 76, y + 14);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#e6e8ec';
        ctx.font = `700 34px ${FUENTE_POSTER}`;
        const ls = partirTexto(ctx, t, 330);
        ls.forEach((linea, n) => ctx.fillText(linea, 136, y + 12 - (ls.length - 1) * 19 + n * 38));
      });
    } else if (dato.lamina === 'codigo') {
      ctx.fillStyle = '#1a1d23';
      ctx.fillRect(28, y0, 456, 330);
      ctx.font = `600 25px ui-monospace, Consolas, monospace`;
      dato.codigo.forEach((t, k) => {
        ctx.fillStyle = k === 1 ? acento : '#e6e8ec';
        ctx.fillText(t, 46, y0 + 60 + k * 48);
      });
      ctx.fillStyle = '#9aa0a8';
      ['> Hola, Ana', '> Hola, Ana', '> Hola, Ana'].forEach((t, k) => ctx.fillText(t, 46, y0 + 220 + k * 34));
      ctx.fillStyle = '#e6e8ec';
      ctx.font = `700 32px ${FUENTE_POSTER}`;
      ['Variables', 'Bucles', 'Funciones'].forEach((t, k) => {
        ctx.fillStyle = acento;
        ctx.fillRect(36, y0 + 380 + k * 50, 14, 14);
        ctx.fillStyle = '#e6e8ec';
        ctx.fillText(t, 66, y0 + 396 + k * 50);
      });
    } else if (dato.lamina === 'flujo') {
      ctx.lineWidth = 5;
      ctx.font = `700 28px ${FUENTE_POSTER}`;
      const cx = 256;
      const forma = (y, tipo, texto) => {
        ctx.beginPath();
        if (tipo === 'ovalo') ctx.ellipse(cx, y, 130, 40, 0, 0, Math.PI * 2);
        else if (tipo === 'rombo') {
          ctx.moveTo(cx, y - 62);
          ctx.lineTo(cx + 150, y);
          ctx.lineTo(cx, y + 62);
          ctx.lineTo(cx - 150, y);
          ctx.closePath();
        } else ctx.rect(cx - 140, y - 38, 280, 76);
        ctx.strokeStyle = tipo === 'rombo' ? acento : '#e6e8ec';
        ctx.stroke();
        ctx.fillStyle = '#e6e8ec';
        ctx.fillText(texto, cx - ctx.measureText(texto).width / 2, y + 10);
      };
      const ys = [y0 + 50, y0 + 50 + alto * 0.28, y0 + 50 + alto * 0.55, alto + y0 - 50];
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.moveTo(cx, ys[k] + (k === 2 ? 62 : 40));
        ctx.lineTo(cx, ys[k + 1] - (k === 1 ? 62 : 40));
        ctx.strokeStyle = '#9aa0a8';
        ctx.stroke();
      }
      forma(ys[0], 'ovalo', 'Inicio');
      forma(ys[1], 'rect', 'Leer nota');
      forma(ys[2], 'rombo', '¿nota >= 6?');
      forma(ys[3], 'ovalo', 'Fin');
    } else if (dato.lamina === 'pc') {
      const f = alto / 500;
      const piezas = [['CPU', 28, 0, 216, 170], ['RAM', 268, 0, 216, 78], ['GPU', 268, 92, 216, 78], ['Fuente', 28, 190, 216, 140], ['SSD', 268, 190, 216, 140], ['Placa madre', 28, 350, 456, 150]];
      ctx.font = `800 34px ${FUENTE_POSTER}`;
      piezas.forEach(([t, x, y, w, h], k) => {
        ctx.fillStyle = k === 0 ? acento : 'rgba(230,232,236,0.08)';
        ctx.fillRect(x, y0 + y * f, w, h * f);
        ctx.strokeStyle = k === 0 ? acento : 'rgba(230,232,236,0.7)';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y0 + y * f, w, h * f);
        ctx.fillStyle = k === 0 ? '#101216' : '#e6e8ec';
        ctx.fillText(t, x + 18, y0 + y * f + 46);
      });
    }
    textura.needsUpdate = true;
  };
  pintar(null);
  if (dato.imagen) {
    const imagen = new Image();
    imagen.onload = () => pintar(imagen);
    imagen.src = dato.imagen;
  }
  return textura;
}

const FUENTE_POSTER = 'Inter, system-ui, sans-serif';
function partirTexto(ctx, texto, ancho) {
  const palabras = texto.split(' ');
  const lineas = [''];
  for (const w of palabras) {
    const prueba = lineas[lineas.length - 1] ? `${lineas[lineas.length - 1]} ${w}` : w;
    if (ctx.measureText(prueba).width > ancho && lineas[lineas.length - 1]) lineas.push(w);
    else lineas[lineas.length - 1] = prueba;
  }
  return lineas;
}

function posters(g, p, trabajo, indice) {
  const datos = POSTERS[trabajo.id];
  if (!datos) return;
  const lugares = [];
  if (p.vestibulo > 0) {
    // en el vestíbulo, uno en cada pared
    for (const lado of [-1, 1]) lugares.push({ x: lado * (ANCHO / 2 - 0.03), z: -p.vestibulo / 2, giro: lado < 0 ? Math.PI / 2 : -Math.PI / 2 });
  } else if (indice === 0) {
    // en la pared de atrás del primer pasillo
    for (const lado of [-1, 1]) lugares.push({ x: lado * 1.15, z: -0.03, giro: Math.PI });
  }
  const marco = new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.5, metalness: 0.3 });
  lugares.forEach((lugar, k) => {
    const dato = datos[k % datos.length];
    const grupo = new THREE.Group();
    grupo.position.set(lugar.x, 1.58, lugar.z);
    grupo.rotation.y = lugar.giro;
    // las capturas de proyectos, apaisadas; las láminas, verticales
    const [w, h] = dato.imagen ? [1.5, (1.5 * CAPTURA.alto) / CAPTURA.ancho] : [0.9, 1.24];
    grupo.add(new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.025), marco));
    const textura = dato.imagen ? texturaCaptura(dato, trabajo.acento) : texturaPoster(dato, trabajo.acento);
    const lamina = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: textura, roughness: 0.65 }));
    lamina.position.z = 0.0135;
    grupo.add(lamina);
    g.add(grupo);
  });
}

export function crearEscenaPasillo({ lienzo, trabajos, recorrido, tema = 'dark', alCuadro, alPerder, alSoltar, alIrA }) {
  const alta = calidadAlta();
  const angosta = window.matchMedia('(max-width: 760px)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: !alta, powerPreference: 'high-performance', stencil: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, alta ? 1.5 : angosta ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // con postprocesado el mapeo de tonos lo hace el último pase
  renderer.toneMapping = alta ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  // sin la verificación sincrónica de shaders: three llamaría a getProgramInfoLog al enlazar cada
  // programa y eso bloquea el hilo hasta que el driver termina de compilar (anula compileAsync y
  // traba el scroll varios segundos al entrar a un pasillo nuevo)
  renderer.debug.checkShaderErrors = false;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // el mapa de sombras se recalcula sólo cuando la cámara (y con ella el foco) se mueve, y cada
  // tanto por lo animado
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  const ratioOriginal = renderer.getPixelRatio();
  let ratioMax = ratioOriginal;
  let ratioMin = Math.max(0.6, ratioMax * 0.55);
  // modo rendimiento (toggle del sitio): sin postprocesado, sin sombras y con menos píxeles
  let rendimiento = modoRendimiento();

  const escena = new THREE.Scene();
  escena.fog = new THREE.Fog(0x000000, 10, 30);
  const camara = new THREE.PerspectiveCamera(angosta ? 78 : 66, 1, 0.05, 60);
  escena.add(camara);

  // luz ambiente realista: un estudio prefiltrado (reflejos en metal, vidrio, plástico)
  const pmrem = new THREE.PMREMGenerator(renderer);
  const entorno = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  escena.environment = entorno;
  escena.environmentIntensity = 0.42;

  const hemisferio = new THREE.HemisphereLight(0xfff4e6, 0x2a2622, 0.35);
  escena.add(hemisferio);
  // relleno muy suave desde la cámara (que nada quede negro)
  const linterna = new THREE.PointLight(0xfff1dc, 2.2, 7, 2);
  linterna.position.set(0, 0.3, 0.2);
  camara.add(linterna);
  // foco con sombras que va delante de la cámara, desde el techo
  const foco = new THREE.SpotLight(0xfff3e2, 26, 13, 1.05, 0.85, 1.6);
  foco.castShadow = true;
  foco.shadow.mapSize.set(alta ? 2048 : 1024, alta ? 2048 : 1024);
  foco.shadow.bias = -0.0004;
  foco.shadow.normalBias = 0.025;
  foco.shadow.radius = 4;
  foco.shadow.camera.near = 0.3;
  foco.shadow.camera.far = 13;
  escena.add(foco, foco.target);
  // lámparas: luces que se ubican en las lámparas reales más cercanas
  const luces = Array.from({ length: LUCES }, () => {
    const l = new THREE.PointLight(0xffffff, 0, 7.5, 2);
    escena.add(l);
    return l;
  });

  const recursos = crearRecursos(renderer, medida);
  const matTechoBase = recursos.materialPBR(TEXTURA_TECHO, { color: '#e9e7e2' });
  const matLuzTechoBase = new THREE.MeshBasicMaterial({ color: 0xfffaf0 });
  // construcción en tiempo real: la estructura se arma primero (demora 0), el resto después
  const construccion = crearConstruccion({ reducido: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches });

  const anclas = []; // { pasillo, objeto, local, grupo, posicion, normal, centro, tamano }
  const animables = [];

  function plano(padre, w, h, material, pos, rot, uv = null) {
    const geo = new THREE.PlaneGeometry(w, h);
    if (uv) escalarUV(geo, uv[0], uv[1]);
    const m = new THREE.Mesh(geo, material);
    m.position.set(...pos);
    m.rotation.set(...rot);
    m.receiveShadow = true;
    padre.add(m);
    return m;
  }

  // Cartel colgante al comienzo de cada pasillo: período, puesto y lugar.
  function cartelEntrada(padre, trabajo, numero) {
    const soporte = new THREE.MeshStandardMaterial({ color: 0x2c3038, metalness: 0.9, roughness: 0.35 });
    for (const x of [-0.9, 0.9]) {
      const barra = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.32, 8), soporte);
      barra.position.set(x, ALTO - 0.16, -3.4);
      padre.add(barra);
    }
    const marco = new THREE.Mesh(new THREE.BoxGeometry(2.36, 0.66, 0.04), new THREE.MeshStandardMaterial({ color: '#15171c', metalness: 0.6, roughness: 0.4 }));
    marco.position.set(0, ALTO - 0.62, -3.4);
    marco.castShadow = true;
    padre.add(marco);
    lamina(
      padre,
      [2.3, 0.6],
      [0, ALTO - 0.62, -3.378],
      (ctx, w, h) => {
        ctx.fillStyle = '#0d1016';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = trabajo.acento;
        ctx.fillRect(0, 0, w * 0.012, h);
        ctx.font = fuente(Math.round(h * 0.17), 800);
        ctx.fillText(`${String(numero).padStart(2, '0')} · ${trabajo.periodo}`.toUpperCase(), w * 0.04, h * 0.3);
        ctx.fillStyle = '#f4f5f7';
        ctx.font = fuente(Math.round(h * 0.3), 800);
        ctx.fillText(trabajo.puesto, w * 0.04, h * 0.64);
        ctx.fillStyle = '#9aa1ac';
        ctx.font = fuente(Math.round(h * 0.15), 500);
        ctx.fillText(trabajo.lugar, w * 0.04, h * 0.88);
      },
      { emisivo: 0.85, resolucion: 300 },
    );
  }

  // Marco de puerta al entrar a cada pasillo (metal pintado, con un filo de luz del color del trabajo).
  function portal(padre, acento) {
    const metal = new THREE.MeshStandardMaterial({ color: '#2a2d33', metalness: 0.8, roughness: 0.38 });
    const luz = new THREE.MeshBasicMaterial({ color: acento });
    const grosor = 0.12;
    for (const x of [-ANCHO / 2 + grosor / 2, ANCHO / 2 - grosor / 2]) {
      const lado = new THREE.Mesh(new THREE.BoxGeometry(grosor, ALTO, grosor), metal);
      lado.position.set(x, ALTO / 2, -0.05);
      lado.castShadow = true;
      padre.add(lado);
      const filo = new THREE.Mesh(new THREE.BoxGeometry(0.012, ALTO - 0.2, 0.012), luz);
      filo.position.set(x - Math.sign(x) * (grosor / 2 + 0.004), ALTO / 2, -0.05);
      padre.add(filo);
    }
    const dintel = new THREE.Mesh(new THREE.BoxGeometry(ANCHO, grosor, grosor), metal);
    dintel.position.set(0, ALTO - grosor / 2, -0.05);
    padre.add(dintel);
  }

  // Pared de fondo del cruce: anuncia el trabajo siguiente y para qué lado se dobla.
  function cartelCruce(padre, siguiente, giro) {
    const brillo = new THREE.MeshBasicMaterial({ color: 0xfff3dc, toneMapped: false });
    for (const x of [-1.62, 1.62]) {
      const columna = new THREE.Mesh(new THREE.BoxGeometry(0.03, 2.3, 0.03), brillo);
      columna.position.set(x, 1.6, -ANCHO / 2 + 0.1);
      padre.add(columna);
    }
    lamina(
      padre,
      [2.7, 1.45],
      [0, 1.72, -ANCHO / 2 + 0.1],
      (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(13,16,22,0.94)';
        redondear(ctx, 0, 0, w, h, h * 0.05);
        ctx.fill();
        ctx.fillStyle = siguiente.acento;
        ctx.fillRect(0, h - 10, w, 10);
        ctx.font = fuente(Math.round(h * 0.075), 700);
        ctx.fillStyle = '#9aa1ac';
        ctx.fillText('SIGUIENTE', w * 0.07, h * 0.2);
        ctx.fillStyle = siguiente.acento;
        ctx.font = fuente(Math.round(h * 0.09), 800);
        ctx.fillText(siguiente.periodo, w * 0.07, h * 0.36);
        ctx.fillStyle = '#f4f5f7';
        ctx.font = fuente(Math.round(h * 0.13), 800);
        envolver(ctx, siguiente.puesto, w * 0.07, h * 0.55, w * 0.62, h * 0.15);
        ctx.fillStyle = '#9aa1ac';
        ctx.font = fuente(Math.round(h * 0.065), 500);
        ctx.fillText(siguiente.lugar, w * 0.07, h * 0.9);
        ctx.save();
        ctx.translate(w * 0.84, h * 0.48);
        if (giro < 0) ctx.scale(-1, 1);
        ctx.strokeStyle = siguiente.acento;
        ctx.lineWidth = h * 0.05;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-h * 0.14, 0);
        ctx.lineTo(h * 0.14, 0);
        ctx.moveTo(h * 0.03, -h * 0.11);
        ctx.lineTo(h * 0.14, 0);
        ctx.lineTo(h * 0.03, h * 0.11);
        ctx.stroke();
        ctx.restore();
      },
      { emisivo: 0.85, resolucion: 420 },
    ).material.transparent = true;
  }

  // Final del recorrido: una antesala despejada y simétrica que termina en una puerta doble
  // cerrada; la luz se filtra por la junta y por debajo. Al acercarse, las hojas se abren hacia
  // afuera, entran haces de luz y la cámara atraviesa el vano: del otro lado todo es luz.
  // Devuelve `abrir(f, t)` (f en [0, 1]) para animarla según el avance.
  const ANCHO_VANO = 1.7;
  const ALTO_VANO = 2.55;
  function puertaFinal(padre, largo, matPared) {
    const fondo = -largo;
    const W2 = ANCHO / 2;
    const lateral = (W2 - ANCHO_VANO / 2) / 2;
    // pared del fondo con el vano recortado
    plano(padre, W2 - ANCHO_VANO / 2, ALTO, matPared, [-W2 + lateral, ALTO / 2, fondo], [0, 0, 0], [(W2 - ANCHO_VANO / 2) / TEXEL.pared, ALTO / TEXEL.pared]);
    plano(padre, W2 - ANCHO_VANO / 2, ALTO, matPared, [W2 - lateral, ALTO / 2, fondo], [0, 0, 0], [(W2 - ANCHO_VANO / 2) / TEXEL.pared, ALTO / TEXEL.pared]);
    plano(padre, ANCHO_VANO, ALTO - ALTO_VANO, matPared, [0, (ALTO + ALTO_VANO) / 2, fondo], [0, 0, 0], [ANCHO_VANO / TEXEL.pared, (ALTO - ALTO_VANO) / TEXEL.pared]);

    const metal = new THREE.MeshStandardMaterial({ color: '#1d2026', metalness: 0.85, roughness: 0.32 });
    const hoja = new THREE.MeshStandardMaterial({ color: '#272b33', metalness: 0.55, roughness: 0.42 });
    const brillo = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, fog: false });
    // marco
    for (const x of [-1, 1]) {
      const jamba = new THREE.Mesh(new RoundedBoxGeometry(0.09, ALTO_VANO + 0.06, 0.2, 2, 0.01), metal);
      jamba.position.set(x * (ANCHO_VANO / 2 + 0.045), (ALTO_VANO + 0.06) / 2, fondo + 0.05);
      jamba.castShadow = true;
      padre.add(jamba);
    }
    const dintel = new THREE.Mesh(new RoundedBoxGeometry(ANCHO_VANO + 0.18, 0.09, 0.2, 2, 0.01), metal);
    dintel.position.set(0, ALTO_VANO + 0.045, fondo + 0.05);
    padre.add(dintel);
    // dos columnas de luz que enmarcan la puerta (simétricas)
    for (const x of [-1, 1]) {
      const columna = new THREE.Mesh(new THREE.BoxGeometry(0.035, ALTO - 0.3, 0.035), brillo);
      columna.position.set(x * (ANCHO_VANO / 2 + 0.42), ALTO / 2, fondo + 0.03);
      padre.add(columna);
    }
    // hojas (bisagras en los costados del vano)
    const hojas = [-1, 1].map((lado) => {
      const bisagra = new THREE.Group();
      bisagra.position.set(lado * (ANCHO_VANO / 2), 0, fondo - 0.02);
      const panel = new THREE.Mesh(new RoundedBoxGeometry(ANCHO_VANO / 2 - 0.012, ALTO_VANO - 0.03, 0.05, 2, 0.008), hoja);
      panel.position.set(-lado * (ANCHO_VANO / 4 - 0.006), ALTO_VANO / 2 + 0.01, 0);
      panel.castShadow = true;
      bisagra.add(panel);
      // barral y moldura
      const barral = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 12), metal);
      barral.position.set(-lado * (ANCHO_VANO / 2 - 0.12), 1.15, 0.06);
      bisagra.add(barral);
      for (const y of [0.55, 1.75]) {
        const moldura = new THREE.Mesh(new THREE.BoxGeometry(ANCHO_VANO / 2 - 0.2, 0.012, 0.012), metal);
        moldura.position.set(-lado * (ANCHO_VANO / 4), y, 0.03);
        bisagra.add(moldura);
      }
      padre.add(bisagra);
      return { bisagra, lado };
    });
    // del otro lado: un cuarto de luz pura (sin niebla, sin mapeo de tonos)
    // una esfera (sin aristas que la oclusión ambiental pueda marcar) con luz por encima de 1: blanco puro
    const blanco = new THREE.MeshBasicMaterial({ side: THREE.BackSide, toneMapped: false, fog: false });
    blanco.color.setScalar(6);
    const cuarto = new THREE.Mesh(new THREE.SphereGeometry(4.2, 32, 16), blanco);
    cuarto.position.set(0, 1.4, fondo - 4.3);
    cuarto.userData.sinConstruccion = true;
    padre.add(cuarto);
    // luz que se filtra: rendija del medio y bajo la puerta
    const rendija = new THREE.Mesh(new THREE.PlaneGeometry(0.014, ALTO_VANO - 0.04), brillo);
    rendija.position.set(0, ALTO_VANO / 2, fondo - 0.05);
    padre.add(rendija);
    const halo = texturaHalo();
    const charco = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 2.2),
      new THREE.MeshBasicMaterial({ map: halo, color: 0xfff6e8, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    charco.rotation.x = -Math.PI / 2;
    charco.position.set(0, 0.004, fondo + 0.95);
    padre.add(charco);
    // haces de luz (planos aditivos en abanico) que aparecen al abrir
    const haces = [];
    const texHaz = texturaHaz();
    for (let k = 0; k < 7; k++) {
      const haz = new THREE.Mesh(
        new THREE.PlaneGeometry(ANCHO_VANO * 0.9, 6),
        new THREE.MeshBasicMaterial({ map: texHaz, color: 0xfff3df, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      );
      haz.position.set((k - 3) * 0.12, ALTO_VANO / 2, fondo + 3);
      haz.rotation.set(-Math.PI / 2 + 0.18, (k - 3) * 0.06, 0);
      padre.add(haz);
      haces.push(haz);
    }
    const luzPuerta = new THREE.PointLight(0xfff2e0, 0, 9, 1.6);
    luzPuerta.position.set(0, 1.6, fondo + 0.4);
    padre.add(luzPuerta);
    return {
      abrir(f, t) {
        const e = f * f * (3 - 2 * f);
        const angulo = e * 1.45;
        for (const { bisagra, lado } of hojas) bisagra.rotation.y = lado * -angulo;
        rendija.visible = f < 0.02;
        // la luz del otro lado sólo existe con la puerta abriéndose (si no, se vería a lo lejos
        // mientras la pared todavía no está construida)
        cuarto.visible = f > 0.001;
        charco.material.opacity = 0.35 + e * 0.6;
        charco.scale.setScalar(1 + e * 1.4);
        haces.forEach((haz, k) => {
          haz.material.opacity = e * (0.07 + 0.03 * Math.sin(t * 0.7 + k * 1.9));
        });
        luzPuerta.intensity = 3 + e * 38;
      },
    };
  }

  const raiz = new THREE.Group();
  escena.add(raiz);
  if (process.env.NODE_ENV !== 'production') {
    window.__escenaPasillo = escena;
    window.__rendererPasillo = renderer;
  }
  // por pasillo: grupos que se muestran/ocultan juntos, plan de modelos reales y estado de carga
  const zonas = [];
  // dónde empieza cada pasillo sobre el camino de la cámara (m)
  const bases = [];
  let puerta = null;

  recorrido.pasillos.forEach((p, i) => {
    const trabajo = trabajos[i];
    const tex = AMBIENTES[trabajo.id]?.texturas ?? AMBIENTES.laboratorio.texturas;
    const materiales = crearMaterialesPasillo(trabajo.id, recursos, { alta });
    const matPiso = recursos.materialPBR(tex.piso, { color: '#6b6b6b' });
    const matPared = recursos.materialPBR(tex.pared, { color: '#8a8a8a' });
    // la estructura de cada pasillo se arma primero (demora 0) con su propio frente de obra
    // dónde empieza este pasillo sobre el camino de la cámara (el primero arranca un poco adentro)
    const arranque = puntoEn(recorrido, recorrido.comienzos[i]);
    const base = recorrido.comienzos[i] - ((arranque[0] - p.inicio[0]) * p.dir[0] + (arranque[1] - p.inicio[1]) * p.dir[1]);
    construccion.obra(i, p, { base, paleta: trabajo.paleta ?? [trabajo.acento] });
    bases[i] = base;
    const matTecho = matTechoBase.clone();
    const matLuzTecho = matLuzTechoBase.clone();
    for (const m of [matPiso, matPared, matTecho, matLuzTecho]) construccion.preparar(m, i, 0);
    const g = new THREE.Group();
    g.position.set(p.inicio[0], 0, p.inicio[1]);
    g.rotation.y = guinadaDe(p.dir);
    raiz.add(g);
    const L = p.largo;

    plano(g, ANCHO, L, matPiso, [0, 0, -L / 2], [-Math.PI / 2, 0, 0], [ANCHO / TEXEL.piso, L / TEXEL.piso]);
    plano(g, ANCHO, L, matTecho, [0, ALTO, -L / 2], [Math.PI / 2, 0, 0], [ANCHO / TEXEL.techo, L / TEXEL.techo]);
    plano(g, L, ALTO, matPared, [-ANCHO / 2, ALTO / 2, -L / 2], [0, Math.PI / 2, 0], [L / TEXEL.pared, ALTO / TEXEL.pared]);
    plano(g, L, ALTO, matPared, [ANCHO / 2, ALTO / 2, -L / 2], [0, -Math.PI / 2, 0], [L / TEXEL.pared, ALTO / TEXEL.pared]);
    for (let z = 1.5; z < L; z += 3) plano(g, 1.2, 0.3, matLuzTecho, [0, ALTO - 0.005, -z], [Math.PI / 2, 0, 0]);
    if (i === 0) plano(g, ANCHO, ALTO, matPared, [0, ALTO / 2, 0], [0, Math.PI, 0], [ANCHO / TEXEL.pared, ALTO / TEXEL.pared]);
    portal(g, trabajo.acento);
    posters(g, p, trabajo, i);
    cartelEntrada(g, trabajo, i + 1);

    // objetos con tooltip (los que usan modelos reales los reservan: no se repiten en el relleno)
    const excluidos = new Set();
    const realesTooltip = [];
    const luzVitrinas = [];
    const medidas = new Map();
    p.objetos.forEach((o) => {
      const dato = trabajo.objetos[o.indice];
      const modelo = construirModelo(dato.modelo, trabajo.acento);
      modelo.grupo.position.set(o.lado * (ANCHO / 2 - 0.01), 0, -o.a);
      modelo.grupo.rotation.y = o.lado < 0 ? Math.PI / 2 : -Math.PI / 2;
      modelo.grupo.traverse((m) => {
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });
      // lo que ocupa de verdad (a lo largo de la pared y de alto): nada de encima lo atraviesa
      modelo.grupo.updateMatrixWorld(true);
      const caja = new THREE.Box3().setFromObject(modelo.grupo);
      medidas.set(o.indice, { ancho: caja.max.z - caja.min.z, alto: caja.max.y });
      g.add(modelo.grupo);
      if (modelo.animar) animables.push(modelo.animar);
      vitrina(g, o, dato.modelo, trabajo.acento, medidas.get(o.indice));
      luzVitrinas.push(new THREE.Vector3(o.lado * (ANCHO / 2 - 0.9), ALTO - 0.3, -o.a));
      const indice = anclas.length;
      modelo.grupo.traverse((m) => (m.userData.ancla = indice));
      anclas.push({
        pasillo: i,
        objeto: o.indice,
        local: modelo.ancla,
        grupo: modelo.grupo,
        posicion: new THREE.Vector3(),
        // hacia el centro del pasillo, en el mundo (para mirar el objeto de frente)
        normal: new THREE.Vector3(-o.lado * p.der[0], 0, -o.lado * p.der[1]),
        centro: new THREE.Vector3(),
        tamano: new THREE.Vector3(),
      });
      for (const real of modelo.reales ?? []) {
        excluidos.add(real.id);
        realesTooltip.push({ ...real, grupo: modelo.grupo, ancla: indice });
      }
    });

    const { grupo: relleno, plan } = rellenarPasillo({
      id: trabajo.id,
      largo: L,
      vestibulo: p.vestibulo,
      objetos: p.objetos.map((o) => ({ a: o.a, lado: o.lado, modelo: trabajo.objetos[o.indice].modelo, ...medidas.get(o.indice) })),
      semilla: 1000 + i * 97,
      ultimo: !p.cruce,
      materiales,
      excluidos,
    });
    g.add(relleno);

    const grupos = [g];
    if (p.cruce) {
      const c = new THREE.Group();
      c.position.set(p.cruce[0], 0, p.cruce[1]);
      c.rotation.y = guinadaDe(p.dir);
      raiz.add(c);
      grupos.push(c);
      plano(c, ANCHO, ANCHO, matPiso, [0, 0, 0], [-Math.PI / 2, 0, 0], [ANCHO / TEXEL.piso, ANCHO / TEXEL.piso]);
      plano(c, ANCHO, ANCHO, matTecho, [0, ALTO, 0], [Math.PI / 2, 0, 0], [ANCHO / TEXEL.techo, ANCHO / TEXEL.techo]);
      plano(c, 1.2, 0.3, matLuzTecho, [0, ALTO - 0.005, 0], [Math.PI / 2, 0, 0]);
      // pared de enfrente y la del lado que no se abre
      plano(c, ANCHO, ALTO, matPared, [0, ALTO / 2, -ANCHO / 2], [0, 0, 0], [ANCHO / TEXEL.pared, ALTO / TEXEL.pared]);
      const xCerrado = -p.giro * (ANCHO / 2);
      plano(c, ANCHO, ALTO, matPared, [xCerrado, ALTO / 2, 0], [0, p.giro > 0 ? Math.PI / 2 : -Math.PI / 2, 0], [ANCHO / TEXEL.pared, ALTO / TEXEL.pared]);
      cartelCruce(c, trabajos[i + 1], p.giro);
      c.add(rellenarCruce({ id: trabajo.id, giro: p.giro, semilla: 5000 + i * 131, materiales, plan }).grupo);
    } else {
      puerta = puertaFinal(g, L, matPared);
    }

    // posiciones de lámparas en el mundo (para mover las luces); primero las de las vitrinas
    g.updateMatrixWorld(true);
    const lamparas = luzVitrinas.map((v) => v.applyMatrix4(g.matrixWorld));
    for (const [x, y, z] of plan.luces) lamparas.push(new THREE.Vector3(x, y - 0.25, z).applyMatrix4(g.matrixWorld));
    for (let z = 1.5; z < L; z += 3) lamparas.push(new THREE.Vector3(0, ALTO - 0.35, -z).applyMatrix4(g.matrixWorld));
    for (const a of anclas) if (a.pasillo === i) construccion.aplicar(a.grupo, i, 1.2, { destacado: true });
    for (const grupo of grupos) construccion.aplicar(grupo, i, 1.2);
    zonas.push({ indice: i, trabajo, grupos, g, plan, materiales, realesTooltip, lamparas, cargada: false });
  });
  raiz.updateMatrixWorld(true);

  // Puntos de escaneo de un objeto: vértices reales de sus mallas, bien repartidos (muestreo del
  // punto más lejano). Se calculan la primera vez que hacen falta y otra vez al cargar sus modelos.
  const vertice = new THREE.Vector3();
  function puntosDeEscaneo(a) {
    const candidatos = [];
    a.grupo.updateMatrixWorld(true);
    a.grupo.traverse((m) => {
      const pos = m.isMesh && m.geometry?.attributes?.position;
      if (!pos) return;
      const paso = Math.max(1, Math.floor(pos.count / 160));
      for (let k = 0; k < pos.count; k += paso) candidatos.push(vertice.fromBufferAttribute(pos, k).applyMatrix4(m.matrixWorld).clone());
    });
    if (!candidatos.length) return [];
    const elegidos = [candidatos.reduce((alto, c) => (c.y > alto.y ? c : alto))];
    const lejos = candidatos.map((c) => c.distanceToSquared(elegidos[0]));
    while (elegidos.length < 6) {
      let mejor = 0;
      for (let k = 1; k < candidatos.length; k++) if (lejos[k] > lejos[mejor]) mejor = k;
      if (lejos[mejor] < 0.01) break;
      elegidos.push(candidatos[mejor]);
      for (let k = 0; k < candidatos.length; k++) lejos[k] = Math.min(lejos[k], candidatos[k].distanceToSquared(candidatos[mejor]));
    }
    // en orden alrededor del centro, para unirlos en un contorno
    const centro = elegidos.reduce((c, p) => c.add(p), new THREE.Vector3()).multiplyScalar(1 / elegidos.length);
    const eje = a.normal;
    return elegidos
      .map((p) => ({ p, ang: Math.atan2(p.y - centro.y, (p.x - centro.x) * -eje.z + (p.z - centro.z) * eje.x) }))
      .sort((x, y) => x.ang - y.ang)
      .map(({ p }) => p);
  }

  function medirAncla(a) {
    a.marcas = null;
    a.grupo.updateMatrixWorld(true);
    a.posicion.copy(a.grupo.localToWorld(a.local.clone()));
    const caja = new THREE.Box3().setFromObject(a.grupo);
    if (caja.isEmpty()) caja.setFromCenterAndSize(a.posicion.clone().setY(1), new THREE.Vector3(1, 1.6, 0.6));
    caja.getCenter(a.centro);
    caja.getSize(a.tamano);
  }
  anclas.forEach(medirAncla);
  const gruposObjetos = anclas.map((a) => a.grupo);

  // ---- carga de modelos reales por pasillo ---------------------------------------------------
  // Lo pesado (agregar un modelo, detectar los estantes de un mueble) va a una cola que gasta a
  // lo sumo unos milisegundos por cuadro; cada modelo se muestra recién cuando sus shaders están
  // compilados (compileAsync), así cargar un pasillo no traba el scroll.
  let destruida = false;
  const cola = [];
  const PRESUPUESTO_MS = 4;
  const enCola = (trabajo) => new Promise((ok, mal) => cola.push({ trabajo, ok, mal }));
  function procesarCola() {
    const inicio = performance.now();
    while (cola.length && performance.now() - inicio < PRESUPUESTO_MS) {
      const { trabajo, ok, mal } = cola.shift();
      const t0 = performance.now();
      try {
        ok(trabajo());
      } catch (error) {
        mal(error);
      }
      if (process.env.NODE_ENV !== 'production' && performance.now() - t0 > 30) console.warn(`[pasillo] trabajo lento ${Math.round(performance.now() - t0)} ms`, trabajo.etiqueta ?? '');
    }
  }
  function mostrarCompilado(objeto) {
    objeto.visible = false;
    const listo = () => {
      if (!destruida) objeto.visible = true;
    };
    if (renderer.compileAsync) renderer.compileAsync(objeto, camara, escena).then(listo, listo);
    else listo();
  }

  async function ubicar(colocacion, padre, zona, ancla) {
    const modelo = await recursos.instancia(colocacion.id).catch(() => null);
    if (!modelo || destruida) return null;
    const agregar = () => {
      modelo.position.set(colocacion.x, colocacion.y, colocacion.z);
      modelo.rotation.y = colocacion.giro ?? 0;
      padre.add(modelo);
      if (ancla !== undefined) modelo.traverse((m) => (m.userData.ancla = ancla));
      construccion.aplicar(modelo, zona.indice, 1.2, { destacado: ancla !== undefined });
      mostrarCompilado(modelo);
    };
    agregar.etiqueta = `agregar ${colocacion.id}`;
    await enCola(agregar);
    if (!colocacion.poblar || destruida) return modelo;
    const poblar = () => {
      modelo.updateMatrixWorld(true);
      return poblarMueble({
        id: zona.trabajo.id,
        modelo,
        plan: zona.plan,
        materiales: zona.materiales,
        semilla: 77 + zona.indice * 13 + Math.round(colocacion.x * 100),
        alturaMundo: colocacion.y,
        ...(padre === zona.g ? { u: -colocacion.z, lado: Math.sign(colocacion.x) } : {}),
      });
    };
    poblar.etiqueta = `poblar ${colocacion.id}`;
    const poblado = await enCola(poblar).catch((error) => {
      console.warn(`[pasillo] no se pudo poblar ${colocacion.id}`, error);
      return null;
    });
    if (!poblado || destruida) return modelo;
    await enCola(() => {
      construccion.aplicar(poblado.grupo, zona.indice, 1.2, { destacado: ancla !== undefined });
      modelo.add(poblado.grupo);
      if (ancla !== undefined) poblado.grupo.traverse((m) => (m.userData.ancla = ancla));
    });
    await Promise.allSettled(poblado.colocaciones.map((c) => ubicar(c, modelo, zona, ancla)));
    return modelo;
  }

  function cargarZona(i) {
    const zona = zonas[i];
    if (!zona || zona.cargada) return;
    zona.cargada = true;
    // primero los muebles que se pueblan (consumen objetos pendientes), después lo suelto
    const conPoblar = zona.plan.colocaciones.filter((c) => c.poblar);
    const sueltos = zona.plan.colocaciones.filter((c) => !c.poblar);
    const tooltip = zona.realesTooltip.map((r) =>
      ubicar(r, r.grupo, zona, r.ancla).then(() => {
        if (!destruida) medirAncla(anclas[r.ancla]);
      }),
    );
    Promise.allSettled([...tooltip, ...conPoblar.map((c) => ubicar(c, zona.g, zona))]).then((resultados) => {
      for (const r of resultados) if (r.status === 'rejected') console.warn('[pasillo]', r.reason);
      return Promise.allSettled(sueltos.map((c) => ubicar(c, zona.g, zona)));
    });
  }

  // los archivos de los dos primeros pasillos se bajan en segundo plano apenas hay un respiro,
  // así al llegar a la sección ya están (y no aparecen de golpe)
  const precarga = setTimeout(() => {
    const ids = zonas.slice(0, 2).flatMap((z) => [...z.plan.colocaciones.map((c) => c.id), ...z.realesTooltip.map((r) => r.id)]);
    recursos.precargar([...new Set(ids)]);
  }, 3500);

  const cielo = crearFondo(escena, camara);
  cielo.fijar('aurora');
  let temaActual = tema;
  function fijarRendimiento(activo) {
    rendimiento = activo;
    ratioMax = activo ? Math.min(1, ratioOriginal) : ratioOriginal;
    ratioMin = Math.max(0.6, ratioMax * 0.55);
    renderer.setPixelRatio(ratioMax);
    tamano(ancho, alto);
    // sin el último pase del postprocesado, el mapeo de tonos lo hace el renderer
    renderer.toneMapping = composer && !activo ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = !activo;
    foco.castShadow = !activo;
    renderer.shadowMap.needsUpdate = true;
    escena.traverse((o) => {
      for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) m.needsUpdate = true;
    });
  }

  function fijarTema(nombre) {
    temaActual = nombre;
    const paleta = PALETAS[nombre] ?? PALETAS.dark;
    const fondo = cielo.fijar(cielo.id) ?? new THREE.Color(paleta.fondo);
    escena.fog.color.copy(fondo);
    renderer.setClearColor(fondo, 1);
    construccion.fijarFondo(fondo);
    renderer.toneMappingExposure = paleta.exposicion;
    if (tonos) tonos.mode = ToneMappingMode.ACES_FILMIC;
  }

  // ---- postprocesado ---------------------------------------------------------------------------
  let composer = null;
  let tonos = null;
  let contorno = null;
  let efectos = null;
  if (alta) {
    composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
    composer.addPass(new RenderPass(escena, camara));
    const ao = new N8AOPostPass(escena, camara, 1, 1);
    ao.configuration.aoRadius = 0.55;
    ao.configuration.distanceFalloff = 0.6;
    ao.configuration.intensity = 2.6;
    ao.configuration.halfRes = true;
    ao.configuration.depthAwareUpsampling = true;
    ao.configuration.gammaCorrection = false;
    ao.setQualityMode('Medium');
    composer.addPass(ao);
    efectos = crearEfectos({ escena, camara, composer });
    efectos.agregarPasadas();
    tonos = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    // contorno de los objetos interactivos al pasar el mouse
    contorno = new OutlineEffect(escena, camara, {
      blendFunction: BlendFunction.SCREEN,
      edgeStrength: 2.2,
      pulseSpeed: 0,
      visibleEdgeColor: 0xffffff,
      hiddenEdgeColor: 0x000000,
      kernelSize: KernelSize.VERY_SMALL,
      blur: false,
      xRay: false,
    });
    composer.addPass(
      new EffectPass(
        camara,
        new BloomEffect({ luminanceThreshold: 0.92, luminanceSmoothing: 0.2, intensity: 0.45, mipmapBlur: true }),
        contorno,
        tonos,
        new VignetteEffect({ offset: 0.32, darkness: 0.42 }),
        new SMAAEffect({ preset: SMAAPreset.HIGH }),
      ),
    );
  }
  efectos ??= crearEfectos({ escena, camara, composer: null });
  fijarTema(tema);

  // ---- cámara -------------------------------------------------------------------------------
  let objetivo = 0;
  let actual = 0;
  let giroMirada = 0;
  let giroMiradaObjetivo = 0;
  let inclinacion = 0;
  let inclinacionObjetivo = 0;
  const posicion = new THREE.Vector3();
  const mira = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const adelante = new THREE.Vector3();
  const reloj = new THREE.Timer();

  // ---- foco: la cámara gira y se acerca a un objeto ----------------------------------------
  let enfocado = -1;
  let sFoco = 0;
  // hasta cuándo (performance.now) el scroll sólo acompaña al foco y no lo suelta
  let acomodando = 0;
  let mezcla = 0; // 0 = caminando, 1 = mirando el objeto
  const posFoco = new THREE.Vector3();
  const miraFoco = new THREE.Vector3();
  const qCaminar = new THREE.Quaternion();
  const qFoco = new THREE.Quaternion();
  // una cámara (no un Object3D): su lookAt mira con -z, como la cámara real
  const ojo = new THREE.PerspectiveCamera();
  const ultimaPos = new THREE.Vector3();
  const ultimaQ = new THREE.Quaternion();

  function calcularFoco(i) {
    const a = anclas[i];
    medirAncla(a);
    const horizontal = Math.max(a.tamano.x, a.tamano.z);
    // en pantallas verticales entra menos a lo ancho: la cámara se aleja un poco más
    const vertical = camara.aspect < 1 ? 1.35 : 1;
    const distancia = Math.min(2.9, Math.max(1.15, (Math.max(horizontal, a.tamano.y) * 0.85 + 0.45) * vertical));
    // se mira lo de arriba del objeto (lo que hay sobre una mesa o un mostrador), desde la altura
    // de los ojos o un poco más arriba: nunca desde abajo
    const arriba = a.centro.y + a.tamano.y / 2;
    miraFoco.copy(a.centro).setY(Math.max(a.centro.y, arriba - Math.min(0.35, a.tamano.y * 0.3)));
    posFoco.copy(a.centro).addScaledVector(a.normal, distancia);
    posFoco.y = Math.min(2.1, Math.max(1.35, miraFoco.y + 0.4))
  }

  // Al mirar un objeto, la cámara se para en el centro del pasillo frente a él: así se arma (y se
  // carga) todo lo que lo rodea aunque se llegue saltando desde otro objeto, y al soltarlo quedás
  // delante de él. En el scroll avisa (`alIrA`) para mover la página a ese punto.
  function enfocar(i) {
    if (i < 0 || i >= anclas.length) return;
    const a = anclas[i];
    const s = Math.min(recorrido.largo, Math.max(0, bases[a.pasillo] + recorrido.pasillos[a.pasillo].objetos[a.objeto].a));
    enfocado = i;
    sFoco = s;
    acomodando = performance.now() + 1200;
    if (libre) {
      const [x, z] = puntoEn(recorrido, s);
      posLibre.set(x, ALTURA_OJOS, z);
      rumbo = Math.atan2(a.normal.x, a.normal.z);
      cabeceo = 0;
      objetivo = actual = s;
    } else {
      objetivo = s;
      alIrA?.(s);
    }
    calcularFoco(i);
  }

  function soltar(avisar = false) {
    if (enfocado < 0) return;
    enfocado = -1;
    if (avisar) alSoltar?.();
  }

  const rayo = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  // Objeto con tooltip bajo el puntero (x, y en px del lienzo), o -1.
  // `radio` (px): con el dedo se prueba también alrededor del toque, para no exigir puntería.
  function objetoEn(x, y, radio = 0) {
    const pasilloCamara = tramoEn(recorrido, actual).pasillo;
    rayo.far = DISTANCIA_PUNTOS;
    const desvios = Array.from({ length: 8 }, (_, k) => [Math.cos((k * Math.PI) / 4), Math.sin((k * Math.PI) / 4)]);
    for (const escala of radio > 0 ? [0, 0.5, 1] : [0]) {
      for (const [dx, dy] of escala === 0 ? [[0, 0]] : desvios) {
        ndc.set(((x + dx * radio * escala) / ancho) * 2 - 1, -((y + dy * radio * escala) / alto) * 2 + 1);
        rayo.setFromCamera(ndc, camara);
        for (const choque of rayo.intersectObjects(gruposObjetos, true)) {
          const i = choque.object.userData.ancla;
          if (i === undefined) continue;
          const d = anclas[i].pasillo - pasilloCamara;
          if (d === 0 || d === 1) return i;
        }
      }
    }
    return -1;
  }

  function mirarDesde(s) {
    const [x, z] = puntoEn(recorrido, s);
    const delante = s + MIRADA_ADELANTE;
    let [mx, mz] = puntoEn(recorrido, delante);
    if (delante > recorrido.largo) {
      const ultimo = recorrido.pasillos[recorrido.pasillos.length - 1];
      const extra = delante - recorrido.largo;
      mx += ultimo.dir[0] * extra;
      mz += ultimo.dir[1] * extra;
    }
    posicion.set(x, ALTURA_OJOS, z);
    mira.set(mx, ALTURA_OJOS - 0.06, mz);
  }

  let ancho = 1;
  let alto = 1;
  function tamano(w, h) {
    ancho = Math.max(1, w);
    alto = Math.max(1, h);
    renderer.setSize(ancho, alto, false);
    composer?.setSize(ancho, alto, false);
    camara.aspect = ancho / alto;
    camara.fov = ancho < 760 ? 78 : 66;
    camara.updateProjectionMatrix();
  }
  if (rendimiento) fijarRendimiento(true);

  const proyecciones = anclas.map((a) => ({ pasillo: a.pasillo, objeto: a.objeto, x: 0, y: 0, visible: false, opacidad: 0, marcas: [] }));
  const DISTANCIA_ESCANEO = 7;

  function proyectar() {
    const tramo = tramoEn(recorrido, actual);
    const pasilloCamara = tramo.pasillo;
    const enGiro = tramo.tipo === 'curva';
    anclas.forEach((a, i) => {
      const salida = proyecciones[i];
      const mismo = a.pasillo === pasilloCamara || (enGiro && a.pasillo === pasilloCamara + 1);
      const distancia = a.posicion.distanceTo(camara.position);
      tmp.copy(a.posicion).applyMatrix4(camara.matrixWorldInverse);
      if (!mismo || tmp.z > -0.4 || distancia > DISTANCIA_PUNTOS) {
        salida.visible = false;
        salida.opacidad = 0;
        return;
      }
      tmp.applyMatrix4(camara.projectionMatrix);
      salida.x = (tmp.x * 0.5 + 0.5) * ancho;
      salida.y = (-tmp.y * 0.5 + 0.5) * alto;
      const dentro = salida.x > -40 && salida.x < ancho + 40 && salida.y > -40 && salida.y < alto + 40;
      salida.visible = dentro;
      salida.opacidad = dentro ? 1 - suavizar(DISTANCIA_PUNTOS - 4, DISTANCIA_PUNTOS, distancia) : 0;
      salida.distancia = distancia;
      // marcas de escaneo (cerca): posición en pantalla y distancia en cm a cada punto
      salida.marcas.length = 0;
      if (dentro && distancia < DISTANCIA_ESCANEO) {
        a.marcas ??= puntosDeEscaneo(a);
        for (const m of a.marcas) {
          tmp.copy(m).applyMatrix4(camara.matrixWorldInverse);
          if (tmp.z > -0.1) continue;
          tmp.applyMatrix4(camara.projectionMatrix);
          salida.marcas.push((tmp.x * 0.5 + 0.5) * ancho, (-tmp.y * 0.5 + 0.5) * alto, Math.round(m.distanceTo(camara.position) * 100));
        }
      }
    });
  }

  // Sólo el pasillo actual y sus vecinos se dibujan (y se cargan); las luces van a sus lámparas.
  let ultimaZona = -1;
  const candidatas = [];
  // Precompilado: los shaders del pasillo que viene se compilan de a uno (un material distinto
  // por vez) en los momentos libres del navegador y sólo con la cámara casi quieta, mientras
  // recorrés el actual; así al entrar no se traba y compilar tampoco traba el scroll. Se compila
  // malla por malla (three compila lo visible desde el objeto que recibe, sin mirar al padre).
  const precompilados = new Set();
  const porCompilar = [];
  let ociosa = 0;
  function precompilar(i) {
    const z = zonas[i];
    if (!z || precompilados.has(i) || !renderer.compileAsync) return;
    precompilados.add(i);
    const vistos = new Set();
    for (const g of z.grupos)
      g.traverse((o) => {
        if (!o.isMesh || !o.material || Array.isArray(o.material) || vistos.has(o.material.uuid)) return;
        vistos.add(o.material.uuid);
        porCompilar.push(o);
      });
    pedirOcio();
  }
  function pedirOcio() {
    if (ociosa || !porCompilar.length || destruida) return;
    const pedir = window.requestIdleCallback ?? ((f) => setTimeout(() => f({ timeRemaining: () => 8 }), 120));
    ociosa = pedir(compilarEnOcio, { timeout: 2000 });
  }
  function compilarEnOcio(plazo) {
    ociosa = 0;
    if (destruida) return;
    // con la cámara en movimiento se espera: compilar ahora podría costar un cuadro
    if (velocidad < 0.6) {
      while (porCompilar.length && plazo.timeRemaining() > 6) {
        const malla = porCompilar.shift();
        renderer.compileAsync(malla, camara, escena).catch(() => {});
      }
    }
    pedirOcio();
  }

  function actualizarZonas() {
    const k = tramoEn(recorrido, actual).pasillo;
    if (k !== ultimaZona) {
      ultimaZona = k;
      zonas.forEach((z) => {
        const visible = Math.abs(z.indice - k) <= 1;
        for (const g of z.grupos) g.visible = visible;
        if (Math.abs(z.indice - k) <= 1) cargarZona(z.indice);
      });
      precompilar(k + 2);
      const luz = LUZ[zonas[k]?.trabajo.id] ?? LUZ.laboratorio;
      for (const l of luces) l.color.setHex(luz.color);
      foco.color.setHex(luz.color);
    }
    candidatas.length = 0;
    for (const z of zonas) if (Math.abs(z.indice - k) <= 1) candidatas.push(...z.lamparas);
    candidatas.sort((a, b) => a.distanceToSquared(camara.position) - b.distanceToSquared(camara.position));
    const intensidad = (LUZ[zonas[k]?.trabajo.id] ?? LUZ.laboratorio).intensidad;
    luces.forEach((l, i) => {
      const c = candidatas[i];
      if (c) {
        l.position.copy(c);
        l.intensity = intensidad;
      } else l.intensity = 0;
    });
  }

  // ---- recorrido libre: caminar por los pasillos con teclado / joystick y mirar arrastrando ----
  let libre = false;
  let mezclaLibre = 0;
  const posLibre = new THREE.Vector3();
  let rumbo = 0;
  let cabeceo = 0;
  let caminado = 0;
  const marcha = { adelante: 0, lado: 0, correr: false, empuje: 0 };
  const qLibre = new THREE.Quaternion();
  const eulerLibre = new THREE.Euler(0, 0, 0, 'YXZ');
  const posBase = new THREE.Vector3();
  const qBase = new THREE.Quaternion();
  const MARGEN_PARED = 1.12;

  // ¿Se puede pisar (x, z)? Unión de los pasillos (hasta el centro de sus cruces) y los cruces,
  // achicados para no meterse en las estanterías.
  function caminable(x, z) {
    const W2 = ANCHO / 2 - MARGEN_PARED;
    return recorrido.pasillos.some((p, i) => {
      const dx = x - p.inicio[0];
      const dz = z - p.inicio[1];
      const largo = dx * p.dir[0] + dz * p.dir[1];
      const ancho = dx * p.der[0] + dz * p.der[1];
      const desde = i === 0 ? 0.45 : -ANCHO / 2;
      const hasta = p.cruce ? p.largo + ANCHO / 2 : p.largo - 1.4;
      if (Math.abs(ancho) <= W2 && largo >= desde && largo <= hasta) return true;
      if (!p.cruce) return false;
      const cx = x - p.cruce[0];
      const cz = z - p.cruce[1];
      return Math.abs(cx * p.dir[0] + cz * p.dir[1]) <= W2 && Math.abs(cx * p.der[0] + cz * p.der[1]) <= W2;
    });
  }

  // Punto del camino más cercano a (x, z): da el pasillo actual y adónde volver al salir.
  const muestras = [];
  for (let s = 0; s <= recorrido.largo; s += 0.25) {
    const [x, z] = puntoEn(recorrido, s);
    muestras.push([s, x, z]);
  }
  function sMasCercano(x, z) {
    let mejor = 0;
    let distancia = Infinity;
    for (const [s, mx, mz] of muestras) {
      const d = (mx - x) ** 2 + (mz - z) ** 2;
      if (d < distancia) {
        distancia = d;
        mejor = s;
      }
    }
    return mejor;
  }

  function moverLibre(dt) {
    const velocidad = (marcha.correr ? 3.4 : 1.8) * dt;
    let fx = marcha.adelante + marcha.empuje;
    let fy = marcha.lado;
    marcha.empuje *= Math.exp(-dt * 6);
    const n = Math.hypot(fx, fy);
    if (n > 1) {
      fx /= n;
      fy /= n;
    }
    if (n < 0.001) return;
    const sen = Math.sin(rumbo);
    const cos = Math.cos(rumbo);
    const dx = (-sen * fx + cos * fy) * velocidad;
    const dz = (-cos * fx - sen * fy) * velocidad;
    // se desliza por las paredes: cada eje por separado
    if (caminable(posLibre.x + dx, posLibre.z)) posLibre.x += dx;
    if (caminable(posLibre.x, posLibre.z + dz)) posLibre.z += dz;
    caminado += Math.hypot(dx, dz);
  }

  let luz = 0;
  let velocidad = 0;
  const posPrevia = new THREE.Vector3();
  const posSombra = new THREE.Vector3(Infinity, 0, 0);
  const miradaPiso = new THREE.Vector2(0, -1);
  const qSombra = new THREE.Quaternion();
  let cuadros = 0;
  // Resolución adaptativa: si los cuadros tardan, baja la densidad de píxeles (hasta ~55 %); si
  // sobra margen un buen rato, la vuelve a subir. Mide el tiempo real entre cuadros.
  let promedio = 1 / 60;
  let ventana = 0;
  let holgados = 0;
  function ajustarResolucion(delta) {
    if (!(delta > 0) || delta > 0.25) return;
    promedio += (delta - promedio) * 0.08;
    ventana += delta;
    if (ventana < 1.2) return;
    ventana = 0;
    const ratio = renderer.getPixelRatio();
    let nuevo = ratio;
    if (promedio > 1 / 48) {
      nuevo = Math.max(ratioMin, ratio - 0.15);
      holgados = 0;
    } else if (promedio < 1 / 58) {
      holgados++;
      if (holgados >= 4) {
        nuevo = Math.min(ratioMax, ratio + 0.1);
        holgados = 0;
      }
    } else holgados = 0;
    if (Math.abs(nuevo - ratio) > 0.01) {
      renderer.setPixelRatio(nuevo);
      tamano(ancho, alto);
    }
  }
  let zoom = 0;
  let zoomObjetivo = 0;
  let cuadro = 0;
  let corriendo = false;
  function tic(marca) {
    cuadro = corriendo ? requestAnimationFrame(tic) : 0;
    reloj.update(marca);
    const dt = Math.min(0.05, reloj.getDelta());
    const t = reloj.getElapsed();
    if (libre) {
      moverLibre(dt);
      // el pasillo "actual" (tarjeta, mapa, puntos, carga) sigue a la posición libre
      objetivo = actual = sMasCercano(posLibre.x, posLibre.z);
    }
    // acercamiento exponencial independiente de los fps
    actual += (objetivo - actual) * (1 - Math.exp(-dt * 6));
    if (Math.abs(objetivo - actual) < 0.0005) actual = objetivo;
    mezclaLibre += ((libre ? 1 : 0) - mezclaLibre) * (1 - Math.exp(-dt * 4));
    if (Math.abs(mezclaLibre - (libre ? 1 : 0)) < 0.001) mezclaLibre = libre ? 1 : 0;
    giroMirada += (giroMiradaObjetivo - giroMirada) * (1 - Math.exp(-dt * 4));
    inclinacion += (inclinacionObjetivo - inclinacion) * (1 - Math.exp(-dt * 4));

    mezcla += ((enfocado >= 0 ? 1 : 0) - mezcla) * (1 - Math.exp(-dt * 3.2));
    if (Math.abs(mezcla - (enfocado >= 0 ? 1 : 0)) < 0.001) mezcla = enfocado >= 0 ? 1 : 0;

    mirarDesde(actual);
    ojo.position.copy(posicion);
    ojo.lookAt(mira);
    ojo.rotateY(giroMirada * (1 - mezcla) * (1 - mezclaLibre));
    ojo.rotateX(inclinacion * (1 - mezcla) * (1 - mezclaLibre));
    qCaminar.copy(ojo.quaternion);
    if (mezclaLibre > 0) {
      // recorrido libre: posición y mirada propias (con balanceo al caminar)
      eulerLibre.set(cabeceo, rumbo, 0);
      qLibre.setFromEuler(eulerLibre);
      const e = mezclaLibre * mezclaLibre * (3 - 2 * mezclaLibre);
      posBase.copy(posLibre).setY(ALTURA_OJOS + Math.sin(caminado * 5.2) * 0.022);
      posicion.lerp(posBase, e);
      qCaminar.slerp(qLibre, e);
    }
    if (mezcla > 0) {
      if (enfocado >= 0) {
        // el destino se recuerda para poder volver desde ahí
        ojo.position.copy(posFoco);
        ojo.lookAt(miraFoco);
        ultimaPos.copy(posFoco);
        ultimaQ.copy(ojo.quaternion);
      }
      qFoco.copy(ultimaQ);
      const e = mezcla * mezcla * (3 - 2 * mezcla);
      camara.position.lerpVectors(posicion, ultimaPos, e);
      camara.quaternion.slerpQuaternions(qCaminar, qFoco, e);
    } else {
      camara.position.copy(posicion);
      camara.quaternion.copy(qCaminar);
    }
    camara.updateMatrixWorld();
    // velocidad real de la cámara (para los efectos)
    const recorrido_ = camara.position.distanceTo(posPrevia);
    posPrevia.copy(camara.position);
    velocidad += (Math.min(8, recorrido_ / Math.max(dt, 0.001)) - velocidad) * Math.min(1, dt * 6);

    // el foco con sombras va un poco adelante y arriba, apuntando adonde se mira
    adelante.set(0, 0, -1).applyQuaternion(camara.quaternion).setY(0).normalize();
    foco.position.copy(camara.position).addScaledVector(adelante, 0.6).setY(ALTO - 0.15);
    foco.target.position.copy(camara.position).addScaledVector(adelante, 3.2).setY(0.6);
    foco.target.updateMatrixWorld();

    // la puerta se abre al llegar; la luz crece al cruzarla
    const sPuerta = recorrido.largo - DESPUES_DE_LA_PUERTA;
    const abrir = suavizar(sPuerta - 4.6, sPuerta - 1.3, actual);
    puerta?.abrir(abrir, t);
    luz = suavizar(sPuerta - 0.9, recorrido.largo - 0.15, actual);
    // zoom (botón derecho): se acerca el campo visual
    zoom += (zoomObjetivo - zoom) * (1 - Math.exp(-dt * 7));
    const fovBase = ancho < 760 ? 78 : 66;
    const fov = fovBase / (1 + zoom * 1.6);
    if (Math.abs(camara.fov - fov) > 0.01) {
      camara.fov = fov;
      camara.updateProjectionMatrix();
    }

    actualizarZonas();
    const tramoObra = tramoEn(recorrido, actual);
    adelante.set(0, 0, -1).applyQuaternion(camara.quaternion);
    miradaPiso.set(adelante.x, adelante.z).normalize();
    construccion.cuadro({ t, s: actual, hasta: tramoObra.pasillo + (tramoObra.tipo === 'curva' ? 1 : 0), libre: mezclaLibre > 0.5, mirada: miradaPiso });
    cielo.cuadro(t);
    procesarCola();
    for (const animar of animables) animar(t);
    // sombras: sólo si la cámara se movió o giró, o cada 8 cuadros
    cuadros++;
    if (camara.position.distanceToSquared(posSombra) > 1e-6 || 1 - Math.abs(camara.quaternion.dot(qSombra)) > 1e-7 || cuadros % 8 === 0) {
      renderer.shadowMap.needsUpdate = true;
      posSombra.copy(camara.position);
      qSombra.copy(camara.quaternion);
    }
    if (composer && !rendimiento) composer.render(dt);
    else renderer.render(escena, camara);
    ajustarResolucion(reloj.getDelta());
    proyectar();
    efectos.cuadro({ dt, velocidad });
    adelante.set(0, 0, -1).applyQuaternion(camara.quaternion);
    alCuadro?.({
      proyecciones,
      s: actual,
      pasillo: pasilloEn(recorrido, actual),
      mezcla,
      foco: enfocado,
      luz,
      // para el minimapa: dónde está la cámara y hacia dónde mira (en el piso)
      camara: { x: camara.position.x, z: camara.position.z, dx: adelante.x, dz: adelante.z },
    });
  }

  function arrancar() {
    if (corriendo) return;
    corriendo = true;
    reloj.reset();
    cuadro = requestAnimationFrame(tic);
  }
  function frenar() {
    corriendo = false;
    cancelAnimationFrame(cuadro);
    cuadro = 0;
  }

  const alPerderContexto = (e) => {
    e.preventDefault();
    frenar();
    alPerder?.();
  };
  lienzo.addEventListener('webglcontextlost', alPerderContexto);

  return {
    irA(s, inmediato = false) {
      if (libre) return;
      objetivo = Math.min(recorrido.largo, Math.max(0, s));
      if (inmediato) actual = objetivo;
      if (enfocado < 0) return;
      // la página todavía se está acomodando al objeto que se acaba de tocar (scroll suave en curso,
      // el ajuste de la sección): eso no es "seguir caminando", el foco se queda
      if (performance.now() < acomodando) sFoco = objetivo;
      else if (Math.abs(objetivo - sFoco) > SOLTAR_FOCO) soltar(true);
    },
    enfocar,
    soltar: () => soltar(false),
    objetoEn,
    // recorrido libre
    entrarLibre() {
      if (libre) return;
      soltar(false);
      libre = true;
      posLibre.copy(camara.position).setY(ALTURA_OJOS);
      if (!caminable(posLibre.x, posLibre.z)) {
        const [x, z] = puntoEn(recorrido, actual);
        posLibre.set(x, ALTURA_OJOS, z);
      }
      adelante.set(0, 0, -1).applyQuaternion(camara.quaternion);
      rumbo = Math.atan2(-adelante.x, -adelante.z);
      cabeceo = 0;
    },
    // vuelve al camino del scroll; devuelve la distancia `s` del punto más cercano
    salirLibre() {
      if (!libre) return actual;
      libre = false;
      marcha.adelante = marcha.lado = marcha.empuje = 0;
      return actual;
    },
    caminar({ adelante: a = 0, lado = 0, correr = false }) {
      marcha.adelante = a;
      marcha.lado = lado;
      marcha.correr = correr;
    },
    // empujón hacia adelante/atrás (rueda del mouse)
    empujar(cantidad) {
      marcha.empuje = Math.max(-3, Math.min(3, marcha.empuje + cantidad));
    },
    // resalta (contorno) el objeto interactivo `i`, o ninguno con -1
    resaltar(i) {
      if (!contorno) return;
      if (i < 0 || !anclas[i]) {
        contorno.selection.clear();
        return;
      }
      const mallas = [];
      anclas[i].grupo.traverse((o) => {
        if (o.isMesh && o.visible) mallas.push(o);
      });
      contorno.selection.set(mallas);
      contorno.visibleEdgeColor.set(zonas[anclas[i].pasillo]?.trabajo.acento ?? '#ffffff');
    },
    // objeto con tooltip en el centro de la mira (recorrido libre), o -1
    objetoCentro: () => objetoEn(ancho / 2, alto / 2),
    // zoom con el botón derecho (true mientras se mantiene)
    acercar(activo) {
      zoomObjetivo = activo ? 1 : 0;
    },
    girarMirada(dx, dy) {
      rumbo -= dx;
      cabeceo = Math.max(-1.2, Math.min(1.2, cabeceo - dy));
    },
    // mirada con el puntero: x, y en [-1, 1]
    mirar(x, y) {
      giroMiradaObjetivo = -x * 0.22;
      inclinacionObjetivo = -y * 0.1;
    },
    fijarTema,
    fijarRendimiento,
    tamano,
    arrancar,
    frenar,
    destruir() {
      destruida = true;
      clearTimeout(precarga);
      frenar();
      lienzo.removeEventListener('webglcontextlost', alPerderContexto);
      const compartidos = new Set();
      recursos.destruir();
      escena.traverse((o) => {
        // los modelos reales comparten geometría y materiales: los libera recursos.destruir()
        if (o.userData.id) o.traverse((h) => compartidos.add(h));
      });
      escena.traverse((o) => {
        if (compartidos.has(o)) return;
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const lista = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of lista) {
            m.map?.dispose();
            m.dispose();
          }
        }
      });
      for (const z of zonas) z.materiales.atlas.dispose();
      entorno.dispose();
      efectos.destruir();
      composer?.dispose();
      liberarModelos();
      renderer.dispose();
    },
  };
}

function redondear(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// Texto en varias líneas dentro de un ancho.
function envolver(ctx, texto, x, y, ancho, interlineado) {
  const palabras = texto.split(' ');
  let linea = '';
  let fila = 0;
  for (const p of palabras) {
    const prueba = linea ? `${linea} ${p}` : p;
    if (ctx.measureText(prueba).width > ancho && linea) {
      ctx.fillText(linea, x, y + fila * interlineado);
      linea = p;
      fila++;
    } else linea = prueba;
  }
  ctx.fillText(linea, x, y + fila * interlineado);
}
