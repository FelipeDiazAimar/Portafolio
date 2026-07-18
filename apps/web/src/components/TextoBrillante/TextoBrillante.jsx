'use client';

import styles from './TextoBrillante.module.css';

export default function TextoBrillante({ texto }) {
  return (
    <span className={styles.contenedor}>
      <span className={styles.base}>{texto}</span>
      <span className={styles.brillo} aria-hidden="true">{texto}</span>
    </span>
  );
}
