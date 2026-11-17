// Taller compartido de los dioramas de "Sobre mí": una cámara, una escala, una base y un
// vocabulario de piezas para los siete hitos, así se leen como una sola familia.
//
// Todo se dibuja con el kit de anatomy-asset (scripts/hitos/kit, licencia MIT): sólidos con
// cuatro tonos, orden del pintor de atrás hacia adelante y de abajo hacia arriba, y cada línea
// termina en algo. Los colores son siempre tokens (clases `ac-*`), nunca un hex en un relleno.
import * as k from './kit/iso-kit.mjs';
import * as a from './kit/asset.mjs';
import * as G from './kit/lathe.mjs';

export { k, a, G };

export const ANCHO = 800;
export const ALTO = 600;
export const AZIMUT = 38; // las caras +x llevan los frentes (pantallas, puertas, placas)
export const ELEVACION = 31;
export const TORNILLO = 0.55;

// La isla: un zócalo y, encima, el piso. Todo lo demás se apoya en z = 0.
export const ISLA = { x: -66, y: -52, w: 132, d: 104, r: 12 };
export const ZOCALO_Z = -11;
export const PISO_Z = -3.4;

let P = { origin: [0, 0], scale: 1, azimuth: AZIMUT, elevation: ELEVACION };
export const proyeccion = () => P;
export function ponerProyeccion(nueva) {
  P = nueva;
}

export const en = (p) => k.iso(p, P);
export const S = (paths, estilo) => k.solidSvg(paths, estilo);
export const L = (d, estilo) => k.lineSvg(d, estilo);
export const D = (puntos, estilo) => k.dotsSvg(puntos, estilo);
export const ac = (nombre, svg) => `<g class="ac-${nombre}">${svg}</g>`;
export const fondoDe = ([x, y, z = 0]) => k.depthOf([x, y, z], P);
export const porFondo = (items, clave = (i) => i) => [...items].sort((p, q) => fondoDe(clave(p)) - fondoDe(clave(q)));
export const plano = (x, y, w, d, r = 0.6) => ({ x, y, w, d, r });
export const rad = (grados) => (grados * Math.PI) / 180;
export const dir = (grados) => [Math.cos(rad(grados)), Math.sin(rad(grados))];

// ---- sólidos de todos los días ----------------------------------------------------------
export const caja = (x, y, w, d, z, h, { r = 0.6, tono = 'hi', pasos = 3, bisel = 0.4, dentro = '', lit = false } = {}) =>
  S(k.slabOf({ x, y, w, d, r }, z, h, P, pasos, bisel), { tone: tono, inner: dentro, lit });
export const cil = (x, y, r, z, h, { tono = 'hi', pasos = 24, bisel = 0, dentro = '' } = {}) => S(k.cylinder(x, y, r, z, h, P, pasos, bisel), { tone: tono, inner: dentro });
export const sombra = (pl, z, desenfoque = 4) => `<path class="iso-halo" d="${k.haloOf(pl, z, 0.1, P)}" style="filter:blur(${desenfoque}px)"/>`;
export const costura = (pl, z, pasos = 3, tono = 'faint') => L(k.sideSeam(pl, z, P, pasos), { tone: tono });
export const aro = (x, y, r, z, tono = 'lo', pasos = 20) => L(k.ring(x, y, r, z, P, pasos), { tone: tono });
export const tornillos = (puntos, z, anillo = 1.2) =>
  L(puntos.map(([x, y]) => k.ring(x, y, anillo, z, P, 14)).join(''), { tone: 'lo' }) + D(puntos.map(([x, y]) => en([x, y, z])), { size: TORNILLO });
export const bola = (centro, r, tono = 'hi') => S(G.sphereOf(centro, r, P), { tone: tono });

// Contornos cerrados sobre caras verticales: x = const (frente +x) o y = const (lado +y).
export const caraX = (x, y0, y1, z0, z1) => k.pathOf([[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]].map(en), true);
export const caraY = (y, x0, x1, z0, z1) => k.pathOf([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]].map(en), true);
export const tramo = (p0, p1) => k.segment(p0, p1, P);
export const camino = (puntos, cerrado = false) => k.pathOf(puntos.map(en), cerrado);
// Renglones que hacen de texto impreso: terminan sobre la cara, a propósito.
export const renglones = (lineas, tono = 'lo') => L(lineas.map(([p0, p1]) => tramo(p0, p1)).join(''), { tone: tono, free: true });

