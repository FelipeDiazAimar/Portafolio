'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import * as THREE from 'three';
import PiezaDesarmable from '../PiezaDesarmable.jsx';
import { crearPantalla } from '../pantallaCanvas.js';
import {
  T_COLAPSO,
  aparicion,
  aparicionNucleo,
  colapso,
  enlaces,
  expansion,
  fasePulso,
  posicionNodo,
  progresoEnlace,
  puntoDe,
  puntoEnTramo,
} from '../constelacion.js';
import { dibujarBandera } from '../dibujarBandera.js';
import { MATERIAS } from '../cicloMaterias.js';
import { dibujarTarjeta } from '../texturasMaterias.js';
import { dibujarManzanaEn } from '../manzanaPath.js';
import { dibujarLogoSap, dibujarLogoUtn } from '../dibujarLogos.js';
import { MINIATURAS, Peana } from './hoy/Miniaturas.jsx';
import Grafo from './hoy/Grafo.jsx';

// Un nombre por hito del anillo (el último hito, "Hoy", es el núcleo).
const NOMBRES = ['Origen', '2022', '2023', '2024', '2025', '2026'];
const ENLACES = enlaces();
// Con movimiento reducido: la red ya expandida, sin animación.
const T_QUIETO = 20;

const suave = (x) => x * x * (3 - 2 * x);
const limitar = (x) => Math.min(1, Math.max(0, x));
// Entrada con un pequeño rebote.
const conRebote = (x) => {
  const c1 = 1.70158;
  return x <= 0 ? 0 : x >= 1 ? 1 : 1 + (c1 + 1) * (x - 1) ** 3 + c1 * (x - 1) ** 2;
};

const ARRIBA = new THREE.Vector3(0, 1, 0);
const a = new THREE.Vector3();
const b = new THREE.Vector3();
const direccion = new THREE.Vector3();

// Etiqueta: texto blanco sobre una pastilla azul.
function dibujarEtiqueta(ctx, w, h, texto, nucleo = false) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = nucleo ? 'rgba(47, 123, 255, 0.92)' : 'rgba(10, 22, 52, 0.82)';
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, h / 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(111, 168, 255, 0.9)';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${h * 0.5}px -apple-system, "Segoe UI", system-ui, sans-serif`;
  ctx.fillText(texto, w / 2, h * 0.53);
}

