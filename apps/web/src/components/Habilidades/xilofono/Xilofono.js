import { EffectComposer, EffectPass, RenderPass, SMAAEffect, SMAAPreset } from 'postprocessing';
import {
  CanvasTexture,
  Color,
  BackSide,
  FrontSide,
  Euler,
  Group,
  LinearFilter,
  Matrix4,
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
import { acercarValores, amortiguar, avanzarFase, elegirResaltada, limitarZoom, progresoBarra, resalteContinuo, retardoArbol, suave } from '@/lib/xilofono.js';
import { ARBOL, BARRA, disposicionArbol } from '@/lib/arbol.js';
import { ArbolHabilidades } from './arbol3d.js';
import { CELDAS, CELDAS_NOMBRES } from './atlas.js';
import { AURORA, BARRAS, CAPA_FONDO, CAPA_VIDRIO, COLORES_FONDO, ESCARCHA, FLUIDO, FONDO, PALETAS, XILOFONO, calidad } from './config.js';
import { FONDOS_EXTRA } from './fondos.js';
import { coloresAurora } from './aurora.js';
import { AyudaFBO } from './fbo.js';
import { Fluido } from './fluido.js';
import { armarGeometria, crearBarra, crearGeometriaEsferas, escribirHelice } from './helice.js';
import { PasadaEscarcha } from './pasadas.js';
import { barraBajoRayo, centroDeBarra, crearEspacio, frenteDeBarra } from './picking.js';
import { barraFrag, barraVert, fondoAuroraFrag, fondoFrag, fondoVert } from './shaders.js';

// Motor del xilófono de vidrio (de main.ts + Xylophone.ts del original, MIT), dentro de un
// canvas de la sección en vez de a pantalla completa. Diferencias: sin audio, la cinta avanza con
// el scroll de la página (sin capturar la rueda) y sola; las barras se encienden al pasar por un
// lugar de foco (recorrido continuo) y se pueden filtrar por categoría.

const MAX_DT = 1 / 20;

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
    this.filtro = null; // Set de barras activas, o null = todas
    // orden[i] = tecnología de la barra i (las categorías van repartidas por la cinta)
    this.orden = opciones.orden ?? Array.from({ length: XILOFONO.cantidad }, (_, i) => i);
    this.barraDe = new Map(this.orden.map((tecnologia, barra) => [tecnologia, barra]));

    // vista libre: giro sobre el eje propio de la hélice, zoom y encuadre vertical
    this.vista = { giro: 0, giroObjetivo: 0, inercia: 0, inerciaFase: 0, zoom: 1, zoomObjetivo: 1, y: 0, yObjetivo: 0, x: 0, xObjetivo: 0 };
    this.giroFoco = 0;
    this.distanciaBase = 5;
    this.arrastre = null;
    this.dedos = new Map();
    this.objetivosActivas = new Float32Array(XILOFONO.cantidad).fill(1);
    this.centros = Array.from({ length: XILOFONO.cantidad }, () => ({ x: 0, y: 0, z: 0 }));
    this.vector = new Vector3();
    this.direccion = new Vector3();
    this.raycaster = new Raycaster();
    this.espacio = crearEspacio();

    // vista de árbol: progreso 0 (hélice) .. 1 (árbol), con la transición a ~1,8 s
    this.modoArbol = false;
    this.arbolP = 0;
    this.arbol = null;
    this.hPos = new Float32Array(XILOFONO.cantidad * 3);
    this.hRot = new Float32Array(XILOFONO.cantidad * 4);
    this.hubActivo = -1;
    this.hubHover = -1;
    this.cursorActual = '';
    this.seleccionArbol = -1; // esfera tocada: se ilumina sólo su hilo
    // tecnología buscada: queda señalada (y las demás atenuadas) hasta que se borre el texto, se
    // busque otra o se toque el vacío; no vence sola
    this.busqueda = -1;
    this.activasEfectivas = new Float32Array(XILOFONO.cantidad).fill(1);
    this.previa = null; // categoría apuntada en el radar: Set de barras (vista previa)
    this.hubPrevia = -1;
    this.posicionGrupo = { helice: { x: 0, y: 0 }, arbol: { x: 0, y: 0 }, escalaArbol: 0.36 };
    this.huboArbol = false;
    this.vector4 = new Matrix4();
    this.punteroNdc2 = new Vector2();

    this.renderer = this.crearRenderer();
    this.ayuda = new AyudaFBO(this.renderer);
    this.escena = new Scene();
    this.camara = new PerspectiveCamera(45, 1, 0.1, 200);
    this.camara.position.set(0, 0, 5);

    this.uniforms = this.crearUniforms();
    this.escalaBarra = this.uniforms.u_escalaBarra.value; // forma visual de la barra (se achica al pasar a esfera)
    this.escalaPick = new Vector3(1, 1, 1); // caja del picking: de la barra a la esfera
    this.paletaPrueba = COLORES_FONDO;
    this.barrasPrueba = BARRAS;
    this.ratonFondo = new Vector2(0.5, 0.5);
    this.forzada = null; // barra pedida desde el buscador: { barra, hasta, estallo }
    this.grupo = new Group();
    this.grupo.scale.setScalar(XILOFONO.grupo.escala);
    this.grupo.rotation.set((XILOFONO.grupo.rotXGrados * Math.PI) / 180, 0, (XILOFONO.grupo.rotZGrados * Math.PI) / 180);
    this.escena.add(this.grupo);
    // eje propio de la hélice: lo que se gira al arrastrar (el grupo de afuera da la inclinación)
    this.eje = new Group();
    this.grupo.add(this.eje);
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
      // el vaivén de la barra al golpearla es respuesta a una acción del usuario: va siempre
      u_swingScale: { value: 1 },
      u_swingAxis: { value: new Vector3(0, 1, 0) },
      u_escalaBarra: { value: new Vector3(1, 1, 1) },
      u_esfera: { value: 0 },
      u_resolucion: { value: new Vector2(1, 1) },
      u_filo: { value: 9 },
      u_atras: { value: 0 },
      u_radioEsfera: { value: ARBOL.radioEsfera },
      u_logoEscala: { value: 1 },
      u_nombreOn: { value: 1 },
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
      u_iridStrength: { value: 0.16 },
      u_iridCycles: { value: 3 },
      u_iridShift: { value: 0 },
      u_iridPower: { value: 2.5 },
      u_iridBody: { value: 0.03 },
      u_iridA: { value: new Color() },
      u_iridB: { value: new Color() },
      u_tAtlas: { value: this.opciones.atlas },
      u_atlasCeldas: { value: CELDAS },
      u_colorLogo: { value: new Color() },
      u_colorResalte: { value: new Color() },
      u_cuerpo: { value: 1 },
      // logo centrado en la cara ancha de la barra (ver mascaraLogo en el shader)
      u_logoCaja: { value: [-0.16, 0.16, 0.16, 0] },
      u_tNombres: { value: this.opciones.nombres },
      u_nombresCeldas: { value: new Vector2(...CELDAS_NOMBRES) },
      // el nombre sigue al logo hacia la punta (la barra mide 2,5 de largo)
      u_nombreCaja: { value: [0.26, 0.98, 0.138, 0] }, // entra en la parte plana de la barra (la punta es redonda)
      u_especular: { value: 0.8 },
      u_opacidad: { value: 0.5 },
      u_tNitido: { value: null },
      u_aberracion: { value: 0.025 },
      u_esmerilado: { value: 0.55 },
      u_bordeLuz: { value: 1 },
      u_filtro: { value: 0 },
      u_claro: { value: 0 },
      u_colorContorno: { value: new Color('#12308f') },
      u_destello: { value: 0 },
    };
  }

  crearFondo() {
    this.uniformsFondo = {
      u_colorA: { value: new Color() },
      u_colorB: { value: new Color() },
      u_colorC: { value: new Color() },
      // el fondo va a su propio ritmo (más lento que el reloj de la escena)
      u_time: { value: 0 },
      u_aspecto: { value: 1 },
      u_c: { value: [new Color(), new Color(), new Color(), new Color()] },
      u_stops: { value: Array.from({ length: 5 }, () => new Vector3()) },
      u_cantidad: { value: 2 },
      u_amplitud: { value: AURORA.amplitud },
      u_suavidad: { value: AURORA.suavidad },
      u_alto: { value: AURORA.alto },
      u_escala: { value: AURORA.escala },
      u_resplandor: { value: AURORA.resplandor },
      u_brillo: { value: AURORA.brillo },
      u_capas: { value: AURORA.capas },
      u_invertir: { value: AURORA.desdeAbajo ? 1 : 0 },
      u_claro: { value: 0 },
      u_raton: { value: new Vector2(0.5, 0.5) },
      u_ratonFuerza: { value: 0 },
    };
    this.materialesFondo = new Map();
    const malla = new Mesh(new PlaneGeometry(2, 2), this.materialFondo(FONDO));
    this.fondoActual = FONDO;
    malla.renderOrder = -1;
    malla.frustumCulled = false;
    malla.layers.enable(CAPA_FONDO);
    this.fondo = malla;
    return malla;
  }

  // Un material por fondo, creado la primera vez que se usa (todos comparten los uniforms).
  materialFondo(id) {
    if (!this.materialesFondo.has(id)) {
      const fragmento = id === 'aurora' ? fondoAuroraFrag : id === 'manchas' ? fondoFrag : FONDOS_EXTRA[id] ?? fondoAuroraFrag;
      this.materialesFondo.set(
        id,
        new ShaderMaterial({ vertexShader: fondoVert, fragmentShader: fragmento, uniforms: this.uniformsFondo, depthTest: false, depthWrite: false })
      );
    }
    return this.materialesFondo.get(id);
  }

  armarCompositor() {
    this.compositor = new EffectComposer(this.renderer);
    this.pasadaEscarcha = new PasadaEscarcha(this.escena, this.camara);
    this.pasadaEscarcha.radio = ESCARCHA.intensidad * ESCARCHA.desenfoqueMaxPx;
    this.uniforms.u_tBackdrop.value = this.pasadaEscarcha.textura;
    this.uniforms.u_tNitido.value = this.pasadaEscarcha.texturaNitida;
    this.pasadas = [this.pasadaEscarcha, new RenderPass(this.escena, this.camara)];
    // Las barras son transparentes (no escriben profundidad), así que la oclusión ambiental
    // del original no tendría de dónde sacarla: no se usa.
    this.pasadas.push(new EffectPass(this.camara, new SMAAEffect({ preset: this.calidad.esMovil ? SMAAPreset.MEDIUM : SMAAPreset.HIGH })));
    this.pasadas.forEach((p) => this.compositor.addPass(p));
  }

  async cargar() {
    const modelo = crearBarra();
    this.instancias = armarGeometria(modelo, XILOFONO, (i) => this.orden[i]);
    // caja un poco más grande para agarrar el modelo: cubre también el espacio entre barras
    this.cajaAgarre = this.instancias.caja.clone().expandByVector(new Vector3(0.08, 0.14, 0.04));
    // Vidrio de verdad: transparente, sin escribir profundidad, así se ven las barras de atrás.
    // Sin escritura de profundidad, el orden en que la GPU pinta las caras de una pieza depende de
    // sus triángulos y del ángulo de vista: según el ángulo, la cara de atrás (sin logo) se pintaba
    // después y tapaba el logo de la de adelante. Por eso cada pieza va en dos mallas: primero las
    // caras de atrás y después las de adelante, siempre en ese orden.
    this.material = this.materialVidrio(this.uniforms, FrontSide);
    this.materialAtras = this.materialVidrio({ ...this.uniforms, u_atras: { value: 1 } }, BackSide);
    this.malla = this.mallaVidrio(this.instancias.geometria, this.material, 4);
    this.mallaAtras = this.mallaVidrio(this.instancias.geometria, this.materialAtras, 3);
    this.armarEsferas();
    this.armarArbol();
    // compila antes del primer cuadro visible para no trabar el scroll al entrar
    await this.renderer.compileAsync(this.escena, this.camara).catch(() => {});
    return true;
  }

  aplicarTema(tema) {
    this.temaActual = tema;
    const base = tema === 'light' ? PALETAS.claro : PALETAS.oscuro;
    // la paleta de prueba (si hay) reemplaza los colores de la aurora, el tinte y el resalte
    const prueba = this.paletaPrueba;
    const p = prueba
      ? { ...base, aurora: prueba.colores, tinte: [...prueba.colores, prueba.colores[0]], resalte: prueba.resalte, manchas: prueba.colores[1] }
      : { ...base };
    const cuatro = prueba ? prueba.colores : [base.aurora[0], base.aurora[1], base.aurora[2], base.aurora[3] ?? base.aurora[0]];
    cuatro.forEach((c, i) => this.uniformsFondo.u_c.value[i].set(c));
    this.uniformsFondo.u_colorA.value.set(p.fondoA);
    this.uniformsFondo.u_colorB.value.set(p.fondoB);
    this.uniformsFondo.u_colorC.value.set(p.manchas);
    {
      const { colores, cantidad } = coloresAurora(p.aurora);
      colores.forEach((c, i) => this.uniformsFondo.u_stops.value[i].set(c[0], c[1], c[2]));
      this.uniformsFondo.u_cantidad.value = cantidad;
      this.uniformsFondo.u_claro.value = tema === 'light' ? 1 : 0;
      this.uniformsFondo.u_brillo.value = AURORA.brillo * p.brilloAurora;
    }
    // variante de color de las barras (si hay): tinte, resaltado, logos e iridiscencia
    const barras = this.barrasPrueba;
    if (barras) {
      p.tinte = [...barras.tinte, barras.tinte[0]];
      p.resalte = barras.resalte;
      p.logo = barras.logo[tema === 'light' ? 1 : 0];
      p.iridA = barras.irid[0];
      p.iridB = barras.irid[1];
    }
    this.uniforms.u_especular.value = p.especular;
    this.uniforms.u_claro.value = tema === 'light' ? 1 : 0;
    this.uniforms.u_colorLogo.value.set(p.logo);
    this.uniforms.u_colorResalte.value.set(p.resalte);
    this.uniforms.u_iridA.value.set(p.iridA);
    this.uniforms.u_iridB.value.set(p.iridB);
    this.uniforms.u_cuerpo.value = p.cuerpo;
    this.uniforms.u_transmission.value = p.transmision;
    this.uniforms.u_opacidad.value = p.opacidad;
    this.uniforms.u_bordeLuz.value = p.bordeLuz;
    this.uniforms.u_tGradient.value?.dispose();
    this.uniforms.u_tGradient.value = texturaDegrade(p.tinte);
    this.arbol?.aplicarTema(tema);
  }

  materialVidrio(uniforms, lado) {
    return new ShaderMaterial({ uniforms, vertexShader: barraVert, fragmentShader: barraFrag, side: lado, transparent: true, depthWrite: false });
  }

  mallaVidrio(geometria, material, orden) {
    const malla = new Mesh(geometria, material);
    malla.frustumCulled = false;
    malla.layers.enable(CAPA_VIDRIO);
    malla.renderOrder = orden;
    this.eje.add(malla);
    return malla;
  }

  /* --------------------------------- árbol --------------------------------- */
  // Las esferas del árbol: otra malla con el mismo shader y los mismos datos por instancia. Cada
  // barra se achica mientras su esfera crece (la transición). Material propio sólo para lo que
  // cambia: modo esfera, radio, y sin nombre sobre la superficie.
  armarEsferas() {
    const uniformes = {
      ...this.uniforms,
      u_esfera: { value: 1 },
      u_nombreOn: { value: 0 },
      u_logoEscala: { value: 1.2 },
      u_escalaBarra: { value: new Vector3(1, 1, 1) },
      u_radioEsfera: { value: 0.0001 },
    };
    this.materialEsferas = this.materialVidrio(uniformes, FrontSide);
    this.materialEsferasAtras = this.materialVidrio({ ...uniformes, u_atras: { value: 1 } }, BackSide);
    this.geometriaEsferas = crearGeometriaEsferas(this.instancias.geometria);
    this.mallaEsferas = this.mallaVidrio(this.geometriaEsferas, this.materialEsferas, 4);
    this.mallaEsferasAtras = this.mallaVidrio(this.geometriaEsferas, this.materialEsferasAtras, 3);
    this.mallaEsferas.visible = false;
    this.mallaEsferasAtras.visible = false;
  }

  armarArbol() {
    const { categorias, tecnologias } = this.opciones;
    if (!categorias?.length || !tecnologias?.length) return;
    this.disp = disposicionArbol(categorias, this.orden, tecnologias);
    this.tecnologias = tecnologias;
    const n = XILOFONO.cantidad;
    // lugar y orientación de cada moneda: boca arriba (el x de la barra mira a +y) y con el
    // largo apuntando hacia afuera
    this.arbolPos = new Float32Array(n * 3);
    this.arbolRot = new Float32Array(n * 4);
    this.retardos = new Float32Array(n);
    const giroY = new Quaternion();
    const volcar = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2);
    const ejeY = new Vector3(0, 1, 0);
    this.disp.nodos.forEach((nodo) => {
      const i = nodo.barra;
      this.arbolPos.set([nodo.x, nodo.y, nodo.z], i * 3);
      giroY.setFromAxisAngle(ejeY, nodo.theta).multiply(volcar);
      this.arbolRot.set([giroY.x, giroY.y, giroY.z, giroY.w], i * 4);
      this.retardos[i] = retardoArbol(i, nodo.nivel);
    });
    this.arbol = new ArbolHabilidades(this.disp, { nombreDe: (barra) => tecnologias[this.orden[barra]]?.nombre ?? '' });
    this.arbol.aplicarTema(this.temaActual ?? 'dark');
    this.eje.add(this.arbol.grupo);
  }

  // Cambia entre la hélice y el árbol: las barras vuelan a su lugar y todo estalla en color.
  usarArbol(valor) {
    if (!this.arbol || valor === this.modoArbol) return;
    this.modoArbol = valor;
    this.forzada = null;
    this.hubHover = -1;
    Object.assign(this.vista, { zoomObjetivo: 1, xObjetivo: 0, yObjetivo: 0, inercia: 0 });
    this.seleccionArbol = -1;
    this.busqueda = -1;
    this.lugarFoco = null;
    this.estallar(-1);
  }

  // Avanza la transición y acomoda el grupo (inclinación, tamaño y lugar), la forma de las
  // barras y el cursor.
  actualizarGrupo(dt) {
    const meta = this.modoArbol ? 1 : 0;
    const paso = dt * 0.55;
    this.arbolP += Math.max(-paso, Math.min(paso, meta - this.arbolP));
    if (this.arbolP < 0.0005 && !this.modoArbol) this.arbolP = 0;
    const e = suave(this.arbolP);
    const g = XILOFONO.grupo;
    const p = this.posicionGrupo;
    const lerp = (a, b) => a + (b - a) * e;
    this.grupo.rotation.set(lerp((g.rotXGrados * Math.PI) / 180, 1.0), 0, lerp((g.rotZGrados * Math.PI) / 180, 0));
    this.grupo.scale.setScalar(lerp(g.escala, p.escalaArbol));
    this.grupo.position.x = lerp(p.helice.x, p.arbol.x);
    this.grupo.position.y = lerp(p.helice.y, p.arbol.y);
    // picking: la caja pasa del tamaño de la barra al de la esfera
    const R = ARBOL.radioEsfera;
    this.escalaPick.set(lerp(1, R / BARRA.semiX), lerp(1, R / BARRA.semiY), lerp(1, R / BARRA.semiZ));
    this.espacio.escala.copy(this.escalaPick);
    // transición: la barra se achica y su esfera crece, superpuestas entre 45 % y 90 %
    const sale = suave((this.arbolP - 0.45) / 0.4);
    const entra = suave((this.arbolP - 0.45) / 0.5);
    this.escalaBarra.setScalar(Math.max(0.03, 1 - sale));
    this.uniforms.u_nombreOn.value = 1 - e;
    if (this.mallaEsferas) {
      this.materialEsferas.uniforms.u_radioEsfera.value = R * entra + 0.0001;
      this.mallaEsferas.visible = this.arbolP > 0.45;
      this.mallaEsferasAtras.visible = this.mallaEsferas.visible;
      this.malla.visible = this.arbolP < 0.95;
      this.mallaAtras.visible = this.malla.visible;
    }
  }

  // Escribe las posiciones de las barras: la hélice, o el vuelo hacia (o desde) el árbol.
  mezclarArbol(tiempo) {
    const { posiciones, rotaciones } = this.instancias;
    const n = XILOFONO.cantidad;
    const P = this.arbolP;
    for (let i = 0; i < n; i += 1) {
      const t = progresoBarra(P, this.retardos[i]);
      const arco = Math.sin(Math.PI * t) * 1.3; // sube en el vuelo y baja al llegar
      const flota = Math.sin(tiempo * 0.9 + i * 0.7) * 0.05 * t;
      for (let k = 0; k < 3; k += 1) {
        const a = this.hPos[i * 3 + k];
        const b = this.arbolPos[i * 3 + k];
        posiciones[i * 3 + k] = a + (b - a) * t + (k === 1 ? arco + flota : 0);
      }
      Quaternion.slerpFlat(rotaciones, i * 4, this.hRot, i * 4, this.arbolRot, i * 4, t);
    }
  }

  // ¿Hay algo del modelo bajo el rayo ya armado? En el árbol, el disco entero se puede agarrar.
  sobreDisco() {
    if (!this.modoArbol || this.arbolP < 0.6) return false;
    const rayo = this.espacio.rayo.copy(this.raycaster.ray).applyMatrix4(this.vector4.copy(this.eje.matrixWorld).invert());
    if (Math.abs(rayo.direction.y) < 1e-6) return false;
    const t = -rayo.origin.y / rayo.direction.y;
    if (t < 0) return false;
    const x = rayo.origin.x + rayo.direction.x * t;
    const z = rayo.origin.z + rayo.direction.z * t;
    return Math.hypot(x, z) <= ARBOL.radioEtiqueta + 0.6;
  }

  // Vista previa de una categoría (al pasar el mouse por el radar): enciende sus barras en la
  // hélice y su nodo en el árbol, sin filtrar. `null` la quita.
  previsualizar(categoriaId) {
    const categoria = categoriaId ? this.opciones.categorias?.find((c) => c.id === categoriaId) : null;
    this.previsualizarTecnologias(categoria?.tecnologias, categoriaId);
  }

  // Lo mismo para cualquier lista de tecnologías (ids), por ejemplo el stack de un proyecto.
  previsualizarTecnologias(ids, hubId = null) {
    if (!ids || !ids.length || !this.tecnologias) {
      this.previa = null;
      this.hubPrevia = -1;
      return;
    }
    const barras = ids.map((id) => this.barraDe.get(this.tecnologias.findIndex((t) => t.id === id))).filter((b) => b !== undefined);
    this.previa = new Set(barras);
    this.hubPrevia = hubId && this.disp ? this.disp.hubs.findIndex((h) => h.id === hubId) : -1;
  }

  // Filtro por categoría: `tecnologias` (índices en el catálogo) o null para todas. Las demás
  // barras quedan como vidrio vacío y la cinta se apura entre ellas.
  filtrar(tecnologias, categoriaId = null) {
    this.hubActivo = categoriaId && this.disp ? this.disp.hubs.findIndex((h) => h.id === categoriaId) : -1;
    this.filtro = tecnologias && tecnologias.length ? new Set(tecnologias.map((t) => this.barraDe.get(t))) : null;
    for (let i = 0; i < XILOFONO.cantidad; i += 1) this.objetivosActivas[i] = !this.filtro || this.filtro.has(i) ? 1 : 0;
    // En el árbol, un filtro que no es una categoría entera (por ejemplo el stack de un proyecto)
    // enciende las ramas y los nodos de sus tecnologías.
    this.aristasFiltro = null;
    this.hubsFiltro = null;
    if (this.filtro && this.disp && this.hubActivo === -1) {
      this.aristasFiltro = new Set();
      this.hubsFiltro = new Set();
      this.filtro.forEach((b) => {
        this.disp.rutas[b]?.forEach((a) => this.aristasFiltro.add(a));
        const k = this.disp.nodos[b]?.categoria;
        if (k !== undefined) this.hubsFiltro.add(k);
      });
    }
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
    this.cursor('');
    this.hover = -1;
    this.hubHover = -1;
    this.golpeAnterior = -1;
  }

  cursor(tipo) {
    if (tipo === this.cursorActual) return;
    this.cursorActual = tipo;
    this.opciones.alCursor?.(tipo);
  }

  rayoDesde(x, y) {
    const ndc = this.punteroNdc2.set((x / this.tamano.ancho) * 2 - 1, 1 - (y / this.tamano.alto) * 2);
    this.raycaster.setFromCamera(ndc, this.camara);
    return this.raycaster.ray;
  }

  /* ---------------------------- vista libre ---------------------------- */
  // Arrastre: en horizontal gira la hélice sobre su eje; en vertical, con zoom, la recorre.
  // Dos dedos: pellizco para el zoom. (x, y) relativos al canvas.
  // ¿Hay barras bajo este punto de la pantalla? (px del canvas)
  sobreModelo(x, y) {
    if (!this.instancias || !this.tamano.ancho) return false;
    this.rayoDesde(x, y);
    const { posiciones, rotaciones } = this.instancias;
    if (barraBajoRayo(this.raycaster.ray, posiciones, rotaciones, this.cajaAgarre, this.eje.matrixWorld, this.tiempo, this.uniforms.u_spinSpeed.value, this.espacio) !== -1) return true;
    if (this.modoArbol && this.arbol && this.arbol.hubBajoRayo(this.raycaster) !== -1) return true;
    return this.sobreDisco();
  }

  // Devuelve si el puntero quedó tomado (sólo se agarra el modelo desde las barras).
  bajarPuntero(id, x, y) {
    if (this.dedos.size === 0 && !this.sobreModelo(x, y)) return false;
    this.dedos.set(id, { x, y });
    if (this.dedos.size === 1) {
      // en el árbol, agarrar el nodo central desplaza todo el árbol en vez de girarlo
      const desdeNucleo = this.modoArbol && this.arbol && this.arbol.hubBajoRayo(this.raycaster) === -2;
      this.arrastre = { x, y, t: performance.now(), movido: false, modo: desdeNucleo ? 'mover' : 'girar' };
      this.vista.inercia = 0;
      this.vista.inerciaFase = 0;
    } else if (this.dedos.size === 2) {
      this.arrastre = null;
      const [a, b] = [...this.dedos.values()];
      this.pellizco = { distancia: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.vista.zoomObjetivo };
    }
    return true;
  }

  arrastrar(id, x, y) {
    if (!this.dedos.has(id)) return false;
    this.dedos.set(id, { x, y });
    if (this.dedos.size === 2 && this.pellizco) {
      const [a, b] = [...this.dedos.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      this.zoomA((this.pellizco.zoom * d) / Math.max(1, this.pellizco.distancia), (a.x + b.x) / 2, (a.y + b.y) / 2);
      return true;
    }
    const g = this.arrastre;
    if (!g) return false;
    const dx = x - g.x;
    const dy = y - g.y;
    const ahora = performance.now();
    if (!g.movido && Math.hypot(dx, dy) < 4) return false;
    g.movido = true;
    if (g.modo === 'mover') {
      // desplazar: el árbol sigue al puntero (se mueve la cámara en sentido contrario)
      const porPixel = this.altoVisible() / Math.max(1, this.tamano.alto);
      this.vista.xObjetivo -= dx * porPixel;
      this.vista.yObjetivo += dy * porPixel;
      this.limitarEncuadre(5);
      g.x = x;
      g.y = y;
      g.t = ahora;
      return true;
    }
    const paso = (dx / Math.max(1, this.tamano.ancho)) * Math.PI * 2.2;
    this.vista.giroObjetivo += paso;
    this.vista.inercia = paso / Math.max(0.008, (ahora - g.t) / 1000);
    if (this.modoArbol) {
      if (this.vista.zoomObjetivo > 1.05) {
        this.vista.yObjetivo += (dy / Math.max(1, this.tamano.alto)) * this.altoVisible();
        this.limitarEncuadre();
      }
    } else if (this.instancias) {
      // arrastrar hacia arriba o abajo recorre la hélice a mano, sobre su eje: las barras siguen
      // al puntero (cuántas barras equivale a un píxel depende del zoom)
      const altoBarra = this.instancias.alto * XILOFONO.grupo.escala;
      const barrasPorPixel = this.altoVisible() / Math.max(1, this.tamano.alto) / altoBarra;
      const dFase = -dy * barrasPorPixel;
      this.faseObjetivo += dFase;
      this.vista.inerciaFase = dFase / Math.max(0.008, (ahora - g.t) / 1000);
    }
    g.x = x;
    g.y = y;
    g.t = ahora;
    return true;
  }

  // Devuelve true si fue un toque (sin arrastrar): ahí se resuelve el clic sobre lo que haya.
  subirPuntero(id, x, y) {
    const eraToque = this.dedos.size === 1 && this.dedos.has(id) && this.arrastre && !this.arrastre.movido;
    this.dedos.delete(id);
    if (this.dedos.size < 2) this.pellizco = null;
    if (this.dedos.size === 0) this.arrastre = null;
    if (eraToque && x !== undefined) this.clic(x, y);
    return Boolean(eraToque);
  }

  // Toque sobre el modelo: una categoría del árbol la elige; una barra explota en color.
  clic(x, y) {
    if (!this.instancias) return;
    this.rayoDesde(x, y);
    this.limpiarBusqueda();
    if (this.modoArbol && this.arbol) {
      const hub = this.arbol.hubBajoRayo(this.raycaster);
      if (hub !== -1) {
        const id = hub === -2 ? null : this.disp.hubs[hub].id;
        this.seleccionArbol = -1;
        this.opciones.alCategoria?.(id !== null && id === this.disp.hubs[this.hubActivo]?.id ? null : id);
        return;
      }
    }
    const { posiciones, rotaciones, caja, golpes } = this.instancias;
    const barra = barraBajoRayo(this.raycaster.ray, posiciones, rotaciones, caja, this.eje.matrixWorld, this.tiempo, this.uniforms.u_spinSpeed.value, this.espacio);
    if (this.modoArbol) {
      // en el árbol, tocar una esfera ilumina sólo su hilo (sin explosión); tocar otra vez, o el
      // vacío, lo apaga
      this.seleccionArbol = barra === -1 || barra === this.seleccionArbol ? -1 : barra;
      if (this.seleccionArbol !== -1) {
        golpes.setX(barra, this.tiempo);
        golpes.needsUpdate = true;
      }
      return;
    }
    if (barra === -1) return;
    this.forzada = { barra, hasta: this.tiempo + 3.5, estallo: true };
    this.estallar(barra);
  }

  get arrastrando() {
    return Boolean(this.arrastre?.movido) || this.dedos.size > 1;
  }

  // Alto del mundo visible en el plano de la hélice (para pasar píxeles a unidades).
  altoVisible() {
    const d = this.distanciaBase / this.vista.zoom;
    return 2 * d * Math.tan((this.camara.fov * Math.PI) / 360);
  }

  // Zoom hacia un punto de la pantalla (x, y en px del canvas): lo que está bajo el cursor
  // queda bajo el cursor.
  zoomA(valor, x = this.tamano.ancho / 2, y = this.tamano.alto / 2) {
    const nuevo = limitarZoom(valor);
    const antes = this.distanciaBase / this.vista.zoomObjetivo;
    const despues = this.distanciaBase / nuevo;
    const tan = Math.tan((this.camara.fov * Math.PI) / 360);
    const nx = (x / Math.max(1, this.tamano.ancho)) * 2 - 1;
    const ny = 1 - (y / Math.max(1, this.tamano.alto)) * 2;
    const aspecto = this.camara.aspect;
    this.vista.xObjetivo += nx * tan * aspecto * (antes - despues);
    this.vista.yObjetivo -= ny * tan * (antes - despues);
    this.vista.zoomObjetivo = nuevo;
    if (nuevo <= 1.001) {
      this.vista.xObjetivo = 0;
      this.vista.yObjetivo = 0;
    }
    this.limitarEncuadre();
  }

  zoomRelativo(factor, x, y) {
    this.zoomA(this.vista.zoomObjetivo * factor, x, y);
  }

  limitarEncuadre(margen = 2.2) {
    this.vista.xObjetivo = Math.max(-margen, Math.min(margen, this.vista.xObjetivo));
    this.vista.yObjetivo = Math.max(-margen, Math.min(margen, this.vista.yObjetivo));
  }

  restablecerVista() {
    Object.assign(this.vista, { giroObjetivo: Math.round(this.vista.giro / (Math.PI * 2)) * Math.PI * 2, inercia: 0, zoomObjetivo: 1, xObjetivo: 0, yObjetivo: 0 });
  }

  actualizarVista(dt) {
    const v = this.vista;
    if (!this.arrastre && Math.abs(v.inercia) > 0.01) {
      v.giroObjetivo += v.inercia * dt;
      v.inercia *= Math.exp(-dt * 3.2);
    }
    // al soltar, la hélice sigue recorriéndose un poco por inercia
    if (!this.arrastre && !this.modoArbol && Math.abs(v.inerciaFase) > 0.02) {
      this.faseObjetivo += v.inerciaFase * dt;
      v.inerciaFase *= Math.exp(-dt * 3);
    }
    // el árbol gira solo despacio, como un plato (se frena al tocarlo o al apuntar una barra)
    if (this.modoArbol && !this.reducido && !this.arrastre && this.hover === -1 && this.hubHover === -1) v.giroObjetivo += dt * 0.16;
    v.giro = amortiguar(v.giro, v.giroObjetivo, 10, dt);
    v.zoom = amortiguar(v.zoom, v.zoomObjetivo, 9, dt);
    v.x = amortiguar(v.x, v.xObjetivo, 9, dt);
    v.y = amortiguar(v.y, v.yObjetivo, 9, dt);
    this.eje.rotation.y = v.giro;
    this.camara.position.set(v.x, v.y, this.distanciaBase / v.zoom);
    // al girar, la barra que queda de frente cambia: se recalcula el foco
    if (Math.abs(v.giro - this.giroFoco) > 0.03) this.lugarFoco = null;
  }

  /* ------------------------- buscador y explosión ------------------------- */
  // Trae la barra de una tecnología (índice en el catálogo) al foco, la resalta y la hace
  // explotar en color al llegar.
  enfocar(tecnologia) {
    const barra = this.barraDe.get(tecnologia);
    if (barra === undefined || !this.instancias) return;
    this.busqueda = barra;
    this.instancias.golpes.setX(barra, this.tiempo);
    this.instancias.golpes.needsUpdate = true;
    if (this.modoArbol) {
      // en el árbol, buscar una tecnología enciende su hilo (sin explosión)
      this.seleccionArbol = barra;
      return;
    }
    if (this.lugarFoco === null) this.calcularFoco();
    const n = XILOFONO.cantidad;
    const lugar = (((barra + this.faseObjetivo) % n) + n) % n;
    let delta = this.lugarFoco - lugar;
    delta = ((((delta + n / 2) % n) + n) % n) - n / 2; // por el camino más corto
    this.faseObjetivo += delta; // la cinta queda quieta con esa barra al frente (ver ritmo)
    this.forzada = null;
  }

  // Quita la tecnología buscada: todo vuelve a lo normal.
  limpiarBusqueda() {
    if (this.busqueda !== -1 && this.seleccionArbol === this.busqueda) this.seleccionArbol = -1;
    this.busqueda = -1;
  }

  // Explosión de color: tiñe todas las barras de golpe, una ola de vaivén recorre la cinta y
  // el fluido estalla desde `barra` (o desde el centro del modelo).
  estallar(barra = -1) {
    if (!this.instancias) return;
    const { posiciones, golpes } = this.instancias;
    const centro = barra !== -1 ? centroDeBarra(barra, posiciones, this.eje.matrixWorld, this.vector) : this.vector.setFromMatrixPosition(this.eje.matrixWorld);
    centro.project(this.camara);
    this.fluido.config.aspecto = this.tamano.ancho / Math.max(1, this.tamano.alto);
    this.fluido.estallar(new Vector2(centro.x * 0.5 + 0.5, centro.y * 0.5 + 0.5), this.tiempo);
    // la ola de vaivén sale de la barra tocada (o del centro) y recorre el modelo por distancia
    const n = XILOFONO.cantidad;
    const ox = barra !== -1 ? posiciones[barra * 3] : 0;
    const oy = barra !== -1 ? posiciones[barra * 3 + 1] : 0;
    const oz = barra !== -1 ? posiciones[barra * 3 + 2] : 0;
    for (let i = 0; i < n; i += 1) {
      const d = Math.hypot(posiciones[i * 3] - ox, posiciones[i * 3 + 1] - oy, posiciones[i * 3 + 2] - oz);
      golpes.setX(i, this.tiempo + d * 0.11);
    }
    golpes.needsUpdate = true;
    // la explosión la pide el usuario (botón o toque): va siempre, también con animaciones reducidas
    this.uniforms.u_destello.value = 1;
  }

  /* ------------------------------- ciclo ------------------------------- */
  redimensionar(ancho, alto) {
    if (ancho === this.tamano.ancho && alto === this.tamano.alto) return;
    this.tamano = { ancho, alto };
    this.renderer.setSize(ancho, alto, false);
    this.compositor.setSize(ancho, alto, false);
    this.renderer.getDrawingBufferSize(this.uniforms.u_resolucion.value);
    this.camara.aspect = ancho / alto;
    this.uniformsFondo.u_aspecto.value = this.camara.aspect;
    // en pantallas angostas la hélice no entra a lo ancho: se aleja la cámara
    this.distanciaBase = this.camara.aspect < 1 ? 5 / Math.max(0.55, this.camara.aspect) : 5;
    this.camara.position.z = this.distanciaBase / this.vista.zoom;
    // en pantallas anchas la hélice va a la derecha, para dejar el título libre
    const ancha = this.camara.aspect > 1.2;
    this.posicionGrupo.helice.x = ancha ? Math.min(1.1, (this.camara.aspect - 1.2) * 1.6) : 0;
    this.posicionGrupo.helice.y = ancha ? 0 : this.camara.aspect < 1 ? -1.1 : -0.35;
    // el árbol es un disco: entra en el alto, así que se achica en pantallas bajas o angostas
    this.posicionGrupo.arbol.x = ancha ? Math.min(1.2, (this.camara.aspect - 1.2) * 3) : 0;
    this.posicionGrupo.arbol.y = ancha ? -0.1 : this.camara.aspect < 1 ? -0.9 : -0.3;
    this.posicionGrupo.escalaArbol = ancha ? 0.28 : this.camara.aspect < 1 ? 0.22 : 0.26;
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
    this.uniformsFondo.u_time.value += dt * AURORA.velocidad * (this.reducido ? 0 : 1);
    // el fondo sigue al puntero con algo de retraso (y se calma cuando sale)
    if (this.puntero) {
      this.ratonFondo.x = amortiguar(this.ratonFondo.x, this.puntero.x, 3, dt);
      this.ratonFondo.y = amortiguar(this.ratonFondo.y, this.puntero.y, 3, dt);
    }
    this.uniformsFondo.u_raton.value.copy(this.ratonFondo);
    this.uniformsFondo.u_ratonFuerza.value = amortiguar(this.uniformsFondo.u_ratonFuerza.value, this.puntero && !this.reducido ? 1 : 0, 2.5, dt);
    this.uniforms.u_destello.value = amortiguar(this.uniforms.u_destello.value, 0, 1.4, dt);

    this.fluido.resolver(this.puntero, this.tiempo, dt, this.tamano.ancho / this.tamano.alto);
    this.actualizarVista(dt);
    this.actualizarGrupo(dt);
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
    if (this.modoArbol || this.hover !== -1 || this.arrastrando || this.busqueda !== -1 || (this.forzada && this.tiempo < this.forzada.hasta)) ritmo = 0;
    else if (this.filtro && (this.enFoco === -1 || !this.filtro.has(this.enFoco))) ritmo = 7;
    this.faseObjetivo = avanzarFase(this.faseObjetivo, this.modoArbol ? 0 : delta, dt, XILOFONO, this.reducido, ritmo);
    this.fase = amortiguar(this.fase, this.faseObjetivo, XILOFONO.scroll.suavizado, dt);
    const enArbol = this.arbolP > 0.0005 && Boolean(this.disp);
    // en el árbol se reescribe siempre (las monedas flotan); en la hélice, sólo si se movió
    if (!enArbol && !this.huboArbol && Math.abs(this.fase - this.faseEscrita) <= 1e-5) return;
    const { posiciones, rotaciones, alto, geometria } = this.instancias;
    escribirHelice(this.fase, alto, XILOFONO, enArbol ? this.hPos : posiciones, enArbol ? this.hRot : rotaciones, this.euler, this.cuaternion);
    if (enArbol) this.mezclarArbol(this.tiempo);
    geometria.attributes.aPos.needsUpdate = true;
    geometria.attributes.aRot.needsUpdate = true;
    this.faseEscrita = this.fase;
    this.huboArbol = enArbol;
  }

  // Pasar el mouse por una barra la golpea (vaivén) y la resalta mientras esté encima.
  actualizarHover() {
    if (!this.puntero || this.arrastrando) return;
    const { posiciones, rotaciones, caja, golpes } = this.instancias;
    this.raycaster.setFromCamera(this.punteroNdc, this.camara);
    let i = barraBajoRayo(this.raycaster.ray, posiciones, rotaciones, caja, this.eje.matrixWorld, this.tiempo, this.uniforms.u_spinSpeed.value, this.espacio);
    // en el árbol, las categorías (nodo, etiqueta del borde) también se apuntan
    const hub = this.modoArbol && this.arbol ? this.arbol.hubBajoRayo(this.raycaster) : -1;
    if (hub !== -1) i = -1;
    this.hubHover = hub >= 0 ? hub : -1;
    if (i !== -1 && i !== this.golpeAnterior) {
      golpes.setX(i, this.tiempo);
      golpes.needsUpdate = true;
    }
    this.golpeAnterior = i;
    this.hover = i;
    this.cursor(hub === -2 ? 'move' : hub !== -1 ? 'pointer' : i !== -1 ? 'grab' : this.modoArbol && this.sobreDisco() ? 'grab' : '');
  }

  // Lugar de foco: el de la barra que, con la cinta quieta, queda más de frente y centrada.
  // Las barras no giran sobre sí mismas, así que se calcula una vez.
  calcularFoco() {
    const { posiciones, rotaciones } = this.instancias;
    for (let i = 0; i < XILOFONO.cantidad; i += 1) {
      const c = centroDeBarra(i, posiciones, this.eje.matrixWorld, this.vector);
      this.centros[i].x = c.x;
      this.centros[i].y = c.y;
      this.centros[i].z = c.z;
      this.centros[i].frente = frenteDeBarra(i, rotaciones, this.eje.matrixWorld, this.tiempo, 0, this.direccion, this.espacio);
    }
    this.giroFoco = this.vista.giro;
    const barra = elegirResaltada(this.centros);
    const n = XILOFONO.cantidad;
    this.lugarFoco = (((barra + this.faseEscrita) % n) + n) % n;
  }

  // Recorrido continuo: cada barra se enciende según qué tan cerca del foco pasa. Con el mouse
  // encima, se enciende la apuntada. Con un filtro, sólo las de la categoría.
  actualizarResalte(dt) {
    if (this.modoArbol) {
      this.actualizarResalteArbol(dt);
      return;
    }
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
      this.activasEfectivas[i] = activa * (this.busqueda !== -1 && i !== this.busqueda ? 0.3 : 1);
      const pedida = this.busqueda !== -1 ? this.busqueda : this.forzada && this.tiempo < this.forzada.hasta ? this.forzada.barra : -1;
      const elegida = this.hover !== -1 ? this.hover : pedida;
      this.objetivos[i] = elegida !== -1 ? (i === elegida ? 1 : 0) : r * activa;
      if (this.previa && this.previa.has(i)) this.objetivos[i] = Math.max(this.objetivos[i], 0.75);
      // con una categoría elegida, sus barras muestran su nombre (y logo en blanco) de forma fija,
      // no sólo mientras el mouse está sobre el dock ni mientras no se apunta otra barra
      if (this.filtro && this.filtro.has(i) && this.busqueda === -1) this.objetivos[i] = Math.max(this.objetivos[i], 0.7);
    }
    // la barra que entra al foco da un golpecito (el vaivén del original)
    if (enFoco !== this.enFoco && enFoco !== -1 && this.hover === -1 && this.objetivosActivas[enFoco] > 0) {
      golpes.setX(enFoco, this.tiempo);
      golpes.needsUpdate = true;
    }
    this.enFoco = enFoco;
    if (acercarValores(resaltes.array, this.objetivos, dt, 10)) resaltes.needsUpdate = true;
    if (acercarValores(activas.array, this.activasEfectivas, dt, 6)) activas.needsUpdate = true;
    this.uniforms.u_filtro.value = amortiguar(this.uniforms.u_filtro.value, this.filtro ? 1 : 0, 6, dt);
    // saliendo del árbol: las piezas del árbol se van apagando
    if (this.arbol && this.arbolP > 0.001) {
      this.arbol.actualizar(this.tiempo, dt, this.arbolP, { foco: -1, posFoco: null, hubActivo: -1, hubHover: -1 });
    }
  }

  // En el árbol sólo se enciende lo que se apunta o se tocó: esa esfera y su hilo desde el núcleo.
  // Nada se recorre solo.
  actualizarResalteArbol(dt) {
    const { resaltes, activas } = this.instancias;
    const n = XILOFONO.cantidad;
    const listo = this.arbolP > 0.9;
    const elegida = listo ? (this.hover !== -1 ? this.hover : this.seleccionArbol) : -1;
    for (let i = 0; i < n; i += 1) {
      this.objetivos[i] = i === elegida ? 1 : this.previa && this.previa.has(i) ? 0.55 : 0;
      this.activasEfectivas[i] = this.objetivosActivas[i] * (this.busqueda !== -1 && i !== this.busqueda ? 0.3 : 1);
    }
    if (acercarValores(resaltes.array, this.objetivos, dt, 10)) resaltes.needsUpdate = true;
    if (acercarValores(activas.array, this.activasEfectivas, dt, 6)) activas.needsUpdate = true;
    this.uniforms.u_filtro.value = amortiguar(this.uniforms.u_filtro.value, this.filtro ? 1 : 0, 6, dt);
    const posiciones = this.instancias.posiciones;
    const posFoco = elegida >= 0 ? this.vector.set(posiciones[elegida * 3], posiciones[elegida * 3 + 1], posiciones[elegida * 3 + 2]) : null;
    this.arbol.actualizar(this.tiempo, dt, this.arbolP, {
      foco: elegida,
      posFoco,
      soloFoco: listo && this.seleccionArbol !== -1,
      hubActivo: this.hubActivo,
      hubHover: this.hubHover !== -1 ? this.hubHover : this.hubPrevia,
      aristasFiltro: this.aristasFiltro,
      hubsFiltro: this.hubsFiltro,
    });
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
    this.materialAtras?.dispose();
    this.instancias?.geometria.dispose();
    this.geometriaEsferas?.dispose();
    this.materialEsferas?.dispose();
    this.materialEsferasAtras?.dispose();
    this.arbol?.liberar();
    this.fondo.geometry.dispose();
    this.materialesFondo.forEach((m) => m.dispose());
    this.uniforms.u_tGradient.value?.dispose();
    this.uniforms.u_tAtlas.value?.dispose();
    this.uniforms.u_tNombres.value?.dispose();
    this.renderer.dispose();
  }
}
