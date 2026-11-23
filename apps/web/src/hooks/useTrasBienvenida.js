'use client';

import { useEffect, useState } from 'react';
import { trasBienvenida } from '@/lib/bienvenida.js';

// true `demora` ms después de que se va la portada de Bienvenida (o enseguida, si no hay).
export function useTrasBienvenida(demora = 0) {
  const [listo, setListo] = useState(false);
  useEffect(() => trasBienvenida(() => setListo(true), demora), [demora]);
  return listo;
}
