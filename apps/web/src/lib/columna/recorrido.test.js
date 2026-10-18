import test from 'node:test';
import assert from 'node:assert/strict';
import { longitudHasta } from './geometria.js';
import {
  OPCIONES_ESCRITORIO,
  OPCIONES_MOVIL,
  PESO_ESTANCIA,
  PESO_ULTIMA,
  ZONA_EMBUDO,
  RADIO_IMAN_ESTANCIA,
  PESO_VIAJE,
  UMBRAL_IMAN,
  activoDe,
  anioEnViaje,
  avanceDe,
  estadoDe,
  imanDe,
  llenadoDe,
  opacidadAnio,
  pesoTotal,
  poseCamara,
  poseCanonica,
  progresoDeEstancia,
  tramoDe,
} from './recorrido.js';

const N = 7;
const D = 6;
const W = pesoTotal(N);
// p del avance `t` dentro del viaje `i`
const pViaje = (i, t) => (i * (PESO_ESTANCIA + PESO_VIAJE) + PESO_ESTANCIA + t * PESO_VIAJE) / W;

test('pesoTotal: 7 estancias (la última más larga) y 6 viajes', () => {
  assert.equal(PESO_ESTANCIA, 4);
  assert.equal(PESO_VIAJE, 28);
  assert.ok(PESO_ULTIMA > PESO_ESTANCIA);
  assert.ok(Math.abs(W - (6 * PESO_ESTANCIA + PESO_ULTIMA + 6 * PESO_VIAJE)) < 1e-9);
});

test('tramoDe: extremos, rango y valores inválidos', () => {
  assert.deepEqual(tramoDe(0, N), { tipo: 'estancia', indice: 0, t: 0 });
  assert.equal(tramoDe(1, N).tipo, 'estancia');
  assert.equal(tramoDe(1, N).indice, N - 1);
  assert.deepEqual(tramoDe(-0.3, N), tramoDe(0, N));
  assert.deepEqual(tramoDe(1.7, N), tramoDe(1, N));
  assert.deepEqual(tramoDe(Number.NaN, N), tramoDe(0, N));
  assert.equal(tramoDe(0.5, 1).indice, 0);
});

test('tramoDe: reconoce viajes y su avance', () => {
  const tramo = tramoDe(pViaje(2, 0.25), N);
  assert.equal(tramo.tipo, 'viaje');
  assert.equal(tramo.indice, 2);
  assert.ok(Math.abs(tramo.t - 0.25) < 1e-9);
});

test('progresoDeEstancia: cae en el medio de su propia estancia', () => {
  for (let i = 0; i < N; i += 1) {
    const tramo = tramoDe(progresoDeEstancia(i, N), N);
    assert.equal(tramo.tipo, 'estancia');
    assert.equal(tramo.indice, i);
    assert.ok(Math.abs(tramo.t - 0.5) < 1e-9);
  }
});

test('estadoDe: entero en las estancias y monótono', () => {
  let previo = -Infinity;
  for (let k = 0; k <= 2000; k += 1) {
    const tramo = tramoDe(k / 2000, N);
    const s = estadoDe(tramo);
    if (tramo.tipo === 'estancia') assert.equal(s, tramo.indice);
    assert.ok(s >= previo - 1e-12);
    previo = s;
  }
});

test('estadoDe con movimiento reducido salta en la mitad del viaje', () => {
  assert.equal(estadoDe({ tipo: 'viaje', indice: 3, t: 0.49 }, { reducido: true }), 3);
  assert.equal(estadoDe({ tipo: 'viaje', indice: 3, t: 0.5 }, { reducido: true }), 4);
});

test('activoDe cambia en la mitad del viaje', () => {
  assert.equal(activoDe({ tipo: 'viaje', indice: 1, t: 0.49 }), 1);
  assert.equal(activoDe({ tipo: 'viaje', indice: 1, t: 0.5 }), 2);
  assert.equal(activoDe({ tipo: 'estancia', indice: 4, t: 0.1 }), 4);
});

test('llenadoDe: monótono y exacto en cada estancia', () => {
  let previo = -Infinity;
  for (let k = 0; k <= 2000; k += 1) {
    const tramo = tramoDe(k / 2000, N);
    const f = llenadoDe(tramo, N);
    if (tramo.tipo === 'estancia') assert.ok(Math.abs(f - longitudHasta(tramo.indice, N)) < 1e-12);
    assert.ok(f >= previo - 1e-12);
    previo = f;
  }
});

