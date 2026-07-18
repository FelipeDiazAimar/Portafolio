'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { GlassSurface } from '@portafolio/ui';
import ElementoNavegacion from '@/components/ElementoNavegacion/ElementoNavegacion.jsx';
import useScrollPasadoViewport from '@/hooks/useScrollPasadoViewport.js';
import styles from './Header.module.css';

function IconoPersona() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </svg>
  );
}

function IconoGrid() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </svg>
  );
}

function IconoMaletin() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M3 13h18" />
    </svg>
  );
}

function IconoEstrella() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.6l-5.9 3 1.3-6.6-4.9-4.6 6.6-.8z" />
    </svg>
  );
}

function IconoSobre() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

const ENLACES = [
  { href: '/sobre-mi', label: 'Sobre mi', icono: <IconoPersona /> },
  { href: '/proyectos', label: 'Proyectos', icono: <IconoGrid /> },
  { href: '/experiencia', label: 'Experiencia', icono: <IconoMaletin /> },
  { href: '/habilidades', label: 'Habilidades', icono: <IconoEstrella /> },
  { href: '/contacto', label: 'Contáctame', icono: <IconoSobre /> },
];

const PROPS_GLASS = {
  opacity: 0.9,
  brightness: 45,
  blur: 14,
  backgroundOpacity: 0.12,
  saturation: 1.4,
  distortionScale: -140,
  redOffset: 0,
  greenOffset: 6,
  blueOffset: 14,
  displace: 0.2,
};

const TRANSICION_FADE = { duration: 0.4, ease: [0.16, 1, 0.3, 1] };

export default function Header() {
  const estaScrolleado = useScrollPasadoViewport();

  return (
    <header className={styles.header}>
      <Link href="/" className={styles.logo}>Felipe Diaz Aimar</Link>

      <AnimatePresence mode="popLayout" initial={false}>
        {!estaScrolleado ? (
          <motion.div
            key="pildora-grande"
            className={styles.pildoraGrandeWrapper}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={TRANSICION_FADE}
          >
            <GlassSurface width="auto" height={40} borderRadius={100} {...PROPS_GLASS}>
              <nav className={styles.navGrande}>
                <ul className={styles.listaGrande}>
                  {ENLACES.map((enlace) => (
                    <li key={enlace.href}>
                      <ElementoNavegacion enlace={enlace} icono={enlace.icono} variante="grande" />
                    </li>
                  ))}
                </ul>
              </nav>
            </GlassSurface>
          </motion.div>
        ) : (
          <motion.nav
            key="mini-pildoras"
            className={styles.navMini}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={TRANSICION_FADE}
          >
            {ENLACES.map((enlace) => (
              <div key={enlace.href} className={styles.miniWrapper}>
                <GlassSurface width="100%" height={40} borderRadius={100} {...PROPS_GLASS}>
                  <ElementoNavegacion enlace={enlace} icono={enlace.icono} variante="mini" />
                </GlassSurface>
              </div>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
