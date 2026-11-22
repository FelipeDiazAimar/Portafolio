// Objetos con tooltip hechos a escala real y con materiales físicos (PBR): lo que no existe como
// modelo libre (celular con el chat de JustPhones, posnet, notebook con el asistente de IA, auto a
// escala, gabinete de PC abierto, rack de red, impresora...) se arma acá con piezas biseladas,
// metal, vidrio con transmisión y plástico. Lo que sí existe en Poly Haven va en `reales`
// (EscenaPasillo los carga y los ubica).
//
// Igual que en modelos.js: espalda contra la pared en z = 0, frente hacia +z, pie en y = 0.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// ---- materiales -------------------------------------------------------------------------------
const cache = new Map();
function m(clave, crear) {
  if (!cache.has(clave)) cache.set(clave, crear());
  return cache.get(clave);
}
const M = {
  aluminio: () => m('aluminio', () => new THREE.MeshStandardMaterial({ color: '#c3c7cd', metalness: 1, roughness: 0.32 })),
  grafito: () => m('grafito', () => new THREE.MeshStandardMaterial({ color: '#2b2e33', metalness: 0.9, roughness: 0.38 })),
  acero: () => m('acero', () => new THREE.MeshStandardMaterial({ color: '#8e949c', metalness: 1, roughness: 0.42 })),
  aceroPintado: (c = '#3a3f47') => m(`pintado${c}`, () => new THREE.MeshStandardMaterial({ color: c, metalness: 0.55, roughness: 0.5 })),
  plastico: (c = '#1b1d21') => m(`plastico${c}`, () => new THREE.MeshStandardMaterial({ color: c, metalness: 0, roughness: 0.42 })),
  goma: () => m('goma', () => new THREE.MeshStandardMaterial({ color: '#141414', metalness: 0, roughness: 0.92 })),
  vidrio: () => m('vidrio', () => new THREE.MeshPhysicalMaterial({ color: '#ffffff', metalness: 0, roughness: 0.04, clearcoat: 1, transparent: true, opacity: 0.18, depthWrite: false })),
  acrilico: () => m('acrilico', () => new THREE.MeshPhysicalMaterial({ color: '#f4fbff', metalness: 0, roughness: 0.02, clearcoat: 1, transparent: true, opacity: 0.14, depthWrite: false })),
  vidrioOscuro: () => m('vidrioOscuro', () => new THREE.MeshPhysicalMaterial({ color: '#10161c', metalness: 0.2, roughness: 0.05, clearcoat: 1 })),
  pcb: () => m('pcb', () => new THREE.MeshStandardMaterial({ color: '#1e5b3d', metalness: 0.15, roughness: 0.48 })),
  chip: () => m('chip', () => new THREE.MeshStandardMaterial({ color: '#16181b', metalness: 0.3, roughness: 0.35 })),
  oro: () => m('oro', () => new THREE.MeshStandardMaterial({ color: '#d6ad5c', metalness: 1, roughness: 0.28 })),
  madera: (c = '#b48a5e') => m(`madera${c}`, () => new THREE.MeshStandardMaterial({ color: c, metalness: 0, roughness: 0.62 })),
  laca: (c = '#f2f1ee') => m(`laca${c}`, () => new THREE.MeshPhysicalMaterial({ color: c, metalness: 0, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2 })),
  pintura: (c) => m(`pintura${c}`, () => new THREE.MeshPhysicalMaterial({ color: c, metalness: 0.55, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.04 })),
  esd: () => m('esd', () => new THREE.MeshStandardMaterial({ color: '#59606a', metalness: 0, roughness: 0.85 })),
  luz: (c) => m(`luz${c}`, () => new THREE.MeshBasicMaterial({ color: c, toneMapped: false })),
  cera: (c) => m(`cera${c}`, () => new THREE.MeshPhysicalMaterial({ color: c, metalness: 0, roughness: 0.55, sheen: 0.4 })),
  papel: () => m('papel', () => new THREE.MeshStandardMaterial({ color: '#f6f5f1', metalness: 0, roughness: 0.9 })),
  carton: () => m('carton', () => new THREE.MeshStandardMaterial({ color: '#c29a68', metalness: 0, roughness: 0.92 })),
};

// ---- primitivas -------------------------------------------------------------------------------
function caja(padre, [w, h, d], [x, y, z], material, { rot = null, radio } = {}) {
  const r = radio ?? Math.min(0.012, Math.min(w, h, d) * 0.22);
  const geo = r > 0.0008 ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d);
  const malla = new THREE.Mesh(geo, material);
  malla.position.set(x, y, z);
  if (rot) malla.rotation.set(...rot);
  malla.castShadow = true;
  malla.receiveShadow = true;
  padre.add(malla);
  return malla;
}

function cilindro(padre, radio, alto, [x, y, z], material, { rot = null, lados = 24, arriba } = {}) {
  const malla = new THREE.Mesh(new THREE.CylinderGeometry(arriba ?? radio, radio, alto, lados), material);
  malla.position.set(x, y, z);
  if (rot) malla.rotation.set(...rot);
  malla.castShadow = true;
  malla.receiveShadow = true;
  padre.add(malla);
  return malla;
}

