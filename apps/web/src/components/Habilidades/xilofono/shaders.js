// Shaders del xilófono. Base: xylophoneVert/xylophoneFrag, el fondo y el solver
// de fluido de https://github.com/Sujenphea/xylophone (MIT; el fluido, de Pavel Dobryakov, MIT).
// Cambios propios: cada barra lleva el logo de su habilidad (atlas por instancia), una barra
// puede estar "resaltada", y el color sale de la paleta del sitio (azules) en vez del arcoíris.

/* ------------------------------------------------------------------------ */
/*                                  barras                                  */
/* ------------------------------------------------------------------------ */
export const barraVert = /* glsl */ `
uniform float u_time;
uniform float u_spinSpeed;  // giro propio de la hélice
uniform float u_swingScale; // 0..1 (0 con movimiento reducido)
uniform vec3 u_swingAxis;   // eje local del vaivén al golpear

attribute vec3 aPos;
attribute vec4 aRot;
attribute float aTintOffset;
attribute float aStrikeTime; // u_time del último golpe (-1e9 = nunca)
attribute float aSkill;      // índice de la habilidad en el atlas de logos
attribute float aResalte;    // 0..1: la barra resaltada
attribute float aActiva;     // 0..1: de la categoría filtrada

varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec2 vScreenUv;
varying float vTintOffset;
varying vec3 vLocalPos;
varying vec3 vLocalNormal;
varying float vSkill;
varying float vResalte;
varying float vActiva;
varying vec3 vEjeLargo; // eje local z (largo de la barra) en mundo
varying vec3 vEjeAlto;  // eje local y (alto de la barra) en mundo

// vaivén al golpear: péndulo amortiguado
const float SWING_AMP = 0.58;
const float SWING_FREQ = 16.0;
const float SWING_DECAY = 4.5;

vec3 rotateByQuat(vec3 v, vec4 q) {
  return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
}

vec4 qmul(vec4 a, vec4 b) {
  return vec4(a.w * b.xyz + b.w * a.xyz + cross(a.xyz, b.xyz), a.w * b.w - dot(a.xyz, b.xyz));
}

void main() {
  float a = u_time * u_spinSpeed * 0.5;
  vec4 spin = vec4(0.0, sin(a), 0.0, cos(a));
  vec4 rot = qmul(spin, aRot);

  float dt = u_time - aStrikeTime;
  float env = step(0.0, dt) * exp(-dt * SWING_DECAY);
  float ang = env * SWING_AMP * sin(dt * SWING_FREQ) * u_swingScale;
  float halfAng = ang * 0.5;
  vec4 swing = vec4(normalize(u_swingAxis) * sin(halfAng), cos(halfAng));
  rot = qmul(rot, swing);

  vec3 transformedPos = aPos + rotateByQuat(position, rot);
  vec4 worldPos = modelMatrix * vec4(transformedPos, 1.0);
  vec3 rotatedNormal = rotateByQuat(normal, rot);

  gl_Position = projectionMatrix * viewMatrix * worldPos;

  vWorldPos = worldPos.xyz;
  vNormal = normalize(mat3(modelMatrix) * rotatedNormal);
  vScreenUv = gl_Position.xy / gl_Position.w * 0.5 + 0.5;
  vTintOffset = aTintOffset;
  vLocalPos = position;
  vLocalNormal = normal;
  vSkill = aSkill;
  vResalte = aResalte;
  vActiva = aActiva;
  vEjeLargo = mat3(modelMatrix) * rotateByQuat(vec3(0.0, 0.0, 1.0), rot);
  vEjeAlto = mat3(modelMatrix) * rotateByQuat(vec3(0.0, 1.0, 0.0), rot);
}
`;

