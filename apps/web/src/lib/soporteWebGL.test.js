import test from 'node:test';
import assert from 'node:assert/strict';
import { hayWebGL } from './soporteWebGL.js';

test('hayWebGL: false si ningún contexto está disponible', () => {
  assert.equal(hayWebGL(() => ({ getContext: () => null })), false);
});

test('hayWebGL: true con webgl2 o sólo con webgl', () => {
  assert.equal(hayWebGL(() => ({ getContext: (tipo) => (tipo === 'webgl2' ? {} : null) })), true);
  assert.equal(hayWebGL(() => ({ getContext: (tipo) => (tipo === 'webgl' ? {} : null) })), true);
});

test('hayWebGL: false si crear el lienzo lanza', () => {
  assert.equal(
    hayWebGL(() => {
      throw new Error('sin DOM');
    }),
    false
  );
});
