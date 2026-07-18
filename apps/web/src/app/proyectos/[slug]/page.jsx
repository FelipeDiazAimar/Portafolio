import { notFound } from 'next/navigation';
import { obtenerProyecto } from '@/lib/proyectos.js';

export default function ProyectoDetallePage({ params }) {
  const proyecto = obtenerProyecto(params.slug);

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
