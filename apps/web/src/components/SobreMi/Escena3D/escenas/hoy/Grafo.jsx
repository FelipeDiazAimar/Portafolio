'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { crearPantalla } from '../../pantallaCanvas.js';
import { expansion } from '../../constelacion.js';
import { ubicarFicha, zoomParaRadio } from '../../fichaLayout.js';
import { ENLACES_GRAFO, GRUPOS, NODOS_GRAFO, distribuir, grado, indiceDe, pasoFuerzas, radioNodo, vecinos } from '../../grafo.js';

const SANS = '-apple-system, "SF Pro Text", "Segoe UI", system-ui, sans-serif';
const ALTO_ETIQUETA = 0.15;
// Ficha a mitad del tamaño original (misma proporción 720×260): con 2,7 de ancho
// tapaba medio grafo al seleccionar un nodo; con 1,35 sigue legible y no tapa el modelo.
const FICHA = { ancho: 1.35, alto: 0.487 };
const ZOOM_MINIMO = 0.5;
const ZOOM_MAXIMO = 3;
// Zoom máximo del encuadre inicial y de la selección (nodo + sus conexiones).
// La base sube a 2.6 para acompañar la ESCALA_ULTIMA 1.9 de la estación: el neto del
// grafo crece ~35% frente al tope 1.9 anterior y en escritorio sigue entrando entero
// (el autoencuadre lo ajusta a la esfera que lo contiene, sin recortar).
const ZOOM_BASE_MAX = 2.6;
const ZOOM_SELECCION_MAX = 2.8;
const salida = (x) => 1 - (1 - x) ** 3;
const limitar = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

// Parte un texto en renglones que entren en `ancho` píxeles.
function renglones(ctx, texto, ancho) {
  const lista = [];
  let actual = '';
  for (const palabra of texto.split(' ')) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (ctx.measureText(prueba).width > ancho && actual) {
      lista.push(actual);
      actual = palabra;
    } else actual = prueba;
  }
  if (actual) lista.push(actual);
  return lista;
}

