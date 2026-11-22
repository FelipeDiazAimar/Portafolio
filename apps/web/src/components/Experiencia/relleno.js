// Relleno maximalista de los pasillos, con objetos reales y objetos generados.
//
// 1. Objetos reales: modelos escaneados de Poly Haven (data/pasilloAssets.js). Cada pasillo tiene
//    los suyos (ninguno se repite entre pasillos) y dentro del pasillo cada uno aparece UNA vez.
//    Acá sólo se decide dónde va cada uno (con sus medidas reales, public/pasillo/indice.json);
//    EscenaPasillo los carga y los pone cuando llegan.
// 2. Estructura y relleno generado: estanterías, muebles y cosas chicas (libros, frascos, cajas,
//    botellas...) con materiales PBR (madera/metal con texturas reales, cartón, papel, vidrio) y
//    etiquetas únicas de un atlas por temática (atlas.js). Cada temática tiene SUS tipos de
//    objetos: no hay funciones de relleno compartidas entre pasillos.
//
// Las piezas generadas se pintan con color por vértice y se unen en una malla por material, así
// el costo de dibujo no depende de cuántas haya.
//
// Coordenadas: las del grupo del pasillo (x a lo ancho, -z hacia adelante, ver EscenaPasillo).
// Contra una pared se trabaja con un "pintor": u = a lo largo de la pared, p = distancia a la
// pared, y = altura.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { ALTO, ANCHO, ANTESALA } from '@/lib/pasillo.js';
import { AMBIENTES } from '@/data/pasilloAssets.js';
import indice from '../../../public/pasillo/indice.json';
import { CELDAS, crearAtlas, rectCelda } from './atlas.js';

const W2 = ANCHO / 2;
const TECHO = ALTO - 0.04;

// Lo que ocupa cada objeto con tooltip sobre su pared: [ancho a lo largo, y mínima, y máxima].
// Ahí no se pone relleno, salvo un mueble bajo debajo (si cuelga de la pared) y estantes arriba.
export const HUECOS = {
  placa: [1.7, 0, 1.75],
  banco: [2.1, 0, 1.25],
  gabinete: [1.3, 0, 1.3],
  pizarron: [2.3, 0.95, 2.32],
  diagrama: [1.7, 0.98, 2.32],
  pupitres: [2.1, 0, 0.85],
  libros: [1.4, 0, 2.05],
  celular: [1.1, 0, 1.15],
  pago: [1.3, 0, 1.3],
  robot: [1.15, 0, 1.3],
  auto: [0.55, 0, 1.2],
  notebook: [1.4, 0, 1.25],
  impresora: [0.9, 0, 1.05],
  monitor: [1.8, 1.18, 2.22],
  balanza: [1.4, 0, 1.5],
  cajas: [3.7, 0, 1.2],
  tablero: [2.4, 1.12, 2.32],
  rack: [0.8, 0, 2.12],
  equipo: [2.0, 0, 2.28],
};

// Medidas reales [ancho, alto, fondo] en metros, o null si el modelo no está descargado.
export const medida = (id) => indice.modelos?.[id]?.medidas ?? null;

// ---- azar con semilla -------------------------------------------------------------------------
function azar(semilla) {
  let a = semilla >>> 0;
  const f = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.entre = (a0, b0) => a0 + f() * (b0 - a0);
  f.de = (lista) => lista[Math.floor(f() * lista.length)];
  f.si = (p) => f() < p;
  f.mezclar = (lista) => {
    const copia = [...lista];
    for (let i = copia.length - 1; i > 0; i--) {
      const j = Math.floor(f() * (i + 1));
      [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
  };
  return f;
}

// ---- materiales -------------------------------------------------------------------------------
// Texturas de "materia" compartidas (cartón kraft, papel): no son objetos, son superficies.
let texturasBase = null;
function lienzoTextura(tam, dibujar) {
  const l = document.createElement('canvas');
  l.width = tam;
  l.height = tam;
  dibujar(l.getContext('2d'), tam);
  const t = new THREE.CanvasTexture(l);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function crearTexturasBase() {
  const r = azar(99);
  const fibras = (ctx, t, n, alfa) => {
    for (let i = 0; i < n; i++) {
      ctx.strokeStyle = `rgba(${r() > 0.5 ? 255 : 60},${r() > 0.5 ? 230 : 40},${r() > 0.5 ? 200 : 20},${alfa * r()})`;
      ctx.lineWidth = 0.6 + r();
      ctx.beginPath();
      const x = r() * t;
      const y = r() * t;
      ctx.moveTo(x, y);
      ctx.lineTo(x + (r() - 0.5) * 14, y + (r() - 0.5) * 14);
      ctx.stroke();
    }
  };
  return {
    carton: lienzoTextura(512, (ctx, t) => {
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(0, 0, t, t);
      fibras(ctx, t, 9000, 0.18);
      // corrugado apenas visible
      for (let y = 0; y < t; y += 9) {
        ctx.fillStyle = 'rgba(0,0,0,0.035)';
        ctx.fillRect(0, y, t, 4);
      }
    }),
    papel: lienzoTextura(256, (ctx, t) => {
      ctx.fillStyle = '#f2f2f2';
      ctx.fillRect(0, 0, t, t);
      fibras(ctx, t, 2500, 0.06);
      for (let y = 0; y < t; y += 3) {
        ctx.fillStyle = `rgba(0,0,0,${0.02 + r() * 0.02})`;
        ctx.fillRect(0, y, t, 1);
      }
    }),
  };
}

// Materiales de un pasillo. `alta`: equipos con margen (el vidrio es algo más transparente).
export function crearMaterialesPasillo(id, recursos, { alta = true } = {}) {
  texturasBase ??= crearTexturasBase();
  const tex = AMBIENTES[id]?.texturas ?? AMBIENTES.laboratorio.texturas;
  const atlas = crearAtlas(id);
  return {
    estructura: recursos.materialPBR(tex.estante, { vertexColors: true }),
    carton: new THREE.MeshStandardMaterial({ vertexColors: true, map: texturasBase.carton, roughness: 0.92 }),
    papel: new THREE.MeshStandardMaterial({ vertexColors: true, map: texturasBase.papel, roughness: 0.88 }),
    plastico: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0 }),
    metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.9 }),
    espejo: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.04, metalness: 1 }),
    // vidrio sin transmisión (la transmisión redibuja la escena entera en cada cuadro)
    vidrio: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.06, metalness: 0.1, transparent: true, opacity: alta ? 0.35 : 0.55, depthWrite: false }),
    tela: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
    etiqueta: new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.62 }),
    brillo: new THREE.MeshBasicMaterial({ vertexColors: true }),
    atlas,
  };
}

// Escala de las UV proyectadas (metros por repetición de textura) según el material.
const ESCALA_UV = { estructura: 1.1, carton: 0.45, papel: 0.25 };

// ---- lote: junta piezas por material y las une -----------------------------------------------
const EJE_Y = new THREE.Vector3(0, 1, 0);
const colorTmp = new THREE.Color();
const vTmp = new THREE.Vector3();

class Lote {
  constructor() {
    this.grupos = new Map(); // material -> [geometrías]
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.ql = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.pos = new THREE.Vector3();
    this.esc = new THREE.Vector3(1, 1, 1);
    this.rect = null;
  }

  agregar(geoOriginal, hex, x, y, z, { giro = 0, rx = 0, ry = 0, rz = 0, mat = 'plastico', rect = null } = {}) {
    // todas sin índice: mergeGeometries no une geometrías indexadas con no indexadas
    // (RoundedBoxGeometry no tiene índice; Box/Cylinder/Sphere sí)
    const geo = geoOriginal.index ? geoOriginal.toNonIndexed() : geoOriginal;
    if (geo !== geoOriginal) geoOriginal.dispose();
    colorTmp.set(hex);
    const n = geo.attributes.position.count;
    const datos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      datos[i * 3] = colorTmp.r;
      datos[i * 3 + 1] = colorTmp.g;
      datos[i * 3 + 2] = colorTmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(datos, 3));
    this.q.setFromAxisAngle(EJE_Y, giro);
    this.ql.setFromEuler(this.e.set(rx, ry, rz));
    this.q.multiply(this.ql);
    this.m.compose(this.pos.set(x, y, z), this.q, this.esc);
    geo.applyMatrix4(this.m);
    const uv = geo.attributes.uv;
    if (rect) {
      // etiqueta: la cara se mapea a una celda del atlas
      for (let i = 0; i < uv.count; i++) uv.setXY(i, rect[0] + uv.getX(i) * (rect[2] - rect[0]), rect[1] + uv.getY(i) * (rect[3] - rect[1]));
    } else {
      // UV proyectadas por la cara dominante, en metros: la textura no se estira con el tamaño
      const escala = ESCALA_UV[mat] ?? 1;
      const pos = geo.attributes.position;
      const nor = geo.attributes.normal;
      for (let i = 0; i < uv.count; i++) {
        vTmp.fromBufferAttribute(nor, i);
        const ax = Math.abs(vTmp.x);
        const ay = Math.abs(vTmp.y);
        const az = Math.abs(vTmp.z);
        const px = pos.getX(i);
        const py = pos.getY(i);
        const pz = pos.getZ(i);
        if (ay >= ax && ay >= az) uv.setXY(i, px / escala, pz / escala);
        else if (ax >= az) uv.setXY(i, pz / escala, py / escala);
        else uv.setXY(i, px / escala, py / escala);
      }
    }
    if (!this.grupos.has(mat)) this.grupos.set(mat, []);
    this.grupos.get(mat).push(geo);
  }

  caja(w, h, d, x, y, z, hex, o = {}) {
    const g = o.redondeo ? new RoundedBoxGeometry(w, h, d, 2, Math.min(o.redondeo, w / 2.1, h / 2.1, d / 2.1)) : new THREE.BoxGeometry(w, h, d);
    this.agregar(g, hex, x, y, z, o);
  }

  cil(rArriba, rAbajo, h, x, y, z, hex, o = {}) {
    this.agregar(new THREE.CylinderGeometry(rArriba, rAbajo, h, o.lados ?? 14), hex, x, y, z, o);
  }

  esfera(r, x, y, z, hex, o = {}) {
    const g = new THREE.SphereGeometry(r, o.lados ?? 12, Math.max(6, Math.round((o.lados ?? 12) * 0.7)));
    if (o.aplastar) g.scale(1, o.aplastar, 1);
    this.agregar(g, hex, x, y, z, o);
  }

  toro(r, tubo, x, y, z, hex, o = {}) {
    this.agregar(new THREE.TorusGeometry(r, tubo, 8, o.lados ?? 18, o.arco ?? Math.PI * 2), hex, x, y, z, o);
  }

  // pieza de torno: `perfil` = [[radio, altura], ...] desde la base
  torno(perfil, x, y, z, hex, o = {}) {
    this.agregar(new THREE.LatheGeometry(perfil.map(([a, b]) => new THREE.Vector2(a, b)), o.lados ?? 20), hex, x, y, z, o);
  }

  // lámina con una celda del atlas
  plano(w, h, x, y, z, celda, o = {}) {
    this.agregar(new THREE.PlaneGeometry(w, h), '#ffffff', x, y, z, { ...o, mat: 'etiqueta', rect: rectCelda(celda) });
  }

  construir(materiales) {
    const grupo = new THREE.Group();
    for (const [mat, lista] of this.grupos) {
      const unida = mergeGeometries(lista, false);
      for (const g of lista) g.dispose();
      if (!unida) continue;
      const malla = new THREE.Mesh(unida, materiales[mat] ?? materiales.plastico);
      malla.castShadow = mat !== 'brillo' && mat !== 'etiqueta' && mat !== 'vidrio';
      malla.receiveShadow = mat !== 'brillo';
      grupo.add(malla);
    }
    this.grupos.clear();
    return grupo;
  }
}

