'use client';

// La línea del sitio en Títulos (PC, cinta horizontal): una hélice que gira alrededor del carrusel,
// pasando por delante y por detrás de las tarjetas. Acá el scroll mueve la cinta de costado, así que
// la hélice también: avanza con la posición real del carrusel, una vuelta por tarjeta.
//   - entra por el borde de arriba, al centro (ENTRADA_TITULOS), donde llega la línea del pasillo, y
//     se curva hasta la hélice; mientras el panel sube se dibuja con el scroll vertical;
//   - la hélice se dibuja con el carrusel (la punta, a la derecha: SALIDA_TITULOS del ancho);
//   - al final baja hasta el borde de abajo, a la misma altura del ancho, donde sigue la línea de la
//     página (y se dibuja con el scroll vertical cuando el panel se va).
// Dos capas con el mismo camino: la de atrás (debajo del lienzo de las tarjetas) y la de adelante
// (encima), recortada a los tramos en que la hélice pasa por delante.
import { useEffect, useRef } from 'react';
import { alCuadro, movimientoReducido } from '@/lib/movimiento.js';
import { aRuta, bezier, COLOR_LINEA, ENTRADA_TITULOS, grosorLinea, largoHasta, SALIDA_TITULOS, tablaAvance, trazar, unirTrazos } from '@/lib/trazos.js';
import styles from './Titulos.module.css';

const PUNTA_Y = 0.56;
const SVG = 'http://www.w3.org/2000/svg';

export default function LineaTitulos({ refEscena, total }) {
  const refAtras = useRef(null);
  const refAdelante = useRef(null);

  useEffect(() => {
    const atras = refAtras.current;
    const adelante = refAdelante.current;
    const escenario = atras?.parentElement;
    if (!atras || !adelante || !escenario || movimientoReducido()) return undefined;
    const gAtras = atras.querySelector('g');
    const gAdelante = adelante.querySelector('g');
    const rutaAtras = atras.querySelector('path');
    const rutaAdelante = adelante.querySelector('path');
    const recorte = adelante.querySelector('clipPath');
    let medida = null;
    let firma = '';
    let ultimo = '';

    const armar = () => {
      const estado = refEscena.current?.estado?.();
      if (!estado?.paso) return;
      const W = escenario.clientWidth;
      const H = escenario.clientHeight;
      const lambda = estado.paso;
      const nueva = `${W}x${H}|${lambda.toFixed(1)}|${total}`;
      if (nueva === firma) return;
      firma = nueva;
      const A = Math.max(estado.altoTarjeta * 0.72, H * 0.2);
      const cy = H / 2;
      const xE = W * ENTRADA_TITULOS;
      const x0 = xE + W * 0.12;
      // la punta va a la derecha; al final del carrusel la hélice termina justo ahí
      const xFin = (total - 1) * lambda + W * SALIDA_TITULOS;
      const theta = (x) => ((x - x0) / lambda) * Math.PI * 2;
      // arriba en x0 (y = cy − A), bajando por delante: profundidad = sen θ (> 0 = delante)
      const yDe = (x) => cy - A * Math.cos(theta(x));
      const entrada = trazar(bezier([xE, -2], [xE, (cy - A) * 0.7], [x0 - W * 0.08, cy - A], [x0, cy - A]));
      const helice = trazar((u) => {
        const x = x0 + u * (xFin - x0);
        return [x, yDe(x)];
      });
      // salida: sigue la tangente de la hélice y baja al borde de abajo
      const pend = (A * Math.sin(theta(xFin)) * Math.PI * 2) / lambda;
      const largoT = Math.hypot(1, pend) || 1;
      const yF = yDe(xFin);
      const salida = trazar(bezier([xFin, yF], [xFin + (W * 0.06) / largoT, yF + (pend * W * 0.06) / largoT], [xFin, H * 0.9], [xFin, H + 2]));
      const trazo = unirTrazos(unirTrazos(entrada, helice), salida);
      const d = aRuta(trazo.puntos);
      const ancho = grosorLinea(W).toFixed(1);
      for (const r of [rutaAtras, rutaAdelante]) {
        r.setAttribute('d', d);
        r.setAttribute('stroke-width', ancho);
        r.style.strokeDasharray = `${trazo.largo} ${trazo.largo + 10}`;
      }
      // la capa de adelante sólo se ve donde la hélice pasa por delante (sen θ > 0)
      recorte.replaceChildren();
      const vueltas = Math.ceil((xFin - x0) / lambda) + 1;
      for (let k = 0; k < vueltas; k += 1) {
        const r = document.createElementNS(SVG, 'rect');
        r.setAttribute('x', String(x0 + k * lambda));
        r.setAttribute('y', String(-H));
        r.setAttribute('width', String(lambda / 2));
        r.setAttribute('height', String(H * 3));
        recorte.appendChild(r);
      }
      medida = { W, lambda, entrada, helice, salida, trazo, tablaE: tablaAvance(entrada, 1), tablaH: tablaAvance(helice, 0), tablaS: tablaAvance(salida, 1) };
      ultimo = '';
    };

    const pintar = () => {
      if (!medida) armar();
      if (!medida) return;
      const { W, lambda, entrada, helice, salida, trazo, tablaE, tablaH, tablaS } = medida;
      const estado = refEscena.current?.estado?.();
      const posicion = Math.max(0, Math.min(total - 1, estado?.posicion ?? 0));
      const corrimiento = posicion * lambda;
      const arriba = escenario.getBoundingClientRect().top;
      const objetivoY = window.innerHeight * PUNTA_Y - arriba;
      const lE = largoHasta(entrada, tablaE, objetivoY);
      let largo = lE;
      if (lE >= entrada.largo - 0.5) {
        const lH = largoHasta(helice, tablaH, corrimiento + W * SALIDA_TITULOS);
        largo = entrada.largo + lH;
        if (lH >= helice.largo - 0.5) largo += largoHasta(salida, tablaS, objetivoY);
      }
      const clave = `${corrimiento.toFixed(1)}|${largo.toFixed(1)}`;
      if (clave === ultimo) return;
      ultimo = clave;
      const t = `translate(${(-corrimiento).toFixed(1)} 0)`;
      gAtras.setAttribute('transform', t);
      gAdelante.setAttribute('transform', t);
      const off = (trazo.largo - largo).toFixed(1);
      rutaAtras.style.strokeDashoffset = off;
      rutaAdelante.style.strokeDashoffset = off;
      const op = largo > 0.5 ? '1' : '0';
      rutaAtras.style.opacity = op;
      rutaAdelante.style.opacity = op;
    };

    const ro = new ResizeObserver(() => {
      firma = '';
      medida = null;
      pintar();
    });
    ro.observe(escenario);
    const quitar = alCuadro(pintar);
    window.addEventListener('scroll', pintar, { passive: true });
    return () => {
      ro.disconnect();
      quitar();
      window.removeEventListener('scroll', pintar);
    };
  }, [refEscena, total]);

  return (
    <>
      <svg ref={refAtras} className={`${styles.linea} ${styles.lineaAtras}`} aria-hidden="true">
        <g>
          <path stroke={COLOR_LINEA.c0} />
        </g>
      </svg>
      <svg ref={refAdelante} className={`${styles.linea} ${styles.lineaAdelante}`} aria-hidden="true">
        <g>
          <clipPath id="linea-titulos-delante" />
          <path stroke={COLOR_LINEA.c0} clipPath="url(#linea-titulos-delante)" />
        </g>
      </svg>
    </>
  );
}
