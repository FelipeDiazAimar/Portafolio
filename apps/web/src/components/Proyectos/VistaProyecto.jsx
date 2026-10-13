'use client';

import { motion } from 'framer-motion';
import TarjetaMarca from './TarjetaMarca.jsx';
import Problematica from './Problematica.jsx';
import { HudTecnologias } from './HudTecnologias.jsx';
import styles from './VistaProyecto.module.css';

const TIPO_LEGIBLE = {
  laboral: 'Trabajo en MBRF',
  cliente: 'Cliente',
  personal: 'Proyecto propio',
  academico: 'Académico',
};

function lineaCabecera(proyecto) {
  return [proyecto.cliente, TIPO_LEGIBLE[proyecto.tipo] ?? proyecto.tipo, proyecto.periodo].filter(Boolean).join(' · ');
}

const VIAJE = { duration: 0.75, ease: [0.22, 1, 0.36, 1] };
// La inclinación de la marquesina (ver components/ui/3d-marquee.jsx).
const INCLINACION = { rotateX: 55, rotateZ: -45 };

// Un proyecto en primer plano, a pantalla completa (sin marco). Nace como una copia de
// su tarjeta en la marquesina —mismo lugar, tamaño e inclinación— y viaja hasta ocupar
// el panel; al cerrarse vuelve a donde esté su tarjeta en ese momento.
// `medir(slug)` da la caja de la tarjeta en coordenadas del panel; `tamano` = panel.
export default function VistaProyecto({ proyecto, medir, tamano, reducido, alCerrar }) {
  const enMarquesina = () => {
    const caja = medir(proyecto.slug);
    if (!caja) return { opacity: 0, transition: { duration: 0.25 } };
    return {
      left: caja.x,
      top: caja.y,
      width: caja.ancho,
      height: caja.alto,
      borderRadius: 8,
      opacity: 1,
      ...INCLINACION,
      transition: VIAJE,
    };
  };
  const variantes = reducido
    ? {
        marquesina: { opacity: 0, transition: { duration: 0.2 } },
        pantalla: { left: 0, top: 0, width: tamano.ancho, height: tamano.alto, opacity: 1, transition: { duration: 0.2 } },
      }
    : {
        marquesina: enMarquesina,
        pantalla: {
          left: 0,
          top: 0,
          width: tamano.ancho,
          height: tamano.alto,
          borderRadius: 0,
          opacity: 1,
          rotateX: 0,
          rotateZ: 0,
          transition: VIAJE,
        },
      };

  return (
    <motion.article
      className={styles.vista}
      style={{ '--acento': proyecto.color }}
      variants={variantes}
      initial="marquesina"
      animate="pantalla"
      exit="marquesina"
      aria-labelledby={`titulo-${proyecto.slug}`}
    >
      <TarjetaMarca proyecto={proyecto} grande className={styles.fondo} />
      <motion.div
        className={styles.contenido}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { delay: reducido ? 0 : 0.45, duration: 0.35 } }}
        exit={{ opacity: 0, transition: { duration: 0.12 } }}
      >
        <div className={styles.velo} aria-hidden="true" />
        <header className={styles.cabecera}>
          <p className={styles.linea}>{lineaCabecera(proyecto)}</p>
          <h3 id={`titulo-${proyecto.slug}`} className={styles.titulo}>
            {proyecto.titulo}
          </h3>
        </header>
        <Problematica proyecto={proyecto} idPanel={`panel-${proyecto.slug}`} etiquetadoPor={`nav-${proyecto.slug}`} />
        <HudTecnologias proyecto={proyecto} />
        <button type="button" className={styles.cerrar} aria-label="Volver a todos los proyectos" onClick={alCerrar}>
          ✕
        </button>
      </motion.div>
    </motion.article>
  );
}
