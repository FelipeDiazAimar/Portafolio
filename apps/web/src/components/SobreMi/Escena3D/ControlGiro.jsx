'use client';

import { useEffect, useRef, useState } from 'react';
import { OrbitControls } from '@react-three/drei';

const ESPERA_TRAS_SOLTAR_MS = 3000;

// Giro con arrastre (la cámara orbita), sin zoom ni desplazamiento. Gira solo y
// despacio cuando nadie lo toca, y retoma unos segundos después de soltar.
export default function ControlGiro({ quieto = false, children }) {
  const refControles = useRef(null);
  const refEspera = useRef(0);
  const [girando, setGirando] = useState(true);

  useEffect(() => {
    // OrbitControls pone `touch-action: none`, que bloquearía el scroll
    // vertical de la página sobre el canvas. Con `pan-y` el navegador se queda
    // con el gesto vertical y el modelo sólo gira con arrastre horizontal.
    const elemento = refControles.current?.domElement;
    if (elemento) elemento.style.touchAction = 'pan-y';
    return () => clearTimeout(refEspera.current);
  }, []);

  return (
    <>
      <OrbitControls
        ref={refControles}
        enableZoom={false}
        enablePan={false}
        enableDamping
        autoRotate={girando && !quieto}
        autoRotateSpeed={1.1}
        minPolarAngle={Math.PI / 2.7}
        maxPolarAngle={Math.PI / 1.9}
        onStart={() => {
          clearTimeout(refEspera.current);
          setGirando(false);
        }}
        onEnd={() => {
          refEspera.current = setTimeout(() => setGirando(true), ESPERA_TRAS_SOLTAR_MS);
        }}
      />
      {children}
    </>
  );
}
