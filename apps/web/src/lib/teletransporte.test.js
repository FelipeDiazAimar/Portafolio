import test from 'node:test';
import assert from 'node:assert/strict';
import { crearMaquina, destinoDeScroll } from './teletransporte.js';

test('destino: inicio es 0 y una sección es su top + scroll menos su margen', () => {
  const medir = (id) => ({ sobre: { top: 1200, margen: 0 }, proyectos: { top: -300, margen: 80 } })[id] ?? null;
  assert.equal(destinoDeScroll('inicio', 500, medir), 0);
  assert.equal(destinoDeScroll('sobre', 500, medir), 1700);
  assert.equal(destinoDeScroll('proyectos', 2000, medir), 1620);
  assert.equal(destinoDeScroll('nada', 0, medir), null);
});

test('destino: no pasa del máximo ni baja de 0', () => {
  const medir = () => ({ top: 5000, margen: 0 });
  assert.equal(destinoDeScroll('x', 0, medir, 3000), 3000);
  assert.equal(destinoDeScroll('x', 0, () => ({ top: -50, margen: 0 }), 3000), 0);
});

test('máquina: guarda el origen una sola vez y vuelve a él', () => {
  const m = crearMaquina();
  assert.equal(m.activa, false);
  assert.equal(m.mirar('a', 800), 800);
  // pasar a otro ítem no pisa el origen
  assert.equal(m.mirar('b', 2400), 800);
  assert.equal(m.viendo, 'b');
  assert.equal(m.volver(), 800);
  assert.equal(m.activa, false);
  assert.equal(m.volver(), null);
});

test('máquina: quedarse descarta el origen', () => {
  const m = crearMaquina();
  m.mirar('a', 100);
  m.quedarse();
  assert.equal(m.activa, false);
  assert.equal(m.volver(), null);
});
