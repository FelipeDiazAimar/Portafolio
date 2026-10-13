import { marcaDe } from '@/data/marcas.js';
import styles from './TarjetaMarca.module.css';

// La tarjeta de un proyecto: su logo real sobre su fondo o, si no tiene, el nombre en
// tipografía sobre un degradé de su color. Todo se mide en unidades del contenedor
// (cqw): la misma tarjeta sirve chica en la marquesina y a pantalla completa.
export default function TarjetaMarca({ proyecto, grande = false, className = '' }) {
  const marca = marcaDe(proyecto.slug);
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
        {marca.logo ? <img className={styles.logo} src={marca.logo} alt="" draggable={false} /> : null}
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
