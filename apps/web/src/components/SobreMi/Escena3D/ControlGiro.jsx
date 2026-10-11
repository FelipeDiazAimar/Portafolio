'use client';

import { useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

const ESPERA_TRAS_SOLTAR_MS = 3000;

// Giro con arrastre (la cámara orbita), sin zoom ni desplazamiento. Gira solo y
// despacio cuando nadie lo toca, y retoma unos segundos después de soltar.
export default function ControlGiro({ quieto = false, girable = true, children }) {
  const camera = useThree((estado) => estado.camera);
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

  // En una escena fija (que no gira) se vuelve a la vista de frente: la cámara
  // pudo haber quedado girada por la escena anterior.
  useEffect(() => {
    if (girable) return;
    const controles = refControles.current;
    if (!controles) return;
    const distancia = camera.position.length();
    camera.position.set(0, distancia * 0.116, distancia * 0.993);
    camera.lookAt(0, 0, 0);
    controles.update();
  }, [girable, camera]);

  return (
    <>
      {/* makeDefault: las escenas lo buscan (`get().controls`) para apagar el giro
          mientras el usuario agarra algo, como la tela de la bandera. */}
      <OrbitControls
        ref={refControles}
        makeDefault
        enableZoom={false}
        enableRotate={girable}
        enablePan={false}
        enableDamping
        autoRotate={girando && !quieto && girable}
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
