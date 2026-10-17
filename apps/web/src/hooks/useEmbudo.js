'use client';

import { useEffect } from 'react';

// Embudo de scroll: dentro de esta fracción del alto de pantalla, la sección se centra sola
// tras quedar quieta ese tiempo.
const EMBUDO_FRACCION = 0.45;
const EMBUDO_ESPERA_MS = 220;

// Al pasar por una sección a pantalla completa, si el scroll se detiene cerca de ella, la
// acomoda sola (su borde de arriba con el de la pantalla). No actúa con el dedo apoyado ni
// cuando otra parte de la página pidió no imantar (data-sin-iman en <html>).
export default function useEmbudo(refSeccion) {
  useEffect(() => {
    const seccion = refSeccion.current;
    if (!seccion) return undefined;
    let espera = 0;
    let dedos = 0;
    const intentar = () => {
      if (dedos > 0 || document.documentElement.dataset.sinIman) return;
      const distancia = seccion.getBoundingClientRect().top;
      if (Math.abs(distancia) < 2 || Math.abs(distancia) > window.innerHeight * EMBUDO_FRACCION) return;
      window.scrollTo({ top: window.scrollY + distancia, behavior: 'smooth' });
    };
    const alScroll = () => {
      clearTimeout(espera);
      espera = setTimeout(intentar, EMBUDO_ESPERA_MS);
    };
    const alTocar = (evento) => {
      dedos = evento.touches.length;
      if (!dedos) alScroll();
    };
    window.addEventListener('scroll', alScroll, { passive: true });
    window.addEventListener('touchstart', alTocar, { passive: true });
    window.addEventListener('touchend', alTocar, { passive: true });
    window.addEventListener('touchcancel', alTocar, { passive: true });
    return () => {
      clearTimeout(espera);
      window.removeEventListener('scroll', alScroll);
      window.removeEventListener('touchstart', alTocar);
      window.removeEventListener('touchend', alTocar);
      window.removeEventListener('touchcancel', alTocar);
    };
  }, [refSeccion]);
}
