'use client';

import { useEffect, useRef } from 'react';

// Distancia máxima que puede moverse el dedo para seguir contando como toque.
// Más que eso es un gesto de scroll, y el navegador cancela el puntero.
const MARGEN_MOVIMIENTO_PX = 10;
const DURACION_MAXIMA_MS = 400;
// Holgura alrededor del elemento: un dedo no apunta con precisión de píxel.
const HOLGURA_PX = 12;

// Detecta un TOQUE (tap) del dedo sobre el rectángulo de un elemento y llama a
// `alToque({ x, y })` con la posición en coordenadas de página.
//
// Escucha en `window` y compara contra el rect, en vez de usar eventos del
// elemento: el hero está detrás de todo (z-index -1, pointer-events: none), así
// que los toques nunca le llegan. Y como no cambia `touch-action`, el scroll
// con el dedo sigue funcionando normal: un gesto de scroll termina en
// `pointercancel`, no en `pointerup`, y no cuenta como toque.
export default function useToqueSobre(refElemento, activo, alToque) {
  const refAlToque = useRef(alToque);
  refAlToque.current = alToque;

  useEffect(() => {
    if (!activo) return undefined;

    let inicio = null;

    function alBajar(evento) {
      if (evento.pointerType !== 'touch' || !evento.isPrimary) return;
      inicio = { x: evento.clientX, y: evento.clientY, t: performance.now() };
    }

    function alSubir(evento) {
      if (!inicio) return;
      const movimiento = Math.hypot(evento.clientX - inicio.x, evento.clientY - inicio.y);
      const duracion = performance.now() - inicio.t;
      inicio = null;
      if (movimiento > MARGEN_MOVIMIENTO_PX || duracion > DURACION_MAXIMA_MS) return;

      const nodo = refElemento.current;
      if (!nodo) return;
      const rect = nodo.getBoundingClientRect();
      const adentro =
        evento.clientX >= rect.left - HOLGURA_PX &&
        evento.clientX <= rect.right + HOLGURA_PX &&
        evento.clientY >= rect.top - HOLGURA_PX &&
        evento.clientY <= rect.bottom + HOLGURA_PX;
      if (!adentro) return;

      refAlToque.current({
        x: evento.clientX + window.scrollX,
        y: evento.clientY + window.scrollY,
      });
    }

    function alCancelar() {
      inicio = null;
    }

    window.addEventListener('pointerdown', alBajar, { passive: true });
    window.addEventListener('pointerup', alSubir, { passive: true });
    window.addEventListener('pointercancel', alCancelar, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', alBajar);
      window.removeEventListener('pointerup', alSubir);
      window.removeEventListener('pointercancel', alCancelar);
    };
  }, [activo, refElemento]);
}
