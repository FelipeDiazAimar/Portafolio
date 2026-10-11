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
import { paletaEscena, valorMultimetro } from './paletas.js';
import { CAJAS, CICLO, LARGO, PAUSA, RUTA, S_ESCANER, VELOCIDAD, distanciaCaja, estadoPlanta, progresoEscaneo, puntoEnRuta, tiempoCinta } from './cicloPlanta.js';
import {
  CAPAS,
  CENTRO,
  NODOS,
  RADIO,
  T_COLAPSO,
  T_RED,
  activacion,
  aparicion,
  aparicionNucleo,
  colapso,
  conexionesRed,
  enlaces,
  expansion,
  expansionCapa,
  fasePulso,
  nodosRed,
  posicionNodo,
  progresoEnlace,
  puntoDe,
  puntoEnTramo,
} from './constelacion.js';
import { MATERIAS, T_FIN_TILDES, progresoTilde, progresoSello, escalaTilde, brilloTarjeta } from './cicloMaterias.js';
import { velocidadInicial, avanzarCaida, volverAlOrigen, LIMITE_CAIDA } from './caida.js';
import {
  estadoPantalla,
  progresoApertura,
  factorLuzPantalla,
  DURACION_APERTURA,
  DURACION_TOTAL,
  LINEAS,
} from './pantallaNotebook.js';

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

test('escenas: el banco de 2025 existe y gira sólo dentro de un rango', () => {
  assert.ok(idsConEscena.has(4));
  assert.equal(esEscenaFija(4), false);
  const limite = limiteDeGiro(4);
  assert.ok(limite > 0.3 && limite < Math.PI / 2);
});

test('paletaEscena: clara y oscura tienen las mismas claves y la clara es más luminosa', () => {
  const clara = paletaEscena(true);
  const oscura = paletaEscena(false);
  assert.deepEqual(Object.keys(clara).sort(), Object.keys(oscura).sort());
  const luz = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114;
  };
  for (const clave of ['chasis', 'tarjeta', 'tapete']) {
    assert.ok(luz(clara[clave]) > luz(oscura[clave]) + 40, `${clave}: la variante clara debe ser mucho más clara`);
  }
  for (const valor of [...Object.values(clara), ...Object.values(oscura)]) assert.match(valor, /^#[0-9a-f]{6}$/i);
});

test('valorMultimetro: lectura plausible, estable y con formato fijo', () => {
  for (let t = 0; t < 30; t += 0.7) {
    const v = valorMultimetro(t);
    assert.match(v, /^\d\.\d{3}$/, v);
    assert.ok(parseFloat(v) > 4.9 && parseFloat(v) < 5.1, `fuera de rango: ${v}`);
  }
  assert.equal(valorMultimetro(2), valorMultimetro(2));
});

// --- Placa en reparación ------------------------------------------------------
const dentroDe = (x, z, zona, margen = 0) =>
  Math.abs(x - zona.x) <= zona.ancho / 2 + margen && Math.abs(z - zona.z) <= zona.fondo / 2 + margen;

test('puntoEnRuta: arranca en la entrada, termina al final de la L y no da saltos', () => {
  const inicio = puntoEnRuta(0);
  cerca(inicio.x, RUTA[0][0]);
  cerca(inicio.z, RUTA[0][1]);
  const fin = puntoEnRuta(LARGO);
  cerca(fin.x, RUTA.at(-1)[0]);
  cerca(fin.z, RUTA.at(-1)[1]);
  let anterior = puntoEnRuta(0);
  for (let s = 0.01; s <= LARGO; s += 0.01) {
    const p = puntoEnRuta(s);
    assert.ok(Math.hypot(p.x - anterior.x, p.z - anterior.z) < 0.011, `salto en s=${s}`);
    anterior = p;
  }
});

test('puntoEnRuta: la caja gira un cuarto de vuelta al doblar, sin saltos bruscos', () => {
  cerca(puntoEnRuta(0.2).giro, 0);
  cerca(puntoEnRuta(LARGO - 0.2).giro, Math.PI / 2);
  let anterior = puntoEnRuta(0).giro;
  for (let s = 0.01; s <= LARGO; s += 0.01) {
    const g = puntoEnRuta(s).giro;
    assert.ok(Math.abs(g - anterior) < 0.1, `giro brusco en s=${s}`);
    anterior = g;
  }
});

