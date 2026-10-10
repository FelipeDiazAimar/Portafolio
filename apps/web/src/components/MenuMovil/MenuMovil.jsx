'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ListaLineas from '@/components/ListaLineas/ListaLineas.jsx';
import useTema from '@/hooks/useTema.js';
import styles from './MenuMovil.module.css';

// Mismo punto de corte que oculta las píldoras del header (Header.module.css).
const CONSULTA_ESCRITORIO = '(min-width: 769px)';

function IconoLuna() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function IconoSol() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

// Botón de hamburguesa + panel lateral derecho con la navegación. Es hijo del
// grid del <header>, así que queda centrado con el logo por estructura y no por
// números mágicos. Sólo existe en pantallas angostas (en las anchas están las
// píldoras de vidrio).
export default function MenuMovil({ enlaces }) {
  const [abierto, setAbierto] = useState(false);
  const refBoton = useRef(null);
  const refPanel = useRef(null);
  const { tema, alternar } = useTema();

  const cerrar = useCallback((devolverFoco = true) => {
    setAbierto(false);
    if (devolverFoco) refBoton.current?.focus();
  }, []);

  // Con el panel abierto la página de atrás no se desplaza, y Escape cierra.
  useEffect(() => {
    if (!abierto) return undefined;

    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function alPresionarTecla(evento) {
      if (evento.key === 'Escape') cerrar();
    }
    document.addEventListener('keydown', alPresionarTecla);

    // Si la pantalla se agranda con el panel abierto (girar la tablet), se
    // cierra: el botón desaparece y quedaría un panel sin forma de cerrarlo.
    const consulta = window.matchMedia(CONSULTA_ESCRITORIO);
    function alCambiarAncho(evento) {
      if (evento.matches) cerrar(false);
    }
    consulta.addEventListener('change', alCambiarAncho);

    // Foco en el primer enlace, ya con el panel entrando.
    const temporizador = setTimeout(() => refPanel.current?.querySelector('a')?.focus(), 80);

    return () => {
      document.body.style.overflow = overflowPrevio;
      document.removeEventListener('keydown', alPresionarTecla);
      consulta.removeEventListener('change', alCambiarAncho);
      clearTimeout(temporizador);
    };
  }, [abierto, cerrar]);

  function alElegir(indice, item, evento) {
    evento.preventDefault();
    setAbierto(false);
    // Recién en el cuadro siguiente: con `overflow: hidden` todavía puesto el
    // scroll suave del ancla no se mueve.
    requestAnimationFrame(() => {
      document.querySelector(item.href)?.scrollIntoView({ behavior: 'smooth' });
      window.history.replaceState(null, '', item.href);
    });
  }

  return (
    <div className={styles.raiz}>
      <button
        ref={refBoton}
        type="button"
        className={`${styles.boton} ${abierto ? styles.abierto : ''}`}
        aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={abierto}
        aria-controls="menu-movil"
        onClick={() => setAbierto((valor) => !valor)}
      >
        <span className={styles.icono} aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </span>
      </button>

      <div
        className={`${styles.fondo} ${abierto ? styles.fondoVisible : ''}`}
        onClick={() => cerrar()}
        aria-hidden="true"
      />

      <aside
        id="menu-movil"
        ref={refPanel}
        className={`${styles.panel} ${abierto ? styles.panelAbierto : ''}`}
        aria-label="Navegación"
        inert={!abierto}
      >
        <ListaLineas
          items={enlaces.map((enlace) => ({ label: enlace.label, href: enlace.href }))}
          colorAcento="var(--color-accent)"
          colorTexto="var(--color-fg)"
          colorMarcador="var(--color-muted)"
          largoMarcador={34}
          desplazamientoMaximo={18}
          radioProximidad={90}
          separacionItems={26}
          tamanoFuente={1.45}
          suavizado={110}
          alElegir={alElegir}
        />

        <button type="button" className={styles.tema} onClick={alternar}>
          {tema === 'dark' ? <IconoSol /> : <IconoLuna />}
          <span>{tema === 'dark' ? 'Tema claro' : 'Tema oscuro'}</span>
        </button>
      </aside>
    </div>
  );
}
