// Frase "Gracias por pasar." en 2D: letras planas gris oscuro con un contorno fino por el que corre
// un brillo que va "rellenando" el borde como si lo recorriera, y una burbuja bajo el cursor que
// abre un hueco en las caras con un aro luminoso en su borde. Se dibuja con three en una cámara
// ortográfica; no hay luces ni extrusión. Quien la maneja le pasa el estado en cada cuadro.
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { FRASE_GLIFOS, FRASE_UPM } from '@/data/fraseGlifos.js';

export const CICLO_MS = 9000;

const ANCHO_BORDE = 7; // media anchura del contorno, en unidades de 1000 por em
const PERIODO_BRILLO = 5.5; // segundos que tarda el brillo en dar la vuelta a cada contorno
const SEGMENTOS_CURVA = 14;

// La burbuja: hueco redondo con borde que ondula, centrado en el cursor.
const LENTE_GLSL = `
uniform vec4 uLens;      // centro (px de dispositivo, origen GL), radio px, ancho del aro px
uniform float uLensTime;
float lensEdge(vec2 frag) {
  vec2 d = frag - uLens.xy;
  float a = atan(d.y, d.x);
  float w = 0.085 * sin(a * 3.0 + uLensTime * 1.7)
          + 0.055 * sin(a * 5.0 - uLensTime * 2.3)
          + 0.035 * sin(a * 8.0 + uLensTime * 3.1);
  return length(d) - uLens.z * (1.0 + w);
}
float lensHalo(float d) {
  return uLens.z > 0.5 ? (1.0 - smoothstep(0.0, uLens.w, abs(d))) * 0.55 : 0.0;
}
`;

const CARA_VERTICE = `
  varying float vY;
  void main() {
    vec4 mundo = modelMatrix * vec4(position, 1.0);
    vY = mundo.y;
    gl_Position = projectionMatrix * viewMatrix * mundo;
  }
`;

// Las caras: gris oscuro con degradé vertical (más claro arriba). Dentro de la burbuja se recortan.
const CARA_FRAGMENTO = `
  ${LENTE_GLSL}
  uniform float uYArriba;
  uniform float uYAbajo;
  uniform float uTono;
  varying float vY;
  void main() {
    float d = uLens.z > 0.5 ? lensEdge(gl_FragCoord.xy) : 1e6;
    if (d < 0.0) discard;
    float g = clamp((vY - uYAbajo) / max(1.0, uYArriba - uYAbajo), 0.0, 1.0);
    vec3 c = mix(vec3(0.075, 0.078, 0.092), vec3(0.235, 0.245, 0.285), g) * uTono;
    c += vec3(0.9, 0.92, 1.0) * lensHalo(d);
    gl_FragColor = vec4(c, 1.0);
  }
`;

const BORDE_VERTICE = `
  attribute float aT;
  varying float vT;
  void main() {
    vT = aT;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
  }
`;

// El contorno: una línea clara y tenue siempre, y un brillo que avanza por el contorno dejando una
// cola que se va apagando detrás: el borde parece irse llenando de luz a medida que lo recorre.
const BORDE_FRAGMENTO = `
  ${LENTE_GLSL}
  uniform float uFase;
  uniform float uTono;
  varying float vT;
  void main() {
    float d = uLens.z > 0.5 ? lensEdge(gl_FragCoord.xy) : 1e6;
    float atras = fract(uFase - vT);
    float cola = exp(-atras * 5.5);
    float cabeza = exp(-pow(atras * 38.0, 2.0));
    vec3 cremaC = vec3(1.0, 0.93, 0.89);
    vec3 azulC = vec3(0.75, 0.81, 0.95);
    vec3 luz = mix(cremaC, azulC, 0.5 + 0.5 * sin(vT * 6.2831 + uFase * 6.2831));
    vec3 base = vec3(0.31, 0.32, 0.35);
    vec3 c = base + luz * (0.55 * cola + 0.9 * cabeza);
    c += vec3(0.9, 0.92, 1.0) * lensHalo(d);
    float a = clamp((0.55 + 0.45 * cola + cabeza) * (0.6 + 0.4 * uTono), 0.0, 1.0);
    gl_FragColor = vec4(c, a);
  }
`;

