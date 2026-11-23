// Líneas que te llevan de una sección a la siguiente (como las de lusion.co): un tubo 3D por unión
// que se dibuja con el scroll. La punta sigue a la mitad de la pantalla: al bajar crece, al subir
// se recoge (construye y deconstruye). Viven en coordenadas de la página, así que además se
// desplazan con el contenido, y en un scroll rápido ondulan (u_strength = fuerza del scroll).
//
// Sin React: la crea y la destruye LineasScroll.jsx. El mundo está en píxeles (x desde el centro de
// la pantalla, y = −y de página), la cámara en perspectiva a la distancia en que z = 0 mide 1:1.
import * as THREE from 'three';
import { densidadPixeles } from '@/lib/rendimiento.js';
import { SecondOrderDynamics, limitar } from '@/lib/movimiento.js';

const FOV = 32;
const SEGMENTOS = 520;
const RADIALES = 10;

// Presets sacados de LINES_DATA_LIST de lusion.co (colores, margen, umbral). `forma` elige el
// dibujo de la curva (ver trazado()).
export const PRESETS = {
  reel: { c0: '#5a90ff', c1: '#2a38ee', margin: { x: -0.05, y: -0.8 }, ao: 0.555, forma: 0 },
  goal: { c0: '#94fffb', c1: '#1285dc', margin: { x: 0.2, y: -0.6 }, ao: 0.0001, forma: 1 },
  capability: { c0: '#ffffff', c1: '#bbbbbb', margin: { x: 0, y: -1.15 }, ao: 0.0001, forma: 2 },
  office: { c0: '#ffffff', c1: '#bbbbbb', margin: { x: 0, y: -2.2 }, ao: 0.0001, forma: 3 },
};
// En tema claro el blanco no se ve: grafito.
const CLAROS = {
  capability: { c0: '#2a2f3a', c1: '#8a91a0' },
  office: { c0: '#2a2f3a', c1: '#8a91a0' },
};

const VERT = /* glsl */ `
  attribute float aT;
  uniform float u_time;
  uniform float u_strength;
  uniform float u_show;
  varying float vT;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vT = aT;
    vec3 p = position;
    // ondula en un scroll rápido, más cerca de la punta
    float cerca = smoothstep(u_show - 0.35, u_show, aT);
    p.x += sin(aT * 38.0 - u_time * 4.0) * u_strength * 14.0 * cerca;
    p.z += cos(aT * 31.0 - u_time * 3.0) * u_strength * 22.0 * cerca;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform float u_show;
  uniform float u_ao;
  uniform vec3 u_c0;
  uniform vec3 u_c1;
  uniform float u_claro;
  varying float vT;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    if (vT > u_show) discard;
    vec3 n = normalize(vNormal);
    vec3 v = normalize(vView);
    vec3 l = normalize(vec3(-0.4, 0.7, 0.6));
    float dif = max(dot(n, l), 0.0);
    float spec = pow(max(dot(reflect(-l, n), v), 0.0), 28.0);
    float borde = pow(1.0 - max(dot(n, v), 0.0), 2.0);
    vec3 base = mix(u_c0, u_c1, smoothstep(0.0, 1.0, vT));
    vec3 c = base * (0.45 + 0.65 * dif) + vec3(spec) * (0.55 - 0.35 * u_claro) - borde * 0.22 * base;
    // la punta brilla un poco
    c += base * smoothstep(u_show - 0.025, u_show, vT) * 0.35;
    // la cola nace del aire (Lusion: aoThreshold)
    float cola = smoothstep(0.0, max(0.03, u_ao * 0.12), vT);
    gl_FragColor = vec4(c, cola);
  }
`;

