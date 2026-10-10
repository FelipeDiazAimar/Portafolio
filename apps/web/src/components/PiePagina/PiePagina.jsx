'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { calcarTextoLimpio, medirRatioMonoespaciado } from '@/lib/calcoTexto.js';
import styles from './PiePagina.module.css';

// Mismo motivo que en NombreAscii: matter-js sólo se baja si hay hover fino.
const ColapsoFisico = dynamic(
  () => import('@/components/ColapsoFisico/ColapsoFisico.jsx'),
  { ssr: false }
);

// Solo ASCII imprimible: los bloques Unicode caen en el rectángulo de
// carácter faltante en varias monoespaciadas.
const CARACTERES_DENSOS = 'MW#@$%&B8NQ';
const SEPARACION_COLUMNAS = 0.6;
const PISO_SOBRE_BORDE_PX = 16;

function elegir(alfabeto) {
  return alfabeto[Math.floor(Math.random() * alfabeto.length)];
}

// Versión mínima del campo del hero: sólo las celdas del nombre, sin lluvia
// ni onda alrededor. Mantiene la misma forma de objeto, que es lo que consume
// ColapsoFisico.
function generarCampoNombre(calco) {
  const { pixeles, ancho, alto, tamanoFuente, izquierda, arriba } = calco;
  const { data } = pixeles;

  const celdaAlto = Math.max(5, Math.round(tamanoFuente / 9));
  const separacion = celdaAlto * SEPARACION_COLUMNAS;
  const anchoCaracter = celdaAlto * medirRatioMonoespaciado();
  const paso = anchoCaracter + separacion;

  const totalColumnas = Math.floor(ancho / paso);
  const filas = Math.floor(alto / celdaAlto);
  if (totalColumnas <= 0 || filas <= 0) return null;

  function esGlifo(columna, fila) {
    const x = Math.min(ancho - 1, Math.floor(columna * paso + anchoCaracter / 2));
    const y = Math.min(alto - 1, Math.floor(fila * celdaAlto + celdaAlto / 2));
    return data[(y * ancho + x) * 4 + 3] > 128;
  }

  const columnas = [];
  for (let c = 0; c < totalColumnas; c += 1) {
    const celdas = [];
    for (let f = 0; f < filas; f += 1) {
      const nombre = esGlifo(c, f);
      celdas.push({ caracter: nombre ? elegir(CARACTERES_DENSOS) : ' ', esNombre: nombre });
    }
    columnas.push(celdas);
  }

  return {
    columnas,
    tamanoCelda: celdaAlto,
    separacion,
    paso,
    izquierda,
    arriba,
    textoIzquierda: izquierda,
    textoArriba: arriba,
    lineasLimpias: calco.lineas,
  };
}

export default function PiePagina() {
  const refPie = useRef(null);
  const refContenedor = useRef(null);
  const refLimpio = useRef(null);
  const [campo, setCampo] = useState(null);
  // { x, y, region }: dónde entró el mouse y qué rectángulo de página cubre
  // el overlay del colapso.
  const [colapso, setColapso] = useState(null);
  // Tras un colapso hay que salir del nombre y volver a entrar para
  // re-disparar: quedarse quieto encima lo relanzaría en loop.
  const refEsperandoSalida = useRef(false);
  const refColapso = useRef(colapso);
  refColapso.current = colapso;

  const construirCampo = useCallback(() => {
    if (!refContenedor.current || !refLimpio.current) return;
    const calco = calcarTextoLimpio(refLimpio.current, refContenedor.current);
    if (!calco) return;
    setCampo(generarCampoNombre(calco));
  }, []);

  useEffect(() => {
    let cancelado = false;
    let temporizador;

    document.fonts.ready.then(() => {
      if (!cancelado) construirCampo();
    });

    // El tamaño del nombre depende del viewport. Con un colapso en curso no
    // se recalca: reemplazaría `campo` y reiniciaría la simulación.
    function alRedimensionar() {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        if (!refColapso.current) construirCampo();
      }, 200);
    }
    window.addEventListener('resize', alRedimensionar);
    return () => {
      cancelado = true;
      clearTimeout(temporizador);
      window.removeEventListener('resize', alRedimensionar);
    };
  }, [construirCampo]);

  // La detección es por mousemove global y no por eventos del nombre: el
  // overlay del colapso está portaleado a <body> y los mismos motivos del
  // hero (capas con pointer-events: none) hacen poco fiable el hover del DOM.
  useEffect(() => {
    if (!campo || colapso) return undefined;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    function alMoverse(evento) {
      const nodo = refLimpio.current;
      const pie = refPie.current;
      if (!nodo || !pie) return;
      const rect = nodo.getBoundingClientRect();
      const adentro =
        evento.clientX >= rect.left &&
        evento.clientX <= rect.right &&
        evento.clientY >= rect.top &&
        evento.clientY <= rect.bottom;

      if (!adentro) {
        refEsperandoSalida.current = false;
        return;
      }
      if (refEsperandoSalida.current) return;

      const rectPie = pie.getBoundingClientRect();
      setColapso({
        x: evento.clientX + window.scrollX,
        y: evento.clientY + window.scrollY,
        region: {
          left: rectPie.left + window.scrollX,
          top: rectPie.top + window.scrollY,
          width: rectPie.width,
          // El piso queda un poco por encima del borde de la página: si
          // coincidiera, los pies y los caracteres se verían cortados.
          height: rectPie.height - PISO_SOBRE_BORDE_PX,
        },
      });
    }

    window.addEventListener('mousemove', alMoverse, { passive: true });
    return () => window.removeEventListener('mousemove', alMoverse);
  }, [campo, colapso]);

  return (
    <footer className={styles.pie} ref={refPie}>
      <p className={styles.derechos}>© {new Date().getFullYear()}</p>

      <div className={styles.contenedor} ref={refContenedor}>
        <div
          ref={refLimpio}
          className={`${styles.nombre} ${colapso ? styles.oculto : ''}`}
        >
          <span>Felipe Diaz Aimar</span>
        </div>
      </div>

      {colapso && campo && (
        <ColapsoFisico
          campo={campo}
          modo="stickman"
          refContenedor={refContenedor}
          posicionInicialRaton={{ x: colapso.x, y: colapso.y }}
          region={colapso.region}
          alTerminar={() => {
            refEsperandoSalida.current = true;
            setColapso(null);
          }}
        />
      )}
    </footer>
  );
}
