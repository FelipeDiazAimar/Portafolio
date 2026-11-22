// Efectos inmersivos del pasillo, dentro del render (no son capas pintadas encima de la página).
// Todo en UN solo pase de pantalla completa (antes eran tres): la lente (distorsión de barril,
// aberración cromática que crece hacia los bordes y grano) y el holograma en los costados
// (desfase RGB, líneas de barrido y cortes), que crece con la velocidad. Sólo existe con
// postprocesado (equipos con margen y fuera del modo rendimiento).
import * as THREE from 'three';
import { Effect, EffectAttribute, EffectPass } from 'postprocessing';

const LENTE = /* glsl */ `
uniform float rapidez;
uniform float curva;
uniform float aberracion;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// 0 en el centro, 1 en los bordes (más ancho hacia los costados que arriba y abajo)
float borde(vec2 uv) {
  vec2 d = (uv - vec2(0.5, 0.48)) * vec2(1.0, 0.72);
  return smoothstep(0.26 - rapidez * 0.08, 0.62, length(d) * 1.25);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  // barril
  vec2 d = uv - 0.5;
  vec2 q = 0.5 + d * (1.0 - curva * dot(d, d)) / (1.0 - curva * 0.25);
  // aberración radial (nula en el centro) + desfase del holograma en los costados
  float m = borde(q);
  float corte = step(0.985 - rapidez * 0.05, hash(vec2(floor(q.y * 70.0), floor(time * 9.0))));
  vec2 radial = (q - 0.5) * aberracion * smoothstep(0.1, 0.6, length(q - 0.5) * 1.4);
  vec2 desvio = vec2((0.004 + rapidez * 0.012 + corte * 0.03) * m, 0.0);
  float r = texture2D(inputBuffer, q + radial + desvio).r;
  float g = texture2D(inputBuffer, q).g;
  float b = texture2D(inputBuffer, q - radial - desvio).b;
  vec3 color = vec3(r, g, b);
  // líneas de barrido y tinte frío del holograma, sólo en la periferia
  float lineas = 0.82 + 0.18 * sin(q.y * resolution.y * 1.6 + time * 8.0);
  color *= mix(1.0, lineas, m);
  color = mix(color, color * vec3(0.55, 0.95, 1.25), m * 0.55);
  color *= 1.0 - 0.06 * m * step(0.5, hash(vec2(floor(time * 24.0))));
  // grano (como una mezcla overlay suave)
  float n = hash(uv * resolution + fract(time * 13.0) * 97.0) - 0.5;
  color += color * n * 0.12;
  outputColor = vec4(color, inputColor.a);
}`;

class Lente extends Effect {
  constructor() {
    super('Lente', LENTE, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map([
        ['rapidez', new THREE.Uniform(0)],
        ['curva', new THREE.Uniform(0.12)],
        ['aberracion', new THREE.Uniform(0.0024)],
      ]),
    });
  }
}

export function crearEfectos({ camara, composer }) {
  let lente = null;

  function agregarPasadas() {
    if (!composer) return;
    lente = new Lente();
    composer.addPass(new EffectPass(camara, lente));
  }

  let rapidez = 0;
  return {
    agregarPasadas,
    cuadro({ dt, velocidad }) {
      rapidez += (Math.min(1, velocidad / 2.6) - rapidez) * Math.min(1, dt * 6);
      if (!lente) return;
      lente.uniforms.get('rapidez').value = rapidez;
      // la aberración crece al moverse
      lente.uniforms.get('aberracion').value = 0.0024 + rapidez * 0.008;
    },
    destruir() {},
  };
}
