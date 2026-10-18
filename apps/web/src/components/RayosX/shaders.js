// Shaders del efecto de rayos X (portados a GLSL desde el TSL del original, MIT).

/* --------------------------- material de rayos X --------------------------- */
export const rayosVert = /* glsl */ `
varying vec3 vNormal;
varying vec3 vVista;
varying float vAltura;
varying float vProfundidad;
void main() {
  vec4 p = vec4(position, 1.0);
  vec3 n = normal;
  #ifdef USE_INSTANCING
    p = instanceMatrix * p;
    n = mat3(instanceMatrix) * n;
  #endif
  vec4 mv = modelViewMatrix * p;
  vNormal = normalize(normalMatrix * n);
  vVista = normalize(-mv.xyz);
  vAltura = position.y;
  vProfundidad = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

// Como el original (fresnelMaterial.js): su "fresnel" es pow(1 - dot(normal, -vista), 1) = 1 + cos,
// o sea brillante DE FRENTE (hasta 2) y más tenue en la silueta; el color se extrapola más allá del
// celeste y, con la luz y el tone mapping, queda blanco azulado. Se apaga hacia abajo y con la
// niebla (a negro). Sale en HDR: el tone mapping va en la composición.
export const rayosFrag = /* glsl */ `
uniform vec3 u_nucleo;
uniform vec3 u_borde;
uniform float u_emisivo;
uniform float u_alturaBase;
uniform float u_alturaMax;
uniform vec2 u_niebla;
varying vec3 vNormal;
varying vec3 vVista;
varying float vAltura;
varying float vProfundidad;
void main() {
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(vVista);
  float fresnel = clamp(1.0 + dot(N, V), 0.0, 2.0);
  vec3 base = mix(u_nucleo, u_borde, fresnel) * smoothstep(u_alturaBase, u_alturaMax, vAltura);
  // luz puntual (1, 2, 1) con intensidad 0,75 y entorno tenue (0,1), como la escena original
  vec3 L = normalize((viewMatrix * vec4(1.0, 2.0, 1.0, 0.0)).xyz);
  float luz = 0.1 + 0.75 * max(dot(N, L), 0.0);
  vec3 color = base * luz + base * u_emisivo;
  color *= 1.0 - smoothstep(u_niebla.x, u_niebla.y, vProfundidad);
  gl_FragColor = vec4(color, 1.0);
}
`;

/* ------------------------------- pantalla ------------------------------- */
export const cuadroVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const ruido = /* glsl */ `
float azar(vec2 n) {
  return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}
