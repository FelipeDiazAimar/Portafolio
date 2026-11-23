'use client';

// Líneas que te llevan de una sección a la siguiente (como las de lusion.co): un trazo 2D por unión,
// con degradé y rulos redondos, que se dibuja con el scroll (la punta sigue a la mitad de la pantalla)
// y se recoge al subir. Van en una capa fija DETRÁS de todo el contenido: sólo se ven sobre el fondo
// de la página, nunca encima de un texto, una tarjeta o una escena. Con la sección en reposo se
// desvanecen. Sobre mí tiene la suya propia, horizontal, dentro de su panel (ver LineaReel).
import { useEffect, useRef } from 'react';
import { alCuadro, movimientoReducido, scroll, SecondOrderDynamics, limitar } from '@/lib/movimiento.js';
import { aRuta, bezier, grosorLinea, largoHasta, PRESETS, tablaAvance, trazar } from '@/lib/trazos.js';
import styles from './LineasScroll.module.css';

// [sección que entra, preset, forma]. (Sobre mí → Proyectos no lleva: ahí la transición es el puente.)
const UNIONES = [
  ['#sobre-mi', 'reel', 0],
  ['#experiencia', 'goal', 1],
  ['#titulos', 'capability', 2],
  ['#habilidades', 'reel', 3],
  ['#contacto', 'goal', 0],
  ['footer', 'office', 2],
];

const SVG = 'http://www.w3.org/2000/svg';

function tema() {
  const t = document.documentElement.getAttribute('data-theme');
  if (t === 'light' || t === 'dark') return t;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}


// El dibujo de cada unión, en px de página. Entra por un costado ~1,15 pantallas antes de la unión
// y sale por el otro apenas pasada; los rulos son círculos tangentes a la guía.
function trazoDeUnion(forma, J, vw, vh, lado) {
  const s = lado;
  const W = vw / 2;
  const cx = (x) => W + x;
  const Y = (k) => J + k * vh;
  const R = Math.min(vw, vh) * 0.13;
  if (forma === 0) {
    return trazar(bezier([cx(-s * (W + 80)), Y(-1.12)], [cx(s * W * 0.9), Y(-0.95)], [cx(-s * W * 0.9), Y(-0.05)], [cx(s * (W + 80)), Y(0.1)]), [
      { u: 0.47, r: R, sentido: s },
    ]);
  }
  if (forma === 1) {
    return trazar(bezier([cx(s * (W + 80)), Y(-1.1)], [cx(-s * W * 0.2), Y(-1.05)], [cx(s * W * 0.3), Y(0.05)], [cx(-s * (W + 80)), Y(0.08)]), [
      { u: 0.36, r: R * 0.72, sentido: -s },
      { u: 0.62, r: R * 1.05, sentido: -s },
    ]);
  }
  if (forma === 2) {
    return trazar(bezier([cx(-s * W * 0.35), Y(-1.2)], [cx(s * W * 0.25), Y(-0.75)], [cx(-s * W * 0.6), Y(-0.3)], [cx(s * (W + 80)), Y(0.1)]), [
      { u: 0.5, r: R * 1.25, sentido: s },
    ]);
  }
  return trazar(bezier([cx(-s * (W + 80)), Y(-1.0)], [cx(s * W * 1.1), Y(-0.85)], [cx(-s * W * 0.2), Y(-0.2)], [cx(-s * (W + 80)), Y(0.06)]), [
    { u: 0.32, r: R * 0.6, sentido: s },
    { u: 0.58, r: R * 0.95, sentido: s },
  ]);
}

