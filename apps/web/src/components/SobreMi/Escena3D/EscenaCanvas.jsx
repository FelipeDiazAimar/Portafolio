'use client';

import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useReducedMotion } from 'framer-motion';
import LucesAzules from './LucesAzules.jsx';
import ControlGiro from './ControlGiro.jsx';
import { ProveedorDesarme } from './useDesarme.jsx';
import { cargadorEscena } from './escenas/index.js';

// Cuánto se dispersa la escena saliente antes de montar la del hito nuevo.
const MS_SALIDA = 350;

export default function EscenaCanvas({ idHito, desarmado, visible, onError }) {
  const reducido = useReducedMotion();
  const [idMostrado, setIdMostrado] = useState(idHito);
  const [saliendo, setSaliendo] = useState(false);

  // Cambio de hito: la escena actual se dispersa y recién después se monta la
  // nueva. Si el hito vuelve a cambiar a mitad de camino, el efecto se
  // reinicia y sólo queda montada la última.
  useEffect(() => {
    if (idHito === idMostrado) return undefined;
    setSaliendo(true);
    const espera = setTimeout(
      () => {
        setIdMostrado(idHito);
        setSaliendo(false);
      },
      reducido ? 0 : MS_SALIDA
    );
    return () => clearTimeout(espera);
  }, [idHito, idMostrado, reducido]);

  const Escena = useMemo(() => lazy(cargadorEscena(idMostrado)), [idMostrado]);

  return (
    <Canvas
      dpr={[1, 2]}
      frameloop={visible ? 'always' : 'never'}
      camera={{ position: [0, 0.8, 5.6], fov: 38 }}
      gl={{ alpha: true, antialias: true }}
      style={{ position: 'absolute', inset: 0 }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', (evento) => {
          evento.preventDefault();
          onError();
        });
      }}
    >
      <LucesAzules />
      <ProveedorDesarme desarmado={desarmado || saliendo}>
        <ControlGiro quieto={Boolean(reducido)}>
          <Suspense fallback={null}>
            <Escena key={idMostrado} activa={visible} reducido={Boolean(reducido)} />
          </Suspense>
        </ControlGiro>
      </ProveedorDesarme>
    </Canvas>
  );
}