// Pintor sobre una pared: origen (ox, oz), dirección a lo largo (tx, tz) y normal hacia adentro
// (nx, nz). Las piezas quedan con su +z local mirando al pasillo (para etiquetas y modelos).
function pintor(lote, ox, oz, tx, tz, nx, nz) {
  const giro = Math.atan2(nx, nz);
  const xz = (u, p) => [ox + tx * u + nx * p, oz + tz * u + nz * p];
  return {
    giro,
    xz,
    // u, p: centro a lo largo y de fondo; y: base. ancho a lo largo, fondo hacia el pasillo.
    caja(u, y, p, ancho, alto, fondo, hex, o = {}) {
      const [x, z] = xz(u, p);
      lote.caja(ancho, alto, fondo, x, y + alto / 2, z, hex, { ...o, giro });
    },
    cil(u, y, p, r, alto, hex, o = {}) {
      const [x, z] = xz(u, p);
      lote.cil(o.rArriba ?? r, r, alto, x, y + alto / 2, z, hex, { ...o, giro });
    },
    // y: centro
    esfera(u, y, p, r, hex, o = {}) {
      const [x, z] = xz(u, p);
      lote.esfera(r, x, y, z, hex, { ...o, giro });
    },
    // pieza de torno parada en (u, y, p)
    torno(u, y, p, perfil, hex, o = {}) {
      const [x, z] = xz(u, p);
      lote.torno(perfil, x, y, z, hex, { ...o, giro });
    },
    // anillo de cara al pasillo (y: centro)
    toro(u, y, p, r, tubo, hex, o = {}) {
      const [x, z] = xz(u, p);
      lote.toro(r, tubo, x, y, z, hex, { ...o, giro });
    },
    // etiqueta de cara al pasillo; y: base
    etiqueta(u, y, p, ancho, alto, celda, o = {}) {
      const [x, z] = xz(u, p);
      lote.plano(ancho, alto, x, y + alto / 2, z, celda, { ...o, giro });
    },
  };
}

// Celdas del atlas sin repetir dentro de un pasillo (rotan recién cuando se agotan las 64).
function contadorCeldas(r) {
  let orden = r.mezclar(Array.from({ length: CELDAS * CELDAS }, (_, i) => i));
  let i = 0;
  return (filtro) => {
    for (let intento = 0; intento < orden.length; intento++) {
      const c = orden[i++ % orden.length];
      if (i % orden.length === 0) orden = r.mezclar(orden);
      if (!filtro || filtro(c)) return c;
    }
    return orden[0];
  };
}

// ===== objetos generados, por temática ==========================================================
// Firma: (S, u, y, p, hmax, ctx) → ancho usado. ctx = { r, celda, t }.

// ---- laboratorio: repuestos de hardware --------------------------------------------------------
const LAB = {
  osciloscopio(S, u, y, p, hmax, { r }) {
    if (hmax < 0.2) return 0;
    S.caja(u + 0.17, y, p, 0.33, 0.17, 0.26, '#d9d6cf', { redondeo: 0.012 });
    S.caja(u + 0.1, y + 0.03, p + 0.131, 0.15, 0.11, 0.004, '#0b1a12', { mat: 'espejo' });
    for (let k = 0; k < 5; k++) S.caja(u + 0.1, y + 0.05 + k * 0.016, p + 0.134, 0.13, 0.002, 0.001, '#3ddc84', { mat: 'brillo' });
    for (let k = 0; k < 6; k++) S.cil(u + 0.22 + (k % 3) * 0.04, y + 0.05 + Math.floor(k / 3) * 0.05, p + 0.135, 0.012, 0.012, r.de(['#2b2b2b', '#4a4a4a']), { rx: Math.PI / 2 });
    return 0.37;
  },
  soldadora(S, u, y, p, hmax) {
    if (hmax < 0.22) return 0;
    S.caja(u + 0.08, y, p, 0.15, 0.09, 0.17, '#2b6cb0', { redondeo: 0.01 });
    S.caja(u + 0.08, y + 0.05, p + 0.086, 0.06, 0.025, 0.003, '#ff5a3c', { mat: 'brillo' });
    S.cil(u + 0.21, y, p, 0.045, 0.012, '#3a3d42', { mat: 'metal' });
    S.toro(u + 0.21, y + 0.06, p, 0.03, 0.004, '#c9ccd2', { mat: 'metal', rx: Math.PI / 2 });
    S.cil(u + 0.21, y + 0.012, p - 0.02, 0.008, 0.16, '#1b1b1b', { rz: 0.5, lados: 10 });
    return 0.27;
  },
  pilaPlacas(S, u, y, p, hmax, { r }) {
    const n = Math.max(1, Math.min(6, Math.floor((hmax - 0.02) / 0.022)));
    for (let i = 0; i < n; i++) {
      S.caja(u + 0.16, y + i * 0.021, p, 0.3, 0.0018, 0.24, r.de(['#1e5b3d', '#16462f', '#1d4e7a']), { ry: r.entre(-0.12, 0.12) });
      S.caja(u + 0.12, y + i * 0.021 + 0.004, p - 0.02, 0.04, 0.006, 0.04, '#16181b', { ry: r.entre(-0.12, 0.12) });
    }
    return 0.34;
  },
  ventiladores(S, u, y, p, hmax, { r }) {
    if (hmax < 0.1) return 0;
    let x = 0;
    for (let i = 0; i < 2 + Math.floor(r() * 3); i++) {
      S.caja(u + x + 0.045, y, p, 0.08, 0.08, 0.025, '#1c1d20', { redondeo: 0.006 });
      S.toro(u + x + 0.045, y + 0.04, p + 0.013, 0.034, 0.002, '#4a4d52', { lados: 20 });
      x += 0.09;
    }
    return x + 0.02;
  },
  organizador(S, u, y, p, hmax, { r, celda }) {
    const w = 0.34;
    const h = Math.min(hmax - 0.02, 0.22);
    if (h < 0.12) return 0;
    S.caja(u + w / 2, y, p, w, h, 0.24, '#8d97a5', { redondeo: 0.008 });
    for (let f = 0; f < 3; f++) for (let c = 0; c < 4; c++) S.caja(u + 0.045 + c * 0.083, y + 0.012 + f * (h / 3), p + 0.122, 0.074, h / 3 - 0.014, 0.008, r.de(['#cfd8dc', '#b3e5fc', '#ffe082', '#c8e6c9']), { mat: 'vidrio' });
    S.etiqueta(u + w / 2, y + h - 0.035, p + 0.127, w * 0.8, 0.03, celda());
    return w + 0.03;
  },
  gaveta(S, u, y, p, hmax, { r, celda }) {
    // gaveta plástica apilable con frente abierto y portaetiqueta
    const h = Math.min(hmax - 0.02, r.si(0.5) ? 0.12 : 0.18);
    if (h < 0.09) return 0;
    const c = r.de(['#2f5fb3', '#8a8f98', '#c9a227', '#b23a3a']);
    const n = 1 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const uu = u + 0.075 + i * 0.155;
      S.caja(uu, y, p, 0.145, h * 0.55, 0.28, c, { redondeo: 0.006 });
      S.caja(uu, y + h * 0.5, p - 0.03, 0.145, h * 0.5, 0.22, c, { redondeo: 0.006 });
      S.caja(uu, y + h * 0.55, p + 0.13, 0.145, 0.004, 0.03, c);
      S.etiqueta(uu, y + h * 0.15, p + 0.141, 0.1, h * 0.28, celda());
    }
    return n * 0.155 + 0.03;
  },
  discos(S, u, y, p, hmax, { r }) {
    const n = Math.max(1, Math.min(6, Math.floor((hmax - 0.02) / 0.028)));
    for (let i = 0; i < n; i++) {
      S.caja(u + 0.06, y + i * 0.027, p, 0.102, 0.025, 0.147, '#b8bec6', { mat: 'metal', ry: r.entre(-0.08, 0.08) });
      S.caja(u + 0.06, y + i * 0.027 + 0.0255, p, 0.07, 0.001, 0.09, '#1c1f24', { ry: 0 });
    }
    return 0.13;
  },
  rolloCable(S, u, y, p, hmax, { r }) {
    if (hmax < 0.08) return 0;
    const rad = r.entre(0.06, 0.09);
    S.toro(u + rad + 0.02, y + 0.018, p, rad, 0.016, r.de(['#1d4ed8', '#e5e7eb', '#111827', '#dc2626', '#16a34a']), { rx: Math.PI / 2 });
    S.toro(u + rad + 0.02, y + 0.048, p, rad * 0.9, 0.016, r.de(['#facc15', '#f97316', '#e5e7eb']), { rx: Math.PI / 2 });
    return rad * 2 + 0.05;
  },
  fuente(S, u, y, p, hmax, { celda }) {
    if (hmax < 0.1) return 0;
    S.caja(u + 0.075, y, p, 0.15, 0.086, 0.14, '#9aa0a8', { mat: 'metal', redondeo: 0.003 });
    S.toro(u + 0.075, y + 0.043, p + 0.071, 0.032, 0.003, '#2b2f36', { mat: 'metal' });
    S.etiqueta(u + 0.075, y + 0.01, p - 0.071, 0.1, 0.06, celda(), { ry: Math.PI });
    return 0.18;
  },
  bolsas(S, u, y, p, hmax, { r }) {
    const h = Math.min(hmax - 0.02, 0.24);
    if (h < 0.12) return 0;
    for (let i = 0; i < 4; i++) S.caja(u + 0.02 + i * 0.012, y, p, 0.004, h * r.entre(0.8, 1), 0.2, r.de(['#b8b0c8', '#c9c2d6', '#d7a6b5']), { mat: 'metal', rz: 0.18 + i * 0.03 });
    return 0.12;
  },
};

// ---- docencia: biblioteca y apuntes ----------------------------------------------------------
const DOC = {
  escuadras(S, u, y, p, hmax) {
    if (hmax < 0.32) return 0;
    S.caja(u + 0.16, y, p + 0.06, 0.3, 0.3, 0.004, '#d9e6ee', { mat: 'vidrio', rz: 0.08 });
    S.caja(u + 0.12, y, p + 0.075, 0.22, 0.22, 0.004, '#f2e6b8', { mat: 'vidrio', rz: -0.05 });
    return 0.33;
  },
  tizas(S, u, y, p, hmax, { r }) {
    if (hmax < 0.08) return 0;
    S.caja(u + 0.07, y, p, 0.13, 0.05, 0.09, '#e9e3d3', { mat: 'carton', redondeo: 0.002 });
    for (let i = 0; i < 6; i++) S.cil(u + 0.025 + i * 0.018, y + 0.04, p + r.entre(-0.02, 0.02), 0.005, 0.075, r.de(['#ffffff', '#fbe3a0', '#c8e2f7', '#f6c9d5']), { rx: Math.PI / 2, lados: 8 });
    return 0.16;
  },
  calculadoras(S, u, y, p, hmax, { r }) {
    if (hmax < 0.05) return 0;
    let x = 0;
    for (let i = 0; i < 2 + Math.floor(r() * 2); i++) {
      S.caja(u + x + 0.045, y + i * 0.019, p, 0.08, 0.018, 0.16, r.de(['#2d2f33', '#3b4a63']), { redondeo: 0.006, ry: r.entre(-0.2, 0.2) });
      x += 0.02;
    }
    return 0.13;
  },
  libros(S, u, y, p, hmax, { r, celda }) {
    let x = 0;
    const n = 5 + Math.floor(r() * 8);
    for (let i = 0; i < n; i++) {
      const w = r.entre(0.026, 0.06);
      const h = Math.min(hmax - 0.02, r.entre(0.19, 0.3));
      if (h < 0.12) break;
      const d = r.entre(0.15, 0.22);
      const inclinado = i === n - 1 && r.si(0.35);
      const c = celda((k) => k % 4 !== 3);
      const tapa = r.de(['#6b1d1d', '#1e3a8a', '#14532d', '#78350f', '#312e81', '#3f3f46', '#9a3412', '#0f766e', '#efe8d8']);
      if (inclinado) {
        S.caja(u + x + h / 2, y, p, h, w, d, tapa, { mat: 'papel' });
        x += h + 0.006;
      } else {
        S.caja(u + x + w / 2, y, p, w, h, d, tapa, { mat: 'papel', redondeo: 0.002 });
        S.etiqueta(u + x + w / 2, y + 0.004, p + d / 2 + 0.0012, w * 0.94, h - 0.008, c);
        x += w + 0.002;
      }
    }
    return x + 0.025;
  },
  carpetas(S, u, y, p, hmax, { r, celda }) {
    const h = Math.min(hmax - 0.02, 0.31);
    if (h < 0.2) return 0;
    let x = 0;
    for (let i = 0; i < 3 + Math.floor(r() * 4); i++) {
      S.caja(u + x + 0.033, y, p, 0.062, h, 0.26, r.de(['#1d4ed8', '#b91c1c', '#111827', '#15803d', '#a16207']), { redondeo: 0.004 });
      S.etiqueta(u + x + 0.033, y + h * 0.45, p + 0.131, 0.046, h * 0.4, celda((k) => k % 4 === 3));
      x += 0.066;
    }
    return x + 0.03;
  },
  hojas(S, u, y, p, hmax, { r }) {
    const n = 5 + Math.floor(r() * 12);
    for (let i = 0; i < n && 0.011 * (i + 1) < hmax - 0.02; i++) S.caja(u + 0.15, y + i * 0.011, p, 0.21, 0.009, 0.297, r.de(['#f7f6f1', '#efeadb', '#f3f0e6']), { mat: 'papel', ry: r.entre(-0.1, 0.1) });
    return 0.32;
  },
  cajaArchivo(S, u, y, p, hmax, { celda }) {
    const h = Math.min(hmax - 0.02, 0.26);
    if (h < 0.18) return 0;
    S.caja(u + 0.06, y, p, 0.12, h, 0.33, '#b98d5a', { mat: 'carton', redondeo: 0.003 });
    S.etiqueta(u + 0.06, y + h * 0.4, p + 0.166, 0.09, h * 0.45, celda((k) => k % 4 === 3));
    S.toro(u + 0.06, y + h * 0.2, p + 0.166, 0.016, 0.004, '#6b4f2e', { mat: 'carton' });
    return 0.15;
  },
  globo(S, u, y, p, hmax) {
    if (hmax < 0.34) return 0;
    S.cil(u + 0.11, y, p, 0.07, 0.02, '#3b2a20', { mat: 'estructura' });
    S.cil(u + 0.11, y + 0.02, p, 0.008, 0.08, '#b08d57', { mat: 'metal' });
    S.esfera(u + 0.11, y + 0.19, p, 0.105, '#2b6cb0', { lados: 24 });
    S.toro(u + 0.11, y + 0.19, p, 0.118, 0.005, '#b08d57', { mat: 'metal', ry: Math.PI / 2 });
    return 0.25;
  },
  lapicero(S, u, y, p, hmax, { r }) {
    if (hmax < 0.2) return 0;
    S.cil(u + 0.045, y, p, 0.038, 0.1, r.de(['#7c2d12', '#1f2937', '#e5e7eb']), { mat: 'metal' });
    for (let i = 0; i < 6; i++) S.cil(u + 0.045 + r.entre(-0.02, 0.02), y + 0.05, p + r.entre(-0.02, 0.02), 0.004, 0.17, r.de(['#facc15', '#2563eb', '#dc2626', '#111827']), { rz: r.entre(-0.18, 0.18), rx: r.entre(-0.18, 0.18), lados: 6 });
    return 0.11;
  },
};

