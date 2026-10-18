'use client';

import { useEffect } from 'react';
import { bandasDeUnion, mascaraDeUnion } from '@/lib/uniones.js';

// Funde los bordes de una sección con el color de la página sólo mientras se ven (ver lib/uniones.js).
// Aplica al elemento una máscara con curva suave y le escribe, en cada scroll, el alto de los dos
// fundidos (`--banda-arriba` / `--banda-abajo`). El elemento tiene que ocupar la sección entera
// (inset: 0), así su rect es el de la sección.
// `fraccion`: cuánto de la ventana puede medir el fundido.
export default function useUnionSeccion(ref, { arriba = true, abajo = true, fraccion = 0.4 } = {}) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const mascara = mascaraDeUnion(arriba, abajo);
    el.style.webkitMaskImage = mascara;
    el.style.maskImage = mascara;

    let cuadro = 0;
    let ultimoArriba = -1;
    let ultimoAbajo = -1;
    const actualizar = () => {
      cuadro = 0;
      const r = el.getBoundingClientRect();
      const b = bandasDeUnion(r.top, r.bottom, window.innerHeight, fraccion);
      // sólo se escribe si cambió: cambiar la variable repinta la máscara
      if (b.arriba !== ultimoArriba) {
        ultimoArriba = b.arriba;
        el.style.setProperty('--banda-arriba', `${b.arriba}px`);
      }
      if (b.abajo !== ultimoAbajo) {
        ultimoAbajo = b.abajo;
        el.style.setProperty('--banda-abajo', `${b.abajo}px`);
      }
    };
    const pedir = () => {
      if (!cuadro) cuadro = requestAnimationFrame(actualizar);
    };
    actualizar();
    window.addEventListener('scroll', pedir, { passive: true });
    window.addEventListener('resize', pedir);
    return () => {
      cancelAnimationFrame(cuadro);
      window.removeEventListener('scroll', pedir);
      window.removeEventListener('resize', pedir);
      el.style.webkitMaskImage = '';
      el.style.maskImage = '';
    };
  }, [ref, arriba, abajo, fraccion]);
}