// Un glifo → formas con sus contornos (el exterior y los agujeros), con el parser SVG de siempre.
function contornosDeGlifo(d) {
  const formas = new SVGLoader()
    .parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`)
    .paths.flatMap((p) => SVGLoader.createShapes(p));
  return formas.map((forma) => {
    const { shape, holes } = forma.extractPoints(SEGMENTOS_CURVA);
    return { forma, anillos: [shape, ...holes] };
  });
}

// Cinta de ancho fijo a lo largo de un contorno cerrado; `aT` va de 0 a 1 por la longitud.
function cintaDeContorno(puntos, cx, cy, mitad) {
  const pts = puntos.map((p) => new THREE.Vector2(p.x - cx, p.y - cy));
  if (pts.length > 1 && pts[0].distanceTo(pts[pts.length - 1]) < 1e-6) pts.pop();
  const n = pts.length;
  if (n < 3) return null;
  const largo = [0];
  for (let i = 1; i <= n; i += 1) largo.push(largo[i - 1] + pts[i % n].distanceTo(pts[i - 1]));
  const total = largo[n] || 1;
  const pos = [];
  const t = [];
  const idx = [];
  for (let i = 0; i < n; i += 1) {
    const a = pts[(i + n - 1) % n];
    const b = pts[i];
    const c = pts[(i + 1) % n];
    const n1 = new THREE.Vector2(b.y - a.y, a.x - b.x).normalize();
    const n2 = new THREE.Vector2(c.y - b.y, b.x - c.x).normalize();
    const m = n1.clone().add(n2);
    let esc = mitad;
    if (m.lengthSq() > 1e-8) {
      m.normalize();
      esc = Math.min(mitad / Math.max(0.35, m.dot(n1)), mitad * 2.5);
    } else {
      m.copy(n1);
    }
    m.multiplyScalar(esc);
    pos.push(b.x + m.x, b.y + m.y, 0.05, b.x - m.x, b.y - m.y, 0.05);
    t.push(largo[i] / total, largo[i] / total);
  }
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    idx.push(2 * i, 2 * i + 1, 2 * j, 2 * i + 1, 2 * j + 1, 2 * j);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aT', new THREE.Float32BufferAttribute(t, 1));
  geo.setIndex(idx);
  return geo;
}

export class EscenaFrase {
  constructor(canvas) {
    this.escena = new THREE.Scene();
    this.camara = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
    this.palabra = new THREE.Group();
    this.letras = [];
    this.layout = null;
    this.pivote = new THREE.Vector2();
    this.anchoTinta = FRASE_UPM;
    this.altoTinta = FRASE_UPM;
    this.lente = { uLens: { value: new THREE.Vector4() }, uLensTime: { value: 0 } };
    this.degradado = { uYArriba: { value: 1 }, uYAbajo: { value: 0 } };

    const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    this.renderer = r;
    r.setClearColor(0, 0);
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.materiales = [];
    this.geometrias = [];
    this.escena.add(this.palabra);
    this.construirLetras();
  }

  material(tipo, tono) {
    const comunes = { ...this.lente, uTono: { value: tono } };
    const m =
      tipo === 'cara'
        ? new THREE.ShaderMaterial({
            vertexShader: CARA_VERTICE,
            fragmentShader: CARA_FRAGMENTO,
            uniforms: { ...comunes, ...this.degradado },
            side: THREE.DoubleSide,
          })
        : new THREE.ShaderMaterial({
            vertexShader: BORDE_VERTICE,
            fragmentShader: BORDE_FRAGMENTO,
            uniforms: { ...comunes, uFase: { value: 0 } },
            side: THREE.DoubleSide,
            transparent: true,
            depthWrite: false,
          });
    this.materiales.push(m);
    return m;
  }

  construirLetras() {
    const caja = new THREE.Box3();
    const previos = FRASE_GLIFOS.map((g) => {
      const contornos = contornosDeGlifo(g.d);
      const cb = new THREE.Box3();
      contornos.forEach(({ anillos }) =>
        anillos.forEach((a) => a.forEach((p) => cb.expandByPoint(new THREE.Vector3(p.x, p.y, 0))))
      );
      caja.union(cb);
      return { contornos, cb };
    });

    previos.forEach(({ contornos, cb }, i) => {
      const centro = cb.getCenter(new THREE.Vector3());
      const g = FRASE_GLIFOS[i];
      const tono = g.linea === 1 && !g.punto ? 0.8 : 1;
      const grupo = new THREE.Group();
      const mover = (p) => new THREE.Vector2(p.x - centro.x, p.y - centro.y);

      contornos.forEach(({ forma, anillos }) => {
        const exterior = new THREE.Shape(forma.getPoints(SEGMENTOS_CURVA).map(mover));
        exterior.holes = forma.holes.map((h) => new THREE.Path(h.getPoints(SEGMENTOS_CURVA).map(mover)));
        const geoCara = new THREE.ShapeGeometry(exterior, SEGMENTOS_CURVA);
        this.geometrias.push(geoCara);
        grupo.add(new THREE.Mesh(geoCara, this.material('cara', tono)));
        anillos.forEach((anillo) => {
          const geo = cintaDeContorno(anillo, centro.x, centro.y, ANCHO_BORDE);
          if (!geo) return;
          this.geometrias.push(geo);
          grupo.add(new THREE.Mesh(geo, this.material('borde', tono)));
        });
      });

      grupo.visible = false;
      this.palabra.add(grupo);
      this.letras.push({ grupo, casa: new THREE.Vector2(centro.x, centro.y), desfase: (i * 0.137) % 1 });
    });

    this.pivote.set((caja.min.x + caja.max.x) / 2, (caja.min.y + caja.max.y) / 2);
    this.anchoTinta = caja.max.x - caja.min.x;
    this.altoTinta = caja.max.y - caja.min.y;
    this.letras.forEach((l) => l.casa.sub(this.pivote));
  }

  medidaTinta(fontPx) {
    const e = fontPx / FRASE_UPM;
    return { ancho: this.anchoTinta * e, alto: this.altoTinta * e };
  }

  // Centro de la última letra (el punto final) en px del lienzo, con la letra ya en su lugar.
  centroUltima(fontPx, width, height) {
    const l = this.letras[this.letras.length - 1];
    if (!l) return null;
    const k = fontPx / FRASE_UPM;
    return [width / 2 + l.casa.x * k, height / 2 - l.casa.y * k];
  }

  setLayout(layout) {
    this.layout = layout;
    const { width, height, fontPx } = layout;
    this.renderer.setSize(width, height, true);
    Object.assign(this.camara, { left: -width / 2, right: width / 2, top: height / 2, bottom: -height / 2 });
    this.camara.updateProjectionMatrix();
    const mitad = (this.altoTinta * fontPx) / FRASE_UPM / 2;
    this.degradado.uYArriba.value = mitad;
    this.degradado.uYAbajo.value = -mitad;
  }

  render(estado) {
    if (this.posar(estado)) this.renderer.render(this.escena, this.camara);
  }

  posar(e) {
    const L = this.layout;
    if (!L) return false;
    const { height, fontPx } = L;
    const k = fontPx / FRASE_UPM;
    const dpr = this.renderer.getPixelRatio();
    const hover = e.hover;
    const segundos = performance.now() / 1000;

    const radio = e.mascaraX === undefined ? 0 : 0.46 * hover * fontPx * dpr;
    this.lente.uLens.value.set((e.mascaraX ?? 0) * dpr, (height - (e.mascaraY ?? 0)) * dpr, radio, 0.06 * fontPx * dpr);
    this.lente.uLensTime.value = segundos;

    this.letras.forEach((l, i) => {
      const r = e.aparicion[i] ?? 1;
      l.grupo.scale.setScalar(k);
      l.grupo.position.set(l.casa.x * k, l.casa.y * k - (1 - r) * 0.575 * fontPx, 0);
      l.grupo.visible = r > 0.001;
      const fase = (segundos / PERIODO_BRILLO + l.desfase) % 1;
      l.grupo.children.forEach((m) => {
        if (m.material.uniforms.uFase) m.material.uniforms.uFase.value = fase;
      });
    });
    return true;
  }

  dispose() {
    this.geometrias.forEach((g) => g.dispose());
    this.materiales.forEach((m) => m.dispose());
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
