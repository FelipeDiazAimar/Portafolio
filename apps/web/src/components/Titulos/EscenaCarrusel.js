import * as THREE from "three";

// Carrusel vertical de vidrio líquido para "Títulos".
//
// Las tarjetas (fotos y tarjetas de texto con esquinas redondeadas) se apilan en una columna y se
// dibujan en un render target. Después, una pasada a pantalla completa las mira a través de un
// vidrio fijo arriba y abajo: cerca de esos bordes la imagen se corre y se tuerce como vista a
// través de un canto de vidrio grueso, con los canales separados y un filo de luz.
//
// La deformación no es una fórmula: es un mapa medido sobre la demo de referencia (1440×900, con
// tarjetas de 280 px de ancho) y guardado en /titulos/vidrio.png. Para cada píxel de la zona
// (x de 500 a 960, y de 0 a 900, a media resolución) R y G guardan el corrimiento en x e y
// (128 = 0, cada unidad vale `escalaMapa` px) y B marca el "fondo" (255, con borde suave): ahí el
// vidrio mira fuera de la columna de tarjetas. El filo de luz va donde el corrimiento salta.
// En x el mapa se escala con el ancho de la tarjeta y
// en y con el alto de la pantalla.
//
// (La versión de PC, la cinta ondulada, está en EscenaCinta.js.)
const MODOS = {
  vertical: {
    mapa: "/titulos/vidrio.png",
    escalaMapa: 1.4724,
    zona: [500, 0, 460, 900], // x, y, ancho, alto de la zona medida (px de la referencia)
    centroRef: [720, 450],
    anchoRef: 280, // ancho de la tarjeta en la referencia
    alturaRef: 900, // alto de pantalla de la referencia (para escalar y en este modo)
    extender: 0,
    croma: 0.025,
    brillo: 0.85,
  },
};
const ANCHO_TARJETA = 0.37; // vertical: ancho de la tarjeta / H
const ANCHO_MAX = 0.7; // vertical: ancho máximo de la tarjeta / ancho de pantalla
const SEPARACION = 0.0078; // vertical: espacio entre tarjetas / H
const RADIO = 0.016; // radio de las esquinas / H
const MARGEN = 0.3; // escena dibujada de más arriba y abajo de la pantalla / H (el vidrio mira hacia afuera)
const RIGIDEZ = 9; // qué tan rápido llega a la posición pedida (1/s)
const LADO_TEXTURA = 768; // ancho en píxeles de la textura de cada tarjeta

const vertice = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Tarjeta: la imagen con esquinas redondeadas; sale premultiplicada para el compuesto.
const fragmentoTarjeta = /* glsl */ `
  uniform sampler2D uMapa;
  uniform vec2 uTam;
  uniform float uRadio;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * uTam;
    vec2 q = abs(p) - (uTam * 0.5 - uRadio);
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadio;
    float a = clamp(0.5 - d, 0.0, 1.0);
    vec3 c = texture2D(uMapa, vUv).rgb;
    gl_FragColor = vec4(c * a, a);
  }
`;

