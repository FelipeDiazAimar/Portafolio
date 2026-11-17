// Escena WebGL del reel de hitos: un solo canvas transparente, una malla curva por portada y un
// único bucle de animación (el ticker de GSAP, que es un solo requestAnimationFrame compartido
// con el resto de las animaciones de la sección).
//
// No usa React: la crea y la destruye ReelHitos.jsx, que le pasa el objetivo de fase (scroll),
// las texturas de las portadas y el tema. Todo `three` vive en este chunk.
import * as THREE from 'three';
import { gsap } from 'gsap';
import {
  ALTO_PLANO,
  ANCHO_PLANO,
  BEND_BASE,
  CAMARA,
  DT_MAX,
  ONDULACION,
  SEGMENTOS,
  amortiguar,
  bendDe,
  dentroDeCuadrilatero,
  inclinacionDe,
  DESFASE_Z,
  limitar,
  medidasPista,
  poseDe,
  relativoDe,
  vistaEn,
} from '@/lib/reel/geometria.js';

// La malla es más grande que la portada: el margen lleva su sombra (un solo dibujo por portada).
const MARGEN = 0.42;
const ANCHO_MALLA = ANCHO_PLANO + MARGEN * 2;
const ALTO_MALLA = ALTO_PLANO + MARGEN * 2;
const RADIO_ESQUINA = 0.06;
// La pista entera gira un poco: la portada de la izquierda queda más lejos y más de canto, la de
// la derecha más cerca y abierta (profundidad de cine, no un carrusel simétrico).
const GIRO_PISTA = -0.06;

const VERTICES = /* glsl */ `
  uniform float uBend;
  uniform float uTiempo;
  uniform float uOnda;
  uniform float uSemilla;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vVista;

  void main() {
    vUv = uv;
    // Curvado cilíndrico: la portada es un tramo de cilindro, convexo hacia quien mira.
    float mitad = ${(ANCHO_PLANO / 2).toFixed(4)};
    float angulo = (position.x / mitad) * uBend;
    float radio = mitad / uBend;
    vec3 p = position;
    p.x = sin(angulo) * radio;
    p.z += (cos(angulo) - 1.0) * radio;
    p.y += uOnda * sin(uTiempo * 0.9 + position.x * 2.4 + uSemilla);
    vNormal = normalize(normalMatrix * vec3(sin(angulo), 0.0, cos(angulo)));
    vec4 enVista = modelViewMatrix * vec4(p, 1.0);
    vVista = -enVista.xyz;
    gl_Position = projectionMatrix * enVista;
  }
`;

