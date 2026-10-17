'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { partirEnRenglones } from '@/lib/renglones.js';

// StrokeFill (ver TextoTrazo.jsx) para textos de VARIOS renglones, como los títulos de la vista
// de un proyecto. Un <text> de SVG no se parte solo, así que el texto se reparte acá en
// renglones del ancho disponible (el del propio <svg>, que ocupa todo el de su caja), midiendo
// con la fuente real con un canvas —el mismo método de BioDibujada—, y cada renglón es un
// <tspan>. Se vuelve a repartir si cambia el ancho. `alinear`: 'centro' | 'inicio'.
// `claseTexto` va al <text> (font-size, font-weight, letter-spacing…); el color sale de
// `currentColor`. El texto real queda para lectores de pantalla.
const LARGO_POR_FUENTE = 3.4;

export default function TextoTrazoVarios({
  texto,
  claseTexto,
  className,
  duracion = 2.4,
  retraso = 0,
  grosor = 1.5,
  alinear = 'centro',
  interlineado = 1.1,
  rellenoFinal = 1,
}) {
  const refSvg = useRef(null);
  const refTexto = useRef(null);
  const [plano, setPlano] = useState(null);
  const reducido = Boolean(useReducedMotion());
  const visible = useInView(refSvg, { once: true, amount: 0.1 });

  useLayoutEffect(() => {
    const svg = refSvg.current;
    if (!svg) return undefined;
    const calcular = () => {
      const nodo = refTexto.current;
      const ancho = Math.floor(svg.getBoundingClientRect().width);
      if (!nodo || !ancho) return;
      const estilo = getComputedStyle(nodo);
      const fuente = parseFloat(estilo.fontSize) || 16;
      const lienzo = document.createElement('canvas').getContext('2d');
      lienzo.font = `${estilo.fontWeight} ${fuente}px ${estilo.fontFamily}`;
      const espaciado = parseFloat(estilo.letterSpacing);
      if (!Number.isNaN(espaciado)) lienzo.letterSpacing = `${espaciado}px`;
      // Un par de píxeles de margen: SVG y canvas no miden idéntico.
      const renglones = partirEnRenglones([{ texto, resaltado: false }], ancho - 4, (t) => lienzo.measureText(t).width).map((renglon) =>
        renglon.map((fragmento) => fragmento.texto).join('')
      );
      const paso = fuente * interlineado;
      const siguiente = {
        ancho,
        fuente,
        paso,
        renglones,
        alto: Math.ceil(paso * renglones.length + fuente * 0.2),
        guion: Math.ceil(fuente * LARGO_POR_FUENTE),
      };
      setPlano((previo) =>
        previo && previo.ancho === ancho && previo.fuente === fuente && previo.renglones.join('|') === renglones.join('|') ? previo : siguiente
      );
    };
    calcular();
    const observador = new ResizeObserver(calcular);
    observador.observe(svg);
    document.fonts?.ready.then(calcular).catch(() => {});
    return () => observador.disconnect();
  }, [texto, claseTexto, interlineado]);

  const centrado = alinear === 'centro';
  const propiedades = {
    x: centrado && plano ? plano.ancho / 2 : 0,
    y: 0,
    dominantBaseline: 'text-before-edge',
    textAnchor: centrado ? 'middle' : 'start',
    className: claseTexto,
  };
  const lineas = plano
    ? plano.renglones.map((renglon, i) => (
        <tspan key={i} x={propiedades.x} dy={i === 0 ? 0 : plano.paso}>
          {renglon}
        </tspan>
      ))
    : texto;

  return (
    <>
      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{texto}</span>
      <svg
        ref={refSvg}
        aria-hidden="true"
        className={className}
        style={{ display: 'block', width: '100%', height: plano ? plano.alto : 0, overflow: 'visible' }}
      >
        {plano ? (
          <motion.text
            ref={refTexto}
            {...propiedades}
            stroke="currentColor"
            strokeWidth={grosor}
            strokeLinejoin="round"
            fill="currentColor"
            initial={
              reducido
                ? { strokeDasharray: plano.guion, strokeDashoffset: 0, fillOpacity: rellenoFinal }
                : { strokeDasharray: plano.guion, strokeDashoffset: plano.guion, fillOpacity: 0 }
            }
            animate={reducido || !visible ? undefined : { strokeDashoffset: 0, fillOpacity: rellenoFinal }}
            transition={{
              delay: retraso,
              duration: duracion,
              ease: 'easeInOut',
              fillOpacity: { delay: retraso + duracion * 0.67, duration: duracion * 0.33, ease: 'easeIn' },
            }}
          >
            {lineas}
          </motion.text>
        ) : (
          <text ref={refTexto} {...propiedades} fill="none">
            {lineas}
          </text>
        )}
      </svg>
    </>
  );
}
