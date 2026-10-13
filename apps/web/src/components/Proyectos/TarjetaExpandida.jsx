'use client';

import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import Problematica from './Problematica.jsx';
import { HudTecnologias } from './HudTecnologias.jsx';
import styles from './TarjetaExpandida.module.css';

// Etiqueta legible del tipo de proyecto (réplica de PresentadorProyectos).
const TIPO_LEGIBLE = {
  laboral: 'Trabajo en MBRF',
  cliente: 'Cliente',
  personal: 'Proyecto propio',
  academico: 'Académico',
};

// Arma "cliente · tipo legible · periodo" omitiendo los valores nulos.
function lineaCabecera(proyecto) {
  const partes = [
    proyecto.cliente,
    TIPO_LEGIBLE[proyecto.tipo] ?? proyecto.tipo,
    proyecto.periodo,
  ].filter(Boolean);
  return partes.join(' · ');
}

// NOTA PARA EL PADRE: este componente exporta un motion.article con
// initial/animate/exit. Móntalo dentro de <AnimatePresence mode="wait">
// para que la salida animada (exit) funcione. Ejemplo:
// <AnimatePresence mode="wait">
//   {proyecto && <TarjetaExpandida proyecto={proyecto} alCerrar={cerrar} />}
// </AnimatePresence>
export default function TarjetaExpandida({ proyecto, alCerrar }) {
  const movimientoReducido = useReducedMotion();
  if (!proyecto) return null;

  return (
    <motion.article
      className={styles.marcoTarjeta}
      style={{ '--acento': proyecto.color, '--alto-hud': '76px', '--inicio-chips': '1.5rem' }}
      data-zona-mixto="tarjeta"
      onPointerLeave={alCerrar}
      initial={movimientoReducido ? false : { opacity: 0, scale: 0.94, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={movimientoReducido ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
      transition={{ duration: movimientoReducido ? 0 : 0.35 }}
    >
      <div className={styles.fondo} aria-hidden="true">
        <Image
          src={proyecto.imagenes?.logo ?? proyecto.imagenes?.portada ?? ''}
          alt={proyecto.titulo}
          fill
          sizes="(max-width: 768px) 100vw, 900px"
          style={{ objectFit: 'cover', objectPosition: 'top center' }}
        />
        <div className={styles.velo} />
      </div>

      <header className={styles.cabecera}>
        <p className={styles.lineaCliente}>{lineaCabecera(proyecto)}</p>
        <h3 className={styles.tituloTarjeta}>{proyecto.titulo}</h3>
      </header>

      <Problematica
        proyecto={proyecto}
        idPanel="panel-mixto"
        etiquetadoPor={`nav-${proyecto.slug}`}
      />
      <HudTecnologias proyecto={proyecto} />

      <button
        type="button"
        className={styles.cerrar}
        aria-label="Cerrar vista expandida"
        onClick={alCerrar}
      >
        ✕
      </button>
    </motion.article>
  );
}
