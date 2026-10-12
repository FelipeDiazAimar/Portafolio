import Link from 'next/link';
import { Card } from '@portafolio/ui';
import { tecnologiasDe } from '@/lib/proyectos.js';
import styles from './ProjectCard.module.css';

export default function ProjectCard({ proyecto }) {
  // Nombres del catálogo, en el orden del stack del proyecto.
  const tecnologias = tecnologiasDe(proyecto);

  return (
    <Card title={proyecto.titulo}>
      <p className={styles.problema}>{proyecto.problema}</p>
      <ul className={styles.stack}>
        {tecnologias.map((tecnologia) => (
          <li key={tecnologia.id}>{tecnologia.nombre}</li>
        ))}
      </ul>
      <Link href={`/proyectos/${proyecto.slug}`}>Ver detalle</Link>
    </Card>
  );
}
