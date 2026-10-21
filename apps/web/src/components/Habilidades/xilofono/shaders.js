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
uniform vec3 u_escalaBarra;  // escala de la barra (la usa el picking); (1,1,1) = barra larga
uniform float u_esfera;      // 0 = barra, 1 = esfera (árbol)
uniform float u_radioEsfera;
uniform vec3 u_swingAxis;   // eje local del vaivén al golpear

attribute vec3 aEsfera;      // forma de esfera de este vértice (dirección unitaria)
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
varying vec4 vEjes; // largo (xy) y alto (zw) de la barra, proyectados en pantalla
varying vec3 vCentro;      // centro de la barra en el mundo
varying vec2 vCentroPantalla; // centro de la barra en pantalla (NDC, con el x multiplicado por el aspecto)
varying float vEscalaMundo; // escala del modelo en el mundo (para pasar el mundo a unidades locales)

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

  // la barra se funde en una esfera al pasar al árbol (misma malla, otra forma)
  vec3 forma = mix(position * u_escalaBarra, aEsfera * u_radioEsfera, u_esfera);
  vec3 normalLocal = normalize(mix(normalize(normal / u_escalaBarra), aEsfera, u_esfera));
  vec3 transformedPos = aPos + rotateByQuat(forma, rot);
  vec4 worldPos = modelMatrix * vec4(transformedPos, 1.0);
  vec3 rotatedNormal = rotateByQuat(normalLocal, rot);

  gl_Position = projectionMatrix * viewMatrix * worldPos;

  vWorldPos = worldPos.xyz;
  vNormal = normalize(mat3(modelMatrix) * rotatedNormal);
  vScreenUv = gl_Position.xy / gl_Position.w * 0.5 + 0.5;
  vTintOffset = aTintOffset;
  // el logo se dibuja en coordenadas ya escaladas: así no se deforma al achatarse la barra
  vLocalPos = forma;
  vLocalNormal = normalLocal;
  vSkill = aSkill;
  vResalte = aResalte;
  vActiva = aActiva;
  // Hacia dónde apuntan en pantalla el largo y el alto de esta barra, con la perspectiva real
  // (proyectando su centro y dos puntos corridos). Con esto el logo y el nombre se leen derechos
  // aunque la barra esté cerca de la cámara o en un costado.
  vec3 centro = (modelMatrix * vec4(aPos, 1.0)).xyz;
  vCentro = centro;
  vEscalaMundo = length(modelMatrix[0].xyz);
  vec3 ejeLargo = mat3(modelMatrix) * rotateByQuat(vec3(0.0, 0.0, 1.0), rot);
  vec3 ejeAlto = mat3(modelMatrix) * rotateByQuat(vec3(0.0, 1.0, 0.0), rot);
  mat4 pv = projectionMatrix * viewMatrix;
  vec4 c0 = pv * vec4(centro, 1.0);
  vec4 cl = pv * vec4(centro + ejeLargo * 0.05, 1.0);
  vec4 ca = pv * vec4(centro + ejeAlto * 0.05, 1.0);
  vec2 aspecto = vec2(projectionMatrix[1][1] / projectionMatrix[0][0], 1.0);
  vEjes = vec4((cl.xy / cl.w - c0.xy / c0.w) * aspecto, (ca.xy / ca.w - c0.xy / c0.w) * aspecto);
  vCentroPantalla = (c0.xy / c0.w) * aspecto;
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
uniform sampler2D u_tNitido;  // el fondo sin desenfocar (lo que se ve a través de la lente)
uniform float u_aberracion;   // separación de colores en los bordes
uniform float u_esmerilado;   // 0 = vidrio limpio, 1 = esmerilado
uniform float u_bordeLuz;     // brillo de la línea de borde
uniform float u_filtro;       // 0..1: hay una categoría elegida
uniform float u_claro;        // 1 en tema claro
uniform float u_filo;         // grosor del filo de luz del borde (más alto = más fino)
uniform float u_atras;        // 1 en la pasada que dibuja las caras de atrás
uniform float u_destello;     // 0..1: explosión de color (botón o buscador)
uniform float u_logoEscala;   // 1 en la hélice; mayor en el árbol (la esfera es más chica)
uniform float u_esfera;       // 0 = barra, 1 = esfera (árbol)
uniform float u_nombreOn;     // 1 en la hélice; 0 en el árbol (la moneda no tiene lugar para el nombre)
uniform vec3 u_colorContorno; // contorno de las barras en tema claro
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
varying vec4 vEjes;
varying vec3 vCentro;
varying float vEscalaMundo;
varying vec2 vCentroPantalla;
uniform vec2 u_resolucion;   // tamaño del buffer de dibujo, en píxeles
uniform vec3 u_escalaBarra;

