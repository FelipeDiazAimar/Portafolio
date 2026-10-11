'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

// Cable: un tubo que sigue una curva suave por los puntos dados (en el marco del
// banco). Se recrea sólo si cambian los puntos.
export function Cable({ puntos, color, radio = 0.012 }) {
  const geometria = useMemo(() => {
    const curva = new THREE.CatmullRomCurve3(puntos.map((p) => new THREE.Vector3(...p)));
    return new THREE.TubeGeometry(curva, 80, radio, 10, false);
  }, [puntos, radio]);
  return (
    <mesh geometry={geometria}>
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} />
    </mesh>
  );
}

// Largo del mango de una punta de prueba (de donde toca la aguja hasta el extremo
// donde entra el cable), en unidades del banco.
export const LARGO_PUNTA = 0.47;

// Punta de prueba: mango, protección y aguja de acero. Se coloca en `posicion`
// (donde toca la aguja) y se inclina por `inclinacion`.
export function Punta({ posicion, color, inclinacion, mats }) {
  return (
    <group position={posicion} rotation={inclinacion}>
      <mesh position={[0, 0.07, 0]} material={mats.acero}>
        <cylinderGeometry args={[0.003, 0.01, 0.14, 10]} />
      </mesh>
      <mesh position={[0, 0.17, 0]}>
        <cylinderGeometry args={[0.018, 0.012, 0.1, 14]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0.34, 0]}>
        <cylinderGeometry args={[0.021, 0.018, 0.26, 16]} />
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.05} />
      </mesh>
    </group>
  );
}

// Banana: el conector de metal y plástico que entra en el multímetro.
export function Banana({ posicion, color, mats }) {
  return (
    <group position={posicion}>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.017, 0.02, 0.06, 14]} />
        <meshStandardMaterial color={color} roughness={0.45} />
      </mesh>
      <mesh position={[0, -0.015, 0]} material={mats.acero}>
        <cylinderGeometry args={[0.008, 0.008, 0.03, 10]} />
      </mesh>
    </group>
  );
}