test('tiempoCinta: avanza con el reloj salvo mientras la cinta está frenada', () => {
  const inicio = S_ESCANER / VELOCIDAD;
  cerca(tiempoCinta(1) - tiempoCinta(0), 1);
  cerca(tiempoCinta(inicio + 0.1), inicio);
  cerca(tiempoCinta(inicio + PAUSA - 0.1), inicio, 1e-9);
  cerca(tiempoCinta(inicio + PAUSA + 1) - tiempoCinta(inicio + PAUSA), 1);
  let anterior = 0;
  for (let t = 0; t < CICLO * 3; t += 0.05) {
    const valor = tiempoCinta(t);
    assert.ok(valor >= anterior - 1e-12, `retrocede en t=${t}`);
    anterior = valor;
  }
});

test('distanciaCaja: la caja 0 queda frenada justo bajo el escáner en cada ciclo, y las cajas van parejas', () => {
  for (let ciclo = 0; ciclo < 3; ciclo += 1) {
    const durante = ciclo * CICLO + S_ESCANER / VELOCIDAD + PAUSA / 2;
    cerca(distanciaCaja(0, durante), S_ESCANER, 1e-6);
  }
  const separacion = LARGO / CAJAS;
  cerca(distanciaCaja(1, 0) - distanciaCaja(0, 0), separacion);
  for (let t = 0; t < CICLO * 2; t += 0.37) {
    for (let i = 0; i < CAJAS; i += 1) {
      const s = distanciaCaja(i, t);
      assert.ok(s >= 0 && s < LARGO, `caja ${i} fuera de la ruta: ${s}`);
    }
  }
  // Pasado un ciclo completo todo vuelve a la misma posición.
  cerca(distanciaCaja(3, 5), distanciaCaja(3, 5 + CICLO), 1e-6);
});

test('progresoEscaneo: sólo hay láser justo bajo el escáner', () => {
  assert.equal(progresoEscaneo(0), 0);
  cerca(progresoEscaneo(S_ESCANER), 1);
  assert.equal(progresoEscaneo(S_ESCANER + 1), 0);
});

test('estadoPlanta: fuera de la pausa todo está en reposo', () => {
  const e = estadoPlanta(0.5);
  assert.equal(e.pausa, false);
  for (const clave of ['zoom', 'etiqueta', 'escaneo', 'lectura', 'subida', 'sap', 'registro', 'tablero', 'construccion']) assert.equal(e[clave], 0, clave);
});

test('estadoPlanta: la secuencia ocurre en orden y todo queda entre 0 y 1', () => {
  const inicio = S_ESCANER / VELOCIDAD;
  const momento = (p) => estadoPlanta(inicio + p);
  const claves = ['zoom', 'etiqueta', 'escaneo', 'lectura', 'subida', 'sap', 'registro', 'tablero', 'construccion'];
  // Zoom primero, después la etiqueta, el escaneo, la lectura, la subida y el panel de SAP.
  assert.ok(momento(1.5).zoom > 0.99);
  assert.ok(momento(2).etiqueta > 0.99 && momento(2).escaneo === 0);
  assert.ok(momento(3).escaneo > 0.3 && momento(3).escaneo < 0.7 && momento(3).lectura === 0);
  assert.ok(momento(4).lectura > 0 && momento(4).lectura < 1 && momento(4).escaneo === 1);
  assert.ok(momento(5).subida > 0 && momento(5).subida < 1 && momento(5).sap === 0);
  assert.ok(momento(6.2).sap > 0.99 && momento(6.2).registro > 0 && momento(6.2).registro < 1);
  assert.equal(momento(6.7).registro, 1);
  // Después del registro, SAP se va y se arma el tablero de trazabilidad.
  assert.ok(momento(8.8).sap === 0 && momento(8.8).tablero > 0.99);
  assert.ok(momento(9.5).construccion > 0 && momento(9.5).construccion < 1);
  assert.equal(momento(11.5).construccion, 1);
  assert.equal(momento(5).tablero, 0);
  // Al terminar vuelve todo al estado inicial.
  const fin = momento(PAUSA + 0.1);
  assert.equal(claves.reduce((suma, clave) => suma + fin[clave], 0), 0);
  for (let p = -1; p <= PAUSA + 1; p += 0.05) {
    const e = momento(p);
    for (const clave of claves) assert.ok(e[clave] >= 0 && e[clave] <= 1, `${clave} fuera de rango en p=${p}: ${e[clave]}`);
  }
});
test('estadoPlanta: el zoom entra y sale sin saltos', () => {
  let anterior = estadoPlanta(0).zoom;
  for (let t = 0.02; t < CICLO * 2; t += 0.02) {
    const z = estadoPlanta(t).zoom;
    assert.ok(Math.abs(z - anterior) < 0.08, `salto de zoom en t=${t}`);
    anterior = z;
  }
});

