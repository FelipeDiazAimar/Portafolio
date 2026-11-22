// Frase "Gracias por pasar." en 3D: letras extruidas con bisel, metal pulido que refleja un estudio
// de tiras de luz, una luz que sigue al cursor y una "lente" que abre un hueco con borde ondulado
// bajo el puntero. Es el mismo recurso que usa el pie de getlayers.ai (WordmarkScene), portado a
// una clase sin React: la escena sólo sabe dibujar; quien la maneja le pasa el estado en cada
// cuadro (reloj, inclinación, hover, puntero, aparición de cada letra).
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FRASE_GLIFOS, FRASE_UPM } from '@/data/fraseGlifos.js';
import { densidadPixeles } from '@/lib/rendimiento.js';

const GROSOR = 26;
const EXTRUSION = {
  depth: 150,
  curveSegments: 10,
  bevelEnabled: true,
  bevelThickness: GROSOR,
  bevelSize: 16,
  bevelOffset: -16,
  bevelSegments: 6,
};
const PROFUNDIDAD = EXTRUSION.depth;

// Aspecto "platino" de getlayers: metal casi espejo, poca rugosidad, sin iridiscencia.
const ASPECTO = {
  tinte: '#e6e8ee',
  factorApagado: 0.55,
  rugosidad: [0.05, 0.1],
  clearcoat: 0.2,
  clearcoatRugosidad: 0.04,
  entorno: [1.15, 1.5, 1.2, 1.4],
  entornoHover: 0.2,
  exposicion: 0.9,
  puntero: { base: 0.25, hover: 1.1 },
};

export const CICLO_MS = 9000;

// La lente: un hueco redondo (con borde que ondula) donde la cara frontal desaparece y se ve el
// interior de la letra. Un halo claro marca el borde.
const LENTE_GLSL = `
uniform vec4 uLens;      // centro (px de dispositivo, origen GL), radio px, borde px
uniform float uLensTime;
float lensEdge(vec2 frag) {
  vec2 d = frag - uLens.xy;
  float a = atan(d.y, d.x);
  float w = 0.085 * sin(a * 3.0 + uLensTime * 1.7)
          + 0.055 * sin(a * 5.0 - uLensTime * 2.3)
          + 0.035 * sin(a * 8.0 + uLensTime * 3.1);
  return length(d) - uLens.z * (1.0 + w);
}
`;

const SALA_VERTICE = `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Estudio: tiras de luz cálida (izquierda) y fría (derecha) que las caras espejadas reflejan, más
// cajas suaves arriba y a los lados que se reflejan en el bisel como una línea fina y brillante.
const SALA_FRAGMENTO = `
  uniform vec3 uVoid;
  uniform vec3 uCream;
  uniform vec3 uBlue;
  varying vec3 vDir;
  float box(float az, float el, float azC, float azW, float elC, float elW, float soft) {
    float a = 1.0 - smoothstep(azW, azW + soft, abs(az - azC));
    float e = 1.0 - smoothstep(elW, elW + soft, abs(el - elC));
    return a * e;
  }
  void main() {
    vec3 d = normalize(vDir);
    float az = atan(d.x, d.z);
    float el = asin(clamp(d.y, -1.0, 1.0));
    vec3 white = vec3(1.0);
    vec3 warm = mix(white, uCream, 0.35);
    vec3 cool = mix(white, uBlue, 0.35);
    vec3 c = uVoid * 0.12;
    c += mix(warm, cool, smoothstep(-0.4, 0.4, az)) * (0.07 + 0.16 * smoothstep(-0.25, 0.3, el))
      * box(az, el, 0.0, 0.42, 0.05, 0.4, 0.2);
    c += warm * 1.7 * box(az, el, -1.45, 0.35, 0.15, 0.6, 0.12);
    c += cool * 1.4 * box(az, el, 1.45, 0.3, 0.1, 0.55, 0.12);
    c += white * 2.2 * box(az, el, 0.0, 1.6, 1.15, 0.12, 0.08);
    c += mix(uCream, uBlue, 0.5) * 0.02 * exp(-pow(d.y * 5.0, 2.0));
    gl_FragColor = vec4(c, 1.0);
  }
`;

function color(css) {
  return new THREE.Color().setStyle(css.trim() || '#ffffff');
}

// Un glifo → lista de formas (el contorno y sus agujeros) usando el mismo parser SVG que getlayers.
function formasDeGlifos() {
  const cargador = new SVGLoader();
  return FRASE_GLIFOS.map((g) =>
    cargador
      .parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${g.d}"/></svg>`)
      .paths.flatMap((p) => SVGLoader.createShapes(p))
  );
}

