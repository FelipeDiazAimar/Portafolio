'use client';

// La línea del sitio (como las de lusion.co): un solo trazo 2D cian, con rulos redondos, que baja
// por toda la página y se va dibujando con el scroll (la punta sigue a la mitad de la pantalla; al
// subir se recoge). Va en una capa fija DETRÁS de todo el contenido: sólo se ve sobre el fondo de la
// página, nunca encima de un texto, una tarjeta o una escena.
//
// Es continua entre secciones: donde una sección tiene su propio fondo, la línea sigue adentro de
// ella con su forma: en Sobre mí corre horizontal con el reel (LineaReel) y en Experiencia se vuelve
// la línea central del piso del pasillo (EscenaPasillo). Acá van los tres tramos sobre el fondo:
//   1. del inicio hasta el borde izquierdo de Sobre mí (donde arranca la del reel),
//   2. del final de Proyectos hasta el centro de abajo de la pantalla, donde empieza el pasillo,
//   3. de la salida del pasillo hasta el final de la página.
import { useEffect, useRef } from 'react';
import { alCuadro, movimientoReducido, scroll, SecondOrderDynamics, limitar } from '@/lib/movimiento.js';
import { aRuta, COLOR_LINEA, grosorLinea, largoHasta, spline, tablaAvance, trazar } from '@/lib/trazos.js';
import styles from './LineasScroll.module.css';

const SVG = 'http://www.w3.org/2000/svg';

function caja(sel, y0) {
  const n = document.querySelector(sel);
  if (!n) return null;
  const r = n.getBoundingClientRect();
  return { top: r.top + y0, bottom: r.bottom + y0, alto: r.height };
}

// Los tramos: puntos de paso (px de página) y en qué tramos de la guía va un rulo.
function tramos(vw, vh) {
  const y0 = window.scrollY;
  const s = caja('#sobre-mi', y0);
  const p = caja('#proyectos', y0);
  const e = caja('#experiencia', y0);
  const t = caja('#titulos', y0);
  const h = caja('#habilidades', y0);
  const c = caja('#contacto', y0);
  const f = caja('footer', y0);
  if (!s || !p || !e || !t || !h || !c || !f) return [];
  const X = (k) => k * vw;
  const R = Math.min(vw, vh) * 0.12;
  return [
    {
      puntos: [[X(-0.06), vh * 0.1], [X(0.74), vh * 0.42], [X(0.34), s.top - vh * 0.12], [X(-0.03), s.top + vh * 0.66]],
      lazos: [{ tramo: 1, r: R, sentido: 1 }],
    },
    {
      puntos: [[X(1.06), p.bottom - vh * 0.45], [X(0.28), p.bottom - vh * 0.08], [X(0.66), e.top - vh * 0.22], [X(0.5), e.top + vh * 0.3], [X(0.5), e.top + vh * 1.02]],
      lazos: [{ tramo: 1, r: R * 0.9, sentido: -1 }],
    },
    {
      puntos: [
        [X(0.5), e.bottom - vh * 0.4],
        [X(0.5), e.bottom + vh * 0.02],
        [X(0.22), e.bottom + vh * 0.34],
        [X(0.78), t.top + vh * 0.2],
        [X(0.16), t.top + t.alto * 0.5],
        [X(0.84), h.top - vh * 0.22],
        [X(0.3), h.top + vh * 0.55],
        [X(0.76), c.top - vh * 0.18],
        [X(0.24), c.top + vh * 0.62],
        [X(0.68), f.top + vh * 0.2],
        [X(0.9), f.bottom - vh * 0.12],
      ],
      lazos: [
        { tramo: 2, r: R * 0.85, sentido: 1 },
        { tramo: 4, r: R * 1.1, sentido: -1 },
        { tramo: 6, r: R * 0.9, sentido: 1 },
        { tramo: 8, r: R, sentido: -1 },
      ],
    },
  ];
}

export default function LineasScroll() {
  const refSvg = useRef(null);

  useEffect(() => {
    const svg = refSvg.current;
    if (!svg || movimientoReducido()) return undefined;
    const grupo = svg.querySelector('g');
    const grad = svg.querySelector('linearGradient');
    let lineas = [];
    let firma = '';
    let espera = 0;

    const armar = (forzar = false) => {
      if (!document.getElementById('inicio')) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const lista = tramos(vw, vh);
      const nueva = `${vw}x${vh}|${lista.map((l) => l.puntos.map((q) => Math.round(q[1])).join(',')).join('|')}`;
      if (!forzar && nueva === firma) return;
      firma = nueva;
      grad.setAttribute('y2', String(Math.round(vh * 1.3)));
      grupo.replaceChildren();
      const ancho = grosorLinea(vw).toFixed(1);
      lineas = lista.map(({ puntos, lazos }) => {
        const guia = spline(puntos);
        const trazo = trazar(
          guia,
          lazos.map(({ tramo, r, sentido }) => {
            const [a, b] = guia.tramos[Math.min(tramo, guia.tramos.length - 1)];
            return { u: (a + b) / 2, r, sentido };
          })
        );
        const ruta = document.createElementNS(SVG, 'path');
        ruta.setAttribute('d', aRuta(trazo.puntos));
        ruta.setAttribute('stroke', 'url(#linea-cian)');
        ruta.setAttribute('stroke-width', ancho);
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
        return { ruta, trazo, tabla: tablaAvance(trazo, 1), yMin, yMax, resorte: new SecondOrderDynamics(1.5, 0.8, 0, 0), primero: true, ultimo: '' };
      });
    };

    const cuadro = (dt, s) => {
      const y = s.y;
      const vh = window.innerHeight;
      grupo.setAttribute('transform', `translate(0 ${(-y).toFixed(1)})`);
      for (const l of lineas) {
        const objetivo = largoHasta(l.trazo, l.tabla, y + vh * 0.56) / l.trazo.largo;
        let show;
        if (l.primero) {
          l.resorte.fijar(objetivo);
          l.primero = false;
          show = objetivo;
        } else show = l.resorte.actualizar(dt, objetivo);
        show = limitar(show, 0, 1);
        const enVista = l.yMax > y - 60 && l.yMin < y + vh + 60;
        const op = enVista && show > 0.002 ? 1 : 0;
        const clave = `${op}|${show.toFixed(4)}`;
        if (clave === l.ultimo) continue;
        l.ultimo = clave;
        l.ruta.style.opacity = String(op);
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
    const tarde = setTimeout(() => armar(), 2500);
    return () => {
      clearTimeout(espera);
      clearTimeout(tarde);
      quitar();
      ro.disconnect();
      window.removeEventListener('resize', pedir);
    };
  }, []);

  return (
    <svg ref={refSvg} className={styles.lienzo} aria-hidden="true">
      <defs>
        <linearGradient id="linea-cian" gradientUnits="userSpaceOnUse" spreadMethod="reflect" x1="0" y1="0" x2="0" y2="900">
          <stop offset="0" stopColor={COLOR_LINEA.c0} />
          <stop offset="1" stopColor={COLOR_LINEA.c1} />
        </linearGradient>
      </defs>
      <g />
    </svg>
  );
}
