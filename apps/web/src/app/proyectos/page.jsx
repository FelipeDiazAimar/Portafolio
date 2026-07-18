import ProjectCard from '@/components/ProjectCard/ProjectCard.jsx';
import { listarProyectos } from '@/lib/proyectos.js';

export default function ProyectosPage() {
  const proyectos = listarProyectos();

  return (
    <section>
      <h1>Proyectos</h1>
      {proyectos.map((proyecto) => (
        <ProjectCard key={proyecto.slug} proyecto={proyecto} />
      ))}
    </section>
  );
}
