import { notFound } from 'next/navigation';
import { obtenerProyecto } from '@/lib/proyectos.js';

export default async function ProyectoDetallePage({ params }) {
  const { slug } = await params;
  const proyecto = obtenerProyecto(slug);

  if (!proyecto) {
    notFound();
  }

  return (
    <section>
      <h1>{proyecto.titulo}</h1>
      <p>{proyecto.resumen}</p>
      <ul>
        {proyecto.stack.map((tech) => (
          <li key={tech}>{tech}</li>
        ))}
      </ul>
    </section>
  );
}