// Curva de una unión en coordenadas de página (x desde el centro, y de página, z). `J`: y de la
// unión (borde de arriba de la sección que entra). Cuatro dibujos, uno por preset.
function trazado(forma, J, vw, vh, margin, lado) {
  const W = vw / 2;
  const s = lado; // 1 o −1: de qué lado entra
  const mx = margin.x * W;
  const my = margin.y * vh * 0.18; // el margen de Lusion es para su cámara; acá corre un poco el lazo
  const lazo = (cx, cy, r, vueltas, z0, desde) => {
    const p = [];
    const n = Math.round(8 * vueltas);
    for (let i = 1; i <= n; i += 1) {
      const a = desde + (i / n) * Math.PI * 2 * vueltas * s;
      p.push([cx + Math.cos(a) * r * 1.15, cy + Math.sin(a) * r, z0 + Math.sin(a * 1.5) * r * 0.6]);
    }
    return p;
  };
  const R = Math.min(vw, vh) * 0.17;
  let pts;
  if (forma === 0) {
    // reel: entra por un costado, da una vuelta grande y baja en S
    pts = [
      [-s * (W + 120), J - vh * 1.05, -40],
      [-s * W * 0.55, J - vh * 0.85, 60],
      [s * W * 0.05 + mx, J - vh * 0.55 + my, 120],
      ...lazo(s * W * 0.12 + mx, J - vh * 0.32 + my, R, 1, 40, -Math.PI / 2),
      [s * W * 0.42, J - vh * 0.02, -80],
      [-s * W * 0.18, J + vh * 0.32, 60],
      [-s * W * 0.62, J + vh * 0.62, -20],
      [-s * (W + 160), J + vh * 0.95, 0],
    ];
  } else if (forma === 1) {
    // goal: zigzag ancho con un bucle chico arriba de la unión
    pts = [
      [s * (W + 120), J - vh * 1.0, 0],
      [s * W * 0.35, J - vh * 0.78, 80],
      [-s * W * 0.45 + mx, J - vh * 0.52, -60],
      ...lazo(-s * W * 0.32 + mx, J - vh * 0.3 + my, R * 0.75, 1, 0, Math.PI / 2),
      [s * W * 0.15, J - vh * 0.05, 120],
      [s * W * 0.55, J + vh * 0.28, -40],
      [-s * W * 0.1, J + vh * 0.58, 30],
      [-s * (W + 140), J + vh * 0.9, 0],
    ];
  } else if (forma === 2) {
    // capability: cae por el centro haciendo un resorte de dos vueltas
    pts = [
      [-s * W * 0.2, J - vh * 1.05, 0],
      [-s * W * 0.05 + mx, J - vh * 0.72, 80],
      ...lazo(s * W * 0.02 + mx, J - vh * 0.48 + my, R * 0.7, 1, 0, Math.PI),
      ...lazo(s * W * 0.02 + mx, J - vh * 0.18 + my, R * 0.9, 1, 40, Math.PI),
      [s * W * 0.4, J + vh * 0.2, -60],
      [s * W * 0.15, J + vh * 0.55, 40],
      [-s * W * 0.5, J + vh * 0.85, 0],
      [-s * (W + 120), J + vh * 1.05, 0],
    ];
  } else {
    // office: barrido largo de lado a lado, como una firma
    pts = [
      [-s * (W + 120), J - vh * 0.9, 0],
      [-s * W * 0.2, J - vh * 0.72, 90],
      [s * W * 0.6, J - vh * 0.5, -40],
      [s * W * 0.2 + mx, J - vh * 0.28 + my, 60],
      ...lazo(-s * W * 0.12 + mx, J - vh * 0.12 + my, R * 0.6, 1, 20, 0),
      [-s * W * 0.55, J + vh * 0.18, -50],
      [s * W * 0.1, J + vh * 0.45, 40],
      [s * (W + 140), J + vh * 0.8, 0],
    ];
  }
  return new THREE.CatmullRomCurve3(
    pts.map(([x, y, z]) => new THREE.Vector3(x, -y, z)),
    false,
    'centripetal',
    0.5
  );
}