test('escenas: la planta de 2026 existe y gira sólo dentro de un rango', () => {
  assert.ok(idsConEscena.has(5));
  assert.equal(esEscenaFija(5), false);
  assert.ok(limiteDeGiro(5) > 0);
});

test('constelación: los nodos están sobre un anillo, parejos y sin pisarse', () => {
  const puntos = Array.from({ length: NODOS }, (_, i) => posicionNodo(i));
  for (const [x, , z] of puntos) cerca(Math.hypot(x, z), RADIO);
  const distancias = puntos.map((p, i) => Math.hypot(p[0] - puntos[(i + 1) % NODOS][0], p[2] - puntos[(i + 1) % NODOS][2]));
  for (const d of distancias) {
    cerca(d, distancias[0]);
    assert.ok(d > 1.5, `nodos muy juntos: ${d}`);
  }
  assert.ok(puntos[0][1] > 0 && puntos[1][1] < 0, 'el anillo sube y baja');
});

test('constelación: enlaces en cadena hasta el núcleo y un hilo de cada nodo al centro', () => {
  const lista = enlaces();
  const cadena = lista.filter((e) => e.tipo === 'cadena');
  assert.equal(cadena.length, NODOS);
  assert.deepEqual(cadena[0], { desde: 0, hasta: 1, tipo: 'cadena' });
  assert.deepEqual(cadena.at(-1), { desde: NODOS - 1, hasta: CENTRO, tipo: 'cadena' });
  assert.equal(lista.filter((e) => e.tipo === 'hilo').length, NODOS);
  for (const e of lista) {
    assert.ok(e.desde >= 0 && e.desde < NODOS);
    assert.ok(e.hasta === CENTRO || (e.hasta >= 0 && e.hasta < NODOS));
  }
  assert.deepEqual(puntoDe(CENTRO), [0, 0, 0]);
});

test('constelación: los pulsos recorren el enlace de punta a punta y se repiten', () => {
  const a = puntoDe(0);
  const b = puntoDe(1);
  assert.deepEqual(puntoEnTramo(a, b, 0), a);
  for (let i = 0; i < 3; i += 1) cerca(puntoEnTramo(a, b, 1)[i], b[i]);
  const medio = puntoEnTramo(a, b, 0.5);
  for (let i = 0; i < 3; i += 1) cerca(medio[i], (a[i] + b[i]) / 2);
  for (let t = 0; t < 30; t += 0.13) {
    for (let k = 0; k < 12; k += 1) {
      const f = fasePulso(t, k);
      assert.ok(f >= 0 && f < 1, `fuera de rango: ${f}`);
    }
  }
  assert.notEqual(fasePulso(1, 0), fasePulso(1, 1));
  cerca(fasePulso(0, 0), fasePulso(1 / 0.32, 0), 1e-9);
});

test('escenas: la constelación de Hoy existe y no gira 360°', () => {
  assert.ok(idsConEscena.has(6));
  assert.equal(esEscenaFija(6), false);
  assert.ok(limiteDeGiro(6) > 0, 'no da la vuelta entera');
});

