'use client';

import { useEffect, useState } from 'react';
import { alCambiarTeletransporte, cantidadDeSaltos, confirmarVistaPrevia } from '@/lib/teletransporte.js';
import styles from './Teletransporte.module.css';

// Efecto del salto entre secciones: un velo que cubre la pantalla justo en el momento del corte y
// se disuelve (desenfoque + fundido) revelando la sección de destino, como al aparecer en otro
// lugar. Además escucha la rueda y el toque: si el usuario empieza a desplazarse durante una
// vista previa, se queda donde está.
export default function Teletransporte() {
  const [salto, setSalto] = useState({ n: 0, rapido: false });

  useEffect(() => {
    return alCambiarTeletransporte(() => {
      const n = cantidadDeSaltos();
      setSalto((previo) =>
        previo.n === n ? previo : { n, rapido: document.documentElement.dataset.saltoRapido === 'true' }
      );
    });
  }, []);

  useEffect(() => {
    window.addEventListener('wheel', confirmarVistaPrevia, { passive: true });
    window.addEventListener('touchstart', confirmarVistaPrevia, { passive: true });
    window.addEventListener('keydown', confirmarVistaPrevia);
    return () => {
      window.removeEventListener('wheel', confirmarVistaPrevia);
      window.removeEventListener('touchstart', confirmarVistaPrevia);
      window.removeEventListener('keydown', confirmarVistaPrevia);
    };
  }, []);

  if (salto.n === 0) return null;
  return <div key={salto.n} className={`${styles.velo} ${salto.rapido ? styles.rapido : ''}`} aria-hidden="true" />;
}
