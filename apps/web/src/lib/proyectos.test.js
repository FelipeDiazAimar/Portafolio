// Tests del catálogo de proyectos (fase 1).
// El JSON se lee con `fs` porque node no importa `.json` sin atributos.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TECNOLOGIAS } from '../data/tecnologias.js';
import {
  listarProyectos,
  listarDestacados,
  obtenerProyecto,
  tecnologiasDe,
  normalizarProyectoRemoto,
  resumenCifras,
} from './proyectos.js';

// Ruta base del archivo JSON junto a este test.
const urlJson = new URL('../data/proyectos.json', import.meta.url);
const textoJson = fs.readFileSync(urlJson, 'utf8');
const proyectos = JSON.parse(textoJson);

const TIPOS_VALIDOS = ['laboral', 'cliente', 'personal', 'academico'];
const ESTADOS_VALIDOS = ['produccion', 'demo'];
const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// (1) 13 proyectos, slug único en kebab-case y orden 1–13 sin huecos.
test('proyectos: 13 proyectos con slug único kebab-case y orden 1-13 sin huecos', () => {
  assert.equal(proyectos.length, 13);
  const slugs = proyectos.map((proyecto) => proyecto.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const slug of slugs) {
    assert.match(slug, KEBAB_CASE, `slug no kebab-case: ${slug}`);
  }
  const ordenes = proyectos.map((proyecto) => proyecto.orden).sort((a, b) => a - b);
  assert.deepEqual(ordenes, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
});

// (2) tipo y estado dentro de los valores permitidos.
test('proyectos: tipo y estado válidos', () => {
  for (const proyecto of proyectos) {
    assert.ok(TIPOS_VALIDOS.includes(proyecto.tipo), `${proyecto.slug}: tipo ${proyecto.tipo}`);
    assert.ok(ESTADOS_VALIDOS.includes(proyecto.estado), `${proyecto.slug}: estado ${proyecto.estado}`);
  }
});

// (3) problema de 60–220 caracteres, 3–5 features y stack ⊆ ids de TECNOLOGIAS.
test('proyectos: problema, features y stack válidos', () => {
  const ids = new Set(TECNOLOGIAS.map((tecnologia) => tecnologia.id));
  for (const proyecto of proyectos) {
    assert.ok(
      proyecto.problema.length >= 60 && proyecto.problema.length <= 220,
      `${proyecto.slug}: problema de ${proyecto.problema.length} caracteres`,
    );
    assert.ok(
      proyecto.features.length >= 3 && proyecto.features.length <= 5,
      `${proyecto.slug}: ${proyecto.features.length} features`,
    );
    for (const id of proyecto.stack) {
      assert.ok(ids.has(id), `${proyecto.slug}: stack con id desconocido ${id}`);
    }
  }
});

// (4) Portada en /proyectos/<slug>/portada.webp y archivo real en public.
// Activado tras T8: las 13 portadas ya existen en apps/web/public.
test('proyectos: cada portada existe en apps/web/public', () => {
  for (const proyecto of proyectos) {
    assert.equal(proyecto.imagenes.portada, `/proyectos/${proyecto.slug}/portada.webp`);
    const urlPortada = new URL(`../../public/proyectos/${proyecto.slug}/portada.webp`, import.meta.url);
    assert.ok(fs.existsSync(urlPortada), `falta el archivo: ${urlPortada.pathname}`);
  }
});

// (4b) Logo en /proyectos/<slug>/logo.webp y archivo real en public.
test('proyectos: cada logo existe en apps/web/public', () => {
  for (const proyecto of proyectos) {
    assert.equal(proyecto.imagenes.logo, `/proyectos/${proyecto.slug}/logo.webp`);
    const urlLogo = new URL(`../../public/proyectos/${proyecto.slug}/logo.webp`, import.meta.url);
    assert.ok(fs.existsSync(urlLogo), `falta el archivo: ${urlLogo.pathname}`);
  }
});

// (5) Si privado es true, todos los enlaces son null.
test('proyectos: los privados no tienen enlaces', () => {
  for (const proyecto of proyectos.filter((p) => p.privado === true)) {
    for (const [clave, valor] of Object.entries(proyecto.enlaces)) {
      assert.equal(valor, null, `${proyecto.slug}: enlaces.${clave} no es null`);
    }
  }
});

// (6) El JSON no contiene datos sensibles ni restos de red local.
test('proyectos: el JSON no contiene secretos', () => {
  for (const prohibido of ['10.1.', 'marfrig-conosur.local', 'password', 'pass', '.env', 'token']) {
    assert.ok(!textoJson.includes(prohibido), `el JSON contiene "${prohibido}"`);
  }
});

// (7) TECNOLOGIAS con ids únicos y cada icono no nulo importado en iconosTecnologias.jsx.
test('tecnologias: ids únicos e iconos importados', () => {
  const ids = TECNOLOGIAS.map((tecnologia) => tecnologia.id);
  assert.equal(new Set(ids).size, ids.length);
  const urlIconos = new URL('../components/Proyectos/iconosTecnologias.jsx', import.meta.url);
  const textoIconos = fs.readFileSync(urlIconos, 'utf8');
  for (const tecnologia of TECNOLOGIAS.filter((t) => t.icono !== null)) {
    assert.ok(textoIconos.includes(tecnologia.icono), `icono no importado: ${tecnologia.icono}`);
  }
});

// (8) resumenCifras() da { total: 13, clientes: 5, laborales: 4 }.
test('resumenCifras: da { total: 13, clientes: 5, laborales: 4 }', () => {
  assert.deepEqual(resumenCifras(), { total: 13, clientes: 5, laborales: 4 });
});

// La librería expone el catálogo ordenado por `orden`.
test('listarProyectos: ordenados por orden y con acceso por slug', () => {
  const lista = listarProyectos();
  assert.equal(lista.length, 13);
  assert.deepEqual(
    lista.map((proyecto) => proyecto.orden),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
  );
  assert.equal(obtenerProyecto('neifert').titulo, 'Neifert Automotores');
  assert.equal(obtenerProyecto('no-existe'), null);
  assert.ok(listarDestacados().length > 0);
  assert.ok(listarDestacados().every((proyecto) => proyecto.destacado));
});

// tecnologiasDe() respeta el orden del stack e ignora ids inexistentes.
test('tecnologiasDe: orden del stack e ids inexistentes ignorados', () => {
  const proyecto = obtenerProyecto('neifert');
  const tecnologias = tecnologiasDe(proyecto);
  assert.deepEqual(
    tecnologias.map((tecnologia) => tecnologia.id),
    proyecto.stack,
  );
  assert.deepEqual(tecnologiasDe({ stack: ['react', 'no-existe', 'node'] }).map((t) => t.id), [
    'react',
    'node',
  ]);
  assert.deepEqual(tecnologiasDe({ stack: null }), []);
});

// normalizarProyectoRemoto() mapea title→titulo, description→resumen y technologies→stack.
test('normalizarProyectoRemoto: mapea los campos remotos a los locales', () => {
  const normalizado = normalizarProyectoRemoto({
    id: 'demo',
    title: 'Demo',
    description: 'Resumen demo',
    technologies: ['react', 'node'],
  });
  assert.equal(normalizado.slug, 'demo');
  assert.equal(normalizado.titulo, 'Demo');
  assert.equal(normalizado.resumen, 'Resumen demo');
  assert.deepEqual(normalizado.stack, ['react', 'node']);
});
