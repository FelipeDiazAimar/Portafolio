import Link from 'next/link';
import { notFound } from 'next/navigation';
import { listarProyectos, obtenerProyecto, tecnologiasDe } from '@/lib/proyectos.js';
import styles from './page.module.css';

export function generateStaticParams() {
  return listarProyectos().map((proyecto) => ({ slug: proyecto.slug }));
}

export default async function ProyectoDetallePage({ params }) {
  const { slug } = await params;
  const proyecto = obtenerProyecto(slug);

  if (!proyecto) {
    notFound();
  }

  // Nombres del catálogo, en el orden del stack del proyecto.
  const tecnologias = tecnologiasDe(proyecto);
  // Los proyectos privados no muestran enlaces.
  const enlaces = proyecto.privado ? null : (proyecto.enlaces ?? null);
  const tieneEnlaces = enlaces && Object.values(enlaces).some((url) => url);

  return (
    <article className={styles.detalle}>
      <Link className={styles.volver} href="/proyectos">
        ← Volver a proyectos
      </Link>
      <h1>{proyecto.titulo}</h1>
      <p className={styles.cliente}>{proyecto.cliente}</p>
      <p className={styles.problema}>{proyecto.problema}</p>
      <p>{proyecto.resumen}</p>
      <ul className={styles.tecnologias}>
        {tecnologias.map((tecnologia) => (
          <li key={tecnologia.id}>{tecnologia.nombre}</li>
        ))}
      </ul>
      {tieneEnlaces && (
        <ul className={styles.enlaces}>
          {enlaces.sitio && (
            <li>
              <a href={enlaces.sitio}>Sitio</a>
            </li>
          )}
          {enlaces.repo && (
            <li>
              <a href={enlaces.repo}>Repositorio</a>
            </li>
          )}
          {enlaces.repoFrontend && (
            <li>
              <a href={enlaces.repoFrontend}>Frontend</a>
            </li>
          )}
          {enlaces.repoBackend && (
            <li>
              <a href={enlaces.repoBackend}>Backend</a>
            </li>
          )}
        </ul>
      )}
    </article>
  );
}
