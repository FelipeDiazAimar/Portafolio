'use client';

import { useRef, useState } from 'react';

const ESCRIBIR_MS = 24;
const MOSTRAR_COPIADO_MS = 1100;

async function copiarAlPortapapeles(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = texto;
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

// Copia un dato y lo "reescribe" letra por letra: se borra, aparece
// "copiado ✓" y vuelve a escribirse el valor (coherente con el slide que escribe).
export default function useCopiar() {
  const [visibles, setVisibles] = useState({});
  const ocupados = useRef(new Set());

  function animar(id, desde, hasta) {
    return new Promise((resolver) => {
      let i = desde.length;
      const borrar = setInterval(() => {
        i -= 1;
        setVisibles((v) => ({ ...v, [id]: desde.slice(0, Math.max(0, i)) }));
        if (i > 0) return;
        clearInterval(borrar);
        let j = 0;
        const escribir = setInterval(() => {
          j += 1;
          setVisibles((v) => ({ ...v, [id]: hasta.slice(0, j) }));
          if (j >= hasta.length) {
            clearInterval(escribir);
            resolver();
          }
        }, ESCRIBIR_MS);
      }, ESCRIBIR_MS / 2.2);
    });
  }

  async function copiar(id, valorVisible, texto) {
    if (ocupados.current.has(id)) return;
    ocupados.current.add(id);
    await copiarAlPortapapeles(texto);
    await animar(id, valorVisible, 'copiado ✓');
    await new Promise((r) => setTimeout(r, MOSTRAR_COPIADO_MS));
    await animar(id, 'copiado ✓', valorVisible);
    setVisibles((v) => {
      const { [id]: _, ...resto } = v;
      return resto;
    });
    ocupados.current.delete(id);
  }

  // Texto a mostrar para un dato (el animado si está copiándose) y si está en curso.
  const texto = (id, valor) => visibles[id] ?? valor;
  const copiando = (id) => id in visibles;
  return { copiar, texto, copiando };
}
