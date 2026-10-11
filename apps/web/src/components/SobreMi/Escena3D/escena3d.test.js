import test from 'node:test';
import assert from 'node:assert/strict';
import { hayWebGL } from './soporteWebGL.js';
import { calcularDispersion } from './desarme.js';
import { PARTES, ANCHO, ALTO } from './simboloUtn.js';
import { desplazamientoBandera, AMPLITUD_MAXIMA } from './ondaBandera.js';
import { velocidadInicial, avanzarCaida, volverAlOrigen, LIMITE_CAIDA } from './caida.js';
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

const cero = () => ({ p: [0, 0, 0], v: [0, 0, 0], r: [0, 0, 0], w: [0, 0, 0], quieto: false });

test('velocidadInicial: determinista, sale hacia arriba y hacia afuera, y gira', () => {
  const a = velocidadInicial([1, 0.2, -0.5], 3);
  const b = velocidadInicial([1, 0.2, -0.5], 3);
  assert.deepEqual(a, b);
  assert.ok(a.v[1] > 0, 'tiene un impulso hacia arriba antes de caer');
  assert.ok(a.v.every(Number.isFinite) && a.w.every(Number.isFinite));
  assert.ok(Math.hypot(...a.w) > 0.5, 'gira mientras cae');
  assert.notDeepEqual(velocidadInicial([1, 0.2, -0.5], 4).w, a.w);
});

test('avanzarCaida: sube un poco, luego cae y termina fuera de vista (quieto)', () => {
  let e = { ...cero(), v: [0, 2, 0] };
  let alturaMaxima = 0;
  for (let i = 0; i < 400 && !e.quieto; i += 1) {
    e = avanzarCaida(e, 0.016);
    alturaMaxima = Math.max(alturaMaxima, e.p[1]);
  }
  assert.ok(alturaMaxima > 0.1, 'primero sube');
  assert.equal(e.quieto, true);
  assert.ok(e.p[1] < LIMITE_CAIDA);
});

test('avanzarCaida: la gravedad frena la subida y acelera la bajada', () => {
  let e = { ...cero(), v: [0, 2, 0] };
  e = avanzarCaida(e, 0.1);
  const vy1 = e.v[1];
  e = avanzarCaida(e, 0.1);
  assert.ok(e.v[1] < vy1, 'la velocidad vertical baja con el tiempo');
  assert.ok(e.v[1] < 2);
});

test('avanzarCaida: una vez quieta ya no se mueve', () => {
  const e = { ...cero(), p: [0, -50, 0], v: [0, -3, 0], quieto: true };
  assert.deepEqual(avanzarCaida(e, 0.5), e);
});

test('volverAlOrigen: vuelve al lugar y a la rotación cero, aunque haya dado varias vueltas', () => {
  let e = { ...cero(), p: [1, -14, 2], r: [7, -9, 3], quieto: true };
  let llego = false;
  for (let i = 0; i < 400 && !llego; i += 1) {
    ({ estado: e, llego } = volverAlOrigen(e, 0.016, 6));
  }
  assert.equal(llego, true);
  assert.ok(Math.hypot(...e.p) < 1e-2 && Math.hypot(...e.r) < 1e-2);
  assert.equal(e.quieto, false);
});

test('volverAlOrigen: con la rotación envuelta no da vueltas de más', () => {
  // 2π + 0.1 equivale a 0.1 de giro real: el primer paso no debe acercarse a 2π.
  const { estado } = volverAlOrigen({ ...cero(), r: [Math.PI * 2 + 0.1, 0, 0] }, 0.016, 6);
  assert.ok(Math.abs(estado.r[0]) < 0.2);
});

test('simboloUtn: cuatro partes (dos barras y dos arcos) dentro del cuadro y centradas', () => {
  const barras = PARTES.filter((parte) => parte.tipo === 'rect');
  const arcos = PARTES.filter((parte) => parte.tipo === 'anillo');
  assert.equal(barras.length, 2);
  assert.equal(arcos.length, 2);
  const [vertical, horizontal] = [...barras].sort((a, b) => (b.y1 - b.y0) - (a.y1 - a.y0));
  // la barra vertical atraviesa todo el alto y está centrada
  cerca(vertical.y1 - vertical.y0, ALTO);
  cerca(vertical.x0, -vertical.x1);
  // la horizontal está centrada en ambos ejes y es la más ancha del símbolo (casi todo el ancho)
  cerca(horizontal.y0, -horizontal.y1);
  cerca(horizontal.x0, -horizontal.x1);
  assert.ok(horizontal.x1 - horizontal.x0 > ANCHO * 0.9);
  for (const arco of arcos) {
    assert.ok(arco.r0 < arco.r1);
    cerca(arco.cx, 0);
    cerca(arco.r1, ANCHO / 2); // el arco exterior ocupa todo el ancho
  }
});

test('simboloUtn: los dos arcos son espejo uno del otro', () => {
  const [a, b] = PARTES.filter((parte) => parte.tipo === 'anillo');
  cerca(a.cy, -b.cy);
  cerca(a.r0, b.r0);
  cerca(a.r1, b.r1);
  assert.notEqual(a.mitad, b.mitad);
  // el de arriba es la mitad inferior de su círculo (abre hacia arriba) y viceversa
  const arriba = a.cy > 0 ? a : b;
  assert.equal(arriba.mitad, 'inferior');
});

test('desplazamientoBandera: el borde del asta no se mueve y el resto está acotado', () => {
  for (const t of [0, 0.7, 3.3, 11]) {
    for (const v of [0, 0.5, 1]) assert.ok(desplazamientoBandera(0, v, t) === 0); // (-0 === 0)
  }
  for (let u = 0; u <= 1; u += 0.1) {
    for (let t = 0; t < 10; t += 0.37) {
      assert.ok(Math.abs(desplazamientoBandera(u, 0.4, t)) <= AMPLITUD_MAXIMA + 1e-9);
    }
  }
});

test('desplazamientoBandera: ondula en el tiempo en la punta y es determinista', () => {
  const a = desplazamientoBandera(1, 0.5, 1);
  assert.equal(a, desplazamientoBandera(1, 0.5, 1));
  assert.notEqual(a, desplazamientoBandera(1, 0.5, 1.4));
  // la amplitud crece hacia la punta: cerca del asta se mueve menos que en el extremo
  let cercaDelAsta = 0;
  let enLaPunta = 0;
  for (let t = 0; t < 6; t += 0.05) {
    cercaDelAsta = Math.max(cercaDelAsta, Math.abs(desplazamientoBandera(0.1, 0.5, t)));
    enLaPunta = Math.max(enLaPunta, Math.abs(desplazamientoBandera(1, 0.5, t)));
  }
  assert.ok(enLaPunta > cercaDelAsta * 3);
});
