import test from 'node:test';
import assert from 'node:assert/strict';
import { hayWebGL } from './soporteWebGL.js';
import { calcularDispersion } from './desarme.js';
import { PARTES, ANCHO, ALTO } from './simboloUtn.js';
import { desplazamientoBandera, AMPLITUD_MAXIMA } from './ondaBandera.js';
import { progresoEntrada } from './entrada.js';
import { vistaParaAltura, DISTANCIA_MINIMA, PIXELES_POR_UNIDAD, FOV } from './vista.js';
import { crearTela, pasoTela, empujar, particulaMasCercana, estiramientoDesenrollado, PASO } from './tela.js';
import { esEscenaFija, idsConEscena, limiteDeGiro } from './escenas/index.js';
import { fraccionExplosion, DURACION_CICLO } from './cicloPC.js';
import { CANTIDAD_LEDS, ledEncendido, alturaDestornillador, giroDestornillador, DURACION_DESTORNILLADOR } from './cicloBanco.js';
import { MATERIAS, T_FIN_TILDES, progresoTilde, progresoSello, escalaTilde, brilloTarjeta } from './cicloMaterias.js';
import { PLACA, ZONAS, condensadores, tornillos, aletas } from './disposicionPlaca.js';
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

test('desplazamientoBandera: la tela se mueve también a lo alto (no es una onda rígida)', () => {
  // Con u fijo, puntos a distinta altura (v) deben moverse distinto: eso es lo que
  // la hace flexible y no una chapa que sube y baja entera.
  let diferencia = 0;
  for (let t = 0; t < 6; t += 0.1) {
    diferencia = Math.max(diferencia, Math.abs(desplazamientoBandera(0.8, 0.05, t) - desplazamientoBandera(0.8, 0.95, t)));
  }
  assert.ok(diferencia > 0.08, `diferencia entre arriba y abajo: ${diferencia}`);
});

test('progresoEntrada: 0 antes del retraso, 1 al terminar y sólo avanza', () => {
  assert.equal(progresoEntrada(0, 1.6, 1.1), 0);
  assert.equal(progresoEntrada(1.6, 1.6, 1.1), 0);
  assert.equal(progresoEntrada(2.7, 1.6, 1.1), 1);
  assert.equal(progresoEntrada(99, 1.6, 1.1), 1);
  let anterior = 0;
  for (let t = 1.6; t <= 2.7; t += 0.05) {
    const valor = progresoEntrada(t, 1.6, 1.1);
    assert.ok(valor >= anterior - 1e-12);
    anterior = valor;
  }
  assert.ok(progresoEntrada(2.1, 1.6, 1.1) > 0 && progresoEntrada(2.1, 1.6, 1.1) < 1);
});

test('desplazamientoBandera: flamea con la amplitud de una tela suelta', () => {
  let maximo = 0;
  for (let u = 0.5; u <= 1; u += 0.05) {
    for (let v = 0; v <= 1; v += 0.1) {
      for (let t = 0; t < 12; t += 0.05) maximo = Math.max(maximo, Math.abs(desplazamientoBandera(u, v, t)));
    }
  }
  assert.ok(maximo >= 0.25, `amplitud máxima alcanzada: ${maximo}`);
  assert.ok(maximo <= AMPLITUD_MAXIMA + 1e-9);
});

// --- Tela simulada -----------------------------------------------------------
const MEDIDAS = { columnas: 20, filas: 14, ancho: 2.4, alto: 1.5, yTope: 1 };
const simular = (tela, pasos, opciones = {}) => {
  for (let i = 0; i < pasos; i += 1) pasoTela(tela, PASO, { t: i * PASO, ...opciones });
};
const punto = (tela, i) => [tela.p[i * 3], tela.p[i * 3 + 1], tela.p[i * 3 + 2]];
const distancia = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const indice = (tela, fila, columna) => fila * tela.columnas + columna;