// ---- freelance: tiendas de aromas, regalos y envíos ------------------------------------------
const FREE = {
  suculentas(S, u, y, p, hmax, { r }) {
    if (hmax < 0.14) return 0;
    let x = 0;
    for (let i = 0; i < 2 + Math.floor(r() * 2); i++) {
      S.cil(u + x + 0.04, y, p, 0.036, 0.06, r.de(['#e8e3da', '#c9a27e', '#3a3a3a']), { rArriba: 0.04, lados: 18 });
      for (let k = 0; k < 6; k++) S.esfera(u + x + 0.04 + Math.cos(k) * 0.018, y + 0.068, p + Math.sin(k) * 0.018, 0.015, r.de(['#7fa37b', '#9cbf8e', '#5e8a5a']), { aplastar: 0.6, lados: 8 });
      x += 0.09;
    }
    return x + 0.02;
  },
  perfumes(S, u, y, p, hmax, { r }) {
    if (hmax < 0.16) return 0;
    let x = 0;
    for (let i = 0; i < 2 + Math.floor(r() * 3); i++) {
      const c = r.de(['#f3d9e4', '#e5f0f9', '#f7ecd2', '#e2f2e7']);
      S.caja(u + x + 0.03, y, p, 0.05, 0.09, 0.03, c, { mat: 'vidrio', redondeo: 0.008 });
      S.cil(u + x + 0.03, y + 0.09, p, 0.012, 0.025, '#c8a96b', { mat: 'metal', lados: 12 });
      x += 0.065;
    }
    return x + 0.02;
  },
  velas(S, u, y, p, hmax, { r, celda }) {
    let x = 0;
    for (let i = 0; i < 2 + Math.floor(r() * 3); i++) {
      const h = Math.min(hmax - 0.04, r.entre(0.08, 0.12));
      if (h < 0.06) break;
      const pp = p + r.entre(-0.04, 0.04);
      S.cil(u + x + 0.045, y, pp, 0.044, h, '#e8f1f4', { mat: 'vidrio', lados: 20 });
      S.cil(u + x + 0.045, y + 0.004, pp, 0.04, h * 0.75, r.de(['#f6d6c8', '#efe3f7', '#e3f1ea', '#fbf3d6']), { lados: 20, mat: 'tela' });
      S.cil(u + x + 0.045, y + h, pp, 0.046, 0.012, '#c8a96b', { mat: 'metal', lados: 20 });
      S.etiqueta(u + x + 0.045, y + h * 0.3, pp + 0.0455, 0.055, 0.05, celda((k) => k % 3 !== 2));
      x += 0.1;
    }
    return x + 0.02;
  },
  difusor(S, u, y, p, hmax, { r, celda }) {
    if (hmax < 0.3) return 0;
    S.cil(u + 0.05, y, p, 0.045, 0.11, r.de(['#d9c7a8', '#c8d8d0', '#e8d4dc']), { mat: 'vidrio', rArriba: 0.02, lados: 20 });
    for (let i = 0; i < 7; i++) S.cil(u + 0.05, y + 0.1, p, 0.0018, 0.24, '#7a5c3c', { rz: (i - 3) * 0.07, rx: ((i * 37) % 7 - 3) * 0.05, lados: 4 });
    S.etiqueta(u + 0.05, y + 0.03, p + 0.046, 0.06, 0.05, celda((k) => k % 3 !== 2));
    return 0.12;
  },
  cajaEnvio(S, u, y, p, hmax, { r, celda }) {
    const w = r.entre(0.22, 0.38);
    const h = Math.min(hmax - 0.02, r.entre(0.12, 0.24));
    if (h < 0.08) return 0;
    S.caja(u + w / 2, y, p, w, h, 0.28, '#c19a6b', { mat: 'carton', redondeo: 0.004, ry: r.entre(-0.08, 0.08) });
    S.caja(u + w / 2, y + h - 0.001, p, 0.05, 0.002, 0.285, '#d8c29a', { mat: 'plastico' });
    S.etiqueta(u + w / 2, y + h * 0.12, p + 0.141, Math.min(w * 0.6, 0.14), Math.min(h * 0.75, 0.14), celda((k) => k % 3 === 2));
    return w + 0.03;
  },
  bolsa(S, u, y, p, hmax, { r }) {
    const h = Math.min(hmax - 0.06, 0.26);
    if (h < 0.14) return 0;
    S.caja(u + 0.11, y, p, 0.2, h, 0.09, r.de(['#f2b8c6', '#b8d8f2', '#f2e2b8', '#c6f2b8', '#1f2937', '#ffffff']), { mat: 'papel' });
    S.toro(u + 0.11, y + h, p, 0.045, 0.003, '#d6b16a', { arco: Math.PI, mat: 'tela' });
    return 0.24;
  },
  libretas(S, u, y, p, hmax, { r }) {
    for (let i = 0; i < 2 + Math.floor(r() * 4) && 0.018 * (i + 1) < hmax; i++) S.caja(u + 0.1, y + i * 0.017, p, 0.15, 0.016, 0.21, r.de(['#e9c46a', '#2a9d8f', '#e76f51', '#264653', '#f4a261']), { mat: 'papel', redondeo: 0.003, ry: r.entre(-0.2, 0.2) });
    return 0.22;
  },
  // Neifert: autos a escala de la concesionaria
  autitos(S, u, y, p, hmax, { r }) {
    if (hmax < 0.07) return 0;
    let x = 0;
    for (let i = 0; i < 2 + Math.floor(r() * 2); i++) {
      const c = r.de(['#c62828', '#f4f4f4', '#1d1f24', '#9aa0a8', '#1e4fa3']);
      const cu = u + x + 0.075;
      const pp = p + r.entre(-0.03, 0.03);
      S.caja(cu, y + 0.012, pp, 0.14, 0.026, 0.06, c, { redondeo: 0.008 });
      S.caja(cu - 0.008, y + 0.036, pp, 0.075, 0.022, 0.052, c, { redondeo: 0.008 });
      S.caja(cu - 0.008, y + 0.04, pp + 0.0265, 0.065, 0.014, 0.002, '#2a3440', { mat: 'espejo' });
      for (const du of [-0.045, 0.045]) for (const dp of [-0.031, 0.031]) S.cil(cu + du, y + 0.013, pp + dp, 0.013, 0.008, '#121316', { rx: Math.PI / 2, lados: 12 });
      x += 0.16;
    }
    return x + 0.02;
  },
  // Neifert: llaves de los autos en una bandeja, con su llavero
  llaves(S, u, y, p, hmax, { r }) {
    S.caja(u + 0.09, y, p, 0.16, 0.012, 0.1, '#1d1f24', { redondeo: 0.004 });
    for (let i = 0; i < 4; i++) {
      const ku = u + 0.035 + i * 0.037;
      S.caja(ku, y + 0.012, p + r.entre(-0.02, 0.02), 0.024, 0.01, 0.045, '#22252b', { redondeo: 0.005, ry: r.entre(-0.4, 0.4) });
      S.toro(ku, y + 0.02, p + 0.03, 0.009, 0.0018, '#c9ced6', { mat: 'metal' });
    }
    return 0.19;
  },
  // CRM de Neifert: tarjetero con tarjetas y fichas de clientes
  tarjetero(S, u, y, p, hmax, { r }) {
    S.caja(u + 0.06, y, p, 0.1, 0.02, 0.07, '#2a2d33', { redondeo: 0.003 });
    for (let i = 0; i < 6; i++) S.caja(u + 0.06, y + 0.02 + i * 0.0025, p, 0.09, 0.0024, 0.055, i % 2 ? '#f4f4f4' : '#e8e8e8', { mat: 'papel', ry: r.entre(-0.05, 0.05) });
    S.caja(u + 0.19, y, p, 0.12, 0.05, 0.16, '#b8bec8', { mat: 'plastico', redondeo: 0.004 });
    for (let i = 0; i < 5; i++) S.caja(u + 0.19, y + 0.05, p - 0.06 + i * 0.03, 0.11, 0.06, 0.002, r.de(['#f2f2f2', '#e2e6ec', '#f7e9c8']), { mat: 'papel' });
    return 0.27;
  },
  // CRM de Neifert: el teléfono de la mesa de ventas
  telefono(S, u, y, p, hmax) {
    if (hmax < 0.1) return 0;
    S.caja(u + 0.1, y, p, 0.18, 0.05, 0.16, '#1c1e22', { redondeo: 0.012 });
    S.caja(u + 0.1, y + 0.05, p - 0.035, 0.17, 0.035, 0.05, '#25282e', { redondeo: 0.015 });
    S.caja(u + 0.12, y + 0.051, p + 0.04, 0.08, 0.002, 0.05, '#3a3e45');
    S.caja(u + 0.06, y + 0.051, p + 0.045, 0.04, 0.003, 0.03, '#8fd0ff', { mat: 'brillo' });
    return 0.22;
  },
  // JustPhones: fundas de iPhone paradas en su exhibidor
  fundas(S, u, y, p, hmax, { r }) {
    if (hmax < 0.17) return 0;
    S.caja(u + 0.13, y, p, 0.24, 0.02, 0.08, '#e9e9ea', { mat: 'plastico', redondeo: 0.004 });
    for (let i = 0; i < 4; i++) {
      const fu = u + 0.04 + i * 0.06;
      const c = r.de(['#f7c8d8', '#1d1f24', '#c9e4f7', '#f4e3b5', '#d9f2d0', '#e3d4f7']);
      S.caja(fu, y + 0.02, p, 0.05, 0.14, 0.008, c, { mat: 'plastico', redondeo: 0.009, rx: -0.12 });
      S.caja(fu - 0.01, y + 0.13, p + 0.01, 0.022, 0.022, 0.004, '#2a2d33', { redondeo: 0.006, rx: -0.12 });
    }
    return 0.27;
  },
  // Algo Bonito: joyas en su estuche abierto
  joyas(S, u, y, p, hmax, { r }) {
    if (hmax < 0.08) return 0;
    S.caja(u + 0.08, y, p, 0.14, 0.035, 0.1, '#e8e1d6', { redondeo: 0.006 });
    S.caja(u + 0.08, y + 0.035, p - 0.045, 0.14, 0.09, 0.008, '#e8e1d6', { redondeo: 0.006, rx: 0.3 });
    for (let i = 0; i < 3; i++) S.toro(u + 0.04 + i * 0.04, y + 0.045, p + 0.015, 0.011, 0.0025, r.de(['#d8b46a', '#c9ced6', '#e7c9a9']), { mat: 'metal' });
    S.esfera(u + 0.08, y + 0.06, p + 0.015, 0.006, '#7ad1e6', { mat: 'vidrio' });
    return 0.17;
  },
  // asistente de Atención Primaria: apuntes impresos resaltados y el resaltador
  apuntes(S, u, y, p, hmax, { r }) {
    for (let i = 0; i < 3 + Math.floor(r() * 3) && 0.006 * (i + 1) < hmax; i++) S.caja(u + 0.11, y + i * 0.005, p, 0.21, 0.004, 0.297, '#f4f4f2', { mat: 'papel', ry: r.entre(-0.08, 0.08) });
    S.caja(u + 0.02, y + 0.03, p - 0.13, 0.03, 0.06, 0.004, '#c9ced6', { mat: 'metal' });
    S.cil(u + 0.18, y + 0.03, p + 0.06, 0.008, 0.12, r.de(['#f9e04b', '#7ee081', '#ff8ad4']), { rz: Math.PI / 2, lados: 10 });
    return 0.24;
  },
};

