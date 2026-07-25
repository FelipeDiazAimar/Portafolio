'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './NombreAscii.module.css';

const DEMORA_INICIO_MS = 3300;
const DURACION_MATERIALIZADO_MS = 450;
const DISPERSION_DEMORA_MS = 900;
const ESPERA_ANTES_DE_LIMPIAR_MS = 1600;

// Cuántas filas de lluvia se agregan arriba y abajo del nombre.
const FILAS_LLUVIA = 14;

// El relleno del nombre usa caracteres "gordos" para que el cuerpo de las
// letras se lea macizo; la lluvia usa símbolos sueltos tipo data flow.
const CARACTERES_DENSOS = '█MW#@$&B8';
const CARACTERES_LLUVIA = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789!?*/|:;<>=+-_%$#@&^~';

function elegir(alfabeto) {
  return alfabeto[Math.floor(Math.random() * alfabeto.length)];
}

// Ancho de un carácter monoespaciado relativo a su alto (con line-height 1).
// Lo necesitamos para que la celda de sampleo tenga exactamente la misma
// proporción que el carácter renderizado — si no, el ASCII sale estirado.
function medirRatioMonoespaciado() {
  const ctx = document.createElement('canvas').getContext('2d');
  const referencia = 100;
  ctx.font = `${referencia}px monospace`;
  return ctx.measureText('0').width / referencia;
}

