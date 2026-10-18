'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import estilos from './RayosX.module.css';

// Pantallas táctiles: dejar que el dedo "pinte" como si fuera el mouse.
// El hero está detrás del contenido (z-index: -1) y sin eventos de puntero: un dedo que arrastra
// sobre la foto cae sobre el documento y el navegador lo toma como scroll (cancelando los eventos
// de puntero). Esta capa va en el body, encima del hero, y le dice al navegador qué gestos son de
// la página:
//  - 'foto': sólo sobre la foto, ningún gesto es de scroll (touch-action: none), así se puede
//    pintar el esqueleto en cualquier dirección. Fuera de la foto (el texto, abajo) se sigue
//    pudiendo hacer scroll.
//  - 'fondo': todo el hero, sólo el scroll vertical es de la página (pan-y): arrastrar de lado mueve
//    la cámara y el trazo del fondo de esqueletos, y arrastrar hacia arriba o abajo scrollea.
// No tiene lógica propia: los eventos de puntero suben hasta `window`, donde ya escuchan el revelado
// de la foto y el fondo.
export default function ZonaTactil({ modo, refMarco }) {
  const [caja, setCaja] = useState(null);

  useEffect(() => {
    if (modo !== 'foto') return undefined;
    const marco = refMarco.current;
    if (!marco) return undefined;
    // la caja de la foto en coordenadas del documento, recortada a lo que se ve de ella
    const medir = () => {
      const r = marco.getBoundingClientRect();
      const izquierda = Math.max(0, r.left);
      const derecha = Math.min(window.innerWidth, r.right);
      if (derecha <= izquierda) {
        setCaja(null);
        return;
      }
      setCaja({
        left: izquierda + window.scrollX,
        top: r.top + window.scrollY,
        width: derecha - izquierda,
        height: r.height,
      });
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(marco);
    window.addEventListener('resize', medir);
    return () => {
      observador.disconnect();
      window.removeEventListener('resize', medir);
    };
  }, [modo, refMarco]);

  if (typeof document === 'undefined') return null;
  const estilo =
    modo === 'foto'
      ? caja && { left: caja.left, top: caja.top, width: caja.width, height: caja.height, touchAction: 'none' }
      : { left: 0, top: 0, width: '100%', height: '100svh', touchAction: 'pan-y' };
  if (!estilo) return null;
  return createPortal(<div className={estilos.zonaTactil} style={estilo} aria-hidden="true" />, document.body);
}
