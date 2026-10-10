'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { LIMITE_CAIDA, avanzarCaida, velocidadInicial, volverAlOrigen } from './caida.js';
import { useDesarme } from './useDesarme.jsx';

const LAMBDA_REGRESO = 6;
const REPOSO = () => ({ p: [0, 0, 0], v: [0, 0, 0], r: [0, 0, 0], w: [0, 0, 0], quieto: false });

// Envuelve una pieza. Armada, está en `posicion`. Al desarmarse sale disparada,
// cae con gravedad y queda fuera de la vista (no queda flotando). Al volver a
// armarse, sube de nuevo a su lugar. Con movimiento reducido no hay física: la
// pieza simplemente está en su lugar o fuera de vista.
// Si la pieza necesita su propia rotación fija, ponerla en un <group> hijo: la
// rotación de este grupo la pisa mientras la pieza no está armada.
export default function PiezaDesarmable({ posicion = [0, 0, 0], semilla = 1, children }) {
  const grupo = useRef(null);
  const control = useDesarme();
  // fase: 'armada' (en su lugar) | 'cayendo' | 'volviendo'
  const fase = useRef('armada');
  const estado = useRef(REPOSO());

  useFrame((_, delta) => {
    const { desarmado, reducido } = control.current;
    const dt = Math.min(delta, 0.05);
    // Sólo se toca el objeto 3D cuando algo cambió: armada y quieta no cuesta nada.
    let escribir = false;

    if (reducido) {
      const nuevaFase = desarmado ? 'cayendo' : 'armada';
      if (nuevaFase !== fase.current) {
        fase.current = nuevaFase;
        estado.current = desarmado ? { ...REPOSO(), p: [0, LIMITE_CAIDA - 1, 0], quieto: true } : REPOSO();
        escribir = true;
      }
    } else if (desarmado) {
      if (fase.current !== 'cayendo') {
        fase.current = 'cayendo';
        // Parte de donde esté (puede estar volviendo): la caída es continua.
        estado.current = { ...estado.current, ...velocidadInicial(posicion, semilla), quieto: false };
      }
      if (!estado.current.quieto) {
        estado.current = avanzarCaida(estado.current, dt);
        escribir = true;
      }
    } else {
      if (fase.current === 'cayendo') fase.current = 'volviendo';
      if (fase.current === 'volviendo') {
        const { estado: nuevo, llego } = volverAlOrigen(estado.current, dt, LAMBDA_REGRESO);
        estado.current = llego ? REPOSO() : nuevo;
        if (llego) fase.current = 'armada';
        escribir = true;
      }
    }

    if (!escribir) return;
    const { p, r } = estado.current;
    grupo.current.position.set(posicion[0] + p[0], posicion[1] + p[1], posicion[2] + p[2]);
    grupo.current.rotation.set(r[0], r[1], r[2]);
  });

  return (
    <group ref={grupo} position={posicion}>
      {children}
    </group>
  );
}