export function crearEscenaLineas({ lienzo, uniones, obtenerTema }) {
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(FOV, 1, 10, 20000);
  const grupo = new THREE.Group();
  escena.add(grupo);

  let vw = 1;
  let vh = 1;
  let lineas = [];
  let tiempo = 0;
  let pintado = false;

  function radio() {
    return limitar(vw * 0.0042, 3, 7.5);
  }

  function limpiar() {
    lineas.forEach((l) => {
      grupo.remove(l.malla);
      l.malla.geometry.dispose();
      l.malla.material.dispose();
    });
    lineas = [];
  }

  // `medidas`: [{ preset, J }] (J = y de página de cada unión)
  function construir(medidas) {
    limpiar();
    const claro = obtenerTema() === 'light';
    medidas.forEach(({ preset, J }, i) => {
      const p = PRESETS[preset];
      const colores = claro && CLAROS[preset] ? CLAROS[preset] : p;
      const curva = trazado(p.forma, J, vw, vh, p.margin, i % 2 === 0 ? 1 : -1);
      const geo = new THREE.TubeGeometry(curva, SEGMENTOS, radio(), RADIALES, false);
      const n = geo.attributes.position.count;
      const t = new Float32Array(n);
      for (let k = 0; k < n; k += 1) t[k] = Math.floor(k / (RADIALES + 1)) / SEGMENTOS;
      geo.setAttribute('aT', new THREE.BufferAttribute(t, 1));
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: true,
        uniforms: {
          u_show: { value: 0 },
          u_strength: { value: 0 },
          u_time: { value: 0 },
          u_ao: { value: p.ao },
          u_c0: { value: new THREE.Color(colores.c0) },
          u_c1: { value: new THREE.Color(colores.c1) },
          u_claro: { value: claro ? 1 : 0 },
        },
      });
      const malla = new THREE.Mesh(geo, mat);
      malla.frustumCulled = false;
      grupo.add(malla);
      // Tabla t → y de página "monótona": la punta avanza cuando la curva alcanza por primera vez
      // la altura de la mitad de la pantalla (un lazo que sube no hace retroceder la punta).
      const tabla = [];
      let maxY = -Infinity;
      for (let k = 0; k <= 400; k += 1) {
        const y = -curva.getPointAt(k / 400).y;
        maxY = Math.max(maxY, y);
        tabla.push(maxY);
      }
      const yMin = -curva.getPointAt(0).y;
      let yMax = -Infinity;
      curva.points.forEach((v) => {
        yMax = Math.max(yMax, -v.y);
      });
      lineas.push({ malla, tabla, yMin: Math.min(yMin, J - vh * 1.2), yMax: yMax + 40, resorte: new SecondOrderDynamics(1.5, 0.8, 0, 0) });
    });
  }

  function redimensionar(medidas) {
    vw = window.innerWidth;
    vh = window.innerHeight;
    renderer.setPixelRatio(densidadPixeles(1.5));
    renderer.setSize(vw, vh, false);
    camara.aspect = vw / vh;
    camara.position.set(0, 0, vh / 2 / Math.tan((FOV * Math.PI) / 360));
    camara.near = 10;
    camara.far = camara.position.z * 4;
    camara.updateProjectionMatrix();
    construir(medidas);
  }

  function showPara(tabla, objetivo) {
    // primer t en que la curva alcanza `objetivo`
    let a = 0;
    let b = tabla.length - 1;
    if (objetivo <= tabla[0]) return 0;
    if (objetivo >= tabla[b]) return 1;
    while (b - a > 1) {
      const m = (a + b) >> 1;
      if (tabla[m] >= objetivo) b = m;
      else a = m;
    }
    const f = (objetivo - tabla[a]) / Math.max(1e-6, tabla[b] - tabla[a]);
    return (a + f) / (tabla.length - 1);
  }

  // Un cuadro: `y` = scroll (suavizado por Lenis), `fuerza` = 0..2.
  function cuadro(dt, y, fuerza, primero = false) {
    tiempo += dt;
    grupo.position.y = y + vh / 2;
    let alguna = false;
    const punta = y + vh * 0.56;
    lineas.forEach((l) => {
      const visible = l.yMax > y - 40 && l.yMin < y + vh + 40;
      const objetivo = showPara(l.tabla, punta);
      const s = primero ? (l.resorte.fijar(objetivo), objetivo) : l.resorte.actualizar(dt, objetivo);
      const u = l.malla.material.uniforms;
      u.u_show.value = limitar(s, 0, 1);
      u.u_strength.value = fuerza;
      u.u_time.value = tiempo;
      l.malla.visible = visible && u.u_show.value > 0.0005;
      if (l.malla.visible) alguna = true;
    });
    if (alguna || pintado) {
      renderer.render(escena, camara);
      pintado = alguna;
    }
    return alguna;
  }

  return {
    redimensionar,
    cuadro,
    destruir() {
      limpiar();
      renderer.dispose();
    },
  };
}
