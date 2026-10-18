import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  LinearFilter,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  Points,
  Quaternion,
  RingGeometry,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
} from 'three';
import { amortiguar, suave } from '@/lib/xilofono.js';

// Piezas visuales del árbol de habilidades (el diseño sale de lib/arbol.js): núcleo, un nodo por
// categoría, las ramas con pulsos de luz que viajan hacia afuera, etiquetas y partículas que
// orbitan. Todo vive en el eje del modelo, así gira con él. Las 64 barras son las del xilófono.

const limitar = (t) => Math.min(1, Math.max(0, t));

/* ------------------------------------------------------------------------ */
/*                                  shaders                                 */
/* ------------------------------------------------------------------------ */
const ORBE_VERT = /* glsl */ `
varying vec3 vNormal;
varying vec3 vVista;
varying vec3 vPos;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vVista = normalize(-mv.xyz);
  vPos = position;
  gl_Position = projectionMatrix * mv;
}
`;

// Esfera de luz: borde brillante (fresnel) y un ondulado interno que se mueve.
const ORBE_FRAG = /* glsl */ `
uniform float u_time;
uniform float u_brillo;
uniform float u_aparece;
uniform vec3 u_c1;
uniform vec3 u_c2;
varying vec3 vNormal;
varying vec3 vVista;
varying vec3 vPos;
void main() {
  float f = pow(1.0 - max(dot(normalize(vNormal), normalize(vVista)), 0.0), 2.0);
  float onda = 0.5 + 0.5 * sin(vPos.y * 11.0 + vPos.x * 7.0 + u_time * 2.2);
  vec3 col = mix(u_c1, u_c2, clamp(f + onda * 0.25, 0.0, 1.0));
  float a = (0.22 + f * 0.85 + onda * 0.14) * u_brillo * u_aparece;
  gl_FragColor = vec4(col * (0.85 + f * 0.9), clamp(a, 0.0, 1.0));
}
`;

const ARISTA_VERT = /* glsl */ `
attribute float aBrillo;
attribute float aFase;
varying float vAlong;
varying float vBrillo;
varying float vFase;
void main() {
  vAlong = position.z + 0.5;
  vBrillo = aBrillo;
  vFase = aFase;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
}
`;

// Rama: una línea fina con pulsos de luz que viajan del centro hacia afuera; los pulsos y el
// brillo suben cuando la rama es la del foco o la de la categoría elegida.
const ARISTA_FRAG = /* glsl */ `
uniform float u_time;
uniform float u_aparece;
uniform vec3 u_c1;
uniform vec3 u_c2;
varying float vAlong;
varying float vBrillo;
varying float vFase;
void main() {
  float pulso = pow(max(0.0, sin((vAlong * 1.6 - u_time * 1.1 + vFase) * 6.2831853)), 7.0);
  // con el brillo en cero el hilo se apaga del todo, pulsos incluidos (hilo no elegido)
  float base = 0.04 + 0.7 * vBrillo;
  vec3 col = mix(u_c1, u_c2, clamp(vAlong + pulso * 0.4, 0.0, 1.0));
  float a = (base + pulso * (0.04 + 1.25 * vBrillo)) * u_aparece;
  gl_FragColor = vec4(col * (1.0 + pulso * 1.1), clamp(a, 0.0, 1.0));
}
`;

const PARTICULA_VERT = /* glsl */ `
attribute float aSemilla;
uniform float u_time;
uniform float u_aparece;
varying float vBrillo;
void main() {
  float radio = length(position.xz);
  float ang = atan(position.z, position.x) + u_time * (0.05 + aSemilla * 0.12) * (1.0 + 1.5 / (radio + 0.5));
  vec3 p = vec3(cos(ang) * radio, position.y + sin(u_time * 0.7 + aSemilla * 40.0) * 0.12, sin(ang) * radio);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (2.0 + aSemilla * 3.5) * 9.0 / -mv.z * u_aparece;
  vBrillo = 0.35 + 0.65 * (0.5 + 0.5 * sin(u_time * (1.0 + aSemilla * 2.0) + aSemilla * 30.0));
}
`;

