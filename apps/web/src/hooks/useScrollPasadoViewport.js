'use client';

import { useEffect, useState } from 'react';
import { alCambiarTeletransporte, estaCongelado } from '@/lib/teletransporte.js';

export default function useScrollPasadoViewport() {
  const [pasado, setPasado] = useState(false);

  useEffect(() => {
    let ticking = false;

    function actualizar() {
      ticking = false;
      // durante una vista previa del teletransporte el header queda como estaba
      if (estaCongelado()) return;
      setPasado(window.scrollY >= window.innerHeight);
    }

    function manejarScroll() {
      if (!ticking) {
        window.requestAnimationFrame(actualizar);
        ticking = true;
      }
    }

    window.addEventListener('scroll', manejarScroll, { passive: true });
    // al terminar la vista previa se vuelve a medir con el scroll real
    const quitar = alCambiarTeletransporte(() => {
      if (!estaCongelado()) window.requestAnimationFrame(actualizar);
    });
    return () => {
      window.removeEventListener('scroll', manejarScroll);
      quitar();
    };
  }, []);

  return pasado;
}
