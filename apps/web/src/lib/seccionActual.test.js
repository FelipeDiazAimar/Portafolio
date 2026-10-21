import test from 'node:test';
import assert from 'node:assert/strict';
import { IDS_SECCIONES, seccionActual, urlDeSeccion } from './seccionActual.js';

// Secciones contiguas: cada una empieza donde termina la anterior.
function pagina(scroll, alturas) {
  let y = -scroll;
  return IDS_SECCIONES.map((id, i) => {
    const seccion = { id, top: y, bottom: y + alturas[i] };
    y += alturas[i];
    return seccion;
  });
}
const ALTURAS = [900, 12000, 900, 900, 900, 900, 900];

test('sección actual: arriba de todo es el inicio', () => {
  assert.equal(seccionActual(pagina(0, ALTURAS), 900), 'inicio');
});

test('sección actual: cambia al cruzar la línea de lectura (40 % de la ventana)', () => {
  // sobre-mi empieza en y=900: pasa la línea (360 px) cuando se scrollea más de 540 px
  assert.equal(seccionActual(pagina(500, ALTURAS), 900), 'inicio');
  assert.equal(seccionActual(pagina(600, ALTURAS), 900), 'sobre-mi');
});

test('sección actual: una sección muy alta (Sobre mí) sigue siendo la actual mientras se la atraviesa', () => {
  assert.equal(seccionActual(pagina(7000, ALTURAS), 900), 'sobre-mi');
});

test('sección actual: recorre las secciones en orden y el pie cuenta como contacto', () => {
  const orden = [];
  for (let scroll = 0; scroll <= 17000; scroll += 100) {
    const id = seccionActual(pagina(scroll, ALTURAS), 900);
    if (orden.at(-1) !== id) orden.push(id);
  }
  assert.deepEqual(orden, IDS_SECCIONES);
});

test('sección actual: sin secciones no hay nada', () => {
  assert.equal(seccionActual([], 900), null);
});

test('url de sección: el inicio va sin hash y conserva la búsqueda', () => {
  assert.equal(urlDeSeccion('inicio', '/', ''), '/');
  assert.equal(urlDeSeccion('habilidades', '/', ''), '/#habilidades');
  assert.equal(urlDeSeccion('contacto', '/', '?a=1'), '/?a=1#contacto');
});
