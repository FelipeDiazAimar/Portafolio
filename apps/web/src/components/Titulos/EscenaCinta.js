import * as THREE from "three";
import { texturaTarjeta, cargarImagen, modulo } from "./EscenaCarrusel.js";
import { densidadPixeles } from '@/lib/rendimiento.js';

// Cinta ondulada de "Títulos" para PC: port a three.js del "Flex Ribbon 3D WebGL Carousel" de
// Apexphase (https://apexphase.io/, licencia MIT), preset 'liquid' e intro 'rise'.
//
// Las tarjetas se dibujan planas en una fila (alto = 36 % del escenario, apaisadas 4:3, 12 px de
// separación) en un render target con mipmaps. Después, una pasada a pantalla completa las mira
// a través de una "lente" superelíptica girada en el centro: dentro de la lente no hay corrimiento
// y hacia afuera la imagen sube de un lado y baja del otro (con un remolino a lo largo del borde),
// con los canales separados en 12 muestras donde la curva es más fuerte. Los shaders son los del
// original; acá se adaptan a three.js, al fondo de la sección y al avance por scroll.

const AJUSTE = {
  alto: 0.36, // cardHeight
  aspecto: 4 / 3, // fit: 'landscape'
  separacion: 12, // gap (px)
  radio: 0, // radius
  comprimir: 0.2, // squeeze
  // preset 'liquid'
  lenteAncho: 0.74,
  lenteAlto: 1.18,
  giro: 62,
  redondez: 1,
  curva: 0.34,
  alcance: 0.38,
  dispersion: 0.45,
};
const MUESTRAS = 12; // TAPS
const PRESUPUESTO_PIXELES = 4.5e6;
const DURACION_INTRO = 2.1;