test('tela: arranca colgada de la varilla, con la fila de arriba fija', () => {
  const tela = crearTela(MEDIDAS);
  assert.equal(tela.n, MEDIDAS.columnas * MEDIDAS.filas);
  for (let c = 0; c < MEDIDAS.columnas; c += 1) {
    assert.equal(tela.fijas[indice(tela, 0, c)], 1);
    cerca(punto(tela, indice(tela, 0, c))[1], MEDIDAS.yTope);
  }
  assert.equal(tela.fijas[indice(tela, 1, 0)], 0);
  // la tela queda centrada en x
  cerca(punto(tela, indice(tela, 0, 0))[0], -MEDIDAS.ancho / 2);
  cerca(punto(tela, indice(tela, 0, MEDIDAS.columnas - 1))[0], MEDIDAS.ancho / 2);
});

test('tela: la fila de arriba no se mueve y no aparecen NaN aunque haya viento', () => {
  const tela = crearTela(MEDIDAS);
  const antes = punto(tela, indice(tela, 0, 5));
  simular(tela, 600, { viento: 1 });
  assert.deepEqual(punto(tela, indice(tela, 0, 5)), antes);
  assert.ok(Array.from(tela.p).every(Number.isFinite));
});

test('tela: cuelga casi estirada y sin estirarse de más', () => {
  const tela = crearTela(MEDIDAS);
  simular(tela, 600);
  const abajo = punto(tela, indice(tela, MEDIDAS.filas - 1, 10));
  const colgado = MEDIDAS.yTope - abajo[1];
  assert.ok(colgado > MEDIDAS.alto * 0.88 && colgado < MEDIDAS.alto * 1.12, `colgado ${colgado}`);
  // ningún resorte se estira más de un 12 %
  for (let k = 0; k < tela.rl.length; k += 1) {
    const largo = distancia(punto(tela, tela.ra[k]), punto(tela, tela.rb[k]));
    assert.ok(largo < tela.rl[k] * 1.12, `resorte ${k} estirado a ${largo / tela.rl[k]}`);
  }
});

test('tela: enrollada, se desenrolla de a poco hasta colgar completa', () => {
  const tela = crearTela({ ...MEDIDAS, enrollada: true });
  const altoColgado = () => MEDIDAS.yTope - punto(tela, indice(tela, MEDIDAS.filas - 1, 10))[1];
  simular(tela, 5, { estiramiento: 0.04 });
  assert.ok(altoColgado() < MEDIDAS.alto * 0.1, `enrollada mide ${altoColgado()}`);
  // rampa de 150 pasos (2,5 s), igual que en la escena
  const RAMPA = 150;
  for (let i = 0; i < RAMPA; i += 1) {
    const x = i / RAMPA;
    pasoTela(tela, PASO, { estiramiento: 0.04 + 0.96 * (1 - (1 - x) ** 3), t: i * PASO });
  }
  simular(tela, 400, { estiramiento: 1 });
  assert.ok(altoColgado() > MEDIDAS.alto * 0.9, `desenrollada mide ${altoColgado()}`);
});

test('tela: agarrada, la partícula sigue al puntero y arrastra a las vecinas', () => {
  const tela = crearTela(MEDIDAS);
  simular(tela, 300);
  const i = indice(tela, MEDIDAS.filas - 1, 10);
  const vecina = indice(tela, MEDIDAS.filas - 2, 11);
  const antes = punto(tela, vecina);
  const objetivo = [0.9, -0.2, 0.4];
  simular(tela, 200, { agarre: { indice: i, x: objetivo[0], y: objetivo[1], z: objetivo[2] } });
  assert.ok(distancia(punto(tela, i), objetivo) < 1e-3);
  assert.ok(distancia(punto(tela, vecina), antes) > 0.1, 'las vecinas acompañan');
});

test('tela: al soltarla vuelve a colgar', () => {
  const tela = crearTela(MEDIDAS);
  simular(tela, 300);
  const i = indice(tela, MEDIDAS.filas - 1, 10);
  const colgando = punto(tela, i);
  simular(tela, 120, { agarre: { indice: i, x: 1.2, y: -0.3, z: 0.5 } });
  simular(tela, 700);
  assert.ok(distancia(punto(tela, i), colgando) < 0.15, `quedó a ${distancia(punto(tela, i), colgando)} del reposo`);
});