// Pantalla: dibujo en canvas, emisiva pero no "neón" (y un vidrio encima que refleja).
function pantalla(padre, [w, h], [x, y, z], dibujar, { brillo = 0.95, resolucion = 512, rot = null, vidrio = true } = {}) {
  const lienzo = document.createElement('canvas');
  const aspecto = w / h;
  lienzo.width = Math.round(resolucion * Math.max(1, aspecto));
  lienzo.height = Math.round(resolucion * Math.max(1, 1 / aspecto));
  dibujar(lienzo.getContext('2d'), lienzo.width, lienzo.height);
  const t = new THREE.CanvasTexture(lienzo);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  const grupo = new THREE.Group();
  grupo.position.set(x, y, z);
  if (rot) grupo.rotation.set(...rot);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: brillo, roughness: 0.25 }));
  grupo.add(panel);
  if (vidrio) {
    const cristal = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.08, roughness: 0.02, metalness: 0, clearcoat: 1 }));
    cristal.position.z = 0.0008;
    grupo.add(cristal);
  }
  padre.add(grupo);
  return grupo;
}

const fuente = (px, peso = 700) => `${peso} ${px}px Inter, system-ui, sans-serif`;
const mono = (px) => `600 ${px}px ui-monospace, Consolas, monospace`;
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// Mesa de patas de acero (tapa, 4 patas, travesaño y estante bajo).
function mesa(g, { ancho, alto, fondo, tapa, patas = M.aceroPintado('#2f3339'), estante = true, z = null }) {
  const cz = z ?? fondo / 2 + 0.02;
  caja(g, [ancho, 0.035, fondo], [0, alto - 0.0175, cz], tapa, { radio: 0.006 });
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) caja(g, [0.04, alto - 0.035, 0.04], [sx * (ancho / 2 - 0.05), (alto - 0.035) / 2, cz + sz * (fondo / 2 - 0.05)], patas, { radio: 0.004 });
  if (estante) caja(g, [ancho - 0.1, 0.02, fondo - 0.1], [0, 0.16, cz], patas, { radio: 0.003 });
  return alto;
}

// Placa (PCB) con chips, zócalo y memorias: tamaño real de una ATX (30,5 × 24,4 cm).
function placaBase(padre, [x, y, z], { rot = [0, 0, 0], escala = 1 } = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.set(...rot);
  g.scale.setScalar(escala);
  caja(g, [0.305, 0.0016, 0.244], [0, 0.0008, 0], M.pcb(), { radio: 0 });
  caja(g, [0.05, 0.006, 0.05], [-0.04, 0.004, -0.03], M.acero(), { radio: 0.002 });
  caja(g, [0.04, 0.004, 0.04], [-0.04, 0.008, -0.03], M.chip(), { radio: 0.001 });
  for (let i = 0; i < 4; i++) caja(g, [0.006, 0.012, 0.13], [0.04 + i * 0.012, 0.006, -0.03], M.plastico(i % 2 ? '#1c1c1c' : '#2c3a4f'), { radio: 0.001 });
  caja(g, [0.03, 0.003, 0.03], [0.07, 0.003, 0.08], M.chip(), { radio: 0.001 });
  for (let i = 0; i < 3; i++) caja(g, [0.09, 0.008, 0.006], [-0.05, 0.004, 0.06 + i * 0.018], M.plastico('#1a1a1a'), { radio: 0.001 });
  for (let i = 0; i < 8; i++) cilindro(g, 0.0035, 0.008, [-0.12 + i * 0.011, 0.005, -0.1], M.aluminio(), { lados: 10 });
  caja(g, [0.012, 0.03, 0.15], [-0.146, 0.015, 0.0], M.acero(), { radio: 0.001 });
  padre.add(g);
  return g;
}

// Memoria RAM suelta.
function memoria(padre, [x, y, z], giro = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = giro;
  caja(g, [0.133, 0.001, 0.03], [0, 0.0005, 0], M.pcb(), { radio: 0 });
  for (let i = 0; i < 8; i++) caja(g, [0.01, 0.0012, 0.01], [-0.055 + i * 0.0155, 0.0015, 0.002], M.chip(), { radio: 0 });
  caja(g, [0.13, 0.0004, 0.003], [0, 0.0012, -0.0135], M.oro(), { radio: 0 });
  padre.add(g);
}

