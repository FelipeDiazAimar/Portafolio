'use client';

import { createContext, useContext, useState } from 'react';

const ContextoPortfolio = createContext(null);

export function ProveedorPortfolio({ children }) {
  const [seccionActiva, setSeccionActiva] = useState('inicio');
  return (
    <ContextoPortfolio.Provider value={{ seccionActiva, setSeccionActiva }}>
      {children}
    </ContextoPortfolio.Provider>
  );
}

export function usePortfolio() {
  const ctx = useContext(ContextoPortfolio);
  if (!ctx) {
    throw new Error('usePortfolio debe usarse dentro de <ProveedorPortfolio>');
  }
  return ctx;
}
