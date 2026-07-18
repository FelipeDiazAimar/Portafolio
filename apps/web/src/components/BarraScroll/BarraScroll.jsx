'use client';

import { useEffect, useRef } from 'react';
import styles from './BarraScroll.module.css';

const ALTURA_MINIMA_THUMB_PX = 40;

export default function BarraScroll() {
  const refThumb = useRef(null);

  useEffect(() => {
    let ticking = false;

    function actualizar() {
      const alturaDocumento = document.documentElement.scrollHeight;
      const alturaVentana = window.innerHeight;
      const maxScroll = alturaDocumento - alturaVentana;

      if (refThumb.current && maxScroll > 0) {
        const alturaThumb = Math.max(
          (alturaVentana / alturaDocumento) * alturaVentana,
          ALTURA_MINIMA_THUMB_PX
        );
        const progreso = window.scrollY / maxScroll;
        const posicionThumb = progreso * (alturaVentana - alturaThumb);

        refThumb.current.style.height = `${alturaThumb}px`;
        refThumb.current.style.transform = `translateY(${posicionThumb}px)`;
      }
      ticking = false;
    }

    function manejarEvento() {
      if (!ticking) {
        window.requestAnimationFrame(actualizar);
        ticking = true;
      }
    }

    actualizar();
    window.addEventListener('scroll', manejarEvento, { passive: true });
    window.addEventListener('resize', manejarEvento);
    return () => {
      window.removeEventListener('scroll', manejarEvento);
      window.removeEventListener('resize', manejarEvento);
    };
  }, []);

  return (
    <div className={styles.pista} aria-hidden="true">
      <div ref={refThumb} className={styles.thumb} />
    </div>
  );
}
