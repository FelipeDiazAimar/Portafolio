'use client';

// La línea de "Sobre mí", continuación de la que viene del hero. Entra por el borde de arriba del
// panel en el mismo punto donde termina la del hero (ENTRADA_REEL), baja pegada al borde izquierdo y
// se vuelve horizontal: acá el scroll mueve el reel de costado, así que la línea también corre de
// costado.
//   - mientras el panel sube, la entrada se dibuja con el scroll vertical (la punta sigue a la
//     altura de la pantalla, como la línea del resto del sitio);
//   - ya con el panel arriba, el tramo horizontal se desplaza con la fase del reel y se va dibujando
//     (la punta queda un poco a la derecha del centro).
// Va dentro del panel, sobre el fondo (luz y trama) y debajo del titular y las portadas, por la
// franja libre de abajo: así nunca cruza una portada y su final siempre está a la vista.
// `refPoner.current(fase)` le pasa la fase del reel; ReelHitos la llama en cada cuadro.
import { useEffect, useRef } from 'react';
import { alCuadro } from '@/lib/movimiento.js';
import { aRuta, bezier, COLOR_LINEA, ENTRADA_REEL, grosorLinea, largoHasta, tablaAvance, trazar, unirTrazos } from '@/lib/trazos.js';
import styles from './ReelHitos.module.css';

const POR_HITO = 0.78; // ancho de trazo por hito, en pantallas
// dónde hay un giro cerrado (u del tramo horizontal) y hacia qué lado
const GIROS = [
  [0.2, -1],
  [0.36, 1],
  [0.71, -1],
  [0.86, 1],
];

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
    let ultimo = '';

    const pintar = () => {
      if (!medida) return;
      const { W, recorrido, entrada, horizontal, trazo, tablaY, tablaX } = medida;
      const avance = total > 1 ? Math.min(1, Math.max(0, fase / (total - 1))) : 0;
      const corrimiento = avance * recorrido;
      // la entrada sigue al scroll vertical mientras el panel sube; después, el reel
      const arriba = panel.getBoundingClientRect().top;
      const vertical = largoHasta(entrada, tablaY, window.innerHeight * 0.9 - arriba);
      const largo = vertical < entrada.largo - 0.5 ? vertical : entrada.largo + largoHasta(horizontal, tablaX, corrimiento + W * 0.62);
      const clave = `${corrimiento.toFixed(1)}|${largo.toFixed(1)}`;
      if (clave === ultimo) return;
      ultimo = clave;
      grupo.setAttribute('transform', `translate(${(-corrimiento).toFixed(1)} 0)`);
      ruta.style.strokeDashoffset = (trazo.largo - largo).toFixed(1);
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
      // por la franja libre de abajo, debajo de las portadas
      const base = H * (movil ? 0.5 : 0.87);
      const x0 = W * 0.06;
      // entrada: desde el borde de arriba, donde termina la línea del hero, pegada al borde izquierdo
      // (por fuera de las portadas) hasta el comienzo del tramo horizontal, yendo hacia la derecha
      const xE = W * ENTRADA_REEL;
      const entrada = trazar(bezier([xE, -2], [W * 0.03, H * 0.12], [x0 - W * 0.12, base], [x0, base]));
      // horizontal: ondas bajas y, de vez en cuando, un giro cerrado (pulsos angostos), con un rulo
      const ola = H * (movil ? 0.06 : 0.035);
      const largoX = W * 0.9 + recorrido;
      const guia = (u) => {
        const fase1 = u * Math.PI * Math.max(1, total - 1) * 0.55;
        // arranca plana y hacia la derecha: así empalma con la entrada
        const suave = Math.min(1, u * 6);
        const bruscos = GIROS.reduce((acc, [c, signo]) => acc + signo * Math.exp(-(((u - c) / 0.012) ** 2)), 0) * H * 0.055;
        return [x0 + u * largoX, base + (Math.sin(fase1) * ola + Math.sin(fase1 * 2.3) * ola * 0.35 + bruscos) * suave];
      };
      const R = Math.min(W, H) * (movil ? 0.06 : 0.05);
      const horizontal = trazar(guia, [{ u: 0.53, r: R, sentido: -1 }]);
      const trazo = unirTrazos(entrada, horizontal);
      ruta.setAttribute('d', aRuta(trazo.puntos));
      ruta.setAttribute('stroke-width', grosorLinea(W).toFixed(1));
      ruta.style.strokeDasharray = `${trazo.largo} ${trazo.largo + 10}`;
      grad.setAttribute('x2', String(Math.round(W * 1.2)));
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
  return (
    <svg ref={refSvg} className={styles.linea} aria-hidden="true">
      <defs>
        <linearGradient id="linea-reel" gradientUnits="userSpaceOnUse" spreadMethod="reflect" x1="0" y1="0" x2="1600" y2="0">
          <stop offset="0" stopColor={c0} />
          <stop offset="1" stopColor={c1} />
        </linearGradient>
      </defs>
      <g>
        <path stroke="url(#linea-reel)" />
      </g>
    </svg>
  );
}
