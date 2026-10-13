'use client';

// Cierre de la sección Proyectos: la marquesina 3D de logos ocupa todo el fondo, la
// navegación va a la izquierda y, al apuntar un proyecto (en la lista o en la
// marquesina), su tarjeta se expande en primer plano igual que en el presentador.
// Al dejar de apuntarlo, vuelve la marquesina.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ThreeDMarquee } from '@/components/ui/3d-marquee.jsx';
import { listarProyectos } from '@/lib/proyectos';
import { indicePorTecla } from '@/lib/navegacionProyectos';
import NavegacionMixta from './NavegacionMixta.jsx';
import TarjetaExpandida from './TarjetaExpandida.jsx';
import styles from './MixtoProyectos.module.css';

// Intención de hover: evita que la tarjeta parpadee al cruzar la marquesina.
const DEMORA_MS = 120;

export default function MixtoProyectos() {
  const proyectos = useMemo(() => listarProyectos(), []);
  const [activoSlug, setActivoSlug] = useState(null);
  const proyecto = proyectos.find((p) => p.slug === activoSlug) ?? null;

  // Un logo por proyecto: cada uno aparece una sola vez en la marquesina.
  const logos = useMemo(
    () =>
      proyectos
        .map((p) => ({ src: p.imagenes?.logo ?? p.imagenes?.portada, clave: p.slug, titulo: p.titulo }))
        .filter((logo) => logo.src),
    [proyectos]
  );

  const refFase = useRef(null);
  const refDemora = useRef(null);
  const [faseVisible, setFaseVisible] = useState(false);

  const cancelarDemora = useCallback(() => clearTimeout(refDemora.current), []);
  useEffect(() => cancelarDemora, [cancelarDemora]);

  const elegirConDemora = useCallback((slug) => {
    clearTimeout(refDemora.current);
    refDemora.current = setTimeout(() => setActivoSlug(slug), DEMORA_MS);
  }, []);

  const elegirYa = useCallback(
    (slug) => {
      cancelarDemora();
      setActivoSlug(slug);
    },
    [cancelarDemora]
  );

  // Al salir de la lista, de un logo o de la tarjeta: si el puntero pasa a otra zona
  // de la fase (lista, marquesina o tarjeta) no se cierra; si sale del todo, sí.
  const alSalir = useCallback(
    (evento) => {
      const destino = evento?.relatedTarget;
      if (destino && typeof destino.closest === 'function' && destino.closest('[data-zona-mixto]')) return;
      cancelarDemora();
      setActivoSlug(null);
    },
    [cancelarDemora]
  );

  // El teclado global sólo cuando la fase está a la vista.
  useEffect(() => {
    const fase = refFase.current;
    if (!fase || typeof IntersectionObserver === 'undefined') return undefined;
    const observador = new IntersectionObserver(([entrada]) => setFaseVisible(entrada.isIntersecting), {
      threshold: 0.4,
    });
    observador.observe(fase);
    return () => observador.disconnect();
  }, []);

  // Flechas recorren los proyectos y Escape cierra la tarjeta (fuera de campos de texto).
  useEffect(() => {
    if (!faseVisible) return undefined;
    const alTecla = (e) => {
      const objetivo = e.target;
      if (objetivo && (objetivo.tagName === 'INPUT' || objetivo.tagName === 'TEXTAREA' || objetivo.isContentEditable)) return;
      if (e.key === 'Escape') {
        if (activoSlug) document.getElementById(`nav-${activoSlug}`)?.focus();
        cancelarDemora();
        setActivoSlug(null);
        return;
      }
      if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(e.key) || proyectos.length === 0) return;
      const hallado = proyectos.findIndex((p) => p.slug === activoSlug);
      const actual = hallado === -1 ? (e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? 0 : -1) : hallado;
      const siguiente = indicePorTecla(e.key, actual, proyectos.length);
      const destino = siguiente === null ? null : proyectos[siguiente];
      if (!destino) return;
      e.preventDefault();
      cancelarDemora();
      setActivoSlug(destino.slug);
      document.getElementById(`nav-${destino.slug}`)?.scrollIntoView({ block: 'nearest' });
    };
    window.addEventListener('keydown', alTecla);
    return () => window.removeEventListener('keydown', alTecla);
  }, [faseVisible, activoSlug, proyectos, cancelarDemora]);

  return (
    <div className={styles.mixto} ref={refFase} data-activo={proyecto ? 'true' : 'false'}>
      <div className={styles.fondoMarquesina}>
        <ThreeDMarquee
          images={logos}
          className={styles.marquesina}
          alApuntar={elegirConDemora}
          alSalir={alSalir}
          claveActiva={activoSlug}
        />
        <div className={styles.velo} aria-hidden="true" />
      </div>

      <div className={styles.columnaNav} data-zona-mixto="nav">
        <NavegacionMixta proyectos={proyectos} activoSlug={activoSlug} alElegir={elegirYa} alSalir={alSalir} />
      </div>

      <div className={styles.zonaTarjeta}>
        <AnimatePresence mode="wait">
          {proyecto ? (
            <TarjetaExpandida key={proyecto.slug} proyecto={proyecto} alCerrar={alSalir} />
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
