'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { calcularDispersion } from './desarme.js';
import { useDesarme } from './useDesarme.jsx';

// Envuelve una pieza: en reposo está en `posicion`; con `desarme` > 0 se aleja
// hacia su punto de dispersión y gira hasta `giro` (radianes). Si la pieza ya
// necesita su propia rotación fija, ponerla en un <group> hijo: esta rotación
// la pisa.
export default function PiezaDesarmable({
  posicion = [0, 0, 0],
  giro = [0, 0, 0],
  semilla = 1,
  dispersion,
  children,
}) {
  const grupo = useRef(null);
  const desarme = useDesarme();
  const destino = useMemo(
    () => dispersion ?? calcularDispersion(posicion, semilla),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispersion, semilla, posicion[0], posicion[1], posicion[2]]
  );

  useFrame(() => {
    const d = desarme.current;
    grupo.current.position.set(
      posicion[0] + destino[0] * d,
      posicion[1] + destino[1] * d,
      posicion[2] + destino[2] * d
    );
    grupo.current.rotation.set(giro[0] * d, giro[1] * d, giro[2] * d);
  });

  return (
    <group ref={grupo} position={posicion}>
      {children}
    </group>
  );
}