export default function Escena6Constelacion({ activa, reducido, claro = false }) {
  const escudo = useLoader(THREE.TextureLoader, '/cambridge-escudo.png');
  const recursos = useMemo(() => {
    const texturas = [];
    const crear = (ancho, alto, dibujar) => {
      const l = crearPantalla(ancho, alto);
      dibujar(l.ctx, ancho, alto);
      l.textura.needsUpdate = true;
      texturas.push(l.textura);
      return l.textura;
    };
    const std = (opciones) => new THREE.MeshStandardMaterial(opciones);
    const luz = claro ? '#2f6fe6' : '#6fa8ff';
    // La mezcla aditiva sobre un fondo claro se vería blanca: ahí se usa la normal.
    const mezcla = claro ? THREE.NormalBlending : THREE.AdditiveBlending;
    const etiqueta = (texto, nucleo) =>
      new THREE.MeshBasicMaterial({ map: crear(320, 104, (ctx, w, h) => dibujarEtiqueta(ctx, w, h, texto, nucleo)), transparent: true, depthWrite: false, toneMapped: false });
    const logo = (textura) => new THREE.MeshBasicMaterial({ map: textura, transparent: true, depthWrite: false, toneMapped: false });
    escudo.colorSpace = THREE.SRGBColorSpace;
    const mats = {
      aluminio: std({ color: '#c3c9d4', metalness: 0.7, roughness: 0.35 }),
      oscuro: std({ color: '#151821', roughness: 0.6 }),
      claro: std({ color: '#aeb6c6', metalness: 0.5, roughness: 0.4 }),
      acero: std({ color: '#7c879b', metalness: 0.7, roughness: 0.4 }),
      niquel: std({ color: '#d7dbe3', metalness: 0.9, roughness: 0.25 }),
      oro: std({ color: '#e0bc4a', metalness: 1, roughness: 0.3 }),
      pcb: std({ color: '#0d3b44', metalness: 0.2, roughness: 0.55 }),
      tarjeta: std({ color: '#2a2f3b', metalness: 0.5, roughness: 0.4 }),
      ventilador: std({ color: '#0d1018', roughness: 0.6 }),
      tapete: std({ color: '#2f6f64', roughness: 0.85 }),
      amarillo: std({ color: '#f5c518', roughness: 0.45 }),
      lcd: new THREE.MeshBasicMaterial({ color: '#b9c5b6', toneMapped: false }),
      telefono: std({ color: '#7b8190', metalness: 0.85, roughness: 0.3 }),
      pantallaTelefono: new THREE.MeshBasicMaterial({ color: '#2a4fb8', toneMapped: false }),
      cinta: std({ color: '#1d2a4a', roughness: 0.7 }),
      carton: std({ color: '#c79a62', roughness: 0.8 }),
      laser: new THREE.MeshBasicMaterial({ color: '#7fb4ff', transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }),
      aro: new THREE.MeshBasicMaterial({ color: luz, transparent: true, opacity: 0.7, toneMapped: false }),
      nucleo: new THREE.MeshBasicMaterial({ color: '#4d8dff', transparent: true, opacity: 0.8, toneMapped: false }),
      aroNucleo: new THREE.MeshBasicMaterial({ color: luz, transparent: true, opacity: 0.6, toneMapped: false }),
      onda: new THREE.MeshBasicMaterial({ color: luz, transparent: true, opacity: 0, depthWrite: false, blending: mezcla, toneMapped: false }),
      cadena: new THREE.MeshBasicMaterial({ color: luz, transparent: true, opacity: 0.85, depthWrite: false, blending: mezcla, toneMapped: false }),
      hilo: new THREE.MeshBasicMaterial({ color: luz, transparent: true, opacity: 0.22, depthWrite: false, blending: mezcla, toneMapped: false }),
      pulso: new THREE.MeshBasicMaterial({ color: claro ? '#0b3d91' : '#c9e0ff', toneMapped: false }),
      bandera: new THREE.MeshBasicMaterial({ map: crear(512, 330, (ctx, w, h) => dibujarBandera(ctx, w, h)), side: THREE.DoubleSide, toneMapped: false }),
      pantallaMini: new THREE.MeshBasicMaterial({
        map: crear(512, 330, (ctx, w, h) => {
          ctx.fillStyle = '#05060a';
          ctx.fillRect(0, 0, w, h);
          dibujarManzanaEn(ctx, w / 2, h / 2, h * 0.42, '#ffffff');
        }),
        toneMapped: false,
      }),
      tarjetas: MATERIAS.slice(0, 3).map(
        (nombre, i) => new THREE.MeshBasicMaterial({ map: crear(640, 400, (ctx, w, h) => dibujarTarjeta(ctx, w, h, nombre, i, claro)), side: THREE.DoubleSide, toneMapped: false })
      ),
      logoUtn: logo(crear(300, 340, (ctx, w, h) => dibujarLogoUtn(ctx, w, h, claro ? '#16254d' : '#f2f6ff'))),
      logoSap: logo(crear(512, 250, (ctx, w, h) => dibujarLogoSap(ctx, w, h))),
      logoCambridge: logo(escudo),
    };
    return {
      texturas,
      mats,
      etiquetas: NOMBRES.map((n) => etiqueta(n, false)),
      etiquetaNucleo: etiqueta('HOY', true),
      luz,
      nucleoBorde: new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.42, 0)),
      geoEnlace: new THREE.CylinderGeometry(1, 1, 1, 6, 1, true),
      geoPulso: new THREE.SphereGeometry(1, 10, 10),
    };
  }, [claro, escudo]);
  const { mats, etiquetas, etiquetaNucleo, luz, nucleoBorde, geoEnlace, geoPulso } = recursos;

  const tiempo = useRef(reducido ? T_QUIETO : 0);
  const refConstelacion = useRef(null);
  const refAnillo = useRef(null);
  const refNodos = useRef([]);
  const refMiniaturas = useRef([]);
  const refNucleo = useRef(null);
  const refEtiquetaNucleo = useRef(null);
  const refEnlaces = useRef([]);
  const refPulsos = useRef([]);
  const refOnda = useRef(null);
  const refRed = useRef(null);
  const refBandera = useRef(null);

  useEffect(
    () => () => {
      recursos.texturas.forEach((t) => t.dispose());
      const liberar = (m) => (Array.isArray(m) ? m.forEach(liberar) : m.dispose?.());
      Object.entries(recursos.mats).forEach(([clave, m]) => {
        if (clave !== 'logoCambridge') liberar(m);
      });
      etiquetas.forEach((m) => m.dispose());
      etiquetaNucleo.dispose();
      nucleoBorde.dispose();
      geoEnlace.dispose();
      geoPulso.dispose();
    },
    [recursos, etiquetas, etiquetaNucleo, nucleoBorde, geoEnlace, geoPulso]
  );

  useFrame((_, delta) => {
    if (!activa) return;
    if (!reducido) tiempo.current += Math.min(delta, 0.05);
    const t = tiempo.current;
    const recogida = suave(colapso(t));
    const red = expansion(t);

    // Mientras la constelación existe: nodos que van apareciendo, enlaces que se dibujan.
    const constelacion = refConstelacion.current;
    constelacion.visible = colapso(t) < 1;
    if (constelacion.visible) {
      if (refAnillo.current) refAnillo.current.rotation.y = t * 0.14;
      refNodos.current.forEach((nodo, i) => {
        if (!nodo) return;
        const escala = conRebote(aparicion(i, t)) * (1 - recogida);
        nodo.visible = escala > 0.002;
        nodo.scale.setScalar(Math.max(escala, 0.0001));
        const [x, y, z] = posicionNodo(i);
        nodo.position.set(-x * recogida, -y * recogida, -z * recogida);
        if (refMiniaturas.current[i]) refMiniaturas.current[i].rotation.y = t * 0.45 + i * 1.3;
      });

      ENLACES.forEach((enlace, k) => {
        const cilindro = refEnlaces.current[k];
        const pulso = refPulsos.current[k];
        const progreso = progresoEnlace(enlace, t);
        const visible = progreso > 0.001 && recogida < 0.995;
        cilindro.visible = visible;
        if (visible) {
          const pa = puntoDe(enlace.desde);
          const pb = puntoDe(enlace.hasta);
          a.set(pa[0], pa[1], pa[2]).multiplyScalar(1 - recogida);
          b.set(pb[0], pb[1], pb[2]).multiplyScalar(1 - recogida);
          direccion.subVectors(b, a);
          const largo = direccion.length();
          cilindro.position.copy(a).addScaledVector(direccion, progreso / 2);
          cilindro.scale.set(enlace.tipo === 'cadena' ? 0.02 : 0.008, Math.max(largo * progreso, 0.0001), enlace.tipo === 'cadena' ? 0.02 : 0.008);
          if (largo > 1e-6) cilindro.quaternion.setFromUnitVectors(ARRIBA, direccion.normalize());
        }
        // Pulso de luz: sólo cuando el enlace ya está completo.
        const pulsa = progreso >= 1 && recogida < 0.5;
        pulso.visible = pulsa;
        if (pulsa) {
          const p = puntoEnTramo(puntoDe(enlace.desde), puntoDe(enlace.hasta), fasePulso(t, k));
          pulso.position.set(p[0] * (1 - recogida), p[1] * (1 - recogida), p[2] * (1 - recogida));
        }
      });
      mats.cadena.opacity = 0.85 * (1 - recogida);
      mats.hilo.opacity = 0.22 * (1 - recogida);
    }

    // Bandera: se ondula con una onda que viaja de la punta al asta.
    const bandera = refBandera.current;
    if (bandera && constelacion.visible) {
      const pos = bandera.geometry.attributes.position;
      for (let k = 0; k < pos.count; k += 1) {
        const x = pos.getX(k);
        pos.setZ(k, Math.sin(x * 7 - t * 4) * 0.05 * ((x + 0.39) / 0.78));
      }
      pos.needsUpdate = true;
    }

    // Núcleo: aparece primero, destella al terminar de recogerse y se disuelve en la red.
    const nucleo = refNucleo.current;
    const destello = Math.sin(Math.PI * limitar((t - (T_COLAPSO[1] - 0.6)) / 1.2));
    const escalaNucleo = aparicionNucleo(t) * (1 - suave(limitar(red * 2.4))) * (1 + 0.9 * destello + 0.25 * recogida);
    nucleo.scale.setScalar(Math.max(escalaNucleo, 0.0001));
    nucleo.rotation.y = t * 0.6;
    nucleo.rotation.x = t * 0.35;
    mats.nucleo.opacity = 0.6 + 0.25 * Math.sin(t * 2);
    refEtiquetaNucleo.current.scale.setScalar(Math.max(aparicionNucleo(t) * (1 - recogida), 0.0001));

    // Onda expansiva: un aro de luz que sale del núcleo cuando nace la red.
    const onda = refOnda.current;
    onda.visible = red > 0 && red < 1;
    if (onda.visible) {
      onda.scale.setScalar(0.3 + 3.4 * (1 - (1 - red) ** 2));
      mats.onda.opacity = 0.9 * (1 - red) ** 1.5;
    }

    // El grafo aparece cuando empieza la expansión.
    refRed.current.visible = red > 0;
  });

  return (
    <group key={claro ? 'claro' : 'oscuro'} position={[0, 0.15, 0]} rotation={[0.68, 0, 0]} scale={0.57}>
      <directionalLight position={[3, 5, 4]} intensity={claro ? 2.2 : 1.6} color="#ffffff" />
      <directionalLight position={[-4, 2, -3]} intensity={0.6} color="#9fc2ff" />

      {/* Constelación: una miniatura por hito, cada una con su aro, su etiqueta y su logo. */}
      <group ref={refConstelacion}>
        <group ref={refAnillo}>
          {NOMBRES.map((nombre, i) => {
            const Miniatura = MINIATURAS[i];
            return (
              <PiezaDesarmable key={nombre} posicion={posicionNodo(i)} semilla={i + 1}>
                <group ref={(nodo) => { refNodos.current[i] = nodo; }}>
                  <group ref={(nodo) => { refMiniaturas.current[i] = nodo; }}>
                    <Miniatura mats={mats} refBandera={refBandera} />
                  </group>
                  <Peana mats={mats} etiqueta={etiquetas[i]} />
                </group>
              </PiezaDesarmable>
            );
          })}

          {/* Enlaces de luz (cilindros finos que crecen) y los pulsos que viajan por ellos. */}
          <PiezaDesarmable semilla={8}>
            {ENLACES.map((e, k) => (
              <mesh key={`e${k}`} ref={(nodo) => { refEnlaces.current[k] = nodo; }} geometry={geoEnlace} material={e.tipo === 'cadena' ? mats.cadena : mats.hilo} visible={false} />
            ))}
            {ENLACES.map((e, k) => (
              <mesh
                key={`p${k}`}
                ref={(nodo) => { refPulsos.current[k] = nodo; }}
                geometry={geoPulso}
                material={mats.pulso}
                scale={e.tipo === 'cadena' ? 0.055 : 0.032}
                visible={false}
              />
            ))}
          </PiezaDesarmable>
        </group>
      </group>

      {/* Núcleo "Hoy" y su onda expansiva. */}
      <PiezaDesarmable semilla={7}>
        <group ref={refNucleo} scale={0.0001}>
          <mesh material={mats.nucleo}>
            <icosahedronGeometry args={[0.3, 1]} />
          </mesh>
          <lineSegments geometry={nucleoBorde}>
            <lineBasicMaterial color={luz} />
          </lineSegments>
          <mesh rotation={[Math.PI / 2.4, 0, 0]} material={mats.aroNucleo}>
            <torusGeometry args={[0.62, 0.012, 8, 64]} />
          </mesh>
          <mesh rotation={[Math.PI / 2.4, 0.9, 0.5]} material={mats.aroNucleo}>
            <torusGeometry args={[0.82, 0.008, 8, 64]} />
          </mesh>
        </group>
        <Billboard position={[0, 0.75, 0]}>
          <group ref={refEtiquetaNucleo} scale={0.0001}>
            <mesh material={etiquetaNucleo}>
              <planeGeometry args={[0.62, 0.2]} />
            </mesh>
          </group>
        </Billboard>
        <mesh ref={refOnda} rotation={[Math.PI / 2.4, 0, 0]} material={mats.onda} visible={false}>
          <torusGeometry args={[1, 0.02, 8, 96]} />
        </mesh>
      </PiezaDesarmable>

      {/* El grafo de conocimiento 3D (estilo Obsidian) en que se expande el núcleo; se contrarresta la inclinación de la escena para que quede derecho. */}
      <PiezaDesarmable semilla={9}>
        <group ref={refRed} visible={false} rotation={[-0.68, 0, 0]}>
          <Grafo tiempo={tiempo} claro={claro} />
        </group>
      </PiezaDesarmable>
    </group>
  );
}
