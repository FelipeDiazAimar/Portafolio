'use client';

import { useEffect, useState } from 'react';

export default function useScrollPasadoViewport() {
  const [pasado, setPasado] = useState(false);

  useEffect(() => {
    let ticking = false;

    function actualizar() {
      setPasado(window.scrollY >= window.innerHeight);
      ticking = false;
    }

    function manejarScroll() {
      if (!ticking) {
        window.requestAnimationFrame(actualizar);
        ticking = true;
      }
    }

    window.addEventListener('scroll', manejarScroll, { passive: true });
    return () => window.removeEventListener('scroll', manejarScroll);
  }, []);

  return pasado;
}
