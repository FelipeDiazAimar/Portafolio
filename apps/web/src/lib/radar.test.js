import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { anguloDeEje, puntosRadar, trazadoRadar, usoPorCategoria } from './radar.js';
import { CATEGORIAS } from '../data/categoriasTecnologias.js';

const crudo = JSON.parse(fs.readFileSync(new URL('../data/proyectos.json', import.meta.url), 'utf8'));
const proyectos = Array.isArray(crudo) ? crudo : crudo.proyectos;

test('radar: uso por categoría con valores coherentes', () => {
  const uso = usoPorCategoria(CATEGORIAS, proyectos);
  assert.equal(uso.length, CATEGORIAS.length);
  uso.forEach((u, i) => {
    assert.equal(u.tecnologias, CATEGORIAS[i].tecnologias.length);
    assert.ok(u.proyectos >= 0 && u.proyectos <= u.total);
    assert.ok(u.usos >= u.proyectos);
    assert.equal(u.total, proyectos.length);
  });
  // cada proyecto usa al menos una tecnología de alguna categoría
  assert.ok(uso.some((u) => u.proyectos > 0));
});

test('radar: cuenta proyectos distintos, no usos repetidos', () => {
  const categorias = [{ id: 'a', nombre: 'A', tecnologias: ['x', 'y'] }];
  const uso = usoPorCategoria(categorias, [{ stack: ['x', 'y'] }, { stack: ['x'] }, { stack: ['z'] }]);
  assert.deepEqual(uso[0], { id: 'a', nombre: 'A', tecnologias: 2, proyectos: 2, usos: 3, total: 3 });
});

test('radar: el primer eje apunta arriba y los vértices siguen el valor', () => {
  assert.ok(Math.abs(anguloDeEje(0, 9) + Math.PI / 2) < 1e-12);
  const [arriba, derecha] = puntosRadar([1, 1, 1, 1], 100, 100, 50);
  assert.ok(Math.abs(arriba.x - 100) < 1e-9 && Math.abs(arriba.y - 50) < 1e-9);
  assert.ok(Math.abs(derecha.x - 150) < 1e-9 && Math.abs(derecha.y - 100) < 1e-9);
  // un valor en cero no se va al centro
  const [chico] = puntosRadar([0, 1], 0, 0, 100, 0.2);
  assert.ok(Math.abs(Math.hypot(chico.x, chico.y) - 20) < 1e-9);
});

test('radar: el trazado siempre tiene la misma estructura (se puede animar entre polígonos)', () => {
  const estructura = (d) => d.replace(/[-\d.]+/g, 'n');
  const a = trazadoRadar(puntosRadar(new Array(9).fill(0), 0, 0, 10, 0));
  const b = trazadoRadar(puntosRadar(new Array(9).fill(1), 5, 5, 80));
  assert.equal(estructura(a), estructura(b));
  assert.ok(a.startsWith('M') && a.endsWith('Z'));
});
