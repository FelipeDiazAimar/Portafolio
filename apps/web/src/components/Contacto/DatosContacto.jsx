'use client';

// Datos de contacto copiables uno a uno (footer).
import { DATOS_CONTACTO } from '@/data/contacto.js';
import { ICONOS_CONTACTO } from './iconos.jsx';
import useCopiar from './useCopiar.js';
import styles from './DatosContacto.module.css';

// `nombre`: el nombre ASCII del footer (lo arma PiePagina porque lleva el efecto del stickman).
export default function DatosContacto({ nombre }) {
  const { copiar, texto, copiando } = useCopiar();
  return (
    <div className={styles.datos}>
      <div className={styles.marca}>
        {nombre}
        <span>Desarrollador Full Stack · San Francisco, Córdoba, Argentina</span>
        <a className={styles.cv} href="/CV-Felipe-Diaz-Aimar.pdf" download="CV-Felipe-Diaz-Aimar.pdf">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />
          </svg>
          Descargar CV
          <small>PDF</small>
        </a>
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
