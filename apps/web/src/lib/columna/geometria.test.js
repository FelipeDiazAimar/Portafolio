import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AMPLITUD_S,
  EXTRA,
  PASO_ANGULO,
  PUNTOS_POR_TRAMO,
  RADIO_ANCLA,
  SEPARACION,
  altoTotal,
  ancla,
  aPantalla,
  ejeEn,
  fraccionEnAltura,
  longitudHasta,
  puntoEnFraccion,
  puntosColumna,
  puntosMinimapa,
  transformacionMundo,
  vertebra,
} from './geometria.js';

const N = 7;
const cerca = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

test('vertebra: una cada SEPARACION de altura y PASO_ANGULO de giro', () => {
  for (let i = 0; i < N; i += 1) {
    const v = vertebra(i, N);
    assert.ok(cerca(v.centro.y, -i * SEPARACION));
    assert.ok(cerca(v.angulo, i * PASO_ANGULO));
  }
});

test('ancla: a RADIO_ANCLA del eje, en el plano horizontal de su vértebra', () => {
  for (let i = 0; i < N; i += 1) {
    const { centro } = vertebra(i, N);
    const { posicion } = ancla(i, N);
    assert.ok(cerca(Math.hypot(posicion.x - centro.x, posicion.z - centro.z), RADIO_ANCLA));
    assert.ok(cerca(posicion.y, centro.y));
  }
});

test('ejeEn: la S nunca se aleja más que AMPLITUD_S y es continua', () => {
  let previo = ejeEn(-SEPARACION * N, N);
  for (let y = -SEPARACION * N; y <= SEPARACION; y += 0.05) {
    const p = ejeEn(y, N);
    assert.ok(Math.abs(p.x) <= AMPLITUD_S + 1e-9);
    assert.ok(Math.hypot(p.x - previo.x, p.z - previo.z) < 0.05);
    previo = p;
  }
});

test('longitudHasta: crece con el índice y deja cola y punta', () => {
  assert.ok(longitudHasta(0, N) > 0);
  assert.ok(longitudHasta(N - 1, N) < 1);
  for (let i = 1; i < N; i += 1) assert.ok(longitudHasta(i, N) > longitudHasta(i - 1, N));
});

test('puntoEnFraccion es la inversa de fraccionEnAltura', () => {
  for (const y of [5, 0, -4.5, -13, -30, -54, -60]) {
    const p = puntoEnFraccion(fraccionEnAltura(y, N), N);
    assert.ok(cerca(p.y, y, 1e-3), 'y=' + y + ' → ' + p.y);
  }
});

test('aPantalla: en el estado entero i el ancla i queda en el origen y su vértebra detrás', () => {
  for (let i = 0; i < N; i += 1) {
    const p = aPantalla(ancla(i, N).posicion, i, N);
    assert.ok(cerca(p.x, 0) && cerca(p.y, 0) && cerca(p.z, 0), JSON.stringify(p));
    const v = aPantalla(vertebra(i, N).centro, i, N);
    assert.ok(cerca(v.x, 0) && cerca(v.y, 0) && cerca(v.z, -RADIO_ANCLA));
  }
});

test('transformacionMundo coincide con aPantalla (rotación de three sobre y)', () => {
  const s = 2.4;
  const { pivote, rotacionY, contenido } = transformacionMundo(s, N);
  const q = ancla(3, N).posicion;
  const x = q.x + contenido[0];
  const z = q.z + contenido[2];
  // Object3D.rotation.y = a: x' = x·cos a + z·sin a ; z' = −x·sin a + z·cos a
  const cos = Math.cos(rotacionY);
  const sin = Math.sin(rotacionY);
  const esperado = aPantalla(q, s, N);
  assert.ok(cerca(x * cos + z * sin + pivote[0], esperado.x));
  assert.ok(cerca(-x * sin + z * cos + pivote[2], esperado.z));
  assert.ok(cerca(q.y + contenido[1] + pivote[1], esperado.y));
});

test('puntosColumna: de la cola a la punta, en orden', () => {
  const pts = puntosColumna(N, 64);
  assert.equal(pts.length, 64);
  assert.ok(cerca(pts[0].y, EXTRA));
  assert.ok(cerca(pts[63].y, -(altoTotal(N) + EXTRA)));
  for (let k = 1; k < pts.length; k += 1) assert.ok(pts[k].y <= pts[k - 1].y + 1e-9);
});

test('puntosMinimapa: todo dentro del recuadro y los hitos de arriba hacia abajo', () => {
  const { camino, hitos } = puntosMinimapa(N, { ancho: 28, alto: 220 });
  assert.equal(hitos.length, N);
  assert.ok(camino.length > 10);
  [...camino, ...hitos].forEach((p) => assert.ok(p.x >= 0 && p.x <= 28 && p.y >= 0 && p.y <= 220));
  for (let i = 1; i < N; i += 1) assert.ok(hitos[i].y > hitos[i - 1].y);
  for (let i = 0; i < N; i += 1) {
    assert.ok(cerca(camino[i * PUNTOS_POR_TRAMO].x, hitos[i].x) && cerca(camino[i * PUNTOS_POR_TRAMO].y, hitos[i].y));
  }
});
