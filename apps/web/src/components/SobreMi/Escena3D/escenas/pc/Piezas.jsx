'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { aletas } from '../../disposicionPlaca.js';
import { azulEmisivo, cianEmisivo } from '../../materiales.js';

// Pila de aletas: una malla instanciada (una sola llamada de dibujo) con `n`
// láminas finas repartidas a lo largo de `eje` ('x' o 'y') en un largo `largo`.
// `tamano` es el de cada lámina [x, y, z].
export function PilaAletas({ n, largo, eje = 'x', tamano, material, posicion = [0, 0, 0] }) {
  const malla = useRef(null);
  const posiciones = useMemo(() => aletas(n, largo), [n, largo]);
  useLayoutEffect(() => {
    const aux = new THREE.Object3D();
    posiciones.forEach((p, i) => {
      aux.position.set(eje === 'x' ? p : 0, eje === 'y' ? p : 0, 0);
      aux.updateMatrix();
      malla.current.setMatrixAt(i, aux.matrix);
    });
    malla.current.instanceMatrix.needsUpdate = true;
  }, [posiciones, eje]);
  return (
    <instancedMesh ref={malla} args={[undefined, material, n]} position={posicion}>
      <boxGeometry args={tamano} />
    </instancedMesh>
  );
}

// Ventilador: marco, aro, aspas curvas y cubo con luz. Su eje es el z local; las
// aspas giran con `refAspas` (la escena les pone la rotación en cada cuadro).
export function Ventilador({ radio = 0.3, refAspas, materiales }) {
  const aspas = 9;
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]} material={materiales.plasticoNegro}>
        <torusGeometry args={[radio, radio * 0.07, 12, 48]} />
      </mesh>
      <group ref={refAspas}>
        {Array.from({ length: aspas }, (_, i) => {
          const angulo = (i / aspas) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[Math.cos(angulo) * radio * 0.55, Math.sin(angulo) * radio * 0.55, 0]}
              rotation={[0.55, 0, angulo]}
              material={materiales.plasticoGris}
            >
              <boxGeometry args={[radio * 0.82, radio * 0.34, 0.012]} />
            </mesh>
          );
        })}
      </group>
      <mesh rotation={[Math.PI / 2, 0, 0]} material={materiales.plasticoNegro}>
        <cylinderGeometry args={[radio * 0.24, radio * 0.24, 0.045, 24]} />
      </mesh>
      <mesh position={[0, 0, 0.024]} rotation={[Math.PI / 2, 0, 0]} material={cianEmisivo}>
        <torusGeometry args={[radio * 0.15, radio * 0.018, 8, 24]} />
      </mesh>
    </group>
  );
}

// Tornillo de cabeza redonda con ranura en cruz.
export function Tornillo({ posicion, radio = 0.028, materiales }) {
  return (
    <group position={posicion}>
      <mesh rotation={[Math.PI / 2, 0, 0]} material={materiales.acero}>
        <cylinderGeometry args={[radio, radio, 0.018, 16]} />
      </mesh>
      <mesh position={[0, 0, 0.01]} material={materiales.plasticoNegro}>
        <boxGeometry args={[radio * 1.5, radio * 0.28, 0.004]} />
      </mesh>
      <mesh position={[0, 0, 0.01]} material={materiales.plasticoNegro}>
        <boxGeometry args={[radio * 0.28, radio * 1.5, 0.004]} />
      </mesh>
    </group>
  );
}

export { azulEmisivo, cianEmisivo };