const float PI = 3.141592653589793;
const vec3 LIGHT_DIR = vec3(0.4, 1.0, 0.35);
const float AMBIENT_MIX = 0.6;
const float FLUID_GATE_MAX = 0.2;
const float TINT_OPACITY_DROP = 0.6;
const float SHEEN_MIX = 0.35;

// Iridiscencia en la gama del sitio (el original recorría todo el arcoíris).
vec3 iridescence(float t) {
  return mix(u_iridA, u_iridB, 0.5 + 0.5 * cos(2.0 * PI * t));
}

// Coordenadas de lectura sobre la cara: x crece hacia la derecha de la pantalla a lo largo de
// la barra e y hacia arriba. La hélice gira, así que se ve una cara o la otra, desde arriba o
// desde abajo: se mira hacia dónde apuntan en pantalla el largo y el alto de esta barra.
//
// El logo y el nombre son un decal PLANO: el plano central de la barra (el que contiene su largo y
// su alto) visto desde la cámara. Cada píxel se ubica resolviendo dónde cae en ese plano, sin
// depender de en qué parte de la superficie curva está. Antes se usaba la posición sobre la
// curva y, mirando la barra desde arriba, la mitad de abajo del texto caía en la parte de la
// superficie que da la espalda a la cámara y se descartaba: el texto salía cortado a la mitad.
// Devuelve (a lo largo de la barra, a lo alto) en unidades locales, y z = 1 si el punto es válido.
vec3 lectura() {
  vec2 largo = vEjes.xy / 0.05;
  vec2 alto = vEjes.zw / 0.05;
  float det = largo.x * alto.y - largo.y * alto.x;
  // barra casi de canto: el plano degenera y no hay dónde dibujar
  if (abs(det) < 1e-4) return vec3(0.0, 0.0, 0.0);
  float aspecto = u_resolucion.x / u_resolucion.y;
  vec2 fragmento = (gl_FragCoord.xy / u_resolucion * 2.0 - 1.0) * vec2(aspecto, 1.0);
  vec2 d = fragmento - vCentroPantalla;
  vec2 l = vec2(d.x * alto.y - d.y * alto.x, d.y * largo.x - d.x * largo.y) / det;
  float sx = largo.x < 0.0 ? -1.0 : 1.0;
  vec2 derecha = largo * sx;
  vec2 arriba = vec2(-derecha.y, derecha.x);
  float sy = dot(alto, arriba) < 0.0 ? -1.0 : 1.0;
  return vec3(l.x * sx, l.y * sy, 1.0);
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
// Cuánto de la cara ancha es este punto: la sección es curva, así que en vez de cortar de golpe
// (el logo quedaba mochado) se desvanece hacia arriba y abajo.
float enCara() {
  return smoothstep(0.12, 0.42, abs(vLocalNormal.x));
}

// Apaga la máscara cerca del borde de su celda del atlas: al achicarse la textura, los píxeles de
// la celda vecina se filtran y dibujan líneas finas con forma de rectángulo alrededor del logo.
float bordeCelda(vec2 uv) {
  vec2 d = min(uv, 1.0 - uv);
  return smoothstep(0.0, 0.07, d.x) * smoothstep(0.0, 0.07, d.y);
}

// Máximo del alfa de una textura en un entorno de radio d (en uv): engorda la máscara. Se usa
// para el halo oscuro que va detrás del logo y del nombre cuando están resaltados.
float muestraAncha(sampler2D t, vec2 p, float d) {
  float a = texture2D(t, p).a;
  a = max(a, texture2D(t, p + vec2(d, 0.0)).a);
  a = max(a, texture2D(t, p - vec2(d, 0.0)).a);
  a = max(a, texture2D(t, p + vec2(0.0, d)).a);
  a = max(a, texture2D(t, p - vec2(0.0, d)).a);
  a = max(a, texture2D(t, p + vec2(d, d) * 0.7).a);
  a = max(a, texture2D(t, p - vec2(d, d) * 0.7).a);
  a = max(a, texture2D(t, p + vec2(d, -d) * 0.7).a);
  a = max(a, texture2D(t, p + vec2(-d, d) * 0.7).a);
  return a;
}

// halo > 0: máscara engordada en ese radio (para el halo); 0: el logo tal cual.
float mascaraLogo(float halo) {
  // El decal es el mismo plano en la cara de adelante y en la de atrás (se ve a través del
  // vidrio) y caen en el mismo lugar de la pantalla, así que no hace falta descartar ninguna.
  float k = u_logoEscala;
  float lado = (u_logoCaja.y - u_logoCaja.x) * k;
  vec3 plano = lectura();
  if (plano.z < 0.5) return 0.0;
  vec2 l = plano.xy;
  vec2 uv = vec2((l.x - u_logoCaja.x * k) / lado, (l.y + u_logoCaja.z * k) / (2.0 * u_logoCaja.z * k));
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  vec2 p0 = enCelda(uv, floor(vSkill + 0.5), vec2(u_atlasCeldas));
  float a;
  if (halo > 0.0) {
    // resplandor suave: la textura en un nivel borroso (mip) en vez de copias desplazadas, que al
    // verse chicas quedaban como trazos sueltos alrededor del logo
    a = clamp(texture2D(u_tAtlas, p0, halo).a * 2.2, 0.0, 1.0);
  } else {
    float d = 0.0011 * u_esfera; // en el árbol el logo es chico: se lo engorda apenas
    a = d > 0.0 ? muestraAncha(u_tAtlas, p0, d) * 0.9 : texture2D(u_tAtlas, p0).a;
    a = smoothstep(0.08, 0.5, max(a, texture2D(u_tAtlas, p0).a)); // se afila el borde
  }
  return a * bordeCelda(uv) * smoothstep(0.55, 0.9, u_escalaBarra.x);
}

// Logo sobre la esfera (árbol): un decal que siempre mira a la cámara y se lee derecho, sin
// importar desde dónde se vea la esfera (con el logo pegado a un plano fijo, las esferas del
// borde del disco lo mostraban de costado y casi no se veía).
float mascaraLogoEsfera(vec3 N, vec3 V, float halo) {
  if (u_atras > 0.5 || u_logoEscala < 0.01) return 0.0;
  vec3 dd = (vWorldPos - vCentro) / vEscalaMundo;
  vec3 derecha = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 arriba = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float mitad = u_logoCaja.z * u_logoEscala;
  vec2 uv = (vec2(dot(dd, derecha), dot(dd, arriba)) + mitad) / (2.0 * mitad);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  vec2 p0 = enCelda(uv, floor(vSkill + 0.5), vec2(u_atlasCeldas));
  float a;
  if (halo > 0.0) {
    a = clamp(texture2D(u_tAtlas, p0, halo).a * 2.2, 0.0, 1.0);
  } else {
    // bias negativo: un nivel de detalle más fino; y el umbral baja para que un trazo delgado,
    // que al achicarse queda a medio alfa, llegue igual a blanco pleno
    a = muestraAncha(u_tAtlas, p0, 0.0011) * 0.9;
    a = smoothstep(0.02, 0.26, max(a, texture2D(u_tAtlas, p0, -0.8).a));
  }
  return a * smoothstep(0.08, 0.35, dot(N, V)) * bordeCelda(uv);
}

// Nombre de la habilidad, a continuación del logo: sólo aparece en la barra resaltada.
float mascaraNombre(float halo) {
  if (vResalte < 0.01 || u_nombreOn < 0.01) return 0.0;
  vec3 plano = lectura();
  if (plano.z < 0.5) return 0.0;
  vec2 l = plano.xy;
  vec2 uv = vec2((l.x - u_nombreCaja.x) / (u_nombreCaja.y - u_nombreCaja.x), (l.y + u_nombreCaja.z) / (2.0 * u_nombreCaja.z));
  float enPunta = 1.0; // el decal es plano: la punta redonda no lo estira
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  vec2 p0 = enCelda(uv, floor(vSkill + 0.5), u_nombresCeldas);
  float a = halo > 0.0 ? muestraAncha(u_tNombres, p0, halo) : texture2D(u_tNombres, p0).a;
  // sin halo: se afila el borde, para que el blanco del nombre llegue a blanco
  if (halo <= 0.0) a = smoothstep(0.2, 0.62, a);
  return a * enPunta * smoothstep(0.06, 0.3, vResalte) * u_nombreOn * smoothstep(0.55, 0.9, u_escalaBarra.x) * smoothstep(0.0, 0.03, 1.0 - uv.x) * smoothstep(0.0, 0.006, uv.x) * smoothstep(0.0, 0.04, uv.y) * smoothstep(0.0, 0.04, 1.0 - uv.y);
}

void main() {
  vec3 N = normalize(vNormal);
  // En la pasada de atrás (BackSide) three invierte el orden de los vértices y gl_FrontFacing
  // vale lo contrario de lo esperado: se usa un uniform propio.
  if (u_atras > 0.5) N = -N;
  vec3 V = normalize(cameraPosition - vWorldPos);

  float diffuse = max(dot(N, normalize(LIGHT_DIR)), 0.0);
  vec3 ambLo = vec3(0.45, 0.46, 0.5);
  vec3 ambient = mix(ambLo, vec3(1.0), N.y * 0.5 + 0.5);
  vec3 lighting = ambient * AMBIENT_MIX + diffuse * (1.0 - AMBIENT_MIX);

  float velocity = smoothstep(0.0, FLUID_GATE_MAX, length(texture2D(u_tFluid, vScreenUv).xy));
  // Con una categoría elegida, todas sus barras se tiñen (no sólo la del foco).
  float deCategoria = vActiva * u_filtro;
  // el resaltado revela el tinte igual que pasar el mouse
  float reveal = clamp(max(max(velocity * u_fluidStrength, vResalte * 0.9), max(deCategoria * 0.8, u_destello * 0.95)), 0.0, 1.0);
  vec3 tint = texture2D(u_tGradient, vec2(fract(vTintOffset * u_tintWrap), 0.5)).rgb;
  tint = mix(tint, u_colorResalte, max(vResalte, deCategoria * 0.5));

  float edge = clamp(1.0 - max(dot(N, V), 0.0), 0.0, 1.0);
  float fres = pow(edge, u_fresnelPower);

  // Liquid glass: la barra es una lente convexa. Perfil del mapa de desplazamiento del botón
  // "Tahoe" (sin(d^0.8 · π)): nada en el centro, máximo antes del borde y vuelve a bajar en el
  // filo, así el contorno queda limpio. Separa los colores donde más desvía (aberración
  // cromática) y deja ver el fondo nítido en vez de un cuerpo de color.
  float lente = sin(pow(edge, 0.8) * PI);
  vec2 desvio = N.xy * u_refractStrength * (0.15 + 0.8 * lente);
  vec2 uvFondo = vScreenUv + desvio;
  vec2 separacion = desvio * u_aberracion;
  vec3 nitido = vec3(
    texture2D(u_tNitido, uvFondo - separacion).r,
    texture2D(u_tNitido, uvFondo).g,
    texture2D(u_tNitido, uvFondo + separacion).b
  );
  vec3 trans = mix(nitido, texture2D(u_tBackdrop, uvFondo).rgb, u_esmerilado);

  vec3 body = lighting * vec3(u_cuerpo);
  vec3 vidrio = mix(body, trans, u_transmission);
  // vidrio teñido: el color filtra lo de atrás (multiplica) y suma un poco de luz propia
  vec3 tenido = trans * tint * 1.5 + tint * 0.22;
  vidrio = mix(vidrio, tenido, reveal * u_tintStrength);

  // Reflejo del entorno teñido con el propio fondo (no un cielo gris): sin esto, en las barras
  // vistas de costado aparecía una franja blanca a lo largo.
  vec3 sheen = mix(trans, vec3(1.0), 0.25);
  vec3 color = mix(vidrio, sheen, fres * SHEEN_MIX);
  // borde de luz (como el aro del botón Tahoe): un filo fino, más fuerte del lado de la luz,
  // y una sombra interior suave del otro. Bien angosto, para que no pinte media barra.
  vec3 luzBorde = normalize(vec3(-0.45, 0.85, 0.5));
  float ladoLuz = dot(N, luzBorde);
  float filo = pow(edge, u_filo);
  color += filo * (0.35 + 0.65 * smoothstep(-0.2, 0.8, ladoLuz)) * u_bordeLuz;
  color *= 1.0 - pow(edge, 6.0) * 0.22 * smoothstep(0.2, -0.6, ladoLuz);
  // brillo especular: un punto chico, no una línea a lo largo de la barra
  vec3 H = normalize(normalize(LIGHT_DIR) + V);
  color += pow(max(dot(N, H), 0.0), 220.0) * u_especular;
  color += tint * reveal * u_tintGlow;

  // Tema claro: un vidrio blanco sobre un fondo claro casi no se ve. Se le da un contorno azul
  // oscuro (en vez del filo de luz blanco) y un poco de sombra hacia los bordes.
  if (u_claro > 0.5) {
    color = mix(color, u_colorContorno, pow(edge, 2.0) * 0.6);
    color *= 1.0 - edge * 0.08;
  }

  float phase = edge * u_iridCycles + N.y * 0.5 + u_iridShift;
  vec3 irid = iridescence(phase);
  color += irid * (pow(edge, u_iridPower) * u_iridStrength + u_iridBody * edge) * 0.5;

  // logo: color de la paleta; resaltado, blanco y más presente. Fuera del filtro, casi no se ve.
  // Al resaltar (hover, toque, búsqueda o explosión) el logo y el nombre van en blanco. Sobre el
  // vidrio claro se perdían: se les pone detrás una mancha oscura del color de la barra.
  // El resalte de la barra del foco sube y baja de forma continua (casi nunca llega justo a 1):
  // con esta curva el texto llega a blanco pleno desde los valores medios.
  float realce = clamp(max(smoothstep(0.08, 0.35, vResalte), u_destello), 0.0, 1.0);
  // En tema claro los logos son blancos siempre, y un vidrio claro no los deja ver: todos llevan
  // detrás una mancha azul. Resaltados, la mancha es oscura como en el tema oscuro.
  float conMancha = u_claro * (1.0 - realce);
  if (conMancha > 0.01) {
    float haloLogo = u_esfera > 0.01 ? mix(mascaraLogo(3.0), mascaraLogoEsfera(N, V, 3.0), u_esfera) : mascaraLogo(3.0);
    float pastilla = clamp(haloLogo * 1.6, 0.0, 1.0) * conMancha;
    color = mix(color, vec3(0.08, 0.2, 0.86), pastilla * 0.95);
  }
  float logoBarra = mascaraLogo(0.0);
  float logoMascara = u_esfera > 0.01 ? mix(logoBarra, mascaraLogoEsfera(N, V, 0.0), u_esfera) : logoBarra;
  // la atenuación del borde (fresnel) apaga el logo en los costados de la barra; en lo resaltado
  // se quita, porque la cara ancha se ve de costado y el blanco quedaba mezclado con el azul
  float logo = logoMascara * (1.0 - fres * 0.6 * (1.0 - u_claro) * (1.0 - u_esfera) * (1.0 - realce)) * mix(0.12, 1.0, vActiva);
  // los logos pasan a blanco al resaltarse, en la explosión y, en el árbol oscuro, siempre un poco
  float blanco = max(max(realce, u_destello), u_esfera); // en el árbol, siempre blanco puro
  vec3 colorLogo = mix(u_colorLogo, vec3(1.0), clamp(blanco, 0.0, 1.0));
  color = mix(color, colorLogo, logo * (0.9 + 0.1 * vResalte));
  color += colorLogo * logo * 0.3 * realce; // un poco de brillo propio
  float nombre = mascaraNombre(0.0);
  color = mix(color, vec3(1.0), nombre);
  color += vec3(1.0) * nombre * 0.2;

  // Transparencia: el cuerpo deja ver lo de atrás (otras barras incluidas); el borde, el brillo,
  // el logo y el resaltado son más opacos. Fuera del filtro, la barra casi desaparece.
  float alfa = u_opacidad + fres * (0.55 + 0.3 * u_claro) + reveal * 0.35;
  // La cara de atrás se pinta primero y se ve a través de la de adelante: pesa poco, si no su
  // color oscuro tiñe de gris toda la pieza.
  if (u_atras > 0.5) alfa *= 0.22;
  alfa = max(alfa, max(logo, nombre));
  alfa *= mix(0.28, 1.0, vActiva);
  // el texto y el logo resaltados van opacos: si no, el blanco se mezcla con el fondo y se pierde
  alfa = mix(alfa, 1.0, clamp(max(nombre, logo * realce), 0.0, 1.0));
  // En el árbol el logo se pinta al final y en blanco puro, sin importar cómo quedó el vidrio
  // (reflejos, tinte o transparencia): si no, según el ángulo el blanco se mezclaba con el fondo.
  if (u_esfera > 0.5) {
    float pleno = logoMascara * mix(0.12, 1.0, vActiva);
    color = mix(color, vec3(1.0), pleno);
    alfa = max(alfa, pleno);
  }
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

// Fondo "aurora": cortinas de luz que ondulan, adaptado de <Aurora /> de React Bits
// (reactbits.dev). Va sobre el degradé del tema; en tema claro, como luz pastel.
export const fondoAuroraFrag = /* glsl */ `
uniform vec3 u_colorA;
uniform vec3 u_colorB;
uniform float u_time;
uniform float u_aspecto;
uniform vec3 u_stops[5];
uniform int u_cantidad;
uniform float u_amplitud;
uniform float u_suavidad;
uniform float u_alto;
uniform float u_escala;
uniform float u_resplandor;
uniform float u_brillo;
uniform int u_capas;
uniform float u_invertir;
uniform float u_claro;
varying vec2 v_uv;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float suavizar(float e0, float e1, float x) {
  float t = clamp((x - e0) / (e1 - e0), 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

vec3 oklabALineal(vec3 c) {
  float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  l = l * l * l;
  m = m * m * m;
  s = s * s * s;
  return vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
}

vec3 aSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

vec3 rampa(float t) {
  float x = clamp(t, 0.0, 1.0) * float(u_cantidad - 1);
  int i = int(min(floor(x), float(u_cantidad - 2)));
  float f = x - float(i);
  f = f * f * (3.0 - 2.0 * f);
  vec3 lch = mix(u_stops[i], u_stops[i + 1], f);
  lch.x = mix(lch.x, min(lch.x, 0.7), u_claro);
  return aSrgb(oklabALineal(vec3(lch.x, lch.y * cos(lch.z), lch.y * sin(lch.z))));
}

float ruido(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  float y = 1.0 - v_uv.y;
  y = mix(y, 1.0 - y, u_invertir);
  float u = v_uv.x;
  float X = (v_uv.x - 0.5) * u_aspecto;
  float t = u_time;

  vec3 brillo = vec3(0.0);
  float cubre = 0.0;
  for (int k = 0; k < 3; k++) {
    if (k >= u_capas) break;
    float capa = float(k);
    float semilla = capa * 13.7;
    float paso = t * (1.0 - capa * 0.18);
    float tuerce = snoise(vec2(X * 0.45 * u_escala + paso * 0.02 + semilla, paso * 0.05 + semilla));
    float onda = snoise(vec2(X * 0.75 * u_escala + tuerce * 0.35 - paso * 0.03 + semilla, paso * 0.07 - semilla)) * 0.72
      + snoise(vec2(X * 1.6 * u_escala + tuerce * 0.5 + paso * 0.04 - semilla, paso * 0.1 + semilla * 0.5)) * 0.28;
    float borde = u_alto + capa * 0.07 + onda * 0.15 * u_amplitud;

    float suave = (0.04 + u_suavidad * 0.16) * (1.0 + capa * 0.9);
    float sube = borde - y;
    float bajo = -suave - u_resplandor * 0.14;
    float alto = 0.26 + suave * 0.6;
    float cuerpo = pow(suavizar(bajo, alto, sube), 1.5 + u_resplandor * 0.6);
    float lobulos = 0.86 + 0.14 * snoise(vec2(X * 0.9 * u_escala - paso * 0.025 + semilla, y * 0.3 + paso * 0.04));
    float alfa = clamp(cuerpo * lobulos * (capa < 0.5 ? 1.0 : 0.32 / capa), 0.0, 1.0);

    vec3 tinte = rampa(u + 0.05 * sin(paso * 0.08 + capa * 2.3) + capa * 0.1 + max(sube, 0.0) * 0.05);
    brillo = 1.0 - (1.0 - brillo) * (1.0 - tinte * alfa);
    cubre = 1.0 - (1.0 - cubre) * (1.0 - alfa);
  }

  float fuerza = clamp(u_brillo, 0.0, 2.0);
  brillo *= min(fuerza, 1.0);
  cubre *= min(fuerza, 1.0);
  brillo = 1.0 - pow(1.0 - brillo, vec3(max(fuerza, 1.0)));
  float tramado = (ruido(gl_FragCoord.xy) - 0.5) / 255.0;

  float d = smoothstep(0.0, 1.0, v_uv.y * 0.5 + (1.0 - v_uv.x) * 0.5);
  vec3 base = mix(u_colorA, u_colorB, d);
  vec3 color;
  if (u_claro > 0.5) {
    // tema claro: luz pastel sobre el fondo claro
    vec3 tinte = cubre > 0.0001 ? brillo / cubre : vec3(0.0);
    float alfa = cubre * suavizar(0.0, 0.25, cubre) * 0.7;
    color = mix(base, tinte, alfa);
  } else {
    // tema oscuro: la luz se suma sobre el fondo (el brillo ya viene premultiplicado)
    color = base * (1.0 - cubre) + brillo;
  }
  gl_FragColor = vec4(color + tramado, 1.0);
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