test('tela: empujar mueve las partículas cercanas y no las lejanas', () => {
  const tela = crearTela(MEDIDAS);
  simular(tela, 300);
  const cerco = indice(tela, 8, 10);
  const lejos = indice(tela, 8, 1);
  const [x, y, z] = punto(tela, cerco);
  const cercaAntes = punto(tela, cerco);
  const lejosAntes = punto(tela, lejos);
  empujar(tela, x, y, z, 0, 0, -0.3, 0.4);
  pasoTela(tela, PASO, {});
  const seMovioCerca = distancia(punto(tela, cerco), cercaAntes);
  const seMovioLejos = distancia(punto(tela, lejos), lejosAntes);
  assert.ok(seMovioCerca > 1e-2, 'la cercana se movió');
  // la lejana sólo se entera por los resortes: se mueve mucho menos
  assert.ok(seMovioLejos < seMovioCerca * 0.05, `cerca ${seMovioCerca}, lejos ${seMovioLejos}`);
});

test('tela: particulaMasCercana elige la más próxima y nunca una fija', () => {
  const tela = crearTela(MEDIDAS);
  simular(tela, 200);
  const i = indice(tela, 5, 7);
  const [x, y, z] = punto(tela, i);
  assert.equal(particulaMasCercana(tela, x + 0.001, y, z), i);
  // pegado a la varilla, la más cercana no fija es de la segunda fila
  assert.ok(particulaMasCercana(tela, 0, MEDIDAS.yTope + 0.5, 0) >= tela.columnas);
});

test('estiramientoDesenrollado: arranca enrollada, termina completa y sólo crece', () => {
  assert.equal(estiramientoDesenrollado(0, 0.35, 2.6), 0.04);
  assert.equal(estiramientoDesenrollado(0.35, 0.35, 2.6), 0.04);
  assert.equal(estiramientoDesenrollado(0.35 + 2.6, 0.35, 2.6), 1);
  assert.equal(estiramientoDesenrollado(50, 0.35, 2.6), 1);
  let anterior = 0;
  for (let t = 0; t <= 3.2; t += 0.05) {
    const valor = estiramientoDesenrollado(t, 0.35, 2.6);
    assert.ok(valor >= anterior - 1e-12);
    anterior = valor;
  }
});

test('vistaParaAltura: un canvas bajo conserva la distancia mínima de cámara', () => {
  assert.equal(vistaParaAltura(224).distancia, DISTANCIA_MINIMA); // celular
  assert.equal(vistaParaAltura(780).distancia, DISTANCIA_MINIMA); // el alto de antes
});

test('vistaParaAltura: un canvas alto aleja la cámara para que los modelos no crezcan', () => {
  const alto = vistaParaAltura(1164);
  assert.ok(alto.distancia > DISTANCIA_MINIMA * 1.4, `distancia ${alto.distancia}`);
  // la escala en pantalla (píxeles por unidad de escena) se mantiene constante
  const pxPorUnidad = 1164 / (alto.mitadAlto * 2);
  cerca(pxPorUnidad, PIXELES_POR_UNIDAD, 0.5);
  // y cuanto más alto el canvas, más lejos la cámara
  assert.ok(vistaParaAltura(1400).distancia > alto.distancia);
});

test('vistaParaAltura: la mitad del alto visible coincide con el campo de visión', () => {
  const { distancia, mitadAlto } = vistaParaAltura(900);
  cerca(mitadAlto, distancia * Math.tan((FOV * Math.PI) / 360));
});

test('escenas: la notebook gira libre y la bandera de 2022 es fija', () => {
  assert.ok(idsConEscena.has(0) && idsConEscena.has(1));
  assert.equal(esEscenaFija(0), false);
  assert.equal(esEscenaFija(1), true);
  assert.equal(esEscenaFija(99), false);
});

