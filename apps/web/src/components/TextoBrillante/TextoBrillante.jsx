'use client';

import styles from './TextoBrillante.module.css';

export default function TextoBrillante({ texto }) {
  return <span className={styles.texto}>{texto}</span>;
}
