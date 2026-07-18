'use client';

import styles from './TextoRodante.module.css';

const REPETICIONES = 4;
const DEMORA_POR_LETRA_MS = 40;

export default function TextoRodante({ texto, demoraInicial = 0 }) {
  const letras = texto.split('');

  return (
    <span className={styles.contenedor} aria-label={texto}>
      {letras.map((letra, indice) =>
        letra === ' ' ? (
          <span key={indice} className={styles.espacio} aria-hidden="true" />
        ) : (
          <span key={indice} className={styles.ventana} aria-hidden="true">
            <span
              className={styles.columna}
              style={{ animationDelay: `${demoraInicial + indice * DEMORA_POR_LETRA_MS}ms` }}
            >
              {Array.from({ length: REPETICIONES }, (_, copia) => (
                <span key={copia} className={styles.letra}>
                  {letra}
                </span>
              ))}
            </span>
          </span>
        )
      )}
    </span>
  );
}
