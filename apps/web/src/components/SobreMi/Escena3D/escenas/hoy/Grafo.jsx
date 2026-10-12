'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { crearPantalla } from '../../pantallaCanvas.js';
import { expansion } from '../../constelacion.js';
import { encuadrar, ubicarFicha } from '../../fichaLayout.js';
import { ENLACES_GRAFO, GRUPOS, NODOS_GRAFO, distribuir, grado, indiceDe, radioNodo, vecinos } from '../../grafo.js';

const SANS = '-apple-system, "SF Pro Text", "Segoe UI", system-ui, sans-serif';
const ALTO_ETIQUETA = 0.15;
const FICHA = { ancho: 2.7, alto: 0.974 };
const ZOOM_MINIMO = 0.6;
const ZOOM_MAXIMO = 3.2;
// Sólo las zonas de contacto reciben el mouse: lo demás (etiquetas, ficha, halos, líneas)
// no debe taparlas ni sacarles el foco.
const SIN_MOUSE = () => null;
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

// Grafo de conocimiento estilo Obsidian: puntos, líneas con degradé de color y
// etiquetas. Al pasar el mouse por un nodo se resaltan él y sus vecinos, el resto
// se apaga y aparece una ficha con texto, ubicada alrededor del nodo para que
// siempre quede dentro de la pantalla. El grafo se encuadra solo en la ventana y se
// puede acercar y mover con dos dedos (o Ctrl + rueda) sin hacer zoom en la página.
// Los datos viven en `grafoDatos.js`.
export default function Grafo({ tiempo, claro }) {
  const camera = useThree((estado) => estado.camera);
  const lienzoDom = useThree((estado) => estado.gl.domElement);
  const controles = useThree((estado) => estado.controls);
  const refControles = useRef(controles);
  refControles.current = controles;

  const posiciones = useMemo(() => distribuir(), []);
  const distancias = useMemo(() => {
    const maximo = Math.max(...posiciones.map(([x, y]) => Math.hypot(x, y)));
    return posiciones.map(([x, y]) => Math.hypot(x, y) / maximo);
  }, [posiciones]);

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
        material: new THREE.MeshBasicMaterial({ map: lienzo.textura, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
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
      puntos: NODOS_GRAFO.map((_, i) => new THREE.MeshBasicMaterial({ color: colores[i], transparent: true, opacity: 0, depthWrite: false, toneMapped: false })),
      halos: NODOS_GRAFO.map((_, i) => new THREE.MeshBasicMaterial({ color: colores[i], transparent: true, opacity: 0, depthWrite: false, blending: mezcla, toneMapped: false })),
      materialFicha: new THREE.MeshBasicMaterial({ map: ficha.textura, transparent: true, opacity: 0, depthWrite: false, depthTest: false, toneMapped: false }),
      materialLineas: new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: mezcla, toneMapped: false }),
      geoPunto: new THREE.CircleGeometry(1, 32),
      geoLineas: (() => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ENLACES_GRAFO.length * 6), 3));
        g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(ENLACES_GRAFO.length * 8), 4));
        return g;
      })(),
    };
  }, [claro]);

  const foco = useRef(null);
  const vecinosFoco = useRef(new Set());
  const luz = useRef(NODOS_GRAFO.map(() => 0.75));
  const actuales = useRef(posiciones.map(() => new THREE.Vector3()));
  const refRaiz = useRef(null);
  const refVista = useRef(null);
  const refPuntos = useRef([]);
  const refHalos = useRef([]);
  const refEtiquetas = useRef([]);
  const refFicha = useRef(null);
  const ultimaFicha = useRef(null);
  // Encuadre automático (zoom y desplazamiento que hacen entrar el grafo en pantalla)
  // y ajuste del usuario (pellizco y arrastre con dos dedos) por encima de ése.
  const encuadre = useRef({ zoom: 1, pos: new THREE.Vector3(), pendiente: 3 });
  const usuario = useRef({ zoom: 1, pos: new THREE.Vector3() });
  const vistaActual = useRef({ zoom: 1, pos: new THREE.Vector3() });

  const cursor = (valor) => {
    document.body.style.cursor = valor;
  };

  // --- Medidas de pantalla -------------------------------------------------
  // Píxeles de pantalla del punto del mundo `mundo` (se escribe en `salidaPx`).
  const aPantalla = (mundo, rect, salidaPx) => {
    v3.copy(mundo).project(camera);
    salidaPx.x = rect.left + (v3.x * 0.5 + 0.5) * rect.width;
    salidaPx.y = rect.top + (1 - (v3.y * 0.5 + 0.5)) * rect.height;
    return salidaPx;
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

  // Mide el grafo con la cámara actual y calcula el zoom y el corrimiento que lo
  // hacen entrar entero en el área visible.
  const calcularEncuadre = () => {
    const raiz = refRaiz.current;
    if (!raiz) return;
    raiz.updateWorldMatrix(true, false);
    camera.updateMatrixWorld();
    const rect = lienzoDom.getBoundingClientRect();
    if (rect.width < 10) return;
    const punto = { x: 0, y: 0 };
    const caja = { izq: Infinity, arriba: Infinity, der: -Infinity, abajo: -Infinity };
    posiciones.forEach(([x, y, z]) => {
      aPantalla(v2.set(x, y, z).applyMatrix4(raiz.matrixWorld), rect, punto);
      // Margen para el punto y su etiqueta.
      caja.izq = Math.min(caja.izq, punto.x - 70);
      caja.der = Math.max(caja.der, punto.x + 70);
      caja.arriba = Math.min(caja.arriba, punto.y - 24);
      caja.abajo = Math.max(caja.abajo, punto.y + 36);
    });
    const origenMundo = v2.set(0, 0, 0).applyMatrix4(raiz.matrixWorld).clone();
    const origen = aPantalla(origenMundo, rect, { x: 0, y: 0 });
    const area = areaVisible(rect, window.innerWidth > 768 ? 170 : 8);
    const { zoom, dx, dy } = encuadrar({ caja, area, origen, margen: 10, maximo: 1.2 });
    encuadre.current.zoom = zoom;
    pixelesALocal(dx, dy, origenMundo, rect, encuadre.current.pos);
  };

  // --- Zoom y desplazamiento del usuario ----------------------------------
  useEffect(() => {
    const punteros = new Map();
    let anterior = null;
    const restaurar = () => {
      lienzoDom.style.touchAction = 'pan-y';
      if (refControles.current) refControles.current.enabled = true;
      anterior = null;
    };
    const centro = () => {
      const [a, b] = [...punteros.values()];
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) || 1 };
    };
    const alBajar = (evento) => {
      if (evento.pointerType !== 'touch') return;
      punteros.set(evento.pointerId, { x: evento.clientX, y: evento.clientY });
      if (punteros.size === 2) {
        // Con dos dedos el gesto es del grafo: la página no hace zoom ni scroll y el
        // modelo no gira.
        lienzoDom.style.touchAction = 'none';
        if (refControles.current) refControles.current.enabled = false;
        anterior = centro();
      }
    };
    const alMover = (evento) => {
      if (!punteros.has(evento.pointerId)) return;
      punteros.set(evento.pointerId, { x: evento.clientX, y: evento.clientY });
      if (punteros.size !== 2 || !anterior) return;
      const ahora = centro();
      const u = usuario.current;
      u.zoom = limitar(u.zoom * (ahora.d / anterior.d), ZOOM_MINIMO, ZOOM_MAXIMO);
      const rect = lienzoDom.getBoundingClientRect();
      const origenMundo = new THREE.Vector3().applyMatrix4(refRaiz.current.matrixWorld);
      u.pos.add(pixelesALocal(ahora.x - anterior.x, ahora.y - anterior.y, origenMundo, rect, new THREE.Vector3()));
      anterior = ahora;
    };
    const alSubir = (evento) => {
      if (!punteros.delete(evento.pointerId)) return;
      if (punteros.size < 2) restaurar();
    };
    // Pellizco en el trackpad (Ctrl + rueda): acerca el grafo y no la página.
    const alRodar = (evento) => {
      if (!evento.ctrlKey) return;
      evento.preventDefault();
      const u = usuario.current;
      u.zoom = limitar(u.zoom * Math.exp(-evento.deltaY * 0.01), ZOOM_MINIMO, ZOOM_MAXIMO);
    };
    // Safari (iOS y macOS) hace zoom de página con sus propios eventos de gesto.
    const sinGesto = (evento) => evento.preventDefault();
    // Doble click: vuelve al encuadre inicial.
    const alDobleClick = () => {
      usuario.current.zoom = 1;
      usuario.current.pos.set(0, 0, 0);
    };
    const alCambiarTamano = () => {
      encuadre.current.pendiente = 2;
    };
    lienzoDom.addEventListener('pointerdown', alBajar);
    lienzoDom.addEventListener('pointermove', alMover);
    lienzoDom.addEventListener('pointerup', alSubir);
    lienzoDom.addEventListener('pointercancel', alSubir);
    lienzoDom.addEventListener('wheel', alRodar, { passive: false });
    lienzoDom.addEventListener('gesturestart', sinGesto);
    lienzoDom.addEventListener('gesturechange', sinGesto);
    lienzoDom.addEventListener('dblclick', alDobleClick);
    window.addEventListener('resize', alCambiarTamano);
    return () => {
      lienzoDom.removeEventListener('pointerdown', alBajar);
      lienzoDom.removeEventListener('pointermove', alMover);
      lienzoDom.removeEventListener('pointerup', alSubir);
      lienzoDom.removeEventListener('pointercancel', alSubir);
      lienzoDom.removeEventListener('wheel', alRodar);
      lienzoDom.removeEventListener('gesturestart', sinGesto);
      lienzoDom.removeEventListener('gesturechange', sinGesto);
      lienzoDom.removeEventListener('dblclick', alDobleClick);
      window.removeEventListener('resize', alCambiarTamano);
      restaurar();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lienzoDom]);

  useEffect(
    () => () => {
      cursor('');
      lienzoDom.dispatchEvent(new CustomEvent('bloqueo3d', { bubbles: true, detail: false }));
      recursos.texturas.forEach((t) => t.dispose());
      recursos.etiquetas.forEach((e) => e.material.dispose());
      recursos.puntos.forEach((m) => m.dispose());
      recursos.halos.forEach((m) => m.dispose());
      recursos.materialFicha.dispose();
      recursos.materialLineas.dispose();
      recursos.geoPunto.dispose();
      recursos.geoLineas.dispose();
    },
    [recursos, lienzoDom]
  );

  // --- Hover ----------------------------------------------------------------
  // Le avisa a la sección que el mouse está sobre un nodo (no se desarma mientras tanto).
  const avisar = (bloqueado) => lienzoDom.dispatchEvent(new CustomEvent('bloqueo3d', { bubbles: true, detail: bloqueado }));
  const entrar = (indice, evento) => {
    // Hasta que la red termina de expandirse no responde al mouse.
    if (expansion(tiempo.current) < 0.95) return;
    evento.stopPropagation();
    foco.current = NODOS_GRAFO[indice].id;
    vecinosFoco.current = new Set(vecinos(foco.current));
    cursor('pointer');
    avisar(true);
  };
  const salir = (indice) => {
    if (foco.current === NODOS_GRAFO[indice].id) {
      foco.current = null;
      vecinosFoco.current = new Set();
      cursor('');
      avisar(false);
    }
  };
  // Con el cursor sobre un nodo se está explorando: que no cuente como "mouse quieto"
  // para el desarme por hover (Escena3D escucha este evento).
  const moviendo = (evento) => {
    evento.stopPropagation();
    lienzoDom.dispatchEvent(new CustomEvent('interaccion3d', { bubbles: true }));
  };
  const alClick = (indice, evento) => {
    const { url } = NODOS_GRAFO[indice];
    if (!url || expansion(tiempo.current) < 0.95) return;
    evento.stopPropagation();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  useFrame(() => {
    const t = tiempo.current;
    const e = expansion(t);
    const listo = e >= 0.95;
    const idFoco = listo ? foco.current : null;
    const posLineas = recursos.geoLineas.attributes.position;
    const colLineas = recursos.geoLineas.attributes.color;

    // Encuadre: se recalcula al empezar y cuando cambia el tamaño de la ventana.
    if (encuadre.current.pendiente > 0) {
      encuadre.current.pendiente -= 1;
      calcularEncuadre();
    }
    const actualV = vistaActual.current;
    actualV.zoom += (encuadre.current.zoom * usuario.current.zoom - actualV.zoom) * 0.18;
    actualV.pos.lerp(v1.copy(encuadre.current.pos).add(usuario.current.pos), 0.18);
    const vista = refVista.current;
    vista.scale.setScalar(actualV.zoom);
    vista.position.copy(actualV.pos);
    vista.updateWorldMatrix(true, false);

    NODOS_GRAFO.forEach((nodo, i) => {
      const aparece = salida(limitar(e * 1.7 - distancias[i] * 0.7));
      const [x, y, z] = posiciones[i];
      const p = actuales.current[i].set(
        x * aparece + Math.sin(t * 0.5 + i * 1.7) * 0.035,
        y * aparece + Math.cos(t * 0.45 + i * 2.3) * 0.035,
        z * aparece
      );
      // Luz objetivo: normal, resaltada (foco o vecino) o apagada (el resto).
      let objetivo = 0.78;
      if (idFoco) objetivo = nodo.id === idFoco ? 1 : vecinosFoco.current.has(nodo.id) ? 0.98 : 0.13;
      luz.current[i] += (objetivo - luz.current[i]) * 0.18;
      const l = luz.current[i];
      const resaltado = nodo.id === idFoco;
      const importante = grado(nodo.id) >= 5 || nodo.id === 'yo';

      const punto = refPuntos.current[i];
      punto.position.copy(p);
      // Los puntos de los nodos importantes "laten" suavemente.
      const latido = importante ? 1 + 0.07 * Math.sin(t * 2.2 + i) : 1;
      const radio = radioNodo(nodo.id) * 1.25 * (resaltado ? 1.45 : 1) * latido * aparece;
      punto.scale.setScalar(Math.max(radio, 0.0001));
      recursos.puntos[i].opacity = l * aparece;
      const halo = refHalos.current[i];
      halo.position.copy(p);
      halo.scale.setScalar(Math.max(radio * (resaltado ? 3.3 : importante ? 2.6 : 2.3), 0.0001));
      recursos.halos[i].opacity = (resaltado ? 0.3 : importante ? 0.16 : 0.15) * (nodo.id === 'yo' ? 0.5 : 1) * l * aparece * (claro ? 0.7 : 1);

      const etiqueta = refEtiquetas.current[i];
      etiqueta.position.set(p.x, p.y - radioNodo(nodo.id) * 1.9 - 0.12, p.z);
      const base = importante ? 1 : 0.62;
      const claridad = idFoco ? (l > 0.9 ? 1 : 0.1) : base;
      recursos.etiquetas[i].material.opacity += (claridad * aparece - recursos.etiquetas[i].material.opacity) * 0.2;
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
      const fuerza = (toca ? 1 : idFoco ? 0.05 : claro ? 0.5 : 0.42) * Math.min(1, e * 2);
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
    recursos.materialFicha.opacity += ((idFoco ? 1 : 0) - recursos.materialFicha.opacity) * 0.25;
    ficha.visible = recursos.materialFicha.opacity > 0.02;
    if (idFoco) {
      const raiz = refRaiz.current;
      raiz.updateWorldMatrix(true, false);
      const mundoNodo = v2.copy(actuales.current[indiceDe(idFoco)]).applyMatrix4(vista.matrixWorld).clone();
      const rect = lienzoDom.getBoundingClientRect();
      const nodoPx = aPantalla(mundoNodo, rect, { x: 0, y: 0 });
      // Tamaño de la ficha en pantalla, con la escala real del grupo en que está.
      const escalaRaiz = v3.setFromMatrixScale(raiz.matrixWorld).x;
      const pxPorMundo = 1 / mundoPorPixel(mundoNodo, rect);
      const anchoPx = FICHA.ancho * escalaRaiz * pxPorMundo;
      const altoPx = FICHA.alto * escalaRaiz * pxPorMundo;
      const centro = ubicarFicha({ nodo: nodoPx, ancho: anchoPx, alto: altoPx, area: areaVisible(rect, 8), separacion: 20 });
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
        <lineSegments geometry={recursos.geoLineas} material={recursos.materialLineas} frustumCulled={false} renderOrder={1} raycast={SIN_MOUSE} />
        {NODOS_GRAFO.map((nodo, i) => (
          <group key={nodo.id}>
            <mesh ref={(m) => { refHalos.current[i] = m; }} geometry={recursos.geoPunto} material={recursos.halos[i]} renderOrder={2} raycast={SIN_MOUSE} />
            <mesh ref={(m) => { refPuntos.current[i] = m; }} geometry={recursos.geoPunto} material={recursos.puntos[i]} renderOrder={3} raycast={SIN_MOUSE} />
            <Billboard ref={(m) => { refEtiquetas.current[i] = m; }}>
              <mesh material={recursos.etiquetas[i].material} renderOrder={4} raycast={SIN_MOUSE}>
                <planeGeometry args={[ALTO_ETIQUETA * recursos.etiquetas[i].proporcion, ALTO_ETIQUETA]} />
              </mesh>
            </Billboard>
            {/* Zona de contacto más grande que el punto, para que sea fácil apuntarle. */}
            <mesh
              position={posiciones[i]}
              onPointerOver={(evento) => entrar(i, evento)}
              onPointerOut={() => salir(i)}
              onPointerMove={moviendo}
              onClick={(evento) => alClick(i, evento)}
            >
              <sphereGeometry args={[Math.max(radioNodo(nodo.id) * 3, 0.24), 10, 8]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          </group>
        ))}
      </group>
      <Billboard ref={refFicha} visible={false}>
        <mesh material={recursos.materialFicha} renderOrder={20} raycast={SIN_MOUSE}>
          <planeGeometry args={[FICHA.ancho, FICHA.alto]} />
        </mesh>
      </Billboard>
    </group>
  );
}