// ---- técnico: taller y mostrador -------------------------------------------------------------
const TEC = {
  celularesReparacion(S, u, y, p, hmax, { r, celda }) {
    let x = 0;
    for (let i = 0; i < 2 + Math.floor(r() * 3); i++) {
      S.caja(u + x + 0.04, y, p, 0.075, 0.008, 0.155, r.de(['#1c1c1e', '#e8e6e1', '#2f3d4f']), { redondeo: 0.004, ry: r.entre(-0.3, 0.3) });
      S.caja(u + x + 0.04, y + 0.0082, p, 0.068, 0.0006, 0.145, '#0a0b0d', { mat: 'espejo', ry: r.entre(-0.3, 0.3) });
      x += 0.085;
    }
    S.etiqueta(u + 0.05, y + 0.009, p + 0.07, 0.05, 0.035, celda(), { rx: -Math.PI / 2 });
    void hmax;
    return x + 0.02;
  },
  cargadores(S, u, y, p, hmax, { r }) {
    if (hmax < 0.06) return 0;
    let x = 0;
    for (let i = 0; i < 2 + Math.floor(r() * 2); i++) {
      S.caja(u + x + 0.05, y, p, 0.09, 0.03, 0.06, '#151618', { redondeo: 0.008 });
      S.toro(u + x + 0.05, y + 0.012, p + 0.07, 0.035, 0.003, '#151618', { rx: Math.PI / 2, lados: 18 });
      x += 0.1;
    }
    return x + 0.02;
  },
  cajaProducto(S, u, y, p, hmax, { r, celda }) {
    const w = r.entre(0.18, 0.36);
    const h = Math.min(hmax - 0.02, r.entre(0.06, 0.26));
    if (h < 0.05) return 0;
    S.caja(u + w / 2, y, p, w, h, 0.22, r.de(['#f4f4f5', '#18181b', '#1e3a8a', '#7f1d1d']), { mat: 'papel', redondeo: 0.003 });
    S.etiqueta(u + w / 2, y + h * 0.1, p + 0.1112, w * 0.85, h * 0.8, celda());
    return w + 0.02;
  },
  cajonera(S, u, y, p, hmax, { r, celda }) {
    const h = Math.min(hmax - 0.02, 0.32);
    if (h < 0.16) return 0;
    const w = 0.38;
    S.caja(u + w / 2, y, p, w, h, 0.26, '#3f4652', { mat: 'metal', redondeo: 0.004 });
    const filas = Math.max(2, Math.floor(h / 0.075));
    for (let f = 0; f < filas; f++)
      for (let c = 0; c < 4; c++) {
        const cu = u + 0.05 + c * 0.093;
        const cy = y + 0.012 + f * (h / filas);
        S.caja(cu, cy, p + 0.13, 0.082, h / filas - 0.016, 0.01, r.de(['#e2e8f0', '#fde68a', '#bfdbfe', '#fecaca']), { mat: 'vidrio' });
        if ((f + c) % 2 === 0) S.etiqueta(cu, cy + (h / filas) * 0.5, p + 0.136, 0.05, 0.016, celda());
      }
    return w + 0.03;
  },
  notebooks(S, u, y, p, hmax, { r, celda }) {
    const n = Math.max(1, Math.min(4, Math.floor((hmax - 0.03) / 0.026)));
    for (let i = 0; i < n; i++) S.caja(u + 0.18, y + i * 0.025, p, 0.34, 0.023, 0.24, r.de(['#27272a', '#a1a1aa', '#3f3f46', '#d4d4d8']), { mat: i % 2 ? 'metal' : 'plastico', redondeo: 0.006, ry: r.entre(-0.06, 0.06) });
    S.etiqueta(u + 0.3, y + n * 0.025 - 0.07, p + 0.125, 0.06, 0.07, celda(), { rz: 0.15 });
    return 0.38;
  },
  monitor(S, u, y, p, hmax, { r }) {
    const w = r.entre(0.36, 0.5);
    const h = w * 0.6;
    if (h + 0.1 > hmax) return 0;
    S.caja(u + w / 2, y, p, 0.16, 0.012, 0.13, '#18181b', { redondeo: 0.004 });
    S.caja(u + w / 2, y, p - 0.03, 0.04, 0.09, 0.03, '#18181b');
    S.caja(u + w / 2, y + 0.07, p - 0.02, w, h, 0.02, '#111113', { redondeo: 0.004 });
    S.caja(u + w / 2, y + 0.082, p - 0.009, w - 0.02, h - 0.03, 0.001, '#0b0d12', { mat: 'espejo' });
    return w + 0.04;
  },
  router(S, u, y, p, hmax, { r }) {
    if (hmax < 0.2) return 0;
    const color = r.de(['#18181b', '#e4e4e7']);
    S.caja(u + 0.11, y, p, 0.2, 0.035, 0.14, color, { redondeo: 0.008 });
    for (let k = 0; k < 4; k++) S.caja(u + 0.04 + k * 0.03, y + 0.02, p + 0.0705, 0.006, 0.004, 0.002, '#59ff9c', { mat: 'brillo' });
    for (let k = 0; k < 2 + Math.floor(r() * 2); k++) S.cil(u + 0.03 + k * 0.07, y + 0.035, p - 0.06, 0.006, Math.min(0.15, hmax - 0.06), color, { rz: (k - 1) * 0.25, lados: 8 });
    return 0.24;
  },
  bolsaCables(S, u, y, p, hmax, { r, celda }) {
    const h = Math.min(hmax - 0.02, 0.2);
    if (h < 0.12) return 0;
    S.caja(u + 0.08, y, p, 0.15, h, 0.03, '#eef4f7', { mat: 'vidrio', rx: -0.18, redondeo: 0.004 });
    S.toro(u + 0.08, y + h * 0.45, p - 0.01, 0.045, 0.008, r.de(['#111827', '#e5e7eb', '#2563eb']), { lados: 14 });
    S.etiqueta(u + 0.08, y + h * 0.72, p + 0.02, 0.1, 0.04, celda(), { rx: -0.18 });
    return 0.18;
  },
  teclado(S, u, y, p, hmax, { r }) {
    if (hmax < 0.06) return 0;
    S.caja(u + 0.22, y, p, 0.44, 0.024, 0.14, r.de(['#1f2937', '#e5e7eb']), { redondeo: 0.005 });
    for (let f = 0; f < 4; f++) for (let c = 0; c < 14; c++) S.caja(u + 0.025 + c * 0.029, y + 0.024, p - 0.05 + f * 0.028, 0.024, 0.008, 0.023, '#2b313b');
    return 0.47;
  },
};

;

// ---- MBRF: logística de planta ------------------------------------------------------------
const MB = {
  // cortes envasados al vacío en bandejas (lo que sale de la planta)
  envasados(S, u, y, p, hmax, { r, celda }) {
    if (hmax < 0.06) return 0;
    let x = 0;
    for (let i = 0; i < 2 + Math.floor(r() * 2); i++) {
      S.caja(u + x + 0.1, y, p, 0.18, 0.012, 0.26, '#f2f2f2', { redondeo: 0.004 });
      S.caja(u + x + 0.1, y + 0.012, p, 0.15, 0.03, 0.22, r.de(['#8e2a2a', '#a33a35', '#7a2323']), { mat: 'vidrio', redondeo: 0.012 });
      S.etiqueta(u + x + 0.1, y + 0.043, p + 0.04, 0.07, 0.05, celda(), { rx: -Math.PI / 2 });
      x += 0.2;
    }
    return x + 0.02;
  },
  conservadora(S, u, y, p, hmax) {
    if (hmax < 0.3) return 0;
    S.caja(u + 0.2, y, p, 0.38, 0.26, 0.3, '#f4f5f6', { redondeo: 0.02 });
    S.caja(u + 0.2, y + 0.26, p, 0.39, 0.035, 0.31, '#2f6fd8', { redondeo: 0.012 });
    return 0.42;
  },
  cajaEtiquetada(S, u, y, p, hmax, { r, celda }) {
    const w = r.entre(0.3, 0.42);
    const h = Math.min(hmax - 0.02, r.entre(0.18, 0.3));
    if (h < 0.12) return 0;
    S.caja(u + w / 2, y, p, w, h, 0.36, '#b9915f', { mat: 'carton', redondeo: 0.004, ry: r.entre(-0.05, 0.05) });
    S.caja(u + w / 2, y + h - 0.001, p, w + 0.002, 0.002, 0.05, '#d9d2c3', { mat: 'plastico' });
    S.etiqueta(u + w * 0.35, y + h * 0.15, p + 0.1812, 0.11, 0.11, celda());
    return w + 0.02;
  },
  cajon(S, u, y, p, hmax, { r }) {
    const w = r.entre(0.4, 0.5);
    const h = Math.min(hmax - 0.02, 0.24);
    if (h < 0.15) return 0;
    // cajón de planta: plástico apenas saturado, borde reforzado, nervios y manija
    const c = r.de(['#4f6f9f', '#d9dcdf', '#9f5a52', '#6b8f71']);
    S.caja(u + w / 2, y, p, w, h * 0.9, 0.34, c, { redondeo: 0.01 });
    S.caja(u + w / 2, y + h * 0.88, p, w + 0.012, h * 0.12, 0.352, c, { redondeo: 0.006 });
    for (let i = 1; i < 5; i++) S.caja(u + (w * i) / 5, y + 0.02, p + 0.172, 0.012, h * 0.7, 0.008, c);
    S.caja(u + w * 0.5, y + h * 0.66, p + 0.17, w * 0.22, h * 0.12, 0.006, '#1b1e22', { redondeo: 0.01 });
    return w + 0.025;
  },
  bidon(S, u, y, p, hmax, { r, celda }) {
    const h = Math.min(hmax - 0.06, 0.3);
    if (h < 0.18) return 0;
    S.caja(u + 0.1, y, p, 0.19, h, 0.13, r.de(['#f4f4f5', '#2563eb', '#facc15']), { redondeo: 0.025 });
    S.cil(u + 0.15, y + h, p, 0.02, 0.03, '#dc2626');
    S.toro(u + 0.06, y + h, p, 0.035, 0.008, '#e5e7eb', { arco: Math.PI });
    S.etiqueta(u + 0.1, y + h * 0.25, p + 0.0655, 0.1, 0.1, celda());
    return 0.22;
  },
  film(S, u, y, p, hmax) {
    if (hmax < 0.5) return 0;
    S.cil(u + 0.06, y, p, 0.055, 0.48, '#dfe9ee', { mat: 'vidrio', lados: 20 });
    S.cil(u + 0.06, y, p, 0.022, 0.5, '#8a6a42', { mat: 'carton', lados: 12 });
    return 0.13;
  },
};

// Cuántas veces puede aparecer cada objeto generado en un mismo pasillo (los muy reconocibles,
// pocas: un globo terráqueo repetido diez veces se nota enseguida).
const MAXIMO = new Map([
  [LAB.gaveta, 6],
  [LAB.organizador, 5],
  [LAB.osciloscopio, 3],
  [LAB.soldadora, 3],
  [DOC.escuadras, 2],
  [DOC.tizas, 3],
  [FREE.perfumes, 4],
  [FREE.suculentas, 4],
  [TEC.cajaProducto, 10],
  [MB.cajaEtiquetada, 10],
  [MB.conservadora, 3],
  [LAB.discos, 4],
  [LAB.bolsas, 3],
  [LAB.fuente, 5],
  [LAB.rolloCable, 5],
  [DOC.globo, 2],
  [DOC.lapicero, 3],
  [DOC.cajaArchivo, 6],
  [FREE.difusor, 4],
  [FREE.bolsa, 6],
  [TEC.monitor, 3],
  [TEC.teclado, 3],
  [TEC.notebooks, 4],
  [TEC.cajonera, 5],
  [TEC.router, 5],
  [MB.film, 2],
  [MB.bidon, 6],
  [MB.cajon, 6],
  [FREE.autitos, 4],
  [FREE.llaves, 2],
  [FREE.tarjetero, 2],
  [FREE.telefono, 1],
  [FREE.fundas, 4],
  [FREE.joyas, 3],
  [FREE.apuntes, 3],
]);

