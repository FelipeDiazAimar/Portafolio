'use client';

// Remate del footer: una frase grande que se revela letra por letra con el scroll (y se desarma al
// subir), y al lado el mapa de dónde estoy. Sin texto que contar: es el último momento del scroll.
import { useEffect, useRef, useState } from 'react';
import MapaUbicacion from './MapaUbicacion.jsx';
import FraseVidrio, { avanceCierre } from './FraseVidrio.jsx';
import { alCuadro } from '@/lib/movimiento.js';
import styles from './CierreFooter.module.css';

const LINEAS = [['Gracias'], ['por', 'pasar']];
const TOTAL_LETRAS = LINEAS.flat().join('').length + 1; // + el punto

export default function CierreFooter() {
  const refCierre = useRef(null);
  const refVidrio = useRef(null);
  const refFrase = useRef(null);
  // 'css' = texto de siempre; '3d' = metal pulido en WebGL (sólo con mouse y pantalla ancha).
  const [modo, setModo] = useState('css');

  // --avance (0..1) en el cierre: cada letra calcula su parte en CSS
  useEffect(() => {
    const nodo = refCierre.current;
    const vidrio = refVidrio.current;
    if (!nodo || !vidrio) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      nodo.style.setProperty('--avance', '1');
      return undefined;
    }
    let ultimo = -1;
    const poner = () => {
      const v = Math.round(avanceCierre(vidrio) * 1000) / 1000;
      if (v !== ultimo) {
        ultimo = v;
        nodo.style.setProperty('--avance', String(v));
      }
    };
    poner();
    return alCuadro(poner);
  }, []);

  let indice = 0;
  return (
    <div ref={refCierre} className={styles.cierre} style={{ '--n': TOTAL_LETRAS }}>
      <div ref={refVidrio} className={styles.vidrio} data-modo={modo}>
      <p ref={refFrase} className={styles.frase} aria-label="Gracias por pasar.">
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
      <FraseVidrio hostRef={refVidrio} fraseRef={refFrase} onEstado={setModo} />
      </div>
      <MapaUbicacion />
    </div>
  );
}
