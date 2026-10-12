'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import { texturaTexto } from './texturaTexto.js';

// Marcador de un hito lejano (o mientras carga su escena): un icosaedro alámbrico que
// gira despacio y su año debajo, siempre de frente a la cámara.
export default function Silueta({ anio, color, reducido }) {
  const refForma = useRef(null);
  const textura = useMemo(() => texturaTexto(anio, color), [anio, color]);
  useEffect(() => () => textura.dispose(), [textura]);
  useFrame((_, delta) => {
    if (refForma.current && !reducido) refForma.current.rotation.y += Math.min(delta, 0.05) * 0.3;
  });
  return (
    <group>
      <mesh ref={refForma}>
        <icosahedronGeometry args={[0.9, 1]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.35} toneMapped={false} />
      </mesh>
      <Billboard position={[0, -1.35, 0]}>
        <mesh>
          <planeGeometry args={[1.6, 0.6]} />
          <meshBasicMaterial map={textura} transparent opacity={0.8} depthWrite={false} toneMapped={false} />
        </mesh>
      </Billboard>
    </group>
  );
}
