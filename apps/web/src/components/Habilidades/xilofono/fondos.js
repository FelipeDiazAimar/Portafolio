// Fondos alternativos de la escena (todos dentro del motor, así el vidrio los refracta).
// Cada uno usa los 4 colores de la paleta elegida (u_c) sobre el degradé del tema
// (u_colorA → u_colorB). En tema claro (u_claro = 1) se dibujan como luz pastel.

const comun = /* glsl */ `
uniform vec3 u_colorA;
uniform vec3 u_colorB;
uniform vec3 u_c[4];
uniform float u_time;
uniform float u_aspecto;
uniform float u_claro;
uniform vec2 u_raton;         // puntero en 0..1 (desde abajo a la izquierda)
uniform float u_ratonFuerza;  // 0..1: el puntero está sobre la sección
varying vec2 v_uv;

float azar(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float ruidoValor(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(azar(i), azar(i + vec2(1.0, 0.0)), u.x), mix(azar(i + vec2(0.0, 1.0)), azar(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * ruidoValor(p);
    p = p * 2.03 + vec2(17.1, 9.2);
    a *= 0.5;
  }
  return v;
}

// degradé entre los 4 colores de la paleta (t en 0..1, da la vuelta)
vec3 rampa4(float t) {
  t = fract(t) * 4.0;
  if (t < 1.0) return mix(u_c[0], u_c[1], t);
  if (t < 2.0) return mix(u_c[1], u_c[2], t - 1.0);
  if (t < 3.0) return mix(u_c[2], u_c[3], t - 2.0);
  return mix(u_c[3], u_c[0], t - 3.0);
}

vec3 baseTema() {
  float d = smoothstep(0.0, 1.0, v_uv.y * 0.5 + (1.0 - v_uv.x) * 0.5);
  return mix(u_colorA, u_colorB, d);
}

// compone la luz sobre el fondo: en oscuro se suma; en claro va casi con su color (si se la
// lava mucho hacia blanco, sobre el fondo claro no se distingue)
vec3 componer(vec3 base, vec3 luz, float cantidad) {
  if (u_claro > 0.5) return mix(base, mix(luz, vec3(1.0), 0.12), clamp(cantidad, 0.0, 1.0) * 0.85);
  return mix(base, luz, clamp(cantidad, 0.0, 1.0));
}

float grano() {
  return (azar(gl_FragCoord.xy + fract(u_time)) - 0.5) / 160.0;
}
`;

// Malla de degradé: cuatro manchas de color que se mueven y se funden (estilo "mesh gradient").
const malla = /* glsl */ `${comun}
void main() {
  vec2 p = vec2(v_uv.x * u_aspecto, v_uv.y);
  float t = u_time * 0.25;
  vec2 tuerce = vec2(fbm(p * 1.4 + t), fbm(p * 1.4 - t + 3.7)) - 0.5;
  p += tuerce * 0.35;
  vec2 c0 = vec2((0.25 + 0.15 * sin(t * 1.1)) * u_aspecto, 0.75 + 0.15 * cos(t * 0.9));
  vec2 c1 = vec2((0.8 + 0.12 * cos(t * 0.8)) * u_aspecto, 0.7 + 0.18 * sin(t * 1.3));
  vec2 c2 = vec2((0.65 + 0.2 * sin(t * 0.7 + 1.0)) * u_aspecto, 0.2 + 0.12 * cos(t * 1.2));
  vec2 c3 = vec2((0.15 + 0.1 * cos(t * 1.4)) * u_aspecto, 0.2 + 0.15 * sin(t));
  float w0 = 1.0 / pow(distance(p, c0) + 0.05, 2.2);
  float w1 = 1.0 / pow(distance(p, c1) + 0.05, 2.2);
  float w2 = 1.0 / pow(distance(p, c2) + 0.05, 2.2);
  float w3 = 1.0 / pow(distance(p, c3) + 0.05, 2.2);
  vec3 col = (u_c[0] * w0 + u_c[1] * w1 + u_c[2] * w2 + u_c[3] * w3) / (w0 + w1 + w2 + w3);
  float intensidad = u_claro > 0.5 ? 0.9 : 0.78;
  gl_FragColor = vec4(componer(baseTema(), col, intensidad) + grano(), 1.0);
}
`;

// Seda líquida: pliegues que ondulan, con brillo en las crestas.
const seda = /* glsl */ `${comun}
void main() {
  vec2 p = vec2(v_uv.x * u_aspecto, v_uv.y) * 2.4;
  float t = u_time * 0.35;
  for (int i = 1; i < 7; i++) {
    float fi = float(i);
    p.x += 0.55 / fi * sin(fi * p.y + t + 0.3 * fi) + 0.4;
    p.y += 0.45 / fi * cos(fi * p.x + t * 0.8 + 0.5 * fi) - 0.3;
  }
  float pliegue = 0.5 + 0.5 * sin(p.x + p.y);
  float cresta = pow(pliegue, 6.0);
  vec3 col = rampa4(0.18 * (p.x - p.y) + t * 0.05);
  col += cresta * 0.55;
  float cantidad = (u_claro > 0.5 ? 0.85 : 0.72) * (0.35 + 0.65 * pliegue);
  gl_FragColor = vec4(componer(baseTema(), col, cantidad) + grano(), 1.0);
}
`;

