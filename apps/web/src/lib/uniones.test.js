import test from 'node:test';
import assert from 'node:assert/strict';
import { PARADAS_FUNDIDO, bandasDeUnion, mascaraDeUnion } from './uniones.js';

test('uniones: con la sección ocupando toda la vista no hay fundido', () => {
  assert.deepEqual(bandasDeUnion(0, 900, 900), { arriba: 0, abajo: 0 });
  // sección más alta que la ventana (Sobre mí): sus bordes están fuera de la vista
  assert.deepEqual(bandasDeUnion(-3000, 12000, 900), { arriba: 0, abajo: 0 });
});

test('uniones: el fundido crece con lo que se ve del borde y tiene tope', () => {
  assert.deepEqual(bandasDeUnion(100, 1000, 900), { arriba: 100, abajo: 0 });
  assert.deepEqual(bandasDeUnion(700, 1600, 900), { arriba: 360, abajo: 0 }); // tope: 0,4 de la ventana
  assert.deepEqual(bandasDeUnion(-500, 450, 900), { arriba: 0, abajo: 360 });
  assert.deepEqual(bandasDeUnion(-500, 800, 900, 0.6), { arriba: 0, abajo: 100 });
});

test('uniones: la curva de opacidad sube sin saltos y es simétrica', () => {
  for (let i = 1; i < PARADAS_FUNDIDO.length; i += 1) {
    assert.ok(PARADAS_FUNDIDO[i][0] > PARADAS_FUNDIDO[i - 1][0]);
    assert.ok(PARADAS_FUNDIDO[i][1] >= PARADAS_FUNDIDO[i - 1][1]);
    // sin saltos grandes entre paradas (un escalón se vería como una línea)
    assert.ok(PARADAS_FUNDIDO[i][1] - PARADAS_FUNDIDO[i - 1][1] < 0.25);
  }
  PARADAS_FUNDIDO.forEach(([k, a]) => {
    const espejo = PARADAS_FUNDIDO.find(([k2]) => Math.abs(k2 - (1 - k)) < 1e-9);
    if (espejo) assert.ok(Math.abs(a + espejo[1] - 1) < 0.01);
  });
});

test('uniones: la máscara va de transparente a opaco y de vuelta, con las dos variables', () => {
  const m = mascaraDeUnion();
  assert.ok(m.startsWith('linear-gradient(to bottom, transparent 0,'));
  assert.ok(m.endsWith('transparent 100%)'));
  assert.ok(m.includes('var(--banda-arriba)') && m.includes('calc(100% - var(--banda-abajo))'));
  // sólo el fundido de abajo: arriba queda opaco
  assert.ok(mascaraDeUnion(false, true).startsWith('linear-gradient(to bottom, #000 0,'));
  assert.ok(mascaraDeUnion(true, false).endsWith('#000 100%)'));
});
