'use client';

import { useState } from 'react';
import { marcaDe } from '@/data/marcas.js';
import { ImagenCarga } from '@/components/Esqueleto/Esqueleto.jsx';
import styles from './TarjetaMarca.module.css';

// La tarjeta de un proyecto: su logo real sobre su fondo o, si no tiene, el nombre en
// tipografía sobre un degradé de su color. Todo se mide en unidades del contenedor
// (cqw): la misma tarjeta sirve chica en la marquesina y a pantalla completa.
export default function TarjetaMarca({ proyecto, grande = false, className = '' }) {
  const marca = marcaDe(proyecto.slug);
  // skeleton propio de la tarjeta hasta que llega su logo (si falla, queda el nombre y se va el esqueleto)
  // (arranca como lista: en el HTML del servidor no hay skeleton; ImagenCarga avisa si el logo todavía no llegó)
  const [logoListo, setLogoListo] = useState(true);
  const esperaLogo = Boolean(marca.logo) && !logoListo;
  const estilo = { '--color': proyecto.color, ...(marca.fondo ? { '--fondo': marca.fondo } : null) };
  return (
    <div
      className={`${styles.tarjeta} ${grande ? styles.grande : ''} ${className}`.trim()}
      style={estilo}
      data-claro={marca.claro ? 'true' : 'false'}
      data-con-logo={marca.logo ? 'true' : 'false'}
    >
      <div className={styles.brillo} aria-hidden="true" />
      <div className={styles.contenido}>
        {marca.logo ? (
          <ImagenCarga
            className={`${styles.logo} ${esperaLogo ? styles.logoEspera : ''}`}
            src={marca.logo}
            alt=""
            draggable={false}
            alEsperar={() => setLogoListo(false)}
            onLoad={() => setLogoListo(true)}
            onError={() => setLogoListo(true)}
          />
        ) : null}
        {esperaLogo ? (
          <div className={styles.esqueleto} aria-hidden="true">
            <span className={styles.esqLogo} />
            <span className={styles.esqLinea} />
          </div>
        ) : null}
        {marca.nombre ? (
          <div className={styles.nombre}>
            <span className={styles.palabra}>{marca.nombre}</span>
            {marca.bajada ? <span className={styles.bajada}>{marca.bajada}</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
