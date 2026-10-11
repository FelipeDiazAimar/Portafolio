'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import PiezaDesarmable from '../PiezaDesarmable.jsx';
import { fraccionExplosion } from '../cicloPC.js';
import { crearMateriales, liberarMateriales } from './pc/materialesPC.js';
import Placa from './pc/Placa.jsx';
import { ChipCPU, CoolerCPU, ModulosRAM, SSD, TarjetaGrafica } from './pc/PiezasMoviles.jsx';

// Cuánto se separa cada pieza de su lugar en la vista explotada, en la dirección
// `dir` de cada una (pensadas para que no choquen entre sí).
const SEPARACION = 1.25;

// Grupo que se desplaza `dir * fracción * SEPARACION`. La fracción la calcula la
// escena una vez por cuadro y se comparte por referencia.
function Flotante({ dir, fraccion, children }) {
  const grupo = useRef(null);
  useFrame(() => {
    const f = fraccion.current;
    grupo.current.position.set(dir[0] * f * SEPARACION, dir[1] * f * SEPARACION, dir[2] * f * SEPARACION);
  });
  return <group ref={grupo}>{children}</group>;
}

export default function Escena3PC({ activa, reducido }) {
  const recursos = useMemo(crearMateriales, []);
  const { materiales } = recursos;
  const fraccion = useRef(0);
  const tiempo = useRef(0);
  const aspasCooler = useRef(null);
  const aspasGpu = [useRef(null), useRef(null), useRef(null)];

  useEffect(() => () => liberarMateriales(recursos), [recursos]);

  useFrame((_, delta) => {
    if (!activa) return;
    // Con movimiento reducido la PC queda armada y quieta.
    if (reducido) {
      fraccion.current = 0;
      return;
    }
    tiempo.current += Math.min(delta, 0.05);
    fraccion.current = fraccionExplosion(tiempo.current);
    const giro = tiempo.current * 9;
    if (aspasCooler.current) aspasCooler.current.rotation.z = giro;
    aspasGpu.forEach((ref, i) => {
      if (ref.current) ref.current.rotation.z = -giro * 1.2 + i;
    });
  });

  return (
    <group position={[0.15, 0.05, 0]} rotation={[0.42, -0.45, 0]} scale={0.82}>
      {/* Iluminación de estudio: cuatro paneles de luz que se reflejan en los
          metales (sin esto el aluminio y el acero se ven planos). Se dibuja una
          sola vez. */}
      <Environment resolution={512} frames={1} environmentIntensity={1.7}>
        {/* Fondo del entorno: da un reflejo base a los metales (sin él, lo que no
            apunta a un panel de luz se refleja negro). */}
        <color attach="background" args={['#8190a6']} />
        <Lightformer form="rect" intensity={9} color="#ffffff" position={[0, 6, 5]} rotation-x={Math.PI / 2.2} scale={[14, 6, 1]} />
        <Lightformer form="rect" intensity={6} color="#f4f7ff" position={[0, 1, 9]} scale={[16, 9, 1]} />
        <Lightformer form="rect" intensity={4} color="#7fe6ff" position={[-7, 1, 1]} rotation-y={Math.PI / 2} scale={[9, 5, 1]} />
        <Lightformer form="rect" intensity={4} color="#b9ccff" position={[7, 1, 2]} rotation-y={-Math.PI / 2} scale={[9, 5, 1]} />
        <Lightformer form="ring" intensity={5} color="#ffffff" position={[0, -3, 5]} rotation-x={-Math.PI / 3} scale={5} />
      </Environment>

      {/* Luz neutra de estudio: la iluminación base del sitio es azul y teñía los
          metales; con luz blanca el aluminio y el acero se ven plateados. */}
      <directionalLight position={[3, 6, 7]} intensity={2.4} color="#ffffff" />
      <directionalLight position={[-5, 2, 4]} intensity={0.8} color="#dfe8ff" />

      <PiezaDesarmable semilla={1}>
        <Placa materiales={materiales} />
      </PiezaDesarmable>

      <PiezaDesarmable semilla={2}>
        <Flotante dir={[0.05, 0.1, 0.5]} fraccion={fraccion}>
          <ChipCPU materiales={materiales} />
        </Flotante>
      </PiezaDesarmable>

      <PiezaDesarmable semilla={3}>
        <Flotante dir={[0.05, 0.35, 1]} fraccion={fraccion}>
          <CoolerCPU materiales={materiales} refAspas={aspasCooler} />
        </Flotante>
      </PiezaDesarmable>

      <PiezaDesarmable semilla={4}>
        <Flotante dir={[0.8, 0.25, 0.9]} fraccion={fraccion}>
          <ModulosRAM materiales={materiales} />
        </Flotante>
      </PiezaDesarmable>

      <PiezaDesarmable semilla={5}>
        <Flotante dir={[-0.3, -0.9, 0.8]} fraccion={fraccion}>
          <TarjetaGrafica materiales={materiales} refAspas={aspasGpu} />
        </Flotante>
      </PiezaDesarmable>

      <PiezaDesarmable semilla={6}>
        <Flotante dir={[-0.7, -0.6, 0.6]} fraccion={fraccion}>
          <SSD materiales={materiales} />
        </Flotante>
      </PiezaDesarmable>
    </group>
  );
}