float ruidoValor(vec2 p) {
  vec2 ip = floor(p);
  vec2 u = fract(p);
  u = u * u * (3.0 - 2.0 * u);
  float r = mix(mix(azar(ip), azar(ip + vec2(1.0, 0.0)), u.x), mix(azar(ip + vec2(0.0, 1.0)), azar(ip + vec2(1.0, 1.0)), u.x), u.y);
  return r * r;
}
float fbm(vec2 x) {
  float v = 0.0;
  float a = 0.5;
  mat2 giro = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (int i = 0; i < 4; i++) {
    v += a * ruidoValor(x);
    x = giro * x * 2.0 + vec2(100.0);
    a *= 0.5;
  }
  return v;
}
`;

// Máscara fluida: blanco = sin revelar, negro = revelado. Cada cuadro toma el valor más oscuro de
// los vecinos corridos por ruido (la tinta se esparce), le suma el trazo del mouse y vuelve hacia
// blanco a razón de u_retorno (0: lo revelado queda).
export const mascaraFrag = /* glsl */ `
uniform sampler2D u_previo;
uniform sampler2D u_trazo;
uniform vec2 u_aspecto;
uniform float u_dispersion;
uniform float u_retorno;
varying vec2 vUv;
${ruido}
void main() {
  vec2 d = fbm(vUv * 20.0) * u_aspecto * u_dispersion;
  vec3 c = texture2D(u_previo, vUv).rgb;
  c = min(c, texture2D(u_previo, vUv + vec2(d.x, 0.0)).rgb);
  c = min(c, texture2D(u_previo, vUv - vec2(d.x, 0.0)).rgb);
  c = min(c, texture2D(u_previo, vUv + vec2(0.0, d.y)).rgb);
  c = min(c, texture2D(u_previo, vUv - vec2(0.0, d.y)).rgb);
  c = min(c, texture2D(u_trazo, vUv).rgb);
  gl_FragColor = vec4(min(vec3(1.0), c + u_retorno), 1.0);
}
`;

// Composición final. Fondo: mezcla la escena de los cuerpos (con bloom) con la de los esqueletos
// según la máscara. Retrato: sólo el esqueleto, con alfa = revelado (deja ver la foto donde no se
// pintó; el borde se mueve con ruido). Los dos: scanlines, grano, desaturación y tinte; en tema
// claro, en negativo.
export const composicionFrag = /* glsl */ `
uniform sampler2D u_cuerpo;
uniform sampler2D u_brillo;
uniform sampler2D u_esqueleto;
uniform sampler2D u_mascara;
uniform float u_retrato;
uniform float u_revelarTodo;  // fondo: 1 = se ven todos los esqueletos (la entrada); baja a 0
uniform float u_tiempo;
uniform float u_claro;
uniform vec2 u_resolucion;
uniform vec3 u_tinte;
uniform vec3 u_fondoClaro;
uniform vec3 u_huesoClaro;
uniform float u_fuerzaBrillo;
uniform float u_nitidezCuerpo;
uniform vec3 u_fondoPagina;    // retrato: el color de fondo de la página (sRGB)
varying vec2 vUv;
${ruido}
// tone mapping ACES (el del renderer del original) y salida en sRGB
vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
vec3 aSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  float m = texture2D(u_mascara, vUv).r;
  float revelado = 1.0 - m;
  vec3 esqueleto = texture2D(u_esqueleto, vUv).rgb;
  vec3 color;
  float alfa = 1.0;
  float scan = 1.0 - clamp(sin(vUv.y * u_resolucion.y * 0.69), -1.0, 0.0) * -0.15;
  if (u_retrato > 0.5) {
    // Retrato: el fondo del revelado es el MISMO color que el de la página y los huesos se suman
    // encima. Así, fuera de la silueta el revelado no se distingue del fondo y adentro tapa la foto,
    // sin dibujar el contorno de la foto. El borde se mueve con ruido.
    float borde = 0.32 + 0.3 * fbm(vUv * 7.0 + u_tiempo * 0.15);
    // dos pasos: primero aparece el CUERPO (la silueta de persona, con su resplandor) en el borde
    // ancho de la mancha, y en el centro, donde el revelado es más fuerte, se ve el esqueleto
    float aCuerpo = smoothstep(borde * 0.35, borde * 0.35 + 0.26, revelado);
    float aHueso = smoothstep(borde + 0.06, borde + 0.42, revelado);
    vec3 luz = texture2D(u_cuerpo, vUv).rgb * u_nitidezCuerpo + texture2D(u_brillo, vUv).rgb * u_fuerzaBrillo;
    vec3 cuerpoC = aSrgb(aces(luz * scan));
    vec3 huesos = aSrgb(aces(esqueleto * scan));
    vec3 imagen = mix(cuerpoC, huesos, aHueso);
    // en claro, negativo con curva: los huesos quedan azul oscuro pero conservan el volumen
    float lumH = dot(imagen, vec3(0.299, 0.587, 0.114));
    vec3 c = u_claro > 0.5
      ? mix(u_fondoPagina, u_huesoClaro, clamp(pow(lumH, 2.2) * 1.05, 0.0, 0.92))
      : u_fondoPagina + imagen;
    gl_FragColor = vec4(c * aCuerpo, aCuerpo);
    return;
  } else {
    // cuerpos: un poco de la imagen nítida más su bloom (manchas de luz), con scanlines
    vec3 cuerpo = texture2D(u_cuerpo, vUv).rgb * u_nitidezCuerpo + texture2D(u_brillo, vUv).rgb * u_fuerzaBrillo;
    color = mix(cuerpo * scan, esqueleto, max(revelado, u_revelarTodo));
  }
  float grano = (azar(vUv * u_resolucion + fract(u_tiempo * 20.0)) - 0.5) * 0.03;
  color -= grano;
  float l = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(l), color, 0.985);
  // los negros suben hacia azul marino (el "bajo contraste" del original), después tone mapping
  color = mix(u_tinte, color, 0.9);
  color = aSrgb(aces(color));
  if (u_claro > 0.5) {
    // negativo: fondo claro, huesos azul oscuro
    float k = clamp(dot(color, vec3(0.299, 0.587, 0.114)) * 1.3, 0.0, 1.0);
    color = mix(u_fondoClaro, u_huesoClaro, k);
  }
  // retrato: alfa premultiplicado (el canvas es transparente)
  gl_FragColor = vec4(color * alfa, alfa);
}
`;