test('fraccionExplosion: arranca armada, llega a estar desarmada del todo y es periódica', () => {
  assert.equal(fraccionExplosion(0), 0);
  let maximo = 0;
  let minimo = 1;
  for (let t = 0; t < DURACION_CICLO; t += 0.02) {
    const f = fraccionExplosion(t);
    assert.ok(f >= 0 && f <= 1, `fuera de rango en t=${t}: ${f}`);
    maximo = Math.max(maximo, f);
    minimo = Math.min(minimo, f);
  }
  assert.equal(maximo, 1);
  assert.equal(minimo, 0);
  cerca(fraccionExplosion(1.3), fraccionExplosion(1.3 + DURACION_CICLO), 1e-9);
  cerca(fraccionExplosion(4.2), fraccionExplosion(4.2 + 3 * DURACION_CICLO), 1e-9);
});

test('fraccionExplosion: se queda quieta un rato armada y un rato desarmada (no oscila sin parar)', () => {
  const quietaEnCero = [];
  const quietaEnUno = [];
  for (let t = 0; t < DURACION_CICLO; t += 0.05) {
    const f = fraccionExplosion(t);
    if (f === 0) quietaEnCero.push(t);
    if (f === 1) quietaEnUno.push(t);
  }
  assert.ok(quietaEnCero.length * 0.05 >= 1, 'al menos 1 s armada');
  assert.ok(quietaEnUno.length * 0.05 >= 1, 'al menos 1 s desarmada');
});

test('escenas: la PC de 2024 gira libre', () => {
  assert.ok(idsConEscena.has(3));
  assert.equal(esEscenaFija(3), false);
});

const dentro = (x, y, zona, margen = 0) =>
  Math.abs(x - zona.cx) <= zona.ancho / 2 + margen && Math.abs(y - zona.cy) <= zona.alto / 2 + margen;

test('disposicionPlaca: las zonas principales caben en la placa y no se pisan entre sí', () => {
  const nombres = Object.keys(ZONAS);
  assert.ok(nombres.length >= 8);
  for (const nombre of nombres) {
    const z = ZONAS[nombre];
    assert.ok(Math.abs(z.cx) + z.ancho / 2 <= PLACA.ancho / 2 + 1e-9, `${nombre} se sale por los costados`);
    assert.ok(Math.abs(z.cy) + z.alto / 2 <= PLACA.alto / 2 + 1e-9, `${nombre} se sale por arriba o abajo`);
  }
  for (let i = 0; i < nombres.length; i += 1) {
    for (let j = i + 1; j < nombres.length; j += 1) {
      const a = ZONAS[nombres[i]];
      const b = ZONAS[nombres[j]];
      const sePisan =
        Math.abs(a.cx - b.cx) < (a.ancho + b.ancho) / 2 - 1e-9 && Math.abs(a.cy - b.cy) < (a.alto + b.alto) / 2 - 1e-9;
      assert.equal(sePisan, false, `${nombres[i]} y ${nombres[j]} se superponen`);
    }
  }
});

test('condensadores: muchos, dentro de la placa, fuera de las zonas y sin tocarse', () => {
  const lista = condensadores();
  assert.ok(lista.length >= 40, `sólo ${lista.length}`);
  for (const c of lista) {
    assert.ok(Math.abs(c.x) + c.r <= PLACA.ancho / 2 - 0.04 && Math.abs(c.y) + c.r <= PLACA.alto / 2 - 0.04, 'fuera de la placa');
    for (const nombre of Object.keys(ZONAS)) {
      assert.equal(dentro(c.x, c.y, ZONAS[nombre], c.r), false, `un condensador cae dentro de ${nombre}`);
    }
  }
  for (let i = 0; i < lista.length; i += 1) {
    for (let j = i + 1; j < lista.length; j += 1) {
      assert.ok(Math.hypot(lista[i].x - lista[j].x, lista[i].y - lista[j].y) >= lista[i].r + lista[j].r - 1e-9, 'dos condensadores se solapan');
    }
  }
  assert.deepEqual(condensadores(), lista);
});

