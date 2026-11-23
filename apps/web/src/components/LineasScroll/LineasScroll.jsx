'use client';

// La línea del sitio (como las de lusion.co): un solo trazo 2D azul eléctrico, de curvas amplias y
// casi sin rulos, que baja por toda la página y se va dibujando con el scroll (la punta sigue a la
// mitad de la pantalla; al subir se recoge).
//
// El cuerpo va en una capa fija DETRÁS de todo el contenido: sólo se ve sobre el fondo de la página.
// La punta (su cabeza y el último tramo corto) va en otra capa por encima de las secciones: siempre
// se ve hacia dónde va la línea, aunque esté pasando por detrás de una escena.
//
// Es continua entre secciones: en Sobre mí corre horizontal con el reel (LineaReel) y en Experiencia
// es la línea central del piso del pasillo (EscenaPasillo). Acá van los tres tramos restantes:
//   1. del inicio hasta el borde izquierdo de Sobre mí (donde arranca la del reel),
//   2. del final de Proyectos hasta el centro de abajo de la pantalla, donde empieza el pasillo,
//   3. de la salida del pasillo hasta el final de la página.
import { useEffect, useRef } from 'react';
import { alCuadro, movimientoReducido, scroll, SecondOrderDynamics, limitar } from '@/lib/movimiento.js';
import { aRuta, COLOR_LINEA, grosorLinea, largoHasta, puntoEnLargo, spline, tablaAvance, trazar } from '@/lib/trazos.js';
import styles from './LineasScroll.module.css';

const SVG = 'http://www.w3.org/2000/svg';
// largo del tramo de la punta que se ve por encima de todo (px)
const LARGO_PUNTA = 90;

function caja(sel, y0) {
  const n = document.querySelector(sel);
  if (!n) return null;
  const r = n.getBoundingClientRect();
  return { top: r.top + y0, bottom: r.bottom + y0, alto: r.height };
}

// Los tramos: puntos de paso (px de página), en qué tramos de la guía va un rulo (uno solo en todo
// el recorrido) y entre qué alturas de página la punta es de este tramo (fuera de eso la línea sigue
// dentro de una sección con la suya).
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
  const R = Math.min(vw, vh) * 0.13;
  return [
    {
      puntos: [[X(-0.06), vh * 0.12], [X(0.62), vh * 0.38], [X(0.82), s.top - vh * 0.35], [X(0.3), s.top + vh * 0.2], [X(-0.03), s.top + vh * 0.66]],
      lazos: [],
      punta: [-Infinity, s.top],
    },
    {
      puntos: [[X(1.06), p.bottom - vh * 0.5], [X(0.26), p.bottom - vh * 0.1], [X(0.72), e.top - vh * 0.28], [X(0.5), e.top + vh * 0.3], [X(0.5), e.top + vh * 1.02]],
      lazos: [],
      punta: [-Infinity, e.top],
    },
    {
      puntos: [
        [X(0.5), e.bottom - vh * 0.4],
        [X(0.5), e.bottom + vh * 0.05],
        [X(0.2), e.bottom + vh * 0.45],
        [X(0.82), t.top + t.alto * 0.3],
        [X(0.18), t.top + t.alto * 0.7],
        [X(0.8), h.top - vh * 0.1],
        [X(0.28), h.top + vh * 0.6],
        [X(0.74), c.top + vh * 0.1],
        [X(0.3), c.top + vh * 0.7],
        [X(0.7), f.top + vh * 0.25],
        [X(0.92), f.bottom - vh * 0.12],
      ],
      lazos: [{ tramo: 5, r: R, sentido: -1 }],
      punta: [e.bottom, Infinity],
    },
  ];
}

