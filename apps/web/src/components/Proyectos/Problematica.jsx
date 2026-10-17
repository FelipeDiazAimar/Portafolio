'use client';

import { AnimatePresence, motion } from 'framer-motion';
import TextoTipeado from '../SobreMi/TextoTipeado.jsx';
import { FRASES_CLAVE, rangosClave } from '@/lib/resaltadoProblema.js';
import styles from './PresentadorProyectos.module.css';

// Tarjeta de vidrio abajo a la derecha: etiqueta, problema tipeado,
// chips de features y estado (los enlaces van aparte, en EnlacesProyecto). Hace crossfade al cambiar de proyecto.
// idPanel/etiquetadoPor permiten reutilizarla fuera del presentador
// (en la vista mixta el tab es nav-<slug>, no tab-<slug>).
export default function Problematica({ proyecto, idPanel, etiquetadoPor, sinFundido = false }) {
  const features = (proyecto.features ?? []).slice(0, 3);
  const texto = proyecto.problema || proyecto.resumen || '';
  const rangos = rangosClave(texto, FRASES_CLAVE[proyecto.slug]);

  return (
    <AnimatePresence mode="wait" initial={!sinFundido}>
      <motion.article
        key={proyecto.slug}
        id={idPanel ?? 'panel-proyecto'}
        role="tabpanel"
        aria-labelledby={etiquetadoPor ?? `tab-${proyecto.slug}`}
        className={styles.problematica}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        <p className={styles.etiqueta} style={{ color: proyecto.color }}>
          La problemática
        </p>
        <p className={styles.texto}>
          <TextoTipeado
            key={proyecto.slug}
            texto={texto}
            velocidad={18}
            retraso={250}
            rangos={rangos}
            claseClave={styles.clave}
          />
        </p>
        {features.length > 0 && (
          <div className={styles.chips}>
            {features.map((feature) => (
              <span key={feature} className={styles.chip}>
                {feature}
              </span>
            ))}
          </div>
        )}
      </motion.article>
    </AnimatePresence>
  );
}
