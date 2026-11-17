'use client';

import { useCallback, useEffect, useState } from 'react';
import hitos from '@/data/hitos.json';
import { hayWebGL } from '@/lib/soporteWebGL.js';
import ReelHitos from './ReelHitos.jsx';
import SobreMiPlano from './SobreMiPlano.jsx';

// "Sobre mí": el reel 3D de hitos. En el servidor y en el primer render se arma el reel; si no hay
// WebGL (o el contexto se pierde) se cambia a la lista plana, que muestra lo mismo sin 3D.
export default function SobreMi() {
  const [plano, setPlano] = useState(false);
  useEffect(() => {
    if (!hayWebGL()) setPlano(true);
  }, []);
  const alFallar = useCallback(() => setPlano(true), []);
  if (hitos.length === 0) return null;
  return plano ? <SobreMiPlano hitos={hitos} /> : <ReelHitos hitos={hitos} alFallar={alFallar} />;
}
