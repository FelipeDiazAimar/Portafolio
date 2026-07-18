import Link from 'next/link';
import { Card } from '@portafolio/ui';
import styles from './ProjectCard.module.css';

export default function ProjectCard({ proyecto }) {
  return (
    <Card title={proyecto.titulo}>
      <p className={styles.resumen}>{proyecto.resumen}</p>
      <ul className={styles.stack}>
        {proyecto.stack.map((tech) => (
          <li key={tech}>{tech}</li>
        ))}
      </ul>
      <Link href={`/proyectos/${proyecto.slug}`}>Ver detalle</Link>
    </Card>
  );
}
