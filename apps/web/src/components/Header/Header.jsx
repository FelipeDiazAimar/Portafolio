'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { GlassSurface } from '@portafolio/ui';
import ElementoNavegacion from '@/components/ElementoNavegacion/ElementoNavegacion.jsx';
import MenuMovil from '@/components/MenuMovil/MenuMovil.jsx';
import TextoDescifrado from '@/components/TextoDescifrado/TextoDescifrado.jsx';
import useScrollPasadoViewport from '@/hooks/useScrollPasadoViewport.js';
import { irASeccion, terminarVistaPrevia, vistaPrevia } from '@/lib/teletransporte.js';
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
  { href: '#sobre-mi', seccion: 'sobre-mi', label: 'Sobre mi', icono: <IconoPersona /> },
  { href: '#proyectos', seccion: 'proyectos', label: 'Proyectos', icono: <IconoGrid /> },
  { href: '#experiencia', seccion: 'experiencia', label: 'Experiencia', icono: <IconoMaletin /> },
  { href: '#habilidades', seccion: 'habilidades', label: 'Habilidades', icono: <IconoEstrella /> },
  { href: '#contacto', seccion: 'contacto', label: 'Contáctame', icono: <IconoSobre /> },
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

// Coincide con UNMOUNT_DELAY_MS de Bienvenida (igual que DEMORA_RODANTE_MS
// en ElementoNavegacion): si el nombre se descifra antes, queda tapado por
// el splash y nadie lo llega a ver.
const DEMORA_NOMBRE_MS = 3300;

export default function Header() {
  const estaScrolleado = useScrollPasadoViewport();
  const refPildoraGrande = useRef(null);
  const [mostrarNombreDescifrado, setMostrarNombreDescifrado] = useState(false);

  useEffect(() => {
    const temporizador = setTimeout(() => setMostrarNombreDescifrado(true), DEMORA_NOMBRE_MS);
    return () => clearTimeout(temporizador);
  }, []);

  function manejarMovimientoRaton(evento) {
    const contenedor = refPildoraGrande.current;
    if (!contenedor) return;
    const rect = contenedor.getBoundingClientRect();
    contenedor.style.setProperty('--raton-x', `${evento.clientX - rect.left}px`);
    contenedor.style.setProperty('--raton-y', `${evento.clientY - rect.top}px`);
  }

  // El <header> es sticky, así que ocupa espacio real en el flujo: #inicio no arranca en el tope
  // del documento sino justo debajo del header. Se va a 0 directo, con el mismo salto que el menú.
  function irAlInicio(evento) {
    evento.preventDefault();
    irASeccion('inicio');
  }

  return (
    <header className={styles.header}>
      {/* Hover: vista previa del hero (el scroll salta arriba y vuelve al salir). Clic: queda. */}
      <a href="#inicio" onClick={irAlInicio} onMouseEnter={() => vistaPrevia('inicio')} onMouseLeave={terminarVistaPrevia} className={styles.logo}>
        {mostrarNombreDescifrado ? (
          <TextoDescifrado
            texto="</>"
            activarCon="inViewHover"
            secuencial
            direccionRevelado="start"
            caracteres="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=<>/\|"
            velocidad={35}
            className={styles.logoRevelado}
            encryptedClassName={styles.logoEncriptado}
          />
        ) : (
          '</>'
        )}
        {/* El nombre ya aparece en el ASCII de la sección inicio: acá se
            oculta mientras esa sección está a la vista y sólo se muestra
            cuando se scrollea a otra, para no duplicarlo. */}
        <span className={`${styles.logoNombre} ${estaScrolleado ? styles.logoNombreVisible : ''}`}>
          {mostrarNombreDescifrado ? (
            <TextoDescifrado
              texto="Felipe Diaz Aimar"
              activarCon="inViewHover"
              secuencial
              direccionRevelado="start"
              caracteres="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=<>/\|"
              velocidad={35}
              className={styles.logoRevelado}
              encryptedClassName={styles.logoEncriptado}
            />
          ) : (
            'Felipe Diaz Aimar'
          )}
        </span>
      </a>

      <AnimatePresence mode="popLayout" initial={false}>
        {!estaScrolleado ? (
          <motion.div
            key="pildora-grande"
            ref={refPildoraGrande}
            className={styles.pildoraGrandeWrapper}
            onMouseMove={manejarMovimientoRaton}
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

      {/* Sólo en pantallas angostas, donde las píldoras están ocultas. */}
      <MenuMovil enlaces={ENLACES} />
    </header>
  );
}