// Notebook abierta: base de aluminio con teclado, touchpad y tapa con pantalla.
function notebook(padre, { pos, giro = 0, abertura = 1.95, dibujar, color = M.aluminio() }) {
  const g = new THREE.Group();
  g.position.set(...pos);
  g.rotation.y = giro;
  const anchoN = 0.31;
  const fondoN = 0.215;
  caja(g, [anchoN, 0.014, fondoN], [0, 0.007, 0], color, { radio: 0.005 });
  // teclado dibujado (más liviano y más fino que cientos de cajitas)
  pantalla(
    g,
    [0.27, 0.11],
    [0, 0.0142, -0.03],
    (ctx, w, h) => {
      ctx.fillStyle = '#1a1b1e';
      ctx.fillRect(0, 0, w, h);
      const filas = 6;
      const cols = 15;
      for (let f = 0; f < filas; f++)
        for (let c = 0; c < cols; c++) {
          const kw = w / cols;
          const kh = h / filas;
          ctx.fillStyle = '#0c0d0f';
          rr(ctx, c * kw + 2, f * kh + 2, kw - 4, kh - 4, 4);
          ctx.fill();
        }
    },
    { brillo: 0, resolucion: 256, rot: [-Math.PI / 2, 0, 0], vidrio: false },
  );
  caja(g, [0.11, 0.0006, 0.068], [0, 0.0142, 0.06], M.plastico('#9ea3aa'), { radio: 0 });
  const tapa = new THREE.Group();
  tapa.position.set(0, 0.014, -fondoN / 2);
  tapa.rotation.x = -(Math.PI - abertura);
  g.add(tapa);
  const lado = new THREE.Group();
  lado.rotation.x = -Math.PI / 2;
  tapa.add(lado);
  caja(lado, [anchoN, fondoN, 0.006], [0, fondoN / 2, -0.003], color, { radio: 0.004 });
  caja(lado, [anchoN - 0.006, fondoN - 0.006, 0.0006], [0, fondoN / 2, 0.0003], M.plastico('#090a0c'), { radio: 0 });
  pantalla(lado, [0.285, 0.18], [0, fondoN / 2 + 0.004, 0.0009], dibujar, { brillo: 0.9, resolucion: 640 });
  padre.add(g);
  return g;
}

// Celular de tamaño real (7,5 × 15,5 cm) con pantalla dibujada.
function celular(padre, { pos, rot = [0, 0, 0], dibujar, cuerpo = M.grafito() }) {
  const g = new THREE.Group();
  g.position.set(...pos);
  g.rotation.set(...rot);
  caja(g, [0.075, 0.155, 0.008], [0, 0, 0], cuerpo, { radio: 0.0038 });
  caja(g, [0.071, 0.151, 0.0006], [0, 0, 0.0041], M.plastico('#050506'), { radio: 0 });
  pantalla(g, [0.068, 0.146], [0, 0, 0.0046], dibujar, { brillo: 0.95, resolucion: 420 });
  caja(g, [0.026, 0.026, 0.0016], [-0.018, 0.05, -0.0048], M.vidrioOscuro(), { radio: 0.005 });
  padre.add(g);
  return g;
}

// Soporte de acrílico para un celular.
function atril(padre, [x, y, z]) {
  caja(padre, [0.07, 0.004, 0.08], [x, y + 0.002, z], M.acrilico(), { radio: 0.002 });
  caja(padre, [0.07, 0.09, 0.004], [x, y + 0.045, z - 0.025], M.acrilico(), { rot: [-0.32, 0, 0], radio: 0.002 });
}

// ===== objetos ===================================================================================

// Laboratorio · "Placas madre": mesa antiestática de reparación, placa abierta, memorias, lupa.
export function placaReal() {
  const g = new THREE.Group();
  const alto = mesa(g, { ancho: 1.5, alto: 0.9, fondo: 0.72, tapa: M.aceroPintado('#c9ccd0') });
  caja(g, [1.3, 0.003, 0.55], [0, alto + 0.0015, 0.42], M.esd(), { radio: 0 });
  // segunda placa (dibujada) desarmada, memorias y un procesador
  placaBase(g, [0.3, alto + 0.003, 0.45], { rot: [0, 0.22, 0] });
  memoria(g, [0.08, alto + 0.003, 0.62], 0.3);
  memoria(g, [0.05, alto + 0.0045, 0.6], 0.42);
  caja(g, [0.04, 0.004, 0.04], [0.58, alto + 0.005, 0.62], M.chip(), { radio: 0.001 });
  caja(g, [0.035, 0.001, 0.035], [0.58, alto + 0.0075, 0.62], M.acero(), { radio: 0 });
  // bolsa antiestática y bandeja de tornillos
  caja(g, [0.2, 0.003, 0.28], [-0.62, alto + 0.004, 0.52], M.aceroPintado('#b8a9c2'), { rot: [0, 0.3, 0], radio: 0.001 });
  caja(g, [0.12, 0.018, 0.08], [0.6, alto + 0.009, 0.32], M.plastico('#d6d8db'), { radio: 0.004 });
  return {
    grupo: g,
    ancla: new THREE.Vector3(0, 1.7, 0.45),
    reales: [
      { id: 'circuit_board', x: -0.22, y: alto + 0.003, z: 0.38, giro: -0.12 },
      { id: 'magnifying_glass_01', x: -0.5, y: alto + 0.003, z: 0.32, giro: 0.4 },
      { id: 'desk_lamp_arm_01', x: 0.55, y: alto, z: 0.14, giro: -0.7 },
    ],
  };
}