// Calca el texto limpio TAL COMO EL NAVEGADOR LO DIBUJA: lee la posición y
// la tipografía real de cada línea del DOM y las repinta en un canvas del
// mismo tamaño. Así la grilla resultante se superpone pixel a pixel con el
// texto final, en vez de ser un dibujo aparte que hay que adivinar dónde va.
function calcarTextoLimpio(elementoLimpio, contenedor) {
  const lineas = Array.from(elementoLimpio.children);
  if (lineas.length === 0) return null;

  const rectContenedor = contenedor.getBoundingClientRect();
  const rects = lineas.map((linea) => linea.getBoundingClientRect());

  const izquierda = Math.min(...rects.map((r) => r.left));
  const arriba = Math.min(...rects.map((r) => r.top));
  const derecha = Math.max(...rects.map((r) => r.right));
  const abajo = Math.max(...rects.map((r) => r.bottom));

  const ancho = Math.ceil(derecha - izquierda);
  const alto = Math.ceil(abajo - arriba);
  if (ancho <= 0 || alto <= 0) return null;

  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'alphabetic';

  lineas.forEach((linea, indice) => {
    const estilo = getComputedStyle(linea);
    ctx.font = `${estilo.fontStyle} ${estilo.fontWeight} ${estilo.fontSize} ${estilo.fontFamily}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = estilo.letterSpacing;

    const rect = rects[indice];
    const metricas = ctx.measureText(linea.textContent);
    const ascendente = metricas.fontBoundingBoxAscent ?? metricas.actualBoundingBoxAscent;
    const descendente = metricas.fontBoundingBoxDescent ?? metricas.actualBoundingBoxDescent;
    // El glifo se apoya en la línea base, que va centrada dentro de la caja
    // de línea (rect.height incluye el line-height, no sólo el glifo).
    const lineaBase = rect.top - arriba + (rect.height - (ascendente + descendente)) / 2 + ascendente;
    ctx.fillText(linea.textContent, rect.left - izquierda, lineaBase);
  });

  const tamanoFuente = parseFloat(getComputedStyle(lineas[0]).fontSize);

  return {
    pixeles: ctx.getImageData(0, 0, ancho, alto),
    ancho,
    alto,
    tamanoFuente,
    izquierda: izquierda - rectContenedor.left,
    arriba: arriba - rectContenedor.top,
  };
}

// Arma las columnas verticales: cada una es un stream independiente que
// atraviesa la zona del nombre. Dentro del nombre los caracteres son densos
// y opacos; fuera, la lluvia pierde densidad y opacidad a medida que se
// aleja verticalmente — el degradado es por carácter, no una franja encima.
function generarCampo(calco) {
  const { pixeles, ancho, alto, tamanoFuente, izquierda, arriba } = calco;
  const { data } = pixeles;

  const celdaAlto = Math.max(5, Math.round(tamanoFuente / 9));
  const celdaAncho = celdaAlto * medirRatioMonoespaciado();

  const totalColumnas = Math.floor(ancho / celdaAncho);
  const filasNombre = Math.floor(alto / celdaAlto);
  if (totalColumnas <= 0 || filasNombre <= 0) return null;

  function esGlifo(columna, fila) {
    const x = Math.min(ancho - 1, Math.floor(columna * celdaAncho + celdaAncho / 2));
    const y = Math.min(alto - 1, Math.floor(fila * celdaAlto + celdaAlto / 2));
    return data[(y * ancho + x) * 4 + 3] > 128;
  }

  // t: 0 pegado al nombre, 1 en el borde exterior del campo.
  function celdaDeLluvia(distancia) {
    const t = distancia / (FILAS_LLUVIA + 1);
    const densidad = 0.9 * (1 - t) + 0.06;
    if (Math.random() > densidad) return { caracter: ' ', opacidad: 0 };
    return { caracter: elegir(CARACTERES_LLUVIA), opacidad: Math.max(0.04, (1 - t) ** 1.6) };
  }

  const columnas = [];
  for (let c = 0; c < totalColumnas; c++) {
    const celdas = [];

    for (let d = FILAS_LLUVIA; d >= 1; d--) celdas.push(celdaDeLluvia(d));

    for (let f = 0; f < filasNombre; f++) {
      if (esGlifo(c, f)) {
        celdas.push({ caracter: elegir(CARACTERES_DENSOS), opacidad: 1 });
      } else {
        // Huecos entre letras: apenas un rastro de lluvia para no comerse
        // la legibilidad del nombre.
        celdas.push(
          Math.random() < 0.3
            ? { caracter: elegir(CARACTERES_LLUVIA), opacidad: 0.16 }
            : { caracter: ' ', opacidad: 0 }
        );
      }
    }

    for (let d = 1; d <= FILAS_LLUVIA; d++) celdas.push(celdaDeLluvia(d));

    // Demora aleatoria por carácter: el campo "se materializa" como estática,
    // sin ninguna línea que barra en una dirección.
    columnas.push(
      celdas.map((celda) => ({ ...celda, demora: Math.random() * DISPERSION_DEMORA_MS }))
    );
  }

  return {
    columnas,
    tamanoCelda: celdaAlto,
    izquierda,
    arriba: arriba - FILAS_LLUVIA * celdaAlto,
  };
}

export default function NombreAscii() {
  const refContenedor = useRef(null);
  const refLimpio = useRef(null);

  const [empezar, setEmpezar] = useState(false);
  const [formado, setFormado] = useState(false);
  const [campo, setCampo] = useState(null);
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
    const temporizador = setTimeout(() => setEmpezar(true), DEMORA_INICIO_MS);
    return () => clearTimeout(temporizador);
  }, []);

  const construirCampo = useCallback(() => {
    if (!refContenedor.current || !refLimpio.current) return;
    const calco = calcarTextoLimpio(refLimpio.current, refContenedor.current);
    if (!calco) return;
    setCampo(generarCampo(calco));
  }, []);

  useEffect(() => {
    if (!empezar || formado) return;
    let cancelado = false;

    document.fonts.ready.then(() => {
      if (!cancelado) construirCampo();
    });

    return () => {
      cancelado = true;
    };
  }, [empezar, formado, construirCampo]);

  // El tamaño del nombre depende del viewport (clamp con vw), así que si
  // cambia hay que recalcar: si no, el ASCII queda corrido respecto al texto.
  useEffect(() => {
    if (!empezar || formado) return;
    let temporizador;
    function alRedimensionar() {
      clearTimeout(temporizador);
      temporizador = setTimeout(construirCampo, 150);
    }
    window.addEventListener('resize', alRedimensionar);
    return () => {
      window.removeEventListener('resize', alRedimensionar);
      clearTimeout(temporizador);
    };
  }, [empezar, formado, construirCampo]);

  useEffect(() => {
    if (!campo || formado) return;
    const total =
      DISPERSION_DEMORA_MS + DURACION_MATERIALIZADO_MS + ESPERA_ANTES_DE_LIMPIAR_MS;
    const temporizador = setTimeout(() => setFormado(true), total);
    return () => clearTimeout(temporizador);
  }, [campo, formado]);

  function reiniciar() {
    setCampo(null);
    setFormado(false);
    setEmpezar(true);
  }

  return (
    <div className={styles.contenedor} ref={refContenedor}>
      <span className={styles.soloLectura}>Felipe Diaz Aimar</span>

      <div
        ref={refLimpio}
        className={`${styles.textoLimpio} ${formado ? styles.visible : ''}`}
        aria-hidden="true"
      >
        <span>Felipe</span>
        <span>Diaz Aimar</span>
      </div>

      {campo && (
        <div
          className={`${styles.ascii} ${formado ? styles.oculto : ''}`}
          aria-hidden="true"
          style={{
            left: `${campo.izquierda}px`,
            top: `${campo.arriba}px`,
            fontSize: `${campo.tamanoCelda}px`,
          }}
        >
          {campo.columnas.map((celdas, indiceColumna) => (
            <span key={indiceColumna} className={styles.columna}>
              {celdas.map((celda, indiceCelda) => (
                <span
                  key={indiceCelda}
                  className={styles.caracter}
                  style={{
                    '--opacidad': celda.opacidad,
                    animationDelay: `${celda.demora}ms`,
                  }}
                >
                  {celda.caracter}
                </span>
              ))}
            </span>
          ))}
        </div>
      )}

      {/* TEMPORAL: solo para probar la animación sin recargar la página. Sacar después. */}
      {montado &&
        createPortal(
          <button type="button" onClick={reiniciar} className={styles.botonReiniciar}>
            Reiniciar animación
          </button>,
          document.body
        )}
    </div>
  );
}
