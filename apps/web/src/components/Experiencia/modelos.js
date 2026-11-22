// Objetos característicos de cada trabajo, armados con primitivas de three (sin archivos).
// Cada constructor devuelve { grupo, ancla, animar? }:
// - el grupo tiene el pie en y = 0, la espalda contra la pared en z = 0 y mira hacia +z
//   (el pasillo lo gira para que mire al centro);
// - `ancla` es el punto local donde va el punto del tooltip;
// - `animar(t)` (opcional) mueve algo cada cuadro: ventiladores, LEDs, cajas en la cinta.
// Las piezas no salen más de ~1,1 m de la pared, así el centro del pasillo queda libre.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { autoReal, celularReal, gabineteReal, iaReal, impresoraReal, liberarObjetos, notebookReal, pagoReal, placaReal } from './objetosTooltip.js';

const geoCaja = new THREE.BoxGeometry(1, 1, 1);
const geoCilindro = new THREE.CylinderGeometry(1, 1, 1, 20);
const cacheMateriales = new Map();

// Material compartido por color (y si brilla). `emisivo` en [0, 1] usa el mismo color como luz.
function mat(color, { emisivo = 0, rugosidad = 0.65, metal = 0.05, transparente = false, opacidad = 1 } = {}) {
  const clave = `${color}|${emisivo}|${rugosidad}|${metal}|${opacidad}`;
  if (!cacheMateriales.has(clave)) {
    cacheMateriales.set(
      clave,
      new THREE.MeshStandardMaterial({
        color,
        roughness: rugosidad,
        metalness: metal,
        emissive: emisivo ? color : 0x000000,
        emissiveIntensity: emisivo,
        transparent: transparente || opacidad < 1,
        opacity: opacidad,
      }),
    );
  }
  return cacheMateriales.get(clave);
}

