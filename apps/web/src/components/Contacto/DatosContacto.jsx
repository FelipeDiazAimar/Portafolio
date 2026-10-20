'use client';

// Datos de contacto copiables uno a uno (footer).
import { DATOS_CONTACTO } from '@/data/contacto.js';
import { ICONOS_CONTACTO } from './iconos.jsx';
import useCopiar from './useCopiar.js';
import styles from './DatosContacto.module.css';

export default function DatosContacto() {
  const { copiar, texto, copiando } = useCopiar();
  return (
    <div className={styles.datos}>
      <div className={styles.marca}>
        <b>Felipe Díaz Aimar</b>
        <span>Desarrollador Full Stack · San Francisco, Córdoba, Argentina</span>
      </div>
      <ul className={styles.lista}>
        {DATOS_CONTACTO.map((dato) => {
          const Icono = ICONOS_CONTACTO[dato.icono];
          return (
            <li key={dato.id}>
              <button
                type="button"
                className={`${styles.dato} ${copiando(dato.id) ? styles.copiado : ''}`}
                onClick={() => copiar(dato.id, dato.valor, dato.copiar)}
                aria-label={`Copiar ${dato.etiqueta}: ${dato.valor}`}
              >
                <Icono className={styles.icono} aria-hidden="true" />
                <small>{dato.etiqueta}</small>
                <span className={styles.valor}>{texto(dato.id, dato.valor)}</span>
                <span className={styles.accion} aria-hidden="true">copiar</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
