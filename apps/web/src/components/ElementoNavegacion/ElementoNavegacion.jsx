'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import TextoBrillante from '@/components/TextoBrillante/TextoBrillante.jsx';
import styles from './ElementoNavegacion.module.css';

export default function ElementoNavegacion({ enlace, icono, variante }) {
  return (
    <motion.div layout layoutId={`nav-${enlace.href}`} className={styles[variante]}>
      <Link href={enlace.href} className={styles.enlace}>
        <span className={styles.icono}>{icono}</span>
        <span className={styles.texto}>
          <TextoBrillante texto={enlace.label} />
        </span>
      </Link>
    </motion.div>
  );
}
