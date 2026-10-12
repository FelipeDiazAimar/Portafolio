'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMotionValueEvent, useScroll } from 'framer-motion';
import hitos from '@/data/hitos.json';
import useConsulta from '@/hooks/useConsulta.js';
import { indiceDeHito, progresoDeHito } from '@/lib/hitoActivo.js';
import { tiempoModeloMs } from '@/lib/tiempoModelo.js';
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

  // Cada hito muestra primero su modelo haciendo todo lo suyo: la biografía no puede
  // abrirse hasta que pasa su tiempo (`tiempoModeloMs`). Si en ese momento el usuario
  // está apuntando la línea de tiempo (o tocó el hito, en celular), se abre sola.
  const refQuiereTexto = useRef(false);
  const refModeloMostrado = useRef(false);
  useEffect(() => {
    refModeloMostrado.current = false;
    setDetalleAbierto(false);
    const espera = setTimeout(() => {
      refModeloMostrado.current = true;
      if (refQuiereTexto.current) setDetalleAbierto(true);
    }, tiempoModeloMs(hitos[activo].id));
    return () => clearTimeout(espera);
  }, [activo]);

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
    if (!sinHover) return;
    refQuiereTexto.current = true;
    // Mismo hito y modelo ya mostrado: se abre ya; si no, cuando termine su tiempo.
    setDetalleAbierto(indice === activo && refModeloMostrado.current);
  }

  function cerrarDetalle() {
    refQuiereTexto.current = false;
    setDetalleAbierto(false);
  }

  // En dispositivos táctiles el foco y el hover no deben abrir ni cerrar nada:
  // tocar la descripción desenfoca el botón y cerraría el detalle sin querer.
  // Con el mouse, apuntar la línea de tiempo pide la biografía y salir la cierra (el
  // modelo vuelve y se queda); el texto sólo se abre si el modelo ya cumplió su tiempo.
  function alApuntar(abierto) {
    if (sinHover) return;
    refQuiereTexto.current = abierto;
    setDetalleAbierto(abierto && refModeloMostrado.current);
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
          onToqueHilo={cerrarDetalle}
        />

        {/* Se decide por "sin hover" y no por ancho: una tablet o un celular en
            horizontal usan el layout de escritorio pero igual necesitan una
            forma de cerrar el detalle. Montada sólo cuando hace falta. */}
        {sinHover && detalleAbierto ? (
          <button
            type="button"
            className={styles.cerrar}
            aria-label="Cerrar detalle"
            onClick={cerrarDetalle}
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
