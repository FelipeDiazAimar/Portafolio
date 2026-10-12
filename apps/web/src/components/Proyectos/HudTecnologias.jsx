'use client';

import { useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { LogoLoop } from '../LogoLoop/LogoLoop.jsx';
import { TECNOLOGIAS, tecnologiaPorId } from '@/data/tecnologias.js';
import { IconoTecnologia } from './iconosTecnologias.jsx';
import styles from './HudTecnologias.module.css';

// Franja inferior del .marco del presentador + fila de chips del stack.
// El .marco (position:relative, con --acento y --alto-hud inline) lo crea otro paso;
// este componente solo renderiza dos hermanas posicionadas dentro de él.
export function HudTecnologias({ proyecto }) {
  const slug = proyecto?.slug ?? '';
  const reduceMotion = useReducedMotion();

  // Ralentiza el carrusel 2,5 s después de cada cambio de proyecto.
  const [reciente, setReciente] = useState(true);
  useEffect(() => {
    setReciente(true);
    const t = setTimeout(() => setReciente(false), 2500);
    return () => clearTimeout(t);
  }, [slug]);

  const speed = reduceMotion ? 0 : reciente ? 10 : 40;

  const enStack = useMemo(() => new Set(proyecto?.stack ?? []), [proyecto]);

  // Mapa nombre -> id como respaldo si un item del carrusel no trajera id.
  const idPorNombre = useMemo(() => {
    const mapa = new Map();
    for (const t of TECNOLOGIAS) mapa.set(t.nombre, t.id);
    return mapa;
  }, []);

  const logos = useMemo(
    () =>
      TECNOLOGIAS.map((t) => ({
        id: t.id,
        node: <IconoTecnologia id={t.id} />,
        title: t.nombre,
        href: t.href,
      })),
    []
  );

  const chips = useMemo(() => {
    if (!Array.isArray(proyecto?.stack)) return [];
    return proyecto.stack
      .slice(0, 8)
      .map((id) => tecnologiaPorId(id))
      .filter(Boolean);
  }, [proyecto]);

  return (
    <>
      <div className={styles.chips} key={slug} aria-label="Stack de este proyecto">
        {chips.map((t, i) => (
          <span
            key={t.id}
            className={styles.chip}
            style={{ transitionDelay: `${i * 40}ms`, animationDelay: `${i * 40}ms` }}
          >
            <IconoTecnologia id={t.id} className={styles.chipIcono} />
            <span className={styles.chipNombre}>{t.nombre}</span>
          </span>
        ))}
      </div>

      <div className={styles.hud}>
        <span className={styles.rotulo}>STACK</span>
        <div className={styles.carrusel}>
          <LogoLoop
            logos={logos}
            speed={speed}
            direction="left"
            logoHeight={26}
            gap={44}
            hoverSpeed={8}
            fadeOut
            fadeOutColor="#05070c"
            ariaLabel="Tecnologías"
            renderItem={(item) => {
              const id = item.id ?? idPorNombre.get(item.title);
              const activa = enStack.has(id);
              return (
                <span
                  className={styles.logo}
                  data-activa={activa ? 'true' : 'false'}
                  title={item.title}
                >
                  {item.node}
                  {activa && <small className={styles.nombre}>{item.title}</small>}
                </span>
              );
            }}
          />
        </div>
      </div>
    </>
  );
}

export default HudTecnologias;
