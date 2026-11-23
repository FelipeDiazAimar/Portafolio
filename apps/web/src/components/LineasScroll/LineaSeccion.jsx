'use client';

// El último tramo de la línea del sitio, redibujado DENTRO de una sección que pinta su propio fondo
// en una escena (Habilidades, Contacto): ahí la capa de atrás de la página no se ve. Va entre el
// fondo de la sección y su contenido (z-index 1), con el mismo camino (coordenadas de página) y la
// misma regla para la punta que la capa de la página, y se mueve con el scroll nativo de la sección:
// las dos coinciden exactas en los bordes.
import { useEffect, useRef } from 'react';
import { alCuadro, movimientoReducido } from '@/lib/movimiento.js';
import { COLOR_LINEA, largoHasta, puntaDePagina } from '@/lib/trazos.js';
import { EVENTO_LINEA_FINAL, lineaFinalActual } from '@/lib/puente.js';
import styles from './LineasScroll.module.css';

export default function LineaSeccion() {
  const refSvg = useRef(null);

  useEffect(() => {
    const svg = refSvg.current;
    const seccion = svg?.parentElement;
    if (!svg || !seccion || movimientoReducido()) return undefined;
    const ruta = svg.querySelector('path');
    let linea = null;
    let ultimo = -1;

    const armar = () => {
      linea = lineaFinalActual();
      if (!linea) return;
      const arriba = seccion.getBoundingClientRect().top + window.scrollY;
      const W = seccion.clientWidth;
      const H = seccion.clientHeight;
      svg.setAttribute('viewBox', `0 ${arriba.toFixed(1)} ${W} ${H}`);
      ruta.setAttribute('d', linea.d);
      ruta.setAttribute('stroke-width', linea.ancho.toFixed(1));
      ruta.style.strokeDasharray = `${linea.trazo.largo} ${linea.trazo.largo + 10}`;
      ultimo = -1;
      pintar();
    };
    const pintar = () => {
      if (!linea) return;
      const dibujado = largoHasta(linea.trazo, linea.tabla, puntaDePagina(window.scrollY, window.innerHeight));
      if (Math.abs(dibujado - ultimo) < 0.1) return;
      ultimo = dibujado;
      ruta.style.strokeDashoffset = (linea.trazo.largo - dibujado).toFixed(1);
      ruta.style.opacity = dibujado > 0.5 ? '1' : '0';
    };

    armar();
    window.addEventListener(EVENTO_LINEA_FINAL, armar);
    const ro = new ResizeObserver(armar);
    ro.observe(seccion);
    const quitar = alCuadro(pintar);
    window.addEventListener('scroll', pintar, { passive: true });
    return () => {
      window.removeEventListener(EVENTO_LINEA_FINAL, armar);
      ro.disconnect();
      quitar();
      window.removeEventListener('scroll', pintar);
    };
  }, []);

  return (
    <svg ref={refSvg} className={styles.seccion} preserveAspectRatio="none" aria-hidden="true">
      <path stroke={COLOR_LINEA.c0} />
    </svg>
  );
}
