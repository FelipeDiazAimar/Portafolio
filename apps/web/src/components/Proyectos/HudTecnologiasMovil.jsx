'use client';

import { useEffect, useMemo, useRef } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { TECNOLOGIAS, tecnologiaPorId } from '@/data/tecnologias.js';
import { IconoTecnologia } from './iconosTecnologias.jsx';
import styles from './HudTecnologias.module.css';

// Carrusel de tecnologías del celular: se desliza de lado con el dedo y tiene la lupa del dock de
// categorías (Habilidades): el ítem más cercano al dedo se ensancha y el resto se corre, sin superponerse.
// Primero van las tecnologías del proyecto (color, nombre y esquinas de mira) y después las demás.
// Las del proyecto llevan el nombre debajo: necesitan más ancho para no pisarse
const ANCHO = { normal: [52, 84], activa: [92, 118] };
// El carrusel avanza solo (px/s) y se frena mientras se lo toca; retoma tras este tiempo sin tocarlo (ms).
const VELOCIDAD = 30;
const REANUDA_MS = 1500;

function ItemTec({ id, activa, nombre, dedoX, copia = false }) {
  const ref = useRef(null);
  const distancia = useTransform(dedoX, (x) => {
    const caja = ref.current?.getBoundingClientRect();
    return caja ? x - caja.x - caja.width / 2 : 9999;
  });
  const [base, maximo] = activa ? ANCHO.activa : ANCHO.normal;
  const ancho = useSpring(useTransform(distancia, [-110, 0, 110], [base, maximo, base]), { mass: 0.1, stiffness: 190, damping: 13 });
  const escala = useTransform(ancho, [base, maximo], [1, 1.5]);
  return (
    <motion.span ref={ref} role={copia ? 'presentation' : 'listitem'} aria-hidden={copia ? true : undefined} className={styles.itemMovil} data-activa={activa ? 'true' : 'false'} style={{ width: ancho }} title={nombre}>
      <motion.span className={styles.iconoMovil} style={{ scale: escala }}>
        <IconoTecnologia id={id} />
      </motion.span>
      {activa && <small className={styles.nombre}>{nombre}</small>}
    </motion.span>
  );
}

export default function HudTecnologiasMovil({ proyecto }) {
  const dedoX = useMotionValue(Infinity);
  const ids = useMemo(() => {
    const pila = Array.isArray(proyecto?.stack) ? proyecto.stack.filter((id) => tecnologiaPorId(id)) : [];
    const resto = TECNOLOGIAS.map((t) => t.id).filter((id) => !pila.includes(id));
    return { pila, resto };
  }, [proyecto]);
  const slug = proyecto?.slug ?? '';

  // Deriva sola hacia la izquierda. La lista va dos veces seguidas: al llegar al final de la primera tanda
  // se vuelve al principio sin que se note. Si el dedo (o su inercia) la mueve, se frena y retoma después.
  const reducido = useReducedMotion();
  const refCarrusel = useRef(null);
  useEffect(() => {
    const el = refCarrusel.current;
    if (!el || reducido) return undefined;
    el.scrollLeft = 0;
    let pos = 0;
    let ultimaMano = performance.now();
    let ultimo = performance.now();
    let raf = 0;
    const tocando = { v: false };
    const alTocar = () => {
      tocando.v = true;
      ultimaMano = performance.now();
    };
    const alSoltar = () => {
      tocando.v = false;
      ultimaMano = performance.now();
    };
    el.addEventListener('touchstart', alTocar, { passive: true });
    el.addEventListener('touchend', alSoltar, { passive: true });
    el.addEventListener('touchcancel', alSoltar, { passive: true });
    const cuadro = (t) => {
      raf = requestAnimationFrame(cuadro);
      const dt = Math.min(0.05, (t - ultimo) / 1000);
      ultimo = t;
      // si lo movió alguien más (dedo, inercia), se toma esa posición y se espera
      if (Math.abs(el.scrollLeft - pos) > 2) {
        pos = el.scrollLeft;
        ultimaMano = t;
      }
      if (tocando.v || t - ultimaMano < REANUDA_MS) return;
      const items = el.children;
      const n = ids.pila.length + ids.resto.length;
      const periodo = items[n] ? items[n].offsetLeft - items[0].offsetLeft : 0;
      if (!periodo) return;
      pos += VELOCIDAD * dt;
      if (pos >= periodo) pos -= periodo;
      el.scrollLeft = pos;
    };
    raf = requestAnimationFrame(cuadro);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('touchstart', alTocar);
      el.removeEventListener('touchend', alSoltar);
      el.removeEventListener('touchcancel', alSoltar);
    };
  }, [slug, reducido, ids]);

  return (
    <div className={styles.hud}>
      <div
        key={slug}
        ref={refCarrusel}
        className={styles.carruselMovil}
        aria-label="Tecnologías"
        role="list"
        // la lupa sigue al dedo mientras está apoyado, también al deslizar (los eventos táctiles siguen llegando)
        onTouchStart={(e) => dedoX.set(e.touches[0].clientX)}
        onTouchMove={(e) => dedoX.set(e.touches[0].clientX)}
        onTouchEnd={() => dedoX.set(Infinity)}
        onTouchCancel={() => dedoX.set(Infinity)}
        data-no-deslizar
      >
        {ids.pila.map((id) => (
          <ItemTec key={id} id={id} activa nombre={tecnologiaPorId(id)?.nombre} dedoX={dedoX} />
        ))}
        {ids.resto.map((id) => (
          <ItemTec key={id} id={id} activa={false} nombre={tecnologiaPorId(id)?.nombre} dedoX={dedoX} />
        ))}
        {/* segunda tanda: sólo para que el recorrido sea continuo */}
        {ids.pila.map((id) => (
          <ItemTec key={`c-${id}`} id={id} activa nombre={tecnologiaPorId(id)?.nombre} dedoX={dedoX} copia />
        ))}
        {ids.resto.map((id) => (
          <ItemTec key={`c-${id}`} id={id} activa={false} nombre={tecnologiaPorId(id)?.nombre} dedoX={dedoX} copia />
        ))}
      </div>
    </div>
  );
}