const PARTICULA_FRAG = /* glsl */ `
uniform vec3 u_c2;
varying float vBrillo;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d) * vBrillo;
  gl_FragColor = vec4(u_c2, a);
}
`;

/* ------------------------------------------------------------------------ */
/*                                 etiquetas                                */
/* ------------------------------------------------------------------------ */
function familia() {
  return typeof document !== 'undefined' ? getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif' : 'sans-serif';
}

function rectRedondo(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// Etiqueta de categoría (en el borde del árbol): texto con un resplandor suave.
function texturaCategoria(nombre, tema) {
  const lienzo = document.createElement('canvas');
  lienzo.width = 512;
  lienzo.height = 128;
  const ctx = lienzo.getContext('2d');
  ctx.font = `800 54px ${familia()}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = tema === 'light' ? 'rgba(10, 60, 200, 0.35)' : 'rgba(61, 162, 255, 0.9)';
  ctx.shadowBlur = 18;
  ctx.fillStyle = tema === 'light' ? '#10204a' : '#ffffff';
  ctx.fillText(nombre.toUpperCase(), 256, 66);
  const textura = new CanvasTexture(lienzo);
  textura.colorSpace = SRGBColorSpace;
  textura.minFilter = LinearFilter;
  return textura;
}

// Aro de una categoría: su nombre repetido en círculo, dibujado plano. La textura es cuadrada y
// cubre el diámetro exterior del aro (0,52); el texto va por una circunferencia de radio 0,41,
// letra por letra, con la parte de arriba de cada letra mirando hacia afuera.
const ARO = { interior: 0.3, exterior: 0.52, texto: 0.41 };

function texturaAro(nombre, tema) {
  const tam = 1024;
  const lienzo = document.createElement('canvas');
  lienzo.width = tam;
  lienzo.height = tam;
  const ctx = lienzo.getContext('2d');
  const centro = tam / 2;
  const radio = (ARO.texto / ARO.exterior) * centro; // radio del texto, en píxeles
  const circunferencia = Math.PI * 2 * radio;
  const texto = Array.from(nombre.toUpperCase());
  const separador = Array.from('     ');
  const base = 112;
  ctx.font = `800 ${base}px ${familia()}`;
  const ancho = (letras) => letras.reduce((suma, l) => suma + ctx.measureText(l).width, 0);
  const unidad = ancho(texto) + ancho(separador);
  // cuántas veces entra el nombre en la vuelta; si no entra ni una, se achica para que entre
  const veces = Math.max(1, Math.floor(circunferencia / unidad));
  const fuente = Math.floor(Math.min(base, (base * circunferencia) / unidad));
  ctx.font = `800 ${fuente}px ${familia()}`;
  const escala = fuente / base;
  const hueco = (circunferencia - veces * unidad * escala) / veces; // lo que sobra se reparte entre repeticiones
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = tema === 'light' ? 'rgba(10, 60, 200, 0.25)' : 'rgba(61, 162, 255, 0.85)';
  ctx.shadowBlur = 8;
  ctx.fillStyle = tema === 'light' ? '#10204a' : '#ffffff';
  let recorrido = 0; // largo de arco ya usado
  for (let v = 0; v < veces; v += 1) {
    [...texto, ...separador].forEach((letra) => {
      const w = ctx.measureText(letra).width;
      const angulo = (recorrido + w / 2) / radio;
      ctx.save();
      ctx.translate(centro + Math.sin(angulo) * radio, centro - Math.cos(angulo) * radio);
      ctx.rotate(angulo);
      ctx.fillText(letra, 0, 4);
      ctx.restore();
      recorrido += w;
    });
    recorrido += hueco;
  }
  const textura = new CanvasTexture(lienzo);
  textura.colorSpace = SRGBColorSpace;
  textura.minFilter = LinearFilter;
  textura.anisotropy = 4;
  return textura;
}

// Cartel de la tecnología en foco: una píldora de vidrio chica, del ancho justo del nombre, con
// su categoría debajo. Devuelve la textura y su relación ancho/alto.
function texturaCartel(nombre, categoria, tema) {
  const alto = 128;
  const medida = document.createElement('canvas').getContext('2d');
  medida.font = `800 50px ${familia()}`;
  const anchoNombre = medida.measureText(nombre).width;
  medida.font = `700 19px ${familia()}`;
  const anchoCategoria = medida.measureText(categoria.toUpperCase()).width + categoria.length * 2.5;
  const ancho = Math.ceil(Math.max(anchoNombre, anchoCategoria) + 76);
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext('2d');
  rectRedondo(ctx, 4, 4, ancho - 8, alto - 8, (alto - 8) / 2);
  ctx.fillStyle = tema === 'light' ? 'rgba(255, 255, 255, 0.94)' : 'rgba(6, 12, 40, 0.86)';
  ctx.fill();
  const borde = ctx.createLinearGradient(0, 0, ancho, 0);
  borde.addColorStop(0, '#1a00ff');
  borde.addColorStop(0.55, '#3da2ff');
  borde.addColorStop(1, '#a8e8ff');
  ctx.lineWidth = 3;
  ctx.strokeStyle = borde;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = tema === 'light' ? '#10204a' : '#ffffff';
  ctx.font = `800 50px ${familia()}`;
  ctx.fillText(nombre, ancho / 2, 55);
  ctx.fillStyle = tema === 'light' ? '#1a3fa8' : '#8fc8ff';
  ctx.font = `700 19px ${familia()}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
  ctx.fillText(categoria.toUpperCase(), ancho / 2, 97);
  const textura = new CanvasTexture(lienzo);
  textura.colorSpace = SRGBColorSpace;
  textura.minFilter = LinearFilter;
  return { textura, aspecto: ancho / alto };
}

/* ------------------------------------------------------------------------ */
/*                                   clase                                  */
/* ------------------------------------------------------------------------ */
export class ArbolHabilidades {
  // disp: salida de disposicionArbol. nombreDe(barra) → nombre de la tecnología de esa barra.
  constructor(disp, { nombreDe }) {
    this.disp = disp;
    this.nombreDe = nombreDe;
    this.tema = 'dark';
    this.grupo = new Group();
    this.grupo.visible = false;

    this.uniformes = {
      u_time: { value: 0 },
      u_aparece: { value: 0 },
      u_c1: { value: new Color('#3da2ff') },
      u_c2: { value: new Color('#c8f0ff') },
    };
    this.materiales = [];
    this.geometrias = [];
    this.texturas = [];
    this.carteles = new Map();
    this.cartelBarra = -1;

    this.crearAristas();
    this.crearNucleo();
    this.hubs = disp.hubs.map((hub, k) => this.crearHub(hub, k));
    this.crearParticulas();
    this.crearCartel();
    this.brilloHubs = new Float32Array(disp.hubs.length).fill(0.4);
    this.escalaHubs = new Float32Array(disp.hubs.length);
    // objetivos de resalte de las ramas (se suavizan en actualizar)
    this.brilloAristas = new Float32Array(disp.aristas.length).fill(0.28);
  }

  material(parametros) {
    const m = new ShaderMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, ...parametros });
    this.materiales.push(m);
    return m;
  }

  geometria(g) {
    this.geometrias.push(g);
    return g;
  }

  /* ------------------------------- ramas ------------------------------- */
  crearAristas() {
    const { aristas } = this.disp;
    // cilindro fino a lo largo de z, de -0,5 a 0,5
    const base = this.geometria(new CylinderGeometry(0.016, 0.016, 1, 6, 1, true));
    base.rotateX(Math.PI / 2);
    const malla = new InstancedMesh(base, this.material({ vertexShader: ARISTA_VERT, fragmentShader: ARISTA_FRAG, uniforms: this.uniformes }), aristas.length);
    const matriz = new Matrix4();
    const cuaternion = new Quaternion();
    const eje = new Vector3(0, 0, 1);
    const a = new Vector3();
    const b = new Vector3();
    const dir = new Vector3();
    const medio = new Vector3();
    aristas.forEach((arista, i) => {
      a.fromArray(arista.de);
      b.fromArray(arista.a);
      dir.subVectors(b, a);
      const largo = dir.length();
      medio.addVectors(a, b).multiplyScalar(0.5);
      cuaternion.setFromUnitVectors(eje, dir.normalize());
      matriz.compose(medio, cuaternion, new Vector3(1, 1, largo));
      malla.setMatrixAt(i, matriz);
    });
    base.setAttribute('aBrillo', new InstancedBufferAttribute(new Float32Array(aristas.length).fill(0.28), 1));
    base.setAttribute('aFase', new InstancedBufferAttribute(Float32Array.from({ length: aristas.length }, (_, i) => (i * 0.618034) % 1), 1));
    malla.frustumCulled = false;
    malla.renderOrder = 1;
    this.aristas = malla;
    this.grupo.add(malla);
  }

  /* ------------------------------- núcleo ------------------------------- */
  crearNucleo() {
    const material = this.material({
      vertexShader: ORBE_VERT,
      fragmentShader: ORBE_FRAG,
      uniforms: { ...this.uniformes, u_brillo: { value: 1 } },
    });
    const nucleo = new Mesh(this.geometria(new SphereGeometry(0.46, 32, 24)), material);
    nucleo.renderOrder = 2;
    nucleo.userData.hub = -2;
    // dos anillos que giran en sentidos opuestos
    const anilloMaterial = new MeshBasicMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0.55, color: '#a8e8ff' });
    this.materiales.push(anilloMaterial);
    const anillos = [0, 1].map((i) => {
      const anillo = new Mesh(this.geometria(new TorusGeometry(0.66 + i * 0.12, 0.011, 8, 72)), anilloMaterial);
      anillo.rotation.x = Math.PI / 2 + (i === 0 ? 0.35 : -0.35);
      anillo.renderOrder = 2;
      nucleo.add(anillo);
      return anillo;
    });
    this.nucleo = nucleo;
    this.anillosNucleo = anillos;
    this.anilloMaterial = anilloMaterial;
    this.grupo.add(nucleo);
  }

  /* -------------------------------- hubs -------------------------------- */
  crearHub(hub, k) {
    const grupo = new Group();
    grupo.position.set(hub.x, hub.y, hub.z);
    const material = this.material({
      vertexShader: ORBE_VERT,
      fragmentShader: ORBE_FRAG,
      uniforms: { ...this.uniformes, u_brillo: { value: 0.4 } },
    });
    const orbe = new Mesh(this.geometria(new SphereGeometry(0.2, 24, 18)), material);
    orbe.renderOrder = 2;
    orbe.userData.hub = k;
    // el aro lleva el nombre de la categoría, plano sobre el plano del árbol: un anillo chato con el
    // texto en círculo, que gira despacio
    const aroMaterial = new MeshBasicMaterial({ transparent: true, depthWrite: false, side: DoubleSide, blending: AdditiveBlending, opacity: 0 });
    this.materiales.push(aroMaterial);
    const aro = new Mesh(this.geometria(new RingGeometry(ARO.interior, ARO.exterior, 72, 1)), aroMaterial);
    aro.rotation.x = -Math.PI / 2; // acostado: la cara mira hacia arriba
    aro.renderOrder = 2;
    aro.userData.hub = k;
    // sin aro dibujado: sólo el nombre de la categoría, en círculo alrededor del nodo
    grupo.add(orbe, aro);
    // etiqueta de la categoría, en el borde del árbol
    const etiquetaMaterial = new SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false });
    this.materiales.push(etiquetaMaterial);
    const etiqueta = new Sprite(etiquetaMaterial);
    etiqueta.position.set(hub.etiqueta.x, hub.etiqueta.y, hub.etiqueta.z);
    etiqueta.scale.set(2.2, 0.55, 1);
    etiqueta.renderOrder = 5;
    etiqueta.userData.hub = k;
    this.grupo.add(grupo, etiqueta);
    return { grupo, orbe, material, aro, aroMaterial, anilloMaterial: aroMaterial, etiqueta, etiquetaMaterial, textura: null, texturaAro: null };
  }

  /* ----------------------------- partículas ----------------------------- */
  crearParticulas() {
    const cantidad = 340;
    const posiciones = new Float32Array(cantidad * 3);
    const semillas = new Float32Array(cantidad);
    for (let i = 0; i < cantidad; i += 1) {
      const radio = 0.9 + Math.pow(Math.random(), 0.7) * 5.6;
      const angulo = Math.random() * Math.PI * 2;
      posiciones[i * 3] = Math.cos(angulo) * radio;
      posiciones[i * 3 + 1] = (Math.random() - 0.5) * 1.1;
      posiciones[i * 3 + 2] = Math.sin(angulo) * radio;
      semillas[i] = Math.random();
    }
    const geometria = this.geometria(new BufferGeometry());
    geometria.setAttribute('position', new Float32BufferAttribute(posiciones, 3));
    geometria.setAttribute('aSemilla', new Float32BufferAttribute(semillas, 1));
    const puntos = new Points(geometria, this.material({ vertexShader: PARTICULA_VERT, fragmentShader: PARTICULA_FRAG, uniforms: this.uniformes }));
    puntos.frustumCulled = false;
    puntos.renderOrder = 0;
    puntos.raycast = () => {};
    this.particulas = puntos;
    this.grupo.add(puntos);
  }

  /* ------------------------------- cartel ------------------------------- */
  crearCartel() {
    const material = new SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false, opacity: 0 });
    this.materiales.push(material);
    const cartel = new Sprite(material);
    cartel.renderOrder = 6;
    cartel.raycast = () => {};
    this.cartel = cartel;
    this.grupo.add(cartel);
  }

  /* -------------------------------- tema -------------------------------- */
  aplicarTema(tema) {
    this.tema = tema;
    const claro = tema === 'light';
    this.uniformes.u_c1.value.set(claro ? '#1a2fd6' : '#3da2ff');
    this.uniformes.u_c2.value.set(claro ? '#0a5cff' : '#c8f0ff');
    // sobre fondo claro la luz aditiva no se ve: se pasa a mezcla normal con colores oscuros
    const mezcla = claro ? NormalBlending : AdditiveBlending;
    this.materiales.forEach((m) => {
      if (m.blending !== undefined && m !== this.cartel.material && !m.isSpriteMaterial) m.blending = mezcla;
    });
    this.anilloMaterial.color.set(claro ? '#1a3fa8' : '#a8e8ff');
    this.hubs.forEach((h, k) => {
      const nombre = this.disp.hubs[k].nombre;
      h.textura?.dispose();
      h.textura = texturaCategoria(nombre, tema);
      h.etiquetaMaterial.map = h.textura;
      h.etiquetaMaterial.needsUpdate = true;
      h.texturaAro?.dispose();
      h.texturaAro = texturaAro(nombre, tema);
      h.aroMaterial.map = h.texturaAro;
      h.aroMaterial.needsUpdate = true;
    });
    // los carteles ya dibujados quedaron con el tema anterior
    this.carteles.forEach((c) => c.textura.dispose());
    this.carteles.clear();
    this.cartelBarra = -1;
  }

  /* ------------------------------ por cuadro ------------------------------ */
  // p: progreso 0..1 de la transición; e: { foco (barra | -1), posFoco (Vector3 | null),
  // hubActivo, hubHover }
  actualizar(tiempo, dt, p, e) {
    const visible = p > 0.001;
    this.grupo.visible = visible;
    if (!visible) return;
    this.uniformes.u_time.value = tiempo;
    this.uniformes.u_aparece.value = suave(limitar((p - 0.55) / 0.4));
    const { disp } = this;

    // núcleo: aparece primero y late
    const sNucleo = suave(limitar(p / 0.5));
    this.nucleo.scale.setScalar(sNucleo * (1 + 0.05 * Math.sin(tiempo * 2.2)));
    this.anillosNucleo.forEach((a, i) => {
      a.rotation.z = tiempo * (i === 0 ? 0.6 : -0.45);
    });
    this.anilloMaterial.opacity = 0.55 * sNucleo;

    // categorías
    const categoriaFoco = e.foco >= 0 ? disp.nodos[e.foco].categoria : -1;
    this.hubs.forEach((hub, k) => {
      const meta =
        e.hubActivo === k ? 1 : e.hubHover === k ? 0.95 : categoriaFoco === k ? 0.85 : e.hubsFiltro ? (e.hubsFiltro.has(k) ? 0.8 : 0.12) : e.hubActivo !== -1 ? 0.12 : 0.4;
      this.brilloHubs[k] = amortiguar(this.brilloHubs[k], meta, 8, dt);
      const aparece = suave(limitar((p - 0.3 - k * 0.025) / 0.35));
      const crece = 1 + (e.hubActivo === k || e.hubHover === k ? 0.25 : 0) + this.brilloHubs[k] * 0.1;
      this.escalaHubs[k] = amortiguar(this.escalaHubs[k], aparece * crece, 10, dt);
      hub.grupo.scale.setScalar(Math.max(0.0001, this.escalaHubs[k]));
      hub.material.uniforms.u_brillo.value = this.brilloHubs[k];
      // el aro con el nombre gira despacio sobre el plano (cada uno para su lado)
      hub.aro.rotation.z = tiempo * 0.22 * (k % 2 ? 1 : -1);
      hub.aroMaterial.opacity = aparece * (0.35 + 0.65 * this.brilloHubs[k]);
      hub.etiquetaMaterial.opacity = suave(limitar((p - 0.7) / 0.3)) * (e.hubActivo !== -1 && e.hubActivo !== k ? 0.4 : 1);
    });

    // ramas: la del foco al máximo, las de la categoría elegida encendidas, el resto tenues
    const ruta = e.foco >= 0 ? disp.rutas[e.foco] : null;
    const atributo = this.aristas.geometry.attributes.aBrillo;
    for (let a = 0; a < disp.aristas.length; a += 1) {
      let meta = e.aristasFiltro ? (e.aristasFiltro.has(a) ? 0.7 : 0.05) : e.hubActivo === -1 ? 0.28 : disp.aristas[a].hub === e.hubActivo ? 0.62 : 0.06;
      if (e.soloFoco) meta = 0.03; // esfera tocada: sólo su hilo queda encendido
      if (ruta && ruta.includes(a)) meta = 1;
      this.brilloAristas[a] = amortiguar(this.brilloAristas[a], meta, 7, dt);
      atributo.array[a] = this.brilloAristas[a];
    }
    atributo.needsUpdate = true;

    // cartel de la tecnología en foco
    const mostrar = e.foco >= 0 && e.posFoco && p > 0.85;
    if (mostrar) {
      if (this.cartelBarra !== e.foco) {
        this.cartelBarra = e.foco;
        if (!this.carteles.has(e.foco)) {
          this.carteles.set(e.foco, texturaCartel(this.nombreDe(e.foco), disp.hubs[disp.nodos[e.foco].categoria].nombre, this.tema));
        }
        const { textura, aspecto } = this.carteles.get(e.foco);
        this.cartel.material.map = textura;
        this.cartel.material.needsUpdate = true;
        this.cartel.scale.set(0.58 * aspecto, 0.58, 1); // chico: del tamaño de una etiqueta
        this.cartel.material.opacity = 0; // reaparece con cada tecnología
      }
      this.cartel.position.set(e.posFoco.x, e.posFoco.y + 0.88, e.posFoco.z);
    }
    this.cartel.material.opacity = amortiguar(this.cartel.material.opacity, mostrar ? 1 : 0, mostrar ? 9 : 14, dt);
    this.cartel.visible = this.cartel.material.opacity > 0.01;
  }

  // Categoría (índice de hub), -2 si es el núcleo, o -1 si no hay nada bajo el rayo.
  hubBajoRayo(raycaster) {
    if (!this.grupo.visible) return -1;
    const objetos = [this.nucleo, ...this.hubs.flatMap((h) => [h.orbe, h.aro, h.etiqueta])];
    const golpes = raycaster.intersectObjects(objetos, false);
    return golpes.length ? golpes[0].object.userData.hub : -1;
  }

  liberar() {
    this.geometrias.forEach((g) => g.dispose());
    this.materiales.forEach((m) => m.dispose());
    this.carteles.forEach((c) => c.textura.dispose());
    this.hubs.forEach((h) => {
      h.textura?.dispose();
      h.texturaAro?.dispose();
    });
    this.aristas.dispose();
  }
}
