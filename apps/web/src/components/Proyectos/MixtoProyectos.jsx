'use client';

// Fase mixta de proyectos: marquesina a pantalla completa detrás,
// navegación a la izquierda y tarjeta expandida en primer plano.
// Solo el JSX: los estilos los crea otro agente (MixtoProyectos.module.css)
// y los hijos (MarquesinaInteractiva, NavegacionMixta, TarjetaExpandida)
// los crean otros pasos con el contrato de props usado aquí.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { listarProyectos } from '@/lib/proyectos';
import { indicePorTecla } from '@/lib/navegacionProyectos';
import MarquesinaInteractiva from './MarquesinaInteractiva.jsx';
import NavegacionMixta from './NavegacionMixta.jsx';
import TarjetaExpandida from './TarjetaExpandida.jsx';
import styles from './MixtoProyectos.module.css';

export default function MixtoProyectos() {
  // Catálogo ordenado por `orden` ascendente (estable entre renders).
  const proyectos = useMemo(() => listarProyectos(), []);

  // Proyecto activo por slug; null = ninguno.
  const [activoSlug, setActivoSlug] = useState(null);
  const proyecto = proyectos.find((p) => p.slug === activoSlug) ?? null;

  // Logos para la marquesina de fondo.
  const logos = proyectos.map((p) => ({
    slug: p.slug,
    titulo: p.titulo,
    logo: p.imagenes?.logo ?? p.imagenes?.portada ?? null,
  }));

  // Refs: fase (visibilidad), nav (contenedor) y timeout de respaldo.
  const faseRef = useRef(null);
  const navRef = useRef(null);
  const timeoutRef = useRef(null);
  const [faseVisible, setFaseVisible] = useState(false);

  // Cancela la selección programada pendiente, si la hay.
  const cancelarProgramada = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Limpia el timeout pendiente al desmontar.
  useEffect(() => () => {
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
  }, []);

  // Selección con retardo de 120 ms: respaldo para la marquesina, que
  // llama a alElegir directo sin delay propio. Cancela el anterior.
  const alElegir = useCallback((slug) => {
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      setActivoSlug(slug);
    }, 120);
  }, []);

  // Selección inmediata para clic, foco y teclado (la nav ya trae su
  // propio delay, así que aquí no se programa espera).
  const alElegirInmediato = useCallback(
    (slug) => {
      cancelarProgramada();
      setActivoSlug(slug);
    },
    [cancelarProgramada],
  );

  // Al salir: si el puntero sigue dentro de la fase (nav, marquesina o
  // tarjeta), no se limpia; si no, se cancela lo programado y se limpia.
  // El botón ✕ llama con relatedTarget null → limpia siempre.
  const manejarSalir = useCallback(
    (e) => {
      if (e?.relatedTarget?.closest?.('[data-zona-mixto]')) return;
      cancelarProgramada();
      setActivoSlug(null);
    },
    [cancelarProgramada],
  );

  // Visibilidad de la fase (≥40 %) para activar el teclado global.
  useEffect(() => {
    const fase = faseRef.current;
    if (!fase || typeof IntersectionObserver === 'undefined') return;
    const observador = new IntersectionObserver(
      ([entrada]) => setFaseVisible(entrada.isIntersecting),
      { threshold: 0.4 },
    );
    observador.observe(fase);
    return () => observador.disconnect();
  }, []);

  // Teclado global cuando la fase está visible: flechas navegan por el
  // orden de proyectos, Escape limpia. Se ignora en campos de texto.
  useEffect(() => {
    if (!faseVisible) return;
    const alTecla = (e) => {
      const objetivo = e.target;
      if (
        objetivo &&
        (objetivo.tagName === 'INPUT' ||
          objetivo.tagName === 'TEXTAREA' ||
          objetivo.isContentEditable)
      ) {
        return;
      }
      if (e.key === 'Escape') {
        cancelarProgramada();
        setActivoSlug(null);
        // Devuelve el foco al nav para no dejarlo perdido.
        if (activoSlug) {
          document.getElementById(`nav-${activoSlug}`)?.focus();
        }
        return;
      }
      if (
        e.key !== 'ArrowDown' &&
        e.key !== 'ArrowRight' &&
        e.key !== 'ArrowUp' &&
        e.key !== 'ArrowLeft'
      ) {
        return;
      }
      if (proyectos.length === 0) return;
      const hallado = proyectos.findIndex((p) => p.slug === activoSlug);
      // Sin activo, ArrowDown/ArrowRight empiezan en 0 y
      // ArrowUp/ArrowLeft en el final.
      const indiceActual =
        hallado === -1
          ? (e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? 0 : -1)
          : hallado;
      const siguiente = indicePorTecla(e.key, indiceActual, proyectos.length);
      if (siguiente === null) return;
      const destino = proyectos[siguiente];
      if (!destino) return;
      cancelarProgramada();
      setActivoSlug(destino.slug);
      document
        .getElementById(`nav-${destino.slug}`)
        ?.scrollIntoView({ block: 'nearest' });
    };
    window.addEventListener('keydown', alTecla);
    return () => window.removeEventListener('keydown', alTecla);
  }, [faseVisible, activoSlug, proyectos, cancelarProgramada]);

  return (
    <div className={styles.mixto} data-zona-mixto="fase" ref={faseRef}>
      <div className={styles.fondoMarquesina} data-zona-mixto="marquesina">
        <MarquesinaInteractiva
          logos={logos}
          activoSlug={activoSlug}
          alElegir={alElegir}
          alSalir={manejarSalir}
        />
      </div>
      <div className={styles.columnaNav} data-zona-mixto="nav">
        <NavegacionMixta
          proyectos={proyectos}
          activoSlug={activoSlug}
          alElegir={alElegirInmediato}
          alSalir={manejarSalir}
          navRef={navRef}
        />
      </div>
      {proyecto && (
        <div
          className={styles.zonaTarjeta}
          data-zona-mixto="tarjeta"
          key={activoSlug ?? 'ninguno'}
        >
          <AnimatePresence mode="wait">
            <TarjetaExpandida
              key={proyecto.slug}
              proyecto={proyecto}
              alCerrar={(e) => manejarSalir(e)}
            />
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
