import styles from './Titulos.module.css';

// Títulos y certificaciones (los datos salen de los hitos de "Sobre mí").
const TITULOS = [
  {
    clave: 'utn',
    estado: 'En curso · 4.º año',
    anio: 'Desde 2022',
    nombre: 'Ingeniería en Sistemas de Información',
    lugar: 'UTN · Facultad Regional San Francisco',
  },
  {
    clave: 'cambridge',
    estado: 'Certificación',
    anio: '2023',
    nombre: 'First de Cambridge',
    lugar: 'Inglés · EPI',
  },
  {
    clave: 'abanderado',
    estado: 'Egreso',
    anio: '2022',
    nombre: 'Abanderado',
    lugar: 'Instituto San Francisco de Asís (ISFA) · San Francisco, Córdoba',
  },
];

export default function Titulos() {
  return (
    <section id="titulos" className={styles.seccion} aria-labelledby="titulo-titulos">
      <div className={styles.contenido}>
        <h2 id="titulo-titulos" className={styles.titulo}>
          Títulos
        </h2>
        <ul className={styles.lista}>
          {TITULOS.map((t) => (
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
