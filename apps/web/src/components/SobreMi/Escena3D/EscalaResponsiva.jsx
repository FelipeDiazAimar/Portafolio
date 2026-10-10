'use client';

import { useThree } from '@react-three/fiber';

// Achica la escena cuando el canvas es angosto (celular) para que el modelo no
// se recorte en los bordes. `ancho` es el ancho, en unidades de la escena, que
// necesita el modelo más ancho de la serie; con más lugar que ese, no cambia.
export default function EscalaResponsiva({ ancho = 4.2, children }) {
  const { viewport } = useThree();
  const escala = Math.min(1, viewport.width / ancho);
  return <group scale={escala}>{children}</group>;
}
