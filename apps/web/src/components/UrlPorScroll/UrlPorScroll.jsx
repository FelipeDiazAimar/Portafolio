'use client';

// Mantiene el #hash de la URL al día mientras se hace scroll por las secciones de la página
// principal (antes sólo cambiaba al hacer clic en el menú). Usa replaceState: no agrega entradas
// al historial ni provoca saltos de scroll.
import { useEffect } from 'react';
import { IDS_SECCIONES, seccionActual, urlDeSeccion } from '@/lib/seccionActual.js';

const ESPERA_MS = 140; // se actualiza cuando el scroll hace una pausa, no en cada cuadro

export default function UrlPorScroll() {
  useEffect(() => {
    let temporizador = 0;
    let ultimo = window.location.hash.slice(1) || 'inicio';

    function actualizar() {
      // Con la vista previa del menú (o un salto en curso) la página salta sola: la URL espera.
      if (document.documentElement.dataset.sinIman) return;
      const secciones = IDS_SECCIONES.map((id) => {
        const nodo = document.getElementById(id);
        if (!nodo) return null;
        const { top, bottom } = nodo.getBoundingClientRect();
        return { id, top, bottom };
      }).filter(Boolean);
      // fuera de la página principal (p. ej. /proyectos/algo) no hay secciones que seguir
      if (secciones.length < 2) return;
      const id = seccionActual(secciones, window.innerHeight);
      if (!id || id === ultimo) return;
      ultimo = id;
      const { pathname, search } = window.location;
      window.history.replaceState(window.history.state, '', urlDeSeccion(id, pathname, search));
    }

    function alScroll() {
      clearTimeout(temporizador);
      temporizador = setTimeout(actualizar, ESPERA_MS);
    }
    // si se hace clic en el menú, irASeccion ya puso el hash: se toma como el último conocido
    function alCambiarHash() {
      ultimo = window.location.hash.slice(1) || 'inicio';
    }

    window.addEventListener('scroll', alScroll, { passive: true });
    window.addEventListener('hashchange', alCambiarHash);
    return () => {
      clearTimeout(temporizador);
      window.removeEventListener('scroll', alScroll);
      window.removeEventListener('hashchange', alCambiarHash);
    };
  }, []);

  return null;
}
