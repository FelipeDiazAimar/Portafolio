'use client';

import { useEffect, useRef } from 'react';
import { modoRendimiento } from '@/lib/rendimiento.js';
import { esTactil } from '@/lib/entrada.js';
import { conectarInteraccion } from './interaccion.js';

// Escena de Unicorn Studio exportada como JSON (public/escenas). El SDK se baja una sola vez del
// CDN, con versión fija, recién cuando hace falta una escena.
export const SDK_UNICORN = 'https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.6.1/dist/unicornStudio.umd.js';
// "Azure Wave" exportada de Unicorn, con seguimiento del mouse (trackMouse 0,3 / 0,65 / 0,45) en las capas
// gradient, nebula y normalMap; el original sin tocar sigue en Descargas/unicorn-local.
export const ESCENA_AURORA = '/escenas/aurora.json';

let promesaSdk = null;

function cargarSdk() {
  if (window.UnicornStudio) return Promise.resolve(window.UnicornStudio);
  promesaSdk ??= new Promise((resolver, rechazar) => {
    const script = document.createElement('script');
    script.src = SDK_UNICORN;
    script.async = true;
    script.onload = () => (window.UnicornStudio ? resolver(window.UnicornStudio) : rechazar(new Error('sin SDK')));
    script.onerror = () => {
      promesaSdk = null;
      script.remove();
      rechazar(new Error('no cargó el SDK de Unicorn'));
    };
    document.head.appendChild(script);
  });
  return promesaSdk;
}

// Sin movimiento reducido ni modo rendimiento: es un shader a pantalla completa.
export function puedeMostrarUnicorn() {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  return !modoRendimiento();
}

export default function FondoUnicorn({ archivo = ESCENA_AURORA, className, alListo, alFallar }) {
  const ref = useRef(null);
  // los avisos pueden cambiar entre renders; la escena se arma una sola vez
  const avisos = useRef({ alListo, alFallar });
  avisos.current = { alListo, alFallar };

  useEffect(() => {
    let cancelado = false;
    let escena = null;
    let desconectar = () => {};
    const tactil = esTactil();
    cargarSdk()
      .then((US) =>
        US.addScene({
          element: ref.current,
          filePath: archivo,
          // en el celular, menos píxeles: el shader es caro y la pantalla ya es densa
          scale: tactil ? 0.75 : 1,
          dpi: Math.min(window.devicePixelRatio || 1, tactil ? 1 : 1.5),
          fps: 60,
        })
      )
      .then((s) => {
        if (cancelado) {
          s?.destroy?.();
          return;
        }
        escena = s;
        // hover, clic y arrastre sobre todo el contenedor (el texto de encima deja pasar el mouse)
        desconectar = conectarInteraccion(s, ref.current?.parentElement);
        avisos.current.alListo?.();
      })
      .catch(() => {
        if (!cancelado) avisos.current.alFallar?.();
      });
    return () => {
      cancelado = true;
      desconectar();
      escena?.destroy?.();
    };
  }, [archivo]);

  return <div ref={ref} className={className} aria-hidden="true" />;
}