test('imanDe: con dirección, termina el viaje hacia donde se iba', () => {
  // En el medio del viaje manda la dirección.
  assert.equal(imanDe(pViaje(2, 0.3), N, 1), progresoDeEstancia(3, N));
  assert.equal(imanDe(pViaje(2, 0.7), N, -1), progresoDeEstancia(2, N));
  // Cerca de un hito manda la cercanía: pasarse de largo apenas no salta al siguiente.
  assert.equal(imanDe(pViaje(2, 0.05), N, 1), progresoDeEstancia(2, N));
  assert.equal(imanDe(pViaje(2, 0.95), N, -1), progresoDeEstancia(3, N));
  // Quieto en el centro de una estancia no hace nada.
  assert.equal(imanDe(progresoDeEstancia(3, N), N, 1), null);
});

test('imanDe: en estancias centra el hito cercano; en viajes decide por el umbral', () => {
  assert.equal(imanDe(progresoDeEstancia(3, N), N), null);
  assert.equal(imanDe(pViaje(2, UMBRAL_IMAN + 0.01), N), progresoDeEstancia(3, N));
  assert.equal(imanDe(pViaje(2, UMBRAL_IMAN - 0.01), N), progresoDeEstancia(2, N));
});

test('poseCamara: canónica en las estancias', () => {
  assert.deepEqual(poseCamara(tramoDe(progresoDeEstancia(2, N), N), D, N), poseCanonica(D));
});

for (const [nombre, opciones] of [
  ['escritorio', OPCIONES_ESCRITORIO],
  ['celular', OPCIONES_MOVIL],
]) {
  test('poseCamara (' + nombre + '): continua en todo el recorrido y dentro de los límites', () => {
    let previa = poseCamara(tramoDe(0, N), D, N, opciones);
    for (let k = 1; k <= 4000; k += 1) {
      const p = k / 4000;
      const pose = poseCamara(tramoDe(p, N), D, N, opciones);
      const salto = Math.hypot(...pose.posicion.map((v, j) => v - previa.posicion[j]));
      const saltoMira = Math.hypot(...pose.mira.map((v, j) => v - previa.mira[j]));
      assert.ok(salto < 0.6, 'la posición salta ' + salto + ' en p=' + p);
      assert.ok(saltoMira < 1.2, 'la mira salta ' + saltoMira + ' en p=' + p);
      assert.ok(Math.abs(pose.fov - previa.fov) < 1.5, 'el fov salta en p=' + p);
      assert.ok(Math.abs(pose.giroZ) <= opciones.alabeoMax + 1e-12);
      assert.ok(pose.fov >= 38 - 1e-9 && pose.fov <= opciones.fovMax + 1e-9);
      previa = pose;
    }
  });
}

test('anioEnViaje: cuenta entre años y cambia en la mitad con textos', () => {
  assert.equal(anioEnViaje('2022', '2023', 0), '2022');
  assert.equal(anioEnViaje('2022', '2026', 0.5), '2024');
  assert.equal(anioEnViaje('2022', '2023', 1), '2023');
  assert.equal(anioEnViaje('Origen', '2022', 0.49), 'Origen');
  assert.equal(anioEnViaje('Origen', '2022', 0.5), '2022');
  assert.equal(anioEnViaje('2026', 'Hoy', 0.7), 'Hoy');
});

test('opacidadAnio: invisible en los extremos, plena en el medio', () => {
  assert.equal(opacidadAnio(0), 0);
  assert.equal(opacidadAnio(0.5), 1);
  assert.equal(opacidadAnio(1), 0);
});

test('imanDe: cerca de un hito lo centra, y se puede salir de la sección por los extremos', () => {
  const desvio = (i, pesos) => progresoDeEstancia(i, N) + pesos / W;
  // Estancia del medio: centrada desde cualquier punto de su zona.
  assert.equal(imanDe(desvio(3, 1.2), N), progresoDeEstancia(3, N));
  assert.equal(imanDe(desvio(3, -1.7), N), progresoDeEstancia(3, N));
  assert.equal(imanDe(desvio(3, 0.02), N), null);
  // Primer hito: hacia arriba (salir de la sección) no tira para atrás; hacia abajo sí.
  assert.equal(imanDe(desvio(0, -1), N), null);
  assert.equal(imanDe(desvio(0, 1), N), progresoDeEstancia(0, N));
  // Último hito: frena cerca, y pasado el radio ya se sale.
  assert.equal(imanDe(desvio(N - 1, 2), N), progresoDeEstancia(N - 1, N));
  assert.equal(imanDe(desvio(N - 1, RADIO_IMAN_ESTANCIA + 0.5), N), null);
  assert.equal(imanDe(desvio(N - 1, -2), N), progresoDeEstancia(N - 1, N));
});