export const barraFrag = /* glsl */ `
uniform sampler2D u_tFluid;
uniform sampler2D u_tGradient;
uniform float u_fluidStrength;
uniform float u_tintStrength;
uniform float u_tintGlow;
uniform float u_tintWrap;

uniform sampler2D u_tBackdrop;
uniform float u_transmission;
uniform float u_refractStrength;
uniform float u_fresnelPower;

uniform float u_iridStrength;
uniform float u_iridCycles;
uniform float u_iridShift;
uniform float u_iridPower;
uniform float u_iridBody;
uniform vec3 u_iridA;
uniform vec3 u_iridB;

// propio: logos, resaltado y paleta
uniform sampler2D u_tAtlas;
uniform float u_atlasCeldas;   // celdas por lado del atlas
uniform vec3 u_colorLogo;
uniform vec3 u_colorResalte;
uniform float u_cuerpo;        // brillo del cuerpo del vidrio
uniform float u_especular;
uniform float u_opacidad;     // alfa base del vidrio
uniform vec4 u_logoCaja;       // zMin, zMax, ySemi, (sin uso)
uniform sampler2D u_tNombres;  // atlas con el nombre de cada habilidad
uniform vec2 u_nombresCeldas;  // columnas, filas del atlas de nombres
uniform vec4 u_nombreCaja;     // zMin, zMax, ySemi, (sin uso)

varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec2 vScreenUv;
varying float vTintOffset;
varying vec3 vLocalPos;
varying vec3 vLocalNormal;
varying float vSkill;
varying float vResalte;
varying float vActiva;
varying vec3 vEjeLargo;
varying vec3 vEjeAlto;

const float PI = 3.141592653589793;
const vec3 LIGHT_DIR = vec3(0.4, 1.0, 0.35);
const float AMBIENT_MIX = 0.6;
const float FLUID_GATE_MAX = 0.2;
const float TINT_OPACITY_DROP = 0.6;
const float SHEEN_MIX = 0.35;
const float RIM_LIFT = 0.06;

// Iridiscencia en la gama del sitio (el original recorría todo el arcoíris).
vec3 iridescence(float t) {
  return mix(u_iridA, u_iridB, 0.5 + 0.5 * cos(2.0 * PI * t));
}

vec3 proceduralEnv(vec3 dir) {
  float t = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 ground = vec3(0.12, 0.12, 0.14);
  vec3 horizon = vec3(0.60, 0.62, 0.68);
  vec3 sky = vec3(0.95, 0.97, 1.0);
  return t < 0.5 ? mix(ground, horizon, t * 2.0) : mix(horizon, sky, (t - 0.5) * 2.0);
}

// Coordenadas de lectura sobre la cara: x crece hacia la derecha de la pantalla a lo largo de
// la barra e y hacia arriba. La hélice gira, así que se ve una cara o la otra, desde arriba o
// desde abajo: se mira hacia dónde apuntan en pantalla el largo y el alto de esta barra.
vec2 lectura() {
  vec2 largo = (viewMatrix * vec4(vEjeLargo, 0.0)).xy;
  vec2 alto = (viewMatrix * vec4(vEjeAlto, 0.0)).xy;
  float sx = largo.x < 0.0 ? -1.0 : 1.0;
  vec2 derecha = largo * sx;
  vec2 arriba = vec2(-derecha.y, derecha.x);
  float sy = dot(alto, arriba) < 0.0 ? -1.0 : 1.0;
  return vec2(vLocalPos.z * sx, vLocalPos.y * sy);
}

// Celda de un atlas de canvas (fila 0 arriba) con flipY: la v de la textura crece hacia arriba.
// uv.y = 1 es el borde de arriba de la celda.
vec2 enCelda(vec2 uv, float celda, vec2 celdas) {
  float columna = mod(celda, celdas.x);
  float fila = floor(celda / celdas.x);
  return vec2((columna + uv.x) / celdas.x, 1.0 - (fila + 1.0 - uv.y) / celdas.y);
}

// Logo de la habilidad: en las dos caras anchas de la barra (normal local en ±x), un cuadrado
// al centro. Se lee del atlas en la celda de esta instancia.
float mascaraLogo() {
  // sólo en la cara que mira a la cámara: la de atrás se ve a través del vidrio y duplicaría
  if (!gl_FrontFacing || abs(vLocalNormal.x) < 0.6) return 0.0;
  float lado = u_logoCaja.y - u_logoCaja.x;
  vec2 l = lectura();
  vec2 uv = vec2((l.x - u_logoCaja.x) / lado, (l.y + u_logoCaja.z) / (2.0 * u_logoCaja.z));
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  return texture2D(u_tAtlas, enCelda(uv, floor(vSkill + 0.5), vec2(u_atlasCeldas))).a;
}

// Nombre de la habilidad, a continuación del logo: sólo aparece en la barra resaltada.
float mascaraNombre() {
  if (!gl_FrontFacing || abs(vLocalNormal.x) < 0.6 || vResalte < 0.01) return 0.0;
  vec2 l = lectura();
  vec2 uv = vec2((l.x - u_nombreCaja.x) / (u_nombreCaja.y - u_nombreCaja.x), (l.y + u_nombreCaja.z) / (2.0 * u_nombreCaja.z));
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  return texture2D(u_tNombres, enCelda(uv, floor(vSkill + 0.5), u_nombresCeldas)).a * smoothstep(0.2, 0.9, vResalte);
}

void main() {
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vWorldPos);

  float diffuse = max(dot(N, normalize(LIGHT_DIR)), 0.0);
  vec3 ambLo = vec3(0.45, 0.46, 0.5);
  vec3 ambient = mix(ambLo, vec3(1.0), N.y * 0.5 + 0.5);
  vec3 lighting = ambient * AMBIENT_MIX + diffuse * (1.0 - AMBIENT_MIX);

  float velocity = smoothstep(0.0, FLUID_GATE_MAX, length(texture2D(u_tFluid, vScreenUv).xy));
  // el resaltado revela el tinte igual que pasar el mouse
  float reveal = clamp(max(velocity * u_fluidStrength, vResalte * 0.85), 0.0, 1.0);
  vec3 tint = texture2D(u_tGradient, vec2(fract(vTintOffset * u_tintWrap), 0.5)).rgb;
  tint = mix(tint, u_colorResalte, vResalte);

  vec3 albedo = mix(vec3(u_cuerpo), tint, reveal * u_tintStrength);
  vec3 body = lighting * albedo;

  vec2 buv = vScreenUv + N.xy * u_refractStrength * 1.6;
  vec3 trans = texture2D(u_tBackdrop, buv).rgb;
  trans = mix(trans, tint, reveal);

  vec3 frosted = mix(body, trans, u_transmission * (1.0 - TINT_OPACITY_DROP * reveal));

  float edge = clamp(1.0 - max(dot(N, V), 0.0), 0.0, 1.0);
  float fres = pow(edge, u_fresnelPower);

  vec3 sheen = proceduralEnv(reflect(-V, N));
  vec3 color = mix(frosted, sheen, fres * SHEEN_MIX);
  color += fres * RIM_LIFT;
  // brillo especular nítido: es lo que más se lee como vidrio
  vec3 H = normalize(normalize(LIGHT_DIR) + V);
  color += pow(max(dot(N, H), 0.0), 90.0) * u_especular;
  color += tint * reveal * u_tintGlow;

  float phase = edge * u_iridCycles + N.y * 0.5 + u_iridShift;
  vec3 irid = iridescence(phase);
  color += irid * (pow(edge, u_iridPower) * u_iridStrength + u_iridBody * edge);

  // logo: color de la paleta; resaltado, blanco y más presente. Fuera del filtro, casi no se ve.
  float logo = mascaraLogo() * (1.0 - fres * 0.6) * mix(0.12, 1.0, vActiva);
  vec3 colorLogo = mix(u_colorLogo, vec3(1.0), vResalte * 0.85);
  color = mix(color, colorLogo, logo * (0.82 + 0.18 * vResalte));
  float nombre = mascaraNombre() * (1.0 - fres * 0.5);
  color = mix(color, vec3(1.0), nombre);

  // Transparencia: el cuerpo deja ver lo de atrás (otras barras incluidas); el borde, el brillo,
  // el logo y el resaltado son más opacos. Fuera del filtro, la barra casi desaparece.
  float alfa = u_opacidad + fres * 0.55 + reveal * 0.35;
  alfa = max(alfa, max(logo, nombre));
  alfa *= mix(0.28, 1.0, vActiva);
  gl_FragColor = vec4(color, clamp(alfa, 0.0, 1.0));
}
`;

