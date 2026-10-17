'use client';

import { useEffect, useRef } from 'react';
import styles from './NavegacionMixta.module.css';

// Navegación mixta: número + título serif + flecha → en el activo.
// El hover con mouse activa con 120 ms de intención, el click y el foco
// activan al instante. El padre (Mixto) posiciona este nav.
export default function NavegacionMixta({ proyectos = [], activoSlug, alElegir, alSalir, navRef, alScrollear }) {
  const demoraRef = useRef(null);

  // Limpia el timeout de intención al desmontar.
  useEffect(() => () => clearTimeout(demoraRef.current), []);

  const programarEleccion = (slug) => {
    clearTimeout(demoraRef.current);
    demoraRef.current = setTimeout(() => alElegir(slug), 120);
  };

  const cancelarEleccion = () => clearTimeout(demoraRef.current);

  return (
    <nav
      className={styles.nav}
      aria-label="Proyectos"
      data-zona-mixto="nav"
      ref={navRef}
      onPointerLeave={alSalir}
      onScroll={alScrollear ? (e) => alScrollear(e.currentTarget.scrollTop > 2) : undefined}
    >
      {proyectos.map((proyecto, i) => {
        const esActivo = proyecto.slug === activoSlug;
        return (
          <button
            key={proyecto.slug}
            type="button"
            id={`nav-${proyecto.slug}`}
            data-slug={proyecto.slug}
            aria-current={esActivo ? 'true' : undefined}
            className={esActivo ? `${styles.item} ${styles.activo}` : styles.item}
            onPointerEnter={(e) => {
              if (e.pointerType === 'mouse') programarEleccion(proyecto.slug);
            }}
            onPointerLeave={cancelarEleccion}
            onClick={() => alElegir(proyecto.slug)}
            onFocus={() => alElegir(proyecto.slug)}
          >
            <span className={styles.numero}>{String(i + 1).padStart(2, '0')}</span>
            <span className={styles.tituloFila}>
              <span className={styles.titulo}>{proyecto.titulo}</span>
              {/* La flecha siempre ocupa su lugar (invisible si no es el activo): así el nombre no
                  cambia de ancho ni de renglones al apuntarlo. */}
              {(
                <svg
                  className={styles.flecha}
                  style={{ visibility: esActivo ? 'visible' : 'hidden' }}
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  aria-hidden="true"
                >
                  <path
                    d="M4 12h15M13 6l6 6-6 6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
