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

// Liso: el color de la página, sin nada encima (la escena queda sobre el mismo fondo que el resto).
const liso = /* glsl */ `${comun}
void main() {
  // los colores de la página (#0b0d12 / #f5f6f8) pasados a lineal: la salida se convierte a sRGB
  vec3 srgb = mix(vec3(0.0431, 0.0510, 0.0706), vec3(0.9608, 0.9647, 0.9725), u_claro);
  gl_FragColor = vec4(pow((srgb + 0.055) / 1.055, vec3(2.4)), 1.0);
}
`;


// ---- Fondos de prueba portados de React Bits (reactbits.dev): Grainient, Gradient Blinds y
// Plasma. Van en un solo paso (el original usa dos) y con la paleta del sitio en vez de la suya.

// Grainient: un degradé que fluye deformado por ruido, con relieve de seda y grano.
const grainient = /* glsl */ `${comun}
vec2 hash2g(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.103, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy) * 2.0 - 1.0;
}
float ruidoG(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(hash2g(i), f);
  float b = dot(hash2g(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
  float c = dot(hash2g(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
  float d = dot(hash2g(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));
  return 0.5 + 0.5 * mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
vec2 derivaG(vec2 p, float t) {
  vec2 w1 = vec2(ruidoG(p * 0.85 + vec2(t * 0.11, t * 0.07)), ruidoG(p * 0.85 + vec2(4.1, 1.7) - vec2(t * 0.08, t * 0.12)));
  vec2 w2 = vec2(ruidoG(p * 1.55 + w1 * 1.8 + vec2(1.3, 7.1) + t * 0.05), ruidoG(p * 1.55 + w1 * 1.8 + vec2(6.4, 2.2) - t * 0.06));
  return (w1 - 0.5) * 1.1 + (w2 - 0.5) * 0.55;
}
float coordG(vec2 p, vec2 dir, float extension, float t) {
  vec2 q = p + vec2(-dir.y, dir.x) * t * 0.45;
  vec2 w = p + derivaG(q, t) * 0.8;
  return dot(w, dir) / extension + 0.5;
}
void main() {
  float t = u_time * 0.5;
  vec2 p = (v_uv - 0.5) * vec2(u_aspecto, 1.0);
  vec2 dir = vec2(sin(0.96), cos(0.96)); // 55°
  float extension = u_aspecto * abs(dir.x) + abs(dir.y);
  float crudo = coordG(p, dir, extension, t);
  // seda: relieve a partir de la pendiente del degradé
  vec2 grad = vec2(coordG(p + vec2(0.004, 0.0), dir, extension, t) - crudo, coordG(p + vec2(0.0, 0.004), dir, extension, t) - crudo) / 0.004;
  vec2 pendiente = grad * sin(3.14159265 * clamp(crudo, 0.0, 1.0)) * 0.35 * 4.0;
  vec3 normal = normalize(vec3(-pendiente, 1.0));
  vec3 luz = normalize(vec3(-dir.y, dir.x, 1.2));
  float difusa = dot(normal, luz) - luz.z;
  float s = clamp(crudo, 0.0, 1.0);
  vec3 col = mix(baseTema(), rampa4(s), smoothstep(0.0, 0.85, s));
  col *= 1.0 + (difusa * 0.35 + max(difusa, 0.0) * difusa * 0.6) * 0.35;
  float h = fract(sin(dot(gl_FragCoord.xy + floor(u_time * 24.0) * vec2(17.0, 59.0), vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col += h * 0.08 * (0.45 + 2.2 * luma * (1.0 - luma));
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

// Gradient Blinds: persianas sobre un degradé, que se mecen y se encienden con una luz que
// sigue al mouse.
const persianas = /* glsl */ `${comun}
float hashP(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
void main() {
  vec2 uv0 = v_uv;
  float cantidad = 16.0;
  float fase = uv0.x * cantidad;
  vec3 base = rampa4(uv0.x);
  // la luz: sigue al mouse (o pasea sola si no está)
  vec2 paseo = vec2(0.5 + 0.35 * sin(u_time * 0.31), 0.55 + 0.2 * sin(u_time * 0.23));
  vec2 luzPos = mix(paseo, u_raton, u_ratonFuerza);
  vec2 dl = (uv0 - luzPos) * vec2(u_aspecto, 1.0);
  float d = length(dl);
  float foco = 1.0 - 2.0 * (d / 0.5);
  float cercania = exp(-dot(dl, dl) / 0.25);
  float tabla = floor(fase);
  float s = fase - tabla;
  float aa = clamp(cantidad * 1.25 / 900.0, 0.001, 0.12);
  float bordeMezcla = 1.0 - smoothstep(0.0, aa, min(s, 1.0 - s));
  float rampa = mix(s, 0.5, bordeMezcla);
  float inclina = 0.35 * 0.5 * sin(u_time * 0.9 + tabla * 0.55) * (0.6 + 0.4 * sin(u_time * 0.37 + tabla * 0.21));
  inclina += 0.6 * cercania * 0.7 * u_ratonFuerza;
  float borde = rampa;
  rampa = pow(clamp(rampa, 0.0, 1.0), exp(inclina * 0.9));
  float pliegue = 0.5 * 0.38 * smoothstep(0.62, 1.0, rampa);
  float brillo = 0.4 * exp(-pow((borde - 0.035) / 0.07, 2.0)) * (0.3 + 0.7 * cercania) * (1.0 - bordeMezcla);
  vec3 luzColor = vec3(1.0);
  vec3 lit = foco > 0.0 ? luzColor * foco : vec3(foco);
  vec3 senal = lit + base - vec3(rampa + pliegue);
  vec3 col;
  if (u_claro > 0.5) {
    vec3 revelado = clamp(senal, 0.0, 1.0);
    float cobertura = max(revelado.r, max(revelado.g, revelado.b));
    col = mix(baseTema(), base, 0.72 * smoothstep(0.0, 1.0, cobertura));
    col = mix(col, vec3(1.0), clamp(brillo, 0.0, 1.0) * 0.5);
  } else {
    vec3 bruma = base * 0.16 * smoothstep(0.0, 1.0, foco) * (0.4 + 0.6 * rampa);
    col = senal + bruma + mix(base, luzColor, 0.45) * brillo * 0.7;
    vec3 exceso = max(col - 0.8, 0.0);
    col = min(col, vec3(0.8)) + 0.2 * (1.0 - exp(-exceso / 0.2));
    // en el tema oscuro, sobre negro (no sobre el degradé azul del tema) y sin grano
  }
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

// Plasma: un volumen de humo luminoso que se retuerce (raymarching), en un solo paso.
const plasma = /* glsl */ `${comun}
void main() {
  float t = u_time * 0.7;
  vec2 c = (v_uv - 0.5) * vec2(u_aspecto, 1.0);
  vec3 rd = normalize(vec3(c, 1.0));
  vec3 ro = vec3(0.0, 0.0, -4.0);
  vec2 orbita = (u_raton - 0.5) * vec2(0.6, 0.35) * u_ratonFuerza;
  float cy = cos(orbita.x);
  float sy = sin(orbita.x);
  float cx = cos(orbita.y);
  float sx = sin(orbita.y);
  mat3 giro = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy) * mat3(1.0, 0.0, 0.0, 0.0, cx, sx, 0.0, -sx, cx);
  ro = giro * ro;
  rd = giro * rd;
  float z = 0.0;
  float densidad = 0.0;
  float banda = 0.0;
  for (int i = 0; i < 44; i++) {
    vec3 p = ro + rd * z;
    vec3 s = p;
    float d = p.y - t;
    p.x += 0.4 * (1.0 + p.y) * sin(d + p.x * 0.1) * cos(0.34 * d + p.x * 0.05);
    vec4 ang = cos(p.y + vec4(0.0, 11.0, 33.0, 0.0) - t);
    vec2 q = mat2(ang.x, ang.y, ang.z, ang.w) * p.xz;
    p.xz = q;
    float cascara = abs(sqrt(length(q * q)) - 0.25 * (5.0 + s.y)) / 3.0;
    float paso = cascara + 0.0008;
    z += paso;
    float fase = s.y + p.z * 0.5 + s.z - length(s - p);
    float peso = (1.0 + sin(fase + 8.0)) * exp(-cascara * 55.0) * paso;
    densidad += peso;
    banda += peso * (0.5 + 0.5 * sin(fase * 0.5 + 1.0));
  }
  vec3 color = pow(u_c[1], vec3(2.2));
  vec3 resalte = color + (1.0 - color) * 0.85;
  float dens = densidad * 4.8;
  float b = clamp(banda / max(densidad, 0.00001), 0.0, 1.0);
  vec3 tinte = mix(color, resalte, b * 0.35);
  vec3 hdr = tinte * dens + resalte * dens * dens * 0.025;
  float pico = max(hdr.r, max(hdr.g, hdr.b));
  float nivel = 1.0 - exp(-pico);
  float caliente = smoothstep(1.0, 3.0, pico);
  vec3 col;
  if (u_claro > 0.5) {
    vec3 tinta = vec3(0.06, 0.16, 0.6);
    col = mix(baseTema(), mix(tinta, vec3(1.0), caliente * 0.75), clamp(pow(nivel, 0.8) * 0.9, 0.0, 1.0));
  } else {
    vec3 tono = hdr / max(pico, 0.0001);
    col = mix(tono * nivel, vec3(nivel), caliente * 0.6);
    col = pow(col, vec3(1.0 / 2.2));
    col = max(col, baseTema());
  }
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export const FONDOS_EXTRA = { malla, seda, nebulosa, rayos, electrico, liso, grainient, persianas, plasma };