test('tornillos: seis, dentro de la placa y fuera de las zonas', () => {
  const lista = tornillos();
  assert.equal(lista.length, 6);
  for (const t of lista) {
    assert.ok(Math.abs(t.x) <= PLACA.ancho / 2 - 0.05 && Math.abs(t.y) <= PLACA.alto / 2 - 0.05);
    for (const nombre of Object.keys(ZONAS)) assert.equal(dentro(t.x, t.y, ZONAS[nombre], 0.04), false, `un tornillo cae en ${nombre}`);
  }
});

test('aletas: n posiciones equiespaciadas y centradas', () => {
  const posiciones = aletas(10, 1.0);
  assert.equal(posiciones.length, 10);
  cerca(posiciones[0], -posiciones.at(-1));
  const paso = posiciones[1] - posiciones[0];
  for (let i = 2; i < posiciones.length; i += 1) cerca(posiciones[i] - posiciones[i - 1], paso);
  assert.ok(posiciones.at(-1) - posiciones[0] <= 1.0 + 1e-9);
});

test('materias: doce nombres distintos y cortos (entran en la tarjeta)', () => {
  assert.equal(MATERIAS.length, 12);
  assert.equal(new Set(MATERIAS).size, 12);
  for (const nombre of MATERIAS) assert.ok(nombre.length > 3 && nombre.length <= 34, nombre);
});

test('progresoTilde: se tildan de a una, en orden, y todas terminan', () => {
  assert.equal(progresoTilde(0, 0), 0);
  // la primera ya empezó cuando la última todavía no
  const t = 1.2;
  assert.ok(progresoTilde(0, t) > 0);
  assert.equal(progresoTilde(MATERIAS.length - 1, t), 0);
  // el orden se respeta: en todo instante, tilde i va igual o más adelantada que la i+1
  for (let tiempo = 0; tiempo < T_FIN_TILDES + 1; tiempo += 0.05) {
    for (let i = 0; i < MATERIAS.length - 1; i += 1) {
      assert.ok(progresoTilde(i, tiempo) >= progresoTilde(i + 1, tiempo) - 1e-12);
    }
  }
  for (let i = 0; i < MATERIAS.length; i += 1) assert.equal(progresoTilde(i, T_FIN_TILDES), 1);
  assert.equal(progresoTilde(5, 999), 1);
});

test('progresoTilde: cada una sólo avanza', () => {
  for (let i = 0; i < MATERIAS.length; i += 1) {
    let anterior = 0;
    for (let t = 0; t <= T_FIN_TILDES + 0.5; t += 0.03) {
      const p = progresoTilde(i, t);
      assert.ok(p >= anterior - 1e-12 && p >= 0 && p <= 1);
      anterior = p;
    }
  }
});

test('progresoSello: aparece recién cuando se tildó la última materia y sólo crece', () => {
  assert.equal(progresoSello(0), 0);
  assert.equal(progresoSello(T_FIN_TILDES), 0);
  // hay una breve pausa tras la última tilde y recién ahí aparece
  assert.equal(progresoSello(T_FIN_TILDES + 0.3), 0);
  assert.ok(progresoSello(T_FIN_TILDES + 1.0) > 0);
  assert.equal(progresoSello(T_FIN_TILDES + 5), 1);
  let anterior = 0;
  for (let t = 0; t < T_FIN_TILDES + 3; t += 0.04) {
    const p = progresoSello(t);
    assert.ok(p >= anterior - 1e-12);
    anterior = p;
  }
});

test('escalaTilde y brilloTarjeta: nacen en 0, la tilde se pasa un poco y el brillo queda tenue', () => {
  assert.equal(escalaTilde(0), 0);
  cerca(escalaTilde(1), 1, 1e-9);
  let maximo = 0;
  for (let p = 0; p <= 1; p += 0.01) maximo = Math.max(maximo, escalaTilde(p));
  assert.ok(maximo > 1.03 && maximo < 1.4, `rebote ${maximo}`);
  assert.equal(brilloTarjeta(0), 0);
  assert.ok(brilloTarjeta(0.5) > 0.8);
  cerca(brilloTarjeta(1), 0.25, 1e-9);
});