// Nebulosa: nubes de gas en los colores de la paleta. El mouse la arremolina y la ilumina un poco
// a su alrededor.
const nebulosa = /* glsl */ `${comun}
void main() {
  vec2 p = vec2(v_uv.x * u_aspecto, v_uv.y);
  vec2 m = vec2(u_raton.x * u_aspecto, u_raton.y);
  vec2 dm = p - m;
  float cerca = exp(-dot(dm, dm) * 6.0) * u_ratonFuerza;
  // remolino alrededor del puntero (gira y empuja un poco hacia afuera)
  p += (vec2(-dm.y, dm.x) * 0.55 + dm * 0.25) * cerca;
  float t = u_time * 0.04;
  vec2 q = vec2(fbm(p * 2.0 + t), fbm(p * 2.0 + vec2(5.2, 1.3) - t));
  float n = fbm(p * 2.2 + q * 1.8 + t * 2.0);
  vec3 col = rampa4(n * 1.3 + q.x * 0.6);
  // menos nube que antes: sólo las partes densas, y más suaves
  float densidad = smoothstep(0.46, 0.92, n) * 0.78 + cerca * 0.08;
  // en oscuro la luz se suma sobre un fondo negro y pesa mucho más que el pastel del tema claro:
  // se baja para que quede igual de tranquila
  float cobertura = mix(0.5, 0.9, u_claro);
  vec3 color = componer(baseTema(), col, densidad * cobertura);
  gl_FragColor = vec4(color + (azar(gl_FragCoord.xy) - 0.5) / 255.0, 1.0);
}
`;

// Rayos de luz que bajan desde arriba a la izquierda, como haces entre nubes.
const rayos = /* glsl */ `${comun}
void main() {
  vec2 p = vec2(v_uv.x * u_aspecto, v_uv.y);
  vec2 fuente = vec2(0.35 * u_aspecto, 1.25);
  vec2 d = p - fuente;
  float angulo = atan(d.x, -d.y);
  float distancia = length(d);
  float t = u_time * 0.3;
  float haz = 0.0;
  haz += pow(0.5 + 0.5 * sin(angulo * 9.0 + t * 1.3), 6.0) * 0.6;
  haz += pow(0.5 + 0.5 * sin(angulo * 17.0 - t * 0.9 + 1.7), 10.0) * 0.5;
  haz += pow(0.5 + 0.5 * sin(angulo * 31.0 + t * 0.6 + 4.1), 14.0) * 0.35;
  haz *= 0.65 + 0.35 * fbm(vec2(angulo * 4.0, distancia * 2.0 - t));
  float caida = exp(-distancia * 0.9);
  vec3 col = rampa4(angulo * 0.35 + 0.5 + t * 0.03);
  float resplandor = exp(-distancia * 2.2) * 0.55;
  gl_FragColor = vec4(componer(baseTema(), col, haz * caida + resplandor) + grano(), 1.0);
}
`;

// Ondas eléctricas: hilos de luz que vibran cruzando la sección.
const electrico = /* glsl */ `${comun}
void main() {
  vec2 p = vec2(v_uv.x * u_aspecto, v_uv.y);
  float t = u_time * 0.6;
  vec3 luz = vec3(0.0);
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float y = 0.5 + 0.22 * sin(p.x * (1.2 + fi * 0.35) + t * (0.6 + fi * 0.15) + fi * 1.7)
      + 0.06 * sin(p.x * 7.0 - t * 2.0 + fi) + (fbm(vec2(p.x * 2.0 + fi * 3.0, t * 0.5)) - 0.5) * 0.18;
    float d = abs(p.y - y);
    float hilo = 0.0018 / (d + 0.0018) + 0.05 / (d * 9.0 + 0.05) * 0.18;
    luz += rampa4(fi / 6.0 + p.x * 0.08) * hilo;
  }
  float halo = smoothstep(0.9, 0.0, abs(v_uv.y - 0.5) * 1.6) * 0.18;
  luz += rampa4(0.25) * halo;
  float cantidad = clamp(max(luz.r, max(luz.g, luz.b)), 0.0, 1.0);
  vec3 color = u_claro > 0.5 ? componer(baseTema(), luz / max(cantidad, 0.001), cantidad) : baseTema() + luz;
  gl_FragColor = vec4(color + grano(), 1.0);
}
`;

export const FONDOS_EXTRA = { malla, seda, nebulosa, rayos, electrico };
