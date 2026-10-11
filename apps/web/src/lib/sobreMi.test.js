import test from 'node:test';
import assert from 'node:assert/strict';
import { dividirResaltado } from './resaltado.js';
import { indiceDeHito, progresoDeHito } from './hitoActivo.js';
import { mostrarVideo } from './fondoHito.js';

test('dividirResaltado: texto sin marcas es un único fragmento normal', () => {
  assert.deepEqual(dividirResaltado('hola mundo'), [{ texto: 'hola mundo', resaltado: false }]);
});

test('dividirResaltado: separa lo resaltado del resto', () => {
  assert.deepEqual(dividirResaltado('a **b** c'), [
    { texto: 'a ', resaltado: false },
    { texto: 'b', resaltado: true },
    { texto: ' c', resaltado: false },
  ]);
});

test('dividirResaltado: resaltado al principio y al final', () => {
  assert.deepEqual(dividirResaltado('**a** y **b**'), [
    { texto: 'a', resaltado: true },
    { texto: ' y ', resaltado: false },
    { texto: 'b', resaltado: true },
  ]);
});

test('dividirResaltado: una marca sin cerrar queda como texto literal', () => {
  assert.deepEqual(dividirResaltado('a **b'), [{ texto: 'a **b', resaltado: false }]);
  assert.deepEqual(dividirResaltado('a **b** c **d'), [
    { texto: 'a ', resaltado: false },
    { texto: 'b', resaltado: true },
    { texto: ' c **d', resaltado: false },
  ]);
});

test('dividirResaltado: vacío y marcas vacías no generan fragmentos', () => {
  assert.deepEqual(dividirResaltado(''), []);
  assert.deepEqual(dividirResaltado('****'), []);
});

test('indiceDeHito: reparte el progreso en tramos iguales', () => {
  assert.equal(indiceDeHito(0, 7), 0);
  assert.equal(indiceDeHito(0.5, 7), 3);
  assert.equal(indiceDeHito(0.999, 7), 6);
  assert.equal(indiceDeHito(1, 7), 6);
});

test('indiceDeHito: acota progreso fuera de rango, NaN y total inválido', () => {
  assert.equal(indiceDeHito(-0.2, 7), 0);
  assert.equal(indiceDeHito(1.4, 7), 6);
  assert.equal(indiceDeHito(Number.NaN, 7), 0);
  assert.equal(indiceDeHito(0.5, 0), 0);
});

test('progresoDeHito: cae dentro del tramo de su propio hito', () => {
  for (let i = 0; i < 7; i += 1) {
    assert.equal(indiceDeHito(progresoDeHito(i, 7), 7), i);
  }
});

test('mostrarVideo: sin foto el video va directo; con foto espera; sin video nunca', () => {
  const espera = 3;
  assert.equal(mostrarVideo({ imagen: '/a.jpg', video: '/a.mp4' }, 0, espera), false);
  assert.equal(mostrarVideo({ imagen: '/a.jpg', video: '/a.mp4' }, 2.9, espera), false);
  assert.equal(mostrarVideo({ imagen: '/a.jpg', video: '/a.mp4' }, 3, espera), true);
  assert.equal(mostrarVideo({ video: '/a.mp4' }, 0, espera), true);
  assert.equal(mostrarVideo({ imagen: '/a.jpg' }, 99, espera), false);
  assert.equal(mostrarVideo({}, 99, espera), false);
});
