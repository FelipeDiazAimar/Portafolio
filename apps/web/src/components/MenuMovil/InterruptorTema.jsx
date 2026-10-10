'use client';

import styles from './InterruptorTema.module.css';

function IconoLuna() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function IconoSol() {
  return (
    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3.6" fill="currentColor" stroke="none" />
      <path d="M12 2.6v2.4M12 19v2.4M2.6 12H5M19 12h2.4M5.35 5.35l1.7 1.7M16.95 16.95l1.7 1.7M5.35 18.65l1.7-1.7M16.95 7.05l1.7-1.7" />
    </svg>
  );
}

// Interruptor de tema del menú lateral. Una pastilla con la palabra del modo
// actual y una perilla de vidrio, más alta que la pastilla, con el ícono. En
// oscuro la perilla va a la derecha (luna) y la palabra a la izquierda; en
// claro se invierte. Muestra el modo ACTUAL, no la acción.
export default function InterruptorTema({ tema, alAlternar }) {
  const oscuro = tema === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={oscuro}
      aria-label="Modo oscuro"
      className={`${styles.pista} ${oscuro ? styles.oscuro : styles.claro}`}
      onClick={alAlternar}
    >
      <span className={`${styles.etiqueta} ${styles.etiquetaOscuro}`} aria-hidden="true">
        Oscuro
      </span>
      <span className={`${styles.etiqueta} ${styles.etiquetaClaro}`} aria-hidden="true">
        Claro
      </span>

      <span className={styles.perilla} aria-hidden="true">
        <span className={`${styles.icono} ${styles.iconoLuna}`}>
          <IconoLuna />
        </span>
        <span className={`${styles.icono} ${styles.iconoSol}`}>
          <IconoSol />
        </span>
      </span>
    </button>
  );
}
