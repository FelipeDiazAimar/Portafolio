'use client';

import { Bloom, EffectComposer } from '@react-three/postprocessing';

// El brillo de verdad: lo que supera el umbral (la columna encendida, la cabeza, las
// vértebras) irradia luz. En tema claro, más suave para no lavar el fondo.
export default function Efectos({ claro }) {
  return (
    <EffectComposer multisampling={4}>
      <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={claro ? 0.45 : 1.1} radius={0.7} />
    </EffectComposer>
  );
}