// ---- relación con los objetos interactivos ------------------------------------------------------
// Cerca de cada objeto con tooltip (en su pared, ~1,9 m a cada lado, o enfrente) los estantes y el
// piso llevan cosas de ESE objeto; en el resto del pasillo, cosas de la temática del trabajo.
// `reales`: modelos de Poly Haven (también tienen que estar en pasilloAssets, para bajarlos);
// `items`: objetos generados; `piso`: modelos reales de piso.
const RELACION = {
  laboratorio: {
    placa: { reales: ['screwdriver', 'flathead_screwdriver', 'pliers', 'screwdrivers_02'], items: [LAB.pilaPlacas, LAB.discos, LAB.ventiladores, LAB.fuente, LAB.bolsas] },
    banco: { reales: ['combination_wrench', 'adjustable_wrench', 'industrial_microscope'], items: [LAB.osciloscopio, LAB.soldadora, LAB.gaveta, LAB.organizador] },
    gabinete: { reales: [], items: [LAB.rolloCable, LAB.fuente, LAB.discos, LAB.ventiladores] },
  },
  docencia: {
    pizarron: { reales: ['binder_notebook', 'office_notepads', 'stationery_supplies'], items: [DOC.libros, DOC.hojas, DOC.lapicero, DOC.tizas] },
    diagrama: { reales: ['clipboard', 'vintage_stapler'], items: [DOC.escuadras, DOC.hojas, DOC.carpetas, DOC.lapicero] },
    pupitres: { reales: ['alarm_clock_01', 'round_spectacles'], items: [DOC.calculadoras, DOC.carpetas, DOC.cajaArchivo, DOC.libros] },
  },
  freelance: {
    celular: { reales: ['digital_wrist_watch', 'Camera_01'], items: [FREE.fundas, FREE.cajaEnvio, FREE.bolsa] },
    pago: {
      reales: ['ceramic_vase_01', 'ceramic_vase_02', 'ceramic_vase_03', 'ceramic_vase_04', 'wooden_candlestick', 'brass_candleholders', 'brass_diya_lantern', 'vintage_oil_lamp', 'brass_vase_01', 'wicker_basket_01', 'wicker_basket_02'],
      items: [FREE.joyas, FREE.velas, FREE.perfumes, FREE.difusor],
    },
    robot: { reales: ['medical_box', 'classic_laptop'], items: [FREE.apuntes, FREE.libretas] },
    auto: { reales: [], items: [FREE.autitos, FREE.llaves, FREE.tarjetero, FREE.telefono], piso: ['old_tyre'] },
  },
  tecnico: {
    notebook: { reales: ['lightbulb_led'], items: [TEC.notebooks, TEC.cargadores, TEC.teclado, TEC.bolsaCables] },
    impresora: { reales: ['vintage_radio_transceiver', 'cassette_player', 'portable_cassette_player'], items: [TEC.celularesReparacion, TEC.cajaProducto, TEC.cargadores] },
    monitor: { reales: ['CashRegister_01'], items: [TEC.monitor, TEC.teclado, TEC.router] },
  },
  mbrf: {
    balanza: { reales: ['plastic_container', 'long_life_food'], items: [MB.envasados, MB.cajaEtiquetada, MB.film] },
    cajas: { reales: ['russian_food_cans_01'], items: [MB.cajaEtiquetada, MB.cajon, MB.film] },
    tablero: { reales: ['security_camera_02'], items: [DOC.carpetas, DOC.hojas, MB.cajaEtiquetada] },
    rack: { reales: [], items: [TEC.router, TEC.bolsaCables, LAB.discos] },
    equipo: { reales: ['plastic_thermos', 'modified_thermos'], items: [DOC.carpetas, FREE.libretas, MB.envasados] },
  },
};

// ---- temas: estructura, objetos, piso, paneles y techo propios ------------------------------
const TEMAS = {
  laboratorio: {
    estructura: '#f2f4f7',
    fondo: '#9aa2ad',
    prof: 0.42,
    mueble: 'rejillas',
    items: Object.values(LAB),
  },
  docencia: {
    estructura: '#fff4e4',
    fondo: '#8a6a4c',
    prof: 0.34,
    mueble: 'molduras',
    items: [DOC.libros, DOC.libros, DOC.libros, DOC.carpetas, DOC.hojas, DOC.cajaArchivo, DOC.globo, DOC.lapicero, DOC.escuadras, DOC.tizas, DOC.calculadoras],
  },
  freelance: {
    estructura: '#ffffff',
    fondo: '#efe6d6',
    prof: 0.36,
    mueble: 'cajones',
    items: [FREE.suculentas, FREE.libretas, FREE.cajaEnvio, FREE.bolsa, FREE.velas],
  },
  tecnico: {
    estructura: '#ffffff',
    fondo: '#7a6a58',
    prof: 0.42,
    mueble: 'vitrina',
    items: [TEC.cajaProducto, TEC.cajaProducto, TEC.cajonera, TEC.notebooks, TEC.monitor, TEC.teclado, TEC.router, TEC.bolsaCables, TEC.celularesReparacion, TEC.cargadores],
  },
  mbrf: {
    estructura: '#ffb070',
    parante: '#8fb4ff',
    fondo: '#c9ced6',
    prof: 0.52,
    mueble: 'lockers',
    items: [MB.cajaEtiquetada, MB.cajaEtiquetada, MB.cajon, MB.bidon, MB.film, MB.envasados, MB.envasados, MB.conservadora],
  },
};

// ===== planificación de objetos reales ========================================================
// Lleva qué modelos de Poly Haven quedan por ubicar en el pasillo y dónde va cada uno.
function crearPlan(id, r, excluidos) {
  const a = AMBIENTES[id]?.modelos ?? {};
  const disponibles = (lista) => r.mezclar((lista ?? []).filter((m) => medida(m) && !excluidos.has(m)));
  const relacion = RELACION[id] ?? {};
  const deObjetos = new Set(Object.values(relacion).flatMap((x) => [...(x.reales ?? []), ...(x.piso ?? [])]));
  const estantePor = new Map(Object.entries(relacion).map(([modelo, x]) => [modelo, disponibles((x.reales ?? []).filter((m) => (a.estante ?? []).includes(m)))]));
  const pisoPor = new Map(Object.entries(relacion).map(([modelo, x]) => [modelo, disponibles((x.piso ?? []).filter((m) => (a.piso ?? []).includes(m)))]));
  return {
    colocaciones: [], // { id, x, y, z, giro, poblar? }
    usos: new Map(), // objeto generado -> veces usado en el pasillo
    luces: [], // posiciones de las lámparas (para las luces de verdad)
    // los de un objeto interactivo van junto a él; el resto, en cualquier lado
    estante: disponibles((a.estante ?? []).filter((m) => !deObjetos.has(m))),
    piso: disponibles((a.piso ?? []).filter((m) => !deObjetos.has(m))),
    estantePor,
    pisoPor,
    objetos: [], // [{ a, lado, modelo }] los interactivos del pasillo
    mueble: disponibles(a.mueble),
    pared: disponibles(a.pared),
    techo: (a.techo ?? []).filter((m) => medida(m)),
  };
}

// Saca de `lista` el primer modelo que entra (en su orientación o girado 90°).
function tomarQueEntre(lista, { anchoMax, altoMax, fondoMax, girar = true }) {
  for (let i = 0; i < lista.length; i++) {
    const [w, h, d] = medida(lista[i]);
    if (h > altoMax) continue;
    if (w <= anchoMax && d <= fondoMax) return { id: lista.splice(i, 1)[0], ancho: w, fondo: d, alto: h, girado: false };
    if (girar && d <= anchoMax && w <= fondoMax) return { id: lista.splice(i, 1)[0], ancho: d, fondo: w, alto: h, girado: true };
  }
  return null;
}

// Pintor de ensayo: graba lo que dibujaría un objeto y mide cuánto ocupa a lo largo (u), para
// dibujarlo sólo si entra entero (si no, las cajas atraviesan los parantes de la estantería).
function ensayo(S) {
  const llamadas = [];
  let min = Infinity;
  let max = -Infinity;
  const medir = (u, mitad) => {
    min = Math.min(min, u - mitad);
    max = Math.max(max, u + mitad);
  };
  const grabar = (nombre, medida) => (...args) => {
    llamadas.push([nombre, args]);
    medida(args);
  };
  return {
    giro: S.giro,
    xz: S.xz,
    caja: grabar('caja', ([u, , , ancho, , , , o]) => medir(u, (o?.rz || o?.ry ? 1.15 : 0.5) * ancho)),
    cil: grabar('cil', ([u, , , rad, , , o]) => medir(u, Math.max(rad, o?.rArriba ?? 0))),
    esfera: grabar('esfera', ([u, , , rad]) => medir(u, rad)),
    toro: grabar('toro', ([u, , , rad, tubo]) => medir(u, rad + tubo)),
    torno: grabar('torno', ([u, , , perfil]) => medir(u, Math.max(...perfil.map((q) => q[0])))),
    etiqueta: grabar('etiqueta', ([u, , , ancho]) => medir(u, ancho / 2)),
    limites: () => [min, max],
    volcar: () => llamadas.forEach(([nombre, args]) => S[nombre](...args)),
  };
}

// Llena una tabla (estante, mesada, tapa de mueble) de u0 a u1: intercala objetos reales
// pendientes con objetos generados de la temática. `colocar(modelo, u, p)` ubica un real.
function llenarTabla(S, u0, u1, y, p, prof, hmax, ctx, colocar, probReal = 0.45) {
  let u = u0 + 0.02;
  let vueltas = 0;
  while (u < u1 - 0.08 && vueltas++ < 40) {
    const foco = ctx.focoEn(S, u);
    const reales = foco ? (ctx.plan.estantePor.get(foco) ?? []) : ctx.plan.estante;
    const items = (foco && RELACION[ctx.id]?.[foco]?.items) || ctx.t.items;
    if (reales.length && ctx.r.si(foco ? 0.55 : probReal)) {
      const real = tomarQueEntre(reales, { anchoMax: u1 - u - 0.02, altoMax: hmax - 0.015, fondoMax: prof + 0.08 });
      if (real) {
        colocar(real, u + real.ancho / 2, p);
        u += real.ancho + 0.035;
        continue;
      }
    }
    // el objeto menos usado (en proporción a su tope), con un poco de azar para que no sea un patrón
    let item = null;
    let mejor = Infinity;
    for (const candidato of new Set(items)) {
      const peso = items.filter((x) => x === candidato).length;
      const uso = (ctx.plan.usos.get(candidato) ?? 0) / ((MAXIMO.get(candidato) ?? 12) * peso);
      const puntaje = uso + ctx.r() * 0.35;
      if (puntaje < mejor) {
        mejor = puntaje;
        item = candidato;
      }
    }
    const prueba = ensayo(S);
    const usado = item(prueba, u, y, p, hmax, ctx);
    if (!usado) {
      u += 0.04;
      continue;
    }
    const [desde, hasta] = prueba.limites();
    // no entra: se prueba más adelante con otro objeto (más chico) en vez de pisar el borde
    if (desde < u0 - 0.005 || hasta > u1 + 0.005) {
      u += 0.05;
      continue;
    }
    prueba.volcar();
    ctx.plan.usos.set(item, (ctx.plan.usos.get(item) ?? 0) + 1);
    u = Math.max(u + usado, hasta + 0.012);
  }
}

