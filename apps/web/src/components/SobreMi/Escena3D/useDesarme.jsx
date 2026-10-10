'use client';

import { createContext, useContext, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { amortiguar } from './desarme.js';

// `desarme` va de 0 (armada) a 1 (dispersa). Es un ref y no estado de React:
// cambia cada cuadro y no debe re-renderizar nada.
const ContextoDesarme = createContext({ current: 0 });

export function ProveedorDesarme({ desarmado, children }) {
  const valor = useRef(0);
  useFrame((_, delta) => {
    // `delta` acotado: al volver de una pestaña oculta no debe dar un salto.
    valor.current = amortiguar(valor.current, desarmado ? 1 : 0, 7, Math.min(delta, 0.05));
  });
  return <ContextoDesarme.Provider value={valor}>{children}</ContextoDesarme.Provider>;
}

export function useDesarme() {
  return useContext(ContextoDesarme);
}
