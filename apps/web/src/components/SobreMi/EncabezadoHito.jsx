'use client';

import TextoTipeado from './TextoTipeado.jsx';
import TextoDescifrado from '@/components/TextoDescifrado/TextoDescifrado.jsx';
import TextoTrazo from '@/components/TextoTrazo/TextoTrazo.jsx';
import styles from './EncabezadoHito.module.css';

const CARACTERES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=<>/\\|';

// Año y título del hito activo. `key` por hito remonta el texto y por eso
// se vuelve a descifrar cada vez que cambia el hito.
export default function EncabezadoHito({ hito }) {
  return (
    <header className={styles.encabezado}>
      <p className={styles.anio}>
        {/* El año se traza y se rellena (StrokeFill); `key` por hito lo repite en cada uno. */}
        <TextoTrazo key={`anio-${hito.id}`} texto={hito.anio} claseTexto={styles.anioTrazo} duracion={2} grosor={2} />
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
      <p className={styles.resumen}>
        <TextoTipeado key={`resumen-${hito.id}`} texto={hito.resumen} velocidad={26} retraso={700} />
      </p>
    </header>
  );
}
