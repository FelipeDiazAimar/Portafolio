// Geometría de la columna vertebral de "Sobre mí" (unidades de escena). Funciones
// puras, sin three: las usan el mundo 3D, la cámara y el minimapa.

export const SEPARACION = 9;
export const RADIO_ANCLA = 3.5;
export const PASO_ANGULO = (140 * Math.PI) / 180;
export const AMPLITUD_S = 1.4;
export const RADIO_TUBO = 0.06;
export const RADIO_HALO = 0.2;
// La columna sigue un tramo antes del primer hito (cola) y otro después del último (punta).
export const EXTRA = SEPARACION;

// Alto entre la primera y la última vértebra.
export function altoTotal(n) {
  return SEPARACION * Math.max(n - 1, 1);
}

// La cola (el tramo antes del primer hito) no sube derecha hasta cortarse contra el borde de
// arriba de la pantalla: se inclina con suavidad hacia la izquierda, como un haz que se
// desprende de un costado (y además se desvanece: ver `uCola` en shaderColumna.js). Es nula
// en el primer hito y crece con derivada 0 al empezar.
export const DESVIO_COLA = 6;
function desvioCola(y) {
  if (y <= 0) return 0;
  const t = Math.min(1, y / EXTRA);
  return -DESVIO_COLA * t * t * (3 - 2 * t);
}

// Punto del eje de la columna a la altura `y`: una S suave en el espacio (no plana).
export function ejeEn(y, n) {
  const alto = altoTotal(n);
  return {
    x: AMPLITUD_S * Math.sin((2 * Math.PI * y) / alto) + desvioCola(y),
    y,
    z: AMPLITUD_S * 0.5 * Math.sin((Math.PI * y) / alto),
  };
}

export function vertebra(i, n) {
  return { centro: ejeEn(-i * SEPARACION, n), angulo: i * PASO_ANGULO };
}

// Dónde va el modelo del hito `i`: a RADIO_ANCLA del eje, en su ángulo. El modelo se
// rota `angulo` en y, así su +z local apunta hacia afuera de la columna.
export function ancla(i, n) {
  const { centro, angulo } = vertebra(i, n);
  return {
    posicion: { x: centro.x + RADIO_ANCLA * Math.sin(angulo), y: centro.y, z: centro.z + RADIO_ANCLA * Math.cos(angulo) },
    angulo,
  };
}

// Puntos para construir la curva (de la cola —arriba— a la punta —abajo—).
export function puntosColumna(n, cantidad = 64) {
  const desde = EXTRA;
  const hasta = -(altoTotal(n) + EXTRA);
  return Array.from({ length: cantidad }, (_, k) => ejeEn(desde + ((hasta - desde) * k) / (cantidad - 1), n));
}

// Largo acumulado del eje, muestreado fino, para pasar de altura a fracción del largo
// (la misma parametrización que usa TubeGeometry: `getPointAt`).
const MUESTRAS = 2048;
const tablas = new Map();
function tabla(n) {
  if (tablas.has(n)) return tablas.get(n);
  const desde = EXTRA;
  const hasta = -(altoTotal(n) + EXTRA);
  const ys = [];
  const acumulado = [0];
  let previo = ejeEn(desde, n);
  ys.push(desde);
  for (let k = 1; k <= MUESTRAS; k += 1) {
    const y = desde + ((hasta - desde) * k) / MUESTRAS;
    const p = ejeEn(y, n);
    acumulado.push(acumulado[k - 1] + Math.hypot(p.x - previo.x, p.y - previo.y, p.z - previo.z));
    ys.push(y);
    previo = p;
  }
  const t = { ys, acumulado, total: acumulado[MUESTRAS] };
  tablas.set(n, t);
  return t;
}

// Fracción [0,1] del largo de la columna hasta la altura `y`.
export function fraccionEnAltura(y, n) {
  const { ys, acumulado, total } = tabla(n);
  const paso = ys[1] - ys[0];
  const k = Math.min(MUESTRAS - 1, Math.max(0, Math.floor((y - ys[0]) / paso)));
  const resto = Math.min(1, Math.max(0, (y - ys[k]) / paso));
  return (acumulado[k] + (acumulado[k + 1] - acumulado[k]) * resto) / total;
}

// Fracción del largo a la altura de la vértebra `i`.
export function longitudHasta(i, n) {
  return fraccionEnAltura(-i * SEPARACION, n);
}

// Punto del eje en la fracción `f` del largo (inversa de fraccionEnAltura).
export function puntoEnFraccion(f, n) {
  const { ys, acumulado, total } = tabla(n);
  const objetivo = Math.min(1, Math.max(0, f)) * total;
  let bajo = 0;
  let alto = MUESTRAS;
  while (alto - bajo > 1) {
    const medio = (bajo + alto) >> 1;
    if (acumulado[medio] <= objetivo) bajo = medio;
    else alto = medio;
  }
  const tramo = acumulado[alto] - acumulado[bajo] || 1;
  const y = ys[bajo] + ((ys[alto] - ys[bajo]) * (objetivo - acumulado[bajo])) / tramo;
  return ejeEn(y, n);
}

// Lleva un punto del mundo de la columna a coordenadas de pantalla canónicas para el
// estado `s` (índice de hito fraccionario): el ancla del hito `s` queda en el origen
// mirando a +z. Mundo = T(0,0,-R) · Ry(-θ) · T(-c).
export function aPantalla(punto, s, n) {
  const c = ejeEn(-s * SEPARACION, n);
  const theta = s * PASO_ANGULO;
  const x = punto.x - c.x;
  const y = punto.y - c.y;
  const z = punto.z - c.z;
  const cos = Math.cos(-theta);
  const sin = Math.sin(-theta);
  return { x: x * cos + z * sin, y, z: -x * sin + z * cos - RADIO_ANCLA };
}

// Lo que necesitan los grupos del mundo 3D para el estado `s`.
export function transformacionMundo(s, n) {
  const c = ejeEn(-s * SEPARACION, n);
  return { pivote: [0, 0, -RADIO_ANCLA], rotacionY: -s * PASO_ANGULO, contenido: [-c.x, -c.y, -c.z] };
}

// Minimapa: la S proyectada en 2D (x lateral, el MÁXIMO arriba: hito 0 arriba del
// todo, hitos más nuevos hacia abajo). Devuelve el camino de la columna y la posición
// de cada hito en píxeles. El camino tiene PUNTOS_POR_TRAMO puntos entre dos hitos:
// el hito i es exactamente camino[i * PUNTOS_POR_TRAMO].
export const PUNTOS_POR_TRAMO = 8;
export function puntosMinimapa(n, { ancho, alto, margen = 10 }) {
  const minimo = -altoTotal(n);
  const maximo = 0;
  const aPx = (p) => ({
    x: ancho / 2 + (p.x / AMPLITUD_S) * (ancho / 2 - margen / 2),
    y: alto - margen - ((p.y - minimo) / (maximo - minimo)) * (alto - 2 * margen),
  });
  const cantidad = Math.max(n - 1, 1) * PUNTOS_POR_TRAMO + 1;
  const camino = Array.from({ length: cantidad }, (_, k) => aPx(ejeEn(maximo + ((minimo - maximo) * k) / (cantidad - 1), n)));
  const hitos = Array.from({ length: n }, (_, i) => aPx(vertebra(i, n).centro));
  return { camino, hitos };
}
