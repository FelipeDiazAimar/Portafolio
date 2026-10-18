'use client';

import { useEffect, useState } from 'react';
import { alCambiarTeletransporte, estaCongelado } from '@/lib/teletransporte.js';
import NombreAscii from '@/components/NombreAscii/NombreAscii.jsx';
import RetratoAscii from '@/components/RetratoAscii/RetratoAscii.jsx';
import FondoRayosX from '@/components/RayosX/FondoRayosX.jsx';
import estilosRayos from '@/components/RayosX/RayosX.module.css';
import styles from './HeroInmersivo.module.css';

export default function HeroInmersivo() {
  // Tras 4 s con el cursor sobre la foto, el hero pasa al fondo de esqueletos (rayos X) y la foto se
  // funde. Queda así hasta tocar "Volver a la foto".
  const [rayosX, setRayosX] = useState(null); // null, o { x, y, alto }: dónde estaba tu cráneo
  // ¿Se está viendo el hero? Por scroll. Al irse a otra sección, la cruz y el fondo animado se
  // apagan; al volver, reaparecen. Durante una vista previa del menú (teletransporte) no se
  // reevalúa: el salto de ida y vuelta no tiene que mover la cruz ni el toggle de tema.
  const [enHero, setEnHero] = useState(true);
  useEffect(() => {
    function evaluar() {
      if (estaCongelado()) return;
      setEnHero(window.scrollY < window.innerHeight * 0.55);
    }
    evaluar();
    window.addEventListener('scroll', evaluar, { passive: true });
    window.addEventListener('resize', evaluar);
    const quitar = alCambiarTeletransporte(evaluar);
    return () => {
      window.removeEventListener('scroll', evaluar);
      window.removeEventListener('resize', evaluar);
      quitar();
    };
  }, []);
  const conCruz = Boolean(rayosX) && enHero;

  // la cruz va a la derecha del toggle de tema: el toggle se corre para hacerle lugar
  useEffect(() => {
    document.documentElement.toggleAttribute('data-rayosx', conCruz);
    return () => document.documentElement.removeAttribute('data-rayosx');
  }, [conCruz]);

  return (
    <>
      <div className={styles.hero} aria-hidden="true">
        <div className={`${styles.capa} ${styles['capa-inicio']} ${styles.activa}`}>
          {rayosX && <FondoRayosX activo={enHero} entrada={rayosX} />}
          <NombreAscii />
          <RetratoAscii rayosX={Boolean(rayosX)} alDispararRayosX={(info) => setRayosX(info ?? { x: 0, y: 0, alto: 0 })} />
        </div>
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
