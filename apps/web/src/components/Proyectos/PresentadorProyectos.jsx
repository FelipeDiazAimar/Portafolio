'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { listarProyectos } from '../../lib/proyectos.js';
import { indicePorTecla } from '../../lib/navegacionProyectos.js';
import ListaProyectos from './ListaProyectos.jsx';
import Problematica from './Problematica.jsx';
import { HudTecnologias } from './HudTecnologias.jsx';
import styles from './PresentadorProyectos.module.css';

// Etiqueta legible del tipo de proyecto para la cabecera.
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

// Presentador de proyectos estilo réplica de Hover Tabs: fondo con la imagen
// del proyecto activo, lista de pestañas a la izquierda, cabecera centrada,
// tarjeta de problemática abajo a la derecha y HUD de tecnologías.
export default function PresentadorProyectos() {
  const [proyectos] = useState(() => listarProyectos());
  const [activo, setActivo] = useState(0);
  const marcoRef = useRef(null);
  const visibleRef = useRef(false);
  const proyecto = proyectos[activo] ?? proyectos[0];

  // Observa si el marco está al menos 50% visible para las flechas globales.
  useEffect(() => {
    const marco = marcoRef.current;
    if (!marco || typeof IntersectionObserver === 'undefined') {
      visibleRef.current = true;
      return undefined;
    }
    const observador = new IntersectionObserver(
      (entradas) => {
        visibleRef.current = entradas[0]?.isIntersecting ?? false;
      },
      { threshold: 0.5 },
    );
    observador.observe(marco);
    return () => observador.disconnect();
  }, []);

  // Flechas ↑/↓ globales: cambian de proyecto solo si el marco está visible
  // y el foco no está en un campo de texto.
  useEffect(() => {
    const total = proyectos.length;
    const alTeclarGlobal = (e) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      if (!visibleRef.current) return;
      const foco = document.activeElement;
      if (!foco) return;
      if (foco.tagName === 'INPUT' || foco.tagName === 'TEXTAREA' || foco.isContentEditable) return;
      e.preventDefault();
      setActivo((previo) => indicePorTecla(e.key, previo, total) ?? previo);
    };
    window.addEventListener('keydown', alTeclarGlobal);
    return () => window.removeEventListener('keydown', alTeclarGlobal);
  }, [proyectos.length]);

  return (
    <div
      ref={marcoRef}
      className={styles.marco}
      style={{ '--acento': proyecto.color, '--alto-hud': '76px' }}
    >
      <div className={styles.fondo} aria-hidden="true">
        {proyectos.map((item, i) => (
          <div
            key={item.slug}
            className={i === activo ? `${styles.capa} ${styles.capaActiva}` : styles.capa}
          >
            <Image
              src={item.imagenes?.portada ?? ''}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 1240px"
              style={{ objectFit: 'cover', objectPosition: 'top center' }}
              priority={i === 0}
            />
          </div>
        ))}
        <div className={styles.velo} />
      </div>

      <header className={styles.cabecera}>
        <AnimatePresence mode="wait">
          <motion.div
            key={proyecto.slug}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
          >
            <p className={styles.linea}>{lineaCabecera(proyecto)}</p>
            <h3 className={styles.tituloCabecera}>{proyecto.titulo}</h3>
          </motion.div>
        </AnimatePresence>
      </header>

      <ListaProyectos proyectos={proyectos} activo={activo} onCambiar={setActivo} />
      <Problematica proyecto={proyecto} />
      <HudTecnologias proyecto={proyecto} />
    </div>
  );
}
