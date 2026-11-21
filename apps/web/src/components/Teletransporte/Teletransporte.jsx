'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { confirmarVistaPrevia, ponerTransicion } from '@/lib/teletransporte.js';
import styles from './Teletransporte.module.css';

// Efecto del salto entre secciones: una lámina de vidrio líquido que nace en el ítem del menú y
// baja hasta tapar la pantalla, con el borde curvo (la punta va adelante, justo debajo del ítem, y
// los costados la siguen: el "curve swipe" de GSAP). Tapada la pantalla se hace el salto por
// detrás del vidrio, y la lámina se recoge hacia el ítem dejando ver la sección de destino.
// Si llega otro salto a mitad de camino (pasar de un ítem al siguiente), la lámina vuelve a bajar
// desde donde esté: nunca arranca de cero ni deja dos saltos encimados.
// Además escucha la rueda y el toque: si el usuario empieza a desplazarse durante una vista
// previa, se queda donde está.

// Tiempos (s): la vista previa del hover es más ágil que el clic.
const TIEMPOS = { rapido: { tapar: 0.3, destapar: 0.46 }, clic: { tapar: 0.38, destapar: 0.6 } };
const SOBRA = 180; // cuánto pasa el borde de abajo de la pantalla al tapar del todo

// Forma de la lámina para una cobertura `c` (0 = recogida, 1 = tapa todo): la punta (bajo el
// ítem) va por delante y los costados por detrás.
function forma(c, ox, W, H) {
  const D = H + SOBRA;
  const punta = D * (1 - Math.pow(1 - c, 2.2));
  const lados = D * Math.pow(c, 2.2);
  // control de la cuadrática: su vértice queda a la altura de la punta
  const control = 2 * punta - lados;
  const borde = `M${W} ${lados.toFixed(1)} Q${ox.toFixed(1)} ${control.toFixed(1)} 0 ${lados.toFixed(1)}`;
  return { borde, relleno: `M0 0 H${W} V${lados.toFixed(1)} Q${ox.toFixed(1)} ${control.toFixed(1)} 0 ${lados.toFixed(1)} Z` };
}

export default function Teletransporte() {
  const refLamina = useRef(null);
  const refBorde = useRef(null);
  const refSvg = useRef(null);

  useEffect(() => {
    const lamina = refLamina.current;
    const svg = refSvg.current;
    const bordes = refBorde.current ? Array.from(refBorde.current.querySelectorAll('path')) : [];
    if (!lamina || !svg) return undefined;
    const estado = { c: 0, ox: window.innerWidth / 2 };
    let pendiente = null;
    let tween = null;

    const pintar = () => {
      const W = window.innerWidth;
      const H = window.innerHeight;
      const visible = estado.c > 0.001;
      lamina.style.visibility = visible ? 'visible' : 'hidden';
      svg.style.visibility = visible ? 'visible' : 'hidden';
      if (!visible) return;
      const { borde, relleno } = forma(estado.c, estado.ox, W, H);
      lamina.style.clipPath = `path('${relleno}')`;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      bordes.forEach((p) => p.setAttribute('d', borde));
    };

    const destapar = (t) => {
      tween = gsap.to(estado, { c: 0, duration: t.destapar, ease: 'power2.inOut', onUpdate: pintar });
    };
    const correr = (t) => {
      const ejecutar = pendiente;
      pendiente = null;
      ejecutar?.();
      // un respiro con la pantalla tapada, y se recoge
      tween = gsap.delayedCall(0.04, () => destapar(t));
    };

    const quitar = ponerTransicion(({ rapido, origen, ejecutar, quieto }) => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        ejecutar();
        return;
      }
      const t = rapido ? TIEMPOS.rapido : TIEMPOS.clic;
      // Volver a donde ya se está con la lámina todavía bajando (se salió del ítem antes del
      // salto): no hay nada que tapar, se anula el salto pendiente y la lámina se recoge.
      if (quieto && estado.c < 0.999) {
        pendiente = null;
        tween?.kill();
        ejecutar();
        destapar(t);
        return;
      }
      // el último pedido es el que vale (el anterior ya no hace falta: se iba a otro lado)
      pendiente = ejecutar;
      tween?.kill();
      if (origen) estado.ox = origen.x;
      if (estado.c >= 0.999) {
        correr(t);
        return;
      }
      tween = gsap.to(estado, {
        c: 1,
        duration: t.tapar * (1 - estado.c * 0.6),
        ease: 'power2.in',
        onUpdate: pintar,
        onComplete: () => correr(t),
      });
    });

    const alRedimensionar = () => pintar();
    window.addEventListener('resize', alRedimensionar);
    return () => {
      quitar();
      tween?.kill();
      // si quedaba un salto en espera, se hace igual (sin animación)
      pendiente?.();
      window.removeEventListener('resize', alRedimensionar);
    };
  }, []);

  useEffect(() => {
    window.addEventListener('wheel', confirmarVistaPrevia, { passive: true });
    window.addEventListener('touchstart', confirmarVistaPrevia, { passive: true });
    window.addEventListener('keydown', confirmarVistaPrevia);
    return () => {
      window.removeEventListener('wheel', confirmarVistaPrevia);
      window.removeEventListener('touchstart', confirmarVistaPrevia);
      window.removeEventListener('keydown', confirmarVistaPrevia);
    };
  }, []);

  return (
    <>
      <div ref={refLamina} className={styles.lamina} aria-hidden="true" />
      <svg ref={refSvg} className={styles.borde} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <filter id="tele-brillo" x="-10%" y="-50%" width="120%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        <g ref={refBorde}>
          {/* el canto del vidrio: un halo ancho y difuso, una sombra apenas por debajo y una
              línea de luz fina encima */}
          <path className={styles.halo} filter="url(#tele-brillo)" />
          <path className={styles.sombra} />
          <path className={styles.luz} />
        </g>
      </svg>
    </>
  );
}
