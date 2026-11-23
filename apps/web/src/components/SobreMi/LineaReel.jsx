'use client';

// La línea de "Sobre mí", continuación de la que viene del hero. Entra por el borde de arriba del
// panel en el mismo punto y con la misma dirección (hacia abajo) que trae la del hero
// (ENTRADA_REEL), se curva hacia la derecha y sigue por el medio de la pantalla: acá el scroll mueve
// el reel de costado, así que la línea también corre de costado.
//   - mientras el panel sube, la entrada se dibuja con el scroll vertical (la punta sigue a la
//     altura de la pantalla, como la línea del resto del sitio);
//   - ya con el panel arriba, el tramo horizontal se desplaza con la fase del reel y se va dibujando
//     (la punta queda a la derecha, entre la portada del frente y la siguiente).
// Va dentro del panel, sobre el fondo (luz y trama) y por detrás del titular y las portadas.
// `refPoner.current(fase)` le pasa la fase del reel; ReelHitos la llama en cada cuadro.
import { useEffect, useRef } from 'react';
import { alCuadro } from '@/lib/movimiento.js';
import { aRuta, bezier, COLOR_LINEA, ENTRADA_REEL, grosorLinea, largoHasta, tablaAvance, trazar, unirTrazos } from '@/lib/trazos.js';
import styles from './ReelHitos.module.css';

const POR_HITO = 0.78; // ancho de trazo por hito, en pantallas
// dónde queda la punta (fracción del ancho): en el hueco entre la portada del frente y la de la
// derecha, así nunca queda tapada
const PUNTA_X = 0.725;

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
      // misma regla que la línea del resto del sitio (punta a la altura del 56 % de la pantalla): así
      // empieza justo donde llega la del hero y se ven como un solo trazo
      const vertical = largoHasta(entrada, tablaY, window.innerHeight * 0.56 - arriba);
      const largo = vertical < entrada.largo - 0.5 ? vertical : entrada.largo + largoHasta(horizontal, tablaX, corrimiento + W * PUNTA_X);
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
      const recorrido = (total - 1) * W * POR_HITO;
      // por el medio de la pantalla
      const base = H * 0.5;
      const xE = W * ENTRADA_REEL;
      const x0 = W * 0.5;
      // entrada: sale hacia abajo (como llega la del hero) y se curva hacia la derecha, sin quiebre
      const entrada = trazar(bezier([xE, -2], [xE, base * 0.62], [x0 - W * 0.14, base], [x0, base]));
      // horizontal: curvas amplias, sin rulos (arranca plana y hacia la derecha: empalma con la entrada)
      const largoX = W * 0.7 + recorrido;
      const ola = H * 0.11;
      const guia = (u) => {
        const fase1 = u * Math.PI * Math.max(1, total - 1) * 0.5;
        const suave = Math.min(1, u * 5);
        return [x0 + u * largoX, base + (Math.sin(fase1) * ola + Math.sin(fase1 * 1.7 + 0.8) * ola * 0.45 - Math.sin(0.8) * ola * 0.45) * suave];
      };
      const horizontal = trazar(guia);
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
