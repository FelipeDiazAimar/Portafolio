'use client';

// La línea del sitio entre el hero y "Sobre mí", de una sola pieza. Son dos trazos que se tocan en el
// borde de arriba del panel, en el mismo punto y con la misma dirección (hacia abajo):
//   1. la bajada del hero: va en un SVG anclado a la sección (se extiende hacia arriba, por la parte
//      baja del hero, lejos del retrato y del nombre) — `refHero`;
//   2. la de Sobre mí: dentro del panel, baja, se curva hacia la derecha y sigue por el medio de la
//      pantalla; acá el scroll mueve el reel de costado, así que corre de costado.
// Los dos se mueven con el scroll nativo de la página (nada de capas fijas movidas por JS) y se
// calculan juntos, en la misma función y con las mismas medidas: no pueden desfasarse.
//   - mientras se baja, la punta sigue a la altura del 56 % de la pantalla (como en el resto del
//     sitio): primero recorre la bajada del hero y, al cruzar el borde, la entrada del panel;
//   - ya con el panel arriba, el tramo horizontal se desplaza con la fase del reel y se va dibujando
//     (la punta queda a la derecha, entre la portada del frente y la siguiente).
// La de Sobre mí va sobre el fondo del panel y por detrás del titular y las portadas.
// `refPoner.current(fase)` le pasa la fase del reel; ReelHitos la llama en cada cuadro.
import { useEffect, useRef } from 'react';
import { alCuadro } from '@/lib/movimiento.js';
import { aRuta, bezier, COLOR_LINEA, ENTRADA_REEL, grosorLinea, largoHasta, spline, tablaAvance, trazar, unirTrazos } from '@/lib/trazos.js';
import styles from './ReelHitos.module.css';

const POR_HITO = 0.78; // ancho de trazo por hito, en pantallas
// dónde queda la punta (fracción del ancho): en el hueco entre la portada del frente y la de la
// derecha, así nunca queda tapada
const PUNTA_X = 0.725;
// a qué altura de la pantalla va la punta mientras se baja (la misma regla que la línea del sitio)
const PUNTA_Y = 0.56;

export default function LineaReel({ total, refPoner, refHero }) {
  const refSvg = useRef(null);

  useEffect(() => {
    const svg = refSvg.current;
    const panel = svg?.parentElement;
    const svgHero = refHero?.current;
    const contenedor = svgHero?.parentElement;
    if (!svg || !panel || !svgHero || !contenedor || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const grupo = svg.querySelector('g');
    const ruta = svg.querySelector('path');
    const rutaHero = svgHero.querySelector('path');
    let medida = null;
    let fase = 0;
    let ultimo = '';

    const pintar = () => {
      if (!medida) return;
      const { W, recorrido, entrada, horizontal, trazo, tablaY, tablaX, hero, tablaHero } = medida;
      const vh = window.innerHeight;
      const avance = total > 1 ? Math.min(1, Math.max(0, fase / (total - 1))) : 0;
      const corrimiento = avance * recorrido;
      // las dos medidas salen del mismo momento: el borde de arriba de la sección (y del panel)
      const arribaSeccion = contenedor.getBoundingClientRect().top;
      const arribaPanel = panel.getBoundingClientRect().top;
      // 1. bajada del hero (coordenadas de la sección: su borde de arriba es y = 0)
      const largoHero = largoHasta(hero, tablaHero, vh * PUNTA_Y - arribaSeccion);
      // 2. entrada del panel y después el reel
      const vertical = largoHasta(entrada, tablaY, vh * PUNTA_Y - arribaPanel);
      const largo = vertical < entrada.largo - 0.5 ? vertical : entrada.largo + largoHasta(horizontal, tablaX, corrimiento + W * PUNTA_X);
      const clave = `${corrimiento.toFixed(1)}|${largo.toFixed(1)}|${largoHero.toFixed(1)}`;
      if (clave === ultimo) return;
      ultimo = clave;
      grupo.setAttribute('transform', `translate(${(-corrimiento).toFixed(1)} 0)`);
      ruta.style.strokeDashoffset = (trazo.largo - largo).toFixed(1);
      rutaHero.style.strokeDashoffset = (hero.largo - largoHero).toFixed(1);
      rutaHero.style.opacity = largoHero > 0.5 ? '1' : '0';
    };
    const poner = (f) => {
      fase = f;
      pintar();
    };

    const armar = () => {
      const W = panel.clientWidth;
      const H = panel.clientHeight;
      if (W < 2 || H < 2) return;
      const vh = window.innerHeight;
      const ancho = grosorLinea(W).toFixed(1);
      const xE = W * ENTRADA_REEL;
      // 1. la bajada del hero, en coordenadas de la sección (y < 0 = arriba de ella, sobre el hero)
      const arriba = contenedor.getBoundingClientRect().top + window.scrollY;
      const hero = trazar(spline([[-W * 0.06, vh * 0.8 - arriba], [W * 0.14, vh * 0.93 - arriba], [xE, -vh * 0.22], [xE, 0]]));
      svgHero.style.top = `${-arriba}px`;
      svgHero.style.height = `${arriba + 2}px`;
      svgHero.setAttribute('viewBox', `0 ${-arriba} ${W} ${arriba + 2}`);
      rutaHero.setAttribute('d', aRuta(hero.puntos));
      rutaHero.setAttribute('stroke-width', ancho);
      rutaHero.style.strokeDasharray = `${hero.largo} ${hero.largo + 10}`;
      // 2. la de Sobre mí: por el medio de la pantalla
      const recorrido = (total - 1) * W * POR_HITO;
      const base = H * 0.5;
      const x0 = W * 0.5;
      // entrada: sale hacia abajo (como llega la del hero) y se curva hacia la derecha, sin quiebre
      const entrada = trazar(bezier([xE, 0], [xE, base * 0.62], [x0 - W * 0.14, base], [x0, base]));
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
      ruta.setAttribute('stroke-width', ancho);
      ruta.style.strokeDasharray = `${trazo.largo} ${trazo.largo + 10}`;
      medida = { W, recorrido, entrada, horizontal, trazo, tablaY: tablaAvance(entrada, 1), tablaX: tablaAvance(horizontal, 0), hero, tablaHero: tablaAvance(hero, 1) };
      ultimo = '';
      pintar();
    };

    armar();
    const ro = new ResizeObserver(armar);
    ro.observe(panel);
    ro.observe(document.body);
    refPoner.current = poner;
    // también mientras se baja (el reel todavía no manda su fase)
    const quitar = alCuadro(pintar);
    window.addEventListener('scroll', pintar, { passive: true });
    return () => {
      ro.disconnect();
      quitar();
      window.removeEventListener('scroll', pintar);
      refPoner.current = null;
    };
  }, [total, refPoner, refHero]);

  return (
    <svg ref={refSvg} className={styles.linea} aria-hidden="true">
      <g>
        <path stroke={COLOR_LINEA.c0} />
      </g>
    </svg>
  );
}
