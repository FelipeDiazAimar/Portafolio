'use client';

import { useEffect, useRef } from 'react';
import styles from './BarraScroll.module.css';

// Pista corta y centrada: el thumb tiene altura fija y recorre la pista.
const ALTURA_PISTA_PX = 180;
const ALTURA_THUMB_PX = 36;
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
  const refPista = useRef(null);
  const arrastre = useRef(null); // { desfase } mientras el thumb está agarrado

  // Posición de scroll de la página a la que corresponde un punto de la pista.
  // `desfase` es dónde, dentro del thumb, se lo agarró (centro si se toca la pista).
  function destinoDesdePuntero(clientY, desfase) {
    const caja = refPista.current.getBoundingClientRect();
    const recorrido = ALTURA_PISTA_PX - ALTURA_THUMB_PX;
    const progreso = Math.min(1, Math.max(0, (clientY - caja.top - desfase) / recorrido));
    const { alturaDocumento, alturaVentana } = medir();
    return progreso * (alturaDocumento - alturaVentana);
  }

  function alPresionar(e) {
    if (e.button !== undefined && e.button !== 0) return;
    const caja = refThumb.current.getBoundingClientRect();
    const sobreThumb = e.clientY >= caja.top && e.clientY <= caja.bottom;
    refPista.current.setPointerCapture(e.pointerId);
    if (sobreThumb) {
      arrastre.current = { desfase: e.clientY - caja.top };
      refPista.current.dataset.agarrada = 'true';
    } else {
      // tocar la pista lleva hasta ahí con el mismo scroll suave del sitio
      window.scrollTo({
        top: destinoDesdePuntero(e.clientY, ALTURA_THUMB_PX / 2),
        behavior: 'smooth',
      });
    }
  }

  function alMover(e) {
    if (!arrastre.current) return;
    window.scrollTo(0, destinoDesdePuntero(e.clientY, arrastre.current.desfase));
  }

  function alSoltar() {
    arrastre.current = null;
    delete refPista.current.dataset.agarrada;
  }

  useEffect(() => {
    let ticking = false;
    let panelEscuchado = null;

    function actualizar() {
      const { alturaDocumento, alturaVentana, scroll } = medir();
      const maxScroll = alturaDocumento - alturaVentana;
      const thumb = refThumb.current;

      if (thumb) {
        if (maxScroll > 0) {
          const progreso = scroll / maxScroll;
          const posicionThumb = progreso * (ALTURA_PISTA_PX - ALTURA_THUMB_PX);
          thumb.style.height = `${ALTURA_THUMB_PX}px`;
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
    <div
      ref={refPista}
      className={styles.pista}
      aria-hidden="true"
      onPointerDown={alPresionar}
      onPointerMove={alMover}
      onPointerUp={alSoltar}
      onPointerCancel={alSoltar}
    >
      <div ref={refThumb} className={styles.thumb} />
    </div>
  );
}
