import styles from './ExperienciaPlana.module.css';

// Sin WebGL o con movimiento reducido: los mismos trabajos, uno debajo del otro, con sus cosas
// características. `comoLista`: sólo la lista (va oculta dentro del pasillo, para lectores de pantalla).
export default function ExperienciaPlana({ trabajos, comoLista = false }) {
  const lista = (
    <ol className={styles.lista}>
      {trabajos.map((t, i) => (
        <li key={t.id} className={styles.trabajo} style={{ '--acento': t.acento }}>
          <p className={styles.periodo}>
            <span className={styles.numero} aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            {t.periodo}
          </p>
          <h3 className={styles.puesto}>{t.puesto}</h3>
          <p className={styles.lugar}>{t.lugar}</p>
          <ul className={styles.objetos}>
            {t.objetos.map((o) => (
              <li key={o.titulo}>
                <strong>{o.titulo}.</strong> {o.texto}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
  if (comoLista) return lista;
  return (
    <section id="experiencia" className={styles.seccion} data-plano aria-labelledby="titulo-experiencia">
      <div className={styles.contenido}>
        <h2 id="titulo-experiencia" className={styles.titulo}>
          Experiencia
        </h2>
        {lista}
      </div>
    </section>
  );
}
