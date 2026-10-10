'use client';

import PiezaDesarmable from '../PiezaDesarmable.jsx';
import { cuerpoOscuro, azulEmisivo } from '../materiales.js';

// Escena mínima para validar la infraestructura: un cubo de 2×2×2 cubitos que
// se desarma. Se reemplaza por la escena real de cada hito.
const POSICIONES = [-0.45, 0.45].flatMap((x) =>
  [-0.45, 0.45].flatMap((y) => [-0.45, 0.45].map((z) => [x, y, z]))
);

export default function EscenaPrueba() {
  return (
    <group>
      {POSICIONES.map((posicion, i) => (
        <PiezaDesarmable key={i} posicion={posicion} semilla={i + 1} giro={[1.2, 0.8, 0]}>
          <mesh material={i % 2 ? azulEmisivo : cuerpoOscuro}>
            <boxGeometry args={[0.8, 0.8, 0.8]} />
          </mesh>
        </PiezaDesarmable>
      ))}
    </group>
  );
}
