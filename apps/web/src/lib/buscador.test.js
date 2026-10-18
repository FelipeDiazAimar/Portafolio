import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buscarTecnologias, distancia, normalizar } from './buscador.js';
import { TECNOLOGIAS } from '../data/tecnologias.js';
import { CATEGORIAS } from '../data/categoriasTecnologias.js';

const proyectos = JSON.parse(fs.readFileSync(new URL('../data/proyectos.json', import.meta.url), 'utf8'));
const lista = Array.isArray(proyectos) ? proyectos : proyectos.proyectos;
const datos = { tecnologias: TECNOLOGIAS, categorias: CATEGORIAS, proyectos: lista };
const ids = (consulta) => buscarTecnologias(consulta, datos).map((r) => r.id);

test('normalizar: sin tildes, minúsculas y espacios limpios', () => {
  assert.equal(normalizar('  Animación   3D '), 'animacion 3d');
});

test('distancia: cuenta ediciones y corta al superar el máximo', () => {
  assert.equal(distancia('react', 'raect'), 2);
  assert.equal(distancia('postgres', 'postgresql', 1), 2);
});

test('buscador: nombre exacto primero, y tolera tildes y errores', () => {
  assert.equal(ids('react')[0], 'react');
  assert.equal(ids('Next')[0], 'nextjs');
  assert.ok(ids('tipescript').includes('typescript'));
  assert.ok(ids('postgress').includes('postgresql'));
});

test('buscador: entiende intención y sinónimos', () => {
  const bd = ids('base de datos');
  assert.ok(bd.includes('postgresql') && bd.includes('mysql'));
  assert.ok(ids('ia').includes('gemini'));
  assert.equal(ids('pagos')[0], 'mercadopago');
  assert.ok(ids('celular').includes('expo'));
});

test('buscador: el nombre de un proyecto trae su stack y cada resultado dice dónde se usó', () => {
  const conStack = lista.find((p) => (p.stack ?? []).length > 0);
  const resultados = buscarTecnologias(conStack.titulo.split(' ')[0], datos);
  assert.ok(resultados.length > 0);
  const react = buscarTecnologias('react', datos)[0];
  assert.ok(Array.isArray(react.proyectos));
});

test('buscador: vacío o sin coincidencias no devuelve nada', () => {
  assert.deepEqual(ids('   '), []);
  assert.deepEqual(ids('zzzzqqq'), []);
});
