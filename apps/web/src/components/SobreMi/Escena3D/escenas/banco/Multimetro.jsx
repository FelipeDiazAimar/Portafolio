'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';

// Posiciones (en el marco del multímetro) de las tres bananas de entrada.
export const JACKS = [
  { x: -0.22, color: '#e0a800', nombre: 'mA' },
  { x: 0, color: '#0e0f12', nombre: 'COM' },
  { x: 0.22, color: '#c4151c', nombre: 'V Ω' },
];
export const Z_JACKS = 0.54;
export const Y_JACKS = 0.24;

// Cable: un tubo que sigue una curva suave por los puntos dados (en el marco del
// banco). Se recrea sólo si cambian los puntos.
export function Cable({ puntos, color, radio = 0.016 }) {
  const geometria = useMemo(() => {
    const curva = new THREE.CatmullRomCurve3(puntos.map((p) => new THREE.Vector3(...p)));
    return new THREE.TubeGeometry(curva, 64, radio, 10, false);
  }, [puntos, radio]);
  return (
    <mesh geometry={geometria}>
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} />
    </mesh>
  );
}

// Punta de prueba: mango, protección y aguja de acero. Se coloca en `posicion`
// (donde toca la aguja) y se inclina hacia atrás por `inclinacion`.
export function Punta({ posicion, color, inclinacion = [0.55, 0, 0.25], mats }) {
  return (
    <group position={posicion} rotation={inclinacion}>
      <mesh position={[0, 0.07, 0]} material={mats.acero}>
        <cylinderGeometry args={[0.004, 0.012, 0.14, 10]} />
      </mesh>
      <mesh position={[0, 0.17, 0]}>
        <cylinderGeometry args={[0.022, 0.014, 0.1, 14]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0.34, 0]}>
        <cylinderGeometry args={[0.026, 0.022, 0.26, 16]} />
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.05} />
      </mesh>
    </group>
  );
}

// Multímetro: funda de goma, cuerpo amarillo, pantalla LCD con la lectura, cuatro
// botones, selector rotativo con las posiciones impresas y tres bananas.
export default function Multimetro({ mats, refSelector }) {
  return (
    <group>
      {/* Funda de goma y cuerpo. */}
      <RoundedBox args={[0.88, 0.16, 1.44]} radius={0.09} smoothness={4} position={[0, 0.08, 0]} material={mats.goma} />
      <RoundedBox args={[0.74, 0.09, 1.28]} radius={0.06} smoothness={4} position={[0, 0.19, 0]} material={mats.amarillo} />
      <mesh position={[0, 0.236, 0.54]} material={mats.goma}>
        <boxGeometry args={[0.66, 0.004, 0.18]} />
      </mesh>

      {/* Pantalla. */}
      <RoundedBox args={[0.6, 0.014, 0.34]} radius={0.015} smoothness={3} position={[0, 0.238, -0.44]} material={mats.oscuro} />
      <mesh position={[0, 0.2465, -0.44]} rotation={[-Math.PI / 2, 0, 0]} material={mats.lcd}>
        <planeGeometry args={[0.52, 0.26]} />
      </mesh>

      {/* Botones. */}
      {[-0.24, -0.08, 0.08, 0.24].map((x, i) => (
        <mesh key={x} position={[x, 0.246, -0.14]} material={i === 3 ? mats.rojo : mats.boton}>
          <cylinderGeometry args={[0.048, 0.05, 0.018, 20]} />
        </mesh>
      ))}

      {/* Selector rotativo: disco impreso, perilla y puntero. */}
      <mesh position={[0, 0.2395, 0.2]} rotation={[-Math.PI / 2, 0, 0]} material={mats.selector}>
        <circleGeometry args={[0.3, 48]} />
      </mesh>
      <group position={[0, 0.24, 0.2]}>
        <mesh position={[0, 0.025, 0]} material={mats.goma}>
          <cylinderGeometry args={[0.17, 0.185, 0.05, 36]} />
        </mesh>
        <mesh position={[0, 0.052, 0]} material={mats.perilla}>
          <cylinderGeometry args={[0.15, 0.17, 0.012, 36]} />
        </mesh>
        <group ref={refSelector} position={[0, 0.062, 0]}>
          <mesh position={[0, 0, -0.085]} material={mats.blanco}>
            <boxGeometry args={[0.03, 0.01, 0.1]} />
          </mesh>
        </group>
      </group>

      {/* Bananas de entrada. */}
      {JACKS.map(({ x, color }) => (
        <group key={x} position={[x, Y_JACKS, Z_JACKS]}>
          <mesh position={[0, 0.008, 0]}>
            <cylinderGeometry args={[0.055, 0.058, 0.026, 24]} />
            <meshStandardMaterial color={color} roughness={0.4} metalness={0.2} />
          </mesh>
          <mesh position={[0, 0.0225, 0]} material={mats.oscuro}>
            <cylinderGeometry args={[0.026, 0.026, 0.006, 16]} />
          </mesh>
          <mesh position={[0, 0.026, 0]} material={mats.acero}>
            <torusGeometry args={[0.026, 0.004, 8, 16]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
