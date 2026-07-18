'use client';

import styles from './TextoBrillante.module.css';

export default function TextoBrillante({ texto, activo = true }) {
  return (
    <span className={`${styles.texto} ${activo ? styles.brillante : ''}`}>{texto}</span>
  );
}
