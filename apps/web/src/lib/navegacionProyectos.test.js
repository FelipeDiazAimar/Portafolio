import test from 'node:test';
import assert from 'node:assert/strict';
import { moverIndice, indicePorTecla } from './navegacionProyectos.js';

test('moverIndice: casos básicos con 13 proyectos', () => {
  assert.equal(moverIndice(12, 13, 1), 0);
  assert.equal(moverIndice(0, 13, -1), 12);
  assert.equal(moverIndice(3, 13, 0), 3);
  assert.equal(moverIndice(0, 0, 1), 0);
});

test('indicePorTecla: ArrowDown y ArrowRight avanzan con vuelta', () => {
  assert.equal(indicePorTecla('ArrowDown', 5, 13), 6);
  assert.equal(indicePorTecla('ArrowRight', 5, 13), 6);
  assert.equal(indicePorTecla('ArrowDown', 12, 13), 0);
  assert.equal(indicePorTecla('ArrowRight', 12, 13), 0);
});

test('indicePorTecla: ArrowUp y ArrowLeft retroceden con vuelta', () => {
  assert.equal(indicePorTecla('ArrowUp', 5, 13), 4);
  assert.equal(indicePorTecla('ArrowLeft', 5, 13), 4);
  assert.equal(indicePorTecla('ArrowUp', 0, 13), 12);
  assert.equal(indicePorTecla('ArrowLeft', 0, 13), 12);
});

test('indicePorTecla: Home va al inicio y End va al final', () => {
  assert.equal(indicePorTecla('Home', 5, 13), 0);
  assert.equal(indicePorTecla('Home', 0, 13), 0);
  assert.equal(indicePorTecla('End', 5, 13), 12);
  assert.equal(indicePorTecla('End', 0, 13), 12);
});

test('indicePorTecla: tecla desconocida devuelve null', () => {
  assert.equal(indicePorTecla('Enter', 5, 13), null);
  assert.equal(indicePorTecla('a', 5, 13), null);
  assert.equal(indicePorTecla('Escape', 0, 13), null);
});
