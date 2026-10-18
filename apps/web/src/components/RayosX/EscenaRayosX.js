import { GaussianBlurPass } from 'postprocessing';
import {
  CanvasTexture,
  Color,
  DoubleSide,
  HalfFloatType,
  InstancedMesh,
  LinearFilter,
  Matrix4,
  Mesh,
  NoBlending,
  Object3D,
  OrthographicCamera,
  Quaternion,
  Raycaster,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { amortiguar } from '@/lib/xilofono.js';
import { encuadreRetrato, grillaHexagonal, suave } from '@/lib/rayosx.js';
import { COLORES, FONDO, MATERIAL, MODELOS, RETRATO, TEMA_CLARO_RAYOSX } from './config.js';
import { composicionFrag, cuadroVert, mascaraFrag, rayosFrag, rayosVert } from './shaders.js';

const MAX_DT = 1 / 20;

// Los modelos vienen con normales por cara (se ven facetados, "cuadrados"). Se sueldan los vértices
// repetidos y se recalculan normales suaves: el brillo de borde (fresnel) pasa a ser redondo.
// Sólo hace falta la posición (el material no usa uvs).
function suavizarGeometria(geometria) {
  const base = geometria.clone();
  Object.keys(base.attributes).forEach((nombre) => {
    if (nombre !== 'position') base.deleteAttribute(nombre);
  });
  const soldada = mergeVertices(base, 1e-4);
  soldada.computeVertexNormals();
  base.dispose();
  return soldada;
}

// '#rrggbb' o 'rgb(r, g, b)' → [r, g, b] en 0..1 (sRGB, sin convertir).
function colorCss(texto) {
  const t = String(texto).trim();
  const hex = t.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split('').map((c) => c + c).join('') : hex[1];
    const n = parseInt(h, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const rgb = t.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/i);
  return rgb ? [rgb[1] / 255, rgb[2] / 255, rgb[3] / 255] : null;
}

// Carga compartida de los dos modelos (Draco, decodificador local en /public/draco/).
let modelosCargados = null;
function cargarModelos() {
  if (!modelosCargados) {
    const draco = new DRACOLoader().setDecoderPath(MODELOS.draco);
    const cargador = new GLTFLoader().setDRACOLoader(draco);
    const geometriaDe = (url) =>
      cargador.loadAsync(url).then((gltf) => {
        let geometria = null;
        gltf.scene.traverse((hijo) => {
          if (!geometria && hijo.isMesh) geometria = hijo.geometry;
        });
        return suavizarGeometria(geometria);
      });
    modelosCargados = Promise.all([geometriaDe(MODELOS.cuerpo), geometriaDe(MODELOS.esqueleto)]).then(([cuerpo, esqueleto]) => ({ cuerpo, esqueleto }));
  }
  return modelosCargados;
}

/* ------------------------------------------------------------------------ */
/*        trazo del mouse: una línea gruesa en un canvas (del original)        */
/* ------------------------------------------------------------------------ */
class TrazoMouse {
  constructor(ancho, alto, pincel) {
    this.lienzo = document.createElement('canvas');
    this.ctx = this.lienzo.getContext('2d');
    this.pincel = pincel;
    this.textura = new CanvasTexture(this.lienzo);
    this.textura.minFilter = LinearFilter;
    this.textura.magFilter = LinearFilter;
    this.textura.generateMipmaps = false;
    this.redimensionar(ancho, alto);
    this.actual = null;
    this.ultimo = null;
    this.opacidad = 0;
  }

  redimensionar(ancho, alto) {
    this.lienzo.width = Math.max(1, Math.round(ancho));
    this.lienzo.height = Math.max(1, Math.round(alto));
    this.grosor = Math.max(this.lienzo.width * this.pincel, 40);
    this.ctx.fillStyle = 'white';
    this.ctx.fillRect(0, 0, this.lienzo.width, this.lienzo.height);
    this.textura.needsUpdate = true;
  }

  // x, y en 0..1 (y desde arriba). `activo`: si el puntero está sobre la zona (si no, no pinta).
  actualizar(x, y, activo) {
    const { lienzo, ctx } = this;
    const tx = x * lienzo.width;
    const ty = y * lienzo.height;
    if (!this.actual) {
      this.actual = { x: tx, y: ty };
      this.ultimo = { x: tx, y: ty };
    }
    this.ultimo = { ...this.actual };
    this.actual.x += (tx - this.actual.x) * 0.075 * 2;
    this.actual.y += (ty - this.actual.y) * 0.075 * 2;
    const movido = Math.hypot(this.actual.x - this.ultimo.x, this.actual.y - this.ultimo.y) > 0.5;
    this.opacidad = activo && movido ? Math.min(1, this.opacidad + 0.1) : Math.max(0, this.opacidad - 0.1);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    if (this.opacidad > 0.01) {
      ctx.beginPath();
      ctx.moveTo(this.ultimo.x, this.ultimo.y);
      ctx.lineTo(this.actual.x, this.actual.y);
      ctx.lineCap = 'round';
      ctx.lineWidth = this.grosor;
      ctx.strokeStyle = `rgba(0, 0, 0, ${this.opacidad})`;
      ctx.stroke();
    }
    this.textura.needsUpdate = true;
  }

  // Salta directo a (x, y) sin trazar desde donde estaba (al entrar a la zona).
  saltar(x, y) {
    this.actual = { x: x * this.lienzo.width, y: y * this.lienzo.height };
    this.ultimo = { ...this.actual };
  }

  liberar() {
    this.textura.dispose();
  }
}

/* ------------------------------------------------------------------------ */
/*                                   motor                                   */
/* ------------------------------------------------------------------------ */
// modo 'retrato': un esqueleto de frente sobre la foto, canvas transparente, revelado persistente.
// modo 'fondo': la escena del demo de costado (cuerpos y esqueletos) a pantalla completa.
// opciones: { tema, reducido, tactil, alCuadro(dtMs),
//   entrada (sólo fondo): { x, y, alto } en px del canvas — dónde estaba tu cráneo en la foto }
export class EscenaRayosX {
  constructor(lienzo, modo, opciones = {}) {
    this.lienzo = lienzo;
    this.modo = modo;
    this.opciones = opciones;
    this.retrato = modo === 'retrato';
    this.cfg = this.retrato ? RETRATO : FONDO;
    this.reducido = Boolean(opciones.reducido);
    this.tiempo = 0;
    // compartido por el cuerpo y el esqueleto: la cabeza gira igual en los dos
    this.giroCabeza = { value: new Vector2(0, 0) };
    this.corriendo = false;
    this.raf = 0;
    this.tamano = { ancho: 0, alto: 0 };
    this.puntero = { x: 0.5, y: 0.5, adentro: false };
    this.objetivoCamara = new Vector3();
    this.miraCamara = new Vector3(...FONDO.mira);

    this.renderer = new WebGLRenderer({ canvas: lienzo, alpha: this.retrato, antialias: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    this.renderer.setClearColor(0x000000, this.retrato ? 0 : 1);
    this.renderer.outputColorSpace = SRGBColorSpace;

    // en HDR (como el original): el brillo de frente pasa de 1 y el tone mapping lo lleva a blanco azulado
    const opcionesDestino = { minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: true, type: HalfFloatType };
    this.destinoCuerpo = new WebGLRenderTarget(1, 1, opcionesDestino);
    this.destinoEsqueleto = new WebGLRenderTarget(1, 1, opcionesDestino);
    this.destinoBrillo = new WebGLRenderTarget(1, 1, { minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false, type: HalfFloatType });
    const opcionesMascara = { minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false, type: HalfFloatType };
    this.mascaras = [new WebGLRenderTarget(1, 1, opcionesMascara), new WebGLRenderTarget(1, 1, opcionesMascara)];
    // los cuerpos se ven sólo como bloom: un desenfoque grande y suave
    this.brillo = new GaussianBlurPass({ kernelSize: 35, iterations: 2, resolutionScale: 0.5 });

    this.trazo = new TrazoMouse(1, 1, this.cfg.pincel);
    this.armarPantalla();
    this.armarEscenas();
    this.aplicarTema(opciones.tema);

    this.alPerder = (e) => {
      e.preventDefault();
      this.perdido = true;
    };
    this.alRecuperar = () => {
      this.perdido = false;
    };
    lienzo.addEventListener('webglcontextlost', this.alPerder);
    lienzo.addEventListener('webglcontextrestored', this.alRecuperar);

    this.listo = this.cargar();
  }

  /* ------------------------------ pantallas ------------------------------ */
  armarPantalla() {
    const plano = new PlaneGeometry(2, 2);
    this.camaraPantalla = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.uMascara = {
      u_previo: { value: null },
      u_trazo: { value: this.trazo.textura },
      u_aspecto: { value: new Vector2(1, 1) },
      u_dispersion: { value: this.cfg.dispersion },
      u_retorno: { value: this.cfg.retorno },
    };
    this.escenaMascara = new Scene();
    this.escenaMascara.add(new Mesh(plano, new ShaderMaterial({ vertexShader: cuadroVert, fragmentShader: mascaraFrag, uniforms: this.uMascara, depthTest: false, depthWrite: false })));

    this.uComposicion = {
      u_cuerpo: { value: this.destinoCuerpo.texture },
      u_brillo: { value: this.destinoBrillo.texture },
      u_esqueleto: { value: this.destinoEsqueleto.texture },
      u_mascara: { value: null },
      u_retrato: { value: this.retrato ? 1 : 0 },
      u_revelarTodo: { value: 0 },
      u_tiempo: { value: 0 },
      u_claro: { value: 0 },
      u_resolucion: { value: new Vector2(1, 1) },
      u_tinte: { value: new Color(...COLORES.oscuro.tinte) },
      u_fondoClaro: { value: new Color(...COLORES.claro.fondo) },
      u_huesoClaro: { value: new Color(...COLORES.claro.hueso) },
      u_fuerzaBrillo: { value: FONDO.fuerzaBrillo },
      u_nitidezCuerpo: { value: FONDO.nitidezCuerpo },
      u_fondoPagina: { value: new Color(0, 0, 0) },
    };
    this.escenaComposicion = new Scene();
    this.escenaComposicion.add(
      // sin mezcla: el shader ya escribe el color premultiplicado; mezclarlo otra vez lo multiplicaba
      // dos veces por el alfa y el borde suave del revelado quedaba como una línea gris
      new Mesh(plano, new ShaderMaterial({ vertexShader: cuadroVert, fragmentShader: composicionFrag, uniforms: this.uComposicion, depthTest: false, depthWrite: false, blending: NoBlending }))
    );
  }

  armarEscenas() {
    this.escenaCuerpo = new Scene();
    this.escenaEsqueleto = new Scene();
    const material = (alturaMax) =>
      new ShaderMaterial({
        vertexShader: rayosVert,
        fragmentShader: rayosFrag,
        side: DoubleSide,
        uniforms: {
          u_nucleo: { value: new Color(...MATERIAL.nucleo) },
          u_borde: { value: new Color(...MATERIAL.borde) },
          u_emisivo: { value: MATERIAL.emisivo },
          u_alturaBase: { value: MATERIAL.alturaBase },
          u_alturaMax: { value: alturaMax },
          u_niebla: { value: new Vector2(...this.cfg.niebla) },
          u_giro: this.giroCabeza,
          u_cuello: { value: RETRATO.cuello },
        },
      });
    this.materialCuerpo = material(MATERIAL.alturaCuerpo);
    this.materialEsqueleto = material(MATERIAL.alturaEsqueleto);

    if (this.retrato) {
      // cámara ortográfica que cubre el marco: x en [-aspecto, aspecto], y en [-1, 1]
      this.camara = new OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
      this.camara.position.set(0, 0, 5);
      this.camara.lookAt(0, 0, 0);
    } else {
      this.camara = new PerspectiveCamera(FONDO.fov, 1, 0.1, 100);
      this.camara.position.set(...FONDO.posicion);
      this.camara.lookAt(this.miraCamara);
    }
  }

  async cargar() {
    let modelos;
    try {
      modelos = await cargarModelos();
    } catch (error) {
      console.error('[RayosX] no cargaron los modelos', error);
      return false;
    }
    if (this.liberado) return false;
    if (this.retrato) {
      this.modeloEsqueleto = new Mesh(modelos.esqueleto, this.materialEsqueleto);
      this.modeloEsqueleto.rotation.y = RETRATO.girarY;
      this.escenaEsqueleto.add(this.modeloEsqueleto);
      // el cuerpo (la silueta de persona con su resplandor) va con el mismo encuadre que el esqueleto:
      // es el paso intermedio antes de que se vean los huesos
      this.modeloCuerpo = new Mesh(modelos.cuerpo, this.materialCuerpo);
      this.modeloCuerpo.rotation.y = RETRATO.girarY;
      this.escenaCuerpo.add(this.modeloCuerpo);
      this.ajustarRetrato();
    } else {
      const lugares = grillaHexagonal(FONDO.cantidad, FONDO.separacion);
      this.lugares = lugares;
      const matriz = new Matrix4();
      const instanciar = (geometria, materialModelo, escena) => {
        const malla = new InstancedMesh(geometria, materialModelo, lugares.length);
        lugares.forEach((p, i) => malla.setMatrixAt(i, matriz.makeTranslation(p[0], p[1], p[2])));
        malla.instanceMatrix.needsUpdate = true;
        malla.frustumCulled = false;
        escena.add(malla);
        return malla;
      };
      this.instCuerpo = instanciar(modelos.cuerpo, this.materialCuerpo, this.escenaCuerpo);
      this.instEsqueleto = instanciar(modelos.esqueleto, this.materialEsqueleto, this.escenaEsqueleto);
      this.geometriaEsqueleto = modelos.esqueleto;
      if (this.opciones.entrada) this.prepararEntrada(this.opciones.entrada);
    }
    await this.renderer.compileAsync(this.escenaEsqueleto, this.camara).catch(() => {});
    return true;
  }

  // Posición de reposo de la cámara del fondo (con el puntero en `px`, `py` de -1 a 1).
  objetivoDeCamara(px, py) {
    const [bx, by, bz] = FONDO.posicion;
    const m = this.miraCamara;
    const zoom = FONDO.alejar * (this.tamano.ancho < 768 ? 1.2 : 1);
    return this.objetivoCamara.set(m.x + (bx - m.x) * zoom + px * FONDO.parallax[0], m.y + (by - m.y) * zoom + py * FONDO.parallax[1], m.z + (bz - m.z) * zoom);
  }

  // Entrada: tu esqueleto arranca exactamente donde estaba el cráneo en la foto (mismo lugar y
  // tamaño en pantalla, mirando a la cámara) y vuela, girando, hasta el lugar de la grilla más
  // cercano; ahí pasa a ser uno más. Mientras tanto se ven todos los esqueletos.
  prepararEntrada(e) {
    if (!this.lugares || !this.tamano.alto) {
      this.entradaPendiente = e;
      return;
    }
    const { ancho, alto } = this.tamano;
    this.camara.position.copy(this.objetivoDeCamara(0, 0));
    this.camara.lookAt(this.miraCamara);
    this.camara.updateMatrixWorld();
    const craneo = RETRATO.craneo;
    // el lugar de la grilla cuyo cráneo queda más cerca (en pantalla) del cráneo de la foto
    const v = new Vector3();
    let mejor = -1;
    let distancia = Infinity;
    this.lugares.forEach((p, i) => {
      v.set(p[0], p[1] + craneo.centroY, p[2]).project(this.camara);
      if (v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1) return;
      const d = Math.hypot((v.x * 0.5 + 0.5) * ancho - e.x, (0.5 - v.y * 0.5) * alto - e.y);
      if (d < distancia) {
        distancia = d;
        mejor = i;
      }
    });
    if (mejor === -1) return;
    const destino = this.lugares[mejor];
    const craneoDestino = new Vector3(destino[0], destino[1] + craneo.centroY, destino[2]);
    const D = this.camara.position.distanceTo(craneoDestino);
    // punto en el rayo del cráneo de la foto, a la misma distancia que el lugar de destino
    const rayo = new Raycaster();
    rayo.setFromCamera(new Vector2((e.x / ancho) * 2 - 1, 1 - (e.y / alto) * 2), this.camara);
    const centro = rayo.ray.at(D, new Vector3());
    const tan = Math.tan((this.camara.fov * Math.PI) / 360);
    const escala = (e.alto * 2 * D * tan) / (craneo.alto * alto);
    const guia = new Object3D();
    guia.position.copy(centro);
    guia.lookAt(this.camara.position); // el +z del modelo es su frente
    const q0 = guia.quaternion.clone();
    const p0 = centro.clone().sub(new Vector3(0, craneo.centroY * escala, 0).applyQuaternion(q0));
    this.protagonista = new Mesh(this.geometriaEsqueleto, this.materialEsqueleto);
    this.protagonista.frustumCulled = false;
    this.escenaEsqueleto.add(this.protagonista);
    this.entrada = { t: 0, lugar: mejor, p0, q0, s0: escala, p1: new Vector3(...destino), q1: new Quaternion(), q: new Quaternion() };
    // el lugar de destino queda vacío hasta que llega
    this.instEsqueleto.setMatrixAt(mejor, new Matrix4().makeScale(0, 0, 0));
    this.instEsqueleto.instanceMatrix.needsUpdate = true;
    this.uComposicion.u_revelarTodo.value = 1;
    this.avanzarEntrada(0);
  }

  avanzarEntrada(dt) {
    const en = this.entrada;
    en.t = Math.min(1, en.t + dt / FONDO.duracionEntrada);
    // arranca suave, cruza rápido y se asienta
    const k = en.t < 0.5 ? 4 * en.t ** 3 : 1 - (-2 * en.t + 2) ** 3 / 2;
    const p = this.protagonista;
    p.position.lerpVectors(en.p0, en.p1, k);
    // un arco: sube un poco a mitad de camino
    p.position.y += Math.sin(Math.PI * k) * 0.12;
    p.quaternion.slerpQuaternions(en.q0, en.q1, suave(k * 1.15));
    p.scale.setScalar(en.s0 + (1 - en.s0) * k);
    if (en.t >= 1) {
      const destino = this.lugares[en.lugar];
      this.instEsqueleto.setMatrixAt(en.lugar, new Matrix4().makeTranslation(destino[0], destino[1], destino[2]));
      this.instEsqueleto.instanceMatrix.needsUpdate = true;
      this.escenaEsqueleto.remove(p);
      this.protagonista = null;
      this.entrada = null;
    }
  }

  // El esqueleto del retrato, con la cabeza sobre la cara de la foto.
  ajustarRetrato() {
    if (!this.modeloEsqueleto || !this.tamano.alto) return;
    const aspecto = this.tamano.ancho / this.tamano.alto;
    const { escala, x, y } = encuadreRetrato(RETRATO.calibracion, aspecto, RETRATO.craneo);
    [this.modeloEsqueleto, this.modeloCuerpo].forEach((modelo) => {
      if (!modelo) return;
      modelo.scale.setScalar(escala);
      modelo.position.set(x, y, 0);
    });
    // la niebla mide distancia a la cámara (z = 5): se ajusta a la escala para no apagar el modelo
    [this.materialEsqueleto, this.materialCuerpo].forEach((m) => m.uniforms.u_niebla.value.set(5 + escala * 2, 5 + escala * 6));
  }

  // El tema real es el atributo de <html> (el hook puede ir un paso atrás): se lee de ahí si está.
  aplicarTema(tema) {
    const atributo = document.documentElement.getAttribute('data-theme');
    const actual = atributo === 'light' || atributo === 'dark' ? atributo : tema;
    this.uComposicion.u_claro.value = TEMA_CLARO_RAYOSX && actual === 'light' ? 1 : 0;
    // el fondo del revelado del retrato copia el de la página (token --color-bg, en sRGB)
    const fondo = colorCss(getComputedStyle(document.documentElement).getPropertyValue('--color-bg'));
    if (fondo) this.uComposicion.u_fondoPagina.value.setRGB(fondo[0], fondo[1], fondo[2]);
  }

  /* ------------------------------- entrada ------------------------------- */
  // x, y en 0..1 del canvas (y desde arriba); `adentro`: el puntero está sobre la zona.
  moverPuntero(x, y, adentro) {
    if (adentro && !this.puntero.adentro) this.trazo.saltar(x, y);
    this.puntero.x = x;
    this.puntero.y = y;
    this.puntero.adentro = adentro;
  }

  // Borra lo revelado (al volver a la foto).
  limpiar() {
    this.limpiarMascara = true;
  }

  /* -------------------------------- ciclo -------------------------------- */
  redimensionar(ancho, alto) {
    if (ancho === this.tamano.ancho && alto === this.tamano.alto) return;
    this.tamano = { ancho, alto };
    const dpr = this.renderer.getPixelRatio();
    const w = Math.max(1, Math.round(ancho * dpr));
    const h = Math.max(1, Math.round(alto * dpr));
    this.renderer.setSize(ancho, alto, false);
    this.destinoCuerpo.setSize(w, h);
    this.destinoEsqueleto.setSize(w, h);
    this.destinoBrillo.setSize(w, h);
    this.brillo?.setSize(w, h);
    // la máscara va a media resolución: es una mancha suave
    this.mascaras.forEach((m) => m.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1)));
    this.trazo.redimensionar(w >> 1, h >> 1);
    this.limpiarMascara = true;
    const aspecto = ancho / alto;
    this.uMascara.u_aspecto.value.set(aspecto < 1 ? 1 : 1 / aspecto, aspecto < 1 ? aspecto : 1);
    this.uComposicion.u_resolucion.value.set(w, h);
    if (this.retrato) {
      Object.assign(this.camara, { left: -aspecto, right: aspecto, top: 1, bottom: -1 });
      this.camara.updateProjectionMatrix();
      this.ajustarRetrato();
    } else {
      this.camara.aspect = aspecto;
      this.camara.updateProjectionMatrix();
      if (this.entradaPendiente && this.lugares) {
        const e = this.entradaPendiente;
        this.entradaPendiente = null;
        this.prepararEntrada(e);
      }
    }
  }

  iniciar() {
    if (this.corriendo || this.liberado) return;
    this.corriendo = true;
    this.ultimo = performance.now();
    const cuadro = () => {
      if (!this.corriendo) return;
      this.raf = requestAnimationFrame(cuadro);
      this.cuadro();
    };
    this.raf = requestAnimationFrame(cuadro);
  }

  pausar() {
    this.corriendo = false;
    cancelAnimationFrame(this.raf);
  }

  cuadro() {
    if (this.perdido || !this.tamano.ancho) return;
    const ahora = performance.now();
    const real = ahora - this.ultimo;
    const dt = Math.min(real / 1000, MAX_DT);
    this.ultimo = ahora;
    this.tiempo += dt;
    // el contador de los 4 s usa tiempo real (con pocos cuadros por segundo, el dt limitado se
    // quedaría corto); sólo se descartan saltos grandes, como volver de otra pestaña
    this.opciones.alCuadro?.(Math.min(real, 250));
    const renderer = this.renderer;

    // cámara del fondo: sigue al puntero (parallax), o un ocho en táctil
    if (!this.retrato) {
      let px = (this.puntero.x * 2 - 1) * (this.reducido ? 0 : 1);
      let py = (1 - this.puntero.y * 2) * (this.reducido ? 0 : 1);
      if (this.opciones.tactil && !this.reducido) {
        px = Math.sin(this.tiempo * 0.5);
        py = Math.sin(this.tiempo * 0.35) * 0.5;
        const t = this.tiempo * 1.3;
        this.puntero.x = 0.5 + Math.sin(t) * 0.5;
        this.puntero.y = 0.5 - Math.sin(t * 2) * 0.5;
        this.puntero.adentro = true;
      }
      const m = this.miraCamara;
      // durante la entrada la cámara queda quieta: tu esqueleto sale de donde estaba en la foto
      if (this.entrada) {
        px = 0;
        py = 0;
      }
      this.objetivoDeCamara(px, py);
      const lambda = 1 / FONDO.suavizado;
      this.camara.position.set(
        amortiguar(this.camara.position.x, this.objetivoCamara.x, lambda, dt),
        amortiguar(this.camara.position.y, this.objetivoCamara.y, lambda, dt),
        amortiguar(this.camara.position.z, this.objetivoCamara.z, lambda, dt)
      );
      this.camara.lookAt(m);
      if (this.entrada) this.avanzarEntrada(dt);
      else this.uComposicion.u_revelarTodo.value = amortiguar(this.uComposicion.u_revelarTodo.value, 0, 1.6, dt);
    }

    // retrato: la cabeza mira hacia el puntero (suave); sin puntero adentro vuelve a mirar de frente
    if (this.retrato) {
      const c = RETRATO.calibracion;
      const p = this.puntero;
      const aspecto = this.tamano.ancho / Math.max(1, this.tamano.alto);
      const dx = p.adentro ? (p.x - c.centroX) * aspecto : 0;
      const dy = p.adentro ? p.y - c.centroY : 0;
      const g = RETRATO.giroCabeza;
      const yaw = this.reducido ? 0 : Math.max(-g.yaw, Math.min(g.yaw, dx * g.fuerza));
      const cab = this.reducido ? 0 : Math.max(-g.cabeceo, Math.min(g.cabeceo, dy * g.fuerza * 0.8));
      const v = this.giroCabeza.value;
      v.set(amortiguar(v.x, yaw, 1 / 0.18, dt), amortiguar(v.y, cab, 1 / 0.18, dt));
      if (Math.abs(v.x) < 1e-4 && Math.abs(v.y) < 1e-4) v.set(0, 0);
    }

    // máscara: trazo del mouse → fluido (ping-pong)
    this.trazo.actualizar(this.puntero.x, this.puntero.y, this.puntero.adentro);
    const [a, b] = this.mascaras;
    if (this.limpiarMascara) {
      renderer.setClearColor(0xffffff, 1);
      renderer.setRenderTarget(a);
      renderer.clear();
      renderer.setRenderTarget(b);
      renderer.clear();
      renderer.setClearColor(0x000000, this.retrato ? 0 : 1);
      this.limpiarMascara = false;
    }
    this.uMascara.u_previo.value = a.texture;
    renderer.setRenderTarget(b);
    renderer.render(this.escenaMascara, this.camaraPantalla);
    this.mascaras = [b, a];
    this.uComposicion.u_mascara.value = b.texture;

    // escenas → composición
    renderer.setRenderTarget(this.destinoEsqueleto);
    renderer.clear();
    renderer.render(this.escenaEsqueleto, this.camara);
    renderer.setRenderTarget(this.destinoCuerpo);
    renderer.clear();
    renderer.render(this.escenaCuerpo, this.camara);
    if (!this.brilloListo) {
      this.brillo.initialize(renderer, true, HalfFloatType);
      this.brilloListo = true;
    }
    this.brillo.render(renderer, this.destinoCuerpo, this.destinoBrillo);
    this.uComposicion.u_tiempo.value = this.reducido ? 0 : this.tiempo;
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(this.escenaComposicion, this.camaraPantalla);
  }

  liberar() {
    this.liberado = true;
    this.pausar();
    this.lienzo.removeEventListener('webglcontextlost', this.alPerder);
    this.lienzo.removeEventListener('webglcontextrestored', this.alRecuperar);
    [this.destinoCuerpo, this.destinoEsqueleto, this.destinoBrillo, ...this.mascaras].forEach((d) => d.dispose());
    this.brillo.dispose();
    this.trazo.liberar();
    [this.materialCuerpo, this.materialEsqueleto].forEach((m) => m.dispose());
    this.escenaMascara.children[0].material.dispose();
    this.escenaComposicion.children[0].material.dispose();
    this.escenaMascara.children[0].geometry.dispose();
    this.renderer.dispose();
  }
}
