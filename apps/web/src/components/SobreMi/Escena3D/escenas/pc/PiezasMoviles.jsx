'use client';

import { RoundedBox } from '@react-three/drei';
import { PLACA, ZONAS, RANURAS_DIMM } from '../../disposicionPlaca.js';
import { azulEmisivo, cianEmisivo } from '../../materiales.js';
import { PilaAletas, Ventilador } from './Piezas.jsx';

const Z0 = PLACA.grosor / 2;

// Procesador: sustrato verde con su tapa de níquel (IHS) grabada.
export function ChipCPU({ materiales }) {
  const s = ZONAS.socket;
  return (
    <group position={[s.cx, s.cy, Z0 + 0.06]}>
      <mesh material={materiales.sustratoChip}>
        <boxGeometry args={[0.48, 0.48, 0.016]} />
      </mesh>
      <mesh position={[0, 0, 0.017]} material={materiales.tapaChip}>
        <boxGeometry args={[0.34, 0.34, 0.018]} />
      </mesh>
      {/* Componentes SMD del borde del sustrato. */}
      {[-0.2, 0.2].flatMap((x) => [-0.1, 0, 0.1].map((y) => (
        <mesh key={`${x}${y}`} position={[x * 0.97, y, 0.011]} material={materiales.oro}>
          <boxGeometry args={[0.03, 0.02, 0.008]} />
        </mesh>
      )))}
    </group>
  );
}

// Cooler de torre: placa base de níquel, heatpipes, pila de aletas de aluminio
// cepillado y un ventilador. Es la pieza más alta de la PC.
export function CoolerCPU({ materiales, refAspas }) {
  const s = ZONAS.socket;
  const zBase = Z0 + 0.1;
  const altoAletas = 0.82;
  return (
    <group position={[s.cx, s.cy, zBase]}>
      <mesh position={[0, 0, 0.02]} material={materiales.acero}>
        <boxGeometry args={[0.52, 0.52, 0.04]} />
      </mesh>
      {[-0.22, 0.22].flatMap((x) => [-0.22, 0.22].map((y) => (
        <mesh key={`${x}${y}`} position={[x, y, 0.045]} rotation={[Math.PI / 2, 0, 0]} material={materiales.oro}>
          <cylinderGeometry args={[0.025, 0.025, 0.02, 14]} />
        </mesh>
      )))}
      {[-0.14, 0.14].flatMap((x) => [-0.14, 0.14].map((y) => (
        <mesh key={`hp${x}${y}`} position={[x, y, 0.04 + altoAletas / 2]} rotation={[Math.PI / 2, 0, 0]} material={materiales.acero}>
          <cylinderGeometry args={[0.028, 0.028, altoAletas + 0.02, 18]} />
        </mesh>
      )))}
      <PilaAletas
        n={26}
        largo={0.5}
        eje="x"
        tamano={[0.011, 0.6, altoAletas]}
        material={materiales.aluminio}
        posicion={[0, 0, 0.04 + altoAletas / 2]}
      />
      {/* Ventilador de 120 mm sobre la cara de las aletas. */}
      <group position={[0.335, 0, 0.04 + altoAletas / 2]} rotation={[0, Math.PI / 2, 0]}>
        <mesh material={materiales.plasticoNegro}>
          <boxGeometry args={[0.66, 0.66, 0.1]} />
        </mesh>
        <mesh position={[0, 0, 0.03]} material={materiales.plasticoGris}>
          <boxGeometry args={[0.6, 0.6, 0.06]} />
        </mesh>
        <group position={[0, 0, 0.065]}>
          <Ventilador radio={0.27} refAspas={refAspas} materiales={materiales} />
        </group>
      </group>
    </group>
  );
}

