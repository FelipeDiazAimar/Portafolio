import test from 'node:test';
import assert from 'node:assert/strict';
import { Euler, Quaternion } from 'three';
import {
  acercarValores,
  amortiguar,
  avanzarFase,
  distanciaCircular,
  elegirResaltada,
  habilidadDeBarra,
  resalteContinuo,
} from './xilofono.js';
import { escribirHelice } from '../components/Habilidades/xilofono/helice.js';
import { XILOFONO } from '../components/Habilidades/xilofono/config.js';
import { TECNOLOGIAS } from '../data/tecnologias.js';
import { CATEGORIAS } from '../data/categoriasTecnologias.js';

test('xilófono: una barra por habilidad, sin repetir', () => {
  assert.equal(TECNOLOGIAS.length, XILOFONO.cantidad);
  const vistas = new Set();
  for (let i = 0; i < XILOFONO.cantidad; i += 1) vistas.add(habilidadDeBarra(i, TECNOLOGIAS.length));
  assert.equal(vistas.size, XILOFONO.cantidad);
  assert.equal(habilidadDeBarra(5, 3), 2);
});

test('categorías: cada tecnología en exactamente una', () => {
  const ids = new Set(TECNOLOGIAS.map((t) => t.id));
  const vistas = CATEGORIAS.flatMap((c) => c.tecnologias);
  assert.equal(vistas.length, TECNOLOGIAS.length);
  assert.equal(new Set(vistas).size, vistas.length);
  for (const id of vistas) assert.ok(ids.has(id), `categoría con tecnología desconocida: ${id}`);
});

test('avanzarFase: el scroll mueve en los dos sentidos, sola avanza despacio y el ritmo la frena o apura', () => {
  const cfg = { avanceSolo: 0.5, scroll: { sensibilidad: 0.01 } };
  assert.equal(avanzarFase(0, 100, 0, cfg), 1);
  assert.equal(avanzarFase(0, -100, 0, cfg), -1);
  assert.equal(avanzarFase(0, 0, 2, cfg), 1);
  assert.equal(avanzarFase(0, 0, 2, cfg, true), 0);
  assert.equal(avanzarFase(0, 0, 2, cfg, false, 0), 0);
  assert.equal(avanzarFase(0, 0, 2, cfg, false, 3), 3);
});

test('amortiguar: converge al objetivo sin pasarse', () => {
  let v = 0;
  for (let i = 0; i < 200; i += 1) {
    v = amortiguar(v, 1, 5, 1 / 60);
    assert.ok(v <= 1);
  }
  assert.ok(v > 0.999);
});

test('elegirResaltada: la del frente, centrada y de cara a la cámara', () => {
  const centros = [
    { x: 0, y: 0, z: 0.2 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 2, z: 1.2 },
  ];
  assert.equal(elegirResaltada(centros), 1);
  assert.equal(elegirResaltada(centros, 1), 0);
  assert.equal(elegirResaltada([{ x: 0, y: 0, z: 1, frente: 0.1 }, { x: 0, y: 0, z: 0.8, frente: 0.9 }]), 1);
});

test('resalteContinuo: campana suave alrededor del foco, que da la vuelta', () => {
  assert.equal(distanciaCircular(63.5, 0.5, 64), 1);
  assert.equal(resalteContinuo(10, 10, 64), 1);
  assert.equal(resalteContinuo(12, 10, 64), 0);
  assert.ok(Math.abs(resalteContinuo(10.6, 10, 64) - 0.5) < 1e-9);
  assert.equal(resalteContinuo(63.8, 0.2, 64), resalteContinuo(0.6, 0.2, 64));
  // continuo: pasos chicos dan cambios chicos
  for (let s = 8; s < 12; s += 0.01) {
    assert.ok(Math.abs(resalteContinuo(s + 0.01, 10, 64) - resalteContinuo(s, 10, 64)) < 0.03);
  }
});

test('acercarValores: cada uno va a su objetivo y avisa cuando ya no cambia', () => {
  const valores = new Float32Array([1, 0, 0]);
  const objetivos = [0, 0.5, 1];
  for (let i = 0; i < 240; i += 1) acercarValores(valores, objetivos, 1 / 60);
  assert.deepEqual(Array.from(valores), [0, 0.5, 1]);
  assert.equal(acercarValores(valores, objetivos, 1 / 60), false);
});

test('escribirHelice: barras sobre el radio, paso fijo y la cinta da la vuelta', () => {
  const cfg = XILOFONO;
  const n = cfg.cantidad;
  const pos = new Float32Array(n * 3);
  const rot = new Float32Array(n * 4);
  escribirHelice(0, 0.4, cfg, pos, rot, new Euler(0, 0, 0, 'YXZ'), new Quaternion());
  for (let i = 0; i < n; i += 1) {
    assert.ok(Math.abs(Math.hypot(pos[i * 3], pos[i * 3 + 2]) - cfg.radio) < 1e-5);
    assert.ok(Math.abs(Math.hypot(rot[i * 4], rot[i * 4 + 1], rot[i * 4 + 2], rot[i * 4 + 3]) - 1) < 1e-5);
  }
  assert.ok(Math.abs(pos[4] - pos[1] - 0.4) < 1e-5);
  assert.ok(Math.abs(pos[1] + pos[(n - 1) * 3 + 1]) < 1e-5);
  const pos1 = new Float32Array(n * 3);
  escribirHelice(1, 0.4, cfg, pos1, rot, new Euler(0, 0, 0, 'YXZ'), new Quaternion());
  assert.ok(Math.abs(pos1[1] - pos[4]) < 1e-5);
  assert.ok(Math.abs(pos1[(n - 1) * 3 + 1] - pos[1]) < 1e-5);
});
