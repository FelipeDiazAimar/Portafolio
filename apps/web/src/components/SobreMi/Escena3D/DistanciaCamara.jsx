'use client';

import { useLayoutEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { vistaParaAltura } from './vista.js';

// Aleja la cámara cuando el canvas es alto, para que los modelos conserven su
// tamaño en pantalla (ver `vista.js`). Sólo cambia la distancia: la dirección en
// la que mira la cámara (y por lo tanto el giro actual) se conserva.
export default function DistanciaCamara() {
  const camera = useThree((estado) => estado.camera);
  const alto = useThree((estado) => estado.size.height);
  useLayoutEffect(() => {
    camera.position.setLength(vistaParaAltura(alto).distancia);
  }, [camera, alto]);
  return null;
}