// Texto apoyado en una cara: 'arriba' (sobre un plano horizontal) o en un frente vertical.
export function texto(en3, cara, contenido, { tam = 4, tono = 'mid', ancla = 'middle' } = {}) {
  const [x, y, z] = en3;
  const matriz = cara === 'arriba' ? k.topMatrix([x, y], z, P, 'y') : k.sideMatrix([x, y], z, P, cara === 'x' ? 'right' : 'left');
  return k.faceTextSvg(matriz, contenido, { size: tam, tone: tono, anchor: ancla });
}

// Prisma orientado: una caja girada sobre el piso (`giro` en grados) y/o inclinada.
// `eje` es la dirección en que se extruye; el polígono vive en el plano perpendicular.
export function prisma(origen, eje, u, poligono, s0, s1, estilo = {}) {
  const A = G.unit3(eje);
  const U = G.unit3(u);
  return S(G.prismOf(G.frameOf(origen, A, U, G.cross3(A, U)), poligono, s0, s1, P), { tone: 'hi', ...estilo });
}
// Cuerpo de revolución sobre cualquier eje (mangos, vasos, lámparas).
export const torno = (perfil, origen, eje, estilo = {}) => S(G.solidOf(perfil, G.frameAlong(origen, eje), P), { tone: 'hi', ...estilo });

// ---- la isla -----------------------------------------------------------------------------
// Zócalo oscuro, piso con bisel y una ranura perimetral. `material` colorea el piso.
export function isla({ material = null, losetas = 0 } = {}) {
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(ISLA, -4), ZOCALO_Z, 5, P)}"/>`];
  out.push(ac('zocalo', S(k.slabOf(ISLA, ZOCALO_Z, PISO_Z - ZOCALO_Z, P, 10), { tone: 'mid', inner: costura(ISLA, ZOCALO_Z + 2.4, 10) })));
  const piso = S(k.slabOf(ISLA, PISO_Z, -PISO_Z, P, 10, 1.1), { tone: 'mid' }) + L(k.planOutline(k.insetPlan(ISLA, 4.5), 0, P, 10), { tone: 'faint' });
  out.push(material ? ac(material, piso) : piso);
  if (losetas) {
    // juntas de losetas: salen de la ranura perimetral y terminan en ella
    const borde = k.insetPlan(ISLA, 4.5);
    const juntas = [];
    // cerca de una esquina la ranura es curva: la junta se acorta para terminar justo en ella
    const corte = (d) => (d < borde.r ? borde.r - Math.sqrt(borde.r ** 2 - (borde.r - d) ** 2) : 0);
    for (let x = borde.x + losetas; x < borde.x + borde.w - 1; x += losetas) {
      const c = corte(Math.min(x - borde.x, borde.x + borde.w - x));
      juntas.push(k.lineOnTop([x, borde.y + c], [x, borde.y + borde.d - c], 0, P));
    }
    for (let y = borde.y + losetas; y < borde.y + borde.d - 1; y += losetas) {
      const c = corte(Math.min(y - borde.y, borde.y + borde.d - y));
      juntas.push(k.lineOnTop([borde.x + c, y], [borde.x + borde.w - c, y], 0, P));
    }
    const lineas = L(juntas.join(''), { tone: 'faint' });
    out.push(`<g opacity="0.55">${material ? ac(material, lineas) : lineas}</g>`);
  }
  return out.join('');
}
// Extremos para el encuadre: la isla y, en altura, sólo la zona central (lo alto va al medio).
export const ZONA_ALTA = { x: -52, y: -46, w: 104, d: 76, r: 0 };
export const puntosIsla = (alto = 0) => [...k.boxCorners(ISLA, ZOCALO_Z, 0), ...k.boxCorners(ZONA_ALTA, alto, alto)];

// Escena: cada objeto se anota con el punto del piso que decide su orden, y se pintan de
// atrás hacia adelante. Dentro de un objeto, las piezas van de abajo hacia arriba.
export function escena() {
  const items = [];
  return {
    poner(clave, svg, sesgo = 0) {
      items.push({ clave, svg, sesgo });
    },
    armar: () =>
      [...items]
        .sort((p, q) => fondoDe(p.clave) + p.sesgo - (fondoDe(q.clave) + q.sesgo))
        .map((i) => i.svg)
        .join(''),
  };
}