export class EscenaFrase {
  constructor(canvas, paleta) {
    this.paleta = paleta;
    this.escena = new THREE.Scene();
    this.camara = new THREE.PerspectiveCamera(15, 1, 1, 1e4);
    this.palabra = new THREE.Group();
    this.letras = [];
    this.layout = null;
    this.pivote = new THREE.Vector2();
    this.anchoTinta = FRASE_UPM;
    this.lente = { uLens: { value: new THREE.Vector4() }, uLensTime: { value: 0 } };

    const r = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer = r;
    r.setClearColor(0, 0);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = ASPECTO.exposicion;
    r.setPixelRatio(densidadPixeles(1.5));

    this.crema = color(paleta.crema);
    this.azul = color(paleta.azul);
    this.entorno = this.hornearEntorno();
    this.escena.environment = this.entorno;

    const metal = (c, rugosidad, entorno) =>
      new THREE.MeshPhysicalMaterial({
        color: c,
        metalness: 1,
        roughness: rugosidad,
        envMapIntensity: entorno,
        clearcoat: ASPECTO.clearcoat,
        clearcoatRoughness: ASPECTO.clearcoatRugosidad,
      });
    const tinte = color(ASPECTO.tinte);
    const [r0, r1] = ASPECTO.rugosidad;
    // Mismo metal platino que getlayers. Las caras (material 0) reflejan sólo el fondo oscuro del
    // estudio, que tiene un degradé (más claro arriba): por eso se ven grises oscuras y no espejo.
    // El brillo fino queda en el bisel (material 1).
    const ENTORNO_CARA = 0.35;
    this.brillante = [metal(tinte, r0, ENTORNO_CARA), metal(tinte, r1, ASPECTO.entorno[1])];
    const apagado = tinte.clone().multiplyScalar(ASPECTO.factorApagado);
    this.apagado = [metal(apagado, r0 + 0.04, ENTORNO_CARA), metal(apagado, r1 + 0.04, ASPECTO.entorno[3])];
    // En three reciente envMapIntensity sólo cuenta si el material tiene su propio envMap.
    for (const m of [...this.brillante, ...this.apagado]) m.envMap = this.entorno;

    // Materiales 0 = caras frontal/trasera: ahí se recorta la lente y se pinta el halo del borde.
    for (const m of [this.brillante[0], this.apagado[0]]) {
      m.onBeforeCompile = (sombreador) => {
        sombreador.uniforms.uLens = this.lente.uLens;
        sombreador.uniforms.uLensTime = this.lente.uLensTime;
        sombreador.fragmentShader = sombreador.fragmentShader.replace(
          'void main() {',
          `${LENTE_GLSL}
void main() {
  if (uLens.z > 0.5 && lensEdge(gl_FragCoord.xy) < 0.0) discard;`
        );
      };
      m.customProgramCacheKey = () => 'frase-lente';
    }
    // Materiales 1 = paredes laterales: se recortan sólo la mitad delantera, para que la lente
    // deje ver el hueco por dentro en vez de atravesar la letra entera.
    for (const m of [this.brillante[1], this.apagado[1]]) {
      m.onBeforeCompile = (sombreador) => {
        sombreador.uniforms.uLens = this.lente.uLens;
        sombreador.uniforms.uLensTime = this.lente.uLensTime;
        sombreador.vertexShader = sombreador.vertexShader
          .replace('void main() {', 'varying float vLensZ;\nvoid main() {')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vLensZ = position.z;');
        sombreador.fragmentShader = sombreador.fragmentShader.replace(
          'void main() {',
          `${LENTE_GLSL}
varying float vLensZ;
void main() {
  if (uLens.z > 0.5 && vLensZ < ${(PROFUNDIDAD / 2).toFixed(1)} && lensEdge(gl_FragCoord.xy) < 0.0) discard;`
        );
      };
      m.customProgramCacheKey = () => 'frase-lente-lado';
    }

    this.escena.add(this.palabra);

    this.construirLetras();
  }

