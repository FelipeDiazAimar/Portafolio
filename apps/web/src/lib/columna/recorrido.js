// Scroll → recorrido por la columna. El progreso de la sección [0,1] se reparte en
// estancias (quieto en un hito) y viajes (de un hito al siguiente) alternados:
// E0 V0 E1 V1 … E(n-1). Funciones puras: las usan la sección, la cámara y los tests.
import { RADIO_ANCLA, aPantalla, longitudHasta, puntoEnFraccion } from './geometria.js';

// Cada estancia es la zona de descanso de un hito: cuanto más ancha, más fácil es
// quedarse quieto en ella (con 1, eran ~55 svh de scroll y se pasaba de largo).
export const PESO_ESTANCIA = 4;
// El último hito es el final del recorrido: su zona es mucho más larga para que el scroll
// frene ahí (con la inercia de la rueda, una zona corta se pasaba de largo y se salía de la
// sección sin haber visto el grafo).
export const PESO_ULTIMA = 12;

function pesoEstanciaDe(i, n) {
  return n > 1 && i === n - 1 ? PESO_ULTIMA : PESO_ESTANCIA;
}
// Los viajes pesan mucho más que las estancias: son el recorrido cinematográfico.
export const PESO_VIAJE = 28;
// Desde qué avance de un viaje el imán lleva al hito siguiente (antes, al anterior).
export const UMBRAL_IMAN = 0.35;
// Estando quieto en la zona de un hito, el imán lo centra si se está a menos de este
// desvío (en pesos de recorrido; ~55 svh cada uno) y a más de un desvío mínimo.
export const RADIO_IMAN_ESTANCIA = 3;
// Fracción de cada extremo de un viaje en que el imán lleva siempre al hito más cercano.
export const ZONA_EMBUDO = 0.15;
const DESVIO_MINIMO = 0.08;

