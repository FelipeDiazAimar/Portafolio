import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALTO_PLANO,
  ANCHO_PLANO,
  BEND_BASE,
  BEND_MAX,
  FRACCION_CENTRAL,
  DESFASE_Z,
  PASO_THETA,
  amortiguar,
  bendDe,
  dentroDeCuadrilatero,
  faseDeProgreso,
  hitoCercano,
  hitoDestino,
  hitosDeArrastre,
  impulsoLimitado,
  inclinacionDe,
  medidasPista,
  poseDe,
  progresoDeFase,
  relativoDe,
  vistaEn,
} from './geometria.js';

const cerca = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('relativoDe: sin envolver es la resta; envuelto cae en [-N/2, N/2)', () => {
  assert.equal(relativoDe(3, 1, 7), 2);
  assert.equal(relativoDe(0, 6, 7), -6);
  for (let i = 0; i < 7; i++) {
    for (let f = 0; f <= 6; f += 0.25) {
      const r = relativoDe(i, f, 7, true);
      assert.ok(r >= -3.5 && r < 3.5, `${i} - ${f} → ${r}`);
    }
  }
  cerca(relativoDe(0, 6, 7, true), 1); // con el anillo, Origen queda justo después de Hoy
  cerca(relativoDe(6, 0, 7, true), -1);
});

test('poseDe: la del centro va de frente y las vecinas son espejo en x y giro', () => {
  const pista = { radio: 6, profundidad: 1.9, paso: 1.2 };
  const centro = poseDe(0, pista);
  cerca(centro.x, 0);
  cerca(centro.y, 0);
  cerca(centro.z, pista.profundidad - DESFASE_Z);
  cerca(centro.rotY, 0);
  const der = poseDe(1, pista);
  const izq = poseDe(-1, pista);
  cerca(der.x, Math.sin(PASO_THETA) * 6);
  cerca(der.x, -izq.x);
  cerca(der.rotY, -izq.rotY);
  cerca(der.z, izq.z);
  assert.ok(der.y > 0 && izq.y < 0, 'la de la derecha sube, la de la izquierda baja');
  assert.ok(der.z < centro.z, 'las vecinas quedan más lejos');
  cerca(der.rotX, -0.01);
});

test('poseDe: pasado un cuarto de vuelta la portada mira hacia atrás', () => {
  const pista = { radio: 6, profundidad: 1.9, paso: 1.2 };
  assert.equal(poseDe(2, pista).deFrente, true); // 1,46 rad
  assert.equal(poseDe(2.2, pista).deFrente, false); // 1,606 rad
  assert.equal(poseDe(-3, pista).deFrente, false);
});

test('amortiguar: se acerca sin pasarse y un dt enorme no pega un salto', () => {
  let fase = 0;
  for (let i = 0; i < 600; i++) {
    const antes = fase;
    fase = amortiguar(fase, 3, 1 / 60);
    assert.ok(fase >= antes && fase <= 3);
  }
  cerca(fase, 3, 1e-6);
  // 10 s de pausa cuentan como 0,05 s
  cerca(amortiguar(0, 1, 10), amortiguar(0, 1, 0.05));
  cerca(amortiguar(0, 1, 0.05), 1 - Math.exp(-13 * 0.05));
  assert.equal(amortiguar(2, 5, 0), 2);
});

test('bendDe e inclinacionDe: 0,30 en reposo, tope 0,42, inclinación acotada y con signo', () => {
  cerca(bendDe(0), BEND_BASE);
  cerca(bendDe(99), BEND_MAX);
  cerca(bendDe(-99), BEND_MAX);
  assert.ok(bendDe(1) > BEND_BASE && bendDe(1) < BEND_MAX);
  assert.equal(inclinacionDe(0), 0);
  assert.ok(inclinacionDe(1) > 0 && inclinacionDe(-1) < 0);
  cerca(inclinacionDe(1000), 0.09);
});

test('progreso ↔ fase: ida y vuelta, y el hito más cercano queda dentro del rango', () => {
  cerca(faseDeProgreso(0.5, 7), 3);
  cerca(faseDeProgreso(2, 7), 6);
  cerca(faseDeProgreso(-1, 7), 0);
  for (let i = 0; i < 7; i++) cerca(faseDeProgreso(progresoDeFase(i, 7), 7), i);
  assert.equal(hitoCercano(2.49, 7), 2);
  assert.equal(hitoCercano(2.51, 7), 3);
  assert.equal(hitoCercano(-4, 7), 0);
  assert.equal(hitoCercano(40, 7), 6);
  assert.equal(progresoDeFase(3, 1), 0);
});

