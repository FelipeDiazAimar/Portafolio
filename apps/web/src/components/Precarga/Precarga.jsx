'use client';

import { useEffect } from 'react';
import { enCola, esEscritorio } from '@/lib/precarga.js';

// Baja de antemano (en PC, en momentos libres) el código de las escenas que cada sección carga
// recién al llegar. Así el primer teletransporte a esa sección no espera la descarga ni la
// compilación del módulo. Una vez bajado, el navegador no lo vuelve a pedir.
export default function Precarga() {
  useEffect(() => {
    if (!esEscritorio()) return undefined;
    return enCola([
      () => import('@/components/SobreMi/escena/EscenaReel.js'),
      () => import('@/components/SobreMi/portadas/componerPortada.js'),
      () => import('@/components/Proyectos/piezas/EscenaPiezas.js'),
      () => import('@/components/RayosX/EscenaRayosX.js'),
      () => import('@/components/ColapsoFisico/ColapsoFisico.jsx'),
      () => import('@/components/Gelatina/GelatinaResena.jsx'),
    ]);
  }, []);
  return null;
}