/* ------------------------------------------------------------------------ */
/*                                   fondo                                  */
/* ------------------------------------------------------------------------ */
export const fondoVert = /* glsl */ `
varying vec2 v_uv;
void main() {
  v_uv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// Degradé diagonal entre los dos colores del tema (el original iba de violeta a blanco), con
// manchas de luz azul que se mueven despacio: el vidrio las refracta y así se nota que es vidrio.
export const fondoFrag = /* glsl */ `
uniform vec3 u_colorA;
uniform vec3 u_colorB;
uniform vec3 u_colorC;
uniform float u_time;
uniform float u_aspecto;
varying vec2 v_uv;

float mancha(vec2 p, vec2 centro, float radio) {
  vec2 d = p - centro;
  d.x *= u_aspecto;
  return exp(-dot(d, d) / (radio * radio));
}

void main() {
  float t = smoothstep(0.0, 1.0, v_uv.y * 0.5 + (1.0 - v_uv.x) * 0.5);
  vec3 color = mix(u_colorA, u_colorB, t);
  float s = u_time * 0.07;
  float luz = mancha(v_uv, vec2(0.68 + 0.12 * sin(s * 1.3), 0.62 + 0.1 * cos(s)), 0.22);
  luz += 0.8 * mancha(v_uv, vec2(0.48 + 0.1 * cos(s * 0.9), 0.3 + 0.12 * sin(s * 1.1)), 0.18);
  luz += 0.6 * mancha(v_uv, vec2(0.86 + 0.06 * sin(s * 0.7), 0.18 + 0.1 * cos(s * 1.4)), 0.15);
  color = mix(color, u_colorC, clamp(luz, 0.0, 1.0) * 0.75);
  gl_FragColor = vec4(color, 1.0);
}
`;

/* ------------------------------------------------------------------------ */
/*                                  fluido                                  */
/* ------------------------------------------------------------------------ */
export const blitVert = /* glsl */ `
attribute vec2 position;
varying vec2 v_uv;
void main() {
  v_uv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

export const blitFrag = /* glsl */ `
uniform sampler2D u_texture;
varying vec2 v_uv;
void main() {
  gl_FragColor = texture2D(u_texture, v_uv);
}
`;

export const fluidoVert = /* glsl */ `
attribute vec2 position;
uniform vec2 u_texelSize;
varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  vL = vUv - vec2(u_texelSize.x, 0.0);
  vR = vUv + vec2(u_texelSize.x, 0.0);
  vT = vUv + vec2(0.0, u_texelSize.y);
  vB = vUv - vec2(0.0, u_texelSize.y);
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

export const fluidoAdveccion = /* glsl */ `
varying vec2 vUv;
uniform sampler2D u_tVelocity;
uniform sampler2D u_tSource;
uniform vec2 u_texelSize;
uniform float u_dt;
uniform float u_dissipation;
vec4 bilerp(sampler2D sam, vec2 uv, vec2 tsize) {
  vec2 st = uv / tsize - 0.5;
  vec2 iuv = floor(st);
  vec2 fuv = fract(st);
  vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
  vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
  vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
  vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);
  return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
}
void main() {
  vec4 result;
  #ifdef MANUAL_FILTERING
    vec2 coord = vUv - u_dt * bilerp(u_tVelocity, vUv, u_texelSize).xy * u_texelSize;
    result = bilerp(u_tSource, coord, u_texelSize);
  #else
    vec2 coord = vUv - u_dt * texture2D(u_tVelocity, vUv).xy * u_texelSize;
    result = texture2D(u_tSource, coord);
  #endif
  gl_FragColor.rgb = result.rgb * pow(u_dissipation, u_dt * 60.0);
  gl_FragColor.a = 1.0;
}
`;

export const fluidoLimpiar = /* glsl */ `
varying vec2 vUv;
uniform sampler2D u_tTexture;
uniform float u_value;
uniform float u_dt;
void main() {
  gl_FragColor.rgb = pow(u_value, u_dt * 60.0) * texture2D(u_tTexture, vUv).rgb;
  gl_FragColor.a = 1.0;
}
`;

export const fluidoRotor = /* glsl */ `
uniform sampler2D u_tVelocity;
varying highp vec2 vL;
varying highp vec2 vR;
varying highp vec2 vT;
varying highp vec2 vB;
void main() {
  float L = texture2D(u_tVelocity, vL).y;
  float R = texture2D(u_tVelocity, vR).y;
  float T = texture2D(u_tVelocity, vT).x;
  float B = texture2D(u_tVelocity, vB).x;
  float vorticity = R - L - T + B;
  gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
}
`;

export const fluidoDivergencia = /* glsl */ `
varying highp vec2 vL;
varying highp vec2 vR;
varying highp vec2 vT;
varying highp vec2 vB;
uniform sampler2D u_tVelocity;
void main() {
  float L = texture2D(u_tVelocity, vL).x;
  float R = texture2D(u_tVelocity, vR).x;
  float T = texture2D(u_tVelocity, vT).y;
  float B = texture2D(u_tVelocity, vB).y;
  float div = 0.5 * (R - L + T - B);
  gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
}
`;

export const fluidoGradiente = /* glsl */ `
uniform sampler2D u_tPressure;
uniform sampler2D u_tVelocity;
varying highp vec2 vUv;
varying highp vec2 vL;
varying highp vec2 vR;
varying highp vec2 vT;
varying highp vec2 vB;
void main() {
  float L = texture2D(u_tPressure, vL).x;
  float R = texture2D(u_tPressure, vR).x;
  float T = texture2D(u_tPressure, vT).x;
  float B = texture2D(u_tPressure, vB).x;
  vec2 velocity = texture2D(u_tVelocity, vUv).xy;
  velocity.xy -= vec2(R - L, T - B);
  gl_FragColor = vec4(velocity, 0.0, 1.0);
}
`;

export const fluidoPresion = /* glsl */ `
uniform sampler2D u_tPressure;
uniform sampler2D u_tDivergence;
varying highp vec2 vUv;
varying highp vec2 vL;
varying highp vec2 vR;
varying highp vec2 vT;
varying highp vec2 vB;
void main() {
  float L = texture2D(u_tPressure, vL).x;
  float R = texture2D(u_tPressure, vR).x;
  float T = texture2D(u_tPressure, vT).x;
  float B = texture2D(u_tPressure, vB).x;
  float divergence = texture2D(u_tDivergence, vUv).x;
  float pressure = (L + R + B + T - divergence) * 0.25;
  gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
}
`;

export const fluidoGota = /* glsl */ `
uniform sampler2D u_tTarget;
uniform float u_aspectRatio;
uniform vec3 u_splatColor;
uniform vec2 u_splatPosition;
uniform vec2 u_prevPoint;
uniform float u_splatRadius;
varying vec2 vUv;
void main() {
  vec2 uv = vUv;
  vec2 a = u_prevPoint;
  vec2 b = u_splatPosition;
  uv.x *= u_aspectRatio;
  a.x *= u_aspectRatio;
  b.x *= u_aspectRatio;
  vec2 ab = b - a;
  float t = clamp(dot(uv - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  vec2 p = uv - (a + t * ab);
  vec3 splat = exp(-dot(p, p) / (u_splatRadius / 50.0)) * u_splatColor;
  vec3 base = texture2D(u_tTarget, vUv).xyz;
  gl_FragColor = vec4(base + splat, 1.0);
}
`;

export const fluidoVorticidad = /* glsl */ `
varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;
uniform sampler2D u_tVelocity;
uniform sampler2D u_tCurl;
uniform float u_curl;
uniform float u_dt;
void main() {
  float L = texture2D(u_tCurl, vL).x;
  float R = texture2D(u_tCurl, vR).x;
  float T = texture2D(u_tCurl, vT).x;
  float B = texture2D(u_tCurl, vB).x;
  float C = texture2D(u_tCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= u_curl * C;
  force.y *= -1.0;
  vec2 vel = texture2D(u_tVelocity, vUv).xy;
  vel += force * u_dt;
  vel = clamp(vel, -1000.0, 1000.0);
  gl_FragColor = vec4(vel, 0.0, 1.0);
}
`;
