// Shaders WebGL2 de la gelatina, portados de scene.ts del "Jelly Slider" de TypeGPU.
//
// Dos pases, igual que el original:
//  1. FRAGMENT_SDF calcula, para cada texel de una textura, la distancia 2D a la curva de la
//     gelatina (una poligonal de 128 tramos) y a qué altura del recorrido está. Es barato en la GPU
//     y deja la forma lisa: leída con filtrado bilineal ya no se notan las caras.
//  2. FRAGMENT hace el ray-marching: bandeja con una ranura hundida, gelatina como cinta
//     redondeada (refracción IOR 1.42, Fresnel y Beer-Lambert), sombra proyectada teñida y el
//     porcentaje impreso en el piso de la ranura. Sólo lee la textura del pase 1.
export const PUNTOS_CURVA = 129; // 16 tramos físicos × 8 subdivisiones + 1

// Rectángulo del mundo que cubre la textura del campo de distancia, y su tamaño en texeles
// (≈ 5 milésimas de unidad por texel: la cinta mide unos 20 texeles de ancho).
export const DOMINIO_SDF = { x0: -1.3, y0: -0.35, ancho: 2.6, alto: 1.25 };
export const TEXELES_SDF = [512, 246];

export const VERTEX = `#version 300 es
in vec2 a; out vec2 uv;
void main() { uv = a * .5 + .5; gl_Position = vec4(a, 0., 1.); }`;

// Pase 1: campo de distancia de la curva.
//   R = distancia a la curva (acotada), G = avance 0..1 a lo largo de ella,
//   B = cuánto se pasa del extremo de la punta (si lo más cercano es ese extremo), A = ídem del inicio.
export const FRAGMENT_SDF = `#version 300 es
precision highp float;
in vec2 uv; out vec4 salida;
uniform vec2 uPts[${PUNTOS_CURVA}];
uniform vec4 uDominio; // x0, y0, ancho, alto
const int SEG = ${PUNTOS_CURVA - 1};
void main() {
  vec2 q = uDominio.xy + uv * uDominio.zw;
  float d = 1e9, t = 0., bh = 0.; int bi = 0;
  for (int i = 0; i < SEG; i++) {
    vec2 a = uPts[i], b = uPts[i + 1], pa = q - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0., 1.), di = length(pa - ba * h);
    if (di < d) { d = di; t = (float(i) + h) / float(SEG); bi = i; bh = h; }
  }
  float punta = 0., inicio = 0.;
  if (bi == SEG - 1 && bh > .9999) {
    // la punta sigue la dirección del último tramo; si ese tramo se pone vertical tiende a +X
    vec2 E = uPts[SEG], T = normalize(E - uPts[SEG - 1] + vec2(1e-5, 0.));
    T = normalize(mix(vec2(1, 0), T, smoothstep(.15, .5, T.x)));
    punta = max(dot(q - E, T), 1e-4);
  } else if (bi == 0 && bh < .0001) {
    inicio = max(uPts[0].x - q.x, 1e-4);
  }
  salida = vec4(min(d, .6), t, punta, inicio);
}`;

