'use client';

import { Billboard, RoundedBox } from '@react-three/drei';

// Aro de luz bajo cada miniatura y su etiqueta flotando arriba.
export function Peana({ mats, etiqueta }) {
  return (
    <>
      <mesh position={[0, -0.04, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.aro}>
        <torusGeometry args={[0.66, 0.012, 8, 64]} />
      </mesh>
      <Billboard position={[0, 1.05, 0]}>
        <mesh material={etiqueta}>
          <planeGeometry args={[0.62, 0.2]} />
        </mesh>
      </Billboard>
    </>
  );
}

// Logo que flota al lado de una miniatura, siempre de frente a la cámara.
function Logo({ material, posicion, ancho, alto = ancho }) {
  return (
    <Billboard position={posicion}>
      <mesh material={material}>
        <planeGeometry args={[ancho, alto]} />
      </mesh>
    </Billboard>
  );
}

// 0 — Origen: la notebook, abierta, con la manzana en la pantalla.
function MiniNotebook({ mats }) {
  return (
    <group position={[0, 0, 0.05]}>
      <RoundedBox args={[1, 0.05, 0.7]} radius={0.02} smoothness={3} position={[0, 0.025, 0]} material={mats.aluminio} />
      <mesh position={[0, 0.053, -0.06]} material={mats.oscuro}>
        <boxGeometry args={[0.86, 0.008, 0.3]} />
      </mesh>
      <mesh position={[0, 0.052, 0.22]} material={mats.claro}>
        <boxGeometry args={[0.32, 0.006, 0.17]} />
      </mesh>
      <group position={[0, 0.05, -0.35]} rotation={[-1.75, 0, 0]}>
        <RoundedBox args={[1, 0.035, 0.7]} radius={0.015} smoothness={3} position={[0, 0, 0.35]} material={mats.aluminio} />
        <mesh position={[0, -0.019, 0.35]} rotation={[Math.PI / 2, 0, 0]} material={mats.pantallaMini}>
          <planeGeometry args={[0.92, 0.6]} />
        </mesh>
      </group>
    </group>
  );
}

// 1 — 2022: la bandera en su asta, con un leve flameo, y el logo de la UTN al lado.
function MiniBandera({ mats, refBandera }) {
  return (
    <group>
      <group position={[-0.3, 0, 0]}>
        <mesh position={[0, 0.58, 0]} material={mats.aluminio}>
          <cylinderGeometry args={[0.018, 0.022, 1.16, 12]} />
        </mesh>
        <mesh position={[0, 1.17, 0]} material={mats.oro}>
          <sphereGeometry args={[0.04, 12, 12]} />
        </mesh>
        <mesh ref={refBandera} position={[0.4, 0.85, 0]} material={mats.bandera}>
          <planeGeometry args={[0.78, 0.5, 14, 6]} />
        </mesh>
        <mesh position={[0, 0.02, 0]} material={mats.aluminio}>
          <cylinderGeometry args={[0.1, 0.12, 0.04, 20]} />
        </mesh>
      </group>
      <Logo material={mats.logoUtn} posicion={[0.72, 0.35, 0.2]} ancho={0.52} alto={0.6} />
    </group>
  );
}

// 2 — 2023: tres tarjetas de materias en abanico y el escudo de Cambridge al lado.
function MiniTarjetas({ mats }) {
  return (
    <group>
      <group position={[-0.1, 0.5, 0]}>
        {mats.tarjetas.map((material, i) => (
          <mesh key={i} position={[(i - 1) * 0.18, (1 - i) * 0.06, i * 0.07]} rotation={[0, (1 - i) * 0.18, (i - 1) * 0.08]} material={material}>
            <planeGeometry args={[0.8, 0.5]} />
          </mesh>
        ))}
      </group>
      <Logo material={mats.logoCambridge} posicion={[0.72, 0.38, 0.3]} ancho={0.5} alto={0.6} />
    </group>
  );
}

// 3 — 2024: la placa con procesador, memorias y gráfica.
function MiniPlaca({ mats }) {
  return (
    <group>
      <mesh position={[0, 0.02, 0]} material={mats.pcb}>
        <boxGeometry args={[1, 0.04, 1]} />
      </mesh>
      <mesh position={[0.02, 0.06, -0.12]} material={mats.acero}>
        <boxGeometry args={[0.26, 0.04, 0.26]} />
      </mesh>
      <mesh position={[0.02, 0.085, -0.12]} material={mats.niquel}>
        <boxGeometry args={[0.18, 0.015, 0.18]} />
      </mesh>
      {[0.36, 0.44].map((x) => (
        <mesh key={x} position={[x, 0.2, -0.1]} material={mats.oscuro}>
          <boxGeometry args={[0.035, 0.32, 0.6]} />
        </mesh>
      ))}
      <mesh position={[-0.36, 0.1, -0.28]} material={mats.acero}>
        <boxGeometry args={[0.2, 0.12, 0.3]} />
      </mesh>
      <group position={[-0.12, 0.2, 0.34]}>
        <mesh material={mats.tarjeta}>
          <boxGeometry args={[0.86, 0.3, 0.12]} />
        </mesh>
        {[-0.2, 0.2].map((x) => (
          <mesh key={x} position={[x, 0, 0.065]} rotation={[Math.PI / 2, 0, 0]} material={mats.ventilador}>
            <cylinderGeometry args={[0.1, 0.1, 0.012, 20]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// 4 — 2025: el banco de trabajo, con el multímetro y el celular.
function MiniBanco({ mats }) {
  return (
    <group>
      <mesh position={[0, 0.015, 0]} material={mats.tapete}>
        <boxGeometry args={[1.2, 0.03, 0.85]} />
      </mesh>
      <mesh position={[-0.05, 0.05, -0.05]} material={mats.pcb}>
        <boxGeometry args={[0.46, 0.03, 0.46]} />
      </mesh>
      <group position={[0.4, 0.06, -0.08]} rotation={[0, 0.4, 0]}>
        <mesh material={mats.amarillo}>
          <boxGeometry args={[0.22, 0.06, 0.45]} />
        </mesh>
        <mesh position={[0, 0.032, -0.12]} material={mats.lcd}>
          <boxGeometry args={[0.15, 0.004, 0.08]} />
        </mesh>
        <mesh position={[0, 0.034, 0.08]} material={mats.oscuro}>
          <cylinderGeometry args={[0.06, 0.06, 0.008, 16]} />
        </mesh>
      </group>
      <group position={[-0.42, 0.03, 0.22]} rotation={[0, 0.5, 0]}>
        <RoundedBox args={[0.2, 0.025, 0.4]} radius={0.02} smoothness={3} material={mats.telefono} />
        <mesh position={[0, 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats.pantallaTelefono}>
          <planeGeometry args={[0.17, 0.36]} />
        </mesh>
      </group>
      <mesh position={[-0.35, 0.14, -0.28]} rotation={[0, 0.3, 0]} material={mats.aluminio}>
        <boxGeometry args={[0.4, 0.22, 0.03]} />
      </mesh>
    </group>
  );
}

// 5 — 2026: la cinta en L con cajas y el escáner, y el logo de SAP junto a la línea.
function MiniPlanta({ mats }) {
  return (
    <group>
      <mesh position={[-0.1, 0.2, 0.3]} material={mats.cinta}>
        <boxGeometry args={[0.95, 0.07, 0.22]} />
      </mesh>
      <mesh position={[0.38, 0.2, -0.12]} material={mats.cinta}>
        <boxGeometry args={[0.22, 0.07, 0.8]} />
      </mesh>
      {[[-0.5, 0.2], [0.3, 0.4], [0.4, -0.45], [0.4, 0.4]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.1, z]} material={mats.acero}>
          <boxGeometry args={[0.04, 0.2, 0.04]} />
        </mesh>
      ))}
      {[[-0.35, 0.3], [0.05, 0.3], [0.38, -0.1]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.31, z]} material={mats.carton}>
          <boxGeometry args={[0.15, 0.15, 0.15]} />
        </mesh>
      ))}
      <group position={[-0.15, 0, 0.3]}>
        {[-1, 1].map((l) => (
          <mesh key={l} position={[0, 0.34, l * 0.17]} material={mats.acero}>
            <boxGeometry args={[0.04, 0.6, 0.04]} />
          </mesh>
        ))}
        <mesh position={[0, 0.64, 0]} material={mats.acero}>
          <boxGeometry args={[0.05, 0.04, 0.4]} />
        </mesh>
        <mesh position={[0, 0.46, 0]} material={mats.laser}>
          <boxGeometry args={[0.005, 0.3, 0.3]} />
        </mesh>
      </group>
      <Logo material={mats.logoSap} posicion={[0.78, 0.55, 0.1]} ancho={0.72} alto={0.35} />
    </group>
  );
}

export const MINIATURAS = [MiniNotebook, MiniBandera, MiniTarjetas, MiniPlaca, MiniBanco, MiniPlanta];
