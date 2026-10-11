'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Line, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import PiezaDesarmable from '../PiezaDesarmable.jsx';
import { crearPantalla } from '../pantallaCanvas.js';
import { enlaces, fasePulso, posicionNodo, puntoDe, puntoEnTramo } from '../constelacion.js';
import { dibujarBandera } from '../dibujarBandera.js';
import { MATERIAS } from '../cicloMaterias.js';
import { dibujarTarjeta } from '../texturasMaterias.js';
import { dibujarManzanaEn } from '../manzanaPath.js';

// Un nombre por hito del anillo (el último hito, "Hoy", es el núcleo).
const NOMBRES = ['Origen', '2022', '2023', '2024', '2025', '2026'];
const ENLACES = enlaces();

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

// Aro de luz bajo cada miniatura y su etiqueta flotando arriba.
function Peana({ mats, etiqueta }) {
  return (
    <>
      <mesh position={[0, -0.04, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.aro}>
        <torusGeometry args={[0.66, 0.012, 8, 64]} />
      </mesh>
      <Billboard position={[0, 1.05, 0]}>
        <mesh material={etiqueta}>
          <planeGeometry args={[0.62, 0.2]} />
        </mesh>
      </Billboard>
    </>
  );
}

// 0 — Origen: la notebook, abierta, con la manzana en la pantalla.
function MiniNotebook({ mats }) {
  return (
    <group position={[0, 0, 0.05]}>
      <RoundedBox args={[1, 0.05, 0.7]} radius={0.02} smoothness={3} position={[0, 0.025, 0]} material={mats.aluminio} />
      <mesh position={[0, 0.053, -0.06]} material={mats.oscuro}>
        <boxGeometry args={[0.86, 0.008, 0.3]} />
      </mesh>
      <mesh position={[0, 0.052, 0.22]} material={mats.claro}>
        <boxGeometry args={[0.32, 0.006, 0.17]} />
      </mesh>
      <group position={[0, 0.05, -0.35]} rotation={[-1.75, 0, 0]}>
        <RoundedBox args={[1, 0.035, 0.7]} radius={0.015} smoothness={3} position={[0, 0, 0.35]} material={mats.aluminio} />
        <mesh position={[0, -0.019, 0.35]} rotation={[Math.PI / 2, 0, 0]} material={mats.pantallaMini}>
          <planeGeometry args={[0.92, 0.6]} />
        </mesh>
      </group>
    </group>
  );
}

// 1 — 2022: la bandera en su asta, con un leve flameo.
function MiniBandera({ mats, refBandera }) {
  return (
    <group position={[-0.3, 0, 0]}>
      <mesh position={[0, 0.58, 0]} material={mats.aluminio}>
        <cylinderGeometry args={[0.018, 0.022, 1.16, 12]} />
      </mesh>
      <mesh position={[0, 1.17, 0]} material={mats.oro}>
        <sphereGeometry args={[0.04, 12, 12]} />
      </mesh>
      <mesh ref={refBandera} position={[0.4, 0.85, 0]} material={mats.bandera}>
        <planeGeometry args={[0.78, 0.5, 14, 6]} />
      </mesh>
      <mesh position={[0, 0.02, 0]} material={mats.aluminio}>
        <cylinderGeometry args={[0.1, 0.12, 0.04, 20]} />
      </mesh>
    </group>
  );
}

// 2 — 2023: tres tarjetas de materias en abanico.
function MiniTarjetas({ mats }) {
  return (
    <group position={[0, 0.5, 0]}>
      {mats.tarjetas.map((material, i) => (
        <mesh key={i} position={[(i - 1) * 0.18, (1 - i) * 0.06, i * 0.07]} rotation={[0, (1 - i) * 0.18, (i - 1) * 0.08]} material={material}>
          <planeGeometry args={[0.8, 0.5]} />
        </mesh>
      ))}
    </group>
  );
}

// 3 — 2024: la placa con procesador, memorias y gráfica.
function MiniPlaca({ mats }) {
  return (
    <group>
      <mesh position={[0, 0.02, 0]} material={mats.pcb}>
        <boxGeometry args={[1, 0.04, 1]} />
      </mesh>
      <mesh position={[0.02, 0.06, -0.12]} material={mats.acero}>
        <boxGeometry args={[0.26, 0.04, 0.26]} />
      </mesh>
      <mesh position={[0.02, 0.085, -0.12]} material={mats.niquel}>
        <boxGeometry args={[0.18, 0.015, 0.18]} />
      </mesh>
      {[0.36, 0.44].map((x) => (
        <mesh key={x} position={[x, 0.2, -0.1]} material={mats.oscuro}>
          <boxGeometry args={[0.035, 0.32, 0.6]} />
        </mesh>
      ))}
      <mesh position={[-0.36, 0.1, -0.28]} material={mats.acero}>
        <boxGeometry args={[0.2, 0.12, 0.3]} />
      </mesh>
      <group position={[-0.12, 0.2, 0.34]}>
        <mesh material={mats.tarjeta}>
          <boxGeometry args={[0.86, 0.3, 0.12]} />
        </mesh>
        {[-0.2, 0.2].map((x) => (
          <mesh key={x} position={[x, 0, 0.065]} rotation={[Math.PI / 2, 0, 0]} material={mats.ventilador}>
            <cylinderGeometry args={[0.1, 0.1, 0.012, 20]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// 4 — 2025: el banco de trabajo, con el multímetro y el celular.
function MiniBanco({ mats }) {
  return (
    <group>
      <mesh position={[0, 0.015, 0]} material={mats.tapete}>
        <boxGeometry args={[1.2, 0.03, 0.85]} />
      </mesh>
      <mesh position={[-0.05, 0.05, -0.05]} material={mats.pcb}>
        <boxGeometry args={[0.46, 0.03, 0.46]} />
      </mesh>
      <group position={[0.4, 0.06, -0.08]} rotation={[0, 0.4, 0]}>
        <mesh material={mats.amarillo}>
          <boxGeometry args={[0.22, 0.06, 0.45]} />
        </mesh>
        <mesh position={[0, 0.032, -0.12]} material={mats.lcd}>
          <boxGeometry args={[0.15, 0.004, 0.08]} />
        </mesh>
        <mesh position={[0, 0.034, 0.08]} material={mats.oscuro}>
          <cylinderGeometry args={[0.06, 0.06, 0.008, 16]} />
        </mesh>
      </group>
      <group position={[-0.42, 0.03, 0.22]} rotation={[0, 0.5, 0]}>
        <RoundedBox args={[0.2, 0.025, 0.4]} radius={0.02} smoothness={3} material={mats.telefono} />
        <mesh position={[0, 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats.pantallaTelefono}>
          <planeGeometry args={[0.17, 0.36]} />
        </mesh>
      </group>
      <mesh position={[-0.35, 0.14, -0.28]} rotation={[0, 0.3, 0]} material={mats.aluminio}>
        <boxGeometry args={[0.4, 0.22, 0.03]} />
      </mesh>
    </group>
  );
}

// 5 — 2026: la cinta en L con cajas y el escáner.
function MiniPlanta({ mats }) {
  return (
    <group>
      <mesh position={[-0.1, 0.2, 0.3]} material={mats.cinta}>
        <boxGeometry args={[0.95, 0.07, 0.22]} />
      </mesh>
      <mesh position={[0.38, 0.2, -0.12]} material={mats.cinta}>
        <boxGeometry args={[0.22, 0.07, 0.8]} />
      </mesh>
      {[[-0.5, 0.2], [0.3, 0.4], [0.4, -0.45], [0.4, 0.4]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.1, z]} material={mats.acero}>
          <boxGeometry args={[0.04, 0.2, 0.04]} />
        </mesh>
      ))}
      {[[-0.35, 0.3], [0.05, 0.3], [0.38, -0.1]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.31, z]} material={mats.carton}>
          <boxGeometry args={[0.15, 0.15, 0.15]} />
        </mesh>
      ))}
      <group position={[-0.15, 0, 0.3]}>
        {[-1, 1].map((l) => (
          <mesh key={l} position={[0, 0.34, l * 0.17]} material={mats.acero}>
            <boxGeometry args={[0.04, 0.6, 0.04]} />
          </mesh>
        ))}
        <mesh position={[0, 0.64, 0]} material={mats.acero}>
          <boxGeometry args={[0.05, 0.04, 0.4]} />
        </mesh>
        <mesh position={[0, 0.46, 0]} material={mats.laser}>
          <boxGeometry args={[0.005, 0.3, 0.3]} />
        </mesh>
      </group>
    </group>
  );
}

const MINIATURAS = [MiniNotebook, MiniBandera, MiniTarjetas, MiniPlaca, MiniBanco, MiniPlanta];

export default function Escena6Constelacion({ activa, reducido, claro = false }) {
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
    const etiqueta = (texto, nucleo) =>
      new THREE.MeshBasicMaterial({ map: crear(320, 104, (ctx, w, h) => dibujarEtiqueta(ctx, w, h, texto, nucleo)), transparent: true, depthWrite: false, toneMapped: false });
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
      pulso: new THREE.MeshBasicMaterial({ color: '#c9e0ff', toneMapped: false }),
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
    };
    return {
      texturas,
      mats,
      etiquetas: NOMBRES.map((n) => etiqueta(n, false)),
      etiquetaNucleo: etiqueta('HOY', true),
      luz,
      nucleoBorde: new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.42, 0)),
    };
  }, [claro]);
  const { mats, etiquetas, etiquetaNucleo, luz, nucleoBorde } = recursos;

  const tiempo = useRef(0);
  const refAnillo = useRef(null);
  const refMiniaturas = useRef([]);
  const refNucleo = useRef(null);
  const refPulsos = useRef([]);
  const refBandera = useRef(null);

  useEffect(
    () => () => {
      recursos.texturas.forEach((t) => t.dispose());
      const liberar = (m) => (Array.isArray(m) ? m.forEach(liberar) : m.dispose?.());
      Object.values(recursos.mats).forEach(liberar);
      etiquetas.forEach((m) => m.dispose());
      etiquetaNucleo.dispose();
      nucleoBorde.dispose();
    },
    [recursos, etiquetas, etiquetaNucleo, nucleoBorde]
  );

  useFrame((_, delta) => {
    if (!activa) return;
    if (!reducido) tiempo.current += Math.min(delta, 0.05);
    const t = tiempo.current;

    // El anillo gira despacio y cada miniatura gira sobre sí misma.
    if (refAnillo.current) refAnillo.current.rotation.y = t * 0.14;
    refMiniaturas.current.forEach((grupo, i) => {
      if (grupo) grupo.rotation.y = t * 0.45 + i * 1.3;
    });
    if (refNucleo.current) {
      refNucleo.current.rotation.y = t * 0.6;
      refNucleo.current.rotation.x = t * 0.35;
    }
    mats.nucleo.opacity = 0.6 + 0.25 * Math.sin(t * 2);

    // La bandera flamea: se ondula el plano con una onda que viaja de la punta al asta.
    const bandera = refBandera.current;
    if (bandera) {
      const pos = bandera.geometry.attributes.position;
      for (let k = 0; k < pos.count; k += 1) {
        const x = pos.getX(k);
        const peso = (x + 0.39) / 0.78;
        pos.setZ(k, Math.sin(x * 7 - t * 4) * 0.05 * peso);
      }
      pos.needsUpdate = true;
    }

    // Pulsos de luz que recorren los enlaces.
    ENLACES.forEach((enlace, k) => {
      const pulso = refPulsos.current[k];
      if (!pulso) return;
      const p = puntoEnTramo(puntoDe(enlace.desde), puntoDe(enlace.hasta), fasePulso(t, k));
      pulso.position.set(p[0], p[1], p[2]);
    });
  });

  return (
    <group key={claro ? 'claro' : 'oscuro'} position={[0, 0.15, 0]} rotation={[0.68, 0, 0]} scale={0.57}>
      <directionalLight position={[3, 5, 4]} intensity={claro ? 2.2 : 1.6} color="#ffffff" />
      <directionalLight position={[-4, 2, -3]} intensity={0.6} color="#9fc2ff" />

      {/* Anillo de miniaturas: una por hito, cada una con su aro y su etiqueta. */}
      <group ref={refAnillo}>
        {NOMBRES.map((nombre, i) => {
          const Miniatura = MINIATURAS[i];
          const posicion = posicionNodo(i);
          return (
            <PiezaDesarmable key={nombre} posicion={posicion} semilla={i + 1}>
              <group ref={(nodo) => { refMiniaturas.current[i] = nodo; }}>
                <Miniatura mats={mats} refBandera={refBandera} />
              </group>
              <Peana mats={mats} etiqueta={etiquetas[i]} />
            </PiezaDesarmable>
          );
        })}

        {/* Enlaces de luz y los pulsos que viajan por ellos. */}
        <PiezaDesarmable semilla={8}>
          {ENLACES.map((e, k) => (
            <Line
              key={k}
              points={[puntoDe(e.desde), puntoDe(e.hasta)]}
              color={luz}
              lineWidth={e.tipo === 'cadena' ? 2 : 1}
              transparent
              opacity={e.tipo === 'cadena' ? 0.85 : 0.22}
            />
          ))}
          {ENLACES.map((e, k) => (
            <mesh key={k} ref={(nodo) => { refPulsos.current[k] = nodo; }} material={mats.pulso}>
              <sphereGeometry args={[e.tipo === 'cadena' ? 0.055 : 0.032, 10, 10]} />
            </mesh>
          ))}
        </PiezaDesarmable>

        {/* Núcleo: "Hoy". */}
        <PiezaDesarmable semilla={7}>
          <group ref={refNucleo}>
            <mesh material={mats.nucleo}>
              <icosahedronGeometry args={[0.3, 1]} />
            </mesh>
            <lineSegments geometry={nucleoBorde}>
              <lineBasicMaterial color={luz} />
            </lineSegments>
          </group>
          <mesh rotation={[Math.PI / 2.4, 0, 0]} material={mats.aroNucleo}>
            <torusGeometry args={[0.62, 0.012, 8, 64]} />
          </mesh>
          <mesh rotation={[Math.PI / 2.4, 0.9, 0.5]} material={mats.aroNucleo}>
            <torusGeometry args={[0.82, 0.008, 8, 64]} />
          </mesh>
          <Billboard position={[0, 0.75, 0]}>
            <mesh material={etiquetaNucleo}>
              <planeGeometry args={[0.62, 0.2]} />
            </mesh>
          </Billboard>
        </PiezaDesarmable>
      </group>
    </group>
  );
}
