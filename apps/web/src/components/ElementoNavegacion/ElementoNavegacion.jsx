'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import TextoBrillante from '@/components/TextoBrillante/TextoBrillante.jsx';
import TextoRodante from '@/components/TextoRodante/TextoRodante.jsx';
import { irASeccion, terminarVistaPrevia, vistaPrevia } from '@/lib/teletransporte.js';
import styles from './ElementoNavegacion.module.css';

// Coincide con UNMOUNT_DELAY_MS de Bienvenida: el rodillo arranca recién
// cuando el splash termina de desaparecer, si no se juega sin que se vea.
const DEMORA_RODANTE_MS = 3300;

// Módulo-scope a propósito: la píldora grande se desmonta y remonta cada
// vez que el visitante scrollea arriba/abajo del umbral, y solo la
// PRIMERA aparición de verdad (justo después de Bienvenida) debe esperar
// los 3.3s. Los remontajes siguientes deben animar de una.
let yaSeMostroLaPildoraGrande = false;

export default function ElementoNavegacion({ enlace, icono, variante }) {
  const esPrimeraVez = useRef(variante === 'grande' && !yaSeMostroLaPildoraGrande).current;

  useEffect(() => {
    if (variante === 'grande') {
      yaSeMostroLaPildoraGrande = true;
    }
  }, [variante]);

  return (
    <motion.div layout layoutId={`nav-${enlace.href}`} className={styles[variante]}>
      <a
        href={enlace.href}
        className={styles.enlace}
        // Hover: el scroll salta a la sección real (y vuelve al salir). Clic: queda ahí.
        onMouseEnter={() => vistaPrevia(enlace.seccion)}
        onMouseLeave={terminarVistaPrevia}
        onClick={(evento) => {
          evento.preventDefault();
          irASeccion(enlace.seccion);
        }}
      >
        <span className={styles.icono}>{icono}</span>
        <span className={styles.texto}>
          {variante === 'grande' ? (
            <TextoRodante texto={enlace.label} demoraInicial={esPrimeraVez ? DEMORA_RODANTE_MS : 0} />
          ) : (
            <TextoBrillante texto={enlace.label} activo />
          )}
        </span>
      </a>
    </motion.div>
  );
}