// ---- piezas que se repiten entre escenas ---------------------------------------------------
// Arbusto redondo sobre un tronco corto.
export function arbusto(x, y, r = 5, z = 0) {
  return sombra(plano(x - r, y - r, 2 * r, 2 * r, r), z, 2.5) + ac('tronco', cil(x, y, 1, z, r * 0.9, { tono: 'lo', pasos: 10 })) + ac('cesped', bola([x, y, z + r * 1.55], r, 'hi'));
}
// Piedra de sendero.
export const laja = (x, y, r, z = 0) => caja(x - r, y - r, 2 * r, 2 * r, z, 0.9, { r: r * 0.45, tono: 'mid', bisel: 0.3 });

// Mesa: cuatro patas y una tapa. Lo que va encima se dibuja después, ordenado por fondo.
export function mesa(pl, alto, { grosor = 3, pata = 3, material = 'madera', travesano = true } = {}) {
  const patas = porFondo(k.corners(pl, pata / 2 + 1.2)).map(([x, y]) => caja(x - pata / 2, y - pata / 2, pata, pata, 0, alto - grosor, { r: 0.4, tono: 'lo', pasos: 2, bisel: 0 }));
  const faldon = travesano ? caja(pl.x + 2.4, pl.y + 2.4, pl.w - 4.8, pl.d - 4.8, alto - grosor - 3.2, 3.2, { r: 0.4, tono: 'lo', pasos: 2, bisel: 0 }) : '';
  const tapa = S(k.slabOf(pl, alto - grosor, grosor, P, 4, 0.6), { tone: 'mid', inner: costura(pl, alto - grosor + 1.1, 4) });
  return sombra(k.insetPlan(pl, 3), 0, 5) + patas.join('') + faldon + (material ? ac(material, tapa) : tapa);
}

// Puntos en grilla sobre una cara vertical (rejillas de parlante, ventilaciones, QR).
export const rejaX = (x, y0, z0, cols, filas, paso, estilo = { size: 0.45, tone: 'lo' }) =>
  D(Array.from({ length: cols * filas }, (_, i) => en([x, y0 + (i % cols) * paso, z0 + Math.floor(i / cols) * paso])), estilo);
export const rejaY = (y, x0, z0, cols, filas, paso, estilo = { size: 0.45, tone: 'lo' }) =>
  D(Array.from({ length: cols * filas }, (_, i) => en([x0 + (i % cols) * paso, y, z0 + Math.floor(i / cols) * paso])), estilo);

// Cable entre dos puntos, con caída (negativa = arco hacia arriba) y un punto en cada punta.
export function cable(p0, p1, { caida = 2, tono = 'lo', puntas = true, n = 12 } = {}) {
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    return [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t, p0[2] + (p1[2] - p0[2]) * t - caida * 4 * t * (1 - t)];
  });
  return L(camino(pts), { tone: tono }) + (puntas ? D([en(p0), en(p1)], { size: 0.7, tone: 'mid' }) : '');
}

// Notebook abierta mirando a +x: base con teclado y pantalla parada en el borde de atrás.
export function notebook(x, y, z, { w = 13, d = 19, alto = 13, acento = null, lineas = 4 } = {}) {
  const base = caja(x, y, w, d, z, 1, { r: 1, tono: 'hi', bisel: 0.3 });
  const teclado = L(k.planOutline(plano(x + 3.4, y + 1.6, w - 8, d - 3.2, 0.4), z + 1, P, 2), { tone: 'lo' }) + L(k.planOutline(plano(x + w - 3.6, y + d / 2 - 2.6, 2.4, 5.2, 0.4), z + 1, P, 2), { tone: 'faint' });
  const tapa = caja(x, y, 0.9, d, z + 1, alto, { r: 0.4, tono: 'hi', pasos: 2, bisel: 0 });
  return base + teclado + tapa + pantallaX(x + 0.9, y, y + d, z + 1, z + 1 + alto, { margen: 1, lineas, acento });
}

// Gabinete de PC parado, con el frente en +x.
export function torrePC(x, y, z, { w = 20, d = 9, alto = 20, acento = 'led' } = {}) {
  const X = x + w;
  return (
    caja(x, y, w, d, z, alto, { r: 0.8, tono: 'hi', dentro: costura(plano(x, y, w, d, 0.8), z + alto - 1.4, 3) }) +
    L(caraX(X, y + 1.4, y + d - 1.4, z + alto - 4.6, z + alto - 2.4) + caraX(X, y + 1.4, y + d - 1.4, z + alto - 7.6, z + alto - 5.4), { tone: 'lo' }) +
    rejaX(X, y + 2, z + 2.4, 4, 4, 1.6) +
    ac(acento, D([en([X, y + d / 2, z + alto - 9.6])], { size: 1.1, tone: 'lit' }))
  );
}

