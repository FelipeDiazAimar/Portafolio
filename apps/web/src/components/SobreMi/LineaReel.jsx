'use client';

// La línea de "Sobre mí": acá el scroll mueve el reel de costado, así que la línea también corre
// horizontal. Es un trazo largo (una pantalla y pico por hito) con un rulo redondo entre hito e hito;
// se desplaza con la fase del reel y se va dibujando: la punta queda un poco a la derecha del centro.
// Va dentro del panel, sobre el fondo (luz y trama) y debajo del titular y las portadas.
// `refPoner.current(fase)` la mueve; la llama ReelHitos en cada cuadro.
import { useEffect, useRef } from 'react';
import { aRuta, grosorLinea, largoHasta, PRESETS, tablaAvance, trazar } from '@/lib/trazos.js';
import styles from './ReelHitos.module.css';

const POR_HITO = 0.78; // ancho de trazo por hito, en pantallas

export default function LineaReel({ total, refPoner }) {
  const refSvg = useRef(null);

  useEffect(() => {
    const svg = refSvg.current;
    const panel = svg?.parentElement;
    if (!svg || !panel || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const grupo = svg.querySelector('g');
    const ruta = svg.querySelector('path');
    const grad = svg.querySelector('linearGradient');
    let medida = null;
    let fase = 0;

    const poner = (f) => {
      fase = f;
      if (!medida) return;
      const { W, recorrido, trazo, tabla } = medida;
      const avance = total > 1 ? Math.min(1, Math.max(0, f / (total - 1))) : 0;
      const corrimiento = avance * recorrido;
      grupo.setAttribute('transform', `translate(${(-corrimiento).toFixed(1)} 0)`);
      const largo = largoHasta(trazo, tabla, corrimiento + W * 0.62);
      ruta.style.strokeDashoffset = (trazo.largo - largo).toFixed(1);
    };

    const armar = () => {
      const W = panel.clientWidth;
      const H = panel.clientHeight;
      if (W < 2 || H < 2) return;
      const movil = W < 768;
      const recorrido = (total - 1) * W * POR_HITO;
      const largoX = W + recorrido;
      const base = H * (movil ? 0.5 : 0.66);
      const ola = H * 0.07;
      const guia = (u) => {
        const x = -W * 0.08 + u * (largoX + W * 0.16);
        return [x, base + Math.sin(u * Math.PI * (total - 1) * 1.0 + 0.6) * ola];
      };
      const R = Math.min(W, H) * (movil ? 0.07 : 0.085);
      const lazos = [];
      for (let k = 0; k < total - 1; k += 1) {
        // entre un hito y el siguiente (en u de la guía)
        const xMedio = W * 0.62 + (k + 0.5) * W * POR_HITO;
        lazos.push({ u: (xMedio + W * 0.08) / (largoX + W * 0.16), r: R * (k % 2 ? 0.8 : 1), sentido: k % 2 ? 1 : -1 });
      }
      const trazo = trazar(guia, lazos);
      ruta.setAttribute('d', aRuta(trazo.puntos));
      ruta.setAttribute('stroke-width', grosorLinea(W).toFixed(1));
      ruta.style.strokeDasharray = `${trazo.largo} ${trazo.largo + 10}`;
      grad.setAttribute('x1', '0');
      grad.setAttribute('x2', String(largoX));
      medida = { W, recorrido, trazo, tabla: tablaAvance(trazo, 0) };
      poner(fase);
    };

    armar();
    const ro = new ResizeObserver(armar);
    ro.observe(panel);
    refPoner.current = poner;
    return () => {
      ro.disconnect();
      refPoner.current = null;
    };
  }, [total, refPoner]);

  const { c0, c1 } = PRESETS.reel;
  return (
    <svg ref={refSvg} className={styles.linea} aria-hidden="true">
      <defs>
        <linearGradient id="linea-reel" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={c0} />
          <stop offset="0.5" stopColor={c1} />
          <stop offset="1" stopColor={c0} />
        </linearGradient>
      </defs>
      <g>
        <path stroke="url(#linea-reel)" />
      </g>
    </svg>
  );
}