export default function LineasScroll() {
  const refSvg = useRef(null);
  const refPunta = useRef(null);

  useEffect(() => {
    const svg = refSvg.current;
    const svgPunta = refPunta.current;
    if (!svg || !svgPunta || movimientoReducido()) return undefined;
    const grupo = svg.querySelector('g');
    const grupoPunta = svgPunta.querySelector('g');
    const grads = [svg.querySelector('linearGradient'), svgPunta.querySelector('linearGradient')];
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
      grads.forEach((g) => g.setAttribute('y2', String(Math.round(vh * 1.3))));
      grupo.replaceChildren();
      grupoPunta.replaceChildren();
      const ancho = grosorLinea(vw);
      lineas = lista.map(({ puntos, lazos, punta }) => {
        const guia = spline(puntos);
        const trazo = trazar(
          guia,
          lazos.map(({ tramo, r, sentido }) => {
            const [a, b] = guia.tramos[Math.min(tramo, guia.tramos.length - 1)];
            return { u: (a + b) / 2, r, sentido };
          })
        );
        const d = aRuta(trazo.puntos);
        const ruta = document.createElementNS(SVG, 'path');
        ruta.setAttribute('d', d);
        ruta.setAttribute('stroke', 'url(#linea-azul)');
        ruta.setAttribute('stroke-width', ancho.toFixed(1));
        ruta.style.strokeDasharray = `${trazo.largo} ${trazo.largo + 10}`;
        ruta.style.strokeDashoffset = String(trazo.largo);
        ruta.style.opacity = '0';
        grupo.appendChild(ruta);
        // la punta: el mismo camino (sólo su último tramo) y la cabeza con un halo
        const cola = document.createElementNS(SVG, 'path');
        cola.setAttribute('d', d);
        cola.setAttribute('stroke', 'url(#linea-azul-punta)');
        cola.setAttribute('stroke-width', ancho.toFixed(1));
        cola.style.strokeDasharray = `${LARGO_PUNTA} ${trazo.largo * 2}`;
        const halo = document.createElementNS(SVG, 'circle');
        halo.setAttribute('r', (ancho * 1.6).toFixed(1));
        halo.setAttribute('class', styles.halo);
        const cabeza = document.createElementNS(SVG, 'circle');
        cabeza.setAttribute('r', (ancho * 0.62).toFixed(1));
        cabeza.setAttribute('class', styles.cabeza);
        const g = document.createElementNS(SVG, 'g');
        g.append(cola, halo, cabeza);
        g.style.opacity = '0';
        grupoPunta.appendChild(g);
        let yMin = Infinity;
        let yMax = -Infinity;
        trazo.puntos.forEach(([, y]) => {
          yMin = Math.min(yMin, y);
          yMax = Math.max(yMax, y);
        });
        return { ruta, cola, halo, cabeza, g, punta, trazo, tabla: tablaAvance(trazo, 1), yMin, yMax, resorte: new SecondOrderDynamics(1.5, 0.8, 0, 0), primero: true, ultimo: '' };
      });
    };

    const cuadro = (dt, s) => {
      const y = s.y;
      const vh = window.innerHeight;
      const t = `translate(0 ${(-y).toFixed(1)})`;
      grupo.setAttribute('transform', t);
      grupoPunta.setAttribute('transform', t);
      const yPunta = y + vh * 0.56;
      for (const l of lineas) {
        const objetivo = largoHasta(l.trazo, l.tabla, yPunta) / l.trazo.largo;
        let show;
        if (l.primero) {
          l.resorte.fijar(objetivo);
          l.primero = false;
          show = objetivo;
        } else show = l.resorte.actualizar(dt, objetivo);
        show = limitar(show, 0, 1);
        const enVista = l.yMax > y - 60 && l.yMin < y + vh + 60;
        const op = enVista && show > 0.002 ? 1 : 0;
        const dibujado = l.trazo.largo * show;
        // la punta, por encima de todo: mientras se está dibujando y es de este tramo
        const conPunta = op && show < 0.999 && yPunta > l.punta[0] && yPunta < l.punta[1];
        const clave = `${op}|${conPunta}|${dibujado.toFixed(1)}`;
        if (clave === l.ultimo) continue;
        l.ultimo = clave;
        l.ruta.style.opacity = String(op);
        l.ruta.style.strokeDashoffset = (l.trazo.largo - dibujado).toFixed(1);
        l.g.style.opacity = conPunta ? '1' : '0';
        if (conPunta) {
          const desde = Math.max(0, dibujado - LARGO_PUNTA);
          l.cola.style.strokeDasharray = `${(dibujado - desde).toFixed(1)} ${l.trazo.largo * 2}`;
          l.cola.style.strokeDashoffset = (-desde).toFixed(1);
          const [px, py] = puntoEnLargo(l.trazo, dibujado);
          for (const c of [l.halo, l.cabeza]) {
            c.setAttribute('cx', px.toFixed(1));
            c.setAttribute('cy', py.toFixed(1));
          }
        }
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

  const degrade = (id) => (
    <linearGradient id={id} gradientUnits="userSpaceOnUse" spreadMethod="reflect" x1="0" y1="0" x2="0" y2="900">
      <stop offset="0" stopColor={COLOR_LINEA.c0} />
      <stop offset="1" stopColor={COLOR_LINEA.c1} />
    </linearGradient>
  );
  return (
    <>
      <svg ref={refSvg} className={styles.lienzo} aria-hidden="true">
        <defs>{degrade('linea-azul')}</defs>
        <g />
      </svg>
      <svg ref={refPunta} className={styles.punta} aria-hidden="true">
        <defs>{degrade('linea-azul-punta')}</defs>
        <g />
      </svg>
    </>
  );
}
