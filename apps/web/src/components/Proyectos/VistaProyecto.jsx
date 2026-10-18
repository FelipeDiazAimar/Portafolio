'use client';

import { motion } from 'framer-motion';
import TarjetaMarca from './TarjetaMarca.jsx';
import TextoTrazoVarios from '../TextoTrazo/TextoTrazoVarios.jsx';
import Problematica from './Problematica.jsx';
import EnlacesProyecto from './EnlacesProyecto.jsx';
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
export default function VistaProyecto({ proyecto, medir, tamano, reducido, instantaneo = false, alCerrar, indice = 0, total = 0 }) {
  const enMarquesina = (cambioDirecto = false) => {
    // Cambio de un proyecto a otro: desaparece de golpe (apenas pasa el cuadro en que el
    // nuevo ya está pintado encima), sin viajar de vuelta a su lugar.
    if (cambioDirecto) return { opacity: 0, transition: { duration: 0, delay: 0.15 } };
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
      custom={instantaneo}
      initial={instantaneo ? 'pantalla' : 'marquesina'}
      animate="pantalla"
      exit="marquesina"
      aria-labelledby={`titulo-${proyecto.slug}`}
    >
      <TarjetaMarca proyecto={proyecto} grande className={styles.fondo} />
      <motion.div
        className={styles.contenido}
        // En un cambio directo el velo y los textos ya están desde el primer cuadro: si
        // aparecían de a poco, se veía la tarjeta clara sin oscurecer (un "pantallazo").
        initial={{ opacity: instantaneo ? 1 : 0 }}
        animate={{ opacity: 1, transition: { delay: reducido ? 0 : 0.45, duration: 0.35 } }}
        exit={{ opacity: 0, transition: { duration: 0.12 } }}
      >
        <div className={styles.velo} aria-hidden="true" />
        <header className={styles.cabecera}>
          {total > 1 && (
            <p className={styles.paginador} aria-hidden="true">
              {String(indice + 1).padStart(2, '0')} / {String(total).padStart(2, '0')} · deslizá para cambiar
            </p>
          )}
          {/* La línea y el título se trazan y se rellenan (StrokeFill) cada vez que aparecen. */}
          <p className={styles.linea}>
            {lineaCabecera(proyecto)}
          </p>
          <h3 id={`titulo-${proyecto.slug}`} className={styles.titulo}>
            <TextoTrazoVarios key={`titulo-${proyecto.slug}`} texto={proyecto.titulo} claseTexto={styles.tituloTrazo} duracion={2.2} retraso={0.15} grosor={1.1} interlineado={1.05} />
          </h3>
          <EnlacesProyecto proyecto={proyecto} reducido={reducido} />
        </header>
        <Problematica proyecto={proyecto} idPanel={`panel-${proyecto.slug}`} etiquetadoPor={`nav-${proyecto.slug}`} sinFundido={instantaneo} />
        <HudTecnologias proyecto={proyecto} />
        <button type="button" className={styles.cerrar} aria-label="Volver a todos los proyectos" onClick={alCerrar}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M5 5l14 14M19 5L5 19" />
          </svg>
        </button>
      </motion.div>
    </motion.article>
  );
}
