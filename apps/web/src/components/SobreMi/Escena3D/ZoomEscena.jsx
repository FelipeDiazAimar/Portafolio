'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

const limitar = (x, a, b) => Math.min(b, Math.max(a, x));

// Zoom del modelo de la escena con el pellizco del trackpad (Ctrl + rueda) o con dos dedos,
// sin hacer zoom en la página: sirve para acercarse a los detalles y a los textos. Sólo
// actúa mientras la escena es la activa y vuelve a 1 al irse. Mismo gesto que el grafo del
// último hito.
export default function ZoomEscena({ activa = true, minimo = 0.7, maximo = 3.5, children }) {
  const lienzo = useThree((estado) => estado.gl.domElement);
  const controles = useThree((estado) => estado.controls);
  const refControles = useRef(controles);
  refControles.current = controles;
  const refGrupo = useRef(null);
  const objetivo = useRef(1);
  const actual = useRef(1);
  const refActiva = useRef(activa);
  refActiva.current = activa;

  useEffect(() => {
    if (!activa) objetivo.current = 1;
  }, [activa]);

  useEffect(() => {
    const punteros = new Map();
    let distanciaPrevia = null;
    const seccion = lienzo.closest('section') ?? lienzo;

    const alRodar = (evento) => {
      if (!refActiva.current || !evento.ctrlKey || !seccion.contains(evento.target)) return;
      evento.preventDefault();
      objetivo.current = limitar(objetivo.current * Math.exp(-evento.deltaY * 0.01), minimo, maximo);
    };
    const distancia = () => {
      const [a, b] = [...punteros.values()];
      return Math.hypot(a.x - b.x, a.y - b.y) || 1;
    };
    const alBajar = (evento) => {
      if (!refActiva.current || evento.pointerType !== 'touch' || evento.target !== lienzo) return;
      punteros.set(evento.pointerId, { x: evento.clientX, y: evento.clientY });
      if (punteros.size === 2) {
        lienzo.style.touchAction = 'none';
        if (refControles.current) refControles.current.enabled = false;
        distanciaPrevia = distancia();
      }
    };
    const alMover = (evento) => {
      if (!punteros.has(evento.pointerId)) return;
      punteros.set(evento.pointerId, { x: evento.clientX, y: evento.clientY });
      if (punteros.size === 2 && distanciaPrevia) {
        const ahora = distancia();
        objetivo.current = limitar(objetivo.current * (ahora / distanciaPrevia), minimo, maximo);
        distanciaPrevia = ahora;
      }
    };
    const alSubir = (evento) => {
      if (!punteros.delete(evento.pointerId)) return;
      if (punteros.size < 2 && distanciaPrevia) {
        lienzo.style.touchAction = 'pan-y';
        if (refControles.current) refControles.current.enabled = true;
        distanciaPrevia = null;
      }
    };
    // Doble toque/clic: vuelve al tamaño original.
    const alDobleClick = () => {
      if (refActiva.current) objetivo.current = 1;
    };
    const sinGesto = (evento) => {
      if (refActiva.current) evento.preventDefault();
    };

    window.addEventListener('wheel', alRodar, { passive: false, capture: true });
    window.addEventListener('pointerdown', alBajar, true);
    window.addEventListener('pointermove', alMover);
    window.addEventListener('pointerup', alSubir);
    window.addEventListener('pointercancel', alSubir);
    lienzo.addEventListener('dblclick', alDobleClick);
    seccion.addEventListener('gesturestart', sinGesto);
    seccion.addEventListener('gesturechange', sinGesto);
    return () => {
      window.removeEventListener('wheel', alRodar, { capture: true });
      window.removeEventListener('pointerdown', alBajar, true);
      window.removeEventListener('pointermove', alMover);
      window.removeEventListener('pointerup', alSubir);
      window.removeEventListener('pointercancel', alSubir);
      lienzo.removeEventListener('dblclick', alDobleClick);
      seccion.removeEventListener('gesturestart', sinGesto);
      seccion.removeEventListener('gesturechange', sinGesto);
      lienzo.style.touchAction = 'pan-y';
      if (refControles.current) refControles.current.enabled = true;
    };
  }, [lienzo, minimo, maximo]);

  useFrame((_, delta) => {
    actual.current += (objetivo.current - actual.current) * (1 - Math.exp(-Math.min(delta, 0.05) / 0.12));
    refGrupo.current?.scale.setScalar(actual.current);
  });

  return <group ref={refGrupo}>{children}</group>;
}
