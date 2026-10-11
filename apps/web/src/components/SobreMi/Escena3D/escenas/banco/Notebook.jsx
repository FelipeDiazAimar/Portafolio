'use client';

import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import { COLUMNAS, DISPOSICION, TOTAL_TECLAS } from '../../tecladoQwerty.js';

const ANCHO_TECLADO = 1.26;
const ALTO_TECLADO = 0.45;
const PASO_X = ANCHO_TECLADO / COLUMNAS;
const PASO_Z = ALTO_TECLADO / DISPOSICION.length;
const Z_TECLADO = 0.22;

// Las 60 teclas son una sola malla instanciada, con un color por tecla.
function Teclas({ material, color }) {
  const malla = useRef(null);
  useLayoutEffect(() => {
    const aux = new THREE.Object3D();
    const c = new THREE.Color(color);
    for (let i = 0; i < TOTAL_TECLAS; i += 1) {
      const fila = Math.floor(i / COLUMNAS);
      const columna = i % COLUMNAS;
      aux.position.set((columna - (COLUMNAS - 1) / 2) * PASO_X, 0.063, Z_TECLADO + (fila - (DISPOSICION.length - 1) / 2) * PASO_Z);
      aux.updateMatrix();
      malla.current.setMatrixAt(i, aux.matrix);
      malla.current.setColorAt(i, c);
    }
    malla.current.instanceMatrix.needsUpdate = true;
    malla.current.instanceColor.needsUpdate = true;
  }, [color]);
  return (
    <instancedMesh ref={malla} args={[undefined, material, TOTAL_TECLAS]}>
      <boxGeometry args={[PASO_X * 0.86, 0.022, PASO_Z * 0.84]} />
    </instancedMesh>
  );
}

// Notebook abierta con teclado, trackpad, bisagra, puertos y una pantalla
// que muestra el diagnóstico. `mats` trae los materiales de la escena.
export default function Notebook({ mats, paleta }) {
  return (
    <group>
      {/* Base. */}
      <RoundedBox args={[1.5, 0.05, 1.0]} radius={0.025} smoothness={4} position={[0, 0.025, 0.2]} material={mats.chasis} />
      {/* Zona del teclado (hundida) y teclas con sus letras. */}
      <mesh position={[0, 0.0505, Z_TECLADO]} material={mats.hueco}>
        <boxGeometry args={[ANCHO_TECLADO + 0.06, 0.004, ALTO_TECLADO + 0.05]} />
      </mesh>
      <Teclas material={mats.tecla} color={paleta.tecla} />
      <mesh position={[0, 0.0745, Z_TECLADO]} rotation={[-Math.PI / 2, 0, 0]} material={mats.leyendas}>
        <planeGeometry args={[ANCHO_TECLADO, ALTO_TECLADO]} />
      </mesh>
      {/* Trackpad. */}
      <RoundedBox args={[0.5, 0.004, 0.2]} radius={0.01} smoothness={3} position={[0, 0.052, 0.59]} material={mats.trackpad} />
      {/* Puertos del costado y luz de carga. */}
      {[0.1, 0.22, 0.34].map((z) => (
        <mesh key={z} position={[0.752, 0.028, z]} material={mats.oscuro}>
          <boxGeometry args={[0.006, 0.014, 0.06]} />
        </mesh>
      ))}
      <mesh position={[0.752, 0.036, 0.5]} material={mats.led}>
        <sphereGeometry args={[0.008, 8, 8]} />
      </mesh>
      {/* Patitas de goma. */}
      {[[-0.68, 0.0], [0.68, 0.0], [-0.68, 0.62], [0.68, 0.62]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, -0.004, z - 0.05 + 0.25]} material={mats.oscuro}>
          <cylinderGeometry args={[0.03, 0.03, 0.01, 12]} />
        </mesh>
      ))}

      {/* Bisagra y pantalla. */}
      <mesh position={[0, 0.045, -0.31]} rotation={[0, 0, Math.PI / 2]} material={mats.oscuro}>
        <cylinderGeometry args={[0.022, 0.022, 1.3, 14]} />
      </mesh>
      <group position={[0, 0.05, -0.3]} rotation={[-1.2, 0, 0]}>
        <RoundedBox args={[1.5, 0.95, 0.04]} radius={0.025} smoothness={4} position={[0, 0.475, 0]} material={mats.chasis} />
        <mesh position={[0, 0.475, 0.0215]} material={mats.oscuro}>
          <planeGeometry args={[1.42, 0.88]} />
        </mesh>
        <mesh position={[0, 0.475, 0.0225]} material={mats.diagnostico}>
          <planeGeometry args={[1.36, 0.8]} />
        </mesh>
        {/* Cámara web. */}
        <mesh position={[0, 0.93, 0.0226]} material={mats.led}>
          <circleGeometry args={[0.008, 12]} />
        </mesh>
        {/* Logo de la tapa (cara de atrás). */}
        <mesh position={[0, 0.475, -0.0215]} rotation={[0, Math.PI, 0]} material={mats.logo}>
          <circleGeometry args={[0.07, 24]} />
        </mesh>
      </group>
    </group>
  );
}
