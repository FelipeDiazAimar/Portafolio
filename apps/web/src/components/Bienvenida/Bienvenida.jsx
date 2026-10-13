'use client';

import { useEffect, useState } from 'react';
import styles from './Bienvenida.module.css';

const EXIT_DELAY_MS = 2600;
const UNMOUNT_DELAY_MS = 3200;

const COPY = {
  es: {
    ariaLabel: 'Cargando',
    line1: 'Bienvenido a mi',
    line2: 'Portfolio Web',
  },
  en: {
    ariaLabel: 'Loading',
    line1: 'Welcome to my',
    line2: 'Portfolio Website',
  },
};

function IconCode() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function IconDatabase() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
      <path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" />
    </svg>
  );
}

function IconRocket() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

export default function Bienvenida({ locale = 'es' }) {
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);
  const t = COPY[locale] ?? COPY.es;

  useEffect(() => {
    // En una recarga no hay splash: se deja que el navegador restaure solo el
    // scroll (la sección Sobre mí retoma su hito con el progreso guardado). En
    // primera visita sí se fuerza el inicio arriba para que el splash arranque
    // centrado (si quedara scroll anterior, el inicio aparecería corrido).
    const recarga = performance.getEntriesByType('navigation')[0]?.type === 'reload';
    if (recarga) {
      setVisible(false);
      return undefined;
    }
    // El navegador restaura solo la posición de scroll que tenía la página
    // en un F5 (no es un bug nuestro, es scrollRestoration = 'auto' por
    // defecto): si quedó algo de scroll de una visita anterior, la sección
    // de inicio aparece corrida en vez de arrancar centrada.
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);

    const exitTimer = setTimeout(() => setExiting(true), EXIT_DELAY_MS);
    const unmountTimer = setTimeout(() => setVisible(false), UNMOUNT_DELAY_MS);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(unmountTimer);
    };
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div
      className={`${styles.splash} ${exiting ? styles.exiting : ''}`}
      role="status"
      aria-label={t.ariaLabel}
    >
      <div className={styles.icons}>
        <span className={`${styles.icon} ${styles.icon1}`}>
          <IconCode />
        </span>
        <span className={`${styles.icon} ${styles.icon2}`}>
          <IconDatabase />
        </span>
        <span className={`${styles.icon} ${styles.icon3}`}>
          <IconRocket />
        </span>
      </div>

      <div className={styles.textBlock}>
        <div className={styles.lineMask}>
          <span className={`${styles.line} ${styles.line1}`}>{t.line1}</span>
        </div>
        <div className={styles.lineMask}>
          <span className={`${styles.line} ${styles.line2}`}>{t.line2}</span>
        </div>
      </div>

      <div className={styles.linkMask}>
        <a
          className={styles.link}
          href="https://github.com/FelipeDiazAimar"
          target="_blank"
          rel="noopener noreferrer"
        >
          github.com/FelipeDiazAimar
        </a>
      </div>
    </div>
  );
}
