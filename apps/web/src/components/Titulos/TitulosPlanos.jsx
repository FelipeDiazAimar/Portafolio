import styles from './TitulosPlanos.module.css';

// Sin WebGL o con movimiento reducido: los títulos como tres tarjetas simples.
export default function TitulosPlanos({ titulos }) {
  return (
    <section id="titulos" className={styles.seccion} aria-labelledby="titulo-titulos">
      <div className={styles.contenido}>
        <h2 id="titulo-titulos" className={styles.titulo}>
          Títulos
        </h2>
        <ul className={styles.lista}>
          {titulos.map((t) => (
            <li key={t.clave} className={styles.tarjeta}>
              <div className={styles.fila}>
                <span className={styles.estado}>{t.estado}</span>
                <span className={styles.anio}>{t.anio}</span>
              </div>
              <h3 className={styles.nombre}>{t.nombre}</h3>
              <p className={styles.lugar}>{t.lugar}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
