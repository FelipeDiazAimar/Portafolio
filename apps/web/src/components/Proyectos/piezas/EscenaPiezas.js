// Entrada de Proyectos, en tres tiempos:
//   1. un montón de conectores en cruz (tres caños perpendiculares, con un agujero en cada punta)
//      que flotan y se chocan alrededor del título; el cursor los empuja;
//   2. cada conector se vuelve una tarjeta 3D, gruesa, con la cara de su proyecto, que sigue
//      flotando;
//   3. cada tarjeta vuela a su lugar de la marquesina y se aplana hasta ser la tarjeta plana.
//
// No usa React: la crea y la destruye Proyectos.jsx. Todo `three` vive en este chunk. El mundo se
// mide en píxeles del panel (x a la derecha, y hacia arriba = −y de pantalla, z hacia quien mira):
// así el lugar de una tarjeta en pantalla es directamente su lugar en la escena.
//
// La física es propia y chica (unas decenas de cuerpos): cada pieza es una esfera para los
// choques, un resorte la lleva al centro, el cursor las empuja y el título tiene su zona libre.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { densidadPixeles } from '@/lib/rendimiento.js';

const FOV = 24;
const GROSOR_TARJETA = 4;
const MAX_PIEZAS = 34;
const ADORNOS = 7;
// cuánta luz propia tiene la cara de una tarjeta 3D mientras flota (colores más vivos)
const LUZ_PROPIA = 1;
// ... y cuánto le suma la luz de la escena (apenas: da volumen sin cambiarle el color)
const LUZ_ESCENA = 0;
const PROPORCION = 293 / 406; // alto / ancho de una tarjeta de la marquesina
const limitar = (x, a, b) => Math.min(b, Math.max(a, x));
const azar = (a, b) => a + Math.random() * (b - a);
const suaveP = (x) => x * x * (3 - 2 * x);
const expoIO = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2);
const rebote = (x) => {
  // llega pasándose un poco y vuelve (back.out)
  const c = 1.9;
  const v = limitar(x, 0, 1) - 1;
  return 1 + (c + 1) * v * v * v + c * v * v;
};

// Los colores chillones por los que pasa el tercer tono de los conectores (los otros dos son
// siempre negro y blanco).
const ACENTOS = ['#1524ff', '#8f14ff', '#a8e400', '#ff1020', '#ffd500', '#ff5a00', '#00d5c0'];