const geoRedondeadas = new Map();
function caja(padre, [w, h, d], [x, y, z], material, rot = null) {
  const radio = Math.min(0.01, Math.min(w, h, d) * 0.2);
  let geo = geoCaja;
  if (radio > 0.0008) {
    const clave = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}`;
    if (!geoRedondeadas.has(clave)) geoRedondeadas.set(clave, new RoundedBoxGeometry(w, h, d, 2, radio));
    geo = geoRedondeadas.get(clave);
  }
  const m = new THREE.Mesh(geo, material);
  if (geo === geoCaja) m.scale.set(w, h, d);
  m.position.set(x, y, z);
  if (rot) m.rotation.set(...rot);
  padre.add(m);
  return m;
}

function cilindro(padre, radio, alto, [x, y, z], material, rot = null) {
  const m = new THREE.Mesh(geoCilindro, material);
  m.scale.set(radio, alto, radio);
  m.position.set(x, y, z);
  if (rot) m.rotation.set(...rot);
  padre.add(m);
  return m;
}

// Lámina con un dibujo hecho en canvas 2D (pantallas, pizarrones, carteles).
function lamina(padre, [w, h], [x, y, z], dibujar, { emisivo = 0.9, resolucion = 256 } = {}) {
  const lienzo = document.createElement('canvas');
  const aspecto = w / h;
  lienzo.width = Math.round(resolucion * Math.max(1, aspecto));
  lienzo.height = Math.round(resolucion * Math.max(1, 1 / aspecto));
  const ctx = lienzo.getContext('2d');
  dibujar(ctx, lienzo.width, lienzo.height);
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 4;
  const material = new THREE.MeshStandardMaterial({
    map: textura,
    emissiveMap: emisivo ? textura : null,
    emissive: emisivo ? 0xffffff : 0x000000,
    emissiveIntensity: emisivo,
    roughness: 0.8,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  m.position.set(x, y, z);
  padre.add(m);
  return m;
}

const fuente = (px, peso = 700) => `${peso} ${px}px Inter, system-ui, sans-serif`;
const fuenteMono = (px) => `600 ${px}px ui-monospace, Consolas, monospace`;

function redondeado(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// Tarima / pedestal para objetos chicos.
// ---------------------------------------------------------------------------------------------
// Laboratorio

// ---------------------------------------------------------------------------------------------
// Docencia

function pizarron() {
  const g = new THREE.Group();
  caja(g, [2.2, 1.25, 0.05], [0, 1.65, 0.03], mat('#6b4a32'));
  lamina(
    g,
    [2.08, 1.13],
    [0, 1.65, 0.06],
    (ctx, w, h) => {
      ctx.fillStyle = '#1e3a2f';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      for (let i = 0; i < 40; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 60, 3);
      ctx.fillStyle = '#eef3ea';
      ctx.font = fuenteMono(30);
      const lineas = ['# Python', "nombre = input('Nombre: ')", "print(f'Hola, {nombre}!')", '', '// C', '#include <stdio.h>', 'int main() {', '  printf("Hola, mundo\\n");', '  return 0;', '}'];
      lineas.forEach((l, i) => ctx.fillText(l, 34, 50 + i * 40));
    },
    { emisivo: 0.05, resolucion: 440 },
  );
  caja(g, [2.0, 0.04, 0.08], [0, 1.0, 0.07], mat('#6b4a32'));
  caja(g, [0.08, 0.02, 0.02], [0.6, 1.03, 0.07], mat('#fff'));
  return { grupo: g, ancla: new THREE.Vector3(0, 2.4, 0.15) };
}

function diagrama() {
  const g = new THREE.Group();
  caja(g, [1.6, 1.3, 0.04], [0, 1.65, 0.02], mat('#c9ccd2', { metal: 0.5 }));
  lamina(
    g,
    [1.52, 1.22],
    [0, 1.65, 0.045],
    (ctx, w, h) => {
      ctx.fillStyle = '#f7f8fa';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#1d4ed8';
      ctx.fillStyle = '#1d4ed8';
      ctx.lineWidth = 5;
      ctx.font = fuente(24, 600);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const cx = w / 2;
      const nodo = (y, texto, forma) => {
        ctx.beginPath();
        if (forma === 'rombo') {
          ctx.moveTo(cx, y - 40);
          ctx.lineTo(cx + 90, y);
          ctx.lineTo(cx, y + 40);
          ctx.lineTo(cx - 90, y);
          ctx.closePath();
        } else if (forma === 'pildora') ctx.roundRect(cx - 80, y - 24, 160, 48, 24);
        else ctx.rect(cx - 90, y - 26, 180, 52);
        ctx.stroke();
        ctx.fillText(texto, cx, y);
      };
      const flecha = (y1, y2) => {
        ctx.beginPath();
        ctx.moveTo(cx, y1);
        ctx.lineTo(cx, y2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 9, y2 - 12);
        ctx.lineTo(cx, y2);
        ctx.lineTo(cx + 9, y2 - 12);
        ctx.stroke();
      };
      nodo(46, 'Inicio', 'pildora');
      flecha(70, 112);
      nodo(140, 'leer n', 'caja');
      flecha(166, 210);
      nodo(252, '¿n > 0?', 'rombo');
      flecha(292, 336);
      nodo(362, 'mostrar n', 'caja');
      ctx.fillText('sí', cx + 22, 314);
      ctx.beginPath();
      ctx.moveTo(cx + 90, 252);
      ctx.lineTo(cx + 150, 252);
      ctx.lineTo(cx + 150, 140);
      ctx.lineTo(cx + 92, 140);
      ctx.stroke();
      ctx.fillText('no', cx + 128, 232);
    },
    { emisivo: 0.05, resolucion: 420 },
  );
  return { grupo: g, ancla: new THREE.Vector3(0, 2.45, 0.12) };
}



// ---------------------------------------------------------------------------------------------
// Freelance

// ---------------------------------------------------------------------------------------------
// Técnico

function monitor() {
  const g = new THREE.Group();
  caja(g, [1.7, 1.0, 0.06], [0, 1.7, 0.08], mat('#15171c', { metal: 0.5, rugosidad: 0.3 }));
  caja(g, [0.2, 0.2, 0.08], [0, 1.7, 0.02], mat('#15171c'));
  lamina(
    g,
    [1.62, 0.92],
    [0, 1.7, 0.112],
    (ctx, w, h) => {
      ctx.fillStyle = '#0f1218';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#f4f5f7';
      ctx.font = fuente(34);
      ctx.fillText('Darío Martínez Computación', 36, 60);
      ctx.fillStyle = '#9aa1ac';
      ctx.font = fuente(20, 500);
      ctx.fillText('Panel · stock y ventas en tiempo real', 36, 94);
      const tarjetas = [['Ventas hoy', '$ 482.300'], ['Stock', '1.284 u.'], ['Pedidos', '37']];
      tarjetas.forEach(([t, v], i) => {
        const x = 36 + i * 250;
        ctx.fillStyle = '#1a1f29';
        redondeado(ctx, x, 120, 230, 100, 14);
        ctx.fill();
        ctx.fillStyle = '#9aa1ac';
        ctx.font = fuente(18, 500);
        ctx.fillText(t, x + 18, 150);
        ctx.fillStyle = '#f4f5f7';
        ctx.font = fuente(32);
        ctx.fillText(v, x + 18, 196);
      });
      const barras = [0.4, 0.55, 0.35, 0.7, 0.62, 0.85, 0.78, 0.95, 0.66, 0.8];
      barras.forEach((b, i) => {
        ctx.fillStyle = i === barras.length - 3 ? '#8f73f5' : '#3b4252';
        const alto = b * 180;
        redondeado(ctx, 36 + i * 74, 440 - alto, 52, alto, 6);
        ctx.fill();
      });
    },
    { emisivo: 1, resolucion: 460 },
  );
  return { grupo: g, ancla: new THREE.Vector3(0, 2.35, 0.2) };
}

// ---------------------------------------------------------------------------------------------
// Barra




// ---------------------------------------------------------------------------------------------
// MBRF

function balanza() {
  const g = new THREE.Group();
  const acero = mat('#b8bcc4', { metal: 0.85, rugosidad: 0.3 });
  caja(g, [1.2, 0.08, 0.9], [0, 0.04, 0.55], acero);
  caja(g, [1.24, 0.02, 0.94], [0, 0.005, 0.55], mat('#e8c547', { emisivo: 0.3 }));
  cilindro(g, 0.035, 1.2, [-0.45, 0.6, 0.15], acero);
  const visor = new THREE.Group();
  visor.position.set(-0.45, 1.3, 0.2);
  g.add(visor);
  caja(visor, [0.5, 0.3, 0.12], [0, 0, 0], mat('#2c3038', { metal: 0.4 }));
  const pantalla = lamina(
    visor,
    [0.44, 0.2],
    [0, 0.01, 0.061],
    (ctx, w, h) => {
      ctx.fillStyle = '#071a0e';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#59ff9c';
      ctx.font = fuenteMono(72);
      ctx.textAlign = 'right';
      ctx.fillText('12.48', w - 90, h * 0.72);
      ctx.font = fuenteMono(34);
      ctx.fillText('kg', w - 24, h * 0.72);
    },
    { emisivo: 1, resolucion: 160 },
  );
  pantalla.material.emissiveIntensity = 1;
  // caja sobre la balanza con etiqueta
  caja(g, [0.5, 0.32, 0.4], [0.15, 0.24, 0.6], mat('#c79a62', { rugosidad: 0.9 }));
  lamina(
    g,
    [0.24, 0.14],
    [0.15, 0.26, 0.801],
    (ctx, w, h) => {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#111';
      for (let x = 14; x < w - 14; x += 3 + ((x * 13) % 5)) ctx.fillRect(x, 14, 2 + ((x * 7) % 3), h * 0.55);
      ctx.font = fuenteMono(16);
      ctx.fillText('7 790123 004512', 18, h - 14);
    },
    { emisivo: 0.2, resolucion: 160 },
  );
  // escáner con haz
  const escaner = new THREE.Group();
  escaner.position.set(0.5, 1.15, 0.25);
  g.add(escaner);
  caja(escaner, [0.08, 0.18, 0.06], [0, 0, 0], mat('#22252b'));
  caja(escaner, [0.12, 0.08, 0.14], [0, 0.11, 0.05], mat('#22252b'));
  const haz = caja(escaner, [0.002, 0.004, 0.6], [0, 0.11, 0.42], mat('#ff2a2a', { emisivo: 1, opacidad: 0.8 }), [-0.95, 0, 0]);
  caja(g, [0.03, 0.9, 0.03], [0.5, 0.6, 0.2], mat('#2c3038', { metal: 0.5 }));
  return {
    grupo: g,
    ancla: new THREE.Vector3(0, 1.75, 0.45),
    animar: (t) => {
      haz.visible = Math.sin(t * 2.2) > 0;
      escaner.rotation.y = Math.sin(t * 2.2) * 0.12;
    },
  };
}

function cajas(acento) {
  const g = new THREE.Group();
  const fierro = mat('#2c3038', { metal: 0.5 });
  const largo = 3.6;
  // cinta transportadora a lo largo de la pared (x local)
  caja(g, [largo, 0.06, 0.6], [0, 0.82, 0.5], mat('#15171c', { rugosidad: 0.95 }));
  for (const z of [0.18, 0.82]) caja(g, [largo, 0.08, 0.04], [0, 0.84, z], mat('#b8bcc4', { metal: 0.8 }));
  for (let x = -largo / 2 + 0.2; x <= largo / 2 - 0.2; x += 0.85) for (const z of [0.22, 0.78]) caja(g, [0.05, 0.8, 0.05], [x, 0.4, z], fierro);
  caja(g, [largo, 0.02, 0.02], [0, 0.6, 0.83], mat(acento, { emisivo: 1 }));
  const carton = mat('#c79a62', { rugosidad: 0.9 });
  const etiqueta = mat('#ffffff', { emisivo: 0.15 });
  const paquetes = [];
  const cantidad = 5;
  for (let i = 0; i < cantidad; i++) {
    const p = new THREE.Group();
    caja(p, [0.42, 0.3, 0.38], [0, 0.15, 0], carton);
    caja(p, [0.2, 0.12, 0.005], [0, 0.17, 0.193], etiqueta);
    caja(p, [0.43, 0.04, 0.02], [0, 0.29, 0], mat('#a07440'));
    p.position.set(0, 0.85, 0.5);
    g.add(p);
    paquetes.push(p);
  }
  return {
    grupo: g,
    ancla: new THREE.Vector3(0, 1.6, 0.5),
    animar: (t) =>
      paquetes.forEach((p, i) => {
        const u = (((t * 0.22 + i / cantidad) % 1) + 1) % 1;
        p.position.x = -largo / 2 + 0.25 + u * (largo - 0.5);
        // aparecen y desaparecen en las puntas
        const borde = Math.min(u, 1 - u) * 10;
        p.scale.setScalar(Math.min(1, borde));
      }),
  };
}

function tablero(acento) {
  const g = new THREE.Group();
  caja(g, [2.3, 1.15, 0.06], [0, 1.72, 0.06], mat('#15171c', { metal: 0.5, rugosidad: 0.3 }));
  lamina(
    g,
    [2.22, 1.07],
    [0, 1.72, 0.092],
    (ctx, w, h) => {
      ctx.fillStyle = '#0b1020';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#f4f5f7';
      ctx.font = fuente(30);
      ctx.fillText('Planeamiento · Calidad · Stock', 32, 52);
      ctx.fillStyle = acento;
      ctx.font = fuente(18, 700);
      ctx.fillText('SAP HANA · sincronizado', 32, 82);
      const plantas = ['Planta 1', 'Planta 2', 'Planta 3', 'Planta 4'];
      plantas.forEach((p, i) => {
        const x = 32 + i * 240;
        ctx.fillStyle = '#151b2e';
        redondeado(ctx, x, 110, 220, 330, 14);
        ctx.fill();
        ctx.fillStyle = '#c3c9d6';
        ctx.font = fuente(20, 600);
        ctx.fillText(p, x + 16, 142);
        // línea de producción
        ctx.strokeStyle = acento;
        ctx.lineWidth = 4;
        ctx.beginPath();
        for (let k = 0; k <= 8; k++) {
          const y = 300 - Math.abs(Math.sin(k * 0.9 + i)) * 100 - k * 8;
          if (k === 0) ctx.moveTo(x + 16 + k * 23, y);
          else ctx.lineTo(x + 16 + k * 23, y);
        }
        ctx.stroke();
        ctx.fillStyle = '#2fb574';
        ctx.font = fuente(34);
        ctx.fillText(`${92 + ((i * 3) % 7)}%`, x + 16, 360);
        ctx.fillStyle = '#9aa1ac';
        ctx.font = fuente(16, 500);
        ctx.fillText('calidad', x + 16, 386);
        ctx.fillStyle = '#26304a';
        redondeado(ctx, x + 16, 406, 188, 14, 7);
        ctx.fill();
        ctx.fillStyle = acento;
        redondeado(ctx, x + 16, 406, 188 * (0.5 + i * 0.12), 14, 7);
        ctx.fill();
      });
    },
    { emisivo: 1, resolucion: 470 },
  );
  return { grupo: g, ancla: new THREE.Vector3(0, 2.45, 0.2) };
}

function rack(acento) {
  const g = new THREE.Group();
  const negro = mat('#16181d', { metal: 0.5, rugosidad: 0.4 });
  caja(g, [0.7, 2.1, 0.8], [0, 1.05, 0.42], negro);
  const leds = [];
  for (let i = 0; i < 9; i++) {
    const y = 0.35 + i * 0.2;
    caja(g, [0.62, 0.16, 0.02], [0, y, 0.83], mat('#23262d', { metal: 0.6 }));
    for (let k = 0; k < 6; k++) leds.push(caja(g, [0.02, 0.02, 0.01], [-0.25 + k * 0.035, y, 0.845], mat(k % 3 === 0 ? acento : '#59ff9c', { emisivo: 1 })));
  }
  // timón de Kubernetes en la puerta
  lamina(
    g,
    [0.36, 0.36],
    [0.13, 2.0, 0.825],
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#326ce5';
      ctx.beginPath();
      for (let k = 0; k < 7; k++) {
        const a = -Math.PI / 2 + (k * Math.PI * 2) / 7;
        const x = w / 2 + Math.cos(a) * w * 0.46;
        const y = h / 2 + Math.sin(a) * h * 0.46;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = w * 0.045;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w * 0.2, 0, Math.PI * 2);
      for (let k = 0; k < 7; k++) {
        const a = -Math.PI / 2 + (k * Math.PI * 2) / 7;
        ctx.moveTo(w / 2 + Math.cos(a) * w * 0.08, h / 2 + Math.sin(a) * h * 0.08);
        ctx.lineTo(w / 2 + Math.cos(a) * w * 0.34, h / 2 + Math.sin(a) * h * 0.34);
      }
      ctx.stroke();
    },
    { emisivo: 0.7, resolucion: 200 },
  ).material.transparent = true;
  return {
    grupo: g,
    ancla: new THREE.Vector3(0, 2.4, 0.6),
    animar: (t) =>
      leds.forEach((l, i) => {
        l.visible = Math.sin(t * (3 + (i % 7)) + i * 2.3) > -0.5;
      }),
  };
}

function equipo(acento) {
  const g = new THREE.Group();
  caja(g, [1.9, 1.2, 0.03], [0, 1.65, 0.02], mat('#e9ecf1', { rugosidad: 0.6 }));
  lamina(
    g,
    [1.84, 1.14],
    [0, 1.65, 0.04],
    (ctx, w, h) => {
      ctx.fillStyle = '#f6f7f9';
      ctx.fillRect(0, 0, w, h);
      const columnas = ['Por hacer', 'En curso', 'Revisión', 'Listo'];
      const notas = ['#ffe27a', '#ffb3c1', '#a8e6cf', '#a0c4ff'];
      columnas.forEach((c, i) => {
        const x = 18 + i * ((w - 36) / 4);
        const ancho = (w - 36) / 4 - 14;
        ctx.fillStyle = '#20242c';
        ctx.font = fuente(24);
        ctx.fillText(c, x + 6, 44);
        ctx.fillStyle = i === 1 ? acento : '#cfd3da';
        ctx.fillRect(x + 6, 56, ancho - 12, 4);
        for (let k = 0; k < 4 - (i === 3 ? 1 : 0); k++) {
          if ((i + k) % 3 === 2 && k > 1) continue;
          const y = 78 + k * 104;
          ctx.fillStyle = notas[(i + k) % notas.length];
          ctx.save();
          ctx.translate(x + 6 + ancho / 2, y + 44);
          ctx.rotate(((i * 3 + k * 5) % 5 - 2) * 0.02);
          ctx.fillRect(-ancho / 2 + 6, -42, ancho - 12, 86);
          ctx.fillStyle = 'rgba(0,0,0,0.45)';
          for (let r = 0; r < 3; r++) ctx.fillRect(-ancho / 2 + 18, -26 + r * 18, (ancho - 40) * (1 - r * 0.25), 6);
          ctx.restore();
        }
      });
    },
    { emisivo: 0.05, resolucion: 440 },
  );
  // sillas de reunión
  for (const x of [-0.55, 0.55]) {
    caja(g, [0.45, 0.05, 0.45], [x, 0.46, 0.7], mat('#2c3038'));
    caja(g, [0.45, 0.45, 0.05], [x, 0.7, 0.48], mat(acento, { rugosidad: 0.8 }));
    cilindro(g, 0.03, 0.44, [x, 0.22, 0.7], mat('#22252b', { metal: 0.6 }));
    cilindro(g, 0.22, 0.02, [x, 0.01, 0.7], mat('#22252b', { metal: 0.6 }));
  }
  return { grupo: g, ancla: new THREE.Vector3(0, 2.4, 0.15) };
}

// ---------------------------------------------------------------------------------------------
// Objetos con tooltip hechos con modelos reales (Poly Haven). El grupo nace vacío (o con lo que
// no existe como modelo, p. ej. el trago) y EscenaPasillo le agrega `reales` cuando cargan.
// Cada real: { id, x, y, z, giro, poblar } en el espacio del objeto (espalda en z = 0, frente +z).
// `poblar`: se le detectan los estantes y se llenan con cosas de la temática.

function bancoReal() {
  const g = new THREE.Group();
  const tapa = 0.79;
  return {
    grupo: g,
    ancla: new THREE.Vector3(0, 1.45, 0.5),
    reales: [
      { id: 'metal_office_desk', x: 0, y: 0, z: 0.5, giro: 0 },
      { id: 'retro_multimeter', x: -0.72, y: tapa, z: 0.42, giro: 0.25 },
      { id: 'power_box_01', x: -0.2, y: tapa, z: 0.36, giro: 0.15 },
      { id: 'measuring_tape_01', x: 0.25, y: tapa, z: 0.55, giro: -0.4 },
      { id: 'small_plastic_torch', x: 0.5, y: tapa, z: 0.45, giro: 0.6 },
      { id: 'lightbulb_01', x: 0.78, y: tapa, z: 0.32, giro: 0 },
    ],
  };
}

function pupitresReales() {
  const g = new THREE.Group();
  return {
    grupo: g,
    ancla: new THREE.Vector3(0, 1.4, 0.7),
    reales: [
      { id: 'SchoolDesk_01', x: -0.5, y: 0, z: 0.33, giro: 0.04 },
      { id: 'SchoolDesk_01', x: 0.5, y: 0, z: 0.33, giro: -0.03 },
      { id: 'SchoolChair_01', x: -0.48, y: 0, z: 0.8, giro: Math.PI - 0.08 },
      { id: 'SchoolChair_01', x: 0.52, y: 0, z: 0.82, giro: Math.PI + 0.1 },
    ],
  };
}

function bibliotecaReal() {
  return {
    grupo: new THREE.Group(),
    ancla: new THREE.Vector3(0, 2.28, 0.3),
    reales: [{ id: 'wooden_bookshelf_worn', x: 0, y: 0, z: 0.31, giro: 0, poblar: true }],
  };
}



const CONSTRUCTORES = {
  placa: placaReal,
  banco: bancoReal,
  gabinete: gabineteReal,
  pizarron,
  diagrama,
  pupitres: pupitresReales,
  libros: bibliotecaReal,
  celular: celularReal,
  pago: pagoReal,
  robot: iaReal,
  auto: autoReal,
  notebook: notebookReal,
  impresora: impresoraReal,
  monitor,
  balanza,
  cajas,
  tablero,
  rack,
  equipo,
};

export function construirModelo(nombre, acento) {
  const constructor = CONSTRUCTORES[nombre];
  if (!constructor) throw new Error(`Modelo desconocido: ${nombre}`);
  return constructor(acento);
}

// Libera los materiales compartidos (las geometrías y texturas las libera la escena al recorrerse).
export function liberarModelos() {
  liberarObjetos();
  for (const m of cacheMateriales.values()) m.dispose();
  cacheMateriales.clear();
}

export { lamina, fuente };