// --- Sentido del viaje: al subir la cámara mira hacia arriba (espejo de bajar). ---

const viaje = (indice, t, sentido) => ({ tipo: 'viaje', indice, t, sentido });

test('sentido: bajar es el comportamiento de siempre (sin `sentido` = +1)', () => {
  for (const t of [0, 0.1, 0.4, 0.8, 1]) {
    assert.deepEqual(estadoDe({ tipo: 'viaje', indice: 2, t }), estadoDe(viaje(2, t, 1)));
    assert.deepEqual(poseCamara({ tipo: 'viaje', indice: 2, t }, D, N), poseCamara(viaje(2, t, 1), D, N));
  }
  assert.equal(avanceDe(viaje(2, 0.3, 1)), 0.3);
  assert.equal(avanceDe(viaje(2, 0.3, -1)), 0.7);
});

test('sentido: subir espeja el estado del mundo (1 - giro) y no toca las estancias', () => {
  // Subiendo, el viaje arranca en el hito de abajo (t = 1) y termina en el de arriba (t = 0).
  assert.equal(estadoDe(viaje(2, 1, -1)), 3);
  assert.equal(estadoDe(viaje(2, 0, -1)), 2);
  for (const t of [0.2, 0.5, 0.9]) {
    assert.ok(Math.abs(estadoDe(viaje(2, t, -1)) - (3 - (estadoDe(viaje(2, 1 - t, 1)) - 2))) < 1e-12);
  }
  const estancia = { tipo: 'estancia', indice: 3, t: 0.5 };
  assert.deepEqual(poseCamara({ ...estancia, sentido: -1 }, D, N), poseCamara(estancia, D, N));
});

test('sentido: subiendo la primera persona mira hacia arriba y bajando, hacia abajo', () => {
  // A mitad de viaje (primera persona plena) la mira queda por encima o por debajo de la
  // posición según el sentido; la columna baja con el índice, así que arriba = y mayor.
  const bajando = poseCamara(viaje(2, 0.5, 1), D, N);
  const subiendo = poseCamara(viaje(2, 0.5, -1), D, N);
  assert.ok(bajando.mira[1] < bajando.posicion[1], 'bajando debería mirar hacia abajo');
  assert.ok(subiendo.mira[1] > subiendo.posicion[1], 'subiendo debería mirar hacia arriba');
});

test('sentido: poseCamara subiendo es continua en todo el viaje y sale/llega a la pose canónica', () => {
  let previa = poseCamara(viaje(2, 1, -1), D, N);
  assert.ok(Math.hypot(...previa.posicion.map((v, j) => v - poseCanonica(D).posicion[j])) < 1e-9);
  for (let k = 1; k <= 2000; k += 1) {
    const pose = poseCamara(viaje(2, 1 - k / 2000, -1), D, N);
    const salto = Math.hypot(...pose.posicion.map((v, j) => v - previa.posicion[j]));
    assert.ok(salto < 0.6, 'la posición salta ' + salto + ' en k=' + k);
    assert.ok(Math.abs(pose.fov - previa.fov) < 1.5, 'el fov salta en k=' + k);
    previa = pose;
  }
  assert.ok(Math.hypot(...previa.posicion.map((v, j) => v - poseCanonica(D).posicion[j])) < 1e-9);
});

test('ventanaDe: no deja saltear ningún hito', async () => {
  const { ventanaDe, progresoDeEstancia, tramoDe, pesoTotal } = await import('./recorrido.js');
  const n = 7;
  // en cada hito: de la estancia anterior a la siguiente
  for (let i = 0; i < n; i += 1) {
    const v = ventanaDe(progresoDeEstancia(i, n), n);
    assert.equal(v.min, i === 0 ? 0 : progresoDeEstancia(i - 1, n));
    assert.equal(v.max, i === n - 1 ? 1 : progresoDeEstancia(i + 1, n));
  }
  // en un viaje: los dos hitos que lo cierran
  const p = (progresoDeEstancia(2, n) + progresoDeEstancia(3, n)) / 2;
  assert.equal(tramoDe(p, n).tipo, 'viaje');
  const v = ventanaDe(p, n);
  assert.equal(v.min, progresoDeEstancia(2, n));
  assert.equal(v.max, progresoDeEstancia(3, n));
  assert.ok(pesoTotal(n) > 0);
});
