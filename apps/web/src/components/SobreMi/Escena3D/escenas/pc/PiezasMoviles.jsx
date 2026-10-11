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

// Tarjeta gráfica: carcasa redondeada con tres ventiladores, placa trasera,
// bracket de acero y conectores de energía en el borde.
export function TarjetaGrafica({ materiales, refAspas }) {
  const largo = 1.95;
  const grosor = 0.44;
  const alto = 0.85;
  const z = ZONAS.pcie1;
  return (
    <group position={[-0.075, z.cy + 0.0, Z0 + 0.1 + alto / 2 - 0.03]}>
      <RoundedBox args={[largo, grosor, alto]} radius={0.04} smoothness={4} material={materiales.plasticoNegro} />
      <mesh position={[0, -grosor / 2 - 0.004, 0]} material={materiales.anodizado}>
        <boxGeometry args={[largo - 0.04, 0.012, alto - 0.04]} />
      </mesh>
      {[-0.64, 0, 0.64].map((x, i) => (
        <group key={x} position={[x, grosor / 2 + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh position={[0, 0, -0.01]} material={materiales.plasticoGris}>
            <cylinderGeometry args={[0.285, 0.285, 0.02, 40]} />
          </mesh>
          <Ventilador radio={0.25} refAspas={refAspas[i]} materiales={materiales} />
        </group>
      ))}
      {/* Barra de luz en el borde que mira al frente. */}
      <mesh position={[-0.05, 0, alto / 2 + 0.003]} material={cianEmisivo}>
        <boxGeometry args={[1.5, 0.05, 0.012]} />
      </mesh>
      <mesh position={[0.78, 0, alto / 2 + 0.02]} material={materiales.plasticoGris}>
        <boxGeometry args={[0.2, 0.2, 0.04]} />
      </mesh>
      {[-0.05, 0.05].map((y) => (
        <mesh key={y} position={[0.78, y, alto / 2 + 0.042]} material={materiales.oro}>
          <boxGeometry args={[0.15, 0.03, 0.006]} />
        </mesh>
      ))}
      {/* Bracket trasero con los puertos de video. */}
      <mesh position={[-largo / 2 - 0.02, 0, 0.01]} material={materiales.acero}>
        <boxGeometry args={[0.03, grosor + 0.1, alto + 0.04]} />
      </mesh>
      {[-0.12, 0, 0.12].map((dy) => (
        <mesh key={dy} position={[-largo / 2 - 0.038, dy, 0.1]} material={materiales.plasticoNegro}>
          <boxGeometry args={[0.012, 0.08, 0.05]} />
        </mesh>
      ))}
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

// Fuente de poder modular: chasis negro, rejilla con ventilador y etiqueta.
export function FuentePoder({ materiales, refAspas }) {
  return (
    <group position={[0, -1.78, Z0 + 0.34]}>
      <RoundedBox args={[1.5, 0.55, 0.78]} radius={0.03} smoothness={3} material={materiales.plasticoNegro} />
      <mesh position={[-0.28, 0, 0.395]} rotation={[Math.PI / 2, 0, 0]} material={materiales.anodizado}>
        <torusGeometry args={[0.23, 0.014, 10, 40]} />
      </mesh>
      <group position={[-0.28, 0, 0.385]}>
        <Ventilador radio={0.2} refAspas={refAspas} materiales={materiales} />
      </group>
      <mesh position={[0.4, 0.12, 0.392]} material={azulEmisivo}>
        <boxGeometry args={[0.5, 0.05, 0.006]} />
      </mesh>
      <mesh position={[0.4, -0.08, 0.392]} material={materiales.anodizado}>
        <boxGeometry args={[0.5, 0.2, 0.006]} />
      </mesh>
      <mesh position={[0.76, 0, 0]} material={materiales.plasticoGris}>
        <boxGeometry args={[0.03, 0.36, 0.5]} />
      </mesh>
    </group>
  );
}

export { PilaAletas };
