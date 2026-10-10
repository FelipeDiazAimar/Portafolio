'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './TextoTipeado.module.css';

const MS_BASE_POR_LETRA = 22;
const MS_AZAR_POR_LETRA = 30;
// Una pausa tras la puntuación hace que se lea como alguien que escribe.
const MS_PAUSA_PUNTUACION = 170;

// Convierte 'texto **importante** texto' en segmentos { texto, negrita }.
// Impares del split = lo que estaba entre asteriscos.
function leerSegmentos(marcado) {
  return marcado
    .split('**')
    .map((texto, i) => ({ texto, negrita: i % 2 === 1 }))
    .filter((segmento) => segmento.texto.length > 0);
}

// Dibuja los caracteres [desde, hasta) del texto completo, respetando en qué
// segmentos cae cada uno (un segmento en negrita puede quedar cortado a la
// mitad por el borde entre lo escrito y lo pendiente).
function dibujarRango(segmentos, desde, hasta) {
  const partes = [];
  let inicio = 0;
  segmentos.forEach((segmento, i) => {
    const fin = inicio + segmento.texto.length;
    const a = Math.max(desde, inicio);
    const b = Math.min(hasta, fin);
    if (b > a) {
      const trozo = segmento.texto.slice(a - inicio, b - inicio);
      partes.push(
        segmento.negrita ? (
          <strong key={i} className={styles.negrita}>
            {trozo}
          </strong>
        ) : (
          <span key={i}>{trozo}</span>
        )
      );
    }
    inicio = fin;
  });
  return partes;
}

// Texto que se escribe solo, letra a letra, la primera vez que `visible` es
// true. El texto completo ocupa su lugar desde el principio (las letras
// pendientes son invisibles, no inexistentes): así el bloque no crece ni
// salta a medida que se escribe, aunque el párrafo ocupe varias líneas.
export default function TextoTipeado({ texto, visible, demoraMs = 0, className = '' }) {
  // `texto` admite **negrita**: se lee una vez y se trabaja sobre el texto
  // plano, que es el que se escribe letra a letra.
  const segmentos = useMemo(() => leerSegmentos(texto), [texto]);
  const largo = useMemo(
    () => segmentos.reduce((suma, segmento) => suma + segmento.texto.length, 0),
    [segmentos]
  );
  const plano = useMemo(() => segmentos.map((segmento) => segmento.texto).join(''), [segmentos]);
  const [escritas, setEscritas] = useState(0);
  const [arranco, setArranco] = useState(false);

  useEffect(() => {
    if (visible) setArranco(true);
  }, [visible]);

  useEffect(() => {
    if (!arranco) return undefined;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setEscritas(largo);
      return undefined;
    }

    let temporizador = 0;
    let cantidad = 0;

    function escribirSiguiente() {
      cantidad += 1;
      setEscritas(cantidad);
      if (cantidad >= largo) return;
      const anterior = plano[cantidad - 1];
      const pausa = /[.,;:]/.test(anterior) ? MS_PAUSA_PUNTUACION : 0;
      temporizador = setTimeout(
        escribirSiguiente,
        MS_BASE_POR_LETRA + Math.random() * MS_AZAR_POR_LETRA + pausa
      );
    }

    temporizador = setTimeout(escribirSiguiente, demoraMs);
    return () => clearTimeout(temporizador);
  }, [arranco, plano, largo, demoraMs]);

  const escribiendo = arranco && escritas < largo;

  return (
    <p
      className={`${styles.texto} ${visible ? styles.visible : ''} ${className}`}
      aria-hidden="true"
    >
      <span>{dibujarRango(segmentos, 0, escritas)}</span>
      {escribiendo && <span className={styles.cursor} />}
      <span className={styles.pendiente}>{dibujarRango(segmentos, escritas, largo)}</span>
    </p>
  );
}