// Dos módulos de RAM con disipador de aluminio y barra de luz RGB arriba.
export function ModulosRAM({ materiales }) {
  const alto = 0.33;
  return (
    <group>
      {[RANURAS_DIMM[1], RANURAS_DIMM[3]].map((x, i) => (
        <group key={x} position={[x, ZONAS.dimm.cy, Z0 + 0.06 + alto / 2]}>
          <mesh material={materiales.ram}>
            <boxGeometry args={[0.012, 1.18, alto]} />
          </mesh>
          {[-1, 1].map((lado) => (
            <mesh key={lado} position={[lado * 0.0135, 0, 0.02]} material={materiales.aluminio}>
              <boxGeometry args={[0.016, 1.12, alto - 0.05]} />
            </mesh>
          ))}
          <mesh position={[0, 0, alto / 2 + 0.002]} material={i ? cianEmisivo : azulEmisivo}>
            <boxGeometry args={[0.05, 1.08, 0.014]} />
          </mesh>
          <mesh position={[0, 0.35, -0.02]} material={materiales.plasticoNegro}>
            <boxGeometry args={[0.04, 0.32, 0.12]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// Tarjeta gráfica: carcasa metálica con tres aberturas cromadas para los
// ventiladores, acentos luminosos, bloque de aletas visible en un extremo, placa
// trasera, conectores de energía y bracket con puertos. Los ventiladores miran
// hacia +y (la cara que se ve desde arriba).
export function TarjetaGrafica({ materiales, refAspas }) {
  const largo = 1.95;
  const grosor = 0.44;
  const alto = 0.85;
  const largoCarcasa = largo - 0.18;
  const z = ZONAS.pcie1;
  return (
    <group position={[-0.075, z.cy, Z0 + 0.1 + alto / 2 - 0.03]}>
      <RoundedBox args={[largoCarcasa, grosor, alto]} radius={0.045} smoothness={5} position={[-0.09, 0, 0]} material={materiales.carcasa} />

      {/* Bloque de aletas en el extremo derecho, visible entre la carcasa y el borde. */}
      <PilaAletas
        n={16}
        largo={grosor - 0.06}
        eje="y"
        tamano={[0.15, 0.011, alto - 0.08]}
        material={materiales.aluminio}
        posicion={[largo / 2 - 0.085, 0, 0]}
      />
      {[-1, 1].map((lado) => (
        <mesh key={lado} position={[largo / 2 - 0.085, lado * (grosor / 2 - 0.012), 0]} material={materiales.carcasa}>
          <boxGeometry args={[0.16, 0.024, alto - 0.04]} />
        </mesh>
      ))}

      {/* Placa trasera (cara -y) con un panel hundido y un logo luminoso. */}
      <mesh position={[0, -grosor / 2 - 0.005, 0]} material={materiales.anodizado}>
        <boxGeometry args={[largo - 0.04, 0.012, alto - 0.04]} />
      </mesh>
      <mesh position={[0.2, -grosor / 2 - 0.012, 0]} material={cianEmisivo}>
        <boxGeometry args={[0.5, 0.004, 0.05]} />
      </mesh>

      {/* Tres aberturas: disco oscuro hundido, aro cromado y el ventilador. */}
      {[-0.64, 0, 0.64].map((x, i) => (
        <group key={x} position={[x - 0.09, grosor / 2 + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh position={[0, 0, -0.006]} material={materiales.plasticoNegro}>
            <cylinderGeometry args={[0.285, 0.285, 0.012, 48]} />
          </mesh>
          <mesh material={materiales.acero}>
            <torusGeometry args={[0.285, 0.014, 12, 56]} />
          </mesh>
          <Ventilador radio={0.25} refAspas={refAspas[i]} materiales={materiales} />
        </group>
      ))}

      {/* Acentos luminosos diagonales entre los ventiladores. */}
      {[-0.32, 0.32].map((x) => (
        <mesh key={x} position={[x - 0.09, grosor / 2 + 0.004, 0]} rotation={[0, 0.5, 0]} material={cianEmisivo}>
          <boxGeometry args={[0.012, 0.006, 0.7]} />
        </mesh>
      ))}

      {/* Borde que mira al frente: barra de luz, placa con logo y conectores. */}
      <mesh position={[-0.2, 0, alto / 2 + 0.004]} material={cianEmisivo}>
        <boxGeometry args={[1.3, 0.05, 0.012]} />
      </mesh>
      <mesh position={[-0.2, 0, alto / 2 + 0.002]} material={materiales.anodizado}>
        <boxGeometry args={[1.5, 0.12, 0.008]} />
      </mesh>
      <mesh position={[0.62, 0, alto / 2 + 0.024]} material={materiales.plasticoGris}>
        <boxGeometry args={[0.24, 0.22, 0.045]} />
      </mesh>
      {[-0.07, 0.07].flatMap((y) => [-0.07, 0, 0.07].map((x) => (
        <mesh key={`${x}${y}`} position={[0.62 + x, y, alto / 2 + 0.048]} material={materiales.oro}>
          <boxGeometry args={[0.04, 0.05, 0.006]} />
        </mesh>
      )))}

      {/* Bracket trasero con los puertos de video. */}
      <mesh position={[-largo / 2 - 0.02, 0, 0.01]} material={materiales.acero}>
        <boxGeometry args={[0.03, grosor + 0.1, alto + 0.04]} />
      </mesh>
      {[-0.13, 0, 0.13].map((dy) => (
        <mesh key={dy} position={[-largo / 2 - 0.038, dy, 0.12]} material={materiales.plasticoNegro}>
          <boxGeometry args={[0.012, 0.08, 0.055]} />
        </mesh>
      ))}
      <mesh position={[-largo / 2 - 0.038, 0, -0.1]} material={materiales.plasticoNegro}>
        <boxGeometry args={[0.012, 0.3, 0.2]} />
      </mesh>
    </group>
  );
}

// SSD M.2 con un disipador que tapa sólo parte del módulo.
export function SSD({ materiales }) {
  const z = ZONAS.m2;
  return (
    <group position={[z.cx, z.cy, Z0 + 0.026]}>
      <mesh material={materiales.plasticoNegro}>
        <boxGeometry args={[0.8, 0.22, 0.012]} />
      </mesh>
      {[-0.33, -0.17, -0.02].map((x) => (
        <mesh key={x} position={[x, 0, 0.01]} material={materiales.condensador}>
          <boxGeometry args={[0.1, 0.09, 0.009]} />
        </mesh>
      ))}
      <mesh position={[0.26, 0, 0.022]} material={materiales.anodizado}>
        <boxGeometry args={[0.46, 0.2, 0.026]} />
      </mesh>
      <mesh position={[0.26, 0, 0.036]} material={cianEmisivo}>
        <boxGeometry args={[0.36, 0.014, 0.004]} />
      </mesh>
      <mesh position={[0.46, 0, 0.038]} rotation={[Math.PI / 2, 0, 0]} material={materiales.acero}>
        <cylinderGeometry args={[0.018, 0.018, 0.012, 14]} />
      </mesh>
    </group>
  );
}

export { PilaAletas };