// Estantería desde y0 hasta y1 (fondo que tapa la pared, parantes, tablas cada ~0,4 m).
function estanteria(S, u0, u1, y0, y1, ctx, prof = ctx.t.prof) {
  const { t } = ctx;
  const ancho = u1 - u0;
  const mid = (u0 + u1) / 2;
  const parante = t.parante ?? t.estructura;
  S.caja(mid, y0, 0.012, ancho, y1 - y0, 0.02, t.fondo, { mat: 'estructura' });
  S.caja(u0 + 0.025, y0, prof / 2, 0.045, y1 - y0, prof, parante, { mat: 'estructura', redondeo: 0.004 });
  S.caja(u1 - 0.025, y0, prof / 2, 0.045, y1 - y0, prof, parante, { mat: 'estructura', redondeo: 0.004 });
  const tablas = [];
  let y = y0 + 0.06;
  while (y < y1 - 0.22) {
    tablas.push(y);
    y += ctx.r.entre(0.36, 0.48);
  }
  tablas.forEach((ty, i) => {
    S.caja(mid, ty, prof / 2, ancho - 0.05, 0.03, prof, t.estructura, { mat: 'estructura', redondeo: 0.004 });
    const siguiente = tablas[i + 1] ?? y1;
    llenarTabla(S, u0 + 0.05, u1 - 0.05, ty + 0.03, prof / 2, prof, siguiente - ty - 0.03, ctx, (real, u, p) => ctx.colocarEnPared(S, real, u, ty + 0.03, p));
  });
  S.caja(mid, y1 - 0.03, prof / 2, ancho, 0.03, prof, t.estructura, { mat: 'estructura' });
}

// Mueble bajo (debajo de lo que cuelga de la pared): cada temática tiene el suyo.
function muebleBajo(S, u0, u1, alto, ctx, conCosas = false) {
  const { t, r } = ctx;
  const mid = (u0 + u1) / 2;
  const ancho = u1 - u0;
  const estilo = t.mueble ?? 'puertas';
  const fondoCuerpo = 0.5;
  S.caja(mid, 0, fondoCuerpo / 2, ancho, alto, fondoCuerpo, t.estructura, { mat: 'estructura', redondeo: 0.006 });
  const frente = fondoCuerpo + 0.002;
  const n = Math.max(1, Math.round(ancho / (estilo === 'lockers' ? 0.4 : 0.5)));
  const paso = ancho / n;
  for (let i = 0; i < n; i++) {
    const cu = u0 + (i + 0.5) * paso;
    if (estilo === 'rejillas' || estilo === 'lockers') {
      // puertas de chapa con rejillas de ventilación
      S.caja(cu, 0.05, frente, paso - 0.02, alto - 0.08, 0.012, estilo === 'lockers' ? '#8d99a6' : t.fondo, { mat: 'metal', redondeo: 0.003 });
      for (let k = 0; k < 5; k++) S.caja(cu, alto * 0.72 + k * 0.022, frente + 0.007, paso * 0.5, 0.008, 0.004, '#2a2f36');
      S.caja(cu + paso * 0.3, alto * 0.45, frente + 0.012, 0.02, 0.07, 0.02, '#c9ced4', { mat: 'metal' });
      if (estilo === 'lockers') S.etiqueta(cu - paso * 0.15, alto * 0.55, frente + 0.008, 0.06, 0.03, ctx.celda());
    } else if (estilo === 'molduras') {
      // puertas de madera con moldura
      S.caja(cu, 0.06, frente, paso - 0.03, alto - 0.1, 0.014, t.estructura, { mat: 'estructura', redondeo: 0.004 });
      S.caja(cu, 0.14, frente + 0.01, paso - 0.16, alto - 0.26, 0.008, t.fondo, { mat: 'estructura', redondeo: 0.004 });
      S.esfera(cu + paso * 0.34, alto * 0.55, frente + 0.03, 0.014, '#b08d57', { mat: 'metal' });
    } else if (estilo === 'cajones') {
      const filas = Math.max(2, Math.round(alto / 0.22));
      for (let f = 0; f < filas; f++) {
        const fy = 0.05 + f * ((alto - 0.06) / filas);
        S.caja(cu, fy, frente, paso - 0.02, (alto - 0.06) / filas - 0.015, 0.016, t.estructura, { mat: 'estructura', redondeo: 0.004 });
        S.caja(cu, fy + ((alto - 0.06) / filas) * 0.55, frente + 0.016, paso * 0.35, 0.012, 0.014, '#2b2b2b', { mat: 'metal', redondeo: 0.005 });
      }
    } else if (estilo === 'vitrina') {
      // mostrador con frente de vidrio y estante adentro
      S.caja(cu, 0.06, frente - 0.01, paso - 0.02, alto - 0.12, 0.006, '#dfe9ee', { mat: 'vidrio' });
      S.caja(cu, alto * 0.45, fondoCuerpo / 2, paso - 0.04, 0.012, fondoCuerpo - 0.04, '#f4f4f5', { mat: 'vidrio' });
      if (r.si(0.8)) TEC.cajaProducto(S, cu - 0.2, alto * 0.45 + 0.012, fondoCuerpo / 2, alto * 0.45, ctx);
    } else {
      S.caja(cu, 0.06, frente, paso - 0.03, alto - 0.1, 0.012, t.fondo, { mat: 'estructura', redondeo: 0.004 });
      S.caja(cu + paso * 0.3, alto * 0.55, frente + 0.018, 0.016, 0.12, 0.02, '#b9bec6', { mat: 'metal', redondeo: 0.006 });
    }
  }
  if (conCosas) llenarTabla(S, u0 + 0.02, u1 - 0.02, alto, fondoCuerpo / 2, fondoCuerpo - 0.02, 0.55, ctx, (real, u, p) => ctx.colocarEnPared(S, real, u, alto, p), 0.6);
}

// Panel de pared temático entre un mueble bajo y estantes altos; puede llevar un objeto real colgado.
function panelPared(S, u0, u1, y0, y1, ctx, id) {
  const { r } = ctx;
  const mid = (u0 + u1) / 2;
  const ancho = u1 - u0;
  const h = y1 - y0;
  const real = tomarQueEntre(ctx.plan.pared, { anchoMax: ancho - 0.12, altoMax: h - 0.06, fondoMax: 0.5 });
  if (id === 'laboratorio') {
    // tablero de normas y un tablero eléctrico
    S.caja(mid, y0, 0.012, ancho, h, 0.02, '#e7e5df', { mat: 'papel' });
    S.etiqueta(u0 + 0.18, y0 + h * 0.3, 0.025, 0.26, 0.26, ctx.celda());
    S.caja(u1 - 0.22, y0 + 0.12, 0.06, 0.3, h * 0.6, 0.1, '#c9ccd1', { mat: 'metal', redondeo: 0.01 });
    for (let k = 0; k < 6; k++) S.caja(u1 - 0.32 + k * 0.04, y0 + 0.12 + h * 0.3, 0.115, 0.022, 0.05, 0.012, k % 3 ? '#1f2937' : '#dc2626');
  } else if (id === 'docencia') {
    // corcho con apuntes y fotocopias
    S.caja(mid, y0, 0.015, ancho, h, 0.025, '#a47b4c', { mat: 'carton' });
    for (let k = 0; k < Math.floor(ancho * 8); k++) S.caja(r.entre(u0 + 0.1, u1 - 0.1), y0 + r.entre(0.05, h - 0.26), 0.03, 0.15, 0.2, 0.002, r.de(['#fff7c2', '#f7f6f1', '#ffd6e0', '#cfe8ff']), { mat: 'papel', rz: r.entre(-0.12, 0.12) });
  } else if (id === 'freelance') {
    // muro de fotos y un neón
    S.caja(mid, y0, 0.012, ancho, h, 0.02, '#efe6d6', { mat: 'papel' });
    for (let k = 0; k < Math.floor(ancho / 0.16); k++) {
      const x = u0 + 0.1 + k * 0.16;
      const yy = y0 + r.entre(0.05, h * 0.4);
      S.caja(x, yy, 0.026, 0.1, 0.12, 0.003, '#fbfbf8', { mat: 'papel', rz: r.entre(-0.15, 0.15) });
      S.caja(x, yy + 0.03, 0.028, 0.085, 0.08, 0.002, r.de(['#5b7a99', '#c9845d', '#7fa37b', '#b46b7a', '#d6b85a']), { rz: r.entre(-0.15, 0.15) });
    }
    S.caja(mid, y0 + h * 0.78, 0.03, Math.min(0.7, ancho * 0.6), 0.025, 0.02, r.de(['#ff6ad5', '#ffb347', '#62e6ff']), { mat: 'brillo', redondeo: 0.01 });
  } else if (id === 'tecnico') {
    // tablero perforado con herramientas
    S.caja(mid, y0, 0.015, ancho, h, 0.02, '#b8925f', { mat: 'estructura' });
    for (let k = 0; k < Math.floor(ancho / 0.1); k++) {
      const x = u0 + 0.07 + k * 0.1;
      const tipo = r() * 3;
      if (tipo < 1) S.cil(x, y0 + h * 0.25, 0.045, 0.008, h * r.entre(0.3, 0.5), r.de(['#c9ccd2', '#d97706', '#1f2937']), { mat: 'metal' });
      else if (tipo < 2) S.toro(x, y0 + h * 0.6, 0.04, 0.05, 0.007, r.de(['#1f2937', '#2563eb', '#dc2626']));
      else S.caja(x, y0 + h * 0.2, 0.05, 0.06, h * 0.35, 0.03, r.de(['#dc2626', '#1f2937', '#ca8a04']), { redondeo: 0.008 });
    }
  } else {
    // planta: franjas de seguridad
    S.caja(mid, y0, 0.012, ancho, h, 0.02, '#d9dde2', { mat: 'plastico' });
    for (let k = 0; k < Math.floor(ancho / 0.14); k++) S.caja(u0 + 0.07 + k * 0.14, y0 + 0.03, 0.025, 0.07, 0.09, 0.006, '#f2c230', { rz: 0.6 });
  }
  if (real) ctx.colocarEnPared(S, real, mid, y0 + 0.04 + Math.max(0, (h - real.alto) * 0.45), real.fondo / 2 + 0.03);
}

// Unidad especial de cada temática (corta la repetición de estanterías): ocupa de piso a techo.
function unidadEspecial(S, u0, u1, ctx, id) {
  const { t, r } = ctx;
  const mid = (u0 + u1) / 2;
  const ancho = u1 - u0;
  if (id === 'laboratorio' || id === 'tecnico') {
    // armario de chapa con puertas de vidrio (lab) / vitrina alta de accesorios (técnico)
    estanteria(S, u0, u1, 0, TECHO, ctx);
    const marco = id === 'laboratorio' ? '#4a5360' : '#2b2d31';
    for (const lado of [0, 1]) {
      const cu = u0 + ancho * (0.25 + lado * 0.5);
      S.caja(cu, 0.04, t.prof + 0.012, ancho / 2 - 0.02, TECHO - 0.08, 0.012, '#e6eef2', { mat: 'vidrio' });
      S.caja(cu, 0.02, t.prof + 0.012, ancho / 2 - 0.01, 0.03, 0.03, marco, { mat: 'metal' });
      S.caja(cu, TECHO - 0.05, t.prof + 0.012, ancho / 2 - 0.01, 0.03, 0.03, marco, { mat: 'metal' });
      S.caja(cu + (lado ? -1 : 1) * (ancho / 4 - 0.04), 1.0, t.prof + 0.03, 0.014, 0.18, 0.014, '#c9ced4', { mat: 'metal' });
    }
    if (id === 'tecnico') S.caja(mid, TECHO - 0.2, t.prof + 0.02, ancho - 0.1, 0.012, 0.012, '#ffffff', { mat: 'brillo' });
  } else if (id === 'docencia') {
    ctx.reservar(S, u0, u1);
    // ropero de madera con molduras, cerrado
    S.caja(mid, 0, 0.3, ancho, TECHO, 0.6, t.estructura, { mat: 'estructura', redondeo: 0.008 });
    for (const lado of [0, 1]) {
      const cu = u0 + ancho * (0.25 + lado * 0.5);
      S.caja(cu, 0.08, 0.605, ancho / 2 - 0.04, TECHO - 0.2, 0.016, t.estructura, { mat: 'estructura', redondeo: 0.004 });
      for (const y of [0.2, 1.4]) S.caja(cu, y, 0.62, ancho / 2 - 0.2, 1.0, 0.008, t.fondo, { mat: 'estructura', redondeo: 0.004 });
      S.esfera(cu + (lado ? -1 : 1) * (ancho / 4 - 0.06), 1.15, 0.63, 0.016, '#b08d57', { mat: 'metal' });
    }
  } else if (id === 'freelance') {
    // estantería de cubos con canastos de tela y cosas
    const cols = Math.max(2, Math.round(ancho / 0.38));
    const filas = Math.floor(TECHO / 0.38);
    const lado = ancho / cols;
    S.caja(mid, 0, 0.012, ancho, TECHO, 0.02, t.fondo, { mat: 'estructura' });
    for (let f = 0; f <= filas; f++) S.caja(mid, f * 0.38, 0.2, ancho, 0.025, 0.4, t.estructura, { mat: 'estructura' });
    for (let c = 0; c <= cols; c++) S.caja(u0 + c * lado, 0, 0.2, 0.025, filas * 0.38, 0.4, t.estructura, { mat: 'estructura' });
    for (let f = 0; f < filas; f++)
      for (let c = 0; c < cols; c++) {
        const cu = u0 + (c + 0.5) * lado;
        const cy = f * 0.38 + 0.025;
        if (r.si(0.45)) S.caja(cu, cy, 0.22, lado - 0.06, 0.3, 0.34, r.de(['#cbb89d', '#8a9a8b', '#d9cfc1', '#6f7d8c']), { mat: 'tela', redondeo: 0.02 });
        else {
          const item = r.de(ctx.t.items);
          const prueba = ensayo(S);
          if (item(prueba, cu - lado / 2 + 0.04, cy, 0.2, 0.32, ctx)) {
            const [a, b] = prueba.limites();
            if (a >= cu - lado / 2 && b <= cu + lado / 2) prueba.volcar();
          }
        }
      }
  } else {
    // MBRF: puerta de cámara de frío con cortina de tiras
    S.caja(mid, 0, 0.06, ancho, TECHO, 0.12, '#e9ecef', { mat: 'plastico', redondeo: 0.006 });
    S.caja(mid, 0.02, 0.14, ancho - 0.2, 2.3, 0.06, '#d5dade', { mat: 'metal', redondeo: 0.01 });
    S.caja(mid - ancho * 0.25, 1.1, 0.19, 0.05, 0.3, 0.04, '#8d949c', { mat: 'metal', redondeo: 0.01 });
    for (let k = 0; k < Math.floor((ancho - 0.3) / 0.11); k++) S.caja(u0 + 0.2 + k * 0.11, 0.05, 0.2, 0.1, 2.2, 0.004, '#dfeaf0', { mat: 'vidrio' });
    S.caja(mid, 2.4, 0.15, 0.36, 0.12, 0.04, '#1a1c1f', { redondeo: 0.008 });
    S.etiqueta(mid, 2.42, 0.172, 0.3, 0.08, ctx.celda());
    S.caja(mid + 0.1, 2.45, 0.172, 0.04, 0.02, 0.004, '#59ff9c', { mat: 'brillo' });
  }
  ctx.plan.especiales = (ctx.plan.especiales ?? 0) + 1;
}

