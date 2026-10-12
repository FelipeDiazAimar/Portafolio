'use client';

import { AnimatePresence, motion } from 'framer-motion';
import TextoTipeado from '../SobreMi/TextoTipeado.jsx';
import styles from './PresentadorProyectos.module.css';

// Tarjeta de vidrio abajo a la derecha: etiqueta, problema tipeado,
// chips de features, estado y enlaces. Hace crossfade al cambiar de proyecto.
export default function Problematica({ proyecto }) {
  const enlaces = proyecto.enlaces ?? {};
  const features = (proyecto.features ?? []).slice(0, 3);
  const esProduccion = proyecto.estado === 'produccion';
  const esDemo = proyecto.estado === 'demo';
  const texto = proyecto.problema || proyecto.resumen || '';

  return (
    <AnimatePresence mode="wait">
      <motion.article
        key={proyecto.slug}
        id="panel-proyecto"
        role="tabpanel"
        aria-labelledby={`tab-${proyecto.slug}`}
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
        <div className={styles.filaFinal}>
          {esProduccion && (
            <span className={styles.chipEstado} style={{ color: '#34d399' }}>
              ● En producción
            </span>
          )}
          {esDemo && (
            <span className={styles.chipEstado} style={{ color: '#fbbf24' }}>
              ● Demo
            </span>
          )}
          {proyecto.privado && <span className={styles.chipPrivado}>Sistema interno</span>}
          {enlaces.sitio && (
            <a
              className={styles.boton}
              href={enlaces.sitio}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ver sitio ↗
            </a>
          )}
          {enlaces.repoFrontend && (
            <a
              className={styles.boton}
              href={enlaces.repoFrontend}
              target="_blank"
              rel="noopener noreferrer"
            >
              Frontend ↗
            </a>
          )}
          {enlaces.repoBackend && (
            <a
              className={styles.boton}
              href={enlaces.repoBackend}
              target="_blank"
              rel="noopener noreferrer"
            >
              Backend ↗
            </a>
          )}
          {!enlaces.repoFrontend && !enlaces.repoBackend && enlaces.repo && (
            <a
              className={styles.boton}
              href={enlaces.repo}
              target="_blank"
              rel="noopener noreferrer"
            >
              Código ↗
            </a>
          )}
        </div>
      </motion.article>
    </AnimatePresence>
  );
}
