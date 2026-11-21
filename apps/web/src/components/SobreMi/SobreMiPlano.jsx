'use client';

import useTema from '@/hooks/useTema.js';
import { dividirResaltado } from '@/lib/resaltado.js';
import { TITULAR } from './titular.js';
import styles from './SobreMiPlano.module.css';

// Sin WebGL (o si el contexto se pierde): los mismos siete hitos, uno debajo del otro, con su
// diorama como imagen. Sin scroll guiado ni 3D: una línea de tiempo que se lee de corrido.
export default function SobreMiPlano({ hitos }) {
  const claro = useTema().tema === 'light';
  return (
    <section id="sobre-mi" className={styles.plano} data-plano aria-labelledby="titulo-sobre-mi">
      <header className={styles.cabecera}>
        <p className={styles.etiqueta}>Sobre mí</p>
        <h2 id="titulo-sobre-mi" className={styles.titular} style={{ '--letras': Math.max(...TITULAR.map((renglon) => renglon.length)) }}>
          {TITULAR.map((renglon) => (
            <span key={renglon}>{renglon}</span>
          ))}
        </h2>
      </header>
      <ol className={styles.lista}>
        {hitos.map((hito, i) => (
          <li key={hito.id} className={styles.hito} style={{ '--acento': hito.acento }}>
            <div className={styles.texto}>
              <p className={styles.anio}>
                <span className={styles.punto} aria-hidden="true" />
                {hito.anio}
                <span className={styles.orden} aria-hidden="true">
                  {String(i + 1).padStart(2, '0')} / {String(hitos.length).padStart(2, '0')}
                </span>
              </p>
              <h3 className={styles.titulo}>{hito.titulo}</h3>
              <p className={styles.bio}>
                {dividirResaltado(hito.descripcion).map((parte, n) => (parte.resaltado ? <strong key={n}>{parte.texto}</strong> : <span key={n}>{parte.texto}</span>))}
              </p>
            </div>
            <div className={styles.figura}>
              {/* eslint-disable-next-line @next/next/no-img-element -- next/image rasteriza los SVG y les quita la animación */}
              <img src={`/hitos/diorama-${hito.id}-${claro ? 'claro' : 'oscuro'}.svg`} alt="" width="800" height="600" loading="lazy" decoding="async" />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
