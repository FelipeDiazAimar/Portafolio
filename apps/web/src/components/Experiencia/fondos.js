// Fondos del pasillo: lo que se ve más allá de lo que todavía no está construido (y a lo lejos, por
// la niebla, que toma su color del horizonte). Una esfera que sigue a la cámara con un shader; cada
// fondo es un modo del mismo shader. `ninguno` deja el color liso del tema.
import * as THREE from 'three';

// el elegido es la aurora; los demás quedan como alternativas
export const FONDOS = [
  { id: 'ninguno', nombre: 'Liso' },
  { id: 'vacio', nombre: 'Vacío blanco', niebla: '#cfd3da' },
  { id: 'noche', nombre: 'Noche', niebla: '#070a14' },
  { id: 'plano', nombre: 'Plano', niebla: '#0c2a52' },
  { id: 'aurora', nombre: 'Aurora', niebla: '#050a12' },
  { id: 'atardecer', nombre: 'Atardecer', niebla: '#3b2340' },
];

const MODOS = { vacio: 1, noche: 2, plano: 3, aurora: 4, atardecer: 5 };

const VERTICE = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const FRAGMENTO = /* glsl */ `
uniform int uModo;
uniform float uTiempo;
varying vec3 vDir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ruido(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
void main() {
  vec3 d = normalize(vDir);
  float y = d.y;
  float lon = atan(d.z, d.x);
  float lat = asin(clamp(y, -1.0, 1.0));
  vec3 c = vec3(0.0);
  if (uModo == 1) {
    // vacío blanco: estudio infinito, apenas más oscuro abajo
    c = mix(vec3(0.70, 0.72, 0.76), vec3(0.93, 0.94, 0.96), smoothstep(-0.5, 0.6, y));
  } else if (uModo == 2) {
    // noche: degradé profundo con estrellas que titilan
    c = mix(vec3(0.02, 0.03, 0.07), vec3(0.01, 0.01, 0.03), smoothstep(-0.1, 0.9, y));
    vec2 g = vec2(lon * 60.0, lat * 60.0);
    float h = hash(floor(g));
    float estrella = step(0.985, h) * smoothstep(0.35, 0.0, length(fract(g) - 0.5));
    c += vec3(0.9, 0.95, 1.0) * estrella * (0.6 + 0.4 * sin(uTiempo * 2.0 + h * 40.0));
  } else if (uModo == 3) {
    // plano: azul de plano técnico con su cuadrícula
    c = mix(vec3(0.03, 0.12, 0.26), vec3(0.05, 0.17, 0.34), smoothstep(-0.6, 0.6, y));
    vec2 g = vec2(lon, lat) * 18.0 / 3.14159;
    vec2 a = abs(fract(g) - 0.5);
    vec2 b = abs(fract(g * 5.0) - 0.5);
    float linea = max(smoothstep(0.47, 0.5, max(a.x, a.y)), smoothstep(0.46, 0.5, max(b.x, b.y)) * 0.35);
    c += vec3(0.45, 0.65, 0.95) * linea * 0.35;
  } else if (uModo == 4) {
    // aurora: cortinas que ondulan sobre un cielo oscuro
    c = vec3(0.01, 0.02, 0.04);
    float banda = ruido(vec2(lon * 3.0 + uTiempo * 0.05, uTiempo * 0.08)) * 0.35;
    float cortina = smoothstep(0.12, 0.0, abs(y - 0.35 - banda)) * (0.5 + 0.5 * ruido(vec2(lon * 14.0, uTiempo * 0.3)));
    c += mix(vec3(0.1, 0.9, 0.55), vec3(0.55, 0.3, 1.0), smoothstep(0.2, 0.8, y)) * cortina * 0.8;
  } else {
    // atardecer
    c = mix(vec3(0.95, 0.5, 0.28), vec3(0.17, 0.1, 0.3), smoothstep(-0.15, 0.55, y));
    c = mix(c, vec3(0.08, 0.05, 0.12), smoothstep(-0.05, -0.6, y));
  }
  gl_FragColor = vec4(c, 1.0);
}`;

export function crearFondo(escena, camara) {
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTICE,
    fragmentShader: FRAGMENTO,
    uniforms: { uModo: { value: 0 }, uTiempo: { value: 0 } },
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  const esfera = new THREE.Mesh(new THREE.SphereGeometry(40, 48, 24), material);
  esfera.renderOrder = -10;
  esfera.frustumCulled = false;
  esfera.visible = false;
  esfera.userData.sinConstruccion = true;
  escena.add(esfera);
  let actual = 'ninguno';
  return {
    get id() {
      return actual;
    },
    // devuelve el color de niebla del fondo (o null si es el liso del tema)
    fijar(id) {
      const fondo = FONDOS.find((f) => f.id === id) ?? FONDOS[0];
      actual = fondo.id;
      esfera.visible = fondo.id !== 'ninguno';
      material.uniforms.uModo.value = MODOS[fondo.id] ?? 0;
      return fondo.niebla ? new THREE.Color(fondo.niebla) : null;
    },
    cuadro(t) {
      if (!esfera.visible) return;
      esfera.position.copy(camara.position);
      material.uniforms.uTiempo.value = t;
    },
  };
}