  salaEstudio() {
    const p = this.paleta;
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: SALA_VERTICE,
      fragmentShader: SALA_FRAGMENTO,
      uniforms: {
        uVoid: { value: color(p.vacio).multiplyScalar(1.4) },
        uCream: { value: color(p.crema) },
        uBlue: { value: color(p.azul) },
      },
    });
    const esfera = new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), material);
    return {
      esfera,
      liberar: () => {
        esfera.geometry.dispose();
        material.dispose();
      },
    };
  }

  hornearEntorno() {
    const { esfera, liberar } = this.salaEstudio();
    const escenaSala = new THREE.Scene();
    escenaSala.add(esfera);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const textura = pmrem.fromScene(escenaSala, 0.004).texture;
    pmrem.dispose();
    liberar();
    return textura;
  }

  construirLetras() {
    const caja = new THREE.Box3();
    formasDeGlifos().forEach((formas, i) => {
      const bruta = new THREE.ExtrudeGeometry(formas, EXTRUSION);
      const geo = toCreasedNormals(bruta, Math.PI / 3);
      if (geo !== bruta) bruta.dispose();
      // Las tapas (grupo de material 0) llevan normal plana: así reflejan la tira de luz limpia.
      const tapa = geo.groups.find((g) => g.materialIndex === 0);
      const normal = geo.getAttribute('normal');
      const pos = geo.getAttribute('position');
      if (tapa) {
        const fin = Math.min(tapa.start + tapa.count, normal.count);
        for (let v = tapa.start; v < fin; v += 1) {
          normal.setXYZ(v, 0, 0, pos.getZ(v) > PROFUNDIDAD / 2 ? 1 : -1);
        }
        normal.needsUpdate = true;
      }
      geo.computeBoundingBox();
      const cb = geo.boundingBox ?? new THREE.Box3();
      caja.union(cb);
      const centro = cb.getCenter(new THREE.Vector3());
      geo.translate(-centro.x, -centro.y, -PROFUNDIDAD / 2);

      const dim = FRASE_GLIFOS[i].linea === 1 && !FRASE_GLIFOS[i].punto;
      const malla = new THREE.Mesh(geo, dim ? this.apagado : this.brillante);
      malla.visible = false;
      this.palabra.add(malla);
      this.letras.push({ malla, casa: new THREE.Vector2(centro.x, centro.y) });
    });
    this.pivote.set((caja.min.x + caja.max.x) / 2, (caja.min.y + caja.max.y) / 2);
    this.anchoTinta = caja.max.x - caja.min.x;
    this.altoTinta = caja.max.y - caja.min.y;
    this.letras.forEach((l) => l.casa.sub(this.pivote));
  }

  // Tamaño en px de la tinta para una fuente de `fontPx`.
  medidaTinta(fontPx) {
    const e = fontPx / FRASE_UPM;
    return { ancho: this.anchoTinta * e, alto: this.altoTinta * e };
  }

  setLayout(layout) {
    this.layout = layout;
    const { width, height, fontPx } = layout;
    this.renderer.setSize(width, height, true);
    // Cámara lejana y de ángulo cerrado: las caras planas reflejan sólo el fondo oscuro del estudio
    // (como en getlayers, donde la palabra ocupa todo el ancho y el ángulo ya es chico).
    const dist = Math.max(1.7 * (this.anchoTinta * fontPx) / FRASE_UPM, 2.5 * height);
    this.camara.fov = THREE.MathUtils.radToDeg(2 * Math.atan(height / 2 / dist));
    this.camara.aspect = width / height;
    this.camara.near = 0.2 * dist;
    this.camara.far = 3 * dist;
    this.camara.position.set(0, 0, dist);
    this.camara.lookAt(0, 0, 0);
    this.camara.updateProjectionMatrix();
  }

  render(estado) {
    if (this.posar(estado)) this.renderer.render(this.escena, this.camara);
  }

  posar(e) {
    const L = this.layout;
    if (!L) return false;
    const { height, fontPx } = L;
    const k = fontPx / FRASE_UPM;
    const t = e.reloj * Math.PI * 2;
    const hover = e.hover;
    const dpr = this.renderer.getPixelRatio();

    const radio = e.mascaraX === undefined ? 0 : 0.46 * hover * fontPx * dpr;
    this.lente.uLens.value.set(
      (e.mascaraX ?? 0) * dpr,
      (height - (e.mascaraY ?? 0)) * dpr,
      radio,
      0.06 * fontPx * dpr
    );
    this.lente.uLensTime.value = performance.now() / 1000;

    const retroceso = (PROFUNDIDAD / 2 + GROSOR) * k;
    this.palabra.position.set(0, 0.018 * Math.sin(t) * fontPx, -retroceso + 0.14 * hover * fontPx);
    // La palabra no gira, ni sola ni hacia el cursor: al girar, las tiras de luz que reflejan las
    // caras se deslizan por encima y se ve un barrido de brillo.
    this.palabra.rotation.set(0, 0, 0);
    this.palabra.scale.setScalar(1 + 0.012 * hover);

    this.letras.forEach((l, i) => {
      const r = e.aparicion[i] ?? 1;
      const s = Math.sin(2 * t - 0.55 * i);
      l.malla.scale.setScalar(k);
      l.malla.position.set(l.casa.x * k, l.casa.y * k + 0.012 * s * fontPx - (1 - r) * 0.575 * fontPx, 0);
      l.malla.rotation.set((1 - r) * 0.8, 0, 0);
      l.malla.visible = r > 0.001;
    });

    return true;
  }

  dispose() {
    this.letras.forEach(({ malla }) => malla.geometry.dispose());
    [...this.brillante, ...this.apagado].forEach((m) => m.dispose());
    this.entorno?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