const FRAGMENTOS = /* glsl */ `
  uniform sampler2D uMapa;
  uniform float uConMapa;
  uniform float uOpacidad;
  uniform float uNiebla;
  uniform float uBrillo;
  uniform float uFuerzaBrillo;
  uniform float uSombra;
  uniform float uBorde;
  uniform vec3 uColorBorde;
  uniform vec3 uColorSombra;
  uniform vec3 uFondo;
  uniform vec3 uPapel;
  // Foto del hito que se abre hasta ocupar la portada, y su video encima.
  uniform sampler2D uMedio;
  uniform sampler2D uVideo;
  uniform float uConFoto;
  uniform float uMezclaVideo;
  uniform float uAbre;
  uniform vec4 uRectFoto;
  uniform float uRadioFoto;
  uniform float uAspFoto;
  uniform float uAspVideo;
  uniform vec2 uFoco;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vVista;

  const vec2 MALLA = vec2(${ANCHO_MALLA.toFixed(4)}, ${ALTO_MALLA.toFixed(4)});
  const vec2 PORTADA = vec2(${ANCHO_PLANO.toFixed(4)}, ${ALTO_PLANO.toFixed(4)});
  const float RADIO = ${RADIO_ESQUINA.toFixed(4)};

  // Distancia con signo a un rectángulo de esquinas redondeadas.
  float cajaRedonda(vec2 p, vec2 mitad, float r) {
    vec2 q = abs(p) - mitad + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  // Coordenadas de una imagen de proporción ma para que cubra un recuadro de proporción ra
  // (como object-fit: cover), anclada en foco. l y foco se miden desde arriba a la izquierda.
  vec2 encuadre(vec2 l, float ra, float ma, vec2 foco) {
    vec2 s = ma > ra ? vec2(ra / ma, 1.0) : vec2(1.0, ma / ra);
    vec2 uv = s * 0.5 + (1.0 - s) * foco + (l - 0.5) * s;
    return vec2(uv.x, 1.0 - uv.y);
  }

  void main() {
    vec2 p = (vUv - 0.5) * MALLA;
    float d = cajaRedonda(p, PORTADA * 0.5, RADIO);
    float aa = max(fwidth(d), 0.0005);
    float dentro = 1.0 - smoothstep(-aa, aa, d);

    // Sombra: la misma caja, corrida hacia abajo y difuminada en el margen de la malla.
    float ds = cajaRedonda(p - vec2(0.0, -0.085), PORTADA * 0.5 - 0.03, RADIO);
    float sombra = (1.0 - smoothstep(-0.05, ${(MARGEN * 0.82).toFixed(3)}, ds)) * uSombra;
    sombra *= sombra;

    vec2 uvPortada = p / PORTADA + 0.5;
    vec3 color = mix(uPapel, texture2D(uMapa, uvPortada).rgb, uConMapa);
    if (uAbre > 0.001) {
      // el recuadro va de la foto (uAbre = 0) a la portada entera (uAbre = 1)
      vec2 q = vec2(uvPortada.x, 1.0 - uvPortada.y);
      vec4 r = mix(uRectFoto, vec4(0.0, 0.0, 1.0, 1.0), uAbre);
      vec2 tam = r.zw - r.xy;
      vec2 l = (q - r.xy) / tam;
      float dm = cajaRedonda((q - (r.xy + r.zw) * 0.5) * PORTADA, tam * PORTADA * 0.5, mix(uRadioFoto, RADIO, uAbre));
      float ra = (tam.x * PORTADA.x) / (tam.y * PORTADA.y);
      vec3 medio = mix(vec3(0.02), texture2D(uMedio, encuadre(l, ra, uAspFoto, uFoco)).rgb, uConFoto);
      medio = mix(medio, texture2D(uVideo, encuadre(l, ra, uAspVideo, vec2(0.5))).rgb, uMezclaVideo);
      color = mix(color, medio, (1.0 - smoothstep(-aa, aa, dm)) * smoothstep(0.0, 0.06, uAbre));
    }

    // La curvatura se nota: el canto que se aleja se apaga un poco.
    float frente = clamp(dot(normalize(vNormal), normalize(vVista)), 0.0, 1.0);
    color *= mix(0.84, 1.0, smoothstep(0.25, 0.97, frente));
    // Destello angosto que cruza la superficie cuando la portada pasa por el frente.
    // (x·x y no pow(x, 2.0): con base negativa pow no está definido y dejaba una franja ancha)
    float corrida = (uvPortada.x - uBrillo + (uvPortada.y - 0.5) * 0.28) / 0.1;
    float banda = exp(-corrida * corrida);
    color += banda * uFuerzaBrillo;
    // Las portadas lejanas se funden con el escenario (profundidad).
    color = mix(color, uFondo, uNiebla);
    // Filo interior: separa la portada del fondo sin dibujarle un borde duro.
    float filo = 1.0 - smoothstep(0.0, aa * 1.6, abs(d + aa * 1.4));
    color = mix(color, uColorBorde, filo * uBorde);

    float alfa = max(dentro, sombra * (1.0 - dentro));
    vec3 salida = mix(uColorSombra, color, dentro);
    if (alfa * uOpacidad < 0.003) discard;
    gl_FragColor = vec4(salida, alfa * uOpacidad);
    #include <colorspace_fragment>
  }
`;

const COLORES = {
  oscuro: { fondo: '#0b0d12', papel: '#11141b', borde: '#ffffff', fuerzaBorde: 0.16, sombra: '#000000', fuerzaSombra: 0.62, brillo: 0.05 },
  claro: { fondo: '#f5f6f8', papel: '#fbfaf6', borde: '#0b0d12', fuerzaBorde: 0.1, sombra: '#1b2740', fuerzaSombra: 0.4, brillo: 0.07 },
};