const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
const easeOutQuint = (v) => 1 - Math.pow(1 - clamp01(v), 5);
const easeInOut = (v) => {
  const t = clamp01(v);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
const envolver = (v, n) => ((((v + n / 2) % n) + n) % n) - n / 2;

const verticeTarjeta = /* glsl */ `
in vec3 position;
in vec2 uv;
uniform vec4 uRect;
uniform vec2 uResolution;
out vec2 vUv;
out vec2 vLocal;
void main() {
  vUv = uv;
  vLocal = vec2(position.x, -position.y) * uRect.zw;
  vec2 px = uRect.xy + vLocal;
  gl_Position = vec4(px.x / uResolution.x * 2.0 - 1.0, 1.0 - px.y / uResolution.y * 2.0, 0.0, 1.0);
}
`;

// como el original; uZoom reemplaza el 1.08 fijo (las tarjetas de texto van enteras)
const fragmentoTarjeta = /* glsl */ `
precision highp float;
uniform sampler2D tMap;
uniform vec2 uSize;
uniform vec2 uImage;
uniform float uRadius;
uniform float uAlpha;
uniform float uShift;
uniform float uDpr;
uniform float uZoom;
in vec2 vUv;
in vec2 vLocal;
out vec4 fragColor;

float roundedBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  float sd = roundedBox(vLocal, uSize * 0.5, min(uRadius, min(uSize.x, uSize.y) * 0.5));
  float mask = clamp(0.5 - sd * uDpr, 0.0, 1.0);
  vec2 local = vLocal / uSize + 0.5;
  float cardAspect = uSize.x / uSize.y;
  float imageAspect = uImage.x / max(uImage.y, 1.0);
  vec2 scale = imageAspect > cardAspect ? vec2(cardAspect / imageAspect, 1.0) : vec2(1.0, imageAspect / cardAspect);
  scale /= uZoom;
  vec2 uv = vec2(local.x, 1.0 - local.y);
  uv = (uv - 0.5) * scale + 0.5;
  uv.x += uShift * (1.0 - scale.x) * 0.5;
  vec3 color = texture(tMap, uv).rgb;
  float alpha = mask * uAlpha;
  fragColor = vec4(color * alpha, alpha);
}
`;

const verticeLente = /* glsl */ `
in vec3 position;
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// el del original, más el compuesto sobre el fondo de la sección
const fragmentoLente = /* glsl */ `
precision highp float;
uniform sampler2D tScene;
uniform vec2 uResolution;
uniform float uDpr;
uniform vec2 uCenter;
uniform vec2 uHalf;
uniform float uAngle;
uniform float uExponent;
uniform float uInner;
uniform float uOuter;
uniform float uFlow;
uniform float uCurl;
uniform float uDispersion;
uniform float uStrength;
uniform float uSceneAlpha;
uniform vec3 uFondo;
out vec4 fragColor;

void main() {
  vec2 frag = gl_FragCoord.xy / uDpr;
  vec2 uv = frag / uResolution;
  vec2 rel = frag - vec2(uCenter.x, uResolution.y - uCenter.y);
  float ca = cos(uAngle);
  float sa = sin(uAngle);
  vec2 local = vec2(ca * rel.x + sa * rel.y, -sa * rel.x + ca * rel.y);
  vec2 k = max(abs(local) / uHalf, vec2(1e-5));
  float nd = pow(pow(k.x, uExponent) + pow(k.y, uExponent), 1.0 / uExponent);
  vec2 grad = pow(k, vec2(uExponent - 1.0)) * sign(local) / uHalf * pow(nd, 1.0 - uExponent);
  float glen = max(length(grad), 1e-6);
  float edge = (nd - 1.0) / glen;
  vec2 outward = grad / glen;
  vec2 normal = vec2(ca * outward.x - sa * outward.y, sa * outward.x + ca * outward.y);
  vec2 along = vec2(-normal.y, normal.x);

  float t = clamp((edge + uInner) / (uInner + uOuter), 0.0, 1.0);
  float ramp = t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
  float slope = 16.0 * t * t * (1.0 - t) * (1.0 - t);
  float reachX = rel.x / (uResolution.x * 0.5);
  float side = smoothstep(0.02, 0.3, abs(reachX)) * (uCurl == 0.0 ? sign(reachX) : uCurl);
  float lift = ramp * side * uFlow * uStrength;
  vec2 swirl = along * along.y * side * slope * uFlow * uStrength * 0.35;
  vec2 drift = vec2(0.0, -lift) - swirl;
  vec2 shifted = uv + drift / uResolution;

  vec2 texels = uResolution * uDpr;
  vec2 gx = dFdx(shifted);
  vec2 gy = dFdy(shifted);
  gx *= min(1.0, 3.0 / max(length(gx * texels), 1e-4));
  gy *= min(1.0, 3.0 / max(length(gy * texels), 1e-4));

  vec4 color = textureGrad(tScene, shifted, gx, gy);
  vec2 spread = vec2(0.0, side * slope * uFlow * uStrength) / uResolution * uDispersion;
  float spreadPx = length(spread * texels);
  if (color.a > 0.002 && spreadPx > 0.25) {
    vec3 base = color.rgb / color.a;
    vec3 sumColor = vec3(0.0);
    vec3 sumWeight = vec3(0.0);
    for (int i = 0; i < ${MUESTRAS}; i++) {
      float s = (float(i) + 0.5) / float(${MUESTRAS});
      vec4 c = textureGrad(tScene, shifted + spread * (s - 0.5), gx, gy);
      vec3 w = max(1.0 - abs(vec3(s) - vec3(0.15, 0.5, 0.85)) * 2.6, 0.0) * c.a;
      sumColor += c.rgb * (w / max(c.a, 0.002));
      sumWeight += w;
    }
    vec3 split = mix(base, sumColor / max(sumWeight, vec3(1e-4)), clamp(sumWeight * 2.0, 0.0, 1.0));
    color.rgb = mix(color.rgb, clamp(split, 0.0, 1.0) * color.a, smoothstep(0.25, 1.5, spreadPx));
  }

  color *= uSceneAlpha;
  fragColor = vec4(uFondo * (1.0 - color.a) + color.rgb, 1.0);
}
`;

/**
 * Misma interfaz que crearEscenaCarrusel: `seguir(p)` recibe la tarjeta del centro (continua).
 * @param {object} o
 * @param {HTMLCanvasElement} o.lienzo
 * @param {Array<object>} o.tarjetas
 * @param {string} [o.fuente]
 * @param {(indice: number) => void} [o.alCambiar]
 * @param {() => void} [o.alPerder]
 */
export function crearEscenaCinta({
  lienzo,
  tarjetas,
  fuente = "sans-serif",
  alCambiar = () => {},
  alPerder = () => {},
}) {
  const total = tarjetas.length;
  const propias = tarjetas.map((t) => ({ ...t, aspecto: AJUSTE.aspecto }));
  const renderer = new THREE.WebGLRenderer({
    canvas: lienzo,
    antialias: false,
    alpha: false,
    depth: false,
    powerPreference: "high-performance",
  });
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 0);
  const reducido =
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  const objetivo = new THREE.WebGLRenderTarget(2, 2, {
    depthBuffer: false,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
  });

  let destruida = false;
  const texturas = propias.map((t) => texturaTarjeta(null, t, fuente));
  const listas = propias.map(() => false);
  propias.forEach((t, i) => {
    const listo =
      t.tipo === "texto"
        ? (document.fonts?.ready ?? Promise.resolve())
        : cargarImagen(t.imagen);
    listo.then((img) => {
      if (destruida) return;
      texturas[i].dispose();
      texturas[i] = texturaTarjeta(t.tipo === "texto" ? null : img, t, fuente);
      listas[i] = true;
      pedirCuadro(true);
    });
  });

  const camara = new THREE.Camera();
  const uTarjeta = {
    tMap: { value: null },
    uRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uSize: { value: new THREE.Vector2(1, 1) },
    uImage: { value: new THREE.Vector2(4, 3) },
    uRadius: { value: AJUSTE.radio },
    uAlpha: { value: 1 },
    uShift: { value: 0 },
    uDpr: { value: 1 },
    uZoom: { value: 1.08 },
  };
  const materialTarjeta = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: verticeTarjeta,
    fragmentShader: fragmentoTarjeta,
    uniforms: uTarjeta,
    transparent: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    depthTest: false,
    depthWrite: false,
  });
  const mallaTarjeta = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    materialTarjeta,
  );
  mallaTarjeta.frustumCulled = false;
  const escenaTarjeta = new THREE.Scene();
  escenaTarjeta.add(mallaTarjeta);

  const uLente = {
    tScene: { value: objetivo.texture },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uDpr: { value: 1 },
    uCenter: { value: new THREE.Vector2() },
    uHalf: { value: new THREE.Vector2(1, 1) },
    uAngle: { value: (AJUSTE.giro * Math.PI) / 180 },
    uExponent: { value: 2 + Math.pow(1 - clamp01(AJUSTE.redondez), 1.5) * 10 },
    uInner: { value: 60 },
    uOuter: { value: 80 },
    uFlow: { value: 0 },
    uCurl: { value: 0 }, // 'twist'
    uDispersion: { value: AJUSTE.dispersion * 0.12 },
    uStrength: { value: 0 },
    uSceneAlpha: { value: 0 },
    uFondo: { value: new THREE.Vector3(1, 1, 1) },
  };
  const mallaLente = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: verticeLente,
      fragmentShader: fragmentoLente,
      uniforms: uLente,
      depthTest: false,
      depthWrite: false,
    }),
  );
  mallaLente.frustumCulled = false;
  const escenaLente = new THREE.Scene();
  escenaLente.add(mallaLente);

  let W = 1;
  let H = 1;
  let dpr = 1;
  let posicion = 0; // tarjeta del centro, continua
  let velocidad = 0; // tarjetas por segundo
  let destino = 0;
  let energia = 0;
  let indiceAvisado = -1;
  let oculta = -1; // tarjeta abierta en el diploma: no se dibuja
  let ultimos = []; // lo último dibujado, para saber qué tarjeta se tocó
  let corriendo = false;
  let pedido = 0;
  let ultimo = 0;
  const intro = {
    t: reducido ? 1 : 0,
    corriendo: false,
    hecha: reducido,
    desde: performance.now(),
  };
  // glow-up: la intro la maneja el scroll (ponerIntro), no el reloj
  let introExterna = false;

  const altoTarjeta = () => Math.max(24, AJUSTE.alto * H);
  const anchoTarjeta = () => AJUSTE.aspecto * altoTarjeta();
  const paso = () => anchoTarjeta() + AJUSTE.separacion;

  // intro 'rise': las tarjetas suben desde abajo, las del centro primero, y después se curva la cinta
  function efectosIntro() {
    if (intro.hecha) return { alfa: 1, fuerza: 1, tarjeta: null };
    if (!intro.corriendo) return { alfa: 0, fuerza: 0, tarjeta: null };
    const t = intro.t;
    return {
      alfa: 1,
      fuerza: easeInOut((t - 0.3) / 0.65),
      tarjeta: (rel) => {
        const demora = Math.min(Math.abs(rel) / (W * 0.6), 1) * 0.34;
        const local = clamp01((t - demora) / 0.6);
        return {
          alfa: clamp01(local * 4),
          y: (1 - easeOutQuint(local)) * H * 0.62,
          escala: 0.5 + 0.5 * easeInOut((local - 0.18) / 0.82),
        };
      },
    };
  }

  function dibujar() {
    const ef = efectosIntro();
    const ch = altoTarjeta();
    const cw0 = anchoTarjeta();
    const p = paso();
    const vuelta = total * p;
    const achique = 1 - clamp01(AJUSTE.comprimir) * energia;

    uTarjeta.uResolution.value.set(W, H);
    uTarjeta.uDpr.value = dpr;
    renderer.setRenderTarget(objetivo);
    renderer.clear();
    const dibujos = [];
    for (let i = 0; i < total; i++) {
      const relBase = envolver(i * p - posicion * p, vuelta);
      for (let k = -3; k <= 3; k++) {
        const rel = relBase + k * vuelta;
        if (Math.abs(rel) - cw0 / 2 > W + 40) continue;
        const fx = ef.tarjeta ? ef.tarjeta(rel) : null;
        const x = W / 2 + rel;
        const escala = achique * (fx ? fx.escala : 1);
        const alfa = fx ? fx.alfa : 1;
        const cw = cw0 * escala;
        if (alfa <= 0.001 || x + cw / 2 < -40 || x - cw / 2 > W + 40) continue;
        dibujos.push({
          i,
          rel,
          x,
          y: H / 2 + (fx ? fx.y : 0),
          cw,
          ch: ch * escala,
          alfa,
        });
      }
    }
    dibujos.sort((a, b) => Math.abs(b.rel) - Math.abs(a.rel));
    ultimos = dibujos;
    for (const d of dibujos) {
      if (d.i === oculta) continue;
      const t = propias[d.i];
      uTarjeta.tMap.value = texturas[d.i];
      uTarjeta.uRect.value.set(d.x, d.y, d.cw + 2, d.ch + 2);
      uTarjeta.uSize.value.set(d.cw, d.ch);
      uTarjeta.uAlpha.value = d.alfa;
      uTarjeta.uZoom.value = t.tipo === "texto" ? 1 : 1.08;
      uTarjeta.uShift.value =
        reducido || t.tipo === "texto"
          ? 0
          : Math.max(-1, Math.min(1, d.rel / (W * 0.75)));
      renderer.render(escenaTarjeta, camara);
    }
    renderer.setRenderTarget(null);

    const medioAncho = (AJUSTE.lenteAncho * W) / 2;
    const medioAlto = (AJUSTE.lenteAlto * W) / 2;
    const interior = Math.max(
      4,
      AJUSTE.alcance * (medioAncho + medioAlto) * 0.5,
    );
    uLente.uResolution.value.set(W, H);
    uLente.uDpr.value = dpr;
    uLente.uCenter.value.set(W / 2, H / 2);
    uLente.uHalf.value.set(Math.max(medioAncho, 1), Math.max(medioAlto, 1));
    uLente.uInner.value = interior;
    uLente.uOuter.value = interior * 1.6;
    uLente.uFlow.value = AJUSTE.curva * (medioAncho + medioAlto) * 0.45;
    uLente.uStrength.value = ef.fuerza;
    uLente.uSceneAlpha.value = ef.alfa;
    renderer.clear();
    renderer.render(escenaLente, camara);

    const actual = modulo(Math.round(posicion), total);
    if (actual !== indiceAvisado) {
      indiceAvisado = actual;
      alCambiar(actual);
    }
  }

  function cuadro(ahora) {
    pedido = 0;
    const dt = Math.min(
      0.05,
      Math.max(0.001, ultimo ? (ahora - ultimo) / 1000 : 1 / 60),
    );
    ultimo = ahora;
    let animando = false;

    if (
      !introExterna &&
      !intro.hecha &&
      !intro.corriendo &&
      (listas.every(Boolean) || ahora - intro.desde > 3500)
    )
      intro.corriendo = true;
    if (introExterna) {
      // nada: el scroll ya dejó intro.t donde va
    } else if (intro.corriendo) {
      intro.t = Math.min(1, intro.t + dt / DURACION_INTRO);
      if (intro.t >= 1) {
        intro.corriendo = false;
        intro.hecha = true;
      }
      animando = true;
    }
    if (!introExterna && !intro.hecha && !intro.corriendo) animando = true; // esperando las imágenes

    // resorte crítico del original (modo rueda), en tarjetas en vez de píxeles
    const rigidez = 80;
    const amort = 2 * Math.sqrt(rigidez);
    const antes = posicion;
    const pasos = Math.ceil(dt / (1 / 240));
    const h = dt / pasos;
    for (let i = 0; i < pasos; i++) {
      velocidad += (rigidez * (destino - posicion) - amort * velocidad) * h;
      posicion += velocidad * h;
    }
    if (
      Math.abs(destino - posicion) < 0.05 / paso() &&
      Math.abs(velocidad) < 0.5 / paso()
    ) {
      posicion = destino;
      velocidad = 0;
    } else animando = true;

    const recorrido = (Math.abs(posicion - antes) * paso()) / dt;
    const meta = reducido ? 0 : Math.min(recorrido / 2600, 1);
    energia +=
      (meta - energia) * (1 - Math.exp(-dt / (meta > energia ? 0.07 : 0.35)));
    if (energia > 0.001) animando = true;
    else energia = 0;

    dibujar();
    if (animando && corriendo) pedido = requestAnimationFrame(cuadro);
    else ultimo = 0;
  }

  function pedirCuadro(forzar = false) {
    if (!corriendo) return;
    if (pedido) return;
    if (forzar) ultimo = 0;
    pedido = requestAnimationFrame(cuadro);
  }

  function tamano(ancho, alto) {
    W = Math.max(1, ancho);
    H = Math.max(1, alto);
    dpr = Math.min(
      densidadPixeles(2),
      Math.sqrt(PRESUPUESTO_PIXELES / (W * H)),
    );
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    objetivo.setSize(
      Math.max(2, Math.round(W * dpr)),
      Math.max(2, Math.round(H * dpr)),
    );
    if (corriendo) dibujar();
  }

  function fijarFondo(r, g, b) {
    uLente.uFondo.value.set(r, g, b);
    if (corriendo) dibujar();
  }

  function seguir(p) {
    destino = p;
    pedirCuadro();
  }

  function arrancar() {
    if (corriendo) return;
    corriendo = true;
    ultimo = 0;
    dibujar();
    pedirCuadro();
  }

  function frenar() {
    corriendo = false;
    if (pedido) cancelAnimationFrame(pedido);
    pedido = 0;
  }

  const alPerderContexto = (e) => {
    e.preventDefault();
    frenar();
    alPerder();
  };
  lienzo.addEventListener("webglcontextlost", alPerderContexto);

  return {
    tamano,
    fijarFondo,
    seguir,
    arrancar,
    frenar,
    // para las pruebas: salta a una posición sin animar (y sin intro)
    fijar(p) {
      posicion = p;
      destino = p;
      velocidad = 0;
      dibujar();
    },
    // La intro 'rise' atada al scroll: t 0 → 1 mientras la sección entra (y al revés subiendo).
    ponerIntro(t) {
      if (reducido) return;
      introExterna = true;
      const v = clamp01(t);
      if (v === intro.t && (v >= 1) === intro.hecha) return;
      intro.t = v;
      intro.hecha = v >= 1;
      intro.corriendo = v > 0 && v < 1;
      if (corriendo) pedirCuadro();
    },
    saltarIntro() {
      intro.t = 1;
      intro.corriendo = false;
      intro.hecha = true;
      if (corriendo) dibujar();
    },
    // la tarjeta bajo el punto (px del lienzo), la más cercana al centro primero
    tarjetaEn(x, y) {
      for (let k = ultimos.length - 1; k >= 0; k--) {
        const d = ultimos[k];
        if (Math.abs(x - d.x) <= d.cw / 2 && Math.abs(y - d.y) <= d.ch / 2)
          return { indice: d.i, x: d.x, y: d.y, ancho: d.cw, alto: d.ch };
      }
      return null;
    },
    ocultar(i) {
      oculta = i ?? -1;
      if (corriendo) dibujar();
    },
    estado: () => ({
      posicion,
      destino,
      indice: modulo(Math.round(destino), total),
      vidrio: 1,
      intro: intro.hecha,
    }),
    destruir() {
      destruida = true;
      frenar();
      lienzo.removeEventListener("webglcontextlost", alPerderContexto);
      texturas.forEach((t) => t.dispose());
      mallaTarjeta.geometry.dispose();
      materialTarjeta.dispose();
      mallaLente.geometry.dispose();
      mallaLente.material.dispose();
      objetivo.dispose();
      renderer.dispose();
    },
  };
}
