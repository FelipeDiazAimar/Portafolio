'use client';

import { useState } from 'react';
import Image from 'next/image';
import styles from './FondoHito.module.css';

// Todas las imágenes quedan montadas y sólo cambia la opacidad: así el cambio
// de hito es un crossfade y no una carga. Una imagen que no existe se omite
// en vez de dejar el ícono de imagen rota.
export default function FondoHito({ hitos, activo }) {
  const [fallidas, setFallidas] = useState({});

  return (
    <div className={styles.fondo} aria-hidden="true">
      {hitos.map((hito, i) =>
        fallidas[hito.id] ? null : (
          <div key={hito.id} className={`${styles.capa} ${i === activo ? styles.activa : ''}`}>
            <Image
              src={hito.imagen}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 62vw"
              loading="eager"
              className={styles.imagen}
              onError={() => setFallidas((previas) => ({ ...previas, [hito.id]: true }))}
            />
          </div>
        )
      )}
    </div>
  );
}
