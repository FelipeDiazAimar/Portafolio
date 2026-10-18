'use client';

import { useEffect, useState } from 'react';
import { usePortfolio } from '@/contexto/ProveedorPortfolio.jsx';
import NombreAscii from '@/components/NombreAscii/NombreAscii.jsx';
import RetratoAscii from '@/components/RetratoAscii/RetratoAscii.jsx';
import FondoRayosX from '@/components/RayosX/FondoRayosX.jsx';
import estilosRayos from '@/components/RayosX/RayosX.module.css';
import styles from './HeroInmersivo.module.css';

const SECCIONES = [
  { id: 'inicio' },
  { id: 'sobre-mi', titulo: 'Sobre Mí' },
  { id: 'proyectos', titulo: 'Mis Proyectos' },
  { id: 'experiencia', titulo: 'Experiencia Laboral' },
  { id: 'habilidades', titulo: 'Mis Habilidades' },
  { id: 'contacto', titulo: 'Hablemos' },
];

export default function HeroInmersivo() {
  const { seccionActiva } = usePortfolio();
  // Tras 4 s con el cursor sobre la foto, el hero pasa al fondo de esqueletos (rayos X) y la foto se
  // funde. Queda así hasta tocar "Volver a la foto".
  const [rayosX, setRayosX] = useState(null); // null, o { x, y, alto }: dónde estaba tu cráneo
  // ¿Se está viendo el hero? Por scroll: `seccionActiva` sólo cambia con el mouse sobre el menú.
  // Al irse a otra sección, la cruz y el fondo animado se apagan; al volver, reaparecen.
  const [enHero, setEnHero] = useState(true);
  useEffect(() => {
    function evaluar() {
      setEnHero(window.scrollY < window.innerHeight * 0.55);
    }
    evaluar();
    window.addEventListener('scroll', evaluar, { passive: true });
    window.addEventListener('resize', evaluar);
    return () => {
      window.removeEventListener('scroll', evaluar);
      window.removeEventListener('resize', evaluar);
    };
  }, []);
  const conCruz = Boolean(rayosX) && seccionActiva === 'inicio' && enHero;

  // la cruz va a la derecha del toggle de tema: el toggle se corre para hacerle lugar
  useEffect(() => {
    document.documentElement.toggleAttribute('data-rayosx', conCruz);
    return () => document.documentElement.removeAttribute('data-rayosx');
  }, [conCruz]);

  return (
    <>
      <div className={styles.hero} aria-hidden="true">
        {SECCIONES.map((seccion) => (
          <div
            key={seccion.id}
            className={`${styles.capa} ${styles[`capa-${seccion.id}`]} ${
              seccion.id === seccionActiva ? styles.activa : ''
            }`}
          >
            {seccion.id === 'inicio' ? (
              <>
                {rayosX && <FondoRayosX activo={seccionActiva === 'inicio' && enHero} entrada={rayosX} />}
                <NombreAscii />
                <RetratoAscii rayosX={Boolean(rayosX)} alDispararRayosX={(info) => setRayosX(info ?? { x: 0, y: 0, alto: 0 })} />
              </>
            ) : (
              <span className={styles.titulo}>{seccion.titulo}</span>
            )}
          </div>
        ))}
      </div>
      {conCruz && (
        <button type="button" className={estilosRayos.volver} onClick={() => setRayosX(null)} aria-label="Volver a la foto" title="Volver a la foto">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </>
  );
}