export const FRAGMENT = `#version 300 es
precision highp float;
in vec2 uv; out vec4 color;
uniform vec2 uRes; uniform vec3 uCam, uRight, uUp, uFwd; uniform float uTan;
uniform sampler2D uSdf; uniform vec4 uDominio; uniform vec2 uPunta;
uniform vec4 uBox; uniform vec3 uJelly, uLight, uBg;
uniform sampler2D uTexto;
// R grande respecto del ancho: la cinta tiene el perfil redondeado (no una lámina cuadrada)
const float R = .052, HT = .13, GT = .03, GR = .02, SURF = .0008, MAXD = 12.;

float sdRB(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return min(max(q.x, q.y), 0.) + length(max(q, 0.)) - r; }
float cutout(vec2 p) { return sdRB(p, vec2(1. + GR, .2 + GR), .2 + GR); }
float exY(vec3 p, float d, float h) { vec2 w = vec2(d, abs(p.y) - h); return min(max(w.x, w.y), 0.) + length(max(w, 0.)); }
// superficie continua con una ranura redondeada hundida (sin placa ni bordes)
float ground(vec3 p) { return min(p.y + .06, exY(p, -cutout(p.xz), GT - GR) - GR); }

// campo de distancia del pase 1 (filtrado bilineal); fuera del rectángulo da "lejos"
vec4 campo(vec2 q) { return texture(uSdf, (q - uDominio.xy) / uDominio.zw); }

// gelatina: cinta extruida en Z con las puntas redondeadas
float jelly(vec3 p, out float t) {
  t = 0.;
  vec3 q = clamp(p, vec3(uBox.x, uBox.z, -HT - .08), vec3(uBox.y, uBox.w, HT + .08));
  float fuera = length(p - q);
  if (fuera > .05) return fuera;
  vec4 c = campo(p.xy);
  float d = c.r, dz = abs(p.z) - HT;
  t = c.g;
  // en una punta, lo que se mide es la distancia perpendicular y cuánto se pasa del extremo
  float pasado = max(c.b, c.a);
  if (pasado > 0.) { d = sqrt(max(d * d - pasado * pasado, 0.)); dz = length(vec2(pasado, p.z)) - HT; }
  vec2 w = vec2(d, dz); return min(max(w.x, w.y), 0.) + length(max(w, 0.)) - R;
}
float scene(vec3 p, out int obj, out float t) { float g = ground(p), j = jelly(p, t); if (j < g) { obj = 1; return j; } obj = 2; return g; }

vec3 nGround(vec3 p) {
  const vec2 k = vec2(1, -1); const float e = .0006;
  return normalize(k.xyy * ground(p + k.xyy * e) + k.yyx * ground(p + k.yyx * e) + k.yxy * ground(p + k.yxy * e) + k.xxx * ground(p + k.xxx * e));
}
// e mayor que un texel (≈ .005): con uno menor la normal se vería a escalones
vec3 nJelly(vec3 p) {
  const vec2 k = vec2(1, -1); const float e = .007; float tt;
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
  vec4 c = campo(q); float d = c.r - R, t = c.g;
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
  // Rebote de luz de la gelatina sobre el piso. Decae como una gaussiana y llega a CERO a poca
  // distancia: con una cola larga (1/r²) se sumaba hasta el borde del lienzo y, sobre fondo
  // oscuro, dibujaba un halo azul con forma de rectángulo.
  vec3 dE = p - vec3(uPunta.x, 0., 0.); float r2 = dot(dE, dE);
  col += (uJelly * (.31 * exp(-5.2 * r2)) + uJelly * (.2 * exp(-12. * r2)) * abs(n.z)) * gananciaLuz();
  if (p.y < -.05) {                                             // porcentaje impreso en el piso
    vec2 tuv = vec2((p.x - .68) / .38 + .5, p.z / .33 + .5);
    if (all(greaterThan(tuv, vec2(0))) && all(lessThan(tuv, vec2(1)))) {
      float tinta = texture(uTexto, tuv).a;
      // Sobre fondo claro el número oscurece el piso; sobre fondo oscuro el piso ya es casi negro y
      // oscurecerlo no se vería: ahí se "ilumina" con un celeste suave.
      float lum = dot(uBg, vec3(.299, .587, .114));
      col = lum > .5 ? mix(col, col * .45, tinta) : mix(col, vec3(.55, .72, 1.) * 1.1, tinta * .85);
    }
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
  float r = length(vec2((p.x - .14) / 1.85, (p.z - .05) / .95));
  float a = t > MAXD ? 0. : 1. - smoothstep(.62, 1.18, r);
  // la ventana se apaga con una curva suave (sin borde recto) antes de llegar al borde del lienzo
  a *= smoothstep(1., .7, abs(ndc.x)) * smoothstep(1., .8, abs(ndc.y));
  // donde se desvanece, el color tiende al fondo: el borde nunca queda blanco ni gris
  col = mix(uBg, col, a);
  color = vec4(col, 1.);
}`;
