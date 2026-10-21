'use client';

// Remate del footer: una frase grande que se revela letra por letra al llegar, y al lado el mapa
// de dónde estoy. Sin texto que contar: es el último momento del scroll.
import { useEffect, useRef, useState } from 'react';
import MapaUbicacion from './MapaUbicacion.jsx';
import styles from './CierreFooter.module.css';

const LINEAS = [['Gracias'], ['por', 'pasar']];

export default function CierreFooter() {
  const refCierre = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const nodo = refCierre.current;
    if (!nodo) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return undefined;
    }
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          setVisible(true);
          observador.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  let indice = 0;
  return (
    <div ref={refCierre} className={`${styles.cierre} ${visible ? styles.visible : ''}`}>
      <p className={styles.frase} aria-label="Gracias por pasar.">
        {LINEAS.map((palabras, l) => (
          <span key={l} className={`${styles.linea} ${l === 1 ? styles.segunda : ''}`} aria-hidden="true">
            {palabras.map((palabra, p) => (
              <span key={p} className={styles.palabra}>
                {[...palabra].map((letra, i) => (
                  <span key={i} className={styles.letra} style={{ '--i': indice++ }}>
                    {letra}
                  </span>
                ))}
              </span>
            ))}
            {l === LINEAS.length - 1 && (
              <span className={`${styles.letra} ${styles.punto}`} style={{ '--i': indice++ }}>
                .
              </span>
            )}
          </span>
        ))}
      </p>
      <MapaUbicacion />
    </div>
  );
}
