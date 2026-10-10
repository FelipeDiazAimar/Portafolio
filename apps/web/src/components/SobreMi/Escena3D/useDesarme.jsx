'use client';

import { createContext, useContext, useRef } from 'react';

// Estado compartido del desarme: `desarmado` (el objetivo) y `reducido`
// (movimiento reducido). Es un ref y no estado de React: lo leen los useFrame
// de cada pieza y no debe re-renderizar nada.
const ContextoDesarme = createContext({ current: { desarmado: false, reducido: false } });

export function ProveedorDesarme({ desarmado, reducido = false, children }) {
  const estado = useRef({ desarmado, reducido });
  // Se actualiza en cada render del proveedor, que es cuando cambian las props.
  estado.current.desarmado = desarmado;
  estado.current.reducido = reducido;
  return <ContextoDesarme.Provider value={estado}>{children}</ContextoDesarme.Provider>;
}

export function useDesarme() {
  return useContext(ContextoDesarme);
}