test('impulsoLimitado: una rueda brusca no salta más que el tope', () => {
  assert.equal(impulsoLimitado(900, 120), 120);
  assert.equal(impulsoLimitado(-900, 120), -120);
  assert.equal(impulsoLimitado(40, 120), 40);
});

test('hitosDeArrastre: hacia la izquierda avanza, hacia abajo avanza, gana el eje mayor', () => {
  assert.ok(hitosDeArrastre(-200, 0, 1000, 800) > 0);
  assert.ok(hitosDeArrastre(200, 0, 1000, 800) < 0);
  assert.ok(hitosDeArrastre(0, 200, 1000, 800) > 0);
  assert.ok(hitosDeArrastre(0, -200, 1000, 800) < 0);
  // diagonal: no suma los dos ejes
  cerca(hitosDeArrastre(-420, 10, 1000, 800), 1);
});

test('medidasPista: la portada del centro ocupa la fracción pedida del ancho, en escritorio y en celular', () => {
  const pc = medidasPista(1920, 1080, false);
  const vistaPc = vistaEn(pc.profundidad - DESFASE_Z, 1920 / 1080);
  cerca((ANCHO_PLANO * pc.escala) / vistaPc.ancho, FRACCION_CENTRAL.escritorio, 1e-9);
  const cel = medidasPista(390, 844, true);
  const vistaCel = vistaEn(cel.profundidad - DESFASE_Z, 390 / 844);
  cerca((ANCHO_PLANO * cel.escala) / vistaCel.ancho, FRACCION_CENTRAL.movil, 1e-9);
  // el paso vertical se mantiene bajo en celular: las vecinas no se apilan
  assert.ok(cel.paso < ALTO_PLANO * cel.escala * 0.5);
  cerca(pc.paso, 0.52 * pc.escala);
});

test('medidasPista: en una pantalla ancha y baja la portada no se pasa del alto', () => {
  const m = medidasPista(2560, 720, false);
  const vista = vistaEn(m.profundidad - DESFASE_Z, 2560 / 720);
  assert.ok((ALTO_PLANO * m.escala) / vista.alto <= 0.62 + 1e-9);
});

test('hitoDestino: un avance corto pero decidido va al siguiente; uno mínimo vuelve', () => {
  assert.equal(hitoDestino(2.2, 2, 7), 3); // un giro de rueda
  assert.equal(hitoDestino(2.08, 2, 7), 2); // un temblor del trackpad
  assert.equal(hitoDestino(1.8, 2, 7), 1);
  assert.equal(hitoDestino(1.95, 2, 7), 2);
  // a mitad de un asentamiento hacia el 3, un retroceso chico vuelve al 2
  assert.equal(hitoDestino(2.5, 3, 7), 2);
});

test('hitoDestino: tras recorrer más de un hito se queda en el más cercano, dentro del rango', () => {
  assert.equal(hitoDestino(4.4, 2, 7), 4);
  assert.equal(hitoDestino(4.6, 2, 7), 5);
  assert.equal(hitoDestino(0.1, 3, 7), 0);
  assert.equal(hitoDestino(6.05, 6, 7), 6);
  assert.equal(hitoDestino(5.9, 6, 7), 6);
  assert.equal(hitoDestino(0.3, 0, 7), 1);
  assert.equal(hitoDestino(-0.3, 0, 7), 0);
  assert.equal(hitoDestino(6.4, 6, 7), 6);
});

test('dentroDeCuadrilatero: adentro, afuera y con los puntos en cualquier sentido', () => {
  const q = [[10, 10], [110, 30], [100, 90], [20, 80]];
  assert.equal(dentroDeCuadrilatero(q, 60, 50), true);
  assert.equal(dentroDeCuadrilatero(q, 5, 50), false);
  assert.equal(dentroDeCuadrilatero(q, 60, 95), false);
  assert.equal(dentroDeCuadrilatero([...q].reverse(), 60, 50), true);
});
