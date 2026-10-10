import test from 'node:test';
import assert from 'node:assert/strict';
import { hayWebGL } from './soporteWebGL.js';
import { amortiguar, calcularDispersion } from './desarme.js';
import {
  estadoPantalla,
  teclaPresionada,
  progresoApertura,
  factorLuzPantalla,
  DURACION_APERTURA,
  DURACION_TOTAL,
  LINEAS,
} from './pantallaNotebook.js';
import { DISPOSICION, COLUMNAS, TOTAL_TECLAS, indiceDeLetra } from './tecladoQwerty.js';

const cerca = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} no está cerca de ${b}`);

test('hayWebGL: false si ningún contexto está disponible', () => {
  assert.equal(hayWebGL(() => ({ getContext: () => null })), false);
});

test('hayWebGL: true con webgl2 o sólo con webgl', () => {
  assert.equal(hayWebGL(() => ({ getContext: (tipo) => (tipo === 'webgl2' ? {} : null) })), true);
  assert.equal(hayWebGL(() => ({ getContext: (tipo) => (tipo === 'webgl' ? {} : null) })), true);
});

test('hayWebGL: false si crear el lienzo lanza', () => {
  assert.equal(hayWebGL(() => { throw new Error('sin DOM'); }), false);
});

test('amortiguar: no se mueve con dt 0 y converge con dt grande', () => {
  assert.equal(amortiguar(0, 1, 7, 0), 0);
  cerca(amortiguar(0, 1, 7, 0.1), 1 - Math.exp(-0.7));
  assert.ok(amortiguar(0, 1, 7, 2) > 0.999);
});

test('calcularDispersion: determinista y con alcance acotado', () => {
  const a = calcularDispersion([1, 0.5, -0.3], 3, 2);
  const b = calcularDispersion([1, 0.5, -0.3], 3, 2);
  assert.deepEqual(a, b);
  const largo = Math.hypot(...a);
  assert.ok(largo >= 2 * 0.6 - 1e-9 && largo <= 2 * 1.4 + 1e-9, `largo ${largo}`);
});

test('calcularDispersion: desde el origen no produce NaN y semillas distintas difieren', () => {
  const desdeOrigen = calcularDispersion([0, 0, 0], 1);
  assert.ok(desdeOrigen.every(Number.isFinite));
  assert.notDeepEqual(calcularDispersion([1, 1, 1], 1), calcularDispersion([1, 1, 1], 2));
});

test('estadoPantalla: apagada → arranque → escritorio', () => {
  assert.equal(estadoPantalla(0).fase, 'apagada');
  const arranque = estadoPantalla(2);
  assert.equal(arranque.fase, 'arranque');
  cerca(arranque.progreso, 0.4);
  assert.equal(estadoPantalla(4.5).fase, 'escritorio');
});

test('estadoPantalla: la terminal se abre antes de escribir nada', () => {
  const abriendo = estadoPantalla(5.4);
  assert.equal(abriendo.fase, 'terminal');
  cerca(abriendo.apertura, 0.5);
  assert.deepEqual(abriendo.lineas, []);
});

test('estadoPantalla: el comando se escribe letra por letra y luego aparece la salida', () => {
  assert.deepEqual(estadoPantalla(6.0).lineas, ['> wh']);
  assert.deepEqual(estadoPantalla(6.9).lineas, ['> whoami', 'quien repara y mejora']);
});

test('estadoPantalla: al terminar quedan todas las líneas', () => {
  const final = estadoPantalla(DURACION_TOTAL + 5);
  assert.equal(final.lineas.length, LINEAS.length * 2);
  assert.equal(final.lineas.at(-1), 'beep beep beep');
});

test('teclaPresionada: devuelve la letra que se está tecleando, o vacío', () => {
  assert.equal(teclaPresionada(0), '');
  assert.equal(teclaPresionada(7.0), '');
  // primera letra de "whoami"
  assert.equal(teclaPresionada(5.8 + 1 / 12 + 0.01), 'w');
});

test('tecladoQwerty: 5 filas de 12 teclas y letras en su sitio', () => {
  assert.equal(DISPOSICION.length, 5);
  assert.ok(DISPOSICION.every((fila) => fila.length === COLUMNAS));
  assert.equal(TOTAL_TECLAS, 60);
  // fila 1 (QWERTY), columna 1
  assert.equal(indiceDeLetra('w'), COLUMNAS + 1);
  assert.equal(indiceDeLetra('W'), COLUMNAS + 1);
  assert.equal(indiceDeLetra('a'), COLUMNAS * 2);
  assert.equal(indiceDeLetra('ñ'), -1);
  assert.equal(indiceDeLetra(''), -1);
});

test('tecladoQwerty: todas las letras que se teclean existen y no se repiten', () => {
  for (const { comando } of LINEAS) {
    for (const letra of comando) assert.ok(indiceDeLetra(letra) >= 0, `falta la tecla "${letra}"`);
  }
  const letras = DISPOSICION.flat().filter((tecla) => /^[a-z]$/.test(tecla));
  assert.equal(new Set(letras).size, letras.length);
});

test('progresoApertura: va de 0 a 1 sin pasarse y sólo avanza', () => {
  assert.equal(progresoApertura(-1), 0);
  assert.equal(progresoApertura(0), 0);
  assert.equal(progresoApertura(DURACION_APERTURA), 1);
  assert.equal(progresoApertura(50), 1);
  let anterior = 0;
  for (let t = 0; t <= DURACION_APERTURA; t += 0.1) {
    const valor = progresoApertura(t);
    assert.ok(valor >= anterior - 1e-12, `retrocede en t=${t}`);
    anterior = valor;
  }
});

test('factorLuzPantalla: apagada no ilumina y el escritorio ilumina a pleno', () => {
  assert.equal(factorLuzPantalla({ fase: 'apagada' }), 0);
  assert.ok(factorLuzPantalla({ fase: 'arranque' }) > 0 && factorLuzPantalla({ fase: 'arranque' }) < 1);
  assert.equal(factorLuzPantalla({ fase: 'escritorio' }), 1);
  assert.ok(factorLuzPantalla({ fase: 'terminal' }) > 0.5);
});