// Una unidad de pared entre u0 y u1: mueble real, estantería entera, o mueble bajo + panel + estantes.
function unidad(S, u0, u1, ctx, id) {
  const { r, plan } = ctx;
  if (plan.mueble.length && r.si(0.55)) {
    const real = tomarQueEntre(plan.mueble, { anchoMax: u1 - u0 - 0.06, altoMax: TECHO - 0.05, fondoMax: 0.8, girar: false });
    if (real) {
      const u = u0 + real.ancho / 2 + 0.03;
      ctx.colocarEnPared(S, real, u, 0, real.fondo / 2 + 0.01, true);
      // delante de un mueble profundo no va nada en el piso
      ctx.reservar(S, u0, u0 + real.ancho + 0.06);
      // lo que sobra al costado y arriba se cubre con estantes
      if (TECHO - real.alto > 0.45) estanteria(S, u0, u0 + real.ancho + 0.06, real.alto + 0.12, TECHO, ctx, 0.32);
      else S.caja(u, real.alto, 0.012, real.ancho + 0.06, TECHO - real.alto, 0.02, ctx.t.fondo, { mat: 'estructura' });
      S.caja(u, 0, 0.012, real.ancho + 0.06, real.alto, 0.02, ctx.t.fondo, { mat: 'estructura' });
      const resto = u0 + real.ancho + 0.06;
      if (u1 - resto > 0.35) unidad(S, resto, u1, { ...ctx, plan: { ...plan, mueble: [] } }, id);
      return;
    }
  }
  if ((plan.especiales ?? 0) < 2 && u1 - u0 > 0.9 && r.si(0.22)) {
    unidadEspecial(S, u0, u1, ctx, id);
    return;
  }
  const quierePanel = plan.pared.length > 0 ? 0.55 : 0.3;
  if (r.si(1 - quierePanel)) estanteria(S, u0, u1, 0, TECHO, ctx);
  else {
    muebleBajo(S, u0, u1, 0.9, ctx, true);
    panelPared(S, u0, u1, 0.9, 1.78, ctx, id);
    estanteria(S, u0, u1, 1.8, TECHO, ctx, Math.min(ctx.t.prof, 0.36));
  }
}

function llenarTramo(S, u0, u1, ctx, id) {
  let u = u0;
  while (u1 - u > 0.35) {
    let ancho = ctx.r.entre(0.8, 1.3);
    if (u1 - u - ancho < 0.5) ancho = u1 - u;
    unidad(S, u, u + ancho, ctx, id);
    u += ancho;
  }
}

// Cosa de piso delante de los estantes: real si queda alguno, si no una propia de la temática.
// Fondo de lo que hay contra la pared (estantes, muebles bajos de 0,5 m): las cosas del piso van
// delante de eso y no salen más de SALIENTE_PISO de la pared (el centro del pasillo queda libre).
const SALIENTE_PISO = 1.15;
const ANCHO_PISO = { laboratorio: 0.46, docencia: 0.2, freelance: 0.42, tecnico: 0.58, mbrf: 0.86 };

// Cosa de piso centrada en `u`, sólo si `cabe(u0, u1)`. Devuelve el borde final que ocupa, o null.
function cosaDePiso(S, u, ctx, id, cabe) {
  const { r, plan, t } = ctx;
  const base = Math.max(t.prof, 0.5) + 0.04;
  const foco = ctx.focoEn(S, u);
  const listaPiso = foco ? (plan.pisoPor.get(foco) ?? []) : plan.piso;
  const real = listaPiso.length && r.si(0.6) ? tomarQueEntre(listaPiso, { anchoMax: 1.2, altoMax: 2.3, fondoMax: SALIENTE_PISO - base, girar: false }) : null;
  if (real) {
    if (cabe(u - real.ancho / 2, u + real.ancho / 2)) {
      ctx.colocarEnPared(S, real, u, 0, base + real.fondo / 2);
      return u + real.ancho / 2;
    }
    listaPiso.push(real.id);
  }
  const mitad = (ANCHO_PISO[id] ?? 0.5) / 2;
  if (!cabe(u - mitad, u + mitad)) return null;
  const p = base + 0.2;
  const celda = ctx.celda;
  if (id === 'laboratorio') {
    // gabinetes de PC viejos esperando revisión, con bahías y botones
    for (let i = 0; i < 2; i++) {
      const gu = u - 0.11 + i * 0.22;
      const color = r.de(['#d6cfbd', '#2a2d33', '#cfcac0']);
      S.caja(gu, 0, p, 0.19, 0.43, 0.44, color, { redondeo: 0.01, ry: r.entre(-0.06, 0.06) });
      for (let b = 0; b < 3; b++) S.caja(gu, 0.33 - b * 0.048, p + 0.221, 0.15, 0.042, 0.004, b === 2 ? '#1f2227' : color === '#2a2d33' ? '#3a3e45' : '#c4bcaa', { redondeo: 0.002 });
      S.cil(gu, 0.1, p + 0.222, 0.012, 0.006, '#3a3e45', { rx: Math.PI / 2, mat: 'metal' });
      S.caja(gu + 0.05, 0.06, p + 0.222, 0.006, 0.006, 0.003, '#59ff9c', { mat: 'brillo' });
    }
    S.etiqueta(u - 0.11, 0.2, p + 0.224, 0.08, 0.05, celda(), { rz: 0.08 });
  } else if (id === 'docencia') {
    // cajas de archivo apiladas
    for (let i = 0; i < 2; i++) DOC.cajaArchivo(S, u - 0.07, i * 0.27, p, 0.3, ctx);
    return u + mitad;
  } else if (id === 'freelance') {
    for (let i = 0; i < 3; i++) FREE.cajaEnvio(S, u - 0.2, i * 0.25, p, 0.3, ctx);
    return u + mitad;
  } else if (id === 'tecnico') {
    const variante = r() * 3;
    if (variante < 1) {
      // PCs de clientes esperando, con su orden de trabajo
      S.caja(u, 0, p, 0.2, 0.44, 0.44, r.de(['#1f2329', '#2b2f36']), { redondeo: 0.008 });
      S.etiqueta(u, 0.3, p + 0.221, 0.08, 0.1, celda(), { rz: 0.1 });
    } else if (variante < 2) {
      // caja de impresora / monitor nueva
      S.caja(u, 0, p, 0.55, 0.42, 0.36, '#c9a46c', { mat: 'carton', redondeo: 0.005, ry: r.entre(-0.1, 0.1) });
      S.etiqueta(u - 0.1, 0.12, p + 0.181, 0.2, 0.2, celda());
    } else {
      // CRT viejo para desguace sobre una caja
      S.caja(u, 0, p, 0.4, 0.22, 0.4, '#b98d5a', { mat: 'carton', redondeo: 0.004 });
      S.caja(u, 0.22, p, 0.38, 0.34, 0.38, '#d8d1bf', { redondeo: 0.03 });
      S.caja(u, 0.25, p + 0.191, 0.3, 0.26, 0.004, '#101317', { mat: 'espejo' });
    }
  } else {
    // pallet con cajas
    S.caja(u, 0, p, 0.8, 0.13, 0.55, '#b48a57', { mat: 'estructura' });
    const filas = 1 + Math.floor(r() * 3);
    for (let f = 0; f < filas; f++) for (let c = 0; c < 2; c++) MB.cajaEtiquetada(S, u - 0.4 + c * 0.4, 0.13 + f * 0.28, p, 0.3, ctx);
    return u + mitad;
  }
  return u + mitad;
}

// Techo de cada temática (siempre sobre los costados, para no tapar la vista).
function techo(lote, largo, z0, ctx, id, xs = [-1, 1]) {
  const { r } = ctx;
  const zc = z0 - largo / 2;
  const tubo = { rx: Math.PI / 2, lados: 12 };
  for (const lado of xs) {
    if (id === 'laboratorio') {
      lote.caja(0.32, 0.05, largo, lado * 1.2, TECHO - 0.16, zc, '#9aa0a8', { mat: 'metal' });
      for (let k = 0; k < 5; k++) lote.cil(0.014, 0.014, largo, lado * (1.08 + k * 0.06), TECHO - 0.12, zc, r.de(['#1d4ed8', '#e5e7eb', '#111827', '#dc2626']), tubo);
    } else if (id === 'docencia') {
      for (let z = z0 - 0.6; z > z0 - largo; z -= 1.6) lote.caja(1.6, 0.16, 0.14, lado * 1.4, TECHO - 0.08, z, '#6e5137', { mat: 'estructura' });
    } else if (id === 'freelance') {
      for (let z = z0 - 0.4; z > z0 - largo + 0.2; z -= 0.22) lote.esfera(0.016, lado * 1.55, TECHO - 0.08 - Math.abs(Math.sin(z * 1.3)) * 0.12, z, '#ffe8a3', { mat: 'brillo', lados: 6 });
    } else if (id === 'tecnico') {
      for (let k = 0; k < 3; k++) lote.cil(0.022, 0.022, largo, lado * (1.5 + k * 0.08), TECHO - 0.05, zc, '#8a929c', { ...tubo, mat: 'metal' });
    } else {
      lote.cil(0.24, 0.24, largo, lado * 0.95, TECHO - 0.26, zc, '#b8bec6', { ...tubo, mat: 'metal', lados: 20 });
      lote.cil(0.05, 0.05, largo, lado * 1.6, TECHO - 0.1, zc, '#dc2626', { ...tubo, mat: 'metal' });
      lote.cil(0.04, 0.04, largo, lado * 1.75, TECHO - 0.1, zc, '#16a34a', { ...tubo, mat: 'metal' });
    }
  }
}

// Lámparas reales colgadas del techo, a los costados y repartidas a lo largo.
function lamparas(plan, z0, largo, xs, r) {
  if (!plan.techo.length) return;
  let k = 0;
  for (let z = z0 - 1.4; z > z0 - largo + 0.4; z -= r.entre(2.2, 3)) {
    const id = plan.techo[k % plan.techo.length];
    const [, h] = medida(id);
    const lado = xs[k % xs.length];
    const x = lado * (Math.abs(h) < 0.2 ? 0.6 : 1.05);
    // los muy largos se suben (el cable entra en el techo) para no bajar de 2,15 m
    const y = Math.max(ALTO - h, 2.15);
    plan.colocaciones.push({ id, x, y, z, giro: r.entre(0, Math.PI * 2) });
    plan.luces.push([x, y + 0.05, z]);
    k++;
  }
}

