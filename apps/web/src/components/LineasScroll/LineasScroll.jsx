'use client';

// La línea del sitio (como las de lusion.co): un solo trazo 2D azul eléctrico, de curvas amplias y
// casi sin rulos, que baja por toda la página y se va dibujando con el scroll (la punta sigue a la
// altura del 56 % de la pantalla; al subir se recoge).
//
// Es una sola línea, armada por partes que se tocan siempre en el mismo punto y con la misma
// dirección, porque algunas secciones la llevan adentro con su propio movimiento:
//   - hero → Sobre mí: la bajada y la línea del reel (LineaReel, dentro de Sobre mí);
//   A. de Proyectos hasta la punta de la línea del piso del pasillo (este archivo);
//   - el pasillo: la línea central del piso (EscenaPasillo);
//   B. la salida del pasillo: desde el centro de la luz del final hasta el borde de Títulos (acá);
//   - Títulos: la hélice alrededor del carrusel (LineaTitulos);
//   C. del borde de abajo de Títulos, por Habilidades y Contacto, hasta el punto de "Gracias por
//      pasar." (acá; Habilidades y Contacto lo redibujan entre su fondo y su contenido: LineaSeccion).
//
// El cuerpo va en una capa fija DETRÁS de todo el contenido: sólo se ve sobre el fondo de la página.
// La llegada al pasillo y la salida (A y B) van además por encima mientras la escena entra o se va.
import { useEffect, useRef } from 'react';
import { alCuadro, movimientoReducido, scroll, limitar } from '@/lib/movimiento.js';
import { suavizar, aRuta, COLOR_LINEA, ENTRADA_TITULOS, grosorLinea, largoHasta, puntaDePagina, SALIDA_TITULOS, spline, tablaAvance, trazar } from '@/lib/trazos.js';
import { EVENTO_PISO, puntaPisoEntrada, registrarLineaFinal } from '@/lib/puente.js';
import { aPagina, arribasSecciones, EVENTO_LINEA_EDITADA, puntosLinea } from '@/lib/lineaEditable.js';
import styles from './LineasScroll.module.css';

const SVG = 'http://www.w3.org/2000/svg';

// Centro del punto de "Gracias por pasar." en px de página, medido por su lugar en la página (sin
// transformaciones): las letras se animan con el scroll y su rectángulo en pantalla se corre.
function puntoFinal() {
  // en modo vidrio la frase se dibuja en un lienzo con su propia tipografía: la escena informa dónde
  // queda el punto (relativo a la caja del vidrio)
  const vidrio = document.querySelector('[class*="CierreFooter_vidrio"]');
  if (vidrio?.dataset.puntoX) {
    let vx = 0;
    let vy = 0;
    for (let n = vidrio; n; n = n.offsetParent) {
      vx += n.offsetLeft;
      vy += n.offsetTop;
    }
    return [vx + Number(vidrio.dataset.puntoX), vy + Number(vidrio.dataset.puntoY)];
  }
  const el = document.querySelector('[class*="CierreFooter_punto"]');
  if (!el) return null;
  let x = 0;
  let y = 0;
  for (let n = el; n; n = n.offsetParent) {
    x += n.offsetLeft;
    y += n.offsetTop;
  }
  // el punto se dibuja abajo de su caja (sobre la línea de base)
  return [x + el.offsetWidth * 0.42, y + el.offsetHeight * 0.74];
}

function caja(sel, y0) {
  const n = document.querySelector(sel);
  if (!n) return null;
  const r = n.getBoundingClientRect();
  return { top: r.top + y0, bottom: r.bottom + y0, alto: r.height, left: r.left, right: r.right, cx: r.left + r.width / 2, cy: r.top + r.height / 2 + y0 };
}

