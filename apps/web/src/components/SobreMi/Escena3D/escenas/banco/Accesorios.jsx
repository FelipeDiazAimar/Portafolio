'use client';

// Palanca de plástico para abrir pantallas (spudger), al lado del teléfono.
export function Palanca({ mats }) {
  return (
    <group>
      <mesh position={[0, 0.012, 0]} material={mats.plasticoClaro}>
        <boxGeometry args={[0.7, 0.016, 0.05]} />
      </mesh>
      <mesh position={[0.37, 0.012, 0]} material={mats.plasticoClaro}>
        <boxGeometry args={[0.06, 0.008, 0.038]} />
      </mesh>
      <mesh position={[-0.35, 0.012, 0]} material={mats.mango}>
        <boxGeometry args={[0.04, 0.02, 0.054]} />
      </mesh>
    </group>
  );
}

// Pinzas de punta fina.
export function Pinzas({ mats }) {
  return (
    <group>
      {[-0.012, 0.012].map((z) => (
        <mesh key={z} position={[0, 0.01, z]} rotation={[0, z * 6, 0]} material={mats.acero}>
          <boxGeometry args={[0.8, 0.01, 0.016]} />
        </mesh>
      ))}
      <mesh position={[-0.4, 0.01, 0]} material={mats.acero}>
        <boxGeometry args={[0.03, 0.012, 0.05]} />
      </mesh>
    </group>
  );
}

// Destornillador apoyado sobre la mesa (la punta hacia +x).
export function Destornillador({ mats }) {
  return (
    <group>
      <mesh position={[0.35, 0.02, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.acero}>
        <cylinderGeometry args={[0.012, 0.012, 0.55, 14]} />
      </mesh>
      <mesh position={[0.64, 0.02, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.acero}>
        <boxGeometry args={[0.02, 0.045, 0.012]} />
      </mesh>
      <mesh position={[-0.12, 0.035, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.mango}>
        <cylinderGeometry args={[0.035, 0.03, 0.5, 24]} />
      </mesh>
      {[-0.28, -0.2, -0.12, -0.04].map((x) => (
        <mesh key={x} position={[x, 0.035, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.goma}>
          <cylinderGeometry args={[0.0365, 0.0365, 0.02, 24]} />
        </mesh>
      ))}
      <mesh position={[-0.38, 0.035, 0]} material={mats.goma}>
        <sphereGeometry args={[0.035, 18, 18]} />
      </mesh>
    </group>
  );
}
