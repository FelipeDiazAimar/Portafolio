'use client';

import { usePortfolio } from '@/contexto/ProveedorPortfolio.jsx';
import styles from './HeroInmersivo.module.css';

const SECCIONES = [
  { id: 'inicio', titulo: 'Bienvenido' },
  { id: 'sobre-mi', titulo: 'Sobre Mí' },
  { id: 'proyectos', titulo: 'Mis Proyectos' },
  { id: 'experiencia', titulo: 'Experiencia Laboral' },
  { id: 'habilidades', titulo: 'Mis Habilidades' },
  { id: 'contacto', titulo: 'Hablemos' },
];

export default function HeroInmersivo() {
  const { seccionActiva } = usePortfolio();

  return (
    <div className={styles.hero} aria-hidden="true">
      {SECCIONES.map((seccion) => (
        <div
          key={seccion.id}
          className={`${styles.capa} ${styles[`capa-${seccion.id}`]} ${
            seccion.id === seccionActiva ? styles.activa : ''
          }`}
        >
          <span className={styles.titulo}>{seccion.titulo}</span>
        </div>
      ))}
    </div>
  );
}
