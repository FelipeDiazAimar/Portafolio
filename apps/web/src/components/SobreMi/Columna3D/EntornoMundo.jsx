'use client';

import { Environment, Lightformer } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { estadoDe } from '@/lib/columna/recorrido.js';

const INTENSIDAD = 0.75;

// Iluminación de estudio —paneles de luz que se reflejan en los metales— que usan las
// escenas del PC y del banco. Antes cada una montaba su propio <Environment>: al montarse o
// quitarse aparecía o desaparecía `scene.environment` en todo el mundo, y three recompilaba
// los shaders de todo lo que estaba a la vista (un congelamiento de más de un segundo).
// Ahora el entorno está siempre y lo que se mueve es su intensidad: llena en esas escenas y
// en sus vecinas, y se apaga hacia las demás, de modo que se ve igual que antes pero sin
// cambiar nunca el estado de los programas.
// `centros`: índices de los hitos que lo usan.
export default function EntornoMundo({ refTramo, reducido, centros }) {
  const scene = useThree((estado) => estado.scene);
  useFrame(() => {
    const s = estadoDe(refTramo.current, { reducido });
    const distancia = Math.min(...centros.map((c) => Math.abs(s - c)));
    const peso = Math.min(1, Math.max(0, 2 - distancia));
    scene.environmentIntensity = INTENSIDAD * peso;
  });
  return (
    <Environment resolution={512} frames={1}>
      <color attach="background" args={['#8190a6']} />
      <Lightformer form="rect" intensity={9} color="#ffffff" position={[0, 6, 5]} rotation-x={Math.PI / 2.2} scale={[14, 6, 1]} />
      <Lightformer form="rect" intensity={6} color="#f4f7ff" position={[0, 1, 9]} scale={[16, 9, 1]} />
      <Lightformer form="rect" intensity={4} color="#7fe6ff" position={[-7, 1, 1]} rotation-y={Math.PI / 2} scale={[9, 5, 1]} />
      <Lightformer form="rect" intensity={4} color="#b9ccff" position={[7, 1, 2]} rotation-y={-Math.PI / 2} scale={[9, 5, 1]} />
    </Environment>
  );
}