// Un conector en cruz de radio 1 (de punta a punta mide 2): tres caños iguales, uno por eje. Cada
// caño es un perfil torneado: el canto biselado y, en cada punta, un agujero ciego.
function geometriaConector() {
  const R = 0.43; // radio del caño
  const L = 1; // medio largo
  const B = 0.07; // bisel
  const A = 0.15; // radio del agujero
  const F = 0.36; // fondo del agujero
  const perfil = [
    [0.001, -L + F],
    [A, -L + F],
    [A, -L + 0.012],
    [A + 0.03, -L],
    [R - B, -L],
    [R, -L + B],
    [R, L - B],
    [R - B, L],
    [A + 0.03, L],
    [A, L - 0.012],
    [A, L - F],
    [0.001, L - F],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const cano = new THREE.LatheGeometry(perfil, 44);
  const enX = cano.clone().rotateZ(Math.PI / 2);
  const enZ = cano.clone().rotateX(Math.PI / 2);
  const cruz = mergeGeometries([cano, enX, enZ]);
  cano.dispose();
  enX.dispose();
  enZ.dispose();
  return cruz;
}

// La cara de una tarjeta, pintada en un canvas con lo mismo que muestra la tarjeta de verdad: su
// fondo y su logo o, si no tiene, el nombre del proyecto y su bajada.
// `viva`: la versión de cuando flota en 3D, con el fondo mucho más cargado del color del proyecto.
function pintarCara(info, fuente, viva = false) {
  const lienzo = document.createElement('canvas');
  lienzo.width = 640;
  lienzo.height = Math.round(640 * PROPORCION);
  const ctx = lienzo.getContext('2d');
  const W = lienzo.width;
  const H = lienzo.height;
  const dibujar = (logo) => {
    ctx.fillStyle = viva && !info.logo ? info.viva : info.tarjeta;
    ctx.fillRect(0, 0, W, H);
    if (!info.logo) {
      // sin logo: degradé del color del proyecto, como TarjetaMarca
      const sombra = ctx.createLinearGradient(0, 0, W * 0.4, H);
      sombra.addColorStop(0, 'rgba(0,0,0,0)');
      sombra.addColorStop(1, viva ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.28)');
      ctx.fillStyle = sombra;
      ctx.fillRect(0, 0, W, H);
      const luz = ctx.createRadialGradient(W * 0.85, H * 0.1, 0, W * 0.85, H * 0.1, W * 0.75);
      luz.addColorStop(0, `${info.color}66`);
      luz.addColorStop(1, `${info.color}00`);
      ctx.fillStyle = luz;
      ctx.fillRect(0, 0, W, H);
    }
    const tinta = info.claro ? '#14161c' : '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let yTexto = H / 2;
    if (logo) {
      const conNombre = Boolean(info.nombre);
      const cajaW = W * (conNombre ? 0.3 : 0.62);
      const cajaH = H * (conNombre ? 0.34 : 0.5);
      const k = Math.min(cajaW / logo.naturalWidth, cajaH / logo.naturalHeight);
      const w = logo.naturalWidth * k;
      const h = logo.naturalHeight * k;
      const y = conNombre ? H * 0.36 - h / 2 : (H - h) / 2;
      ctx.drawImage(logo, (W - w) / 2, y, w, h);
      yTexto = H * 0.68;
    }
    if (info.nombre) {
      let tam = logo ? 46 : 74;
      ctx.font = `800 ${tam}px ${fuente}`;
      const ancho = ctx.measureText(info.nombre).width;
      if (ancho > W * 0.82) {
        tam *= (W * 0.82) / ancho;
        ctx.font = `800 ${tam}px ${fuente}`;
      }
      ctx.fillStyle = tinta;
      ctx.fillText(info.nombre, W / 2, yTexto - (info.bajada ? tam * 0.2 : 0));
      if (info.bajada) {
        ctx.font = `600 ${Math.max(15, tam * 0.27)}px ${fuente}`;
        ctx.fillStyle = info.claro ? '#14161ccc' : info.logo || viva ? '#ffffffd0' : info.color;
        try {
          ctx.letterSpacing = '3px';
        } catch {
          /* navegador sin letterSpacing en canvas */
        }
        ctx.fillText(info.bajada.toUpperCase(), W / 2, yTexto + tam * 0.62);
        try {
          ctx.letterSpacing = '0px';
        } catch {
          /* idem */
        }
      }
    }
  };
  dibujar(null);
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 4;
  if (info.logo) {
    const logo = new Image();
    logo.onload = () => {
      dibujar(logo);
      textura.needsUpdate = true;
    };
    logo.src = info.logo;
  }
  return textura;
}

// La orientación (cuaternión) y el tamaño de una tarjeta a partir de cómo se la ve en pantalla:
// su centro y sus dos lados como vectores de pantalla (u: hacia su derecha, v: hacia su abajo).
// Dos lados que en el espacio son perpendiculares y guardan la proporción ancho/alto: de ahí
// sale cuánto se hunde cada uno en z.
const base = new THREE.Matrix4();
const ejeX = new THREE.Vector3();
const ejeY = new THREE.Vector3();
const ejeZ = new THREE.Vector3();
function poseDeTarjeta(objetivo, salida) {
  const ux = objetivo.u[0];
  const uy = -objetivo.u[1];
  const vx = objetivo.v[0];
  const vy = -objetivo.v[1];
  const A = ux * ux + uy * uy;
  const B = vx * vx + vy * vy;
  const a2 = (objetivo.ancho / objetivo.alto) ** 2;
  const p = -(ux * vx + uy * vy);
  const k = A - a2 * B;
  // Hay dos soluciones, espejadas en z. La de la grilla es un piso visto desde arriba: lo que en
  // pantalla baja está más cerca de quien mira. El lado u sube (se aleja) o baja (se acerca).
  const hondo = Math.sqrt(Math.max(0, (-k + Math.sqrt(k * k + 4 * a2 * p * p)) / 2));
  const uz = objetivo.u[1] > 0 ? hondo : -hondo;
  const vz = Math.abs(uz) > 1e-4 ? p / uz : Math.sqrt(Math.max(0, A / a2 - B));
  ejeX.set(ux, uy, uz);
  const largoU = ejeX.length();
  ejeX.normalize();
  // el "arriba" de la tarjeta es el opuesto de su lado que baja
  ejeY.set(-vx, -vy, -vz).normalize();
  ejeZ.crossVectors(ejeX, ejeY);
  base.makeBasis(ejeX, ejeY, ejeZ);
  salida.cuaternion.setFromRotationMatrix(base);
  salida.posicion.set(objetivo.x, -objetivo.y, 0);
  const escala = largoU / objetivo.ancho;
  salida.ancho = objetivo.ancho * escala;
  salida.alto = objetivo.alto * escala;
  return salida;
}

// `inversa`: la misma entrada, de atrás para adelante (al irse de Proyectos hacia "Sobre mí"): las
// piezas nacen como tarjetas planas, cada una sobre la suya de la marquesina; se levantan y pasan
// a flotar como tarjetas 3D (`desarmar`) y después se vuelven conectores (`desmutar`).
function escenaBase(entorno) {
  const escena = new THREE.Scene();
  escena.environment = entorno.texture;
  const sol = new THREE.DirectionalLight(0xffffff, 1.15);
  sol.position.set(-0.45, 0.9, 1);
  escena.add(sol);
  return escena;
}

// Compila de antemano (en un momento libre) los materiales de las piezas: los mismos tipos y
// opciones que usa la escena (tarjetas con su imagen, con y sin barniz; conectores brillantes y
// mate). Se hace en un lienzo propio que se descarta enseguida: dejar vivo el contexto del lienzo
// de la entrada trababa otras secciones, y el navegador igual guarda los programas compilados
// (la compilación de verdad, al llegar, sale de ese caché).
export async function precalentarPiezas() {
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = 2;
  const renderizador = new THREE.WebGLRenderer({ canvas: lienzo, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderizador.outputColorSpace = THREE.SRGBColorSpace;
  renderizador.toneMapping = THREE.NoToneMapping;
  const pmrem = new THREE.PMREMGenerator(renderizador);
  const entorno = pmrem.fromScene(new RoomEnvironment(), 0.04);
  const escena = escenaBase(entorno);
  const caja = new THREE.BoxGeometry(1, 1, 1);
  const imagen = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  imagen.colorSpace = THREE.SRGBColorSpace;
  imagen.needsUpdate = true;
  const materiales = [];
  for (const barniz of [{ clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0 }, { clearcoat: 0, envMapIntensity: 0 }]) {
    materiales.push(new THREE.MeshPhysicalMaterial({ map: imagen, emissiveMap: imagen, emissive: 0xffffff, emissiveIntensity: LUZ_PROPIA, color: new THREE.Color().setScalar(LUZ_ESCENA), roughness: 1, metalness: 0, ...barniz }));
    materiales.push(new THREE.MeshPhysicalMaterial({ color: 0x000000, emissive: 0x3366ff, roughness: 1, metalness: 0, ...barniz }));
  }
  for (const brillante of [true, false]) {
    materiales.push(new THREE.MeshPhysicalMaterial({ color: 0x3366ff, roughness: brillante ? 0.1 : 0.6, metalness: 0, clearcoat: brillante ? 1 : 0, clearcoatRoughness: 0.06, envMapIntensity: brillante ? 0.75 : 0.18 }));
  }
  materiales.forEach((m) => escena.add(new THREE.Mesh(caja, m)));
  const camara = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camara.position.set(0, 0, 5);
  try {
    await renderizador.compileAsync(escena, camara);
  } catch {
    renderizador.compile(escena, camara);
  }
  renderizador.render(escena, camara);
  caja.dispose();
  imagen.dispose();
  materiales.forEach((m) => m.dispose());
  entorno.dispose();
  pmrem.dispose();
  renderizador.dispose();
  renderizador.forceContextLoss();
}

// `puente`: el modo atado al scroll (glow-up). Nada corre por tiempo: Proyectos llama a
// `ponerProgreso(etapa, t)` con lo que marca el scroll y la escena se arma o se desarma:
//   'portadas'  (t 0→1) las portadas de "Sobre mí" (calcadas sobre las del reel) se rompen en conectores
//   'flotar'    los conectores flotan y chocan (física; el cursor los empuja)
//   'mutar'     (t 0→1) cada conector se vuelve la tarjeta 3D de su proyecto
//   'convertir' (t 0→1) cada tarjeta vuela a su lugar de la marquesina y se aplana
// `puente.portadas`: [{ imagen (canvas), quad: [[x,y] × 4] (px del lienzo: arribaIzq, arribaDer,
// abajoDer, abajoIzq), opacidad }].
export function crearEscenaPiezas({ lienzo, panel, objetivos, infoDe, claro = false, recuadro = null, alFallar = null, inversa = false, puente = null }) {
  const renderizador = new THREE.WebGLRenderer({ canvas: lienzo, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderizador.setClearColor(0x000000, 0);
  renderizador.outputColorSpace = THREE.SRGBColorSpace;
  // sin mapeo de tonos: el azul queda azul y las caras de las tarjetas, del color de las de verdad
  renderizador.toneMapping = THREE.NoToneMapping;
  const pmrem = new THREE.PMREMGenerator(renderizador);
  const entorno = pmrem.fromScene(new RoomEnvironment(), 0.04);
  const escena = escenaBase(entorno);
  const camara = new THREE.PerspectiveCamera(FOV, 1, 10, 20000);

  let W = Math.max(2, panel.clientWidth);
  let H = Math.max(2, panel.clientHeight);
  function redimensionar() {
    W = Math.max(2, panel.clientWidth);
    H = Math.max(2, panel.clientHeight);
    renderizador.setPixelRatio(densidadPixeles(2));
    renderizador.setSize(W, H, false);
    camara.aspect = W / H;
    // a esta distancia, el plano z = 0 mide exactamente lo que el panel en píxeles
    const distancia = H / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    camara.position.set(W / 2, -H / 2, distancia);
    camara.lookAt(W / 2, -H / 2, 0);
    camara.near = distancia * 0.2;
    camara.far = distancia * 3;
    camara.updateProjectionMatrix();
  }
  redimensionar();

  // ---- piezas -------------------------------------------------------------------------------
  // Una por tarjeta a la vista (las más cercanas al centro, hasta el tope) y unos conectores de
  // más, que no llegan a ser tarjeta.
  // El recuadro donde viven los conectores (px del panel): se amontonan en su centro y entran
  // por sus bordes (el canvas se recorta a él, ver Proyectos.module.css).
  const marco = () => recuadro?.() ?? { x: 0, y: 0, w: W, h: H };
  const centro = () => {
    const m = marco();
    return [m.x + m.w / 2, m.y + m.h / 2];
  };
  const iniciales = objetivos()
    .map((o) => ({ ...o, d: Math.hypot(o.x - W / 2, o.y - H / 2) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, MAX_PIEZAS);
  const total = iniciales.length + ADORNOS;
  // radio de choque: que el montón ocupe una bola de ~la mitad del alto del panel
  const marco0 = marco();
  // en el puente son más chicos: flotan por toda la pantalla, no dentro de un recuadro
  const radio = puente ? limitar(Math.min(marco0.w, marco0.h) * 0.5 * Math.cbrt(0.5 / Math.max(8, total)), 34, 110) : limitar(Math.min(marco0.w, marco0.h) * 0.66 * Math.cbrt(0.5 / Math.max(8, total)), 46, 150);
  // así está inclinada la grilla de la marquesina: las tarjetas 3D flotan ya con esa inclinación
  const grilla = new THREE.Quaternion();
  if (iniciales[0]) grilla.copy(poseDeTarjeta(iniciales[0], { posicion: new THREE.Vector3(), cuaternion: new THREE.Quaternion() }).cuaternion);
  const fuente = getComputedStyle(panel).fontFamily || 'sans-serif';
  const desechables = [];
  const guardar = (cosa) => {
    desechables.push(cosa);
    return cosa;
  };
  const cruz = guardar(geometriaConector());
  const caja = guardar(new RoundedBoxGeometry(1, PROPORCION, 0.15, 5, 0.045));
  // Los conectores van siempre en negro, blanco y un color chillón; cada clic sobre el recuadro
  // pasa al color siguiente. De cada tono hay uno brillante y uno mate.
  const material = (color, brillante) => guardar(new THREE.MeshPhysicalMaterial({ color, roughness: brillante ? 0.1 : 0.6, metalness: 0, clearcoat: brillante ? 1 : 0, clearcoatRoughness: 0.06, envMapIntensity: brillante ? 0.75 : 0.18 }));
  let acento = Math.floor(Math.random() * ACENTOS.length);
  const colorAcento = new THREE.Color(ACENTOS[acento]);
  const deAcento = [material(ACENTOS[acento], false), material(ACENTOS[acento], true)];
  const materialesConector = [deAcento[0], material('#08080a', true), material('#f4f4f6', false), deAcento[1], material('#08080a', false), material('#f4f4f6', true)];
  const caras = new Map();
  const cantos = new Map();
  // `plastificada`: con una capa de barniz encima, como los conectores brillantes. El barniz sólo
  // suma el destello de la luz principal (sin reflejo del entorno, que la velaba de blanco): el
  // color de la tarjeta sigue siendo el suyo (su luz es propia).
  const materialesDe = (clave, plastificada = false) => {
    const info = { tarjeta: '#12151c', color: '#8a909c', nombre: clave, ...(infoDe(clave) ?? {}) };
    if (!caras.has(clave)) {
      // el canto, del color de la tarjeta, apenas más claro (o más oscuro si la tarjeta es clara)
      let canto = '#1a1d26';
      try {
        const base = new THREE.Color(info.tarjeta);
        canto = base.multiplyScalar(info.claro ? 0.78 : 0.7).getStyle();
      } catch {
        /* queda el oscuro */
      }
      caras.set(clave, guardar(pintarCara(info, fuente)));
      // el canto tampoco recibe luz: un tono fijo de la tarjeta
      cantos.set(clave, canto);
    }
    // La cara es propia de cada pieza y es la de la tarjeta de verdad: casi toda su luz es propia
    // (así tiene el mismo color que en la marquesina) y la escena le suma apenas un poco de
    // volumen. Al aplanarse deja de depender de la luz del todo (ver convertirCuadro).
    const real = caras.get(clave);
    const barniz = plastificada ? { clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0 } : { clearcoat: 0, envMapIntensity: 0 };
    const cara = guardar(new THREE.MeshPhysicalMaterial({ map: real, emissiveMap: real, emissive: 0xffffff, emissiveIntensity: LUZ_PROPIA, color: new THREE.Color().setScalar(LUZ_ESCENA), roughness: 1, metalness: 0, ...barniz }));
    const canto = guardar(new THREE.MeshPhysicalMaterial({ color: 0x000000, emissive: cantos.get(clave), roughness: 1, metalness: 0, ...barniz }));
    // caras de la caja: +x, −x, +y, −y, +z (frente), −z (dorso)
    return { cara, canto, lista: [canto, canto, canto, canto, cara, cara] };
  };

  const piezas = [];
  const nacer = (r, extra) => {
    // llegan desde afuera de la pantalla, por todos lados, y se amontonan
    const angulo = Math.random() * Math.PI * 2;
    const lejos = Math.hypot(marco0.w, marco0.h) * azar(0.6, 0.9);
    const [cx, cy] = centro();
    const grupo = new THREE.Group();
    grupo.quaternion.setFromEuler(new THREE.Euler(azar(0, 6.28), azar(0, 6.28), azar(0, 6.28)));
    const conector = new THREE.Mesh(cruz, materialesConector[piezas.length % materialesConector.length]);
    conector.scale.setScalar(r * 0.98);
    conector.frustumCulled = false;
    grupo.add(conector);
    escena.add(grupo);
    const pieza = {
      malla: grupo,
      conector,
      tarjeta: null,
      r,
      r0: r,
      p: new THREE.Vector3(cx + Math.cos(angulo) * lejos, cy + Math.sin(angulo) * lejos, azar(-240, 240)),
      v: new THREE.Vector3(-Math.cos(angulo) * azar(500, 900), -Math.sin(angulo) * azar(500, 900), 0),
      giro: new THREE.Vector3(azar(-1.6, 1.6), azar(-1.6, 1.6), azar(-1.6, 1.6)),
      // ya tarjeta 3D, queda inclinada como la grilla de la marquesina (apenas distinta cada una)
      frente: new THREE.Quaternion().setFromEuler(new THREE.Euler(azar(-0.16, 0.16), azar(-0.16, 0.16), azar(-0.12, 0.12))).premultiply(grilla),
      demora: Math.random() * 0.55,
      ...extra,
    };
    piezas.push(pieza);
    return pieza;
  };
  iniciales.forEach((objetivo) => {
    const r = radio * azar(0.88, 1.12);
    const pieza = nacer(r, { clave: objetivo.clave, adorno: false });
    // la tarjeta entera (su diagonal) cabe dentro de la esfera de choque
    const ancho = r * 1.56;
    // una de cada dos va plastificada
    const { cara, canto, lista } = materialesDe(objetivo.clave, piezas.length % 2 === 1);
    const tarjeta = new THREE.Mesh(caja, lista);
    tarjeta.scale.setScalar(0);
    tarjeta.visible = false;
    tarjeta.frustumCulled = false;
    pieza.malla.add(tarjeta);
    pieza.tarjeta = tarjeta;
    pieza.cara = cara;
    pieza.canto = canto;
    pieza.barniz = cara.clearcoat;
    // medidas de la tarjeta 3D a escala 1 (la caja mide 1 × PROPORCION × 0,15)
    pieza.medida = [ancho, ancho * PROPORCION, ancho * 0.15];
    pieza.objetivo = objetivo;
  });
  for (let i = 0; i < ADORNOS; i++) nacer(radio * azar(0.55, 0.85), { adorno: true, clave: null });
  // la demora de la mutación (la conversión la pisa con la suya)
  for (const a of piezas) a.demoraMut = a.demora;

  // ---- puente: de las portadas de "Sobre mí" a los conectores (atado al scroll) ---------------
  const portadas3d = [];
  // Calca las portadas (se puede repetir: al volver desde abajo, la escena nació sin ellas). Cada
  // una es una grilla con los puntos exactos de la portada curva en pantalla (z = 0 mide 1:1 en
  // px), así al empezar se ve idéntica a la del reel; después se mueve entera como un cuerpo.
  function armarPortadas(lista) {
    for (const p of portadas3d.splice(0)) {
      escena.remove(p.malla);
      p.malla.geometry.dispose();
      p.material.map?.dispose();
      p.material.dispose();
    }
    (lista ?? []).forEach((p, k) => {
      const n = p.grilla;
      const lado = n + 1;
      let cx = 0;
      let cy = 0;
      p.puntos.forEach(([x, y]) => {
        cx += x;
        cy += y;
      });
      cx /= p.puntos.length;
      cy /= p.puntos.length;
      const posiciones = new Float32Array(lado * lado * 3);
      const uvs = new Float32Array(lado * lado * 2);
      p.puntos.forEach(([x, y], i) => {
        posiciones[i * 3] = x - cx;
        posiciones[i * 3 + 1] = -(y - cy);
        uvs[i * 2] = (i % lado) / n;
        uvs[i * 2 + 1] = 1 - Math.floor(i / lado) / n;
      });
      const indices = [];
      for (let f = 0; f < n; f += 1) {
        for (let c = 0; c < n; c += 1) {
          const a = f * lado + c;
          indices.push(a, a + lado, a + 1, a + 1, a + lado, a + lado + 1);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      const textura = new THREE.CanvasTexture(p.imagen);
      textura.colorSpace = THREE.SRGBColorSpace;
      textura.anisotropy = 4;
      const material = new THREE.MeshBasicMaterial({ map: textura, transparent: true, opacity: p.opacidad ?? 1, side: THREE.DoubleSide, depthWrite: false });
      // la niebla del reel (las de los costados se ven apagadas)
      if (p.niebla) material.color.lerp(new THREE.Color(claro ? '#f5f6f8' : '#0b0d12'), p.niebla);
      const malla = new THREE.Mesh(geo, material);
      malla.frustumCulled = false;
      malla.renderOrder = -10 + k;
      malla.position.set(cx, -cy, 0);
      escena.add(malla);
      portadas3d.push({
        malla,
        material,
        opacidad: p.opacidad ?? 1,
        puntos: p.puntos,
        lado,
        c: [cx, cy],
        // tamaño aproximado (diagonal), para repartir los conectores
        tam: Math.hypot(p.puntos[lado * lado - 1][0] - p.puntos[0][0], p.puntos[lado * lado - 1][1] - p.puntos[0][1]),
        eje: new THREE.Vector3(azar(-1, 1), azar(-1, 1), azar(-0.4, 0.4)).normalize(),
        demora: (lista.length - 1 - k) * 0.05,
      });
    });
    // Cada conector nace de un punto de una portada (las más grandes dan más)
    const pesos = portadas3d.map((p) => p.tam * p.opacidad);
    const totalPeso = pesos.reduce((suma, x) => suma + x, 0) || 1;
    piezas.forEach((a, i) => {
      let r = ((i * 0.6180339) % 1) * totalPeso;
      let k = 0;
      while (k < pesos.length - 1 && r > pesos[k]) {
        r -= pesos[k];
        k += 1;
      }
      const p = portadas3d[k];
      a.origen = p ? { k, i: (1 + Math.floor(azar(0, p.lado - 2))) * p.lado + 1 + Math.floor(azar(0, p.lado - 2)) } : null;
    });
  }
  if (puente) {
    // ... y va a su lugar en el montón. Al volver a esta etapa desde la física, el "lugar" pasa a
    // ser donde estaba.
    const m = marco();
    piezas.forEach((a) => {
      a.casa = new THREE.Vector3(m.x + m.w * azar(0.14, 0.86), m.y + m.h * azar(0.2, 0.8), azar(-160, 160));
      a.qBase = a.malla.quaternion.clone();
      a.qCasa = a.qBase.clone().premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(azar(-1, 1), azar(-1, 1), azar(-1, 1)).normalize(), azar(2, 4)));
      a.demoraPuente = azar(0, 0.35);
      a.conector.scale.setScalar(0.0001);
      a.p.copy(a.casa);
      a.v.set(0, 0, 0);
    });
    armarPortadas(puente.portadas);
  }
  const punto = new THREE.Vector3();
  const salidaCubica = (x) => 1 - Math.pow(1 - limitar(x, 0, 1), 3);
  // Las portadas se rompen y de cada una salen sus conectores. `t`: 0 = portadas enteras, 1 = sólo conectores.
  function portadasCuadro(t) {
    for (const p of portadas3d) {
      const e = suaveP(limitar((t - p.demora) / 0.55, 0, 1));
      p.malla.visible = e < 0.999;
      if (!p.malla.visible) continue;
      p.malla.position.set(p.c[0], -p.c[1], e * 260);
      p.malla.quaternion.setFromAxisAngle(p.eje, e * 1.4);
      p.malla.scale.setScalar(Math.max(0.0001, 1 - e * e));
      p.material.opacity = p.opacidad * (1 - suaveP(limitar((e - 0.5) / 0.5, 0, 1)));
    }
    for (const a of piezas) {
      const ei = limitar((t - 0.12 - a.demoraPuente * 0.5) / 0.6, 0, 1);
      const e = salidaCubica(ei);
      if (a.origen && portadas3d[a.origen.k]) {
        const p = portadas3d[a.origen.k];
        const [sx, sy] = p.puntos[a.origen.i];
        punto.set(sx, sy, 0).lerp(a.casa, e);
      } else {
        punto.copy(a.casa);
      }
      a.p.copy(punto);
      a.p.z += Math.sin(Math.PI * e) * 180;
      a.v.set(0, 0, 0);
      a.malla.position.set(a.p.x, -a.p.y, a.p.z);
      a.malla.quaternion.slerpQuaternions(a.qBase, a.qCasa, e);
      a.conector.scale.setScalar(Math.max(0.0001, a.r0 * 0.98 * rebote(ei)));
      if (a.adorno) a.r = Math.max(0.01, a.r0 * e);
    }
  }

  // ---- al revés: de tarjeta plana a tarjeta 3D, y de tarjeta 3D a conector -------------------
  let reversa = inversa ? { fase: 'plana', t0: null, resolver: null } : null;
  if (inversa) {
    const m = marco0;
    const lejos = Math.hypot(W, H) / 2;
    for (const a of piezas) {
      a.conector.scale.setScalar(0);
      // adónde va a flotar: repartidas por el recuadro
      a.hasta = new THREE.Vector3(m.x + m.w * azar(0.12, 0.88), -(m.y + m.h * azar(0.25, 0.75)), azar(-200, 200));
      a.p.set(a.hasta.x, -a.hasta.y, a.hasta.z);
      a.v.set(0, 0, 0);
      if (a.adorno) {
        a.r = 0.01; // todavía no existe: aparece al volverse conectores
        continue;
      }
      a.tarjeta.visible = true;
      a.tarjeta.scale.setScalar(a.medida[0]);
      a.demoraVuelo = (1 - Math.min(1, Math.hypot(a.objetivo.x - W / 2, a.objetivo.y - H / 2) / lejos)) * 0.3;
    }
  }
  const poseR = { posicion: new THREE.Vector3(), cuaternion: new THREE.Quaternion(), ancho: 1, alto: 1 };
  const aplastarR = new THREE.Matrix4();
  // t < 0: quietas, cada una calcada sobre su tarjeta. Devuelve true cuando todas flotan.
  function desarmarCuadro(t) {
    const ahora = objetivos();
    let pendientes = 0;
    for (const a of piezas) {
      if (a.adorno) continue;
      const k = t < 0 ? 0 : limitar((t - a.demoraVuelo) / 1.05, 0, 1);
      if (k < 1) pendientes++;
      const e = 1 - expoIO(k); // 1 = plana en su lugar, 0 = flotando
      poseDeTarjeta(ahora.find((o) => o.id === a.objetivo.id) ?? a.objetivo, poseR);
      a.malla.position.lerpVectors(a.hasta, poseR.posicion, e);
      a.malla.position.z += Math.sin(Math.PI * e) * 120;
      a.malla.quaternion.slerpQuaternions(a.frente, poseR.cuaternion, e);
      a.malla.scale.set(1 + (poseR.ancho / a.medida[0] - 1) * e, 1 + (poseR.alto / a.medida[1] - 1) * e, 1 + (GROSOR_TARJETA / a.medida[2] - 1) * e);
      a.cara.emissiveIntensity = LUZ_PROPIA + (1 - LUZ_PROPIA) * e;
      a.cara.color.setScalar(LUZ_ESCENA * (1 - e));
      a.cara.clearcoat = a.canto.clearcoat = a.barniz * (1 - e);
      a.malla.matrixAutoUpdate = false;
      a.malla.updateMatrix();
      aplastarR.makeScale(1, 1, 1 - 0.9995 * e * e);
      a.malla.matrix.premultiply(aplastarR);
      a.malla.matrixWorldNeedsUpdate = true;
    }
    return t >= 0 && pendientes === 0;
  }
  // ya flotan: las toma la física
  function soltar() {
    for (const a of piezas) {
      if (a.adorno) continue;
      a.malla.matrixAutoUpdate = true;
      a.malla.scale.setScalar(1);
      a.p.set(a.malla.position.x, -a.malla.position.y, a.malla.position.z);
      a.v.set(azar(-60, 60), azar(-60, 60), 0);
    }
  }
  function desmutarCuadro(t) {
    let pendientes = 0;
    for (const a of piezas) {
      const k = limitar((t - a.demora) / 0.7, 0, 1);
      if (k < 1) pendientes++;
      if (k <= 0) continue;
      const sale = k * k * (3 - 2 * k);
      if (!a.empujada) {
        a.empujada = true;
        a.giro.add(new THREE.Vector3(azar(-7, 7), azar(-7, 7), azar(-4, 4)));
      }
      // la tarjeta se encoge y, del mismo punto, sale el conector
      a.conector.scale.setScalar(a.r0 * 0.98 * rebote(limitar((k - 0.18) / 0.82, 0, 1)));
      if (a.adorno) {
        a.r = Math.max(0.01, a.r0 * sale);
        continue;
      }
      a.tarjeta.scale.setScalar(Math.max(0.0001, a.medida[0] * (1 - sale)));
      if (k >= 1) a.tarjeta.visible = false;
    }
    comoTarjetas = 1 - limitar(t / 0.9, 0, 1);
    return pendientes === 0;
  }

  // ---- física -------------------------------------------------------------------------------
  const puntero = { x: -9999, y: -9999, activo: false };
  const empuje = new THREE.Vector3();
  const giroQ = new THREE.Quaternion();
  const ejeGiro = new THREE.Vector3();
  // 0 = conectores; 1 = ya son tarjetas 3D (giran menos y se ponen de frente)
  let comoTarjetas = inversa ? 1 : 0;
  function simular(dt) {
    const [cx, cy] = centro();
    for (const a of piezas) {
      if (a.r <= 0.5) continue;
      // resorte al centro del recuadro, firme a lo alto y en profundidad
      // A lo ancho no van a un punto sino a una franja: dentro de ella nada las junta, así se
      // reparten por todo el ancho del recuadro en vez de apilarse en el medio.
      const franja = marco().w * 0.36;
      a.v.x += (limitar(a.p.x, cx - franja, cx + franja) - a.p.x) * 3.4 * dt;
      a.v.y += (cy - a.p.y) * 6.2 * dt;
      a.v.z += -a.p.z * 4.5 * dt;
      // el cursor las aparta
      if (puntero.activo) {
        const dx = a.p.x - puntero.x;
        const dy = a.p.y - puntero.y;
        const d = Math.hypot(dx, dy);
        const alcance = a.r + 130;
        if (d < alcance) {
          const f = (1 - d / alcance) * 9000 * dt;
          const largo = Math.max(1, d);
          a.v.x += (dx / largo) * f;
          a.v.y += (dy / largo) * f;
          a.giro.x += (dy / largo) * f * 0.004;
          a.giro.y += (dx / largo) * f * 0.004;
        }
      }
    }
    // choques entre esferas: se separan y se pasan parte del impulso. Cada pieza cabe entera en
    // su esfera, así que nunca se atraviesan.
    for (let i = 0; i < piezas.length; i++) {
      for (let j = i + 1; j < piezas.length; j++) {
        const a = piezas[i];
        const b = piezas[j];
        if (a.r <= 0.5 || b.r <= 0.5) continue;
        empuje.subVectors(b.p, a.p);
        const d = empuje.length();
        const minimo = a.r + b.r;
        if (d >= minimo || d < 1e-3) continue;
        empuje.multiplyScalar(1 / d);
        const hundido = (minimo - d) * 0.5;
        a.p.addScaledVector(empuje, -hundido);
        b.p.addScaledVector(empuje, hundido);
        const acerca = (b.v.x - a.v.x) * empuje.x + (b.v.y - a.v.y) * empuje.y + (b.v.z - a.v.z) * empuje.z;
        if (acerca < 0) {
          const j2 = -acerca * 0.62;
          a.v.addScaledVector(empuje, -j2);
          b.v.addScaledVector(empuje, j2);
          a.giro.x += empuje.y * j2 * 0.003;
          b.giro.y -= empuje.x * j2 * 0.003;
        }
      }
    }
    const freno = Math.exp(-2.4 * dt);
    const frenoGiro = Math.exp(-(0.9 + comoTarjetas * 3.2) * dt);
    const minimoGiro = 0.2 * (1 - comoTarjetas * 0.8);
    for (const a of piezas) {
      a.v.multiplyScalar(freno);
      a.p.addScaledVector(a.v, dt);
      a.giro.multiplyScalar(frenoGiro);
      // nunca quedan del todo quietas
      const velocidad = a.giro.length();
      if (velocidad < minimoGiro) a.giro.multiplyScalar(minimoGiro / Math.max(1e-3, velocidad));
      ejeGiro.copy(a.giro).normalize();
      giroQ.setFromAxisAngle(ejeGiro, a.giro.length() * dt);
      a.malla.quaternion.premultiply(giroQ);
      // ya tarjeta, se va poniendo de frente: se le ve la cara
      if (comoTarjetas > 0 && !a.adorno) a.malla.quaternion.slerp(a.frente, 1 - Math.exp(-4.6 * comoTarjetas * dt));
      a.malla.position.set(a.p.x, -a.p.y, a.p.z);
    }
  }

  // ---- 2. de conector a tarjeta 3D ----------------------------------------------------------
  let mutacion = null; // { t0, resolver, hecha }
  function mutarCuadro(t) {
    let pendientes = 0;
    for (const a of piezas) {
      const k = limitar((t - a.demoraMut) / 0.7, 0, 1);
      if (k < 1) pendientes++;
      if (k <= 0) {
        // (atado al scroll se puede volver atrás: todavía conector entero)
        if (puente) {
          a.conector.scale.setScalar(a.r0 * 0.98);
          if (a.adorno) a.r = a.r0;
          else if (a.tarjeta) {
            a.tarjeta.visible = false;
            a.tarjeta.scale.setScalar(0.0001);
          }
        }
        continue;
      }
      // el conector se encoge mientras gira y, del mismo punto, sale la tarjeta
      const sale = k * k * (3 - 2 * k);
      a.conector.scale.setScalar(a.r0 * 0.98 * (1 - sale));
      if (!a.empujada) {
        a.empujada = true;
        a.giro.add(new THREE.Vector3(azar(-7, 7), azar(-7, 7), azar(-4, 4)));
      }
      if (a.adorno) {
        a.r = a.r0 * (1 - sale);
        continue;
      }
      a.tarjeta.visible = true;
      const s = rebote(limitar((k - 0.18) / 0.82, 0, 1));
      a.tarjeta.scale.setScalar(Math.max(0.0001, a.medida[0] * s));
    }
    comoTarjetas = limitar(t / 0.9, 0, 1);
    return pendientes === 0;
  }

  // ---- 3. de tarjeta 3D a tarjeta plana, en su lugar de la marquesina -------------------------
  let conversion = null; // { t0, resolver }
  const pose = { posicion: new THREE.Vector3(), cuaternion: new THREE.Quaternion(), ancho: 1, alto: 1 };
  const aplastar = new THREE.Matrix4();
  function prepararConversion() {
    const libres = objetivos();
    const [cx, cy] = centro();
    const lejos = Math.hypot(W, H) / 2;
    for (const a of piezas) {
      a.desde = { p: a.malla.position.clone(), q: a.malla.quaternion.clone() };
      a.objetivo = null;
      if (a.adorno) continue;
      // por si se saltó el paso 2: la tarjeta 3D ya está entera
      a.conector.scale.setScalar(0);
      a.tarjeta.visible = true;
      a.tarjeta.scale.setScalar(a.medida[0]);
      // su tarjeta: la del mismo proyecto que quede más cerca
      let mejor = -1;
      let distancia = Infinity;
      libres.forEach((o, i) => {
        if (o.tomado || o.clave !== a.clave) return;
        const d = Math.hypot(o.x - a.p.x, o.y - a.p.y);
        if (d < distancia) {
          distancia = d;
          mejor = i;
        }
      });
      if (mejor >= 0) {
        libres[mejor].tomado = true;
        a.objetivo = libres[mejor];
        a.demora = (Math.hypot(a.objetivo.x - cx, a.objetivo.y - cy) / lejos) * 0.32;
      }
    }
    for (const a of piezas) {
      if (a.objetivo) continue;
      // sin tarjeta (los de más, o su tarjeta ya no está a la vista): se va achicándose
      a.demora = Math.random() * 0.12;
      a.fuga = new THREE.Vector3(a.p.x - cx, -(a.p.y - cy), 0).normalize().multiplyScalar(lejos * 0.5);
      a.escala0 = a.malla.scale.x;
    }
  }
  function convertirCuadro(t) {
    // las tarjetas derivan despacio: su lugar se vuelve a medir en cada cuadro
    const ahora = objetivos();
    let pendientes = 0;
    for (const a of piezas) {
      const k = limitar((t - a.demora) / (a.objetivo ? 1.05 : 0.5), 0, 1);
      if (k < 1) pendientes++;
      if (!a.objetivo) {
        const e = k * k;
        a.malla.position.copy(a.desde.p).addScaledVector(a.fuga, e);
        a.malla.scale.setScalar(a.escala0 * (1 - e));
        continue;
      }
      const actual = ahora.find((o) => o.id === a.objetivo.id) ?? a.objetivo;
      poseDeTarjeta(actual, pose);
      const e = expoIO(k);
      a.malla.position.lerpVectors(a.desde.p, pose.posicion, e);
      // de camino pasa un poco más cerca de la cámara: vuela, no se arrastra
      a.malla.position.z += Math.sin(Math.PI * e) * 120;
      a.malla.quaternion.slerpQuaternions(a.desde.q, pose.cuaternion, e);
      // se aplana: de su grosor de tarjeta 3D a casi nada
      a.malla.scale.set(1 + (pose.ancho / a.medida[0] - 1) * e, 1 + (pose.alto / a.medida[1] - 1) * e, 1 + (GROSOR_TARJETA / a.medida[2] - 1) * e);
      // La grilla de la marquesina no tiene perspectiva (es un dibujo inclinado, sin fuga) y esta
      // cámara sí: con la tarjeta ya en su lugar, sus puntas más cercanas se verían más grandes y
      // no calzaría. Al llegar se aplasta el mundo en profundidad: queda la misma forma, sin fuga.
      a.malla.matrixAutoUpdate = false;
      a.malla.updateMatrix();
      aplastar.makeScale(1, 1, 1 - 0.9995 * e * e);
      a.malla.matrix.premultiply(aplastar);
      a.malla.matrixWorldNeedsUpdate = true;
      // y su cara deja de depender de la luz: termina del color exacto de la tarjeta de verdad
      a.cara.emissiveIntensity = LUZ_PROPIA + (1 - LUZ_PROPIA) * e;
      a.cara.color.setScalar(LUZ_ESCENA * (1 - e));
      a.cara.clearcoat = a.canto.clearcoat = a.barniz * (1 - e);
    }
    return pendientes === 0;
  }

  // ---- puente: etapas atadas al scroll -------------------------------------------------------
  const ORDEN = { portadas: 0, flotar: 1, mutar: 2, convertir: 3 };
  let etapaP = 'portadas';
  let tP = 0;
  // la física retoma desde donde quedó cada pieza
  function aFisica() {
    for (const a of piezas) {
      a.malla.matrixAutoUpdate = true;
      a.malla.scale.setScalar(1);
      a.p.set(a.malla.position.x, -a.malla.position.y, a.malla.position.z);
      a.v.set(0, 0, 0);
    }
  }
  function salirDe(etapa, subiendo) {
    if (etapa === 'portadas') {
      portadasCuadro(1);
      portadas3d.forEach((p) => (p.malla.visible = false));
      aFisica();
    } else if (etapa === 'mutar') {
      mutarCuadro(subiendo ? 9 : 0);
      comoTarjetas = subiendo ? 1 : 0;
    } else if (etapa === 'convertir' && !subiendo) {
      // vuelven a flotar como tarjetas 3D desde donde iban
      aFisica();
      for (const a of piezas) {
        a.demora = a.demoraMut;
        if (a.cara) {
          a.cara.emissiveIntensity = LUZ_PROPIA;
          a.cara.color.setScalar(LUZ_ESCENA);
          a.cara.clearcoat = a.canto.clearcoat = a.barniz;
        }
      }
      conversion = null;
    }
  }
  function entrarEn(etapa, bajando) {
    if (etapa === 'portadas' && bajando) {
      // de vuelta a las portadas: cada conector vuelve desde donde está ahora
      for (const a of piezas) {
        a.casa.copy(a.p);
        a.qCasa.copy(a.malla.quaternion);
      }
    } else if (etapa === 'mutar' && bajando) {
      mutarCuadro(9);
      comoTarjetas = 1;
    } else if (etapa === 'convertir' && !bajando) {
      comoTarjetas = 1;
      mutarCuadro(9);
      prepararConversion();
      conversion = { t0: 0, resolver: null, hecha: false };
    }
  }
  function ponerProgreso(etapa, t) {
    if (!puente || !(etapa in ORDEN)) return;
    let actual = etapaP;
    // de a un paso, así cada etapa deja todo como la siguiente lo espera
    while (actual !== etapa) {
      const subiendo = ORDEN[etapa] > ORDEN[actual];
      const siguiente = Object.keys(ORDEN).find((k) => ORDEN[k] === ORDEN[actual] + (subiendo ? 1 : -1));
      salirDe(actual, subiendo);
      entrarEn(siguiente, !subiendo);
      actual = siguiente;
    }
    etapaP = etapa;
    tP = limitar(t, 0, 1);
  }
  function cuadroPuente(dt) {
    if (etapaP === 'portadas') {
      portadasCuadro(tP);
    } else if (etapaP === 'convertir') {
      convertirCuadro(tP * 1.42);
    } else {
      if (etapaP === 'mutar') {
        mutarCuadro(tP * 1.3);
        comoTarjetas = limitar(tP * 1.2, 0, 1);
      }
      for (const m of deAcento) m.color.lerp(colorAcento, 1 - Math.exp(-9 * dt));
      for (let paso = 0; paso < 4; paso++) simular(dt / 4);
    }
    renderizador.render(escena, camara);
  }

  // ---- bucle --------------------------------------------------------------------------------
  let destruido = false;
  let raf = 0;
  let ultimo = null;
  let activoP = true;
  function cuadro(ahora) {
    if (destruido) return;
    raf = requestAnimationFrame(cuadro);
    const dt = ultimo === null ? 0 : Math.min(1 / 30, (ahora - ultimo) / 1000);
    ultimo = ahora;
    if (puente) {
      if (activoP) cuadroPuente(dt);
      return;
    }
    if (reversa && (reversa.fase === 'plana' || reversa.fase === 'desarmando')) {
      let t = -1;
      if (reversa.fase === 'desarmando') {
        if (reversa.t0 === null) reversa.t0 = ahora;
        t = (ahora - reversa.t0) / 1000;
      }
      const flotan = desarmarCuadro(t);
      renderizador.render(escena, camara);
      if (flotan) {
        soltar();
        reversa.fase = 'tarjetas';
        reversa.resolver?.();
      }
      return;
    }
    if (reversa?.fase === 'desmutando') {
      if (reversa.t0 === null) reversa.t0 = ahora;
      if (desmutarCuadro((ahora - reversa.t0) / 1000)) {
        reversa.fase = 'conectores';
        reversa.resolver?.();
      }
    }
    if (conversion) {
      if (conversion.t0 === null) conversion.t0 = ahora;
      const termino = !conversion.hecha && convertirCuadro((ahora - conversion.t0) / 1000);
      renderizador.render(escena, camara);
      if (termino) {
        conversion.hecha = true;
        conversion.resolver?.();
      }
      return;
    }
    if (mutacion && !mutacion.hecha) {
      if (mutacion.t0 === null) mutacion.t0 = ahora;
      if (mutarCuadro((ahora - mutacion.t0) / 1000)) {
        mutacion.hecha = true;
        mutacion.resolver?.();
      }
    }
    for (const m of deAcento) m.color.lerp(colorAcento, 1 - Math.exp(-9 * dt));
    // varios pasos por cuadro: los choques quedan firmes
    for (let paso = 0; paso < 4; paso++) simular(dt / 4);
    renderizador.render(escena, camara);
  }
  raf = requestAnimationFrame(cuadro);

  const alMover = (evento) => {
    const cajaPanel = panel.getBoundingClientRect();
    const escala = cajaPanel.width / Math.max(1, panel.offsetWidth);
    puntero.x = (evento.clientX - cajaPanel.left) / escala;
    puntero.y = (evento.clientY - cajaPanel.top) / escala;
    puntero.activo = evento.pointerType !== 'touch';
  };
  const alSalir = () => {
    puntero.activo = false;
  };
  // Un clic sobre el recuadro, con los conectores a la vista: cambia el color y los sacude.
  const alPulsar = (evento) => {
    if (puente ? etapaP !== 'flotar' || !activoP : conversion || mutacion || (reversa && reversa.fase !== 'conectores')) return;
    alMover(evento);
    const m = marco();
    if (puntero.x < m.x || puntero.x > m.x + m.w || puntero.y < m.y || puntero.y > m.y + m.h) return;
    acento = (acento + 1) % ACENTOS.length;
    colorAcento.set(ACENTOS[acento]);
    for (const a of piezas) {
      const dx = a.p.x - puntero.x;
      const dy = a.p.y - puntero.y;
      const d = Math.max(40, Math.hypot(dx, dy));
      const f = 26000 / d;
      a.v.x += (dx / d) * f;
      a.v.y += (dy / d) * f;
      a.giro.x += azar(-3, 3);
      a.giro.y += azar(-3, 3);
    }
  };
  window.addEventListener('pointerdown', alPulsar, { passive: true });
  window.addEventListener('pointermove', alMover, { passive: true });
  document.addEventListener('pointerleave', alSalir);
  const observador = new ResizeObserver(redimensionar);
  observador.observe(panel);
  const alPerderContexto = (evento) => {
    evento.preventDefault();
    alFallar?.();
  };
  lienzo.addEventListener('webglcontextlost', alPerderContexto);

  return {
    // ---- puente (atado al scroll) ----
    ponerProgreso,
    tienePortadas: () => portadas3d.length > 0,
    // Calca las portadas ahora; los conectores vuelven a ellas desde donde estén.
    ponerPortadas(lista) {
      armarPortadas(lista);
      if (etapaP === 'portadas') portadasCuadro(tP);
    },
    etapaPuente: () => etapaP,
    // fuera de pantalla no se dibuja ni se simula
    activar(si) {
      activoP = Boolean(si);
      if (activoP) ultimo = null;
    },
    piezas: () => piezas.length,
    // En qué tiempo está: 'conectores', 'mutando', 'tarjetas' (3D, flotando) o 'aplanando'.
    etapa: () => (conversion ? 'aplanando' : !mutacion ? 'conectores' : mutacion.hecha ? 'tarjetas' : 'mutando'),
    // 2. Los conectores se vuelven tarjetas 3D. La promesa se cumple cuando todas lo son.
    mutar() {
      if (mutacion || conversion) return Promise.resolve();
      return new Promise((resolver) => {
        mutacion = { t0: null, resolver, hecha: false };
      });
    },
    // 3. Las tarjetas vuelan a su lugar y se aplanan. La promesa se cumple cuando cada una quedó
    // exactamente sobre la suya (ahí Proyectos muestra las de verdad y retira el canvas).
    convertir() {
      if (conversion) return Promise.resolve();
      return new Promise((resolver) => {
        comoTarjetas = 1;
        prepararConversion();
        conversion = { t0: null, resolver, hecha: false };
      });
    },
    // Al revés. 1: las tarjetas planas se levantan de la marquesina y pasan a flotar en 3D.
    desarmar() {
      if (!reversa || reversa.fase !== 'plana') return Promise.resolve();
      return new Promise((resolver) => {
        reversa = { fase: 'desarmando', t0: null, resolver };
      });
    },
    // Al revés. 2: las tarjetas 3D se vuelven conectores.
    desmutar() {
      if (!reversa || reversa.fase !== 'tarjetas') return Promise.resolve();
      return new Promise((resolver) => {
        reversa = { fase: 'desmutando', t0: null, resolver };
      });
    },
    destruir() {
      if (destruido) return;
      destruido = true;
      reversa?.resolver?.();
      cancelAnimationFrame(raf);
      mutacion?.resolver?.();
      conversion?.resolver?.();
      window.removeEventListener('pointerdown', alPulsar);
      window.removeEventListener('pointermove', alMover);
      document.removeEventListener('pointerleave', alSalir);
      observador.disconnect();
      lienzo.removeEventListener('webglcontextlost', alPerderContexto);
      armarPortadas([]);
      desechables.forEach((cosa) => cosa.dispose());
      entorno.dispose();
      pmrem.dispose();
      renderizador.dispose();
    },
  };
}
