'use client';

import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useReducedMotion } from 'framer-motion';
import LucesAzules from './LucesAzules.jsx';
import ControlGiro from './ControlGiro.jsx';
import DistanciaCamara from './DistanciaCamara.jsx';
import EscalaResponsiva from './EscalaResponsiva.jsx';
import { DISTANCIA_MINIMA, FOV } from './vista.js';
import { ProveedorDesarme } from './useDesarme.jsx';
import { cargadorEscena, esEscenaFija, limiteDeGiro } from './escenas/index.js';

// Cuánto se dispersa la escena saliente antes de montar la del hito nuevo.
const MS_SALIDA = 700;

export default function EscenaCanvas({ idHito, desarmado, claro = false, visible, onError }) {
  const reducido = useReducedMotion();
  const [idMostrado, setIdMostrado] = useState(idHito);
  const [saliendo, setSaliendo] = useState(false);
  const desmontando = useRef(false);
  useEffect(() => {
    desmontando.current = false;
    return () => {
      desmontando.current = true;
    };
  }, []);

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
      camera={{ position: [0, 0.7, DISTANCIA_MINIMA], fov: FOV }}
      gl={{ alpha: true, antialias: true }}
      style={{ position: 'absolute', inset: 0 }}
      onCreated={({ gl }) => {
        const lienzo = gl.domElement;
        lienzo.addEventListener('webglcontextlost', (evento) => {
          // R3F fuerza la pérdida del contexto (`forceContextLoss`) cuando el
          // canvas se desmonta, por ejemplo al pasar a un hito sin escena 3D.
          // Eso no es un fallo: tratarlo como tal dejaba el respaldo ASCII
          // fijo para siempre, aun al volver al hito.
          if (desmontando.current || !lienzo.isConnected) return;
          evento.preventDefault();
          onError();
        });
      }}
    >
      <DistanciaCamara />
      <LucesAzules />
      <ProveedorDesarme desarmado={desarmado || saliendo} reducido={Boolean(reducido)}>
        <ControlGiro quieto={Boolean(reducido)} girable={!esEscenaFija(idMostrado)} limiteAzimut={limiteDeGiro(idMostrado)}>
          <EscalaResponsiva>
            <Suspense fallback={null}>
              <Escena key={idMostrado} activa={visible} reducido={Boolean(reducido)} claro={claro} />
            </Suspense>
          </EscalaResponsiva>
        </ControlGiro>
      </ProveedorDesarme>
    </Canvas>
  );
}
