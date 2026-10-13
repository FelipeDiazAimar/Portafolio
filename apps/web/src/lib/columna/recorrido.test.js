import test from 'node:test';
import assert from 'node:assert/strict';
import { longitudHasta } from './geometria.js';
import {
  OPCIONES_ESCRITORIO,
  OPCIONES_MOVIL,
  PESO_ESTANCIA,
  PESO_VIAJE,
  UMBRAL_IMAN,
  activoDe,
  anioEnViaje,
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

test('pesoTotal: 7 estancias y 6 viajes', () => {
  assert.equal(PESO_ESTANCIA, 1);
  assert.equal(PESO_VIAJE, 16.8);
  assert.ok(Math.abs(W - (7 * PESO_ESTANCIA + 6 * PESO_VIAJE)) < 1e-9);
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

test('imanDe: nada en estancias; en viajes decide por el umbral', () => {
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