test('escenas: las materias de 2023 giran libres', () => {
  assert.ok(idsConEscena.has(2));
  assert.equal(esEscenaFija(2), false);
});

test('limiteDeGiro: las escenas planas (2023) y de objeto con frente (2024) no dan la vuelta entera', () => {
  for (const id of [2, 3]) {
    const limite = limiteDeGiro(id);
    assert.ok(limite > 0.3 && limite < Math.PI / 2, `límite de la escena ${id}: ${limite}`);
  }
});

test('limiteDeGiro: la notebook gira libre y las escenas fijas no tienen límite', () => {
  assert.equal(limiteDeGiro(0), null);
  assert.equal(limiteDeGiro(1), null);
  assert.equal(limiteDeGiro(99), null);
});

test('ledEncendido: determinista, cada LED parpadea y no todos están prendidos a la vez', () => {
  assert.equal(CANTIDAD_LEDS, 12);
  assert.equal(ledEncendido(3, 1.7), ledEncendido(3, 1.7));
  let prendidosAlMismoTiempo = new Set();
  for (let i = 0; i < CANTIDAD_LEDS; i += 1) {
    let prendido = 0;
    let cambios = 0;
    let anterior = ledEncendido(i, 0);
    for (let t = 0; t < 20; t += 0.05) {
      const ahora = ledEncendido(i, t);
      if (ahora) prendido += 1;
      if (ahora !== anterior) cambios += 1;
      anterior = ahora;
    }
    const fraccion = prendido / 400;
    assert.ok(fraccion > 0.2 && fraccion < 0.8, `LED ${i} prendido ${Math.round(fraccion * 100)} %`);
    assert.ok(cambios >= 4, `LED ${i} sólo cambió ${cambios} veces`);
    prendidosAlMismoTiempo.add(ledEncendido(i, 2.3));
  }
  assert.equal(prendidosAlMismoTiempo.size, 2, 'en un mismo instante hay LEDs prendidos y apagados');
});

test('destornillador: sube y baja en ciclo, gira sólo mientras aprieta y repite', () => {
  let minimo = 1;
  let maximo = 0;
  for (let t = 0; t < DURACION_DESTORNILLADOR; t += 0.02) {
    const h = alturaDestornillador(t);
    assert.ok(h >= 0 && h <= 1, `altura fuera de rango: ${h}`);
    minimo = Math.min(minimo, h);
    maximo = Math.max(maximo, h);
  }
  assert.equal(minimo, 0);
  assert.equal(maximo, 1);
  cerca(alturaDestornillador(1.1), alturaDestornillador(1.1 + DURACION_DESTORNILLADOR), 1e-9);
  // abajo (apretando) gira; arriba (en el aire) está quieto
  // (1,5 s y 2,2 s caen dentro de la fase de apretado; 3,3 s y 4 s ya está subiendo)
  assert.ok(giroDestornillador(2.2) > giroDestornillador(1.5));
  cerca(giroDestornillador(3.3), giroDestornillador(4), 1e-9);
  cerca(giroDestornillador(0), giroDestornillador(0.1), 1e-9);
  // el giro nunca retrocede
  let anterior = giroDestornillador(0);
  for (let t = 0; t < DURACION_DESTORNILLADOR * 3; t += 0.03) {
    const g = giroDestornillador(t);
    assert.ok(g >= anterior - 1e-9);
    anterior = g;
  }
});

test('escenas: el banco de 2025 existe y gira sólo dentro de un rango', () => {
  assert.ok(idsConEscena.has(4));
  assert.equal(esEscenaFija(4), false);
  const limite = limiteDeGiro(4);
  assert.ok(limite > 0.3 && limite < Math.PI / 2);
});