// Laboratorio · "Instalación de equipos": PC con el lateral de vidrio abierto a la vista, CRT y teclado.
export function gabineteReal(acento) {
  const g = new THREE.Group();
  const alto = mesa(g, { ancho: 1.1, alto: 0.74, fondo: 0.62, tapa: M.madera('#8a6a48'), estante: false });
  // teclado y mouse
  caja(g, [0.44, 0.022, 0.14], [-0.12, alto + 0.011, 0.52], M.plastico('#d9d4c8'), { radio: 0.006 });
  for (let f = 0; f < 4; f++) caja(g, [0.4, 0.006, 0.022], [-0.12, alto + 0.024, 0.475 + f * 0.028], M.plastico('#c9c3b5'), { radio: 0.002 });
  caja(g, [0.06, 0.03, 0.1], [0.2, alto + 0.015, 0.52], M.plastico('#d9d4c8'), { radio: 0.014 });
  // monitor plano de 24" en pie, con el instalador del sistema en curso
  const monitor = new THREE.Group();
  monitor.position.set(-0.12, alto, 0.24);
  g.add(monitor);
  caja(monitor, [0.22, 0.012, 0.16], [0, 0.006, 0], M.aceroPintado('#2a2d33'), { radio: 0.004 });
  caja(monitor, [0.04, 0.2, 0.025], [0, 0.11, -0.03], M.aceroPintado('#2a2d33'), { radio: 0.006 });
  caja(monitor, [0.545, 0.33, 0.022], [0, 0.34, -0.012], M.plastico('#15171a'), { radio: 0.006 });
  pantalla(
    monitor,
    [0.525, 0.296],
    [0, 0.34, 0.0002],
    (ctx, w, h) => {
      const fondo = ctx.createLinearGradient(0, 0, w, h);
      fondo.addColorStop(0, '#0d2a4a');
      fondo.addColorStop(1, '#123e6b');
      ctx.fillStyle = fondo;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff';
      ctx.font = fuente(Math.round(h * 0.075), 700);
      ctx.fillText('Instalando el sistema', w * 0.08, h * 0.32);
      ctx.font = fuente(Math.round(h * 0.045), 500);
      ctx.fillStyle = '#b9d3f0';
      ctx.fillText('Copiando archivos · configurando drivers', w * 0.08, h * 0.42);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      rr(ctx, w * 0.08, h * 0.55, w * 0.84, h * 0.04, h * 0.02);
      ctx.fill();
      ctx.fillStyle = '#5ec2ff';
      rr(ctx, w * 0.08, h * 0.55, w * 0.84 * 0.64, h * 0.04, h * 0.02);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = fuente(Math.round(h * 0.05), 600);
      ctx.fillText('64 %', w * 0.08, h * 0.7);
      ctx.fillStyle = '#b9d3f0';
      ctx.font = mono(Math.round(h * 0.04));
      ctx.fillText('Puesto 07 · Laboratorio', w * 0.08, h * 0.88);
    },
    { resolucion: 512, brillo: 0.85 },
  );
  // gabinete (torre) en el piso, a la derecha: 21 × 46 × 45 cm, lateral de vidrio hacia el pasillo
  const torre = new THREE.Group();
  torre.position.set(0.42, 0, 0.32);
  torre.rotation.y = -Math.PI / 2;
  g.add(torre);
  caja(torre, [0.45, 0.46, 0.21], [0, 0.23, 0], M.grafito(), { radio: 0.008 });
  // interior visible (el lateral es de vidrio)
  const adentro = new THREE.Group();
  adentro.position.set(0, 0, 0.1);
  torre.add(adentro);
  placaBase(adentro, [-0.02, 0.24, -0.08], { rot: [Math.PI / 2, 0, 0], escala: 1.15 });
  caja(adentro, [0.27, 0.11, 0.045], [0.03, 0.17, -0.05], M.plastico('#15171a'), { radio: 0.006 });
  for (const dx of [-0.05, 0.08]) {
    cilindro(adentro, 0.04, 0.012, [0.03 + dx, 0.17, -0.024], M.plastico('#202226'), { rot: [Math.PI / 2, 0, 0], lados: 28 });
  }
  cilindro(adentro, 0.035, 0.07, [-0.06, 0.33, -0.05], M.aluminio(), { rot: [Math.PI / 2, 0, 0], lados: 28 });
  const ventiladores = [];
  for (const y of [0.13, 0.33]) {
    const aro = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.004, 10, 40), M.luz(acento));
    aro.position.set(0.19, y, -0.02);
    aro.rotation.y = Math.PI / 2;
    adentro.add(aro);
    const aspas = new THREE.Group();
    aspas.position.copy(aro.position);
    aspas.rotation.y = Math.PI / 2;
    for (let k = 0; k < 7; k++) caja(aspas, [0.018, 0.05, 0.002], [0, 0.026, 0], M.plastico('#2a2d31'), { rot: [0, 0, (k * Math.PI * 2) / 7], radio: 0 });
    adentro.add(aspas);
    ventiladores.push(aspas);
  }
  caja(torre, [0.43, 0.44, 0.004], [0, 0.23, 0.106], M.vidrio(), { radio: 0.004 });
  // botón de encendido y LED
  cilindro(torre, 0.007, 0.004, [-0.226, 0.42, 0.05], M.luz('#7cc4ff'), { rot: [0, 0, Math.PI / 2], lados: 16 });
  return {
    grupo: g,
    ancla: new THREE.Vector3(0, 1.5, 0.4),
    animar: (t) => ventiladores.forEach((v, i) => (v.rotation.x = t * (9 + i * 2))),
  };
}

