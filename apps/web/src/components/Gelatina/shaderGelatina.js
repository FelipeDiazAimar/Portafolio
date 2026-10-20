// Shaders WebGL2 de la gelatina: ray-marching de SDF portado de scene.ts del
// "Jelly Slider" de TypeGPU. Bandeja con una ranura hundida, gelatina como
// cinta redondeada (refracción IOR 1.42, Fresnel y Beer-Lambert), sombra
// proyectada teñida y el porcentaje impreso en el piso de la ranura.
export const PUNTOS_CURVA = 33;

export const VERTEX = `#version 300 es
in vec2 a; out vec2 uv;
void main() { uv = a * .5 + .5; gl_Position = vec4(a, 0., 1.); }`;

export const FRAGMENT = `#version 300 es
precision highp float;
in vec2 uv; out vec4 color;
uniform vec2 uRes; uniform vec3 uCam, uRight, uUp, uFwd; uniform float uTan;
uniform vec2 uPts[${PUNTOS_CURVA}]; uniform vec4 uBox; uniform vec3 uJelly, uLight, uBg;
uniform sampler2D uTexto;
// R grande respecto del ancho: la cinta tiene el perfil redondeado (no una lámina cuadrada)
const float R = .052, HT = .13, GT = .03, GR = .02, SURF = .0008, MAXD = 12.;
const int SEG = ${PUNTOS_CURVA - 1};

float sdRB(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return min(max(q.x, q.y), 0.) + length(max(q, 0.)) - r; }
float cutout(vec2 p) { return sdRB(p, vec2(1. + GR, .2 + GR), .2 + GR); }
float exY(vec3 p, float d, float h) { vec2 w = vec2(d, abs(p.y) - h); return min(max(w.x, w.y), 0.) + length(max(w, 0.)); }
// superficie continua con una ranura redondeada hundida (sin placa ni bordes)
float ground(vec3 p) { return min(p.y + .06, exY(p, -cutout(p.xz), GT - GR) - GR); }

float curva(vec2 q, out float t, out int bi, out float bh) {
  float d = 1e9; t = 0.; bi = 0; bh = 0.;
  for (int i = 0; i < SEG; i++) {
    vec2 a = uPts[i], b = uPts[i + 1], pa = q - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0., 1.), di = length(pa - ba * h);
    if (di < d) { d = di; t = (float(i) + h) / float(SEG); bi = i; bh = h; }
  }
  return d;
}
// la punta redondeada (vista desde arriba) sólo aplica si lo más cercano es el extremo,
// y siempre mira hacia ±X: el último tramo puede apuntar hacia arriba
float jelly(vec3 p, out float t) {
  t = 0.;
  vec3 q = clamp(p, vec3(uBox.x, uBox.z, -HT - .08), vec3(uBox.y, uBox.w, HT + .08));
  float fuera = length(p - q);
  if (fuera > .05) return fuera;
  int bi; float bh, d = curva(p.xy, t, bi, bh), dz = abs(p.z) - HT;
  if (bi == SEG - 1 && bh > .9999) {
    // la punta sigue la dirección del último tramo (la punta sube un poquito): si fuera
    // horizontal quedaría una costura; si el tramo se pone vertical, tiende a +X
    vec2 E = uPts[SEG], T = normalize(uPts[SEG] - uPts[SEG - 1] + vec2(1e-5, 0.));
    T = normalize(mix(vec2(1, 0), T, smoothstep(.15, .5, T.x)));
    d = abs(dot(p.xy - E, vec2(-T.y, T.x))); dz = length(vec2(max(dot(p.xy - E, T), 0.), p.z)) - HT;
  } else if (bi == 0 && bh < .0001) {
    vec2 S = uPts[0]; d = abs(p.y - S.y); dz = length(vec2(max(S.x - p.x, 0.), p.z)) - HT;
  }
  vec2 w = vec2(d, dz); return min(max(w.x, w.y), 0.) + length(max(w, 0.)) - R;
}
float scene(vec3 p, out int obj, out float t) { float g = ground(p), j = jelly(p, t); if (j < g) { obj = 1; return j; } obj = 2; return g; }

vec3 nGround(vec3 p) {
  const vec2 k = vec2(1, -1); const float e = .0006;
  return normalize(k.xyy * ground(p + k.xyy * e) + k.yyx * ground(p + k.yyx * e) + k.yxy * ground(p + k.yxy * e) + k.xxx * ground(p + k.xxx * e));
}
vec3 nJelly(vec3 p) {
  const vec2 k = vec2(1, -1); const float e = .0012; float tt;
  return normalize(k.xyy * jelly(p + k.xyy * e, tt) + k.yyx * jelly(p + k.yyx * e, tt) + k.yxy * jelly(p + k.yxy * e, tt) + k.xxx * jelly(p + k.xxx * e, tt));
}
// la AO no usa la cota rápida de la caja: justo afuera daría ~0 y dibujaría un rectángulo
float distAO(vec3 p) {
  float tt; vec3 q = clamp(p, vec3(uBox.x, uBox.z, -HT - .08), vec3(uBox.y, uBox.w, HT + .08));
  return min(ground(p), length(p - q) > 0. ? 1e3 : jelly(p, tt));
}
float ao(vec3 p, vec3 n, bool conGel) {
  float occ = 0., w = 1.;
  for (int i = 1; i <= 3; i++) {
    float h = .1 / 3. * float(i);
    occ += max(0., h - ((conGel ? distAO(p + n * h) : ground(p + n * h)) - .004)) * w; w *= .5;
  }
  return clamp(1. - .5 * occ / .1, 0., 1.);
}
// sombra del original: el punto del piso se proyecta hacia la luz sobre el plano de la
// gelatina y se mide la distancia 2D a la curva → suave, continua y teñida
vec3 sombraGel(vec3 p) {
  vec3 L = -uLight;
  if (L.z >= -.01 || p.z < -.05) return vec3(1);
  float s = -p.z / L.z; vec2 q = p.xy + L.xy * s;
  float t; int bi; float bh, d = curva(q, t, bi, bh) - R;
  float ancho = mix(.012, .16, clamp(s / 1.6, 0., 1.));
  float k = smoothstep(-ancho * .3, ancho, d);
  float sat = clamp(t * 1.4, 0., 1.);
  vec3 tono = mix(vec3(.62), uJelly * vec3(1., .85, .75), sat);
  float fuerza = (1. - smoothstep(.6, 2.2, s)) * mix(.45, .85, sat);
  return mix(vec3(1), mix(tono, vec3(1), k), fuerza);
}
// Exposición: lleva el plano iluminado exactamente al color de fondo de la web (con el tanh
// final), en claro y en oscuro, y por eso la superficie no deja ningún borde.
float planoLuz() { return max(normalize(-uLight).y, 0.) * .95 + .36; }
vec3 exposicion() { return atanh(clamp(uBg, .02, .995)) / planoLuz(); }
// Ganancia de lo que NO es superficie (rebote de luz, brillos, luz interna de la gelatina). Con
// fondo claro es la misma de la superficie; con fondo oscuro la superficie queda casi negra
// pero la luz de la gelatina no se apaga con ella.
float gananciaLuz() { vec3 e = exposicion(); return max(max(e.r, max(e.g, e.b)), 1.5); }
vec3 shadeGround(vec3 p, vec3 rd, bool directo) {
  vec3 n = nGround(p), L = -uLight;
  float dif = max(dot(n, L), 0.);
  float spec = pow(max(dot(-rd, reflect(-L, n)), 0.), 10.) * .12;
  vec3 sh = vec3(1);
  if (p.y < -GT) sh *= clamp(-p.z * 4. * L.z + 1., 0., 1.) * .5 + .18;
  else if (directo) sh = sombraGel(p);
  vec3 col = (dif * sh * .95 + .36) + spec * sh;
  if (p.y < -GT) col *= .3;                                     // interior de la ranura: gris oscuro
  col *= ao(p, n, directo);
  // la superficie nunca brilla más que el plano: el canto de la ranura queda del color del
  // fondo de la web en vez de quemarse a blanco (el rebote de luz se suma después, sin escalar)
  col = min(col, vec3(planoLuz())) * exposicion();
  vec2 E = uPts[SEG]; vec3 dE = p - vec3(E.x, 0., 0.); float r2 = dot(dE, dE);
  col += (uJelly * (.4 / (r2 * 15. + 1.)) + uJelly * (.3 / (r2 * 40. + 1.)) * abs(n.z)) * gananciaLuz();   // rebote de luz
  if (p.y < -.05) {                                             // porcentaje impreso en el piso
    vec2 tuv = vec2((p.x - .68) / .38 + .5, p.z / .33 + .5);
    if (all(greaterThan(tuv, vec2(0))) && all(lessThan(tuv, vec2(1)))) col = mix(col, col * .45, texture(uTexto, tuv).a);
  }
  return col;
}
vec3 marchGround(vec3 ro, vec3 rd) {
  float t = 0.;
  for (int i = 0; i < 48; i++) { float h = ground(ro + rd * t); t += h; if (h < SURF * 6. || t > MAXD) break; }
  return t > MAXD ? vec3(.7) : shadeGround(ro + rd * t, rd, false);
}
// lo que refleja la gelatina: arriba, el mismo tono que el plano (sale del color del fondo de
// la web tras la exposición); si fuera blanco puro, el borde se quemaría
vec3 entorno(vec3 d) {
  float plano = planoLuz();
  return mix(vec3(plano * .6), vec3(plano), smoothstep(-.3, .8, d.y)) * exposicion();
}

void main() {
  vec2 ndc = uv * 2. - 1.;
  vec3 rd = normalize(uFwd + ndc.x * uTan * (uRes.x / uRes.y) * uRight + ndc.y * uTan * uUp), ro = uCam;
  float t = 0., tj = 0.; int obj = 0; vec3 p = ro;
  for (int i = 0; i < 110; i++) { p = ro + rd * t; float d = scene(p, obj, tj); if (d < SURF) break; t += d; if (t > MAXD) break; }
  vec3 col;
  if (t > MAXD) col = vec3(.7);
  else if (obj == 2) col = shadeGround(p, rd, true);
  else {
    vec3 n = nJelly(p), L = -uLight;
    float cosi = clamp(dot(-rd, n), 0., 1.), r0 = pow((1. - 1.42) / (1. + 1.42), 2.);
    float F = r0 + (1. - r0) * pow(1. - cosi, 5.);
    vec3 rf = reflect(rd, n);
    vec3 refl = entorno(rf) + (pow(max(dot(rf, L), 0.), 60.) * 1.4 + pow(max(dot(rf, normalize(vec3(-.5, .9, .3))), 0.), 30.) * .5) * gananciaLuz();
    float eta = 1. / 1.42, k = 1. - eta * eta * (1. - cosi * cosi);
    vec3 refr = refl;
    if (k > 0.) {
      vec3 rdir = normalize(rd * eta + n * (eta * cosi - sqrt(k)));
      vec3 env = marchGround(p + rdir * .003, rdir);
      vec3 T = exp(-(1. - uJelly) * 20. * tj * tj * .08);      // casi transparente junto al ancla, intensa en la punta
      refr = env * T + (uJelly * 4.5 * max(0., dot(L, rdir)) * tj * tj * tj + uJelly * vec3(1., .8, .6) * .32 * tj * tj) * gananciaLuz();
    }
    col = mix(refr, refl, F);
  }
  col = tanh(col);
  float r = length(vec2(p.x / 1.75, (p.z - .05) / .95));
  float a = t > MAXD ? 0. : 1. - smoothstep(.72, 1.18, r);
  a *= smoothstep(1., .82, abs(ndc.x)) * smoothstep(1., .8, abs(ndc.y));
  // donde se desvanece, el color tiende al fondo: el borde nunca queda blanco ni gris
  col = mix(uBg, col, a);
  color = vec4(col, 1.);
}`;
