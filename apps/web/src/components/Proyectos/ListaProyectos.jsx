'use client';

import { useEffect, useRef } from 'react';
import { indicePorTecla } from '../../lib/navegacionProyectos.js';
import styles from './PresentadorProyectos.module.css';

// Columna izquierda de pestañas: número + título por proyecto.
// El hover con mouse activa con 120 ms de intención, el click y el foco
// activan al instante y las flechas navegan con indicePorTecla.
export default function ListaProyectos({ proyectos, activo, onCambiar }) {
  const total = proyectos.length;
  const tabsRef = useRef([]);
  const demoraRef = useRef(null);

  // Limpia el timeout de intención al desmontar.
  useEffect(() => () => clearTimeout(demoraRef.current), []);

  // Mantiene visible el tab activo al cambiar de proyecto.
  useEffect(() => {
    tabsRef.current[activo]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activo]);

  const programarActivacion = (i) => {
    clearTimeout(demoraRef.current);
    demoraRef.current = setTimeout(() => onCambiar(i), 120);
  };

  const cancelarActivacion = () => clearTimeout(demoraRef.current);

  const alTeclar = (e) => {
    const siguiente = indicePorTecla(e.key, activo, total);
    if (siguiente === null) return;
    e.preventDefault();
    if (siguiente !== activo) onCambiar(siguiente);
    tabsRef.current[siguiente]?.focus();
  };

  return (
    <div className={styles.lista} role="tablist" aria-orientation="vertical" aria-label="Proyectos">
      {proyectos.map((proyecto, i) => {
        const esActivo = i === activo;
        return (
          <button
            key={proyecto.slug}
            ref={(el) => {
              tabsRef.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={esActivo}
            aria-controls="panel-proyecto"
            id={`tab-${proyecto.slug}`}
            className={esActivo ? `${styles.item} ${styles.itemActivo}` : styles.item}
            onPointerEnter={(e) => {
              if (e.pointerType === 'mouse') programarActivacion(i);
            }}
            onPointerLeave={cancelarActivacion}
            onClick={() => onCambiar(i)}
            onFocus={() => onCambiar(i)}
            onKeyDown={alTeclar}
          >
            <span className={styles.numero}>{String(i + 1).padStart(2, '0')}</span>
            <span className={styles.tituloFila}>
              <span className={styles.tituloItem}>{proyecto.titulo}</span>
              {esActivo && (
                <svg
                  className={styles.flecha}
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
    </div>
  );
}
