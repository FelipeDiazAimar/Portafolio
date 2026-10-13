// Scroll → recorrido por la columna. El progreso de la sección [0,1] se reparte en
// estancias (quieto en un hito) y viajes (de un hito al siguiente) alternados:
// E0 V0 E1 V1 … E(n-1). Funciones puras: las usan la sección, la cámara y los tests.
import { RADIO_ANCLA, aPantalla, longitudHasta, puntoEnFraccion } from './geometria.js';

export const PESO_ESTANCIA = 1;
// Los viajes pesan más para darles ~9.9x más scroll que a las estancias.
export const PESO_VIAJE = 9.9;
// Desde qué avance de un viaje el imán lleva al hito siguiente (antes, al anterior).
export const UMBRAL_IMAN = 0.35;

const acotar = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const mezclar = (a, b, t) => a + (b - a) * t;
const mezclar3 = (a, b, t) => [mezclar(a[0], b[0], t), mezclar(a[1], b[1], t), mezclar(a[2], b[2], t)];
// smootherstep: arranca y frena sin tirones (primera y segunda derivada nulas en los bordes).
export function suavizado(t) {
  const x = acotar(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

export function pesoTotal(n) {
  return n * PESO_ESTANCIA + Math.max(n - 1, 0) * PESO_VIAJE;
}

// { tipo: 'estancia'|'viaje', indice, t }. En un viaje, `indice` es el hito de abajo
// (el de menor índice) y `t` el avance hacia el siguiente.
export function tramoDe(p, n) {
  if (n <= 1) return { tipo: 'estancia', indice: 0, t: Number.isFinite(p) ? acotar(p) : 0 };
  let x = (Number.isFinite(p) ? acotar(p) : 0) * pesoTotal(n);
  for (let i = 0; i < n; i += 1) {
    if (x < PESO_ESTANCIA || i === n - 1) return { tipo: 'estancia', indice: i, t: acotar(x / PESO_ESTANCIA) };
    x -= PESO_ESTANCIA;
    if (x < PESO_VIAJE) return { tipo: 'viaje', indice: i, t: x / PESO_VIAJE };
    x -= PESO_VIAJE;
  }
  return { tipo: 'estancia', indice: n - 1, t: 1 };
}

// Cuánto giró/avanzó la columna dentro de un viaje: casi nada en el despegue y todo
// entre el medio y la llegada.
export function giroDe(t) {
  return suavizado((t - 0.15) / 0.75);
}

// Estado continuo `s` (índice de hito fraccionario) que ubica al mundo.
export function estadoDe(tramo, { reducido = false } = {}) {
  if (tramo.tipo === 'estancia') return tramo.indice;
  if (reducido) return tramo.indice + (tramo.t < 0.5 ? 0 : 1);
  return tramo.indice + giroDe(tramo.t);
}

// Hito cuyo contenido (escena, fondo, textos) manda.
export function activoDe(tramo) {
  if (tramo.tipo === 'estancia') return tramo.indice;
  return tramo.t < 0.5 ? tramo.indice : tramo.indice + 1;
}

// Fracción encendida de la columna.
export function llenadoDe(tramo, n) {
  const desde = longitudHasta(tramo.indice, n);
  if (tramo.tipo === 'estancia') return desde;
  return mezclar(desde, longitudHasta(tramo.indice + 1, n), tramo.t);
}

export function progresoDeEstancia(i, n) {
  return (i * (PESO_ESTANCIA + PESO_VIAJE) + PESO_ESTANCIA / 2) / pesoTotal(n);
}

// Adónde llevar el scroll cuando el usuario lo suelta: sólo actúa en un viaje (las
// estancias son zonas de descanso). Devuelve null si no hay que mover nada.
export function imanDe(p, n) {
  const tramo = tramoDe(p, n);
  if (tramo.tipo === 'estancia') return null;
  return progresoDeEstancia(tramo.t >= UMBRAL_IMAN ? tramo.indice + 1 : tramo.indice, n);
}

// Pose de la cámara (en coordenadas de pantalla canónicas: el mundo ya está
// transformado por estadoDe). `d` = distancia de la pose canónica (vistaParaAltura).
export const FOV_BASE = 38;
export const OPCIONES_ESCRITORIO = { alabeoMax: (12 * Math.PI) / 180, fovMax: 55, distanciaPrimera: 1.4 };
export const OPCIONES_MOVIL = { alabeoMax: 0, fovMax: 46, distanciaPrimera: 2.2 };

export function poseCanonica(d) {
  return { posicion: [0, d * 0.116, d * 0.993], mira: [0, 0, 0], fov: FOV_BASE, giroZ: 0 };
}

function poseAlejada(d) {
  return { posicion: [0, d * 0.116 + 3, d * 1.6], mira: [0, 1.5, -RADIO_ANCLA], fov: FOV_BASE, giroZ: 0 };
}

// En primera persona: pegada a la columna, un poco por detrás de la cabeza de luz y
// mirando hacia adelante por la curva.
function posePrimera(tramo, n, opciones) {
  const s = estadoDe(tramo);
  const f = llenadoDe(tramo, n);
  const cabeza = aPantalla(puntoEnFraccion(f, n), s, n);
  const adelante = aPantalla(puntoEnFraccion(f + 0.02, n), s, n);
  let tx = adelante.x - cabeza.x;
  let ty = adelante.y - cabeza.y;
  let tz = adelante.z - cabeza.z;
  const largo = Math.hypot(tx, ty, tz) || 1;
  tx /= largo;
  ty /= largo;
  tz /= largo;
  const dp = opciones.distanciaPrimera;
  const posicion = [cabeza.x - tx * 2 + 0, cabeza.y - ty * 2 + dp * 0.35, cabeza.z - tz * 2 + dp];
  const mira = [cabeza.x + tx * 6, cabeza.y + ty * 6, cabeza.z + tz * 6];
  const giroZ = acotar(-tx * 0.8, -opciones.alabeoMax, opciones.alabeoMax);
  const fov = mezclar(FOV_BASE, opciones.fovMax, suavizado((tramo.t - 0.2) / 0.3) * (1 - suavizado((tramo.t - 0.65) / 0.25)));
  return { posicion, mira, fov, giroZ };
}

function mezclarPose(a, b, t) {
  return {
    posicion: mezclar3(a.posicion, b.posicion, t),
    mira: mezclar3(a.mira, b.mira, t),
    fov: mezclar(a.fov, b.fov, t),
    giroZ: mezclar(a.giroZ, b.giroZ, t),
  };
}

export function poseCamara(tramo, d, n, opciones = OPCIONES_ESCRITORIO) {
  const canonica = poseCanonica(d);
  if (tramo.tipo === 'estancia') return canonica;
  const t = tramo.t;
  const primera = posePrimera(tramo, n, opciones);
  // Despegue: se aleja (0 → 0.2). Entrada en primera persona (0.2 → 0.35).
  if (t < 0.2) return mezclarPose(canonica, poseAlejada(d), suavizado(t / 0.2));
  if (t < 0.35) return mezclarPose(poseAlejada(d), primera, suavizado((t - 0.2) / 0.15));
  if (t < 0.8) return primera;
  // Llegada: de la primera persona a la pose canónica del hito siguiente.
  return mezclarPose(primera, canonica, suavizado((t - 0.8) / 0.2));
}

// Año que se muestra durante el viaje: cuenta del origen al destino si los dos son
// números; si no ("Origen", "Hoy"), cambia en la mitad.
export function anioEnViaje(desde, hasta, t) {
  const a = Number(desde);
  const b = Number(hasta);
  if (Number.isInteger(a) && Number.isInteger(b) && String(desde).trim() !== '' && String(hasta).trim() !== '') {
    return String(Math.round(mezclar(a, b, acotar((t - 0.2) / 0.6))));
  }
  return t < 0.5 ? String(desde) : String(hasta);
}

export function opacidadAnio(t) {
  return Math.min(acotar((t - 0.1) / 0.15), 1 - acotar((t - 0.75) / 0.15));
}
