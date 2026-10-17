'use client';

import { useRef } from 'react';
import { GlassSurface } from '@portafolio/ui';
import useTema from '@/hooks/useTema.js';
import styles from './ThemeToggle.module.css';

function IconMoon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function IconSun() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

export default function ThemeToggle() {
  const { tema: theme, alternar: handleToggle } = useTema();
  const refToggle = useRef(null);

  function manejarMovimientoRaton(evento) {
    const contenedor = refToggle.current;
    if (!contenedor) return;
    const rect = contenedor.getBoundingClientRect();
    contenedor.style.setProperty('--raton-x', `${evento.clientX - rect.left}px`);
    contenedor.style.setProperty('--raton-y', `${evento.clientY - rect.top}px`);
  }

  return (
    <div
      ref={refToggle}
      className={styles.wrapper}
      onMouseMove={manejarMovimientoRaton}
    >
      <GlassSurface
        width={64}
        height={40}
        borderRadius={100}
        className={styles.track}
        opacity={0.9}
        brightness={45}
        blur={14}
        backgroundOpacity={0.12}
        saturation={1.4}
        distortionScale={-140}
        redOffset={0}
        greenOffset={6}
        blueOffset={14}
        displace={0.2}
      >
        <button
          type="button"
          className={styles.button}
          onClick={handleToggle}
          aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
        >
          <span className={`${styles.icon} ${theme === 'dark' ? styles.iconActive : ''}`}>
            <IconMoon />
          </span>
          <span className={`${styles.icon} ${theme === 'light' ? styles.iconActive : ''}`}>
            <IconSun />
          </span>
          <span className={`${styles.thumb} ${theme === 'light' ? styles.thumbLight : ''}`} />
        </button>
      </GlassSurface>
    </div>
  );
}
