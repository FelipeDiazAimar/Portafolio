import ProjectCard from '@/components/ProjectCard/ProjectCard.jsx';
import { listarProyectos, resumenCifras } from '@/lib/proyectos.js';
import styles from './page.module.css';

export default function ProyectosPage() {
  const proyectos = listarProyectos();
  const cifras = resumenCifras();

  return (
    <section className={styles.lista}>
      <h1>Proyectos</h1>
      <p className={styles.cifras}>
        {cifras.total} proyectos · {cifras.clientes} para clientes · {cifras.laborales} en relación
        laboral
      </p>
      <div className={styles.rejilla}>
        {proyectos.map((proyecto) => (
          <ProjectCard key={proyecto.slug} proyecto={proyecto} />
        ))}
      </div>
    </section>
  );
}
