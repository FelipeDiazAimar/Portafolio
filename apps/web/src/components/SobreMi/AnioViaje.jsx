'use client';

import { useMotionValueEvent } from 'framer-motion';
import { useRef, useState } from 'react';
import { anioEnViaje, estadoLineal, opacidadAnio, tramoDe } from '@/lib/columna/recorrido.js';
import TextoTrazo from '@/components/TextoTrazo/TextoTrazo.jsx';
import styles from './AnioViaje.module.css';

const acotar = (x) => Math.min(1, Math.max(0, x));
const suavizar = (x) => acotar(x) * acotar(x) * (3 - 2 * acotar(x));

// El año enorme que cuenta durante el viaje (2022… 2023). Decorativo: el año real está
// en el encabezado del hito y en el minimapa.
// Cada vez que aparece, y cada vez que cambia el número, se vuelve a dibujar: primero el
// contorno se traza y después se rellena (StrokeFill).
// En un salto largo del minimapa (`refSalto.current = { desde, hasta }`) no aparece y se va en
// cada hito que se cruza: entra con suavidad al arrancar, se queda mientras dura el salto y
// se va con suavidad al llegar.
export default function AnioViaje({ hitos, progreso, oculto, refSalto }) {
  const ref = useRef(null);
  const refTexto = useRef('');
  const refVisible = useRef(false);
  const [dibujo, setDibujo] = useState({ texto: '', clave: 0 });

  const mostrar = (texto, opacidad) => {
    const elemento = ref.current;
    if (!elemento) return;
    elemento.style.opacity = String(opacidad);
    const visible = opacidad > 0.02;
    // Vuelve a dibujarse al aparecer y cuando cambia el texto.
    if (texto !== refTexto.current || (visible && !refVisible.current)) {
      refTexto.current = texto;
      setDibujo((previo) => ({ texto, clave: previo.clave + 1 }));
    }
    refVisible.current = visible;
  };

  useMotionValueEvent(progreso, 'change', (p) => {
    if (!ref.current) return;
    const tramo = tramoDe(p, hitos.length);
    const salto = refSalto?.current;
    if (salto && !oculto && salto.hasta !== salto.desde) {
      const s = estadoLineal(tramo);
      const avance = acotar((s - salto.desde) / (salto.hasta - salto.desde));
      const segmento = Math.min(Math.max(Math.floor(s), 0), hitos.length - 2);
      mostrar(
        anioEnViaje(hitos[segmento].anio, hitos[segmento + 1].anio, acotar(s - segmento)),
        Math.min(suavizar(avance / 0.2), suavizar((1 - avance) / 0.2))
      );
      return;
    }
    if (oculto || tramo.tipo !== 'viaje') {
      ref.current.style.opacity = '0';
      refVisible.current = false;
      return;
    }
    mostrar(anioEnViaje(hitos[tramo.indice].anio, hitos[tramo.indice + 1].anio, tramo.t), opacidadAnio(tramo.t));
  });

  return (
    <p ref={ref} className={styles.anio} style={{ opacity: 0 }} aria-hidden="true">
      {dibujo.texto ? (
        <TextoTrazo key={dibujo.clave} texto={dibujo.texto} claseTexto={styles.anioTrazo} duracion={1.4} grosor={2.5} rellenoFinal={0.2} />
      ) : null}
    </p>
  );
}
