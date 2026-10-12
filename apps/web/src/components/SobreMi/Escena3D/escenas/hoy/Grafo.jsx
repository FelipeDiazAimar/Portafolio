'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { crearPantalla } from '../../pantallaCanvas.js';
import { expansion } from '../../constelacion.js';
import { ENLACES_GRAFO, GRUPOS, NODOS_GRAFO, distribuir, grado, indiceDe, radioNodo, vecinos } from '../../grafo.js';

const SANS = '-apple-system, "SF Pro Text", "Segoe UI", system-ui, sans-serif';
const RADIO = 2.6;
const ALTO_ETIQUETA = 0.15;
// Sólo las zonas de contacto reciben el mouse: lo demás (etiquetas, ficha, halos, líneas)
// no debe taparlas ni sacarles el foco.
const SIN_MOUSE = () => null;
const salida = (x) => 1 - (1 - x) ** 3;
const limitar = (x) => Math.min(1, Math.max(0, x));

// Parte un texto en renglones que entren en `ancho` píxeles.
function renglones(ctx, texto, ancho) {
  const palabras = texto.split(' ');
  const lista = [];
  let actual = '';
  for (const palabra of palabras) {
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
  ctx.fillStyle = claro ? 'rgba(255, 255, 255, 0.96)' : 'rgba(10, 16, 34, 0.94)';
  ctx.beginPath();
  ctx.roundRect(4, 4, w - 8, h - 8, 26);
  ctx.fill();
  ctx.strokeStyle = claro ? 'rgba(22, 37, 77, 0.25)' : 'rgba(111, 168, 255, 0.55)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(46, 58, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = claro ? '#5b6a8f' : '#8fa3d6';
  ctx.font = `600 26px ${SANS}`;
  ctx.fillText(GRUPOS[nodo.grupo].nombre.toUpperCase(), 70, 58);
  ctx.fillStyle = claro ? '#0e1a3d' : '#ffffff';
  ctx.font = `800 40px ${SANS}`;
  ctx.fillText(nodo.etiqueta, 36, 112);
  ctx.fillStyle = claro ? '#34436b' : '#c9d6f5';
  ctx.font = `400 28px ${SANS}`;
  renglones(ctx, nodo.detalle, w - 72).slice(0, 3).forEach((linea, i) => ctx.fillText(linea, 36, 162 + i * 38));
}

// Grafo de conocimiento estilo Obsidian: puntos chicos, líneas finas y etiquetas. Al
// pasar el mouse por un nodo se resaltan él y sus vecinos, el resto se apaga y
// aparece una ficha con texto. Sale del núcleo con la expansión.
export default function Grafo({ tiempo, claro }) {
  const lienzoDom = useThree((estado) => estado.gl.domElement);
  const posiciones = useMemo(() => distribuir(RADIO), []);
  const distancias = useMemo(() => posiciones.map(([x, y]) => Math.hypot(x, y) / RADIO), [posiciones]);

  const recursos = useMemo(() => {
    const texturas = [];
    const medida = document.createElement('canvas').getContext('2d');
    medida.font = `600 34px ${SANS}`;
    const colorEtiqueta = claro ? '#16254d' : '#e6eeff';
    const etiquetas = NODOS_GRAFO.map((nodo) => {
      const ancho = Math.ceil(medida.measureText(nodo.etiqueta).width) + 24;
      const lienzo = crearPantalla(ancho, 54);
      lienzo.ctx.font = `600 34px ${SANS}`;
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
      if (claro) c.offsetHSL(0, 0.05, -0.22);
      return c;
    });
    return {
      texturas,
      etiquetas,
      ficha,
      colores,
      puntos: NODOS_GRAFO.map((_, i) => new THREE.MeshBasicMaterial({ color: colores[i], transparent: true, opacity: 0, depthWrite: false, toneMapped: false })),
      halos: NODOS_GRAFO.map((_, i) => new THREE.MeshBasicMaterial({ color: colores[i], transparent: true, opacity: 0, depthWrite: false, toneMapped: false })),
      materialFicha: new THREE.MeshBasicMaterial({ map: ficha.textura, transparent: true, opacity: 0, depthWrite: false, depthTest: false, toneMapped: false }),
      materialLineas: new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, toneMapped: false }),
      geoPunto: new THREE.CircleGeometry(1, 28),
      geoLineas: (() => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ENLACES_GRAFO.length * 6), 3));
        g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(ENLACES_GRAFO.length * 8), 4));
        return g;
      })(),
      colorLinea: new THREE.Color(claro ? '#27407f' : '#9fb8ff'),
    };
  }, [claro]);

  const foco = useRef(null);
  const luz = useRef(NODOS_GRAFO.map(() => 0.7));
  const actuales = useRef(posiciones.map(() => new THREE.Vector3()));
  const refPuntos = useRef([]);
  const refHalos = useRef([]);
  const refEtiquetas = useRef([]);
  const refFicha = useRef(null);
  const ultimaFicha = useRef(null);
  const vecinosFoco = useRef(new Set());

  const cursor = (valor) => {
    document.body.style.cursor = valor;
  };
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
    [recursos]
  );

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

  useFrame((estado) => {
    const t = tiempo.current;
    const e = expansion(t);
    const listo = e >= 0.95;
    const idFoco = listo ? foco.current : null;
    const posLineas = recursos.geoLineas.attributes.position;
    const colLineas = recursos.geoLineas.attributes.color;

    NODOS_GRAFO.forEach((nodo, i) => {
      const aparece = salida(limitar(e * 1.7 - distancias[i] * 0.7));
      const [x, y, z] = posiciones[i];
      const p = actuales.current[i].set(
        x * aparece + Math.sin(t * 0.5 + i * 1.7) * 0.035,
        y * aparece + Math.cos(t * 0.45 + i * 2.3) * 0.035,
        z * aparece
      );
      // Luz objetivo: normal, resaltada (foco o vecino) o apagada (el resto).
      let objetivo = 0.72;
      if (idFoco) objetivo = nodo.id === idFoco ? 1 : vecinosFoco.current.has(nodo.id) ? 0.95 : 0.13;
      luz.current[i] += (objetivo - luz.current[i]) * 0.18;
      const l = luz.current[i];
      const resaltado = nodo.id === idFoco;

      const punto = refPuntos.current[i];
      punto.position.copy(p);
      const radio = radioNodo(nodo.id) * (resaltado ? 1.5 : 1) * aparece;
      punto.scale.setScalar(Math.max(radio, 0.0001));
      recursos.puntos[i].opacity = l * aparece;
      const halo = refHalos.current[i];
      halo.position.copy(p);
      halo.scale.setScalar(Math.max(radio * (resaltado ? 3.4 : 2.2), 0.0001));
      recursos.halos[i].opacity = (resaltado ? 0.16 : 0.09) * l * aparece;

      const etiqueta = refEtiquetas.current[i];
      etiqueta.position.set(p.x, p.y - radioNodo(nodo.id) * 1.5 - 0.12, p.z);
      const importante = grado(nodo.id) >= 5 || nodo.id === 'yo';
      const base = importante ? 0.95 : 0.5;
      const claridad = idFoco ? (l > 0.9 ? 1 : 0.1) : base;
      recursos.etiquetas[i].material.opacity += (claridad * aparece - recursos.etiquetas[i].material.opacity) * 0.2;
    });

    // Líneas: siguen a los nodos y se encienden con el foco.
    ENLACES_GRAFO.forEach(({ a, b }, k) => {
      const ia = indiceDe(a);
      const ib = indiceDe(b);
      const pa = actuales.current[ia];
      const pb = actuales.current[ib];
      posLineas.setXYZ(k * 2, pa.x, pa.y, pa.z);
      posLineas.setXYZ(k * 2 + 1, pb.x, pb.y, pb.z);
      const toca = idFoco && (a === idFoco || b === idFoco);
      const fuerza = (toca ? 0.95 : idFoco ? 0.05 : 0.3) * Math.min(luz.current[ia] > 0.5 || !idFoco ? 1 : 0.4, 1) * Math.min(1, e * 2);
      const c = toca && claro ? recursos.colores[indiceDe(a === idFoco ? b : a)] : recursos.colorLinea;
      colLineas.setXYZW(k * 2, c.r, c.g, c.b, fuerza);
      colLineas.setXYZW(k * 2 + 1, c.r, c.g, c.b, fuerza);
    });
    posLineas.needsUpdate = true;
    colLineas.needsUpdate = true;

    // Ficha: sigue al nodo con foco; el texto se redibuja sólo al cambiar de nodo.
    const ficha = refFicha.current;
    if (idFoco !== ultimaFicha.current) {
      ultimaFicha.current = idFoco;
      if (idFoco) {
        dibujarFicha(recursos.ficha.ctx, recursos.ficha.ancho, recursos.ficha.alto, NODOS_GRAFO[indiceDe(idFoco)], claro);
        recursos.ficha.textura.needsUpdate = true;
      }
    }
    const meta = idFoco ? 1 : 0;
    recursos.materialFicha.opacity += (meta - recursos.materialFicha.opacity) * 0.25;
    ficha.visible = recursos.materialFicha.opacity > 0.02;
    if (idFoco) {
      const p = actuales.current[indiceDe(idFoco)];
      // La ficha se corre hacia el lado libre para no salirse del cuadro.
      const lado = p.x > 0.4 ? -1 : 1;
      ficha.position.set(p.x + lado * 1.05, p.y + 0.5, p.z + 0.3);
    }
    void estado;
  });

  return (
    <group>
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
          >
            <sphereGeometry args={[Math.max(radioNodo(nodo.id) * 2.6, 0.2), 10, 8]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>
      ))}
      <Billboard ref={refFicha} visible={false}>
        <mesh material={recursos.materialFicha} renderOrder={20} raycast={SIN_MOUSE}>
          <planeGeometry args={[1.9, 0.686]} />
        </mesh>
      </Billboard>
    </group>
  );
}