function contexto(id, r, plan) {
  const t = TEMAS[id] ?? TEMAS.laboratorio;
  const ctx = { id, r, t, plan, celda: contadorCeldas(r) };
  // objeto interactivo al que "pertenece" el punto u de la pared del pintor S (o null)
  ctx.focoEn = (S, u) => focoDe(plan, u, S.lado);
  plan.reservas ??= new Map();
  ctx.reservar = (S, u0, u1) => {
    if (!plan.reservas.has(S)) plan.reservas.set(S, []);
    plan.reservas.get(S).push([u0, u1]);
  };
  ctx.reservasDe = (S) => plan.reservas.get(S) ?? [];
  // ubica un modelo real contra una pared (u, y, p en el pintor S)
  ctx.colocarEnPared = (S, real, u, y, p, poblar = false) => {
    const [x, z] = S.xz(u, p);
    ctx.plan.colocaciones.push({ id: real.id, x, y, z, giro: S.giro + (real.girado ? Math.PI / 2 : 0) + r.entre(-0.06, 0.06) * (poblar ? 0 : 1), poblar });
  };
  return ctx;
}

// El objeto interactivo más cercano a (u, lado): en la misma pared hasta 1,9 m del borde de su
// hueco, o enfrente hasta 1 m.
function focoDe(plan, u, lado) {
  if (lado === undefined || lado === null) return plan.focoFijo ?? null;
  let mejor = null;
  let dist = Infinity;
  for (const o of plan.objetos) {
    const medio = (o.ancho ?? (HUECOS[o.modelo]?.[0] ?? 1.2)) / 2;
    const d = Math.max(0, Math.abs(u - o.a) - medio);
    const limite = o.lado === lado ? 1.9 : 1.0;
    if (d <= limite && d < dist) {
      dist = d;
      mejor = o.modelo;
    }
  }
  return mejor;
}

// Hueco de un objeto interactivo en la pared: [ancho, desde, hasta]. Si el objeto medido es más
// grande que lo previsto, manda la medida (así nada de encima lo atraviesa).
function huecoDe(o) {
  const [ancho, yMin, yMax] = HUECOS[o.modelo] ?? [1.2, 0, 2];
  return [Math.max(ancho, (o.ancho ?? 0) + 0.12), yMin, Math.max(yMax, (o.alto ?? 0) + 0.08)];
}

// ===== públicos =================================================================================

// Relleno de un pasillo (en el marco del grupo del pasillo). `objetos`: [{ a, lado, modelo }].
// `excluidos`: modelos reales que ya usa algún objeto con tooltip (no se repiten).
// Devuelve { grupo, plan } — plan.colocaciones son los modelos reales a cargar.
export function rellenarPasillo({ id, largo, vestibulo = 0, objetos, semilla, ultimo, materiales, excluidos = new Set() }) {
  const r = azar(semilla);
  const plan = crearPlan(id, r, excluidos);
  plan.objetos = objetos;
  const ctx = contexto(id, r, plan);
  const lote = new Lote();
  for (const lado of [-1, 1]) {
    // pared izquierda: x = -W2, normal +x; derecha: x = +W2, normal -x; u crece hacia -z
    const S = pintor(lote, lado * W2, 0, 0, -1, -lado, 0);
    S.lado = lado;
    const huecos = objetos
      .filter((o) => o.lado === lado)
      .map((o) => {
        const [ancho, yMin, yMax] = huecoDe(o);
        return { u0: o.a - ancho / 2 - 0.12, u1: o.a + ancho / 2 + 0.12, yMin, yMax };
      })
      .sort((a, b) => a.u0 - b.u0);
    // el vestíbulo (después del giro): sólo un mueble bajo con cosas, debajo del póster
    if (vestibulo > 1) muebleBajo(S, 0.3, vestibulo - 0.1, 0.78, ctx, true);
    let u = vestibulo + 0.18;
    const fin = ultimo ? largo - ANTESALA : largo - 0.02;
    for (const h of huecos) {
      if (h.u0 > u) llenarTramo(S, u, h.u0, ctx, id);
      // detrás del objeto, un fondo (que no se vea la pared); debajo, mueble bajo; arriba, estantes
      S.caja((h.u0 + h.u1) / 2, 0, 0.008, h.u1 - h.u0, h.yMax + 0.12, 0.012, ctx.t.fondo, { mat: 'estructura' });
      if (h.yMin >= 0.7) muebleBajo(S, h.u0, h.u1, h.yMin - 0.1, ctx);
      if (TECHO - h.yMax > 0.4) estanteria(S, h.u0, h.u1, h.yMax + 0.1, TECHO, ctx, 0.32);
      u = Math.max(u, h.u1);
    }
    if (fin > u) llenarTramo(S, u, fin, ctx, id);
    // piso, delante de los estantes
    const limite = ultimo ? largo - ANTESALA - 0.3 : largo - 0.4;
    let libreDesde = vestibulo + 0.6;
    const reservas = ctx.reservasDe(S);
    const cabe = (a, b) =>
      a >= libreDesde && b <= limite && !huecos.some((h) => a < h.u1 + 0.15 && b > h.u0 - 0.15) && !reservas.some(([x0, x1]) => a < x1 + 0.05 && b > x0 - 0.05);
    for (let pu = vestibulo + 1.0; pu < limite; pu += 0.35) {
      if (!r.si(0.55)) continue;
      const fin = cosaDePiso(S, pu, ctx, id, cabe);
      if (fin !== null) {
        libreDesde = fin + r.entre(0.3, 0.8);
        pu = libreDesde - 0.35;
      }
    }
  }
  techo(lote, ultimo ? largo - ANTESALA : largo, 0, ctx, id);
  lamparas(plan, 0, ultimo ? largo - ANTESALA : largo, [-1, 1], r);
  return { grupo: lote.construir(materiales), plan };
}

// Relleno del cruce (marco del grupo del cruce): la pared cerrada del costado y lo bajo de la de enfrente.
// Relleno del cruce: un rellano despejado y simétrico. La pared de enfrente (con el cartel del
// trabajo siguiente) y la del costado cerrado llevan el mismo revestimiento de listones verticales
// y un zócalo flotante con luz; nada de estanterías ni cosas en el piso.
export function rellenarCruce({ id, giro, semilla, materiales, plan }) {
  const r = azar(semilla);
  const ctx = contexto(id, r, plan);
  const { t } = ctx;
  const lote = new Lote();
  const lado = -giro;
  const listones = (S, u0, u1) => {
    S.caja((u0 + u1) / 2, 0, 0.012, u1 - u0, TECHO, 0.02, t.fondo, { mat: 'estructura' });
    for (let u = u0 + 0.05; u < u1 - 0.03; u += 0.1) S.caja(u, 0.14, 0.04, 0.05, TECHO - 0.14, 0.04, t.estructura, { mat: 'estructura', redondeo: 0.006 });
    // zócalo flotante con una línea de luz por debajo
    S.caja((u0 + u1) / 2, 0.05, 0.1, u1 - u0, 0.1, 0.16, t.fondo, { mat: 'estructura', redondeo: 0.008 });
    S.caja((u0 + u1) / 2, 0.035, 0.17, u1 - u0 - 0.04, 0.008, 0.01, '#fff3dc', { mat: 'brillo' });
  };
  // pared de enfrente, entera
  listones(pintor(lote, -W2, -W2, 1, 0, 0, 1), 0, ANCHO);
  // pared del costado cerrado, entera
  listones(pintor(lote, lado * W2, W2, 0, -1, -lado, 0), 0, ANCHO);
  return { grupo: lote.construir(materiales) };
}

// Superficies horizontales de un mueble real (estantes, tapa): se recorren sus triángulos una
// vez y se suma el área de los que miran hacia arriba en un histograma por altura (1 cm); cada
// altura con mucha área es un estante. Devuelve [{ y, x0, x1, z0, z1, libre }] en el espacio
// local del modelo (frente hacia +z).
export function superficies(modelo) {
  modelo.updateMatrixWorld(true);
  const inversa = new THREE.Matrix4().copy(modelo.matrixWorld).invert();
  const relativa = new THREE.Matrix4();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const n = new THREE.Vector3();
  const caja = new THREE.Box3();
  const bins = new Map();
  modelo.traverse((o) => {
    if (!o.isMesh) return;
    relativa.multiplyMatrices(inversa, o.matrixWorld);
    const pos = o.geometry.attributes.position;
    const indice = o.geometry.index;
    const total = indice ? indice.count : pos.count;
    for (let i = 0; i + 2 < total; i += 3) {
      a.fromBufferAttribute(pos, indice ? indice.getX(i) : i).applyMatrix4(relativa);
      b.fromBufferAttribute(pos, indice ? indice.getX(i + 1) : i + 1).applyMatrix4(relativa);
      c.fromBufferAttribute(pos, indice ? indice.getX(i + 2) : i + 2).applyMatrix4(relativa);
      caja.expandByPoint(a).expandByPoint(b).expandByPoint(c);
      n.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a));
      const largo = n.length();
      if (largo < 1e-8 || n.y / largo < 0.9) continue;
      const y = (a.y + b.y + c.y) / 3;
      const clave = Math.round(y * 100);
      let bin = bins.get(clave);
      if (!bin) bins.set(clave, (bin = { y, area: 0, x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity }));
      bin.area += largo / 2;
      bin.y = Math.max(bin.y, y);
      bin.x0 = Math.min(bin.x0, a.x, b.x, c.x);
      bin.x1 = Math.max(bin.x1, a.x, b.x, c.x);
      bin.z0 = Math.min(bin.z0, a.z, b.z, c.z);
      bin.z1 = Math.max(bin.z1, a.z, b.z, c.z);
    }
  });
  if (caja.isEmpty()) return [];
  const huella = (caja.max.x - caja.min.x) * (caja.max.z - caja.min.z);
  // bins vecinos (±2 cm) son el mismo estante
  const niveles = [];
  for (const clave of [...bins.keys()].sort((x, y) => x - y)) {
    const bin = bins.get(clave);
    const ultimo = niveles[niveles.length - 1];
    if (ultimo && clave - ultimo.clave <= 2) {
      ultimo.area += bin.area;
      ultimo.y = Math.max(ultimo.y, bin.y);
      ultimo.x0 = Math.min(ultimo.x0, bin.x0);
      ultimo.x1 = Math.max(ultimo.x1, bin.x1);
      ultimo.z0 = Math.min(ultimo.z0, bin.z0);
      ultimo.z1 = Math.max(ultimo.z1, bin.z1);
      ultimo.clave = clave;
    } else niveles.push({ ...bin, clave });
  }
  const validos = niveles.filter((nv) => nv.y > 0.08 && nv.area > huella * 0.12 && nv.x1 - nv.x0 > 0.2).sort((x, y) => x.y - y.y);
  validos.forEach((nv, i) => {
    nv.libre = (validos[i + 1]?.y ?? nv.y + 0.5) - nv.y - 0.03;
  });
  return validos.filter((nv) => nv.libre > 0.07).map(({ y, x0, x1, z0, z1, libre }) => ({ y, x0, x1, z0, z1, libre }));
}

// Llena las superficies de un mueble real con objetos reales que queden y objetos generados.
// Devuelve { grupo, colocaciones } en el espacio local del mueble.
export function poblarMueble({ id, modelo, plan, materiales, semilla, alturaMundo = 0, u = null, lado = null }) {
  const r = azar(semilla);
  const ctx = contexto(id, r, plan);
  // los estantes de un mueble son todos del objeto interactivo que tenga al lado (o de la temática)
  const foco = u === null ? null : focoDe(plan, u, lado);
  ctx.focoEn = () => foco;
  const lote = new Lote();
  const colocaciones = [];
  ctx.colocarEnPared = (S, real, u, y, p) => {
    const [x, z] = S.xz(u, p);
    colocaciones.push({ id: real.id, x, y, z, giro: S.giro + (real.girado ? Math.PI / 2 : 0) });
  };
  for (const n of superficies(modelo)) {
    const prof = n.z1 - n.z0;
    const hmax = Math.min(n.libre, TECHO - alturaMundo - n.y - 0.05, 0.5);
    if (prof < 0.12 || hmax < 0.07) continue;
    const S = pintor(lote, 0, n.z0, 1, 0, 0, 1);
    llenarTabla(S, n.x0 + 0.02, n.x1 - 0.02, n.y, prof / 2, prof, hmax, ctx, (real, u, p) => ctx.colocarEnPared(S, real, u, n.y, p), 0.5);
  }
  return { grupo: lote.construir(materiales), colocaciones };
}
