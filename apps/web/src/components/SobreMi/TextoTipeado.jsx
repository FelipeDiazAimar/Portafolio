'use client';

import { useEffect, useState } from 'react';

// Escribe `texto` letra por letra (como a máquina) con un cursor que parpadea al
// final. Se reinicia cuando cambia el texto; con movimiento reducido aparece entero.
// El texto completo queda siempre para lectores de pantalla.
// `rangos` ([inicio, fin) de lo que se resalta, ordenados) y `claseClave` marcan fragmentos
// del texto con <mark> mientras se escribe.
function conResaltado(texto, escritas, rangos, claseClave) {
  if (!rangos?.length) return texto.slice(0, escritas);
  const partes = [];
  let cursor = 0;
  rangos.forEach(([inicio, fin], i) => {
    if (cursor >= escritas) return;
    if (inicio > cursor) partes.push(texto.slice(cursor, Math.min(inicio, escritas)));
    if (inicio < escritas) {
      partes.push(
        <mark key={i} className={claseClave}>
          {texto.slice(inicio, Math.min(fin, escritas))}
        </mark>
      );
    }
    cursor = Math.max(cursor, fin);
  });
  if (cursor < escritas) partes.push(texto.slice(cursor, escritas));
  return partes;
}

export default function TextoTipeado({ texto, velocidad = 28, retraso = 450, className = '', rangos, claseClave }) {
  const [escritas, setEscritas] = useState(0);

  useEffect(() => {
    const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducido) {
      setEscritas(texto.length);
      return undefined;
    }
    setEscritas(0);
    let intervalo = 0;
    const inicio = setTimeout(() => {
      intervalo = setInterval(() => {
        setEscritas((n) => {
          if (n >= texto.length) {
            clearInterval(intervalo);
            return n;
          }
          return n + 1;
        });
      }, velocidad);
    }, retraso);
    return () => {
      clearTimeout(inicio);
      clearInterval(intervalo);
    };
  }, [texto, velocidad, retraso]);

  const terminado = escritas >= texto.length;
  return (
    <span className={className}>
      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{texto}</span>
      <span aria-hidden="true">
        {conResaltado(texto, escritas, rangos, claseClave)}
        <span style={{ opacity: terminado ? 0 : 1, marginLeft: 1 }}>▍</span>
      </span>
    </span>
  );
}
