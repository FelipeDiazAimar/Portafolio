'use client';

import styles from './LineaTiempo.module.css';

// Cinta vertical: todos los puntos están en la misma columna y se trasladan
// para que el activo quede siempre en el centro (`--d` es la distancia, con
// signo, al activo). Los vecinos se atenúan y los lejanos desaparecen.
export default function LineaTiempo({ hitos, activo, onSeleccionar, onApuntarActivo, onToqueHilo }) {
  return (
    <nav className={styles.linea} aria-label="Línea de tiempo">
      <span className={styles.hiloPasado} aria-hidden="true" onClick={onToqueHilo} />
      <span className={styles.hiloFuturo} aria-hidden="true" onClick={onToqueHilo} />
      <ul className={styles.lista}>
        {hitos.map((hito, i) => {
          const distancia = Math.abs(i - activo);
          const esActivo = i === activo;
          return (
            <li
              key={hito.id}
              className={styles.item}
              style={{ '--d': i - activo }}
              data-distancia={Math.min(distancia, 3)}
            >
              <button
                type="button"
                className={`${styles.boton} ${esActivo ? styles.activo : ''}`}
                aria-current={esActivo ? 'step' : undefined}
                tabIndex={distancia > 2 ? -1 : 0}
                onClick={(evento) => {
                  evento.stopPropagation();
                  onSeleccionar(i);
                }}
                onPointerEnter={(evento) => {
                  if (esActivo && evento.pointerType === 'mouse') onApuntarActivo(true);
                }}
                onPointerLeave={(evento) => {
                  if (evento.pointerType === 'mouse') onApuntarActivo(false);
                }}
                onFocus={() => {
                  if (esActivo) onApuntarActivo(true);
                }}
                onBlur={() => onApuntarActivo(false)}
              >
                <span className={styles.rotulo}>
                  <span className={styles.anio}>{hito.anio}</span>
                  <span className={styles.nombre}>{hito.titulo}</span>
                </span>
                <span className={styles.punto} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
