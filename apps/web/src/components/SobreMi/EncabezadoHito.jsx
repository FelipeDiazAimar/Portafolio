'use client';

import TextoDescifrado from '@/components/TextoDescifrado/TextoDescifrado.jsx';
import styles from './EncabezadoHito.module.css';

const CARACTERES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=<>/\\|';

// Año y título del hito activo. `key` por hito remonta el texto y por eso
// se vuelve a descifrar cada vez que cambia el hito.
export default function EncabezadoHito({ hito }) {
  return (
    <header className={styles.encabezado}>
      <p className={styles.anio}>
        <TextoDescifrado
          key={`anio-${hito.id}`}
          texto={hito.anio}
          activarCon="view"
          secuencial
          velocidad={45}
          caracteres={CARACTERES}
          className={styles.revelado}
          encryptedClassName={styles.encriptado}
        />
      </p>
      <h3 className={styles.titulo}>
        <TextoDescifrado
          key={`titulo-${hito.id}`}
          texto={hito.titulo}
          activarCon="view"
          secuencial
          velocidad={30}
          caracteres={CARACTERES}
          className={styles.revelado}
          encryptedClassName={styles.encriptado}
        />
      </h3>
      <p className={styles.resumen}>{hito.resumen}</p>
    </header>
  );
}
