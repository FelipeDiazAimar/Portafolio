// Efectos inmersivos del pasillo, dentro del render (no son capas pintadas encima de la página).
// La lente (distorsión de barril, aberración cromática en los bordes y grano) y, encima, el
// holograma en los bordes. Todos actúan sobre la periferia de la imagen y crecen con la velocidad.
// Sólo existen con postprocesado (equipos con margen); en celulares no hay ninguno.
import * as THREE from 'three';
import { BlendFunction, ChromaticAberrationEffect, Effect, EffectAttribute, EffectPass, NoiseEffect } from 'postprocessing';

// Ruido y máscara radial compartidos por los efectos de borde.
const COMUN = /* glsl */ `
  uniform float rapidez;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float ruido(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * ruido(p); p *= 2.03; a *= 0.5; }
    return v;
  }
  // 0 en el centro, 1 en los bordes (más ancho hacia los costados que arriba y abajo)
  float borde(vec2 uv) {
    vec2 d = (uv - vec2(0.5, 0.48)) * vec2(1.0, 0.72);
    return smoothstep(0.26 - rapidez * 0.08, 0.62, length(d) * 1.25);
  }
`;

const SHADERS = {
  // líneas de barrido, desfase RGB y parpadeo en los costados
  holograma: /* glsl */ `
    void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
      float m = borde(uv);
      if (m < 0.002) { outputColor = inputColor; return; }
      float corte = step(0.985 - rapidez * 0.05, hash(vec2(floor(uv.y * 70.0), floor(time * 9.0))));
      float desvio = (0.004 + rapidez * 0.012 + corte * 0.03) * m;
      float r = texture2D(inputBuffer, uv + vec2(desvio, 0.0)).r;
      float g = texture2D(inputBuffer, uv).g;
      float b = texture2D(inputBuffer, uv - vec2(desvio, 0.0)).b;
      float lineas = 0.82 + 0.18 * sin(uv.y * resolution.y * 1.6 + time * 8.0);
      vec3 color = vec3(r, g, b) * mix(1.0, lineas, m);
      color = mix(color, color * vec3(0.55, 0.95, 1.25), m * 0.55);
      outputColor = vec4(color * (1.0 - 0.06 * m * step(0.5, hash(vec2(floor(time * 24.0))))), inputColor.a);
    }`,
};

class EfectoBorde extends Effect {
  constructor(id) {
    super(`Borde_${id}`, COMUN + SHADERS[id], { attributes: EffectAttribute.CONVOLUTION, uniforms: new Map([['rapidez', new THREE.Uniform(0)]]) });
  }
}

class Barril extends Effect {
  constructor() {
    super(
      'Barril',
      /* glsl */ `
      uniform float curva;
      void mainUv(inout vec2 uv) {
        vec2 d = uv - 0.5;
        uv = 0.5 + d * (1.0 - curva * dot(d, d)) / (1.0 - curva * 0.25);
      }`,
      { uniforms: new Map([['curva', new THREE.Uniform(0.12)]]) },
    );
  }
}

// El efecto de borde elegido: holograma (desfase RGB, barrido y cortes en los costados).
const EFECTO = 'holograma';

export function crearEfectos({ camara, composer }) {
  let borde = null;
  let aberracion = null;

  function agregarPasadas() {
    if (!composer) return;
    borde = new EfectoBorde(EFECTO);
    composer.addPass(new EffectPass(camara, borde));
    // la lente, siempre
    aberracion = new ChromaticAberrationEffect({ offset: new THREE.Vector2(0.0015, 0.0015), radialModulation: true, modulationOffset: 0.25 });
    composer.addPass(new EffectPass(camara, aberracion));
    const grano = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false });
    grano.blendMode.opacity.value = 0.12;
    composer.addPass(new EffectPass(camara, new Barril(), grano));
  }

  let rapidez = 0;
  return {
    agregarPasadas,
    cuadro({ dt, velocidad }) {
      rapidez += (Math.min(1, velocidad / 2.6) - rapidez) * Math.min(1, dt * 6);
      if (borde) borde.uniforms.get('rapidez').value = rapidez;
      if (aberracion) aberracion.offset.set(0.0012 + rapidez * 0.004, 0.0012 + rapidez * 0.004);
    },
    destruir() {},
  };
}
