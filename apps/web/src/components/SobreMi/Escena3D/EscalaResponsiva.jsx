'use client';

import { useThree } from '@react-three/fiber';
import { vistaParaAltura } from './vista.js';

// Achica la escena cuando no entra a lo ancho (celular, o la mitad de pantalla que le
// toca al modelo en escritorio). `ancho` es el ancho, en unidades de escena, que necesita
// el modelo más ancho de la serie; `fraccion` es la parte del ancho del canvas que le
// corresponde. El ancho visible se calcula con la cámara en su pose canónica (y no con
// la cámara actual): durante el viaje la cámara se mueve y el modelo no debe cambiar
// de tamaño.
export default function EscalaResponsiva({ ancho = 4.2, fraccion = 1, children }) {
  const size = useThree((estado) => estado.size);
  const { mitadAlto } = vistaParaAltura(size.height);
  const visible = 2 * mitadAlto * (size.width / Math.max(size.height, 1)) * fraccion;
  const escala = Math.min(1, visible / ancho);
  return <group scale={escala}>{children}</group>;
}
