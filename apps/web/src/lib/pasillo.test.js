import test from 'node:test';
import assert from 'node:assert/strict';
import { ANCHO, armarRecorrido, puntoEn, pasilloEn, largoDePasillo } from './pasillo.js';

const trabajos = [
  { objetos: [{ lado: 'izq' }, { lado: 'der' }] },
  { objetos: [{ lado: 'der' }] },
  { objetos: [{ lado: 'izq' }, { lado: 'izq' }, { lado: 'der' }] },
];

const cerca = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test('armarRecorrido: un pasillo por trabajo, dobla alternando y el último no dobla', () => {
  const r = armarRecorrido(trabajos);
  assert.equal(r.pasillos.length, 3);
  assert.deepEqual(r.pasillos.map((p) => p.giro), [1, -1, 0]);
  // primero hacia -z, después a la derecha (+x), después de nuevo hacia -z
  assert.deepEqual(r.pasillos.map((p) => p.dir), [[0, -1], [1, 0], [0, -1]]);
  assert.equal(r.pasillos[0].largo, largoDePasillo(2));
});

test('armarRecorrido: cada pasillo arranca a medio cruce del anterior', () => {
  const { pasillos } = armarRecorrido(trabajos);
  const [a, b] = pasillos;
  assert.ok(cerca(Math.hypot(b.inicio[0] - a.cruce[0], b.inicio[1] - a.cruce[1]), ANCHO / 2));
});

test('puntoEn: el camino es continuo y su largo es la suma de los tramos', () => {
  const r = armarRecorrido(trabajos);
  let previo = puntoEn(r, 0);
  for (let s = 0.25; s <= r.largo; s += 0.25) {
    const p = puntoEn(r, s);
    assert.ok(Math.hypot(p[0] - previo[0], p[1] - previo[1]) <= 0.26, `salto en s=${s}`);
    previo = p;
  }
  assert.ok(cerca(r.largo, r.tramos.reduce((t, x) => t + x.largo, 0)));
});

test('pasilloEn: cambia de pasillo a mitad del giro y comienzos sube', () => {
  const r = armarRecorrido(trabajos);
  assert.equal(pasilloEn(r, 0), 0);
  assert.equal(pasilloEn(r, r.largo), 2);
  assert.equal(pasilloEn(r, r.comienzos[1] + 0.1), 1);
  assert.ok(r.comienzos[0] < r.comienzos[1] && r.comienzos[1] < r.comienzos[2]);
});

test('objetos: quedan contra la pared de su lado', () => {
  const { pasillos } = armarRecorrido(trabajos);
  const [o1, o2] = pasillos[0].objetos;
  // primer pasillo va hacia -z: izquierda es -x, derecha +x
  assert.ok(cerca(o1.x, -ANCHO / 2));
  assert.ok(cerca(o2.x, ANCHO / 2));
});