// Freelance · "JustPhones": mesa de exhibición con tres celulares en atriles.
export function celularReal() {
  const g = new THREE.Group();
  const alto = 0.9;
  caja(g, [1.0, alto, 0.5], [0, alto / 2, 0.27], M.laca('#f1efea'), { radio: 0.01 });
  caja(g, [1.04, 0.025, 0.54], [0, alto + 0.0125, 0.27], M.madera('#c49a6c'), { radio: 0.006 });
  const chat = (ctx, w, h) => {
    ctx.fillStyle = '#0b141a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1f2c34';
    ctx.fillRect(0, 0, w, h * 0.12);
    ctx.fillStyle = '#2fd46b';
    ctx.beginPath();
    ctx.arc(w * 0.12, h * 0.06, w * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e9edef';
    ctx.font = fuente(Math.round(w * 0.07));
    ctx.fillText('JustPhones', w * 0.22, h * 0.072);
    const burbuja = (y, texto, mia) => {
      ctx.font = fuente(Math.round(w * 0.055), 500);
      const ancho = Math.min(w * 0.82, ctx.measureText(texto).width + w * 0.08);
      const x = mia ? w - ancho - w * 0.04 : w * 0.04;
      ctx.fillStyle = mia ? '#005c4b' : '#1f2c34';
      rr(ctx, x, y, ancho, h * 0.055, 10);
      ctx.fill();
      ctx.fillStyle = '#e9edef';
      ctx.fillText(texto, x + w * 0.04, y + h * 0.037);
    };
    burbuja(h * 0.17, 'Hola! Quiero este', false);
    burbuja(h * 0.24, 'iPhone 13 · 128 GB', false);
    burbuja(h * 0.33, 'Pedido recibido ✓', true);
    burbuja(h * 0.4, 'Te lo llevamos hoy', true);
    burbuja(h * 0.5, 'Genial, gracias!', false);
  };
  const bloqueo = (a, b) => (ctx, w, h) => {
    const gr = ctx.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, a);
    gr.addColorStop(1, b);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.textAlign = 'center';
    ctx.font = fuente(Math.round(w * 0.22), 300);
    ctx.fillText('10:41', w / 2, h * 0.24);
    ctx.font = fuente(Math.round(w * 0.06), 500);
    ctx.fillText('jueves 14 de noviembre', w / 2, h * 0.3);
  };
  const ubicaciones = [
    [-0.28, bloqueo('#3b2a6e', '#d9608a'), M.aluminio()],
    [0, chat, M.grafito()],
    [0.28, bloqueo('#0f4c5c', '#7fd1ae'), M.pintura('#d8c3a5')],
  ];
  for (const [x, dibujo, cuerpo] of ubicaciones) {
    atril(g, [x, alto + 0.025, 0.3]);
    celular(g, { pos: [x, alto + 0.025 + 0.085, 0.29], rot: [-0.32, 0, 0], dibujar: dibujo, cuerpo });
  }
  // cajas de productos
  for (const [x, c] of [
    [-0.4, '#f3f3f1'],
    [0.42, '#1c1c1e'],
  ])
    caja(g, [0.09, 0.05, 0.17], [x, alto + 0.05, 0.12], M.laca(c), { radio: 0.003 });
  return { grupo: g, ancla: new THREE.Vector3(0, 1.35, 0.3) };
}

// Freelance · tiendas con Mercado Pago: mostrador con posnet, tarjeta, ticket y velas.
export function pagoReal() {
  const g = new THREE.Group();
  const alto = 0.95;
  caja(g, [1.2, alto - 0.03, 0.5], [0, (alto - 0.03) / 2, 0.27], M.laca('#ece6dc'), { radio: 0.01 });
  caja(g, [1.24, 0.03, 0.56], [0, alto - 0.015, 0.29], M.madera('#d2b48c'), { radio: 0.006 });
  // posnet (7,5 × 17 cm) inclinado, con la pantalla de pago aprobado
  const pos = new THREE.Group();
  pos.position.set(0.08, alto + 0.02, 0.38);
  pos.rotation.set(-0.35, -0.25, 0);
  g.add(pos);
  caja(pos, [0.078, 0.035, 0.17], [0, 0, 0], M.plastico('#202226'), { radio: 0.008 });
  pantalla(
    pos,
    [0.062, 0.052],
    [0, 0.0177, -0.04],
    (ctx, w, h) => {
      ctx.fillStyle = '#00a3e0';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = fuente(Math.round(h * 0.42), 800);
      ctx.fillText('✓', w / 2, h * 0.5);
      ctx.font = fuente(Math.round(h * 0.13), 700);
      ctx.fillText('Pago aprobado', w / 2, h * 0.75);
      ctx.font = fuente(Math.round(h * 0.1), 500);
      ctx.fillText('$ 18.500', w / 2, h * 0.9);
    },
    { rot: [-Math.PI / 2, 0, 0], resolucion: 256 },
  );
  for (let f = 0; f < 4; f++) for (let c = 0; c < 3; c++) caja(pos, [0.016, 0.004, 0.012], [-0.02 + c * 0.02, 0.019, 0.02 + f * 0.016], M.plastico('#3a3d42'), { radio: 0.002 });
  // ticket saliendo
  caja(g, [0.055, 0.0008, 0.12], [0.08, alto + 0.002, 0.2], M.papel(), { rot: [0, -0.25, 0], radio: 0 });
  // tarjeta (8,56 × 5,4 cm)
  caja(g, [0.0856, 0.0008, 0.054], [-0.08, alto + 0.0005, 0.42], M.pintura('#1f3c88'), { rot: [0, 0.4, 0], radio: 0.0004 });
  caja(g, [0.012, 0.0004, 0.01], [-0.09, alto + 0.0012, 0.425], M.oro(), { rot: [0, 0.4, 0], radio: 0 });
  // velas aromáticas en frascos de vidrio
  const ceras = ['#f3d9c9', '#e9e1f4', '#dcefe2'];
  ceras.forEach((c, i) => {
    const x = -0.42 + i * 0.1;
    cilindro(g, 0.038, 0.09, [x, alto + 0.045, 0.3], M.vidrio(), { lados: 32 });
    cilindro(g, 0.035, 0.07, [x, alto + 0.036, 0.3], M.cera(c), { lados: 32 });
    cilindro(g, 0.0012, 0.012, [x, alto + 0.077, 0.3], M.plastico('#222'), { lados: 6 });
  });
  // bolsa de regalo
  caja(g, [0.18, 0.22, 0.08], [0.45, alto + 0.11, 0.25], M.papel(), { radio: 0.002 });
  return { grupo: g, ancla: new THREE.Vector3(0, 1.45, 0.3) };
}

