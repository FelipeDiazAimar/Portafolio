import test from 'node:test';
import assert from 'node:assert/strict';
import { dividirResaltado } from './resaltado.js';
import { partirEnRenglones } from './renglones.js';

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

test('partirEnRenglones: ningún renglón supera el ancho y no se pierde ni se repite texto', () => {
  const partes = dividirResaltado('Fui **ayudante de laboratorio** en la UTN y participé en la **reparación, instalación y desarme** de equipos.');
  const medir = (texto) => texto.length * 10;
  const renglones = partirEnRenglones(partes, 260, medir);
  assert.ok(renglones.length > 2);
  for (const renglon of renglones) {
    const ancho = renglon.reduce((suma, f) => suma + medir(f.texto), 0);
    assert.ok(ancho <= 260, `renglón de ${ancho}px`);
    assert.equal(renglon[0].texto, renglon[0].texto.trimStart());
    assert.equal(renglon.at(-1).texto, renglon.at(-1).texto.trimEnd());
  }
  const unido = renglones.map((r) => r.map((f) => f.texto).join('')).join(' ');
  assert.equal(unido, partes.map((p) => p.texto).join(''));
});

test('partirEnRenglones: conserva qué fragmentos van resaltados', () => {
  const renglones = partirEnRenglones(dividirResaltado('hola **mundo lindo** chau'), 1000, (t) => t.length);
  assert.deepEqual(renglones, [
    [
      { texto: 'hola ', resaltado: false },
      { texto: 'mundo lindo', resaltado: true },
      { texto: ' chau', resaltado: false },
    ],
  ]);
});

test('partirEnRenglones: una palabra más ancha que el renglón queda sola y no se rompe', () => {
  const renglones = partirEnRenglones(dividirResaltado('a supercalifragilistico b'), 50, (t) => t.length * 10);
  assert.deepEqual(renglones.map((r) => r.map((f) => f.texto).join('')), ['a', 'supercalifragilistico', 'b']);
});

test('partirEnRenglones: texto vacío no da renglones', () => {
  assert.deepEqual(partirEnRenglones([], 100, () => 1), []);
});
