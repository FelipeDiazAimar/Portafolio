'use client';

import { useEffect, useState } from 'react';
import styles from './TextoTipeado.module.css';

const MS_BASE_POR_LETRA = 22;
const MS_AZAR_POR_LETRA = 30;
// Una pausa tras la puntuación hace que se lea como alguien que escribe.
const MS_PAUSA_PUNTUACION = 170;

// Texto que se escribe solo, letra a letra, la primera vez que `visible` es
// true. El texto completo ocupa su lugar desde el principio (las letras
// pendientes son invisibles, no inexistentes): así el bloque no crece ni
// salta a medida que se escribe, aunque el párrafo ocupe varias líneas.
export default function TextoTipeado({ texto, visible, demoraMs = 0, className = '' }) {
  const [escritas, setEscritas] = useState(0);
  const [arranco, setArranco] = useState(false);

  useEffect(() => {
    if (visible) setArranco(true);
  }, [visible]);

  useEffect(() => {
    if (!arranco) return undefined;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setEscritas(texto.length);
      return undefined;
    }

    let temporizador = 0;
    let cantidad = 0;

    function escribirSiguiente() {
      cantidad += 1;
      setEscritas(cantidad);
      if (cantidad >= texto.length) return;
      const anterior = texto[cantidad - 1];
      const pausa = /[.,;:]/.test(anterior) ? MS_PAUSA_PUNTUACION : 0;
      temporizador = setTimeout(
        escribirSiguiente,
        MS_BASE_POR_LETRA + Math.random() * MS_AZAR_POR_LETRA + pausa
      );
    }

    temporizador = setTimeout(escribirSiguiente, demoraMs);
    return () => clearTimeout(temporizador);
  }, [arranco, texto, demoraMs]);

  const escribiendo = arranco && escritas < texto.length;

  return (
    <p
      className={`${styles.texto} ${visible ? styles.visible : ''} ${className}`}
      aria-hidden="true"
    >
      <span>{texto.slice(0, escritas)}</span>
      {escribiendo && <span className={styles.cursor} />}
      <span className={styles.pendiente}>{texto.slice(escritas)}</span>
    </p>
  );
}
