'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { partirEnRenglones } from '@/lib/renglones.js';
import styles from './BioDibujada.module.css';

// Segundos entre una letra y la siguiente, y lo que tarda en dibujarse cada contorno.
const ENTRE_LETRAS = 0.011;
const DIBUJO = 0.55;
const RELLENO_DESDE = 0.32;

// Biografía escrita "a trazo", con la técnica de StrokeText de React Bits: cada
// letra se dibuja primero como contorno (stroke-dashoffset) y después se llena. Como
// el original es de una sola línea, el texto se reparte acá en renglones del ancho
// disponible (midiendo con la fuente real) y cada renglón es un SVG. Las palabras
// resaltadas van en azul y negrita. El texto real queda para lectores de pantalla.
// `visible` dispara la escritura; al ocultarse vuelve a empezar.
export default function BioDibujada({ partes, visible, className = '' }) {
  const refRaiz = useRef(null);
  const [medidas, setMedidas] = useState(null);
  const textoPlano = useMemo(() => partes.map((p) => p.texto).join(''), [partes]);

  // Mide el ancho y la fuente reales de la caja (y vuelve a medir si cambian).
  useLayoutEffect(() => {
    const caja = refRaiz.current;
    if (!caja) return undefined;
    const medir = () => {
      const estilo = getComputedStyle(caja);
      const tamano = parseFloat(estilo.fontSize);
      const ancho = Math.floor(caja.getBoundingClientRect().width);
      if (!ancho || !tamano) return;
      setMedidas((previas) =>
        previas && previas.ancho === ancho && previas.tamano === tamano && previas.familia === estilo.fontFamily
          ? previas
          : { ancho, tamano, familia: estilo.fontFamily, interlineado: tamano * 1.7 }
      );
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(caja);
    document.fonts?.ready.then(medir).catch(() => {});
    return () => observador.disconnect();
  }, []);

  const renglones = useMemo(() => {
    if (!medidas) return [];
    const lienzo = document.createElement('canvas').getContext('2d');
    const medir = (texto, resaltado) => {
      lienzo.font = `${resaltado ? 700 : 400} ${medidas.tamano}px ${medidas.familia}`;
      return lienzo.measureText(texto).width;
    };
    // Un par de píxeles de margen: SVG y canvas no miden idéntico.
    return partirEnRenglones(partes, medidas.ancho - 4, medir);
  }, [partes, medidas]);

  // La escritura: arranca al hacerse visible y se reinicia al ocultarse.
  useEffect(() => {
    const raiz = refRaiz.current;
    if (!raiz || !renglones.length) return undefined;
    const trazos = gsap.utils.toArray(raiz.querySelectorAll('[data-trazo]'));
    const rellenos = gsap.utils.toArray(raiz.querySelectorAll('[data-relleno]'));
    if (!trazos.length) return undefined;
    const largo = Math.max((medidas?.tamano ?? 16) * 7, 200);
    const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const todos = [...trazos, ...rellenos];

    const ocultar = () => {
      gsap.set(trazos, { strokeDasharray: largo, strokeDashoffset: largo, strokeOpacity: 1 });
      gsap.set(rellenos, { opacity: 0 });
    };
    if (reducido) {
      gsap.set(trazos, { strokeOpacity: 0 });
      gsap.set(rellenos, { opacity: visible ? 1 : 0 });
      return undefined;
    }
    ocultar();
    if (!visible) return () => gsap.killTweensOf(todos);

    const letra = ENTRE_LETRAS;
    const linea = gsap.timeline({ delay: 0.25 });
    linea.to(trazos, { strokeDashoffset: 0, duration: DIBUJO, ease: 'power2.out', stagger: letra }, 0);
    linea.to(rellenos, { opacity: 1, duration: 0.35, ease: 'power2.out', stagger: letra }, DIBUJO * RELLENO_DESDE);
    // Una vez lleno, el contorno se desvanece: el texto queda como cualquier otro.
    linea.to(trazos, { strokeOpacity: 0, duration: 0.5, ease: 'power1.out', stagger: letra }, DIBUJO + 0.35);
    return () => {
      linea.kill();
      gsap.killTweensOf(todos);
    };
  }, [renglones, visible, medidas?.tamano]);

  return (
    <div ref={refRaiz} className={`${styles.bio} ${className}`.trim()}>
      <p className={styles.soloLectores}>{textoPlano}</p>
      {/* Mientras no hay medidas (primer render o sin JS) se ve el texto normal. */}
      {!renglones.length ? <p className={styles.respaldo} aria-hidden="true">{textoPlano}</p> : null}
      <div aria-hidden="true">
        {renglones.map((renglon, i) => (
          <svg
            key={i}
            className={styles.renglon}
            width="100%"
            height={medidas.interlineado}
            viewBox={`0 0 ${medidas.ancho} ${medidas.interlineado}`}
            style={{ fontFamily: medidas.familia, fontSize: `${medidas.tamano}px` }}
          >
            <text x="0" y={medidas.interlineado * 0.68} fill="none" strokeWidth="0.9" strokeLinejoin="round" strokeLinecap="round">
              {renglon.flatMap((fragmento, j) =>
                Array.from(fragmento.texto).map((c, k) => (
                  <tspan
                    key={`${j}-${k}`}
                    data-trazo
                    stroke="var(--color-accent)"
                    fontWeight={fragmento.resaltado ? 700 : 400}
                  >
                    {c}
                  </tspan>
                ))
              )}
            </text>
            <text x="0" y={medidas.interlineado * 0.68} stroke="none">
              {renglon.flatMap((fragmento, j) =>
                Array.from(fragmento.texto).map((c, k) => (
                  <tspan
                    key={`${j}-${k}`}
                    data-relleno
                    fill={fragmento.resaltado ? 'var(--color-accent)' : 'var(--color-fg)'}
                    fontWeight={fragmento.resaltado ? 700 : 400}
                  >
                    {c}
                  </tspan>
                ))
              )}
            </text>
          </svg>
        ))}
      </div>
    </div>
  );
}
