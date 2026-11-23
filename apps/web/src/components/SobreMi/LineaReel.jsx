'use client';

// La línea de "Sobre mí": acá el scroll mueve el reel de costado, así que la línea también corre
// horizontal. Es un trazo largo (casi una pantalla por hito) de curvas amplias, con un solo rulo a
// mitad de camino; se desplaza con la fase del reel y se va dibujando (la punta queda un poco a la
// derecha del centro). El cuerpo va dentro del panel, sobre el fondo (luz y trama) y debajo del
// titular y las portadas; la punta va por encima, así siempre se ve.
// `refPoner.current(fase)` la mueve; la llama ReelHitos en cada cuadro.
import { useEffect, useRef } from 'react';
import { aRuta, COLOR_LINEA, grosorLinea, largoHasta, puntoEnLargo, tablaAvance, trazar } from '@/lib/trazos.js';
import styles from './ReelHitos.module.css';

const POR_HITO = 0.78; // ancho de trazo por hito, en pantallas
const LARGO_PUNTA = 90;

export default function LineaReel({ total, refPoner }) {
  const refSvg = useRef(null);
  const refPunta = useRef(null);

  useEffect(() => {
    const svg = refSvg.current;
    const svgPunta = refPunta.current;
    const panel = svg?.parentElement;
    if (!svg || !svgPunta || !panel || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const grupos = [svg.querySelector('g'), svgPunta.querySelector('g')];
    const ruta = svg.querySelector('path');
    const cola = svgPunta.querySelector('path');
    const [halo, cabeza] = svgPunta.querySelectorAll('circle');
    const grads = [svg.querySelector('linearGradient'), svgPunta.querySelector('linearGradient')];
    let medida = null;
    let fase = 0;

    const poner = (f) => {
      fase = f;
      if (!medida) return;
      const { W, recorrido, trazo, tabla } = medida;
      const avance = total > 1 ? Math.min(1, Math.max(0, f / (total - 1))) : 0;
      const corrimiento = avance * recorrido;
      const t = `translate(${(-corrimiento).toFixed(1)} 0)`;
      grupos.forEach((g) => g.setAttribute('transform', t));
      const largo = largoHasta(trazo, tabla, corrimiento + W * 0.62);
      ruta.style.strokeDashoffset = (trazo.largo - largo).toFixed(1);
      const desde = Math.max(0, largo - LARGO_PUNTA);
      cola.style.strokeDasharray = `${(largo - desde).toFixed(1)} ${trazo.largo * 2}`;
      cola.style.strokeDashoffset = (-desde).toFixed(1);
      const [px, py] = puntoEnLargo(trazo, largo);
      for (const c of [halo, cabeza]) {
        c.setAttribute('cx', px.toFixed(1));
        c.setAttribute('cy', py.toFixed(1));
      }
    };

    const armar = () => {
      const W = panel.clientWidth;
      const H = panel.clientHeight;
      if (W < 2 || H < 2) return;
      const movil = W < 768;
      const recorrido = (total - 1) * W * POR_HITO;
      const largoX = W + recorrido;
      const base = H * (movil ? 0.5 : 0.62);
      // curvas amplias: dos ondas superpuestas (una larga y una más corta), sin quiebres
      const ola = H * 0.13;
      const guia = (u) => {
        const x = -W * 0.08 + u * (largoX + W * 0.16);
        const fase1 = u * Math.PI * Math.max(1, total - 1) * 0.55;
        return [x, base + Math.sin(fase1 + 0.4) * ola + Math.sin(fase1 * 2.3 + 1.1) * ola * 0.35];
      };
      const R = Math.min(W, H) * (movil ? 0.08 : 0.1);
      const trazo = trazar(guia, [{ u: 0.5, r: R, sentido: -1 }]);
      const d = aRuta(trazo.puntos);
      const ancho = grosorLinea(W);
      ruta.setAttribute('d', d);
      ruta.setAttribute('stroke-width', ancho.toFixed(1));
      ruta.style.strokeDasharray = `${trazo.largo} ${trazo.largo + 10}`;
      cola.setAttribute('d', d);
      cola.setAttribute('stroke-width', ancho.toFixed(1));
      halo.setAttribute('r', (ancho * 1.6).toFixed(1));
      cabeza.setAttribute('r', (ancho * 0.62).toFixed(1));
      grads.forEach((g) => g.setAttribute('x2', String(Math.round(W * 1.2))));
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

  const { c0, c1 } = COLOR_LINEA;
  const degrade = (id) => (
    <linearGradient id={id} gradientUnits="userSpaceOnUse" spreadMethod="reflect" x1="0" y1="0" x2="1600" y2="0">
      <stop offset="0" stopColor={c0} />
      <stop offset="1" stopColor={c1} />
    </linearGradient>
  );
  return (
    <>
      <svg ref={refSvg} className={styles.linea} aria-hidden="true">
        <defs>{degrade('linea-reel')}</defs>
        <g>
          <path stroke="url(#linea-reel)" />
        </g>
      </svg>
      <svg ref={refPunta} className={`${styles.linea} ${styles.lineaPunta}`} aria-hidden="true">
        <defs>{degrade('linea-reel-punta')}</defs>
        <g>
          <path stroke="url(#linea-reel-punta)" />
          <circle className={styles.lineaHalo} />
          <circle className={styles.lineaCabeza} />
        </g>
      </svg>
    </>
  );
}
