'use client';

import { useMotionValueEvent } from 'framer-motion';
import { useRef } from 'react';
import { anioEnViaje, opacidadAnio, tramoDe } from '@/lib/columna/recorrido.js';
import styles from './AnioViaje.module.css';

// El año enorme que cuenta durante el viaje (2022… 2023). Decorativo: el año real está
// en el encabezado del hito y en el minimapa.
export default function AnioViaje({ hitos, progreso, oculto }) {
  const ref = useRef(null);
  useMotionValueEvent(progreso, 'change', (p) => {
    const elemento = ref.current;
    if (!elemento) return;
    const tramo = tramoDe(p, hitos.length);
    if (oculto || tramo.tipo !== 'viaje') {
      elemento.style.opacity = '0';
      return;
    }
    elemento.textContent = anioEnViaje(hitos[tramo.indice].anio, hitos[tramo.indice + 1].anio, tramo.t);
    elemento.style.opacity = String(opacidadAnio(tramo.t));
  });
  return <p ref={ref} className={styles.anio} style={{ opacity: 0 }} aria-hidden="true" />;
}
