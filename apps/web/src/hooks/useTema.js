'use client';

import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import cambiarTemaConOnda from './ondaTema.js';

function leerTemaGuardado() {
  try {
    return window.localStorage.getItem('theme');
  } catch {
    return null;
  }
}

// Tema claro/oscuro del sitio. Lo comparten el toggle de escritorio y el menú
// móvil: los dos leen el mismo estado (data-theme en <html> + localStorage).
// Sin elección guardada, sigue al sistema operativo.
export default function useTema() {
  const [tema, setTema] = useState('dark');

  useEffect(() => {
    const guardado = leerTemaGuardado();
    const consulta = window.matchMedia('(prefers-color-scheme: light)');

    setTema(guardado === 'light' || guardado === 'dark' ? guardado : consulta.matches ? 'light' : 'dark');

    function alCambiarElSistema(evento) {
      const actual = leerTemaGuardado();
      if (actual !== 'light' && actual !== 'dark') {
        setTema(evento.matches ? 'light' : 'dark');
      }
    }

    consulta.addEventListener('change', alCambiarElSistema);
    return () => consulta.removeEventListener('change', alCambiarElSistema);
  }, []);

  // Cambia el tema desde cualquier lado: si hay dos consumidores montados, el
  // atributo de <html> es la única fuente real, así que se vuelve a leer de ahí.
  useEffect(() => {
    const observador = new MutationObserver(() => {
      const attr = document.documentElement.getAttribute('data-theme');
      if (attr === 'light' || attr === 'dark') setTema(attr);
    });
    observador.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observador.disconnect();
  }, []);

  // El evento del clic (si llega) marca desde dónde nace la onda.
  function alternar(evento) {
    const siguiente = tema === 'dark' ? 'light' : 'dark';
    cambiarTemaConOnda(evento?.currentTarget, () => {
      flushSync(() => setTema(siguiente));
      document.documentElement.setAttribute('data-theme', siguiente);
    });
    try {
      window.localStorage.setItem('theme', siguiente);
    } catch {
      /* sin almacenamiento: el tema sólo dura la sesión */
    }
  }

  return { tema, alternar };
}