const acotar = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const mezclar = (a, b, t) => a + (b - a) * t;
const mezclar3 = (a, b, t) => [mezclar(a[0], b[0], t), mezclar(a[1], b[1], t), mezclar(a[2], b[2], t)];
// smootherstep: arranca y frena sin tirones (primera y segunda derivada nulas en los bordes).
export function suavizado(t) {
  const x = acotar(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

export function pesoTotal(n) {
  if (n <= 1) return Math.max(n, 0) * PESO_ESTANCIA;
  return (n - 1) * PESO_ESTANCIA + PESO_ULTIMA + (n - 1) * PESO_VIAJE;
}

// { tipo: 'estancia'|'viaje', indice, t }. En un viaje, `indice` es el hito de abajo
// (el de menor índice) y `t` el avance hacia el siguiente.
export function tramoDe(p, n) {
  if (n <= 1) return { tipo: 'estancia', indice: 0, t: Number.isFinite(p) ? acotar(p) : 0 };
  let x = (Number.isFinite(p) ? acotar(p) : 0) * pesoTotal(n);
  for (let i = 0; i < n; i += 1) {
    const estancia = pesoEstanciaDe(i, n);
    if (x < estancia || i === n - 1) return { tipo: 'estancia', indice: i, t: acotar(x / estancia) };
    x -= estancia;
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
//
// `tramo.sentido` (+1 bajando, -1 subiendo; ausente = +1) es el sentido del VIAJE entero entre
// dos hitos: lo fija quien arma el tramo al salir de un hito y se conserva hasta llegar a otro
// (retroceder a mitad de camino no lo invierte). Al subir, el viaje se hace de abajo hacia
// arriba: su perfil (despegue, primera persona, llegada) es el espejo del de bajar.
export const sentidoDe = (tramo) => ((tramo.sentido ?? 1) >= 0 ? 1 : -1);
// Avance del viaje en el sentido en que se hace (0 = recién salió del hito de origen).
export const avanceDe = (tramo) => (sentidoDe(tramo) > 0 ? tramo.t : 1 - tramo.t);

export function estadoDe(tramo, { reducido = false } = {}) {
  if (tramo.tipo === 'estancia') return tramo.indice;
  if (reducido) return tramo.indice + (tramo.t < 0.5 ? 0 : 1);
  if (sentidoDe(tramo) < 0) return tramo.indice + 1 - giroDe(1 - tramo.t);
  return tramo.indice + giroDe(tramo.t);
}

// Igual que estadoDe pero sin pausas ni frenadas en cada hito: avanza parejo de uno a otro.
// Es el de los saltos largos del minimapa, donde frenar y arrancar en cada hito que se cruza
// se sentía a tirones.
export function estadoLineal(tramo) {
  return tramo.tipo === 'estancia' ? tramo.indice : tramo.indice + tramo.t;
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

// Progreso de scroll que corresponde al estado continuo `s` (índice de hito fraccionario)
// SALTEANDO las estancias: de un hito al siguiente sólo se recorre el viaje. Es lo que usa el
// salto largo del minimapa para pasar por cada hito sin frenar en su zona de reposo.
export function progresoDeEstado(s, n) {
  const i = Math.min(Math.max(Math.floor(s), 0), Math.max(n - 2, 0));
  const t = Math.min(1, Math.max(0, s - i));
  return (i * (PESO_ESTANCIA + PESO_VIAJE) + PESO_ESTANCIA + t * PESO_VIAJE) / pesoTotal(n);
}

export function progresoDeEstancia(i, n) {
  return (i * (PESO_ESTANCIA + PESO_VIAJE) + pesoEstanciaDe(i, n) / 2) / pesoTotal(n);
}

// Adónde llevar el scroll cuando el usuario lo suelta: sólo actúa en un viaje (las
// estancias son zonas de descanso). Devuelve null si no hay que mover nada.
// En el medio de un viaje, `direccion` (+1 bajando, -1 subiendo) lo termina hacia el hito al
// que se iba (sin dirección decide por el umbral); cerca de cada extremo manda la cercanía.
export function imanDe(p, n, direccion = 0) {
  const tramo = tramoDe(p, n);
  if (tramo.tipo === 'estancia') {
    // Cerca de un hito: lleva al centro de su zona. Se puede salir de la sección por los
    // extremos (hacia arriba desde el primero; hacia abajo desde el último, pasado el radio).
    const desvio = (tramo.t - 0.5) * pesoEstanciaDe(tramo.indice, n);
    if (Math.abs(desvio) < DESVIO_MINIMO || Math.abs(desvio) > RADIO_IMAN_ESTANCIA) return null;
    if (tramo.indice === 0 && desvio < 0) return null;
    return progresoDeEstancia(tramo.indice, n);
  }
  // Embudo: recién salido de un hito (o por llegar a otro) vuelve/sigue hasta él, sin
  // importar para dónde se venía scrolleando. Pasarse de largo apenas no lo salta.
  if (tramo.t < ZONA_EMBUDO) return progresoDeEstancia(tramo.indice, n);
  if (tramo.t > 1 - ZONA_EMBUDO) return progresoDeEstancia(tramo.indice + 1, n);
  if (direccion > 0) return progresoDeEstancia(tramo.indice + 1, n);
  if (direccion < 0) return progresoDeEstancia(tramo.indice, n);
  return progresoDeEstancia(tramo.t >= UMBRAL_IMAN ? tramo.indice + 1 : tramo.indice, n);
}

// Barrera de un gesto de scroll: hasta dónde se puede llegar desde el punto `p` sin soltar. Nunca se pasa
// del centro de la estancia del hito vecino: no hay forma de saltearse un hito (hay que parar en cada uno,
// y el imán lo estaciona). En una estancia, los vecinos son el anterior y el siguiente; en un viaje, los dos
// hitos que lo cierran. Más allá del primero y del último no hay tope (se sale de la sección).
export function ventanaDe(p, n) {
  const tramo = tramoDe(p, n);
  const desde = tramo.tipo === 'estancia' ? tramo.indice - 1 : tramo.indice;
  const hasta = tramo.tipo === 'estancia' ? tramo.indice + 1 : tramo.indice + 1;
  return {
    min: desde < 0 ? 0 : progresoDeEstancia(desde, n),
    max: hasta > n - 1 ? 1 : progresoDeEstancia(hasta, n),
  };
}

// Pose de la cámara (en coordenadas de pantalla canónicas: el mundo ya está
// transformado por estadoDe). `d` = distancia de la pose canónica (vistaParaAltura).
export const FOV_BASE = 38;
export const OPCIONES_ESCRITORIO = { alabeoMax: (12 * Math.PI) / 180, fovMax: 55, distanciaPrimera: 1.4 };
export const OPCIONES_MOVIL = { alabeoMax: 0, fovMax: 46, distanciaPrimera: 2.2 };

export function poseCanonica(d) {
  return { posicion: [0, d * 0.116, d * 0.993], mira: [0, 0, 0], fov: FOV_BASE, giroZ: 0 };
}

// Pose alejada de la cámara (la del despegue): también es la de los saltos largos del
// minimapa, donde no hay primera persona.
export function poseAlejada(d) {
  return { posicion: [0, d * 0.116 + 3, d * 1.6], mira: [0, 1.5, -RADIO_ANCLA], fov: FOV_BASE, giroZ: 0 };
}

// En primera persona: pegada a la columna, un poco por detrás de la cabeza de luz y
// mirando hacia adelante por la curva: hacia abajo al bajar y hacia arriba al subir.
function posePrimera(tramo, n, opciones) {
  const s = estadoDe(tramo);
  const f = llenadoDe(tramo, n);
  const cabeza = aPantalla(puntoEnFraccion(f, n), s, n);
  const adelante = aPantalla(puntoEnFraccion(f + sentidoDe(tramo) * 0.02, n), s, n);
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
  const avance = avanceDe(tramo);
  const fov = mezclar(FOV_BASE, opciones.fovMax, suavizado((avance - 0.2) / 0.3) * (1 - suavizado((avance - 0.65) / 0.25)));
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
  const t = avanceDe(tramo);
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
