import test from 'node:test';
import assert from 'node:assert/strict';
import { crearAcumulador, encuadreRetrato, grillaHexagonal } from './rayosx.js';

test('acumulador: suma sólo adentro y dispara una vez al llegar al límite', () => {
  const a = crearAcumulador(4000);
  assert.equal(a.sumar(1000, false), false);
  assert.equal(a.valor, 0);
  assert.equal(a.sumar(3000, true), false);
  assert.equal(a.sumar(999, true), false);
  assert.equal(a.sumar(1, true), true);
  assert.equal(a.disparado, true);
  assert.equal(a.sumar(5000, true), false); // no vuelve a disparar
  a.reiniciar();
  assert.equal(a.valor, 0);
  assert.equal(a.disparado, false);
  assert.equal(a.sumar(4000, true), true);
});

test('grilla hexagonal: 12 lugares, filas impares corridas y centrada', () => {
  const g = grillaHexagonal(12, 0.65);
  assert.equal(g.length, 12);
  // 4 por fila: la fila 1 (lugares 4..7) va corrida medio paso respecto de la 0
  assert.ok(Math.abs(g[4][0] - g[0][0] - 0.325) < 1e-9);
  assert.ok(Math.abs(g[8][0] - g[0][0]) < 1e-9);
  // las filas avanzan 0,65 × 0,65 en z
  assert.ok(Math.abs(g[4][2] - g[0][2] - 0.4225) < 1e-9);
  // centrada: el primero y el espejo del último de la fila 0 son simétricos en x
  assert.ok(Math.abs(g[0][0] + g[3][0]) < 1e-9);
  assert.ok(g.every((p) => p[1] === 0));
});

test('encuadre del retrato: el cráneo cae en el punto calibrado con el alto pedido', () => {
  const craneo = { centroY: 0.78, alto: 0.2 };
  const cal = { centroX: 0.5, centroY: 0.25, alto: 0.2 };
  for (const aspecto of [0.75, 1.3]) {
    const { escala, x, y } = encuadreRetrato(cal, aspecto, craneo);
    // alto del cráneo en pantalla = 0,2 del marco (el marco mide 2 unidades)
    assert.ok(Math.abs(craneo.alto * escala - 0.4) < 1e-9);
    // centro del cráneo en pantalla: x en el medio, y a un cuarto desde arriba
    assert.ok(Math.abs(x) < 1e-9);
    assert.ok(Math.abs(y + craneo.centroY * escala - 0.5) < 1e-9);
  }
});