const verticePantalla = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Vidrio: todo en píxeles CSS con y hacia abajo.
const fragmentoVidrio = /* glsl */ `
  uniform sampler2D uEscena;
  uniform sampler2D uVidrio;
  uniform float uHayVidrio;
  uniform vec2 uRes;
  uniform vec2 uMargen;      // px de escena de más a los costados y arriba/abajo
  uniform vec2 uEx;          // px de la referencia por px de pantalla, en x e y
  uniform vec2 uRefCentro;   // centro de pantalla en la referencia
  uniform vec4 uZona;        // zona del mapa en la referencia (x, y, ancho, alto)
  uniform float uEscalaMapa; // px de corrimiento por unidad del mapa
  uniform float uExtender;   // 1: fuera de la zona se estira el borde del mapa
  uniform float uTarjeta;    // ancho de la tarjeta (px)
  uniform vec3 uFondo;
  uniform float uCroma;      // separación de canales en el vidrio
  uniform float uBrillo;     // intensidad del filo de luz
  uniform float uEstela;     // separación de canales por velocidad (px)
  varying vec2 vUv;

  vec4 muestra(vec2 p) {
    vec2 uv = vec2((p.x + uMargen.x) / (uRes.x + 2.0 * uMargen.x), 1.0 - (p.y + uMargen.y) / (uRes.y + 2.0 * uMargen.y));
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0);
    return texture2D(uEscena, uv);
  }

  void main() {
    vec2 p = vec2(vUv.x * uRes.x, (1.0 - vUv.y) * uRes.y);

    // punto equivalente en la referencia
    vec2 r = uRefCentro + (p - uRes * 0.5) * uEx;
    vec2 t = (r - uZona.xy) / uZona.zw;
    if (uExtender > 0.5) t = clamp(t, vec2(0.002), vec2(0.998));

    vec2 desp = vec2(0.0);
    float fondo = 0.0;
    float filo = 0.0;
    if (uHayVidrio > 0.5 && t.x > 0.0 && t.x < 1.0 && t.y > 0.0 && t.y < 1.0) {
      vec2 uvV = vec2(t.x, 1.0 - t.y);
      vec4 v = texture2D(uVidrio, uvV);
      vec2 d = (v.rg * 255.0 - 128.0) * uEscalaMapa;
      desp = d / uEx;
      fondo = smoothstep(0.3, 0.7, v.b);
      // salto del corrimiento entre vecinos (en px de la referencia): ahí está el filo del vidrio
      vec2 paso = 3.0 / uZona.zw;
      vec2 a1 = texture2D(uVidrio, uvV + vec2(paso.x, 0.0)).rg - texture2D(uVidrio, uvV - vec2(paso.x, 0.0)).rg;
      vec2 a2 = texture2D(uVidrio, uvV + vec2(0.0, paso.y)).rg - texture2D(uVidrio, uvV - vec2(0.0, paso.y)).rg;
      float salto = (length(a1) + length(a2)) * 255.0 * uEscalaMapa;
      filo = smoothstep(10.0, 45.0, salto) * (1.0 - fondo);
    }

    float fuerza = clamp(length(desp) / (uTarjeta * 0.35), 0.0, 1.0);
    float croma = uCroma * fuerza;
    vec2 estela = vec2(0.0, uEstela);
    vec4 cR = muestra(p + desp * (1.0 - croma) - estela);
    vec4 cG = muestra(p + desp);
    vec4 cB = muestra(p + desp * (1.0 + croma) + estela);
    // donde el vidrio mira fuera de la columna no hay tarjeta
    cR *= 1.0 - fondo;
    cG *= 1.0 - fondo;
    cB *= 1.0 - fondo;

    // el contorno lo da sólo el canal del medio: los canales se separan adentro de la tarjeta pero el
    // borde queda nítido, sin filos de color (como en la referencia)
    vec3 base = cG.rgb / max(cG.a, 0.001);
    float rr = cR.a > 0.01 ? cR.r / cR.a : base.r;
    float bb = cB.a > 0.01 ? cB.b / cB.a : base.b;
    vec3 color = mix(uFondo, vec3(rr, base.g, bb), cG.a);

    float cobertura = cG.a;
    float brillo = filo * uBrillo * cobertura;
    vec3 tinte = vec3(0.55, 0.72, 1.0);
    color = mix(color, tinte, brillo * 0.5) + tinte * brillo * 0.2;

    gl_FragColor = vec4(color, 1.0);
  }
`;

// Parte un texto en renglones que entren en `ancho`.
function renglones(ctx, texto, ancho) {
  const palabras = texto.split(" ");
  const lineas = [];
  let actual = "";
  palabras.forEach((p) => {
    const prueba = actual ? `${actual} ${p}` : p;
    if (ctx.measureText(prueba).width > ancho && actual) {
      lineas.push(actual);
      actual = p;
    } else actual = prueba;
  });
  if (actual) lineas.push(actual);
  return lineas;
}

