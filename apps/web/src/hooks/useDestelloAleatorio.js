'use client';

import { useEffect, useRef } from 'react';
import { prefiereMovimientoReducido } from '@/lib/entrada.js';

// Cada tanto, a un intervalo al azar, le pone a uno de los nodos una clase que
// dispara un destello (ver styles/destello.module.css) y se la saca al terminar.
// Cada destello sale distinto: duración, sentido (izquierda→derecha o al
// revés) y cuánto gris, y nunca cae dos veces seguidas en el mismo nodo.
//
//   nodos     () => [elementos]   se evalúa en cada disparo, así sirve para
//                                  contenido que cambia (p. ej. las negritas)
//   activo    sólo corre mientras es true
//   clase     una o varias clases (separadas por espacio) a poner
//   minMs/maxMs  rango del tiempo entre destellos
//   sentido   'aleatorio' (por defecto) o 'izquierda-derecha' (siempre igual)
export default function useDestelloAleatorio({
  nodos,
  activo,
  clase,
  minMs = 5000,
  maxMs = 11000,
  sentido = 'aleatorio',
}) {
  const refNodos = useRef(nodos);
  refNodos.current = nodos;

  useEffect(() => {
    if (!activo || prefiereMovimientoReducido()) return undefined;

    const clases = clase.split(' ').filter(Boolean);
    let temporizador = 0;
    let ultimo = -1;
    let nodoActual = null;

    function limpiar() {
      nodoActual?.classList.remove(...clases);
      nodoActual = null;
    }

    function programar(primera) {
      // El primero llega antes, para que se note que el texto "está vivo".
      const factor = primera ? 0.45 : 1;
      temporizador = setTimeout(disparar, factor * (minMs + Math.random() * (maxMs - minMs)));
    }

    function disparar() {
      const lista = (refNodos.current() || []).filter(Boolean);
      if (lista.length === 0) {
        programar(false);
        return;
      }
      let indice = Math.floor(Math.random() * lista.length);
      if (lista.length > 1 && indice === ultimo) indice = (indice + 1) % lista.length;
      ultimo = indice;

      const duracion = 1.4 + Math.random() * 1.1;
      const deIzquierda = sentido === 'izquierda-derecha' ? true : Math.random() < 0.5;
      const nodo = lista[indice];
      nodo.style.setProperty('--destello-dur', `${duracion.toFixed(2)}s`);
      nodo.style.setProperty('--destello-desde', deIzquierda ? '100%' : '0%');
      nodo.style.setProperty('--destello-hasta', deIzquierda ? '0%' : '100%');
      nodo.style.setProperty('--destello-mezcla', `${Math.round(45 + Math.random() * 40)}%`);
      nodo.classList.add(...clases);
      nodoActual = nodo;

      // Con temporizador y no con `animationend`: si el nodo no llega a
      // animarse (oculto, por ejemplo) el evento nunca saldría y el ciclo
      // quedaría colgado para siempre.
      temporizador = setTimeout(() => {
        limpiar();
        programar(false);
      }, duracion * 1000 + 250);
    }

    programar(true);
    return () => {
      clearTimeout(temporizador);
      limpiar();
    };
  }, [activo, clase, minMs, maxMs, sentido]);
}
