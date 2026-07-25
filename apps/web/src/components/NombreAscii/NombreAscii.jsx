'use client';

import { useEffect, useState } from 'react';
import { useAsciiText, standard } from 'react-ascii-text';
import styles from './NombreAscii.module.css';

const DEMORA_INICIO_MS = 3300;
const DURACION_ANIMACION_MS = 2600;
const CARACTERES_ANIMACION = '/*+#%@$&';

export default function NombreAscii() {
  const [empezar, setEmpezar] = useState(false);
  const [formado, setFormado] = useState(false);

  const refAscii = useAsciiText({
    font: standard,
    text: ['Felipe', 'Diaz Aimar'],
    animationDirection: 'down',
    animationCharacters: CARACTERES_ANIMACION,
    animationSpeed: 25,
    animationLoop: false,
    isPaused: !empezar,
  });

  useEffect(() => {
    const temporizadorInicio = setTimeout(() => setEmpezar(true), DEMORA_INICIO_MS);
    return () => clearTimeout(temporizadorInicio);
  }, []);

  useEffect(() => {
    if (!empezar) return;
    const temporizadorFin = setTimeout(() => setFormado(true), DURACION_ANIMACION_MS);
    return () => clearTimeout(temporizadorFin);
  }, [empezar]);

  return (
    <div className={styles.contenedor}>
      <span className={styles.soloLectura}>Felipe Diaz Aimar</span>

      <pre className={`${styles.ascii} ${formado ? styles.oculto : ''}`} ref={refAscii} aria-hidden="true" />

      <div className={`${styles.textoLimpio} ${formado ? styles.visible : ''}`} aria-hidden="true">
        <span>Felipe</span>
        <span>Diaz Aimar</span>
      </div>

      <div className={`${styles.franja} ${styles.franjaSuperior} ${formado ? styles.encogida : ''}`} />
      <div className={`${styles.franja} ${styles.franjaInferior} ${formado ? styles.encogida : ''}`} />
    </div>
  );
}
