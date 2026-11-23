'use client';

// La línea de "Sobre mí", continuación de la que viene del hero. Entra por el borde de arriba del
// panel en el mismo punto donde termina la del hero (ENTRADA_REEL), baja curvándose y se vuelve
// horizontal: acá el scroll mueve el reel de costado, así que la línea también corre de costado.
//   - mientras el panel sube, la entrada se dibuja con el scroll vertical (la punta sigue a la
//     altura de la pantalla, como la línea del resto del sitio);
//   - ya con el panel arriba, el tramo horizontal se desplaza con la fase del reel y se va dibujando
//     (la punta queda un poco a la derecha del centro). Curvas amplias y un solo rulo.
// El cuerpo va dentro del panel, sobre el fondo (luz y trama) y debajo del titular y las portadas;
// su último tramo va por encima, así siempre se ve hasta dónde llegó.
// `refPoner.current(fase)` le pasa la fase del reel; ReelHitos la llama en cada cuadro.
import { useEffect, useRef } from 'react';
import { alCuadro } from '@/lib/movimiento.js';
import { aRuta, bezier, COLOR_LINEA, ENTRADA_REEL, grosorLinea, largoHasta, tablaAvance, trazar, unirTrazos } from '@/lib/trazos.js';
import styles from './ReelHitos.module.css';

const POR_HITO = 0.78; // ancho de trazo por hito, en pantallas
const LARGO_PUNTA = 150;

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
    const grads = [svg.querySelector('linearGradient'), svgPunta.querySelector('linearGradient')];
    let medida = null;
    let fase = 0;
    let ultimo = '';

    const pintar = () => {
      if (!medida) return;
      const { W, recorrido, entrada, horizontal, trazo, tablaY, tablaX } = medida;
      const avance = total > 1 ? Math.min(1, Math.max(0, fase / (total - 1))) : 0;
      const corrimiento = avance * recorrido;
      // la entrada sigue al scroll vertical mientras el panel sube; después, el reel
      const arriba = panel.getBoundingClientRect().top;
      const vertical = largoHasta(entrada, tablaY, window.innerHeight * 0.72 - arriba);
      const largo = vertical < entrada.largo - 0.5 ? vertical : entrada.largo + largoHasta(horizontal, tablaX, corrimiento + W * 0.62);
      const clave = `${corrimiento.toFixed(1)}|${largo.toFixed(1)}`;
      if (clave === ultimo) return;
      ultimo = clave;
      const t = `translate(${(-corrimiento).toFixed(1)} 0)`;
      grupos.forEach((g) => g.setAttribute('transform', t));
      ruta.style.strokeDashoffset = (trazo.largo - largo).toFixed(1);
      const desde = Math.max(0, largo - LARGO_PUNTA);
      cola.style.strokeDasharray = `${(largo - desde).toFixed(1)} ${trazo.largo * 2}`;
      cola.style.strokeDashoffset = (-desde).toFixed(1);
    };
    const poner = (f) => {
      fase = f;
      pintar();
    };

    const armar = () => {
      const W = panel.clientWidth;
      const H = panel.clientHeight;
      if (W < 2 || H < 2) return;
      const movil = W < 768;
      const recorrido = (total - 1) * W * POR_HITO;
      const base = H * (movil ? 0.5 : 0.62);
      const x0 = W * 0.12;
      // entrada: desde el borde de arriba, donde termina la línea del hero, hasta el comienzo del
      // tramo horizontal (llega yendo hacia la derecha, sin quiebre)
      const xE = W * ENTRADA_REEL;
      const entrada = trazar(bezier([xE, -2], [xE, base * 0.55], [x0 - W * 0.24, base], [x0, base]));
      // horizontal: curvas amplias (dos ondas superpuestas), sin quiebres, con un rulo
      const ola = H * 0.13;
      const largoX = W * 0.9 + recorrido;
      const guia = (u) => {
        const fase1 = u * Math.PI * Math.max(1, total - 1) * 0.55;
        // arranca plana y hacia la derecha: así empalma con la entrada
        const suave = Math.min(1, u * 6);
        return [x0 + u * largoX, base + (Math.sin(fase1) * ola + Math.sin(fase1 * 2.3) * ola * 0.35) * suave];
      };
      const R = Math.min(W, H) * (movil ? 0.08 : 0.1);
      const horizontal = trazar(guia, [{ u: 0.5, r: R, sentido: -1 }]);
      const trazo = unirTrazos(entrada, horizontal);
      const d = aRuta(trazo.puntos);
      const ancho = grosorLinea(W);
      ruta.setAttribute('d', d);
      ruta.setAttribute('stroke-width', ancho.toFixed(1));
      ruta.style.strokeDasharray = `${trazo.largo} ${trazo.largo + 10}`;
      cola.setAttribute('d', d);
      cola.setAttribute('stroke-width', ancho.toFixed(1));
      grads.forEach((g) => g.setAttribute('x2', String(Math.round(W * 1.2))));
      medida = { W, recorrido, entrada, horizontal, trazo, tablaY: tablaAvance(entrada, 1), tablaX: tablaAvance(horizontal, 0) };
      ultimo = '';
      pintar();
    };

    armar();
    const ro = new ResizeObserver(armar);
    ro.observe(panel);
    refPoner.current = poner;
    // también mientras el panel sube (el reel todavía no manda su fase)
    const quitar = alCuadro(pintar);
    return () => {
      ro.disconnect();
      quitar();
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
        </g>
      </svg>
    </>
  );
}
