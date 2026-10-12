'use client';

import { useEffect, useState } from 'react';

// Escribe `texto` letra por letra (como a máquina) con un cursor que parpadea al
// final. Se reinicia cuando cambia el texto; con movimiento reducido aparece entero.
// El texto completo queda siempre para lectores de pantalla.
export default function TextoTipeado({ texto, velocidad = 28, retraso = 450, className = '' }) {
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
        {texto.slice(0, escritas)}
        <span style={{ opacity: terminado ? 0 : 1, marginLeft: 1 }}>▍</span>
      </span>
    </span>
  );
}
