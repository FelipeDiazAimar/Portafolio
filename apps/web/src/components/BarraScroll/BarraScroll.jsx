'use client';

import { useEffect, useRef } from 'react';
import styles from './BarraScroll.module.css';

const ALTURA_MINIMA_THUMB_PX = 40;
const ID_CONTENIDO_MENU = 'menu-movil-contenido';

// Con el menú móvil abierto la barra pasa al lado izquierdo. Si el contenido del
// panel desborda, lo único que se desplaza es el panel (la página está
// bloqueada) y la barra mide ESE desplazamiento; si el panel entra entero, sigue
// mostrando la posición de la página, que no se mueve.
function medir() {
  const menuAbierto = document.documentElement.dataset.menuAbierto === 'true';
  const panel = menuAbierto ? document.getElementById(ID_CONTENIDO_MENU) : null;
  if (panel && panel.scrollHeight > panel.clientHeight) {
    return {
      alturaDocumento: panel.scrollHeight,
      alturaVentana: panel.clientHeight,
      scroll: panel.scrollTop,
    };
  }
  return {
    alturaDocumento: document.documentElement.scrollHeight,
    alturaVentana: window.innerHeight,
    scroll: window.scrollY,
  };
}

export default function BarraScroll() {
  const refThumb = useRef(null);

  useEffect(() => {
    let ticking = false;
    let panelEscuchado = null;

    function actualizar() {
      const { alturaDocumento, alturaVentana, scroll } = medir();
      const maxScroll = alturaDocumento - alturaVentana;
      const thumb = refThumb.current;

      if (thumb) {
        if (maxScroll > 0) {
          const alturaThumb = Math.max(
            (alturaVentana / alturaDocumento) * alturaVentana,
            ALTURA_MINIMA_THUMB_PX
          );
          const progreso = scroll / maxScroll;
          const posicionThumb = progreso * (alturaVentana - alturaThumb);
          thumb.style.height = `${alturaThumb}px`;
          thumb.style.transform = `translateY(${posicionThumb}px)`;
          thumb.style.opacity = '';
        }
      }
      ticking = false;
    }

    function pedirActualizacion() {
      if (!ticking) {
        window.requestAnimationFrame(actualizar);
        ticking = true;
      }
    }

    // El panel del menú sólo existe abierto: se engancha su scroll cuando se
    // abre y se suelta cuando se cierra.
    function engancharPanel() {
      panelEscuchado?.removeEventListener('scroll', pedirActualizacion);
      panelEscuchado =
        document.documentElement.dataset.menuAbierto === 'true'
          ? document.getElementById(ID_CONTENIDO_MENU)
          : null;
      panelEscuchado?.addEventListener('scroll', pedirActualizacion, { passive: true });
      actualizar();
    }

    const observador = new MutationObserver(engancharPanel);
    observador.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-menu-abierto'],
    });

    actualizar();
    window.addEventListener('scroll', pedirActualizacion, { passive: true });
    window.addEventListener('resize', pedirActualizacion);
    return () => {
      observador.disconnect();
      panelEscuchado?.removeEventListener('scroll', pedirActualizacion);
      window.removeEventListener('scroll', pedirActualizacion);
      window.removeEventListener('resize', pedirActualizacion);
    };
  }, []);

  return (
    <div className={styles.pista} aria-hidden="true">
      <div ref={refThumb} className={styles.thumb} />
    </div>
  );
}