// Freelance · "Asistente con IA": escritorio con la notebook mostrando el chat del asistente.
export function iaReal(acento) {
  const g = new THREE.Group();
  const alto = mesa(g, { ancho: 1.05, alto: 0.74, fondo: 0.58, tapa: M.laca('#f4f3ef'), patas: M.aceroPintado('#d7d9dc'), estante: false });
  notebook(g, {
    pos: [-0.05, alto, 0.33],
    giro: 0.08,
    dibujar: (ctx, w, h) => {
      ctx.fillStyle = '#0f1115';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#171a21';
      ctx.fillRect(0, 0, w * 0.24, h);
      ctx.fillStyle = '#e8eaf0';
      ctx.font = fuente(Math.round(h * 0.055), 700);
      ctx.fillText('Asistente APS', w * 0.03, h * 0.09);
      ['Hipertensión', 'Diabetes tipo 2', 'Vacunación', 'Control prenatal'].forEach((t, i) => {
        ctx.fillStyle = i === 1 ? '#2a2f3b' : 'transparent';
        rr(ctx, w * 0.02, h * (0.16 + i * 0.08), w * 0.2, h * 0.065, 6);
        ctx.fill();
        ctx.fillStyle = '#aab0bd';
        ctx.font = fuente(Math.round(h * 0.035), 500);
        ctx.fillText(t, w * 0.035, h * (0.2 + i * 0.08));
      });
      const burbuja = (y, alto2, texto, mia) => {
        ctx.font = fuente(Math.round(h * 0.036), 500);
        const ancho = w * (mia ? 0.42 : 0.6);
        const x = mia ? w * 0.95 - ancho : w * 0.28;
        ctx.fillStyle = mia ? acento : '#1e222b';
        rr(ctx, x, y, ancho, alto2, 12);
        ctx.fill();
        ctx.fillStyle = mia ? '#0b0d12' : '#dfe3ea';
        texto.forEach((l, k) => ctx.fillText(l, x + w * 0.02, y + h * 0.05 + k * h * 0.05));
      };
      burbuja(h * 0.1, h * 0.09, ['¿Cuál es la meta de presión en', 'un paciente con diabetes?'], true);
      burbuja(h * 0.24, h * 0.24, ['Para la mayoría, < 130/80 mmHg.', 'Primero cambios de estilo de vida;', 'si no alcanza, sumar IECA o ARA II.', '¿Querés un caso práctico?'], false);
      ctx.fillStyle = '#1e222b';
      rr(ctx, w * 0.28, h * 0.84, w * 0.67, h * 0.09, 14);
      ctx.fill();
      ctx.fillStyle = '#7c8394';
      ctx.font = fuente(Math.round(h * 0.035), 500);
      ctx.fillText('Escribí tu consulta…', w * 0.3, h * 0.895);
    },
  });
  // taza y anotador
  cilindro(g, 0.04, 0.095, [0.36, alto + 0.0475, 0.32], M.laca('#2f3a4a'), { lados: 32 });
  const asa = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.007, 10, 24, Math.PI), M.laca('#2f3a4a'));
  asa.position.set(0.4, alto + 0.05, 0.32);
  asa.rotation.z = -Math.PI / 2;
  g.add(asa);
  caja(g, [0.15, 0.012, 0.21], [0.32, alto + 0.006, 0.12], M.papel(), { rot: [0, -0.2, 0], radio: 0.003 });
  // el asistente, como holograma sobre la mesa: un núcleo que late dentro de una malla de facetas,
  // dos anillos que giran y una columna de luz que sale de la notebook
  const holo = new THREE.Group();
  holo.position.set(-0.05, alto + 0.62, 0.3);
  const luzAcento = (opacidad) =>
    new THREE.MeshBasicMaterial({ color: new THREE.Color(acento).multiplyScalar(1.8), transparent: true, opacity: opacidad, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const nucleo = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 3), luzAcento(0.95));
  holo.add(nucleo);
  const facetas = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(0.17, 1)), new THREE.LineBasicMaterial({ color: new THREE.Color(acento).multiplyScalar(1.6), transparent: true, opacity: 0.8, toneMapped: false }));
  holo.add(facetas);
  const anillos = [0.26, 0.32].map((r, k) => {
    const anillo = new THREE.Mesh(new THREE.TorusGeometry(r, 0.004, 8, 96), luzAcento(0.85));
    anillo.rotation.set(Math.PI / 2 + (k ? 0.5 : -0.35), k ? 0.3 : -0.2, 0);
    holo.add(anillo);
    return anillo;
  });
  const haz = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.2, 0.5, 32, 1, true), luzAcento(0.12));
  haz.position.y = -0.33;
  holo.add(haz);
  g.add(holo);
  const animar = (t) => {
    nucleo.scale.setScalar(1 + Math.sin(t * 2.4) * 0.12);
    facetas.rotation.set(t * 0.3, t * 0.45, 0);
    anillos[0].rotation.z = t * 0.8;
    anillos[1].rotation.z = -t * 0.55;
    holo.position.y = alto + 0.62 + Math.sin(t * 1.2) * 0.02;
  };
  return { grupo: g, ancla: new THREE.Vector3(0, 1.3, 0.35), animar };
}

