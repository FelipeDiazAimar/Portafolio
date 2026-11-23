'use client';

// Id de la sección de la página principal que se está viendo (la misma regla que usa UrlPorScroll
// para el #hash). Sirve para que el header muestre el rótulo de la píldora de esa sección.
// Con la vista previa del menú (la página salta sola) conserva la última, así no parpadea.
import { useEffect, useState } from 'react';
import { IDS_SECCIONES, seccionActual } from '@/lib/seccionActual.js';

export default function useSeccionVisible() {
  const [id, setId] = useState(null);

  useEffect(() => {
    let reintento = 0;

    function calcular() {
      clearTimeout(reintento);
      // mientras dura el salto o la vista previa se espera, y se vuelve a mirar apenas termina
      if (document.documentElement.dataset.sinIman) {
        reintento = setTimeout(calcular, 250);
        return;
      }
      const secciones = IDS_SECCIONES.map((seccion) => {
        const nodo = document.getElementById(seccion);
        if (!nodo) return null;
        const { top, bottom } = nodo.getBoundingClientRect();
        return { id: seccion, top, bottom };
      }).filter(Boolean);
      if (secciones.length < 2) return;
      setId(seccionActual(secciones, window.innerHeight) ?? null);
    }

    // son 7 lecturas de rectángulos: se calcula en cada evento de scroll (setState ignora repetidos)
    const alScroll = calcular;

    calcular();
    window.addEventListener('scroll', alScroll, { passive: true });
    window.addEventListener('resize', alScroll);
    return () => {
      clearTimeout(reintento);
      window.removeEventListener('scroll', alScroll);
      window.removeEventListener('resize', alScroll);
    };
  }, []);

  return id;
}
