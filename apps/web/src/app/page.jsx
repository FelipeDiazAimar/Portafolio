import Link from 'next/link';
import styles from './page.module.css';

export default function HomePage() {
  return (
    <section>
      <h1>Felipe Diaz Aimar</h1>
      <p>Desarrollador fullstack — React, Next.js, Node/Express.</p>
      <Link href="/proyectos" className={styles.link}>
        Ver proyectos
      </Link>
    </section>
  );
}
