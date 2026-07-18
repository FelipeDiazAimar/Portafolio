'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import TextoBrillante from '@/components/TextoBrillante/TextoBrillante.jsx';
import TextoRodante from '@/components/TextoRodante/TextoRodante.jsx';
import styles from './ElementoNavegacion.module.css';

// Coincide con UNMOUNT_DELAY_MS de Bienvenida: el rodillo arranca recién
// cuando el splash termina de desaparecer, si no se juega sin que se vea.
const DEMORA_RODANTE_MS = 3300;

export default function ElementoNavegacion({ enlace, icono, variante }) {
  return (
    <motion.div layout layoutId={`nav-${enlace.href}`} className={styles[variante]}>
      <Link href={enlace.href} className={styles.enlace}>
        <span className={styles.icono}>{icono}</span>
        <span className={styles.texto}>
          {variante === 'grande' ? (
            <TextoRodante texto={enlace.label} demoraInicial={DEMORA_RODANTE_MS} />
          ) : (
            <TextoBrillante texto={enlace.label} activo />
          )}
        </span>
      </Link>
    </motion.div>
  );
}