test('guion de Hoy: el núcleo aparece primero y los nodos de a uno, en orden', () => {
  assert.equal(aparicionNucleo(0), 0);
  assert.equal(aparicionNucleo(5), 1);
  assert.equal(aparicion(0, 0), 0);
  for (let i = 0; i < NODOS - 1; i += 1) {
    // Cada nodo empieza después que el anterior y todos terminan de aparecer.
    let t = 0;
    while (aparicion(i + 1, t) === 0) t += 0.01;
    assert.ok(aparicion(i, t) > 0, `el nodo ${i} debería haber empezado antes que el ${i + 1}`);
  }
  assert.equal(aparicion(NODOS - 1, 20), 1);
  for (let i = 0; i < NODOS; i += 1) {
    let anterior = 0;
    for (let t = 0; t < 12; t += 0.05) {
      assert.ok(aparicion(i, t) >= anterior - 1e-12);
      anterior = aparicion(i, t);
    }
  }
});

test('guion de Hoy: la constelación se completa antes de recogerse y la red sale después', () => {
  assert.equal(aparicion(NODOS - 1, T_COLAPSO[0]), 1);
  assert.equal(colapso(T_COLAPSO[0] - 0.01), 0);
  assert.equal(colapso(T_COLAPSO[1]), 1);
  assert.equal(expansion(T_RED[0] - 0.01), 0);
  assert.equal(expansion(T_RED[1]), 1);
  assert.ok(T_RED[0] >= T_COLAPSO[0] && T_RED[0] <= T_COLAPSO[1], 'la red nace mientras la constelación se recoge');
  assert.ok(T_RED[1] > T_COLAPSO[1]);
});

test('guion de Hoy: los enlaces se dibujan al aparecer su nodo', () => {
  const lista = enlaces();
  for (const e of lista) {
    assert.equal(progresoEnlace(e, 0), 0);
    assert.equal(progresoEnlace(e, 30), 1);
  }
  const primero = lista.find((e) => e.tipo === 'cadena' && e.desde === 0);
  assert.ok(progresoEnlace(primero, 0.7 + 1.2) > 0, 'el primer enlace sale con el segundo nodo');
});

test('red neuronal: capas de tamaño fijo, ordenadas en x y con todos los nodos distintos', () => {
  const nodos = nodosRed();
  assert.equal(nodos.length, CAPAS.reduce((a, b) => a + b, 0));
  for (let c = 0; c < CAPAS.length; c += 1) assert.equal(nodos.filter((n) => n.capa === c).length, CAPAS[c]);
  for (const n of nodos) assert.ok(n.posicion.every(Number.isFinite));
  const xs = CAPAS.map((_, c) => nodos.find((n) => n.capa === c).posicion[0]);
  for (let c = 1; c < xs.length; c += 1) assert.ok(xs[c] > xs[c - 1]);
  cerca(xs[0], -xs.at(-1));
  for (let i = 0; i < nodos.length; i += 1) {
    for (let j = i + 1; j < nodos.length; j += 1) {
      const d = Math.hypot(...nodos[i].posicion.map((v, k) => v - nodos[j].posicion[k]));
      assert.ok(d > 0.3, `nodos ${i} y ${j} casi superpuestos (${d})`);
    }
  }
});

test('red neuronal: cada nodo se conecta con todos los de la capa siguiente', () => {
  const nodos = nodosRed();
  const conexiones = conexionesRed();
  const esperadas = CAPAS.slice(0, -1).reduce((suma, n, c) => suma + n * CAPAS[c + 1], 0);
  assert.equal(conexiones.length, esperadas);
  for (const { capa, a, b } of conexiones) {
    assert.equal(nodos[a].capa, capa);
    assert.equal(nodos[b].capa, capa + 1);
  }
});

test('red neuronal: las capas se expanden en orden desde el medio y la activación es una onda', () => {
  const t = (T_RED[0] + T_RED[1]) / 2;
  const medio = (CAPAS.length - 1) / 2;
  assert.ok(expansionCapa(medio, t) > expansionCapa(0, t), 'el medio sale primero');
  for (let c = 0; c < CAPAS.length; c += 1) {
    assert.equal(expansionCapa(c, T_RED[0] - 0.1), 0);
    assert.equal(expansionCapa(c, T_RED[1] + 1), 1);
  }
  let maximo = 0;
  for (let tt = 0; tt < 20; tt += 0.05) {
    for (let c = 0; c < CAPAS.length; c += 1) {
      const a = activacion(c, tt);
      assert.ok(a >= 0 && a <= 1);
      maximo = Math.max(maximo, a);
    }
  }
  assert.ok(maximo > 0.95, 'la onda llega a pleno');
});
