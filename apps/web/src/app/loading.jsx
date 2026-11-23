import Esqueleto from '@/components/Esqueleto/Esqueleto.jsx';
import styles from './page.module.css';

// Skeleton de la página mientras llega la ruta (la portada y las escenas llevan el suyo).
export default function Cargando() {
  return (
    <section className={styles.seccion} role="status" aria-label="Cargando" style={{ flexDirection: 'column', gap: '1rem' }}>
      <Esqueleto ancho="min(28rem, 70%)" alto="3rem" radio="0.8rem" />
      <Esqueleto ancho="min(18rem, 50%)" alto="1rem" radio="999px" />
    </section>
  );
}