// Ficha que aparece al pasar el mouse por un nodo: grupo, nombre y descripción.
function dibujarFicha(ctx, w, h, nodo, claro) {
  ctx.clearRect(0, 0, w, h);
  if (!nodo) return;
  const color = GRUPOS[nodo.grupo].color;
  ctx.fillStyle = claro ? 'rgba(255, 255, 255, 0.97)' : 'rgba(8, 13, 30, 0.95)';
  ctx.beginPath();
  ctx.roundRect(4, 4, w - 8, h - 8, 26);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(46, 58, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = claro ? '#5b6a8f' : '#9fb2e6';
  ctx.font = `700 26px ${SANS}`;
  ctx.fillText(GRUPOS[nodo.grupo].nombre.toUpperCase(), 72, 58);
  ctx.fillStyle = claro ? '#0e1a3d' : '#ffffff';
  ctx.font = `800 40px ${SANS}`;
  ctx.fillText(nodo.etiqueta, 36, 112);
  ctx.fillStyle = claro ? '#34436b' : '#d3def9';
  ctx.font = `400 28px ${SANS}`;
  renglones(ctx, nodo.detalle, w - 72).slice(0, 3).forEach((linea, i) => ctx.fillText(linea, 36, 162 + i * 38));
}

const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const v3 = new THREE.Vector3();
const m3 = new THREE.Matrix3();
const m4 = new THREE.Matrix4();
const rayo = new THREE.Raycaster();
const plano = new THREE.Plane();

// Grafo de conocimiento 3D estilo Obsidian. Los nodos son esferas en un volumen y se
// puede girar 360° (los nombres siempre miran a la cámara). Al pasar el mouse por un
// nodo se resaltan él y sus vecinos y aparece una ficha ubicada alrededor del nodo
// para que quede dentro de la pantalla. Se pueden arrastrar nodos (el resto se
// reacomoda con la misma simulación de fuerzas) y al hacer click en uno la vista se
// acerca a él y a sus conexiones. Dos dedos (o Ctrl + rueda) acercan el grafo sin
// hacer zoom en la página. Los datos viven en `grafoDatos.js`.
export default function Grafo({ tiempo, claro, activa = true }) {
  const camera = useThree((estado) => estado.camera);
  const lienzoDom = useThree((estado) => estado.gl.domElement);
  const controles = useThree((estado) => estado.controls);
  const refControles = useRef(controles);
  refControles.current = controles;
  // Montado como vecino (o durante un viaje) el grafo no toma la cámara ni escucha al usuario.
  const refActiva = useRef(activa);
  refActiva.current = activa;

  const inicial = useMemo(() => distribuir(), []);
  const pos = useRef(inicial.map((p) => [...p]));
  const vel = useRef(inicial.map(() => [0, 0, 0]));
  const fijos = useRef(inicial.map(() => false));
  const alpha = useRef(0);
  const distancias = useMemo(() => {
    const radios = inicial.map(([x, y, z]) => Math.hypot(x, y, z));
    const maximo = Math.max(...radios);
    return radios.map((r) => r / maximo);
  }, [inicial]);

  const recursos = useMemo(() => {
    const texturas = [];
    const medida = document.createElement('canvas').getContext('2d');
    medida.font = `700 34px ${SANS}`;
    const colorEtiqueta = claro ? '#10204d' : '#f1f5ff';
    const etiquetas = NODOS_GRAFO.map((nodo) => {
      const ancho = Math.ceil(medida.measureText(nodo.etiqueta).width) + 24;
      const lienzo = crearPantalla(ancho, 54);
      lienzo.ctx.font = `700 34px ${SANS}`;
      lienzo.ctx.textAlign = 'center';
      lienzo.ctx.textBaseline = 'middle';
      lienzo.ctx.fillStyle = colorEtiqueta;
      lienzo.ctx.fillText(nodo.etiqueta, ancho / 2, 29);
      lienzo.textura.needsUpdate = true;
      texturas.push(lienzo.textura);
      return {
        proporcion: ancho / 54,
        // Sin prueba de profundidad: el nombre se lee desde cualquier ángulo.
        material: new THREE.MeshBasicMaterial({ map: lienzo.textura, transparent: true, opacity: 0, depthWrite: false, depthTest: false, toneMapped: false }),
      };
    });
    const ficha = crearPantalla(720, 260);
    texturas.push(ficha.textura);
    const colores = NODOS_GRAFO.map((nodo) => {
      const c = new THREE.Color(GRUPOS[nodo.grupo].color);
      if (claro) c.offsetHSL(0, 0.1, -0.2);
      return c;
    });
    const mezcla = claro ? THREE.NormalBlending : THREE.AdditiveBlending;
    return {
      texturas,
      etiquetas,
      ficha,
      colores,
      // Esferas con luz propia: el sombreado les da volumen.
      nodos: colores.map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: claro ? 0.5 : 1.0, roughness: 0.35, metalness: 0.1, transparent: true, opacity: 0 })),
      materialFicha: new THREE.MeshBasicMaterial({ map: ficha.textura, transparent: true, opacity: 0, depthWrite: false, depthTest: false, toneMapped: false }),
      materialLineas: new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: mezcla, toneMapped: false }),
      geoNodo: new THREE.SphereGeometry(1, 28, 18),
      geoLineas: (() => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ENLACES_GRAFO.length * 6), 3));
        g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(ENLACES_GRAFO.length * 8), 4));
        return g;
      })(),
    };
  }, [claro]);

  // Estado de la interacción (todo en refs: se lee en cada cuadro y en los eventos).
  const foco = useRef(null);
  const seleccion = useRef(null);
  const arrastre = useRef(null);
  const vecinosActivos = useRef(new Set());
  const ultimoBloqueo = useRef(false);
  const luz = useRef(NODOS_GRAFO.map(() => 0.85));
  const actuales = useRef(inicial.map(() => new THREE.Vector3()));
  const apareceActual = useRef(NODOS_GRAFO.map(() => 0));
  const refRaiz = useRef(null);
  const refVista = useRef(null);
  const refNodos = useRef([]);
  const refEtiquetas = useRef([]);
  const refFicha = useRef(null);
  const ultimaFicha = useRef(null);
  const encuadre = useRef({ zoom: 1, pxPorLocal: 100, area: null, pendiente: 3 });
  const usuario = useRef({ zoom: 1 });
  const vistaActual = useRef({ zoom: 1, centro: new THREE.Vector3() });
  const guardado = useRef(null);
  const ultimoUso = useRef(0);

  const cursor = (valor) => {
    document.body.style.cursor = valor;
  };
  const listoAhora = () => expansion(tiempo.current) >= 0.95;
  // Le avisa a la sección si el mouse está explorando el grafo (hover, arrastre o
  // selección): mientras tanto no se desarma.
  const actualizarBloqueo = () => {
    const bloqueado = foco.current !== null || seleccion.current !== null || arrastre.current !== null;
    if (bloqueado === ultimoBloqueo.current) return;
    ultimoBloqueo.current = bloqueado;
    lienzoDom.dispatchEvent(new CustomEvent('bloqueo3d', { bubbles: true, detail: bloqueado }));
  };
  const ponerFoco = (indice) => {
    const id = indice >= 0 ? NODOS_GRAFO[indice].id : null;
    if (id === foco.current) return;
    foco.current = id;
    if (!arrastre.current) cursor(id ? 'pointer' : '');
    vecinosActivos.current = new Set(id ? [id, ...vecinos(id)] : seleccion.current ? [seleccion.current, ...vecinos(seleccion.current)] : []);
    actualizarBloqueo();
  };
  const seleccionar = (indice) => {
    seleccion.current = indice >= 0 ? NODOS_GRAFO[indice].id : null;
    usuario.current.zoom = 1;
    vecinosActivos.current = new Set(seleccion.current ? [seleccion.current, ...vecinos(seleccion.current)] : []);
    actualizarBloqueo();
  };
  const reordenarTodo = () => {
    pos.current = inicial.map((p) => [...p]);
    vel.current = inicial.map(() => [0, 0, 0]);
    fijos.current = inicial.map(() => false);
    alpha.current = 0;
  };

  // --- Medidas de pantalla -------------------------------------------------
  const aPantalla = (mundo, rect, destino) => {
    v3.copy(mundo).project(camera);
    destino.x = rect.left + (v3.x * 0.5 + 0.5) * rect.width;
    destino.y = rect.top + (1 - (v3.y * 0.5 + 0.5)) * rect.height;
    return destino;
  };
  // Cuánto mide un píxel de pantalla en el mundo, a la profundidad de `mundo`.
  const mundoPorPixel = (mundo, rect) => {
    const profundidad = -v3.copy(mundo).applyMatrix4(camera.matrixWorldInverse).z;
    return (2 * profundidad * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / rect.height;
  };
  // Desplazamiento en pantalla (px) → desplazamiento en el espacio del grupo raíz.
  const pixelesALocal = (dx, dy, mundo, rect, destino) => {
    const porPixel = mundoPorPixel(mundo, rect);
    const derecha = v1.setFromMatrixColumn(camera.matrixWorld, 0).clone();
    const arriba = v2.setFromMatrixColumn(camera.matrixWorld, 1).clone();
    destino.copy(derecha).multiplyScalar(dx * porPixel).addScaledVector(arriba, -dy * porPixel);
    m4.copy(refRaiz.current.matrixWorld).invert();
    return destino.applyMatrix3(m3.setFromMatrix4(m4));
  };
  // Rectángulo de pantalla donde se puede dibujar: la ventana (sin la cabecera ni la
  // línea de tiempo) recortada al canvas.
  const areaVisible = (rect, margenDerecho) => ({
    izq: Math.max(8, rect.left),
    arriba: Math.max(window.innerWidth > 768 ? 84 : 8, rect.top),
    der: Math.min(window.innerWidth - margenDerecho, rect.right),
    abajo: Math.min(window.innerHeight - 12, rect.bottom),
  });

  // Tamaño del grafo en pantalla y zoom que lo hace entrar entero. Como gira, se
  // ajusta a la esfera que lo contiene (no a la silueta de un ángulo).
  const medirEncuadre = () => {
    const raiz = refRaiz.current;
    if (!raiz) return;
    raiz.updateWorldMatrix(true, false);
    camera.updateMatrixWorld();
    const rect = lienzoDom.getBoundingClientRect();
    if (rect.width < 10) return;
    const origen = new THREE.Vector3().setFromMatrixPosition(raiz.matrixWorld);
    const escalaRaiz = v3.setFromMatrixScale(raiz.matrixWorld).x;
    const pxPorLocal = escalaRaiz / mundoPorPixel(origen, rect);
    const radioLocal = Math.max(...pos.current.map(([x, y, z]) => Math.hypot(x, y, z))) + 0.4;
    const area = areaVisible(rect, window.innerWidth > 768 ? 170 : 8);
    encuadre.current.pxPorLocal = pxPorLocal;
    encuadre.current.area = area;
    encuadre.current.zoom = zoomParaRadio({ radioPx: radioLocal * pxPorLocal, area, margen: 6, maximo: ZOOM_BASE_MAX });
  };

  // Centro y zoom que encuadran un nodo junto con todas sus conexiones.
  const encuadreSeleccion = (centroDestino) => {
    const i = indiceDe(seleccion.current);
    const conjunto = [i, ...vecinos(seleccion.current).map(indiceDe)];
    const caja = new THREE.Box3();
    conjunto.forEach((k) => caja.expandByPoint(v1.set(...pos.current[k])));
    caja.getCenter(centroDestino);
    let radio = 0;
    conjunto.forEach((k) => {
      radio = Math.max(radio, v1.set(...pos.current[k]).distanceTo(centroDestino));
    });
    const { pxPorLocal, area } = encuadre.current;
    if (!area) return 1;
    return zoomParaRadio({ radioPx: (radio + 0.55) * pxPorLocal, area, margen: 16, maximo: ZOOM_SELECCION_MAX });
  };

  // --- Cámara: giro libre mientras el grafo está listo ----------------------
  const tomarControles = () => {
    const c = refControles.current;
    if (!c || guardado.current) return;
    guardado.current = {
      minA: c.minAzimuthAngle,
      maxA: c.maxAzimuthAngle,
      minP: c.minPolarAngle,
      maxP: c.maxPolarAngle,
      velocidad: c.autoRotateSpeed,
      target: c.target.clone(),
    };
    c.minAzimuthAngle = -Infinity;
    c.maxAzimuthAngle = Infinity;
    c.minPolarAngle = 0;
    c.maxPolarAngle = Math.PI;
    c.autoRotateSpeed = 0.6;
    c.giroLibre = true;
  };
  const soltarControles = () => {
    const c = refControles.current;
    if (!c || !guardado.current) return;
    const g = guardado.current;
    c.minAzimuthAngle = g.minA;
    c.maxAzimuthAngle = g.maxA;
    c.minPolarAngle = g.minP;
    c.maxPolarAngle = g.maxP;
    c.autoRotateSpeed = g.velocidad;
    c.autoRotate = false;
    c.giroLibre = false;
    // La cámara vuelve al frente y al punto de giro de origen: la escena siguiente
    // (con su propio encuadre) no hereda el giro ni el desplazamiento del grafo.
    c.target.copy(g.target);
    const distancia = camera.position.distanceTo(g.target);
    camera.position.set(g.target.x, g.target.y + distancia * 0.116, g.target.z + distancia * 0.993);
    camera.lookAt(g.target);
    c.update();
    guardado.current = null;
  };

  // Registra cuándo el usuario toca la cámara, para retomar el giro lento solo.
  useEffect(() => {
    if (!controles) return undefined;
    const marcar = () => {
      ultimoUso.current = performance.now();
    };
    controles.addEventListener('start', marcar);
    controles.addEventListener('end', marcar);
    return () => {
      controles.removeEventListener('start', marcar);
      controles.removeEventListener('end', marcar);
    };
  }, [controles]);

  // --- Mouse, dedos y teclado ----------------------------------------------
  useEffect(() => {
    const punteros = new Map();
    let anterior = null;
    let toque = null;
    let vacio = null;

    const pickear = (clientX, clientY) => {
      const raiz = refRaiz.current;
      const vista = refVista.current;
      if (!raiz || !vista || !listoAhora()) return -1;
      vista.updateWorldMatrix(true, false);
      camera.updateMatrixWorld();
      const rect = lienzoDom.getBoundingClientRect();
      const escalaRaiz = v3.setFromMatrixScale(raiz.matrixWorld).x;
      const punto = { x: 0, y: 0 };
      let mejor = -1;
      let menor = Infinity;
      let profundidadMejor = Infinity;
      NODOS_GRAFO.forEach((nodo, i) => {
        if (apareceActual.current[i] < 0.9) return;
        const mundo = v2.copy(actuales.current[i]).applyMatrix4(vista.matrixWorld).clone();
        aPantalla(mundo, rect, punto);
        const radioPx = (radioNodo(nodo.id) * 1.15 * vistaActual.current.zoom * escalaRaiz) / mundoPorPixel(mundo, rect);
        const distancia = Math.hypot(clientX - punto.x, clientY - punto.y);
        // Zona de contacto: el nodo más un margen de unos píxeles, siempre cómoda.
        if (distancia > Math.max(radioPx * 1.3, 11) + 5) return;
        const profundidad = -mundo.clone().applyMatrix4(camera.matrixWorldInverse).z;
        const puntaje = distancia - radioPx;
        if (puntaje < menor - 0.5 || (Math.abs(puntaje - menor) <= 0.5 && profundidad < profundidadMejor)) {
          menor = puntaje;
          mejor = i;
          profundidadMejor = profundidad;
        }
      });
      return mejor;
    };

    const alBajar = (evento) => {
      if (!refActiva.current) return;
      if (evento.target !== lienzoDom) return;
      if (evento.pointerType === 'touch') {
        punteros.set(evento.pointerId, { x: evento.clientX, y: evento.clientY });
        if (punteros.size === 2) {
          // Con dos dedos el gesto es del grafo: la página no hace zoom ni scroll y
          // la cámara no gira.
          lienzoDom.style.touchAction = 'none';
          if (refControles.current) refControles.current.enabled = false;
          anterior = centroDedos();
          toque = null;
        } else if (punteros.size === 1) {
          toque = { x: evento.clientX, y: evento.clientY, t: performance.now() };
        }
        return;
      }
      if (evento.button !== 0 || !listoAhora()) return;
      const i = pickear(evento.clientX, evento.clientY);
      if (i < 0) {
        vacio = { x: evento.clientX, y: evento.clientY, t: performance.now() };
        return;
      }
      // Agarrar un nodo: el evento no llega a la cámara, que no gira.
      evento.stopPropagation();
      evento.preventDefault();
      const vista = refVista.current;
      vista.updateWorldMatrix(true, false);
      const mundo = v2.copy(actuales.current[i]).applyMatrix4(vista.matrixWorld).clone();
      plano.setFromNormalAndCoplanarPoint(camera.getWorldDirection(v1).clone(), mundo);
      arrastre.current = { i, x: evento.clientX, y: evento.clientY, movido: false };
      fijos.current[i] = true;
      cursor('grabbing');
      actualizarBloqueo();
    };

    const alMover = (evento) => {
      if (!refActiva.current) return;
      const a = arrastre.current;
      if (a) {
        if (!a.movido && Math.hypot(evento.clientX - a.x, evento.clientY - a.y) > 4) a.movido = true;
        if (!a.movido) return;
        const rect = lienzoDom.getBoundingClientRect();
        rayo.setFromCamera({ x: ((evento.clientX - rect.left) / rect.width) * 2 - 1, y: -((evento.clientY - rect.top) / rect.height) * 2 + 1 }, camera);
        if (rayo.ray.intersectPlane(plano, v3)) {
          refVista.current.worldToLocal(v3);
          pos.current[a.i] = [v3.x, v3.y, v3.z];
          vel.current[a.i] = [0, 0, 0];
          alpha.current = Math.max(alpha.current, 0.4);
        }
        lienzoDom.dispatchEvent(new CustomEvent('interaccion3d', { bubbles: true }));
        return;
      }
      if (evento.pointerType === 'touch') {
        if (punteros.has(evento.pointerId)) {
          punteros.set(evento.pointerId, { x: evento.clientX, y: evento.clientY });
          if (punteros.size === 2 && anterior) {
            const ahora = centroDedos();
            usuario.current.zoom = limitar(usuario.current.zoom * (ahora.d / anterior.d), ZOOM_MINIMO, ZOOM_MAXIMO);
            anterior = ahora;
          }
        }
        return;
      }
      // Hover: sólo con el cursor libre sobre el canvas (no mientras gira la cámara).
      if (evento.target !== lienzoDom || evento.buttons !== 0) {
        if (evento.target !== lienzoDom) ponerFoco(-1);
        return;
      }
      const i = pickear(evento.clientX, evento.clientY);
      ponerFoco(i);
      // Explorando un nodo no cuenta como "mouse quieto" para el desarme.
      if (i >= 0) lienzoDom.dispatchEvent(new CustomEvent('interaccion3d', { bubbles: true }));
    };

    const alSubir = (evento) => {
      const a = arrastre.current;
      if (a) {
        arrastre.current = null;
        if (a.movido) alpha.current = Math.max(alpha.current, 0.5);
        else {
          // Un click sin arrastre: selecciona (y si ya estaba seleccionado y tiene
          // enlace, lo abre).
          const { url } = NODOS_GRAFO[a.i];
          if (seleccion.current === NODOS_GRAFO[a.i].id && url) window.open(url, '_blank', 'noopener,noreferrer');
          else seleccionar(a.i);
          fijos.current[a.i] = false;
        }
        cursor(foco.current ? 'pointer' : '');
        actualizarBloqueo();
        return;
      }
      if (evento.pointerType === 'touch') {
        const habia = punteros.delete(evento.pointerId);
        if (habia && punteros.size < 2 && anterior) {
          lienzoDom.style.touchAction = 'pan-y';
          if (refControles.current) refControles.current.enabled = true;
          anterior = null;
        }
        // Un toque corto sobre un nodo lo selecciona; sobre el vacío, deselecciona.
        if (habia && toque && Math.hypot(evento.clientX - toque.x, evento.clientY - toque.y) < 8 && performance.now() - toque.t < 500) {
          const i = pickear(evento.clientX, evento.clientY);
          if (i >= 0) seleccionar(i);
          else if (seleccion.current) seleccionar(-1);
        }
        toque = null;
        return;
      }
      // Click sobre el vacío (sin haber girado la cámara): deselecciona.
      if (vacio && evento.target === lienzoDom && Math.hypot(evento.clientX - vacio.x, evento.clientY - vacio.y) < 5 && performance.now() - vacio.t < 500) {
        if (seleccion.current) seleccionar(-1);
      }
      vacio = null;
    };

    const centroDedos = () => {
      const [a, b] = [...punteros.values()];
      return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1 };
    };
    // Pellizco en el trackpad (Ctrl + rueda): acerca el grafo y no la página. Se
    // atiende en toda la sección (no sólo sobre el canvas): si el cursor está sobre
    // otro elemento, igual no debe hacer zoom en la página.
    const seccion = lienzoDom.closest('section') ?? lienzoDom;
    const alRodar = (evento) => {
      if (!refActiva.current) return;
      if (!evento.ctrlKey || !seccion.contains(evento.target)) return;
      evento.preventDefault();
      usuario.current.zoom = limitar(usuario.current.zoom * Math.exp(-evento.deltaY * 0.01), ZOOM_MINIMO, ZOOM_MAXIMO);
    };
    // Safari (iOS y macOS) hace zoom de página con sus propios eventos de gesto.
    const sinGesto = (evento) => {
      if (refActiva.current) evento.preventDefault();
    };
    // Doble click en el vacío: vuelve a la vista inicial y reacomoda los nodos.
    const alDobleClick = (evento) => {
      if (!refActiva.current) return;
      if (pickear(evento.clientX, evento.clientY) >= 0) return;
      seleccionar(-1);
      usuario.current.zoom = 1;
      reordenarTodo();
    };
    const alTeclear = (evento) => {
      if (!refActiva.current) return;
      if (evento.key === 'Escape' && seleccion.current) seleccionar(-1);
    };
    const alCambiarTamano = () => {
      encuadre.current.pendiente = 2;
    };
    window.addEventListener('pointerdown', alBajar, true);
    window.addEventListener('pointermove', alMover);
    window.addEventListener('pointerup', alSubir);
    window.addEventListener('pointercancel', alSubir);
    window.addEventListener('keydown', alTeclear);
    window.addEventListener('resize', alCambiarTamano);
    window.addEventListener('wheel', alRodar, { passive: false, capture: true });
    seccion.addEventListener('gesturestart', sinGesto);
    seccion.addEventListener('gesturechange', sinGesto);
    lienzoDom.addEventListener('dblclick', alDobleClick);
    return () => {
      window.removeEventListener('pointerdown', alBajar, true);
      window.removeEventListener('pointermove', alMover);
      window.removeEventListener('pointerup', alSubir);
      window.removeEventListener('pointercancel', alSubir);
      window.removeEventListener('keydown', alTeclear);
      window.removeEventListener('resize', alCambiarTamano);
      window.removeEventListener('wheel', alRodar, { capture: true });
      seccion.removeEventListener('gesturestart', sinGesto);
      seccion.removeEventListener('gesturechange', sinGesto);
      lienzoDom.removeEventListener('dblclick', alDobleClick);
      lienzoDom.style.touchAction = 'pan-y';
      if (refControles.current) refControles.current.enabled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lienzoDom]);

  useEffect(
    () => () => {
      cursor('');
      soltarControles();
      lienzoDom.dispatchEvent(new CustomEvent('bloqueo3d', { bubbles: true, detail: false }));
      recursos.texturas.forEach((t) => t.dispose());
      recursos.etiquetas.forEach((e) => e.material.dispose());
      recursos.nodos.forEach((m) => m.dispose());
      recursos.materialFicha.dispose();
      recursos.materialLineas.dispose();
      recursos.geoNodo.dispose();
      recursos.geoLineas.dispose();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recursos, lienzoDom]
  );

  useFrame(() => {
    const t = tiempo.current;
    const e = expansion(t);
    const listo = e >= 0.95;
    const idFoco = listo ? foco.current ?? seleccion.current : null;
    const hover = listo ? foco.current : null;
    const posLineas = recursos.geoLineas.attributes.position;
    const colLineas = recursos.geoLineas.attributes.color;
    const c = refControles.current;

    // Giro libre sólo cuando el grafo ya está armado; la cámara gira sola, despacio,
    // si nadie la toca (y se detiene al apuntar, arrastrar o seleccionar).
    if (!refActiva.current) {
      // Al empezar un viaje: devuelve límites, punto de giro y cámara de frente.
      soltarControles();
      return;
    }
    if (listo) tomarControles();
    else soltarControles();
    if (c && guardado.current) {
      c.autoRotate = !arrastre.current && !foco.current && !seleccion.current && performance.now() - ultimoUso.current > 3500;
    }

    if (encuadre.current.pendiente > 0) {
      encuadre.current.pendiente -= 1;
      medirEncuadre();
    }

    // Simulación de fuerzas: sólo mientras algo se está reacomodando.
    if (listo && alpha.current > 0.004) {
      pasoFuerzas(pos.current, vel.current, fijos.current, alpha.current);
      alpha.current *= 0.986;
    }

    // Vista: zoom y centro. Con una selección el centro es el del nodo y sus
    // conexiones; la cámara orbita siempre alrededor del centro de la vista.
    const actualV = vistaActual.current;
    const centroObjetivo = v1.set(0, 0, 0);
    let zoomObjetivo = encuadre.current.zoom;
    if (listo && seleccion.current) zoomObjetivo = encuadreSeleccion(centroObjetivo);
    zoomObjetivo *= usuario.current.zoom;
    actualV.zoom += (zoomObjetivo - actualV.zoom) * 0.12;
    actualV.centro.lerp(centroObjetivo, 0.12);
    const vista = refVista.current;
    vista.scale.setScalar(actualV.zoom);
    vista.position.copy(actualV.centro).multiplyScalar(-actualV.zoom);
    vista.updateWorldMatrix(true, false);
    const origenMundo = v3.setFromMatrixPosition(refRaiz.current.matrixWorld).clone();
    if (c && guardado.current) c.target.lerp(origenMundo, 0.2);

    // Para atenuar lo que queda lejos de la cámara (da profundidad).
    const distCentro = camera.position.distanceTo(origenMundo);
    const radioMundo = Math.max(
      1,
      Math.max(...pos.current.map(([x, y, z]) => Math.hypot(x, y, z))) * actualV.zoom * v2.setFromMatrixScale(refRaiz.current.matrixWorld).x
    );

    NODOS_GRAFO.forEach((nodo, i) => {
      const aparece = salida(limitar(e * 1.7 - distancias[i] * 0.7));
      apareceActual.current[i] = aparece;
      const [x, y, z] = pos.current[i];
      const p = actuales.current[i].set(x * aparece, y * aparece, z * aparece);

      // Luz objetivo: normal, resaltada (foco o vecino) o apagada (el resto).
      let objetivo = 1;
      if (idFoco) objetivo = vecinosActivos.current.has(nodo.id) ? 1 : 0.16;
      luz.current[i] += (objetivo - luz.current[i]) * 0.18;
      const l = luz.current[i];
      const resaltado = nodo.id === hover || nodo.id === seleccion.current;
      const importante = grado(nodo.id) >= 5 || nodo.id === 'yo';

      // Profundidad: lo lejano se ve algo más tenue.
      const distNodo = v3.copy(p).applyMatrix4(vista.matrixWorld).distanceTo(camera.position);
      const cercania = limitar(0.5 + (distCentro - distNodo) / (radioMundo * 2.4), 0, 1);
      const profundidad = 0.78 + 0.22 * cercania;

      const nodoMesh = refNodos.current[i];
      nodoMesh.position.copy(p);
      // Los nodos importantes "laten" suavemente; el apuntado crece un poco.
      const latido = importante ? 1 + 0.06 * Math.sin(t * 2.2 + i) : 1;
      const radio = radioNodo(nodo.id) * 1.15 * (resaltado ? 1.35 : 1) * latido * aparece;
      nodoMesh.scale.setScalar(Math.max(radio, 0.0001));
      recursos.nodos[i].opacity = l * aparece * profundidad;

      const etiqueta = refEtiquetas.current[i];
      etiqueta.position.set(p.x, p.y - radioNodo(nodo.id) * 1.9 - 0.13, p.z);
      const base = importante ? 1 : 0.8;
      const claridad = idFoco ? (l > 0.9 ? 1 : 0.1) : base;
      recursos.etiquetas[i].material.opacity += (claridad * aparece * (0.55 + 0.45 * cercania) - recursos.etiquetas[i].material.opacity) * 0.2;
    });

    // Líneas: degradé entre los colores de sus dos nodos; siguen a los nodos y se
    // encienden con el foco.
    ENLACES_GRAFO.forEach(({ a, b }, k) => {
      const ia = indiceDe(a);
      const ib = indiceDe(b);
      const pa = actuales.current[ia];
      const pb = actuales.current[ib];
      posLineas.setXYZ(k * 2, pa.x, pa.y, pa.z);
      posLineas.setXYZ(k * 2 + 1, pb.x, pb.y, pb.z);
      const toca = idFoco && (a === idFoco || b === idFoco);
      const fuerza = (toca ? 1 : idFoco ? 0.05 : claro ? 0.55 : 0.5) * Math.min(1, e * 2);
      const ca = recursos.colores[ia];
      const cb = recursos.colores[ib];
      colLineas.setXYZW(k * 2, ca.r, ca.g, ca.b, fuerza);
      colLineas.setXYZW(k * 2 + 1, cb.r, cb.g, cb.b, fuerza);
    });
    posLineas.needsUpdate = true;
    colLineas.needsUpdate = true;

    // Ficha: el texto se redibuja sólo al cambiar de nodo y se ubica alrededor del
    // nodo, del lado donde entra en pantalla.
    const ficha = refFicha.current;
    const cambio = idFoco !== ultimaFicha.current;
    if (cambio) {
      ultimaFicha.current = idFoco;
      if (idFoco) {
        dibujarFicha(recursos.ficha.ctx, recursos.ficha.ancho, recursos.ficha.alto, NODOS_GRAFO[indiceDe(idFoco)], claro);
        recursos.ficha.textura.needsUpdate = true;
      }
    }
    recursos.materialFicha.opacity += ((idFoco && !arrastre.current?.movido ? 1 : 0) - recursos.materialFicha.opacity) * 0.25;
    ficha.visible = recursos.materialFicha.opacity > 0.02;
    if (idFoco) {
      const raiz = refRaiz.current;
      const mundoNodo = v2.copy(actuales.current[indiceDe(idFoco)]).applyMatrix4(vista.matrixWorld).clone();
      const rect = lienzoDom.getBoundingClientRect();
      const nodoPx = aPantalla(mundoNodo, rect, { x: 0, y: 0 });
      // Tamaño de la ficha en pantalla, con la escala real del grupo en que está.
      const escalaRaiz = v3.setFromMatrixScale(raiz.matrixWorld).x;
      const pxPorMundo = 1 / mundoPorPixel(mundoNodo, rect);
      const anchoPx = FICHA.ancho * escalaRaiz * pxPorMundo;
      const altoPx = FICHA.alto * escalaRaiz * pxPorMundo;
      const centro = ubicarFicha({ nodo: nodoPx, ancho: anchoPx, alto: altoPx, area: areaVisible(rect, 8), separacion: 24 });
      const desplazamiento = pixelesALocal(centro.x - nodoPx.x, centro.y - nodoPx.y, mundoNodo, rect, new THREE.Vector3());
      const destino = raiz.worldToLocal(mundoNodo.clone()).add(desplazamiento);
      if (cambio && !ficha.userData.puesta) ficha.position.copy(destino);
      ficha.userData.puesta = true;
      ficha.position.lerp(destino, 0.35);
    } else if (!ficha.visible) {
      ficha.userData.puesta = false;
    }
  });

  return (
    <group ref={refRaiz}>
      <group ref={refVista}>
        <lineSegments geometry={recursos.geoLineas} material={recursos.materialLineas} frustumCulled={false} renderOrder={1} />
        {NODOS_GRAFO.map((nodo, i) => (
          <group key={nodo.id}>
            <mesh ref={(m) => { refNodos.current[i] = m; }} geometry={recursos.geoNodo} material={recursos.nodos[i]} renderOrder={3} />
            <Billboard ref={(m) => { refEtiquetas.current[i] = m; }}>
              <mesh material={recursos.etiquetas[i].material} renderOrder={10}>
                <planeGeometry args={[ALTO_ETIQUETA * recursos.etiquetas[i].proporcion, ALTO_ETIQUETA]} />
              </mesh>
            </Billboard>
          </group>
        ))}
      </group>
      <Billboard ref={refFicha} visible={false}>
        <mesh material={recursos.materialFicha} renderOrder={20}>
          <planeGeometry args={[FICHA.ancho, FICHA.alto]} />
        </mesh>
      </Billboard>
    </group>
  );
}