// Pantalla sobre una cara +x: marco, vidrio oscuro y renglones que hacen de contenido.
export function pantallaX(x, y0, y1, z0, z1, { margen = 1, lineas = 3, acento = null } = {}) {
  const vidrio = ac('celda', S(k.slabOf({ x, y: y0 + margen, w: 0.4, d: y1 - y0 - margen * 2, r: 0.3 }, z0 + margen, z1 - z0 - margen * 2, P, 2), { tone: 'hi' }));
  const filas = [];
  const alto = z1 - z0 - margen * 2;
  for (let i = 0; i < lineas; i++) {
    const z = z1 - margen - 1.6 - (i * (alto - 3.2)) / Math.max(1, lineas - 1);
    const largo = (y1 - y0 - margen * 2 - 2.4) * [0.82, 0.55, 0.7, 0.4, 0.62][i % 5];
    filas.push([[x + 0.4, y0 + margen + 1.2, z], [x + 0.4, y0 + margen + 1.2 + largo, z]]);
  }
  const contenido = renglones(filas, 'lit');
  return vidrio + (acento ? ac(acento, contenido) : contenido);
}

// Banqueta redonda de tres patas.
export function banqueta(x, y, { alto = 15, r = 8, material = 'madera' } = {}) {
  const patas = porFondo([[x - r * 0.55, y - r * 0.32], [x + r * 0.55, y - r * 0.32], [x, y + r * 0.62]]).map(([px, py]) => cil(px, py, 0.9, 0, alto, { tono: 'lo', pasos: 10 })).join('');
  const asiento = cil(x, y, r, alto, 2.4, { tono: 'mid', pasos: 32, bisel: 0.6 });
  return sombra(plano(x - r, y - r, 2 * r, 2 * r, r), 0, 4) + patas + (material ? ac(material, asiento) : asiento) + aro(x, y, r * 0.7, alto + 2.4, 'faint', 26);
}

// Pizarra parada, con la cara útil hacia +y (se ve a la izquierda): patas, tablero y bandeja.
// El contenido se dibuja después, sobre el plano y = `y + 1.2`.
export function pizarra(x0, x1, y, z0, z1, material = null) {
  const tablero = caja(x0, y, x1 - x0, 1.2, z0, z1 - z0, { r: 0.5, tono: 'hi', pasos: 2, bisel: 0, dentro: L(caraY(y + 1.2, x0 + 1.4, x1 - 1.4, z0 + 1.4, z1 - 1.4), { tone: 'faint' }) });
  return (
    sombra(plano(x0, y - 4, x1 - x0, 10, 2), 0, 4) +
    [x0 + 3, x1 - 3].map((x) => caja(x - 1.6, y - 4, 3.2, 10, 0, 1.2, { r: 0.5, tono: 'lo', pasos: 2, bisel: 0 }) + cil(x, y + 0.6, 0.8, 1.2, z0 - 1.2, { tono: 'lo', pasos: 10 })).join('') +
    (material ? ac(material, tablero) : tablero) +
    caja(x0 + 2, y + 1.2, x1 - x0 - 4, 1.8, z0 - 0.6, 0.8, { r: 0.3, tono: 'mid', pasos: 2, bisel: 0 })
  );
}

// Panel parado con una pantalla hacia +x (una "ventana" de sitio web): pie, marco y contenido.
export function ventana(x, y, { d = 17, z = 3, alto = 13, acento = null, lineas = 4 } = {}) {
  return (
    sombra(plano(x - 1, y, 6, d, 1), 0, 3) +
    caja(x - 1.6, y + 2, 5, d - 4, 0, 1.2, { r: 0.6, tono: 'lo', pasos: 2, bisel: 0 }) +
    cil(x + 0.5, y + d / 2, 0.8, 1.2, z - 1.2, { tono: 'lo', pasos: 10 }) +
    caja(x, y, 1, d, z, alto, { r: 0.5, tono: 'hi', pasos: 2, bisel: 0 }) +
    pantallaX(x + 1, y, y + d, z, z + alto, { margen: 0.9, lineas, acento }) +
    D([0, 1, 2].map((i) => en([x + 1.4, y + d - 1.8 - i * 1.3, z + alto - 0.5])), { size: 0.4, tone: 'mid' })
  );
}
