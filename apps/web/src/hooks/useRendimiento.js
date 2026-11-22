'use client';

import { useCallback, useEffect, useState } from 'react';

const CLAVE = 'portafolio:rendimiento';
export const EVENTO_RENDIMIENTO = 'portafolio:rendimiento';

// ¿Está activo el modo rendimiento? Se puede leer fuera de React (escenas 3D).
export function modoRendimiento() {
  if (typeof document === 'undefined') return false;
  return document.documentElement.getAttribute('data-rendimiento') === 'true';
}

// Modo rendimiento del sitio: menos efectos para equipos justos. Se guarda en este navegador, se
// refleja en <html data-rendimiento> y avisa con el evento `portafolio:rendimiento` (detail: bool),
// así las escenas 3D lo aplican sin recargar.
export default function useRendimiento() {
  const [activo, setActivo] = useState(false);

  useEffect(() => {
    let guardado = false;
    try {
      guardado = window.localStorage.getItem(CLAVE) === 'true';
    } catch {
      /* sin almacenamiento */
    }
    document.documentElement.setAttribute('data-rendimiento', String(guardado));
    setActivo(guardado);
    const alCambiar = (e) => setActivo(Boolean(e.detail));
    window.addEventListener(EVENTO_RENDIMIENTO, alCambiar);
    return () => window.removeEventListener(EVENTO_RENDIMIENTO, alCambiar);
  }, []);

  const alternar = useCallback(() => {
    const nuevo = !modoRendimiento();
    document.documentElement.setAttribute('data-rendimiento', String(nuevo));
    try {
      window.localStorage.setItem(CLAVE, String(nuevo));
    } catch {
      /* sin almacenamiento */
    }
    window.dispatchEvent(new CustomEvent(EVENTO_RENDIMIENTO, { detail: nuevo }));
  }, []);

  return { activo, alternar };
}
