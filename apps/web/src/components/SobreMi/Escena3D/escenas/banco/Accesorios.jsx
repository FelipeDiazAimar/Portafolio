'use client';

import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';

// Teléfono apoyado boca arriba con la pantalla encendida (modo diagnóstico).
export function Telefono({ mats }) {
  return (
    <group>
      <RoundedBox args={[0.54, 0.05, 1.08]} radius={0.06} smoothness={5} position={[0, 0.025, 0]} material={mats.telefono} />
      {/* Pantalla con su marco negro. */}
      <mesh position={[0, 0.0505, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats.oscuro}>
        <planeGeometry args={[0.5, 1.04]} />
      </mesh>
      <mesh position={[0, 0.0512, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats.pantallaTelefono}>
        <planeGeometry args={[0.46, 0.98]} />
      </mesh>
      {/* Cámara frontal y parlante. */}
      <mesh position={[0, 0.0516, -0.48]} rotation={[-Math.PI / 2, 0, 0]} material={mats.oscuro}>
        <circleGeometry args={[0.014, 14]} />
      </mesh>
      <mesh position={[0.07, 0.0516, -0.48]} rotation={[-Math.PI / 2, 0, 0]} material={mats.oscuro}>
        <planeGeometry args={[0.09, 0.012]} />
      </mesh>
      {/* Botones laterales. */}
      <mesh position={[0.275, 0.03, -0.2]} material={mats.acero}>
        <boxGeometry args={[0.012, 0.02, 0.18]} />
      </mesh>
      <mesh position={[-0.275, 0.03, -0.25]} material={mats.acero}>
        <boxGeometry args={[0.012, 0.02, 0.08]} />
      </mesh>
      <mesh position={[-0.275, 0.03, -0.12]} material={mats.acero}>
        <boxGeometry args={[0.012, 0.02, 0.08]} />
      </mesh>
    </group>
  );
}

// Palanca de plástico para abrir pantallas (spudger), al lado del teléfono.
export function Palanca({ mats }) {
  return (
    <group>
      <mesh position={[0, 0.012, 0]} material={mats.plasticoClaro}>
        <boxGeometry args={[0.7, 0.016, 0.05]} />
      </mesh>
      <mesh position={[0.37, 0.012, 0]} rotation={[0, 0, 0]} material={mats.plasticoClaro}>
        <boxGeometry args={[0.06, 0.008, 0.038]} />
      </mesh>
      <mesh position={[-0.35, 0.012, 0]} material={mats.mango}>
        <boxGeometry args={[0.04, 0.02, 0.054]} />
      </mesh>
    </group>
  );
}

// Memoria RAM suelta: placa oscura con ocho chips en dos filas, una etiqueta en
// el extremo y los contactos dorados del borde (con la muesca en el medio).
export function MemoriaRAM({ mats }) {
  const chips = useRef(null);
  useLayoutEffect(() => {
    const aux = new THREE.Object3D();
    for (let i = 0; i < 8; i += 1) {
      aux.position.set(-0.45 + (i % 4) * 0.25, 0.032, i < 4 ? -0.07 : 0.06);
      aux.updateMatrix();
      chips.current.setMatrixAt(i, aux.matrix);
    }
    chips.current.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <group>
      <mesh position={[0, 0.012, 0]} material={mats.ram}>
        <boxGeometry args={[1.3, 0.014, 0.3]} />
      </mesh>
      {[-1, 1].map((lado) => (
        <mesh key={lado} position={[lado * 0.335, 0.0195, 0.135]} material={mats.oro}>
          <boxGeometry args={[0.6, 0.002, 0.03]} />
        </mesh>
      ))}
      <instancedMesh ref={chips} args={[undefined, mats.chip, 8]}>
        <boxGeometry args={[0.2, 0.03, 0.1]} />
      </instancedMesh>
      <mesh position={[0.55, 0.0215, -0.01]} material={mats.blanco}>
        <boxGeometry args={[0.18, 0.003, 0.14]} />
      </mesh>
      <mesh position={[0.55, 0.0235, -0.01]} material={mats.mango}>
        <boxGeometry args={[0.18, 0.002, 0.03]} />
      </mesh>
    </group>
  );
}

// Pinzas de punta fina.
export function Pinzas({ mats }) {
  return (
    <group>
      {[-0.012, 0.012].map((z) => (
        <mesh key={z} position={[0, 0.01, z]} rotation={[0, z * 6, 0]} material={mats.acero}>
          <boxGeometry args={[0.8, 0.01, 0.016]} />
        </mesh>
      ))}
      <mesh position={[-0.4, 0.01, 0]} material={mats.acero}>
        <boxGeometry args={[0.03, 0.012, 0.05]} />
      </mesh>
    </group>
  );
}
