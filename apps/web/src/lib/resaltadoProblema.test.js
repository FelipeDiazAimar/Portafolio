import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FRASES_CLAVE, rangosClave } from './resaltadoProblema.js';

const proyectos = JSON.parse(readFileSync(new URL('../data/proyectos.json', import.meta.url), 'utf8'));

test('cada proyecto tiene frases clave y todas aparecen tal cual en su problemática', () => {
  for (const p of proyectos) {
    const frases = FRASES_CLAVE[p.slug];
    assert.ok(frases?.length >= 2, `${p.slug} sin frases clave`);
    for (const frase of frases) assert.ok(p.problema.includes(frase), `${p.slug}: "${frase}" no está en la problemática`);
  }
});

test('rangosClave: ordena, ignora lo que no está y no se solapa', () => {
  assert.deepEqual(rangosClave('uno dos tres', ['tres', 'uno', 'cuatro']), [[0, 3], [8, 12]]);
  assert.deepEqual(rangosClave('abcdef', ['abcd', 'cdef']), [[0, 4]]);
});
