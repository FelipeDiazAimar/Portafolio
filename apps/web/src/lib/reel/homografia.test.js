import test from 'node:test';
import assert from 'node:assert/strict';
import { coeficientes, matrizCss, proyectar } from './homografia.js';

const cerca = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('homografía: las cuatro esquinas del cuadrado caen en las del cuadrilátero', () => {
  const cuad = [[120, 40], [610, 72], [588, 430], [96, 388]];
  const k = coeficientes(cuad);
  [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(([u, v], i) => {
    const [x, y] = proyectar(k, u, v);
    cerca(x, cuad[i][0]);
    cerca(y, cuad[i][1]);
  });
});

test('homografía: un rectángulo recto no tiene perspectiva (es un escalado y un traslado)', () => {
  const k = coeficientes([[10, 20], [210, 20], [210, 120], [10, 120]]);
  cerca(k.g, 0);
  cerca(k.h, 0);
  const [x, y] = proyectar(k, 0.5, 0.5);
  cerca(x, 110);
  cerca(y, 70);
  assert.equal(matrizCss(200, 100, [[10, 20], [210, 20], [210, 120], [10, 120]]), 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,10,20,0,1)');
});

test('homografía: con perspectiva, el centro se corre hacia el lado más lejano', () => {
  // el lado derecho es más corto: está más lejos, así que el centro queda pasada la mitad en x
  const k = coeficientes([[0, 0], [100, 20], [100, 80], [0, 100]]);
  const [x, y] = proyectar(k, 0.5, 0.5);
  assert.ok(x > 50, `x = ${x}`);
  cerca(y, 50);
});

test('homografía: un cuadrilátero degenerado no da matriz', () => {
  assert.equal(matrizCss(10, 10, [[0, 0], [10, 0], [20, 0], [30, 0]]), null);
});