export function crearEscenaReel({ lienzo, total, reducido = false, alCuadro = null, alFallar = null }) {
  const renderizador = new THREE.WebGLRenderer({ canvas: lienzo, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderizador.setClearColor(0x000000, 0);
  renderizador.outputColorSpace = THREE.SRGBColorSpace;
  const anisotropia = Math.min(8, renderizador.capabilities.getMaxAnisotropy());

  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(CAMARA.fov, 1, CAMARA.cerca, CAMARA.lejos);
  camara.position.set(0, 0, CAMARA.z);
  const pista = new THREE.Group();
  escena.add(pista);

  const geometria = new THREE.PlaneGeometry(ANCHO_MALLA, ALTO_MALLA, SEGMENTOS[0], SEGMENTOS[1]);
  const fondo = new THREE.Color();
  const papel = new THREE.Color();
  const colorBorde = new THREE.Color();
  const colorSombra = new THREE.Color();
  const comunes = {
    uTiempo: { value: 0 },
    uBend: { value: BEND_BASE },
    uOnda: { value: reducido ? 0 : ONDULACION },
    uFondo: { value: fondo },
    uPapel: { value: papel },
    uColorBorde: { value: colorBorde },
    uColorSombra: { value: colorSombra },
    uBorde: { value: 0.1 },
    uSombra: { value: 0.4 },
    uFuerzaBrillo: { value: 0.05 },
  };

  const portadas = Array.from({ length: total }, (_, indice) => {
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTICES,
      fragmentShader: FRAGMENTOS,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        ...comunes,
        uMapa: { value: null },
        uConMapa: { value: 0 },
        uOpacidad: { value: 0 },
        uNiebla: { value: 0 },
        uBrillo: { value: -1 },
        uSemilla: { value: indice * 1.7 },
        uMedio: { value: null },
        uVideo: { value: null },
        uConFoto: { value: 0 },
        uMezclaVideo: { value: 0 },
        uAbre: { value: 0 },
        uRectFoto: { value: new THREE.Vector4(0, 0, 1, 1) },
        uRadioFoto: { value: 0.03 },
        uAspFoto: { value: 1.5 },
        uAspVideo: { value: 1.78 },
        uFoco: { value: new THREE.Vector2(0.5, 0.5) },
      },
    });
    const malla = new THREE.Mesh(geometria, material);
    malla.frustumCulled = false; // los vértices se mueven en el shader
    malla.visible = false;
    pista.add(malla);
    return { malla, material, entrada: { t: 0 } };
  });

  let medidas = medidasPista(1280, 720, false);
  let tamano = { ancho: 1280, alto: 720 };
  // Zoom a una portada (detalle): cuál y cuánto (0–1, lo anima GSAP), y hasta qué tamaño crece.
  const detalle = { indice: -1, t: 0 };
  let zoomDetalle = 1.6;
  // Salida hacia Proyectos (0–1): la cámara entra por la puerta de la última portada. La puerta
  // va al centro de la pantalla y la portada crece hasta que el vano la cubre entera.
  let salida = 0;
  const puerta = { x: 0, y: 0, mitadAncho: 0.05 };
  let pxPorUnidad = 100;
  // foto/video abierto sobre una portada (-1 = ninguno)
  const medio = { indice: -1, video: null, textura: null };
  const punto = new THREE.Vector3();
  let movil = false;
  let objetivo = 0;
  let fase = 0;
  let velocidad = 0;
  let ultimo = null; // marca de tiempo del cuadro anterior (null = recién reanudado)
  let activo = false;
  let destruido = false;
  const puntero = { x: 0, y: 0, sx: 0, sy: 0 };

  function ponerTema(claro) {
    const c = claro ? COLORES.claro : COLORES.oscuro;
    fondo.set(c.fondo);
    papel.set(c.papel);
    colorBorde.set(c.borde);
    colorSombra.set(c.sombra);
    comunes.uBorde.value = c.fuerzaBorde;
    comunes.uSombra.value = c.fuerzaSombra;
    comunes.uFuerzaBrillo.value = reducido ? 0 : c.brillo;
    dibujar();
  }

  function redimensionar(ancho, alto, esMovil) {
    if (destruido || ancho < 2 || alto < 2) return;
    movil = esMovil;
    tamano = { ancho, alto };
    medidas = medidasPista(ancho, alto, esMovil);
    // el zoom lleva la portada al 70 % del ancho (94 % en celular), sin pasarse del 74 % del alto
    const vista = vistaEn(medidas.profundidad - DESFASE_Z, ancho / alto);
    pxPorUnidad = ancho / vista.ancho;
    zoomDetalle = Math.max(1.1, Math.min((ancho * (esMovil ? 0.94 : 0.7)) / (ANCHO_PLANO * medidas.escala * pxPorUnidad), (alto * 0.74) / (ALTO_PLANO * medidas.escala * pxPorUnidad)));
    renderizador.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderizador.setSize(ancho, alto, false);
    camara.aspect = ancho / alto;
    camara.updateProjectionMatrix();
    dibujar();
  }

  // Textura de una portada (un canvas ya compuesto). La anterior se libera.
  function ponerTextura(indice, fuente) {
    const portada = portadas[indice];
    if (!portada || destruido) return;
    portada.material.uniforms.uMapa.value?.dispose();
    const textura = new THREE.CanvasTexture(fuente);
    textura.colorSpace = THREE.SRGBColorSpace;
    textura.anisotropy = anisotropia;
    textura.generateMipmaps = true;
    textura.minFilter = THREE.LinearMipmapLinearFilter;
    portada.material.uniforms.uMapa.value = textura;
    portada.material.uniforms.uConMapa.value = 1;
    dibujar();
  }

  function acomodar() {
    const { escala, radio, profundidad, paso } = medidas;
    // En celular la cinta sube: abajo va el texto del hito.
    pista.position.y = movil ? escala * 0.62 : escala * -0.04;
    pista.rotation.y = GIRO_PISTA * (movil ? 0.45 : 1) + (reducido ? 0 : puntero.sx * 0.03);
    pista.rotation.x = reducido ? 0 : puntero.sy * -0.018;
    const inclinacion = reducido ? 0 : inclinacionDe(velocidad);
    // al entrar por la puerta la portada se aplana: de cerca, la curva la deformaría
    comunes.uBend.value = (reducido ? BEND_BASE : bendDe(velocidad)) * (1 - Math.min(1, salida * 2.2) * 0.94);
    // cuánto crece al final: lo necesario para que el vano tape la pantalla
    const tope = (1.25 * tamano.ancho) / 2 / Math.max(1, puerta.mitadAncho * escala * pxPorUnidad);
    const crece = Math.exp(Math.log(Math.max(1.01, tope)) * salida);
    const haciaCentro = salida * salida * (3 - 2 * salida);

    for (let i = 0; i < total; i++) {
      const { malla, material, entrada } = portadas[i];
      const rel = relativoDe(i, fase, total);
      const pose = poseDe(rel, { radio, profundidad, paso });
      const lejos = Math.abs(rel);
      // Se desvanecen las que quedan de canto, antes de darse vuelta.
      // En detalle, la portada elegida crece y se centra, y las demás se apagan. En la salida, la
      // última crece desde su puerta (que queda quieta en pantalla) y las demás se apagan.
      const enDetalle = i === detalle.indice ? detalle.t : 0;
      const apagada = detalle.indice >= 0 && i !== detalle.indice ? detalle.t : 0;
      const ultima = i === total - 1;
      const mult = ultima ? crece : 1;
      const opacidad = (1 - limitar((lejos - 1.25) / 0.7, 0, 1)) * entrada.t * (1 - apagada) * (ultima ? 1 : 1 - salida);
      malla.visible = pose.deFrente && opacidad > 0.004;
      if (!malla.visible) continue;
      const asoma = 1 - entrada.t;
      const centroY = -pista.position.y + escala * (movil ? 0.3 : 0.02);
      let px = pose.x * (1 - enDetalle);
      let py = (pose.y - asoma * escala * 0.9) * (1 - enDetalle) + centroY * enDetalle;
      if (ultima && salida > 0) {
        // la puerta viaja al centro de la pantalla, y la portada crece alrededor de ella
        const puertaX = px + puerta.x * escala;
        const puertaY = py + puerta.y * escala;
        px = puertaX + (0 - puertaX) * haciaCentro - puerta.x * escala * mult;
        py = puertaY + (-pista.position.y - puertaY) * haciaCentro - puerta.y * escala * mult;
      }
      malla.position.set(px, py, pose.z - asoma * 0.6 + enDetalle * 0.3);
      malla.rotation.set(pose.rotX + asoma * 0.32, (pose.rotY + inclinacion) * (1 - enDetalle), asoma * -0.05 * (i % 2 ? 1 : -1));
      malla.scale.setScalar(escala * (1 + (zoomDetalle - 1) * enDetalle) * mult);
      malla.renderOrder = Math.round(pose.z * 1000) + (enDetalle > 0 || mult > 1 ? 9000 : 0);
      material.uniforms.uOpacidad.value = opacidad;
      material.uniforms.uNiebla.value = limitar((lejos - 0.35) * 0.3, 0, 0.42);
      // el destello cruza mientras la portada llega desde la derecha; quieta, queda fuera
      material.uniforms.uBrillo.value = -0.35 + rel * 1.7;
    }
  }

  function dibujar() {
    if (destruido) return;
    acomodar();
    renderizador.render(escena, camara);
  }

  function cuadro() {
    if (destruido || !activo) return;
    const ahora = performance.now();
    // Recién reanudado: no se acumula el tiempo que estuvo en pausa.
    const dt = ultimo === null ? 0 : Math.min(DT_MAX, (ahora - ultimo) / 1000);
    ultimo = ahora;
    const anterior = fase;
    fase = reducido ? objetivo : amortiguar(fase, objetivo, dt);
    if (Math.abs(objetivo - fase) < 0.0004) fase = objetivo;
    const cruda = dt > 0 ? (fase - anterior) / dt : 0;
    velocidad = reducido ? 0 : velocidad + (cruda - velocidad) * (1 - Math.exp(-10 * dt));
    if (!reducido) {
      comunes.uTiempo.value += dt;
      puntero.sx += (puntero.x - puntero.sx) * (1 - Math.exp(-5 * dt));
      puntero.sy += (puntero.y - puntero.sy) * (1 - Math.exp(-5 * dt));
    }
    dibujar();
    alCuadro?.(fase, velocidad);
  }

  // Dónde cae en pantalla (px del canvas) una zona de la portada `indice`, dada en fracciones de
  // la portada: [arribaIzq, arribaDer, abajoDer, abajoIzq]. Repite la cuenta del shader de
  // vértices (curvado y ondulación), así un elemento HTML puede apoyarse justo encima.
  function esquinas(indice, { x0, y0, x1, y1 }) {
    const portada = portadas[indice];
    if (!portada?.malla.visible) return null;
    const mitad = ANCHO_PLANO / 2;
    const bend = comunes.uBend.value;
    const radio = mitad / bend;
    const semilla = portada.material.uniforms.uSemilla.value;
    return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([fx, fy]) => {
      const x = (fx - 0.5) * ANCHO_PLANO;
      const angulo = (x / mitad) * bend;
      punto.set(Math.sin(angulo) * radio, (0.5 - fy) * ALTO_PLANO + comunes.uOnda.value * Math.sin(comunes.uTiempo.value * 0.9 + x * 2.4 + semilla), (Math.cos(angulo) - 1) * radio);
      punto.applyMatrix4(portada.malla.matrixWorld).project(camara);
      return [((punto.x + 1) / 2) * tamano.ancho, ((1 - punto.y) / 2) * tamano.alto];
    });
  }

  // Qué portada hay bajo un punto del canvas (px), de adelante hacia atrás; -1 si ninguna.
  const ENTERA = { x0: 0, y0: 0, x1: 1, y1: 1 };
  function portadaEn(x, y) {
    const orden = portadas.map((_, i) => i).filter((i) => portadas[i].malla.visible).sort((a, b) => portadas[b].malla.renderOrder - portadas[a].malla.renderOrder);
    for (const i of orden) {
      const q = esquinas(i, ENTERA);
      if (q && dentroDeCuadrilatero(q, x, y)) return i;
    }
    return -1;
  }

  // Cierra la foto/video abierto: el video se funde con la foto mientras el recuadro vuelve a
  // su lugar, y recién ahí se suelta.
  function cerrarMedio(yaMismo = false) {
    const indice = medio.indice;
    if (indice < 0) return;
    const u = portadas[indice].material.uniforms;
    const { video, textura } = medio;
    medio.indice = -1;
    medio.video = null;
    medio.textura = null;
    const soltar = () => {
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
      if (textura) {
        if (u.uVideo.value === textura) u.uVideo.value = null;
        textura.dispose();
      }
    };
    gsap.killTweensOf([u.uAbre, u.uMezclaVideo]);
    if (yaMismo || reducido) {
      u.uAbre.value = 0;
      u.uMezclaVideo.value = 0;
      soltar();
      return;
    }
    gsap.to(u.uMezclaVideo, { value: 0, duration: 0.3, ease: 'power2.out' });
    gsap.to(u.uAbre, { value: 0, duration: 0.6, ease: 'power3.inOut', onComplete: soltar });
  }

  function activar(si) {
    if (destruido || si === activo) return;
    activo = si;
    // a la vista de las pruebas: si el bucle está corriendo o en pausa
    lienzo.dataset.activa = String(si);
    if (si) {
      ultimo = null;
      gsap.ticker.add(cuadro);
    } else {
      gsap.ticker.remove(cuadro);
    }
  }

  const alPerderContexto = (evento) => {
    evento.preventDefault();
    alFallar?.();
  };
  lienzo.addEventListener('webglcontextlost', alPerderContexto);

  return {
    portadas,
    ponerTema,
    redimensionar,
    ponerTextura,
    esquinas,
    portadaEn,
    // Dónde cae en pantalla un punto de una portada (fracciones de la portada); null si no se ve.
    puntoEn: (indice, fx, fy) => esquinas(indice, { x0: fx, y0: fy, x1: fx, y1: fy })?.[0] ?? null,
    // Acerca una portada (o vuelve, con -1).
    ponerDetalle(indice) {
      gsap.killTweensOf(detalle);
      if (indice >= 0) {
        detalle.indice = indice;
        gsap.to(detalle, { t: 1, duration: reducido ? 0 : 0.8, ease: 'expo.out' });
      } else if (detalle.indice >= 0) {
        gsap.to(detalle, {
          t: 0,
          duration: reducido ? 0 : 0.5,
          ease: 'power3.out',
          onComplete: () => {
            detalle.indice = -1;
          },
        });
      }
    },
    // Punto de la última portada (fracciones) desde donde crece al salir, y cuánto salió (0–1).
    // El vano de la puerta: su centro y la mitad de su ancho, en fracciones de la portada.
    ponerPuerta(fx, fy, mitadAncho) {
      puerta.x = (fx - 0.5) * ANCHO_PLANO;
      puerta.y = (0.5 - fy) * ALTO_PLANO;
      puerta.mitadAncho = mitadAncho * ANCHO_PLANO;
    },
    // ---- foto y video de una portada ----
    // Deja lista la foto de un hito (achicada: una foto de cámara entera no hace falta) y dónde
    // está su recuadro en la portada. `rect` y `foco` van en fracciones, desde arriba a la izquierda.
    ponerMedio(indice, { foto, foco = [0.5, 0.5], rect, radio }) {
      const u = portadas[indice]?.material.uniforms;
      if (!u || destruido) return;
      u.uMedio.value?.dispose();
      u.uMedio.value = null;
      u.uConFoto.value = 0;
      u.uRectFoto.value.set(rect.x0, rect.y0, rect.x1, rect.y1);
      u.uRadioFoto.value = radio * ANCHO_PLANO;
      u.uFoco.value.set(foco[0], foco[1]);
      if (!foto) return;
      const escalaFoto = Math.min(1, 1600 / foto.naturalWidth);
      const lienzoFoto = document.createElement('canvas');
      lienzoFoto.width = Math.round(foto.naturalWidth * escalaFoto);
      lienzoFoto.height = Math.round(foto.naturalHeight * escalaFoto);
      lienzoFoto.getContext('2d').drawImage(foto, 0, 0, lienzoFoto.width, lienzoFoto.height);
      const textura = new THREE.CanvasTexture(lienzoFoto);
      textura.colorSpace = THREE.SRGBColorSpace;
      textura.generateMipmaps = false;
      textura.minFilter = THREE.LinearFilter;
      u.uMedio.value = textura;
      u.uConFoto.value = 1;
      u.uAspFoto.value = lienzoFoto.width / lienzoFoto.height;
    },
    medioAbierto: () => medio.indice,
    // El video que se está viendo sobre la portada (null hasta que arranca): para sus controles.
    medioVideo: () => (medio.textura ? medio.video : null),
    // Abre la foto hasta ocupar la portada y, si hay video, lo reproduce (sin sonido). Al
    // terminar el video, la portada vuelve sola a la normalidad.
    abrirMedio(indice, urlVideo) {
      const u = portadas[indice]?.material.uniforms;
      if (!u || destruido || medio.indice === indice) return;
      if (medio.indice >= 0) cerrarMedio(true);
      medio.indice = indice;
      gsap.killTweensOf([u.uAbre, u.uMezclaVideo]);
      const reproducir = () => {
        if (!urlVideo || medio.indice !== indice) return;
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        video.src = urlVideo;
        medio.video = video;
        video.addEventListener(
          'playing',
          () => {
            if (medio.video !== video) return;
            const textura = new THREE.VideoTexture(video);
            textura.colorSpace = THREE.SRGBColorSpace;
            medio.textura = textura;
            u.uVideo.value = textura;
            u.uAspVideo.value = video.videoWidth / Math.max(1, video.videoHeight);
            gsap.to(u.uMezclaVideo, { value: 1, duration: reducido ? 0 : 0.45, ease: 'power2.out' });
          },
          { once: true }
        );
        video.addEventListener('ended', () => medio.video === video && cerrarMedio(), { once: true });
        video.addEventListener('error', () => medio.video === video && !urlVideo.endsWith('#') && (medio.video = null), { once: true });
        video.play().catch(() => {});
      };
      gsap.to(u.uAbre, { value: 1, duration: reducido ? 0 : 0.75, ease: 'expo.out', onComplete: reproducir });
    },
    cerrarMedio,
    ponerSalida(valor) {
      salida = limitar(valor, 0, 1);
    },
    activar,
    dibujar,
    ponerObjetivo(valor) {
      objetivo = limitar(valor, 0, total - 1);
    },
    // Salto sin amortiguar (carga con el scroll a mitad de la sección, menú, movimiento reducido).
    saltarA(valor) {
      objetivo = limitar(valor, 0, total - 1);
      fase = objetivo;
      velocidad = 0;
      dibujar();
      alCuadro?.(fase, 0);
    },
    ponerPuntero(x, y) {
      puntero.x = limitar(x, -1, 1);
      puntero.y = limitar(y, -1, 1);
    },
    fase: () => fase,
    activa: () => activo,
    destruir() {
      if (destruido) return;
      activar(false);
      destruido = true;
      lienzo.removeEventListener('webglcontextlost', alPerderContexto);
      gsap.killTweensOf(detalle);
      cerrarMedio(true);
      for (const { material, malla, entrada } of portadas) {
        gsap.killTweensOf(entrada);
        gsap.killTweensOf([material.uniforms.uAbre, material.uniforms.uMezclaVideo]);
        material.uniforms.uMedio.value?.dispose();
        material.uniforms.uMapa.value?.dispose();
        material.dispose();
        pista.remove(malla);
      }
      geometria.dispose();
      renderizador.dispose();
    },
  };
}
