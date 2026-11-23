'use client';

import { useCallback, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

import { EVENTO_RENDIMIENTO, modoRendimiento } from '@/lib/rendimiento.js';
// misma onda expansiva que el cambio de tema: el estado nuevo se revela en vivo
import cambiarConOnda from './ondaTema.js';

export { EVENTO_RENDIMIENTO, modoRendimiento };

const CLAVE = 'portafolio:rendimiento';

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

  // `origen`: el elemento (o el evento del clic) desde donde nace la animación.
  const alternar = useCallback((origen) => {
    const nuevo = !modoRendimiento();
    const elemento = origen?.currentTarget ?? origen;
    cambiarConOnda(elemento, () => {
      document.documentElement.setAttribute('data-rendimiento', String(nuevo));
      // sincrónico: el toggle tiene que quedar en su estado nuevo antes de la captura
      flushSync(() => window.dispatchEvent(new CustomEvent(EVENTO_RENDIMIENTO, { detail: nuevo })));
      // los lienzos 3D recalculan su densidad de píxeles al redimensionarse
      window.dispatchEvent(new Event('resize'));
    });
    try {
      window.localStorage.setItem(CLAVE, String(nuevo));
    } catch {
      /* sin almacenamiento */
    }
  }, []);

  return { activo, alternar };
}
