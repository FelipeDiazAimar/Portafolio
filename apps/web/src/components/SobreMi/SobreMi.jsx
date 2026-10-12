'use client';

import { useCallback, useRef, useState } from 'react';
import { useMotionValueEvent, useScroll } from 'framer-motion';
import hitos from '@/data/hitos.json';
import useConsulta from '@/hooks/useConsulta.js';
import { indiceDeHito, progresoDeHito } from '@/lib/hitoActivo.js';
import FondoHito from './FondoHito.jsx';
import LineaTiempo from './LineaTiempo.jsx';
import EncabezadoHito from './EncabezadoHito.jsx';
import Escena3D from './Escena3D/Escena3D.jsx';
import DescripcionHito from './DescripcionHito.jsx';
import styles from './SobreMi.module.css';

function SobreMiContenido() {
  const refContenedor = useRef(null);
  const [activo, setActivo] = useState(0);
  // Un solo estado para los dos mundos: en escritorio lo mueven el hover y el
  // foco; en celular, los toques sobre un punto, el hilo y la "×".
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const sinHover = !useConsulta('(hover: hover) and (pointer: fine)');

  const { scrollYProgress } = useScroll({
    target: refContenedor,
    offset: ['start start', 'end end'],
  });
  useMotionValueEvent(scrollYProgress, 'change', (progreso) => {
    setActivo(indiceDeHito(progreso, hitos.length));
  });

  const irAlHito = useCallback((indice) => {
    const contenedor = refContenedor.current;
    if (!contenedor) return;
    const recorrido = contenedor.offsetHeight - window.innerHeight;
    const arriba = contenedor.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top: arriba + progresoDeHito(indice, hitos.length) * recorrido,
      behavior: 'smooth',
    });
  }, []);

  function alSeleccionar(indice) {
    irAlHito(indice);
    if (sinHover) setDetalleAbierto(true);
  }

  // En dispositivos táctiles el foco y el hover no deben abrir ni cerrar nada:
  // tocar la descripción desenfoca el botón y cerraría el detalle sin querer.
  function alApuntar(abierto) {
    if (!sinHover) setDetalleAbierto(abierto);
  }

  const hito = hitos[activo];

  return (
    <section id="sobre-mi" ref={refContenedor} className={styles.contenedor} style={{ '--hitos': hitos.length }}>
      <div className={styles.panel} data-detalle={detalleAbierto}>
        <FondoHito hitos={hitos} activo={activo} />
        <h2 className={styles.etiqueta}>Sobre mí</h2>

        <div
          className={styles.columna}
          onPointerLeave={(evento) => {
            // Al salir de la columna con el mouse el detalle se cierra (se abre apuntando la línea de tiempo).
            if (evento.pointerType === 'mouse') setDetalleAbierto(false);
          }}
        >
          <EncabezadoHito hito={hito} />
          <div className={styles.zona}>
            <Escena3D
              hito={hito}
              desarmado={detalleAbierto}
              onInteraccion={() => setDetalleAbierto(false)}
            />
            <DescripcionHito hito={hito} visible={detalleAbierto} />
          </div>
        </div>

        <LineaTiempo
          hitos={hitos}
          activo={activo}
          onSeleccionar={alSeleccionar}
          onApuntarActivo={alApuntar}
          onToqueHilo={() => setDetalleAbierto(false)}
        />

        {/* Se decide por "sin hover" y no por ancho: una tablet o un celular en
            horizontal usan el layout de escritorio pero igual necesitan una
            forma de cerrar el detalle. Montada sólo cuando hace falta. */}
        {sinHover && detalleAbierto ? (
          <button
            type="button"
            className={styles.cerrar}
            aria-label="Cerrar detalle"
            onClick={() => setDetalleAbierto(false)}
          >
            ×
          </button>
        ) : null}
      </div>
    </section>
  );
}

export default function SobreMi() {
  return hitos.length > 0 ? <SobreMiContenido /> : null;
}
