'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';

// Texto que se dibuja: primero el contorno se traza de punta a punta (stroke-dashoffset) y,
// cuando el trazo va por los dos tercios, se rellena. Es la animación "StrokeFill": el trazo
// dura `duracion` con easeInOut y el relleno arranca al 67 % y dura el último tercio
// con easeIn.
//
// Es un <svg> del tamaño exacto del texto (se mide con getBBox), así se acomoda en el flujo
// como cualquier texto. `claseTexto` va al <text> y es donde se pone la tipografía
// (font-size, font-weight, letter-spacing…); el color sale de `currentColor`.
// El texto real queda para lectores de pantalla. Con movimiento reducido aparece relleno.
//
// El largo del guion tiene que ser casi el del contorno de UNA letra: Chrome reinicia el guion
// en cada letra, así que todas se dibujan a la vez y, si el guion fuera mucho mayor que una
// letra, el trazo se vería sólo en el último tramo de la animación y parecería instantáneo.
// El contorno de una letra en negrita mide unas 3,4 veces el tamaño de la fuente.
const LARGO_POR_FUENTE = 3.4;

export default function TextoTrazo({
  texto,
  claseTexto,
  className,
  duracion = 2.4,
  retraso = 0,
  grosor = 1.5,
  alVer = false,
  // Opacidad del relleno al terminar (1 = lleno; menos deja el texto "de contorno" con un velo).
  rellenoFinal = 1,
}) {
  const refSvg = useRef(null);
  const refMedida = useRef(null);
  const [medida, setMedida] = useState(null);
  const reducido = Boolean(useReducedMotion());
  const visible = useInView(refSvg, { once: true, amount: 0.2 });
  const arrancar = !alVer || visible;

  // Primero se mide el texto sin animar (tamaño de la caja y de la fuente); recién después se
  // monta el que se dibuja, ya con su guion.
  useLayoutEffect(() => {
    const nodo = refMedida.current;
    if (!nodo) return;
    const caja = nodo.getBBox();
    const fuente = parseFloat(getComputedStyle(nodo).fontSize) || 16;
    setMedida({
      x: caja.x,
      y: caja.y,
      ancho: Math.ceil(caja.width) + 2,
      alto: Math.ceil(caja.height) + 2,
      guion: Math.ceil(fuente * LARGO_POR_FUENTE),
    });
  }, [texto, claseTexto]);

  return (
    <>
      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{texto}</span>
      <svg
        ref={refSvg}
        aria-hidden="true"
        className={className}
        width={medida ? medida.ancho : undefined}
        height={medida ? medida.alto : undefined}
        viewBox={medida ? `${medida.x - 1} ${medida.y - 1} ${medida.ancho} ${medida.alto}` : undefined}
        style={{ display: 'inline-block', overflow: 'visible', verticalAlign: 'top' }}
      >
        {medida ? (
          <motion.text
            x="0"
            y="0"
            dominantBaseline="text-before-edge"
            className={claseTexto}
            stroke="currentColor"
            strokeWidth={grosor}
            strokeLinejoin="round"
            fill="currentColor"
            initial={
              reducido
                ? { strokeDasharray: medida.guion, strokeDashoffset: 0, fillOpacity: rellenoFinal }
                : { strokeDasharray: medida.guion, strokeDashoffset: medida.guion, fillOpacity: 0 }
            }
            animate={reducido || !arrancar ? undefined : { strokeDashoffset: 0, fillOpacity: rellenoFinal }}
            transition={{
              delay: retraso,
              duration: duracion,
              ease: 'easeInOut',
              fillOpacity: { delay: retraso + duracion * 0.67, duration: duracion * 0.33, ease: 'easeIn' },
            }}
          >
            {texto}
          </motion.text>
        ) : (
          <text ref={refMedida} x="0" y="0" dominantBaseline="text-before-edge" className={claseTexto} fill="none">
            {texto}
          </text>
        )}
      </svg>
    </>
  );
}
