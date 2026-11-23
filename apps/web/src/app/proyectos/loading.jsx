import Esqueleto from '@/components/Esqueleto/Esqueleto.jsx';
import styles from './page.module.css';

// Skeleton de /proyectos y de cada proyecto mientras llega la ruta.
export default function CargandoProyectos() {
  return (
    <section className={styles.lista} role="status" aria-label="Cargando proyectos">
      <Esqueleto ancho="min(16rem, 60%)" alto="2.4rem" radio="0.6rem" />
      <p className={styles.cifras}>
        <Esqueleto ancho="min(24rem, 80%)" alto="0.9rem" radio="999px" />
      </p>
      <div className={styles.rejilla}>
        {Array.from({ length: 6 }, (_, i) => (
          <Esqueleto key={i} alto="11rem" radio="1rem" />
        ))}
      </div>
    </section>
  );
}
