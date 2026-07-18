'use client';

import { useEffect, useState } from 'react';
import { GlassSurface } from '@portafolio/ui';
import useScrollPasadoViewport from '@/hooks/useScrollPasadoViewport.js';
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

function readStoredTheme() {
  try {
    return window.localStorage.getItem('theme');
  } catch {
    return null;
  }
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState('dark');
  const pasado = useScrollPasadoViewport();
  const visible = !pasado;

  useEffect(() => {
    const stored = readStoredTheme();
    const mql = window.matchMedia('(prefers-color-scheme: light)');

    setTheme(stored === 'light' || stored === 'dark' ? stored : mql.matches ? 'light' : 'dark');

    function handleSystemChange(event) {
      const current = readStoredTheme();
      if (current !== 'light' && current !== 'dark') {
        setTheme(event.matches ? 'light' : 'dark');
      }
    }

    mql.addEventListener('change', handleSystemChange);
    return () => mql.removeEventListener('change', handleSystemChange);
  }, []);

  function handleToggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      window.localStorage.setItem('theme', next);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className={styles.wrapper} data-visible={visible}>
      <GlassSurface
        width={80}
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
          <span className={styles.pista} aria-hidden="true" />
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
