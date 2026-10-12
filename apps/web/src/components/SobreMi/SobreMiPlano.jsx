import Image from 'next/image';
import { dividirResaltado } from '@/lib/resaltado.js';
import EncabezadoHito from './EncabezadoHito.jsx';
import EscenarioHito from './EscenarioHito.jsx';
import styles from './SobreMiPlano.module.css';

// Sin WebGL (o si el mundo 3D falla): los hitos uno debajo del otro, sin scroll guiado.
export default function SobreMiPlano({ hitos }) {
  return (
    <section id="sobre-mi" className={styles.plano} data-plano>
      <h2 className={styles.etiqueta}>Sobre mí</h2>
      <ol className={styles.lista}>
        {hitos.map((hito) => (
          <li key={hito.id} className={styles.hito}>
            {hito.imagen ? (
              <div className={styles.foto}>
                <Image src={hito.imagen} alt="" fill sizes="(max-width: 768px) 100vw, 40vw" className={styles.imagen} />
              </div>
            ) : null}
            <div className={styles.texto}>
              <EncabezadoHito hito={hito} />
              <EscenarioHito hito={hito} desarmado={false} />
              <p className={styles.bio}>
                {dividirResaltado(hito.descripcion).map((parte, i) =>
                  parte.resaltado ? <strong key={i}>{parte.texto}</strong> : <span key={i}>{parte.texto}</span>
                )}
              </p>
              {hito.credito ? (
                <p className={styles.credito}>
                  <a href={hito.credito.url} target="_blank" rel="noopener noreferrer">
                    {hito.credito.texto}
                  </a>
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