// Los tramos: puntos de paso (px de página), en qué tramo de la guía va un rulo y qué parte va
// además por encima del contenido.
function tramos(vw, vh) {
  const y0 = window.scrollY;
  const p = caja('#proyectos', y0);
  const e = caja('#experiencia', y0);
  const t = caja('#titulos', y0);
  const h = caja('#habilidades', y0);
  const c = caja('#contacto', y0);
  const f = caja('footer', y0);
  if (!p || !e || !t || !h || !c || !f) return [];
  const X = (k) => k * vw;
  // la punta de la línea del piso al entrar al pasillo (la informa la escena; si todavía no, un valor
  // típico: centrada, un poco debajo de la mitad)
  const [px, py] = puntaPisoEntrada() ?? [0.5, 0.62];
  // el punto final de "Gracias por pasar." (medido sin la animación de las letras, ver puntoFinal)
  const fin = puntoFinal() ?? [X(0.58), f.bottom - vh * 0.06];
  // puntos dibujados a mano (modo editor): si un tramo los tiene, reemplazan el recorrido de siempre
  const propios = puntosLinea();
  const arribas = arribasSecciones();
  const aMano = (tramo) => (propios[tramo] ?? []).map((q) => aPagina(q, arribas, vw, vh));
  const manoA = aMano('a');
  // dónde termina lo dibujado a mano en el pasillo: si ya baja hasta la línea del piso (más abajo que
  // su punta), termina ahí mismo; la de encima se ve hasta que la punta llega a ese final
  const finA = manoA.length ? manoA[manoA.length - 1] : null;
  const aPiso = finA && finA[1] > e.top + vh * py ? [] : [[X(px), e.top + vh * py]];
  const manoC = aMano('c');
  return [
    {
      // A. de Proyectos a la punta de la línea del piso
      // (a mano: redondeado, entra por el borde izquierdo — si arrancara en medio de la pantalla
      // aparecería de la nada — y termina directo en la punta del piso)
      puntos: manoA.length
        ? suavizar([[X(-0.06), manoA[0][1] - vh * 0.3], ...manoA, ...aPiso])
        : [[X(1.06), p.bottom - vh * 0.5], [X(0.26), p.bottom - vh * 0.1], [X(0.16), p.bottom + vh * 0.04], [X(0.72), e.top - vh * 0.28], [X(px), e.top + vh * 0.12], [X(px), e.top + vh * py]],
      lazos: [],
      // mientras el pasillo sube, la parte de adentro va por encima y termina sobre la punta del piso;
      // ya con el pasillo arriba se funde y queda la del piso
      // (entera desde que la punta cruza el borde, así llega ya unida a la punta del piso)
      encima: { desdeY: e.top - 2, hastaY: Infinity, completo: true, trasPunta: true, alfa: finA ? (y) => limitar((finA[1] - vh * 0.4 - y) / (vh * 0.16), 0, 1) : (y) => limitar((e.top - y) / (vh * 0.3), 0, 1) },
    },
    {
      // B. salida del pasillo: del centro de la luz del final, hacia abajo, al borde de Títulos
      puntos: [[X(ENTRADA_TITULOS), e.bottom - vh * 0.45], [X(ENTRADA_TITULOS), e.bottom - vh * 0.2], [X(ENTRADA_TITULOS), t.top + 1]],
      lazos: [],
      // Por encima y ENTERA dentro del pasillo, justo sobre la línea del piso (que en el final va del
      // centro de la puerta al centro de abajo): aparece mientras la luz del final tapa la escena, así
      // la línea sigue ahí y baja hacia Títulos.
      encima: { desdeY: -Infinity, hastaY: e.bottom, completo: true, alfa: (y) => limitar((y - (e.bottom - vh * 1.5)) / (vh * 0.12), 0, 1) },
    },
    {
      // C. del borde de abajo de Títulos al punto de "Gracias por pasar."
      puntos: (manoC.length ? (q) => suavizar(q, { fijosIni: 2, vueltas: 4 }) : (q) => q)([
        [X(SALIDA_TITULOS), t.bottom - 1],
        [X(SALIDA_TITULOS), t.bottom + vh * 0.08],
        ...(manoC.length
          ? manoC
          : [
            // Habilidades: por la derecha del todo
            [X(0.95), h.top + vh * 0.3],
            [X(0.955), h.top + vh * 0.78],
            // Contacto: entre la credencial y el texto
            [X(0.4), c.top + vh * 0.3],
            [X(0.33), c.top + vh * 0.82],
            // footer: la reseña por el margen izquierdo (la gelatina es un lienzo opaco), cruza por
            // detrás de los datos, baja por el margen derecho y de ahí al punto final
            [X(0.03), f.top + vh * 0.3],
            [X(0.04), f.top + vh * 0.62],
            [X(0.95), f.top + vh * 0.95],
          ]),
        ...(manoC.length ? [] : [[X(0.9), fin[1] - vh * 0.02]]),
        fin,
      ]),
      lazos: [],
      final: true,
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
    let lineas = [];
    let firma = '';
    let espera = 0;

    const armar = (forzar = false) => {
      if (!document.getElementById('inicio')) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const lista = tramos(vw, vh);
      const nueva = `${vw}x${vh}|${lista.map((l) => l.puntos.map((q) => `${Math.round(q[0])},${Math.round(q[1])}`).join(';')).join('|')}`;
      if (!forzar && nueva === firma) return;
      firma = nueva;
      grupo.replaceChildren();
      grupoPunta.replaceChildren();
      const ancho = grosorLinea(vw);
      lineas = lista.map(({ puntos, lazos, encima = null, final = false }) => {
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
        ruta.setAttribute('stroke', COLOR_LINEA.c0);
        ruta.setAttribute('stroke-width', ancho.toFixed(1));
        ruta.style.strokeDasharray = `${trazo.largo} ${trazo.largo + 10}`;
        ruta.style.strokeDashoffset = String(trazo.largo);
        ruta.style.opacity = '0';
        grupo.appendChild(ruta);
        // la parte que va por encima del contenido (sólo en los tramos que lo piden)
        let cola = null;
        if (encima) {
          cola = document.createElementNS(SVG, 'path');
          cola.setAttribute('d', d);
          cola.setAttribute('stroke', COLOR_LINEA.c0);
          cola.setAttribute('stroke-width', ancho.toFixed(1));
          cola.style.opacity = '0';
          grupoPunta.appendChild(cola);
        }
        let yMin = Infinity;
        let yMax = -Infinity;
        trazo.puntos.forEach(([, y]) => {
          yMin = Math.min(yMin, y);
          yMax = Math.max(yMax, y);
        });
        const tabla = tablaAvance(trazo, 1);
        const largoEncima = encima ? largoHasta(trazo, tabla, encima.desdeY) : 0;
        const largoCompleto = encima?.completo ? largoHasta(trazo, tabla, encima.hastaY) : 0;
        if (final) registrarLineaFinal({ d, trazo, tabla, ancho });
        return { ruta, cola, encima, largoEncima, largoCompleto, trazo, tabla, yMin, yMax, ultimo: '' };
      });
    };

    const cuadro = (_dt, s) => {
      const y = s.y;
      const vh = window.innerHeight;
      const t = `translate(0 ${(-y).toFixed(1)})`;
      grupo.setAttribute('transform', t);
      grupoPunta.setAttribute('transform', t);
      const yPunta = puntaDePagina(y, vh);
      for (const l of lineas) {
        // sin suavizado propio (el scroll ya viene suavizado por Lenis): así todas las partes de la
        // línea avanzan al mismo ritmo y se empalman sin huecos
        const dibujado = largoHasta(l.trazo, l.tabla, yPunta);
        const enVista = l.yMax > y - 60 && l.yMin < y + vh + 60;
        const op = enVista && dibujado > 0.5 ? 1 : 0;
        const sinPunta = l.encima?.completo && !l.encima.trasPunta;
        const alfaEncima = !l.encima ? 0 : sinPunta ? (enVista ? l.encima.alfa(y) : 0) : op && dibujado > l.largoEncima ? l.encima.alfa(y) : 0;
        const clave = `${op}|${alfaEncima.toFixed(3)}|${dibujado.toFixed(1)}`;
        if (clave === l.ultimo) continue;
        l.ultimo = clave;
        l.ruta.style.opacity = String(op);
        l.ruta.style.strokeDashoffset = (l.trazo.largo - dibujado).toFixed(1);
        if (l.cola) {
          l.cola.style.opacity = alfaEncima.toFixed(3);
          if (alfaEncima > 0) {
            const desde = Math.max(0, l.largoEncima);
            const hasta = l.encima.completo ? Math.max(dibujado, l.largoCompleto) : dibujado;
            l.cola.style.strokeDasharray = `${Math.max(0, hasta - desde).toFixed(1)} ${l.trazo.largo * 2}`;
            l.cola.style.strokeDashoffset = (-desde).toFixed(1);
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
    const conPiso = () => armar(true);
    window.addEventListener(EVENTO_PISO, conPiso);
    window.addEventListener(EVENTO_LINEA_EDITADA, conPiso);
    const tarde = setTimeout(() => armar(), 2500);
    return () => {
      clearTimeout(espera);
      clearTimeout(tarde);
      quitar();
      ro.disconnect();
      window.removeEventListener('resize', pedir);
      window.removeEventListener(EVENTO_PISO, conPiso);
      window.removeEventListener(EVENTO_LINEA_EDITADA, conPiso);
    };
  }, []);

  return (
    <>
      <svg ref={refSvg} className={styles.lienzo} aria-hidden="true">
        <g />
      </svg>
      <svg ref={refPunta} className={styles.punta} aria-hidden="true">
        <g />
      </svg>
    </>
  );
}
