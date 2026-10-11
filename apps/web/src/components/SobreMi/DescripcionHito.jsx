import { dividirResaltado } from '@/lib/resaltado.js';
import styles from './DescripcionHito.module.css';

// El texto siempre está en el DOM (lo leen los lectores de pantalla); `visible`
// sólo decide si se ve. Las palabras clave llevan `--n` para que se enciendan
// escalonadas, una detrás de otra.
export default function DescripcionHito({ hito, visible }) {
  let claves = 0;
  const partes = dividirResaltado(hito.descripcion).map((parte, i) => {
    if (!parte.resaltado) return <span key={i}>{parte.texto}</span>;
    const n = claves;
    claves += 1;
    return (
      <strong key={i} className={styles.clave} style={{ '--n': n }}>
        {parte.texto}
      </strong>
    );
  });

  return (
    <div className={`${styles.descripcion} ${visible ? styles.visible : ''}`}>
      <p className={styles.texto}>{partes}</p>
      {hito.credito ? (
        <p className={styles.credito}>
          <a href={hito.credito.url} target="_blank" rel="noopener noreferrer">
            {hito.credito.texto}
          </a>
        </p>
      ) : null}
    </div>
  );
}
