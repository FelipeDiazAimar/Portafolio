import * as THREE from 'three';

// Material del tubo de la columna. `uv.x` recorre el largo (0 = cola, 1 = punta):
//  - hasta `uLlenado` está encendida (acento por encima del umbral del bloom) con pulsos
//    de energía que suben y una estela que brilla de más justo detrás de la cabeza;
//  - en `uLlenado` hay una cabeza blanca;
//  - el resto, apagada y translúcida.
// Se desvanece con la profundidad (niebla propia: el material no usa la de la escena).
const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying float vProfundidad;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vProfundidad = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uLlenado;
  uniform float uTiempo;
  uniform float uIntensidad;
  uniform float uAlfaApagado;
  uniform vec3 uColor;
  uniform vec3 uApagado;
  uniform vec2 uCola;
  varying vec2 vUv;
  varying float vProfundidad;
  void main() {
    float x = vUv.x;
    float encendido = step(x, uLlenado);
    float pulsos = 0.35 * pow(0.5 + 0.5 * sin(40.0 * x - 6.0 * uTiempo), 8.0);
    float estela = encendido * exp(-(uLlenado - x) / 0.012);
    float cabeza = exp(-pow((x - uLlenado) / 0.004, 2.0));
    vec3 color = mix(uApagado, uColor * (2.2 + pulsos * 3.0 + estela * 3.0), encendido);
    color += vec3(1.0) * cabeza * 4.0;
    float alfa = mix(uAlfaApagado, 1.0, max(encendido, cabeza));
    float niebla = exp(-pow(vProfundidad * 0.03, 2.0));
    // La cola se disuelve antes de llegar al borde de la pantalla: sin corte seco.
    float cola = uCola.y > 0.0 ? smoothstep(uCola.x, uCola.y, x) : 1.0;
    gl_FragColor = vec4(color * uIntensidad, alfa * niebla * cola);
  }
`;

export function crearMaterialColumna({ intensidad = 1, aditivo = false } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: !aditivo,
    blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending,
    toneMapped: false,
    uniforms: {
      uLlenado: { value: 0 },
      uTiempo: { value: 0 },
      uIntensidad: { value: intensidad },
      uAlfaApagado: { value: aditivo ? 0.08 : 0.18 },
      uColor: { value: new THREE.Color('#5b8cff') },
      uApagado: { value: new THREE.Color('#2a3350') },
      // Tramo (en uv.x) donde la cola pasa de invisible a plena; (0,0) = sin desvanecer.
      uCola: { value: new THREE.Vector2(0, 0) },
    },
  });
}
