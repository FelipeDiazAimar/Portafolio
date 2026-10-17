import { EffectComposer, EffectPass, RenderPass, SMAAEffect, SMAAPreset } from 'postprocessing';
import {
  CanvasTexture,
  Color,
  DoubleSide,
  Euler,
  Group,
  LinearFilter,
  Mesh,
  NoToneMapping,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Raycaster,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { acercarValores, amortiguar, avanzarFase, elegirResaltada, resalteContinuo } from '@/lib/xilofono.js';
import { CELDAS, CELDAS_NOMBRES } from './atlas.js';
import { CAPA_FONDO, CAPA_VIDRIO, ESCARCHA, FLUIDO, PALETAS, XILOFONO, calidad } from './config.js';
import { AyudaFBO } from './fbo.js';
import { Fluido } from './fluido.js';
import { armarGeometria, escribirHelice } from './helice.js';
import { PasadaEscarcha } from './pasadas.js';
import { barraBajoRayo, centroDeBarra, crearEspacio, frenteDeBarra } from './picking.js';
import { barraFrag, barraVert, fondoFrag, fondoVert } from './shaders.js';

// Motor del xilófono de vidrio (de main.ts + Xylophone.ts del original, MIT), dentro de un
// canvas de la sección en vez de a pantalla completa. Diferencias: sin audio, la cinta avanza con
// el scroll de la página (sin capturar la rueda) y sola; las barras se encienden al pasar por un
// lugar de foco (recorrido continuo) y se pueden filtrar por categoría.

const MAX_DT = 1 / 20;
const URL_MODELO = '/modelos/xilofono.glb';

function texturaDegrade(colores) {
  const lienzo = document.createElement('canvas');
  lienzo.width = 256;
  lienzo.height = 1;
  const ctx = lienzo.getContext('2d');
  const degrade = ctx.createLinearGradient(0, 0, 256, 0);
  colores.forEach((c, i) => degrade.addColorStop(i / (colores.length - 1), c));
  ctx.fillStyle = degrade;
  ctx.fillRect(0, 0, 256, 1);
  const textura = new CanvasTexture(lienzo);
  textura.colorSpace = SRGBColorSpace;
  textura.minFilter = LinearFilter;
  textura.magFilter = LinearFilter;
  return textura;
}

export class Xilofono {
  // opciones: { atlas (Texture), tema, reducido, alResaltar(indice, x, y, porHover) }
  constructor(lienzo, opciones) {
    this.lienzo = lienzo;
    this.opciones = opciones;
    this.calidad = calidad();
    this.reducido = Boolean(opciones.reducido);
    this.tiempo = 0;
    this.ultimo = performance.now();
    this.corriendo = false;
    this.raf = 0;
    this.perdido = false;
    this.tamano = { ancho: 0, alto: 0 };

    // puntero (relativo al canvas) y scroll de la página
    this.puntero = null; // Vector2 0..1 desde abajo a la izquierda
    this.punteroNdc = new Vector2();
    this.scrollPrevio = window.scrollY;
    this.faseObjetivo = 0;
    this.fase = 0;
    this.faseEscrita = 0;
    this.euler = new Euler(0, 0, 0, 'YXZ');
    this.cuaternion = new Quaternion();

    // resaltado y filtro
    this.lugarFoco = null; // lugar de la cinta (0..cantidad) donde se encienden las barras
    this.hover = -1;
    this.golpeAnterior = -1;
    this.enFoco = -1;
    this.objetivos = new Float32Array(XILOFONO.cantidad);
    this.filtro = null; // Set de índices activos, o null = todas
    this.objetivosActivas = new Float32Array(XILOFONO.cantidad).fill(1);
    this.centros = Array.from({ length: XILOFONO.cantidad }, () => ({ x: 0, y: 0, z: 0 }));
    this.vector = new Vector3();
    this.direccion = new Vector3();
    this.raycaster = new Raycaster();
    this.espacio = crearEspacio();

    this.renderer = this.crearRenderer();
    this.ayuda = new AyudaFBO(this.renderer);
    this.escena = new Scene();
    this.camara = new PerspectiveCamera(45, 1, 0.1, 200);
    this.camara.position.set(0, 0, 5);

    this.uniforms = this.crearUniforms();
    this.grupo = new Group();
    this.grupo.scale.setScalar(XILOFONO.grupo.escala);
    this.grupo.rotation.set((XILOFONO.grupo.rotXGrados * Math.PI) / 180, 0, (XILOFONO.grupo.rotZGrados * Math.PI) / 180);
    this.escena.add(this.grupo);
    this.escena.add(this.crearFondo());

    this.fluido = new Fluido(this.ayuda, FLUIDO);
    this.uniforms.u_tFluid = this.fluido.uniforms.velocity;
    this.armarCompositor();
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

  crearRenderer() {
    const renderer = new WebGLRenderer({ canvas: this.lienzo, alpha: false, antialias: false, powerPreference: 'high-performance' });
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = NoToneMapping;
    renderer.setPixelRatio(Math.min(this.calidad.maxDpr, window.devicePixelRatio || 1));
    return renderer;
  }

  crearUniforms() {
    return {
      u_time: { value: 0 },
      u_spinSpeed: { value: this.reducido ? 0 : XILOFONO.velocidadGiro },
      u_swingScale: { value: this.reducido ? 0 : 1 },
      u_swingAxis: { value: new Vector3(0, 1, 0) },
      u_tFluid: { value: null },
      u_tGradient: { value: null },
      u_fluidStrength: { value: 1 },
      u_tintStrength: { value: 1 },
      u_tintGlow: { value: 0.15 },
      u_tintWrap: { value: XILOFONO.envolturaTinte },
      u_tBackdrop: { value: null },
      u_transmission: { value: 0.84 },
      u_refractStrength: { value: 0.2 },
      u_fresnelPower: { value: 3 },
      u_iridStrength: { value: 0.45 },
      u_iridCycles: { value: 3 },
      u_iridShift: { value: 0 },
      u_iridPower: { value: 2.5 },
      u_iridBody: { value: 0.12 },
      u_iridA: { value: new Color() },
      u_iridB: { value: new Color() },
      u_tAtlas: { value: this.opciones.atlas },
      u_atlasCeldas: { value: CELDAS },
      u_colorLogo: { value: new Color() },
      u_colorResalte: { value: new Color() },
      u_cuerpo: { value: 1 },
      // logo centrado en la cara ancha de la barra (ver mascaraLogo en el shader)
      u_logoCaja: { value: [-0.2, 0.2, 0.19, 0] },
      u_tNombres: { value: this.opciones.nombres },
      u_nombresCeldas: { value: new Vector2(...CELDAS_NOMBRES) },
      // el nombre sigue al logo hacia la punta (la barra mide 2,5 de largo)
      u_nombreCaja: { value: [0.26, 1.1, 0.11, 0] },
      u_especular: { value: 0.8 },
      u_opacidad: { value: 0.5 },
    };
  }

  crearFondo() {
    this.uniformsFondo = {
      u_colorA: { value: new Color() },
      u_colorB: { value: new Color() },
      u_colorC: { value: new Color() },
      u_time: this.uniforms.u_time,
      u_aspecto: { value: 1 },
    };
    const malla = new Mesh(
      new PlaneGeometry(2, 2),
      new ShaderMaterial({ vertexShader: fondoVert, fragmentShader: fondoFrag, uniforms: this.uniformsFondo, depthTest: false, depthWrite: false })
    );
    malla.renderOrder = -1;
    malla.frustumCulled = false;
    malla.layers.enable(CAPA_FONDO);
    this.fondo = malla;
    return malla;
  }

  armarCompositor() {
    this.compositor = new EffectComposer(this.renderer);
    this.pasadaEscarcha = new PasadaEscarcha(this.escena, this.camara);
    this.pasadaEscarcha.radio = ESCARCHA.intensidad * ESCARCHA.desenfoqueMaxPx;
    this.uniforms.u_tBackdrop.value = this.pasadaEscarcha.textura;
    this.pasadas = [this.pasadaEscarcha, new RenderPass(this.escena, this.camara)];
    // Las barras son transparentes (no escriben profundidad), así que la oclusión ambiental
    // del original no tendría de dónde sacarla: no se usa.
    this.pasadas.push(new EffectPass(this.camara, new SMAAEffect({ preset: this.calidad.esMovil ? SMAAPreset.MEDIUM : SMAAPreset.HIGH })));
    this.pasadas.forEach((p) => this.compositor.addPass(p));
  }

  async cargar() {
    let modelo;
    try {
      const gltf = await new GLTFLoader().loadAsync(URL_MODELO);
      modelo = gltf.scene.children[0].geometry;
    } catch (error) {
      console.error('[Xilofono] no cargó el modelo de la barra', error);
      return false;
    }
    if (this.liberado) return false;
    this.instancias = armarGeometria(modelo, XILOFONO, (i) => i);
    // Vidrio de verdad: transparente, sin escribir profundidad, así se ven las barras de atrás.
    this.material = new ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: barraVert,
      fragmentShader: barraFrag,
      side: DoubleSide,
      transparent: true,
      depthWrite: false,
    });
    this.malla = new Mesh(this.instancias.geometria, this.material);
    this.malla.frustumCulled = false;
    this.malla.layers.enable(CAPA_VIDRIO);
    this.grupo.add(this.malla);
    // compila antes del primer cuadro visible para no trabar el scroll al entrar
    await this.renderer.compileAsync(this.escena, this.camara).catch(() => {});
    return true;
  }

  aplicarTema(tema) {
    const p = tema === 'light' ? PALETAS.claro : PALETAS.oscuro;
    this.uniformsFondo.u_colorA.value.set(p.fondoA);
    this.uniformsFondo.u_colorB.value.set(p.fondoB);
    this.uniformsFondo.u_colorC.value.set(p.manchas);
    this.uniforms.u_especular.value = p.especular;
    this.uniforms.u_colorLogo.value.set(p.logo);
    this.uniforms.u_colorResalte.value.set(p.resalte);
    this.uniforms.u_iridA.value.set(p.iridA);
    this.uniforms.u_iridB.value.set(p.iridB);
    this.uniforms.u_cuerpo.value = p.cuerpo;
    this.uniforms.u_transmission.value = p.transmision;
    this.uniforms.u_opacidad.value = p.opacidad;
    this.uniforms.u_tGradient.value?.dispose();
    this.uniforms.u_tGradient.value = texturaDegrade(p.tinte);
  }

  // Filtro por categoría: `indices` (barras de la categoría) o null para todas. Las demás
  // quedan como vidrio vacío y la cinta se apura entre ellas.
  filtrar(indices) {
    this.filtro = indices && indices.length ? new Set(indices) : null;
    for (let i = 0; i < XILOFONO.cantidad; i += 1) this.objetivosActivas[i] = !this.filtro || this.filtro.has(i) ? 1 : 0;
  }

  /* ------------------------------ entrada ------------------------------ */
  moverPuntero(x, y) {
    const { ancho, alto } = this.tamano;
    if (!ancho || !alto) return;
    if (!this.puntero) this.puntero = new Vector2();
    this.puntero.set(x / ancho, 1 - y / alto);
    this.punteroNdc.set((x / ancho) * 2 - 1, 1 - (y / alto) * 2);
  }

  soltarPuntero() {
    this.puntero = null;
    this.hover = -1;
    this.golpeAnterior = -1;
  }

  /* ------------------------------- ciclo ------------------------------- */
  redimensionar(ancho, alto) {
    if (ancho === this.tamano.ancho && alto === this.tamano.alto) return;
    this.tamano = { ancho, alto };
    this.renderer.setSize(ancho, alto, false);
    this.compositor.setSize(ancho, alto, false);
    this.camara.aspect = ancho / alto;
    this.uniformsFondo.u_aspecto.value = this.camara.aspect;
    // en pantallas angostas la hélice no entra a lo ancho: se aleja la cámara
    this.camara.position.z = this.camara.aspect < 1 ? 5 / Math.max(0.55, this.camara.aspect) : 5;
    // en pantallas anchas la hélice va a la derecha, para dejar el título libre
    this.grupo.position.x = this.camara.aspect > 1.2 ? Math.min(1.1, (this.camara.aspect - 1.2) * 1.6) : 0;
    this.grupo.position.y = this.camara.aspect > 1.2 ? 0 : this.camara.aspect < 1 ? -1.1 : -0.35;
    this.camara.updateProjectionMatrix();
    this.lugarFoco = null;
  }

  iniciar() {
    if (this.corriendo || this.liberado) return;
    this.corriendo = true;
    this.ultimo = performance.now();
    this.scrollPrevio = window.scrollY;
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
    const dt = Math.min((ahora - this.ultimo) / 1000, MAX_DT);
    this.ultimo = ahora;
    this.tiempo += dt;
    this.uniforms.u_time.value = this.tiempo;

    this.fluido.resolver(this.puntero, this.tiempo, dt, this.tamano.ancho / this.tamano.alto);
    if (this.instancias) {
      this.actualizarCinta(dt);
      this.grupo.updateMatrixWorld();
      this.actualizarHover();
      this.actualizarResalte(dt);
    }
    this.compositor.render(dt);
  }

  actualizarCinta(dt) {
    const scroll = window.scrollY;
    const delta = scroll - this.scrollPrevio;
    this.scrollPrevio = scroll;
    // con el mouse sobre una barra la cinta se detiene (para leerla); con un filtro, se apura
    // mientras no haya una barra de la categoría en el foco
    let ritmo = 1;
    if (this.hover !== -1) ritmo = 0;
    else if (this.filtro && (this.enFoco === -1 || !this.filtro.has(this.enFoco))) ritmo = 7;
    this.faseObjetivo = avanzarFase(this.faseObjetivo, delta, dt, XILOFONO, this.reducido, ritmo);
    this.fase = amortiguar(this.fase, this.faseObjetivo, XILOFONO.scroll.suavizado, dt);
    if (Math.abs(this.fase - this.faseEscrita) <= 1e-5) return;
    const { posiciones, rotaciones, alto, geometria } = this.instancias;
    escribirHelice(this.fase, alto, XILOFONO, posiciones, rotaciones, this.euler, this.cuaternion);
    geometria.attributes.aPos.needsUpdate = true;
    geometria.attributes.aRot.needsUpdate = true;
    this.faseEscrita = this.fase;
  }

  // Pasar el mouse por una barra la golpea (vaivén) y la resalta mientras esté encima.
  actualizarHover() {
    if (!this.puntero) return;
    const { posiciones, rotaciones, caja, golpes } = this.instancias;
    this.raycaster.setFromCamera(this.punteroNdc, this.camara);
    const i = barraBajoRayo(this.raycaster.ray, posiciones, rotaciones, caja, this.grupo.matrixWorld, this.tiempo, this.uniforms.u_spinSpeed.value, this.espacio);
    if (i !== -1 && i !== this.golpeAnterior) {
      golpes.setX(i, this.tiempo);
      golpes.needsUpdate = true;
    }
    this.golpeAnterior = i;
    this.hover = i;
  }

  // Lugar de foco: el de la barra que, con la cinta quieta, queda más de frente y centrada.
  // Las barras no giran sobre sí mismas, así que se calcula una vez.
  calcularFoco() {
    const { posiciones, rotaciones } = this.instancias;
    for (let i = 0; i < XILOFONO.cantidad; i += 1) {
      const c = centroDeBarra(i, posiciones, this.grupo.matrixWorld, this.vector);
      this.centros[i].x = c.x;
      this.centros[i].y = c.y;
      this.centros[i].z = c.z;
      this.centros[i].frente = frenteDeBarra(i, rotaciones, this.grupo.matrixWorld, this.tiempo, 0, this.direccion, this.espacio);
    }
    const barra = elegirResaltada(this.centros);
    const n = XILOFONO.cantidad;
    this.lugarFoco = (((barra + this.faseEscrita) % n) + n) % n;
  }

  // Recorrido continuo: cada barra se enciende según qué tan cerca del foco pasa. Con el mouse
  // encima, se enciende la apuntada. Con un filtro, sólo las de la categoría.
  actualizarResalte(dt) {
    const { resaltes, activas, golpes } = this.instancias;
    if (this.lugarFoco === null) this.calcularFoco();
    const n = XILOFONO.cantidad;
    let enFoco = -1;
    let mejor = 0;
    for (let i = 0; i < n; i += 1) {
      const lugar = (((i + this.fase) % n) + n) % n;
      const r = resalteContinuo(lugar, this.lugarFoco, n);
      if (r > mejor) {
        mejor = r;
        enFoco = i;
      }
      const activa = this.objetivosActivas[i];
      this.objetivos[i] = this.hover !== -1 ? (i === this.hover ? 1 : 0) : r * activa;
    }
    // la barra que entra al foco da un golpecito (el vaivén del original)
    if (enFoco !== this.enFoco && enFoco !== -1 && this.hover === -1 && this.objetivosActivas[enFoco] > 0) {
      golpes.setX(enFoco, this.tiempo);
      golpes.needsUpdate = true;
    }
    this.enFoco = enFoco;
    if (acercarValores(resaltes.array, this.objetivos, dt, 10)) resaltes.needsUpdate = true;
    if (acercarValores(activas.array, this.objetivosActivas, dt, 6)) activas.needsUpdate = true;
  }

  liberar() {
    this.liberado = true;
    this.pausar();
    this.lienzo.removeEventListener('webglcontextlost', this.alPerder);
    this.lienzo.removeEventListener('webglcontextrestored', this.alRecuperar);
    this.pasadas.forEach((p) => p.dispose());
    this.compositor.dispose();
    this.fluido.liberar();
    this.ayuda.liberar();
    this.material?.dispose();
    this.instancias?.geometria.dispose();
    this.fondo.geometry.dispose();
    this.fondo.material.dispose();
    this.uniforms.u_tGradient.value?.dispose();
    this.uniforms.u_tAtlas.value?.dispose();
    this.uniforms.u_tNombres.value?.dispose();
    this.renderer.dispose();
  }
}