export default function LineasScroll() {
  const refSvg = useRef(null);

  useEffect(() => {
    const svg = refSvg.current;
    if (!svg || movimientoReducido()) return undefined;
    const grupo = svg.querySelector('g');
    const defs = svg.querySelector('defs');
    let lineas = [];
    let firma = '';
    let espera = 0;

    const armar = (forzar = false) => {
      if (!document.getElementById('inicio')) return;
      const y0 = window.scrollY;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const uniones = UNIONES.map(([sel, preset, forma]) => {
        const nodo = document.querySelector(sel);
        return nodo ? { preset, forma, J: nodo.getBoundingClientRect().top + y0 } : null;
      }).filter(Boolean);
      const claro = tema() === 'light';
      const nueva = `${vw}x${vh}|${claro}|${uniones.map((u) => Math.round(u.J)).join(',')}`;
      if (!forzar && nueva === firma) return;
      firma = nueva;
      grupo.replaceChildren();
      defs.replaceChildren();
      const ancho = grosorLinea(vw);
      lineas = uniones.map(({ preset, forma, J }, i) => {
        const trazo = trazoDeUnion(forma, J, vw, vh, i % 2 === 0 ? 1 : -1);
        const p = PRESETS[preset];
        const col = claro && p.claro ? p.claro : p;
        const grad = document.createElementNS(SVG, 'linearGradient');
        grad.id = `linea-grad-${i}`;
        grad.setAttribute('gradientUnits', 'userSpaceOnUse');
        const a = trazo.puntos[0];
        const b = trazo.puntos[trazo.puntos.length - 1];
        grad.setAttribute('x1', a[0]);
        grad.setAttribute('y1', a[1]);
        grad.setAttribute('x2', b[0]);
        grad.setAttribute('y2', b[1]);
        grad.innerHTML = `<stop offset="0" stop-color="${col.c0}"/><stop offset="1" stop-color="${col.c1}"/>`;
        defs.appendChild(grad);
        const ruta = document.createElementNS(SVG, 'path');
        ruta.setAttribute('d', aRuta(trazo.puntos));
        ruta.setAttribute('stroke', `url(#${grad.id})`);
        ruta.setAttribute('stroke-width', ancho.toFixed(1));
        ruta.style.strokeDasharray = `${trazo.largo} ${trazo.largo + 10}`;
        ruta.style.strokeDashoffset = String(trazo.largo);
        ruta.style.opacity = '0';
        grupo.appendChild(ruta);
        let yMin = Infinity;
        let yMax = -Infinity;
        trazo.puntos.forEach(([, y]) => {
          yMin = Math.min(yMin, y);
          yMax = Math.max(yMax, y);
        });
        return { ruta, trazo, tabla: tablaAvance(trazo, 1), J, yMin, yMax, resorte: new SecondOrderDynamics(1.5, 0.8, 0, 0), primero: true, ultimo: '' };
      });
    };

    const cuadro = (dt, s) => {
      const y = s.y;
      const vh = window.innerHeight;
      grupo.setAttribute('transform', `translate(0 ${(-y).toFixed(1)})`);
      for (const l of lineas) {
        const enVista = l.yMax > y - 60 && l.yMin < y + vh + 60;
        // sólo mientras su unión cruza la pantalla: en reposo sobre una sección no se ve
        const lejos = Math.abs(l.J - (y + vh * 0.5)) / vh;
        const a = limitar((0.5 - lejos) / 0.14, 0, 1);
        const alfa = enVista ? a * a * (3 - 2 * a) : 0;
        const objetivo = largoHasta(l.trazo, l.tabla, y + vh * 0.56) / l.trazo.largo;
        let show;
        if (l.primero) {
          l.resorte.fijar(objetivo);
          l.primero = false;
          show = objetivo;
        } else show = l.resorte.actualizar(dt, objetivo);
        show = limitar(show, 0, 1);
        const op = show < 0.002 ? 0 : alfa;
        const clave = `${op.toFixed(3)}|${show.toFixed(4)}`;
        if (clave === l.ultimo) continue;
        l.ultimo = clave;
        l.ruta.style.opacity = op.toFixed(3);
        l.ruta.style.strokeDashoffset = (l.trazo.largo * (1 - show)).toFixed(1);
      }
    };

    const pedir = () => {
      clearTimeout(espera);
      espera = setTimeout(() => armar(), 180);
    };
    armar(true);
    const quitar = alCuadro(cuadro);
    cuadro(0, { y: scroll.y || window.scrollY });
    const ro = new ResizeObserver(pedir);
    ro.observe(document.body);
    window.addEventListener('resize', pedir);
    const mo = new MutationObserver(() => armar(true));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const tarde = setTimeout(() => armar(), 2500);
    return () => {
      clearTimeout(espera);
      clearTimeout(tarde);
      quitar();
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener('resize', pedir);
    };
  }, []);

  return (
    <svg ref={refSvg} className={styles.lienzo} aria-hidden="true">
      <defs />
      <g />
    </svg>
  );
}