// Freelance · "Neifert Automotores": auto a escala 1:18 en una vitrina de acrílico sobre pedestal.
export function autoReal() {
  const g = new THREE.Group();
  const alto = 1.0;
  caja(g, [0.42, alto, 0.42], [0, alto / 2, 0.25], M.laca('#1b1c1f'), { radio: 0.008 });
  // carrocería: silueta lateral extruida con bisel
  const perfil = new THREE.Shape();
  perfil.moveTo(0.006, 0.012);
  perfil.lineTo(0.0, 0.03);
  perfil.quadraticCurveTo(0.0, 0.043, 0.02, 0.045);
  perfil.lineTo(0.062, 0.048);
  perfil.lineTo(0.094, 0.069);
  perfil.lineTo(0.148, 0.07);
  perfil.lineTo(0.184, 0.051);
  perfil.quadraticCurveTo(0.236, 0.046, 0.248, 0.036);
  perfil.lineTo(0.25, 0.02);
  perfil.lineTo(0.246, 0.012);
  perfil.lineTo(0.222, 0.012);
  perfil.absarc(0.198, 0.012, 0.024, 0, Math.PI, false);
  perfil.lineTo(0.076, 0.012);
  perfil.absarc(0.052, 0.012, 0.024, 0, Math.PI, false);
  perfil.lineTo(0.006, 0.012);
  const carro = new THREE.Group();
  carro.position.set(0, alto + 0.012, 0.25);
  carro.rotation.y = 0.55;
  g.add(carro);
  const cuerpo = new THREE.ExtrudeGeometry(perfil, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 4, curveSegments: 18 });
  cuerpo.translate(-0.125, 0, -0.05);
  const chapa = new THREE.Mesh(cuerpo, M.pintura('#a3101e'));
  chapa.castShadow = true;
  carro.add(chapa);
  const ventana = new THREE.Shape();
  ventana.moveTo(0.068, 0.05);
  ventana.lineTo(0.096, 0.066);
  ventana.lineTo(0.146, 0.067);
  ventana.lineTo(0.177, 0.052);
  ventana.lineTo(0.068, 0.05);
  const vidrios = new THREE.ExtrudeGeometry(ventana, { depth: 0.116, bevelEnabled: false });
  vidrios.translate(-0.125, 0.001, -0.058);
  carro.add(new THREE.Mesh(vidrios, M.vidrioOscuro()));
  for (const x of [-0.073, 0.073])
    for (const z of [-0.052, 0.052]) {
      cilindro(carro, 0.02, 0.016, [x, 0.02, z], M.goma(), { rot: [Math.PI / 2, 0, 0], lados: 32 });
      cilindro(carro, 0.012, 0.017, [x, 0.02, z], M.aluminio(), { rot: [Math.PI / 2, 0, 0], lados: 24 });
    }
  for (const z of [-0.032, 0.032]) {
    caja(carro, [0.004, 0.008, 0.02], [0.127, 0.032, z], M.luz('#fff4d6'), { radio: 0 });
    caja(carro, [0.004, 0.007, 0.022], [-0.127, 0.036, z], M.luz('#ff2a2a'), { radio: 0 });
  }
  // vitrina y base espejada
  caja(g, [0.34, 0.006, 0.34], [0, alto + 0.003, 0.25], M.aluminio(), { radio: 0.002 });
  caja(g, [0.34, 0.16, 0.34], [0, alto + 0.086, 0.25], M.acrilico(), { radio: 0.004 });
  // llave del auto
  caja(g, [0.02, 0.008, 0.045], [0.14, alto + 0.004, 0.42], M.plastico('#111'), { rot: [0, 0.5, 0], radio: 0.004 });
  return { grupo: g, ancla: new THREE.Vector3(0, 1.45, 0.25) };
}

