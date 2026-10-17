import SobreMi from '@/components/SobreMi/SobreMi.jsx';
import Proyectos from '@/components/Proyectos/Proyectos.jsx';
import Habilidades from '@/components/Habilidades/Habilidades.jsx';
import styles from './page.module.css';

const SECCIONES = [
  { id: 'sobre-mi', titulo: 'Sobre mí' },
  { id: 'proyectos', titulo: 'Proyectos' },
  { id: 'experiencia', titulo: 'Experiencia' },
  { id: 'habilidades', titulo: 'Habilidades' },
  { id: 'contacto', titulo: 'Contacto' },
];

export default function HomePage() {
  return (
    <>
      <section id="inicio" className={styles.seccionHero} />
      {SECCIONES.map((seccion) =>
        seccion.id === 'sobre-mi' ? (
          <SobreMi key={seccion.id} />
        ) : seccion.id === 'proyectos' ? (
          <Proyectos key={seccion.id} />
        ) : seccion.id === 'habilidades' ? (
          <Habilidades key={seccion.id} />
        ) : (
          <section key={seccion.id} id={seccion.id} className={styles.seccion}>
            <h2>{seccion.titulo}</h2>
          </section>
        )
      )}
    </>
  );
}
