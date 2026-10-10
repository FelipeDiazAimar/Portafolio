'use client';

import { useEffect, useRef, useState } from 'react';
import useDestelloAleatorio from '@/hooks/useDestelloAleatorio.js';
import destello from '@/styles/destello.module.css';
import styles from './SubtituloHero.module.css';

// Ruido de código: encaja con el logo `</>` y con los caracteres del nombre.
const GLIFOS = '01<>/{}[]=+*#$%&';
const TIC_MS = 40;
// Cada letra arranca esta cantidad de tics después de la anterior, y hace
// ruido durante `TICS_DE_RUIDO` antes de fijarse en su valor real.
const TICS_ENTRE_LETRAS = 1.4;
const TICS_DE_RUIDO = 5;

function glifoAlAzar() {
  return GLIFOS[Math.floor(Math.random() * GLIFOS.length)];
}

// Línea de terminal bajo el nombre: el texto se escribe de izquierda a
// derecha y cada letra "se descifra" antes de fijarse. `visible` sólo controla
// la opacidad: la animación corre una única vez, la primera vez que se ve.
export default function SubtituloHero({ texto, visible, demoraMs = 400 }) {
  const [mostrado, setMostrado] = useState('');
  const [arranco, setArranco] = useState(false);
  const refTexto = useRef(null);

  useEffect(() => {
    if (visible) setArranco(true);
  }, [visible]);

  useEffect(() => {
    if (!arranco) return undefined;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setMostrado(texto);
      return undefined;
    }

    let intervalo = 0;
    const inicio = setTimeout(() => {
      let tic = 0;
      intervalo = setInterval(() => {
        tic += 1;
        let resultado = '';
        let terminadas = 0;
        for (let i = 0; i < texto.length; i += 1) {
          const arranque = i * TICS_ENTRE_LETRAS;
          if (tic < arranque) break;
          if (texto[i] === ' ' || tic >= arranque + TICS_DE_RUIDO) {
            resultado += texto[i];
            terminadas += 1;
          } else {
            resultado += glifoAlAzar();
          }
        }
        setMostrado(resultado);
        if (terminadas === texto.length) clearInterval(intervalo);
      }, TIC_MS);
    }, demoraMs);

    return () => {
      clearTimeout(inicio);
      clearInterval(intervalo);
    };
  }, [arranco, texto, demoraMs]);

  // Cada tanto un halo luminoso recorre el texto, una vez que ya se escribió
  // entero (no tiene sentido iluminar letras que todavía son ruido).
  useDestelloAleatorio({
    nodos: () => [refTexto.current],
    activo: visible && mostrado === texto,
    clase: `${destello.texto} ${styles.conHalo}`,
    minMs: 5000,
    maxMs: 10000,
  });

  return (
    <p className={`${styles.linea} ${visible ? styles.visible : ''}`} aria-hidden="true">
      <span className={styles.prompt}>›</span>
      <span className={styles.texto} ref={refTexto}>
        {mostrado}
      </span>
      <span className={styles.cursor} />
    </p>
  );
}