// Técnico · "PCs y notebooks": mesa de reparación con una notebook en diagnóstico y otra abierta por abajo.
export function notebookReal() {
  const g = new THREE.Group();
  const alto = mesa(g, { ancho: 1.3, alto: 0.78, fondo: 0.66, tapa: M.madera('#6f5038') });
  caja(g, [1.1, 0.003, 0.5], [0, alto + 0.0015, 0.38], M.esd(), { radio: 0 });
  notebook(g, {
    pos: [-0.3, alto + 0.003, 0.36],
    giro: 0.12,
    color: M.grafito(),
    dibujar: (ctx, w, h) => {
      ctx.fillStyle = '#0a2a6b';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fff';
      ctx.font = fuente(Math.round(h * 0.07), 700);
      ctx.fillText('Diagnóstico de hardware', w * 0.05, h * 0.12);
      const filas = [
        ['CPU', 'OK', '#5dff9a'],
        ['Memoria', 'OK', '#5dff9a'],
        ['Disco', 'SMART 87%', '#ffd166'],
        ['Batería', 'reemplazar', '#ff6b6b'],
        ['Temperatura', '48 °C', '#5dff9a'],
      ];
      filas.forEach(([a, b, c], i) => {
        ctx.font = mono(Math.round(h * 0.05));
        ctx.fillStyle = '#c9d6ff';
        ctx.fillText(a, w * 0.06, h * (0.27 + i * 0.12));
        ctx.fillStyle = c;
        ctx.fillText(b, w * 0.6, h * (0.27 + i * 0.12));
      });
    },
  });
  // notebook dada vuelta y abierta: tapa inferior al costado y placa a la vista
  const abierta = new THREE.Group();
  abierta.position.set(0.28, alto + 0.003, 0.4);
  abierta.rotation.y = -0.2;
  g.add(abierta);
  caja(abierta, [0.33, 0.018, 0.23], [0, 0.009, 0], M.grafito(), { radio: 0.006 });
  placaBase(abierta, [0.02, 0.018, -0.01], { escala: 0.8 });
  caja(abierta, [0.12, 0.01, 0.07], [-0.1, 0.022, 0.07], M.plastico('#111'), { radio: 0.002 });
  caja(g, [0.33, 0.004, 0.23], [0.42, alto + 0.005, 0.18], M.grafito(), { rot: [0, 0.35, 0], radio: 0.003 });
  // destornilladores de precisión
  for (let i = 0; i < 4; i++) {
    cilindro(g, 0.006, 0.08, [0.05 + i * 0.022, alto + 0.009, 0.6], M.plastico(['#d62828', '#1d3557', '#f4a261', '#2a9d8f'][i]), { rot: [Math.PI / 2, 0, 0.1], lados: 12 });
    cilindro(g, 0.0015, 0.05, [0.05 + i * 0.022, alto + 0.009, 0.535], M.acero(), { rot: [Math.PI / 2, 0, 0.1], lados: 8 });
  }
  return { grupo: g, ancla: new THREE.Vector3(0, 1.35, 0.4) };
}

// Técnico · "Impresoras": láser de oficina sobre un mueble bajo, con resma y hojas impresas.
export function impresoraReal() {
  const g = new THREE.Group();
  const alto = 0.62;
  caja(g, [0.8, alto, 0.5], [0, alto / 2, 0.27], M.aceroPintado('#5c6470'), { radio: 0.008 });
  const imp = new THREE.Group();
  imp.position.set(-0.05, alto, 0.27);
  g.add(imp);
  caja(imp, [0.42, 0.25, 0.4], [0, 0.125, 0], M.plastico('#e4e5e2'), { radio: 0.02 });
  caja(imp, [0.42, 0.1, 0.4], [0, 0.25 + 0.05, -0.02], M.plastico('#d6d7d4'), { radio: 0.02 });
  // bandeja de salida con hojas, cassette de papel y panel
  caja(imp, [0.3, 0.004, 0.18], [0, 0.352, -0.02], M.plastico('#2a2c30'), { radio: 0.002 });
  for (let i = 0; i < 6; i++) caja(imp, [0.21, 0.0006, 0.297], [0, 0.355 + i * 0.0008, -0.04], M.papel(), { rot: [0, (i - 3) * 0.02, 0], radio: 0 });
  caja(imp, [0.38, 0.07, 0.012], [0, 0.04, 0.2], M.plastico('#cfd0cd'), { radio: 0.004 });
  caja(imp, [0.12, 0.014, 0.008], [0, 0.04, 0.208], M.plastico('#8d9095'), { radio: 0.003 });
  pantalla(
    imp,
    [0.07, 0.03],
    [0.13, 0.27, 0.202],
    (ctx, w, h) => {
      ctx.fillStyle = '#9fd4ff';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#0a2238';
      ctx.font = fuente(Math.round(h * 0.36), 700);
      ctx.fillText('Listo', w * 0.08, h * 0.62);
    },
    { resolucion: 128, brillo: 0.6 },
  );
  const led = caja(imp, [0.008, 0.008, 0.004], [0.18, 0.225, 0.201], M.luz('#ff9b3d'), { radio: 0 });
  // resma
  caja(g, [0.215, 0.05, 0.3], [0.28, alto + 0.025, 0.25], M.papel(), { radio: 0.002 });
  caja(g, [0.216, 0.03, 0.301], [0.28, alto + 0.036, 0.25], M.laca('#2e6fbf'), { radio: 0.002 });
  return { grupo: g, ancla: new THREE.Vector3(0, 1.3, 0.3), animar: (t) => (led.visible = Math.sin(t * 3.2) > 0) };
}

export function liberarObjetos() {
  for (const material of cache.values()) material.dispose();
  cache.clear();
}