// Tarjeta de texto: el título grande sobre el color del título.
function dibujarTexto(ctx, ancho, alto, t, fuente) {
  const g = ctx.createLinearGradient(0, 0, ancho * 0.4, alto);
  g.addColorStop(0, t.color);
  g.addColorStop(1, t.colorFin || t.color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ancho, alto);
  const m = ancho * 0.09;
  const tinta = t.tinta || "#ffffff";
  // número grande de fondo
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = tinta;
  ctx.font = `800 ${ancho * 0.62}px ${fuente}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(t.numero, ancho + ancho * 0.04, alto * 0.5);
  ctx.restore();
  // estado y año arriba
  ctx.fillStyle = tinta;
  ctx.globalAlpha = 0.85;
  ctx.font = `700 ${ancho * 0.04}px ${fuente}`;
  ctx.textBaseline = "top";
  ctx.fillText(t.estado.toUpperCase(), m, m);
  ctx.textAlign = "right";
  ctx.fillText(t.anio.toUpperCase(), ancho - m, m);
  ctx.textAlign = "left";
  ctx.globalAlpha = 1;
  // nombre: lo más grande que entre entre la fila de arriba y el lugar
  const yLugar = alto - m - ancho * 0.1;
  const disponible = yLugar - ancho * 0.07 - (m + ancho * 0.09);
  let tam = ancho * 0.115;
  let lineas;
  for (;;) {
    ctx.font = `800 ${tam}px ${fuente}`;
    lineas = renglones(ctx, t.nombre.toUpperCase(), ancho - 2 * m);
    // que entre a lo alto y que ninguna palabra larga se salga a lo ancho
    const cabe =
      lineas.length * tam * 1.02 <= disponible &&
      lineas.every((l) => ctx.measureText(l).width <= ancho - 2 * m);
    if (cabe || tam < ancho * 0.05) break;
    tam *= 0.92;
  }
  const interlineado = tam * 1.02;
  let y = yLugar - ancho * 0.07 - lineas.length * interlineado;
  ctx.textBaseline = "top";
  lineas.forEach((l) => {
    ctx.fillText(l, m, y);
    y += interlineado;
  });
  // raya y lugar
  ctx.globalAlpha = 0.5;
  ctx.fillRect(
    m,
    yLugar - ancho * 0.035,
    ancho * 0.12,
    Math.max(2, ancho * 0.005),
  );
  ctx.globalAlpha = 0.85;
  ctx.font = `500 ${ancho * 0.037}px ${fuente}`;
  renglones(ctx, t.lugar, ancho - 2 * m)
    .slice(0, 2)
    .forEach((l, i) => ctx.fillText(l, m, yLugar + i * ancho * 0.048));
  ctx.globalAlpha = 1;
}

// Arma la textura de una tarjeta: foto recortada tipo "cover" (o "contain" sobre un fondo) o texto.
export function texturaTarjeta(imagen, t, fuente) {
  const ancho = LADO_TEXTURA;
  const alto = Math.round(ancho / t.aspecto);
  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext("2d");
  if (t.tipo === "texto") {
    dibujarTexto(ctx, ancho, alto, t, fuente);
  } else {
    ctx.fillStyle = t.fondo || "#1a1d24";
    ctx.fillRect(0, 0, ancho, alto);
    if (imagen) {
      const foco = t.foco || [0.5, 0.5];
      const ri = imagen.naturalWidth / imagen.naturalHeight;
      let w;
      let h;
      if (t.ajuste === "contain" ? ri < t.aspecto : ri > t.aspecto) {
        h = alto;
        w = h * ri;
      } else {
        w = ancho;
        h = w / ri;
      }
      if (t.ajuste === "contain") {
        w *= 0.72;
        h *= 0.72;
      }
      ctx.drawImage(imagen, (ancho - w) * foco[0], (alto - h) * foco[1], w, h);
    }
  }
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.NoColorSpace;
  textura.generateMipmaps = true;
  textura.minFilter = THREE.LinearMipmapLinearFilter;
  textura.anisotropy = 4;
  return textura;
}

export function cargarImagen(src) {
  return new Promise((resolver) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolver(img);
    img.onerror = () => resolver(null);
    img.src = src;
  });
}

export const modulo = (a, n) => ((a % n) + n) % n;

/**
 * @param {object} o
 * @param {HTMLCanvasElement} o.lienzo
 * @param {Array<object>} o.tarjetas  fotos ({imagen, aspecto, foco?, ajuste?, fondo?}) o textos
 *   ({tipo: 'texto', aspecto, nombre, lugar, estado, anio, numero, color, colorFin?, tinta?})
 * @param {string} [o.fuente]  familia tipográfica para las tarjetas de texto
 * @param {(indice: number) => void} [o.alCambiar]  se llama cuando cambia la tarjeta del centro
 * @param {() => void} [o.alPerder]  se llama si se pierde el contexto WebGL
 */
export function crearEscenaCarrusel({
  lienzo,
  tarjetas,
  modo = "vertical",
  fuente = "sans-serif",
  alCambiar = () => {},
  alPerder = () => {},
}) {
  const total = tarjetas.length;
  const M = MODOS[modo];
  const tarjetasModo = tarjetas;
  const renderer = new THREE.WebGLRenderer({
    canvas: lienzo,
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  const escena = new THREE.Scene();
  const camara = new THREE.OrthographicCamera(0, 1, 0, -1, -10, 10);
  const objetivo = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });

  let destruida = false;
  const texturas = tarjetasModo.map((t) => texturaTarjeta(null, t, fuente));
  tarjetasModo.forEach((t, i) => {
    const listo =
      t.tipo === "texto"
        ? (document.fonts?.ready ?? Promise.resolve())
        : cargarImagen(t.imagen);
    listo.then((img) => {
      if (destruida) return;
      texturas[i].dispose();
      texturas[i] = texturaTarjeta(t.tipo === "texto" ? null : img, t, fuente);
      pedirCuadro(true);
    });
  });

  // ranuras: cada una dibuja la tarjeta que le toque según la posición
  const geometria = new THREE.PlaneGeometry(1, 1);
  const RANURAS = 9;
  const ranuras = Array.from({ length: RANURAS }, () => {
    const material = new THREE.ShaderMaterial({
      vertexShader: vertice,
      fragmentShader: fragmentoTarjeta,
      uniforms: {
        uMapa: { value: null },
        uTam: { value: new THREE.Vector2(1, 1) },
        uRadio: { value: 10 },
      },
      blending: THREE.NoBlending,
      depthTest: false,
      depthWrite: false,
    });
    const malla = new THREE.Mesh(geometria, material);
    malla.frustumCulled = false;
    escena.add(malla);
    return malla;
  });

  const uniformes = {
    uEscena: { value: objetivo.texture },
    uVidrio: { value: null },
    uHayVidrio: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uMargen: { value: new THREE.Vector2() },
    uEx: { value: new THREE.Vector2(1, 1) },
    uRefCentro: { value: new THREE.Vector2(...M.centroRef) },
    uZona: { value: new THREE.Vector4(...M.zona) },
    uEscalaMapa: { value: M.escalaMapa },
    uExtender: { value: M.extender },
    uTarjeta: { value: 280 },
    uFondo: { value: new THREE.Vector3(1, 1, 1) },
    uCroma: { value: M.croma },
    uBrillo: { value: M.brillo },
    uEstela: { value: 0 },
  };
  const pantalla = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      vertexShader: verticePantalla,
      fragmentShader: fragmentoVidrio,
      uniforms: uniformes,
      depthTest: false,
      depthWrite: false,
    }),
  );
  pantalla.frustumCulled = false;
  const escenaPantalla = new THREE.Scene();
  escenaPantalla.add(pantalla);
  const camaraPantalla = new THREE.Camera();

  const usarMapa = (tex) => {
    if (destruida) {
      tex.dispose();
      return;
    }
    tex.colorSpace = THREE.NoColorSpace;
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    uniformes.uVidrio.value = tex;
    uniformes.uHayVidrio.value = 1;
    pedirCuadro(true);
  };
  new THREE.TextureLoader().load(M.mapa, usarMapa);

  let W = 1;
  let H = 1;
  let posicion = 0; // tarjeta del centro, continua (crece hacia la siguiente)
  let destino = 0;
  let velocidad = 0;
  let indiceAvisado = -1;
  let oculta = -1; // tarjeta abierta en el diploma: no se dibuja
  let ultimas = []; // lo último ubicado, para saber qué tarjeta se tocó
  let corriendo = false;
  let pedido = 0;
  let ultimo = 0;
  let sucio = true;

  const anchoTarjeta = () => Math.min(ANCHO_TARJETA * H, ANCHO_MAX * W);
  const altoDe = (i) => anchoTarjeta() / tarjetasModo[modulo(i, total)].aspecto;
  // distancia entre los centros de la tarjeta i y la i+1
  const paso = (i, sep) => altoDe(i) / 2 + sep + altoDe(i + 1) / 2;

  function ubicar() {
    const rapidez = Math.min(1, Math.abs(velocidad) / 5);
    const escala = 1 - 0.05 * rapidez;
    const sep = SEPARACION * H + 22 * rapidez;
    const base = Math.floor(posicion);
    const f = posicion - base;
    // la siguiente tarjeta está arriba: al avanzar, la columna baja
    const yBase = H / 2 + f * paso(base, sep);
    const mitad = (RANURAS - 1) / 2;
    const centros = new Map([[0, yBase]]);
    for (let k = 1; k <= mitad; k++) {
      centros.set(k, centros.get(k - 1) - paso(base + k - 1, sep));
      centros.set(-k, centros.get(-k + 1) + paso(base - k, sep));
    }
    const w = anchoTarjeta();
    ultimas = [];
    ranuras.forEach((malla, s) => {
      const k = s - mitad;
      const i = base + k;
      const h = altoDe(i);
      const y = centros.get(k);
      malla.position.set(W / 2, -y, 0);
      malla.scale.set(w * escala, h * escala, 1);
      const u = malla.material.uniforms;
      u.uMapa.value = texturas[modulo(i, total)];
      u.uTam.value.set(w * escala, h * escala);
      u.uRadio.value = RADIO * H * escala;
      malla.visible =
        modulo(i, total) !== oculta &&
        y + h / 2 > -H * MARGEN &&
        y - h / 2 < H * (1 + MARGEN);
      ultimas.push({
        indice: modulo(i, total),
        x: W / 2,
        y,
        ancho: w * escala,
        alto: h * escala,
      });
    });
    const actual = modulo(Math.round(posicion), total);
    if (actual !== indiceAvisado) {
      indiceAvisado = actual;
      alCambiar(actual);
    }
  }

  function dibujar() {
    sucio = false;
    ubicar();
    uniformes.uEstela.value = Math.max(-2, Math.min(2, velocidad * 0.4));
    renderer.setRenderTarget(objetivo);
    renderer.clear();
    renderer.render(escena, camara);
    renderer.setRenderTarget(null);
    renderer.render(escenaPantalla, camaraPantalla);
  }

  function cuadro(ahora) {
    pedido = 0;
    const dt = Math.min(0.05, ultimo ? (ahora - ultimo) / 1000 : 1 / 60);
    ultimo = ahora;
    const antes = posicion;
    posicion += (destino - posicion) * (1 - Math.exp(-RIGIDEZ * dt));
    if (Math.abs(destino - posicion) < 1e-4) posicion = destino;
    const v = dt > 0 ? (posicion - antes) / dt : 0;
    velocidad += (v - velocidad) * Math.min(1, dt * 18);
    dibujar();
    if (posicion === destino && Math.abs(velocidad) < 0.01) {
      velocidad = 0;
      ultimo = 0;
      dibujar();
    } else if (corriendo) pedido = requestAnimationFrame(cuadro);
  }

  function pedirCuadro(forzar = false) {
    if (forzar) sucio = true;
    if (!corriendo || pedido) return;
    pedido = requestAnimationFrame(cuadro);
  }

  function tamano(ancho, alto) {
    W = Math.max(1, ancho);
    H = Math.max(1, alto);
    renderer.setSize(W, H, false);
    const pr = renderer.getPixelRatio();
    const margen = MARGEN * H;
    const margenX = 0;
    objetivo.setSize(
      Math.round((W + 2 * margenX) * pr),
      Math.round((H + 2 * margen) * pr),
    );
    camara.left = -margenX;
    camara.right = W + margenX;
    camara.top = margen;
    camara.bottom = -H - margen;
    camara.updateProjectionMatrix();
    uniformes.uRes.value.set(W, H);
    uniformes.uMargen.value.set(margenX, margen);
    const wt = anchoTarjeta();
    uniformes.uTarjeta.value = wt;
    uniformes.uEx.value.set(M.anchoRef / wt, M.alturaRef / H);
    if (corriendo) dibujar();
    else sucio = true;
  }

  function fijarFondo(r, g, b) {
    uniformes.uFondo.value.set(r, g, b);
    if (corriendo) dibujar();
    else sucio = true;
  }

  // `p` es continua: el scroll de la página la va llevando
  function seguir(p) {
    destino = p;
    pedirCuadro();
  }

  function arrancar() {
    if (corriendo) return;
    corriendo = true;
    ultimo = 0;
    if (sucio || posicion !== destino) dibujar();
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
    // para las pruebas: salta a una posición sin animar
    fijar(p) {
      posicion = p;
      destino = p;
      velocidad = 0;
      dibujar();
    },
    // la tarjeta bajo el punto (px del lienzo); fuera del centro el vidrio la corre un poco
    tarjetaEn(x, y) {
      return (
        ultimas.find(
          (d) =>
            Math.abs(x - d.x) <= d.ancho / 2 && Math.abs(y - d.y) <= d.alto / 2,
        ) ?? null
      );
    },
    ocultar(i) {
      oculta = i ?? -1;
      if (corriendo) dibujar();
      else sucio = true;
    },
    estado: () => ({
      posicion,
      destino,
      indice: modulo(Math.round(destino), total),
      vidrio: uniformes.uHayVidrio.value,
    }),
    destruir() {
      destruida = true;
      frenar();
      lienzo.removeEventListener("webglcontextlost", alPerderContexto);
      texturas.forEach((t) => t.dispose());
      uniformes.uVidrio.value?.dispose();
      geometria.dispose();
      ranuras.forEach((m) => m.material.dispose());
      pantalla.geometry.dispose();
      pantalla.material.dispose();
      objetivo.dispose();
      renderer.dispose();
    },
  };
}
