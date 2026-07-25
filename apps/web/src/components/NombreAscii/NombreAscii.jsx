'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './NombreAscii.module.css';

const DEMORA_INICIO_MS = 3300;

// Fase 1: el campo entero se llena de ASCII.
const DISPERSION_LLENADO_MS = 900;
const DURACION_LLENADO_MS = 450;
const ESPERA_CAMPO_LLENO_MS = 900;
// Fase 2: el relleno se adelgaza y recién ahí aparece el nombre.
const DISPERSION_ADELGAZADO_MS = 700;
const DURACION_ADELGAZADO_MS = 900;
const ESPERA_NOMBRE_ASCII_MS = 1500;

// Cuántas filas de lluvia se agregan arriba y abajo del nombre.
const FILAS_LLUVIA = 14;
// Separación horizontal entre columnas, en fracción del alto de celda.
const SEPARACION_COLUMNAS = 0.6;

// Nada de bloques (█) ni glifos raros: en muchas fuentes monoespaciadas
// caen en el rectángulo de "carácter faltante". Solo ASCII imprimible.
const CARACTERES_DENSOS = 'MW#@$%&B8NQ';
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

// Arma las columnas verticales. Cada celda guarda DOS opacidades: la del
// campo lleno inicial y la definitiva. Nunca cambia de carácter — lo que
// se anima es sólo la opacidad, así el adelgazado se ve como un fundido y
// no como letras que aparecen y desaparecen de golpe.
function generarCampo(calco) {
  const { pixeles, ancho, alto, tamanoFuente, izquierda, arriba } = calco;
  const { data } = pixeles;

  const celdaAlto = Math.max(5, Math.round(tamanoFuente / 9));
  const separacion = celdaAlto * SEPARACION_COLUMNAS;
  const anchoCaracter = celdaAlto * medirRatioMonoespaciado();
  const paso = anchoCaracter + separacion;

  const totalColumnas = Math.floor(ancho / paso);
  const filasNombre = Math.floor(alto / celdaAlto);
  if (totalColumnas <= 0 || filasNombre <= 0) return null;

  function esGlifo(columna, fila) {
    const x = Math.min(ancho - 1, Math.floor(columna * paso + anchoCaracter / 2));
    const y = Math.min(alto - 1, Math.floor(fila * celdaAlto + celdaAlto / 2));
    return data[(y * ancho + x) * 4 + 3] > 128;
  }

  function celda(caracter, opacidadFinal) {
    return {
      caracter,
      // En el campo lleno todo pesa parecido: el nombre todavía no se lee.
      opacidadLlena: 0.75 + Math.random() * 0.25,
      opacidadFinal,
      demoraLlenado: Math.random() * DISPERSION_LLENADO_MS,
      demoraAdelgazado: Math.random() * DISPERSION_ADELGAZADO_MS,
    };
  }

  const columnas = [];
  for (let c = 0; c < totalColumnas; c++) {
    // Cada columna tiene su propio "caudal": si todas tuvieran la misma
    // densidad el conjunto se lee como un párrafo macizo, no como streams.
    const caudal = 0.3 + Math.random() * 0.7;
    const celdas = [];

    // t: 0 pegado al nombre, 1 en el borde exterior del campo.
    function celdaDeLluvia(distancia) {
      const t = distancia / (FILAS_LLUVIA + 1);
      const densidad = (0.6 * (1 - t) + 0.04) * caudal;
      const caracter = elegir(CARACTERES_LLUVIA);
      if (Math.random() > densidad) return celda(caracter, 0);
      return celda(caracter, Math.max(0.05, (1 - t) ** 1.5));
    }

    for (let d = FILAS_LLUVIA; d >= 1; d--) celdas.push(celdaDeLluvia(d));

    for (let f = 0; f < filasNombre; f++) {
      if (esGlifo(c, f)) {
        celdas.push(celda(elegir(CARACTERES_DENSOS), 1));
      } else {
        // Huecos entre las letras: caracteres sueltos apenas perceptibles.
        const suelto = Math.random() < 0.4;
        celdas.push(celda(elegir(CARACTERES_LLUVIA), suelto ? 0.14 + Math.random() * 0.1 : 0));
      }
    }

    for (let d = 1; d <= FILAS_LLUVIA; d++) celdas.push(celdaDeLluvia(d));

    columnas.push(celdas);
  }

  return {
    columnas,
    tamanoCelda: celdaAlto,
    separacion,
    izquierda,
    arriba: arriba - FILAS_LLUVIA * celdaAlto,
  };
}

export default function NombreAscii() {
  const refContenedor = useRef(null);
  const refLimpio = useRef(null);

  const [empezar, setEmpezar] = useState(false);
  // 'oculto' -> 'lleno' -> 'lluvia' -> 'formado'
  const [fase, setFase] = useState('oculto');
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
    if (!empezar || fase === 'formado') return;
    let cancelado = false;

    document.fonts.ready.then(() => {
      if (!cancelado) construirCampo();
    });

    return () => {
      cancelado = true;
    };
  }, [empezar, fase, construirCampo]);

  // El tamaño del nombre depende del viewport (clamp con vw), así que si
  // cambia hay que recalcar: si no, el ASCII queda corrido respecto al texto.
  useEffect(() => {
    if (!empezar || fase === 'formado') return;
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
  }, [empezar, fase, construirCampo]);

  // Encadena las fases. El primer salto va en un frame aparte para que el
  // navegador tenga un estado inicial (opacidad 0) desde donde transicionar.
  useEffect(() => {
    if (!campo) return;

    const cuadro = requestAnimationFrame(() => setFase('lleno'));

    const aLluvia = setTimeout(
      () => setFase('lluvia'),
      DISPERSION_LLENADO_MS + DURACION_LLENADO_MS + ESPERA_CAMPO_LLENO_MS
    );

    const aFormado = setTimeout(
      () => setFase('formado'),
      DISPERSION_LLENADO_MS +
        DURACION_LLENADO_MS +
        ESPERA_CAMPO_LLENO_MS +
        DISPERSION_ADELGAZADO_MS +
        DURACION_ADELGAZADO_MS +
        ESPERA_NOMBRE_ASCII_MS
    );

    return () => {
      cancelAnimationFrame(cuadro);
      clearTimeout(aLluvia);
      clearTimeout(aFormado);
    };
  }, [campo]);

  function reiniciar() {
    setCampo(null);
    setFase('oculto');
    setEmpezar(true);
  }

  const enLluvia = fase === 'lluvia' || fase === 'formado';

  return (
    <div className={styles.contenedor} ref={refContenedor}>
      <span className={styles.soloLectura}>Felipe Diaz Aimar</span>

      <div
        ref={refLimpio}
        className={`${styles.textoLimpio} ${fase === 'formado' ? styles.visible : ''}`}
        aria-hidden="true"
      >
        <span>Felipe</span>
        <span>Diaz Aimar</span>
      </div>

      {campo && (
        <div
          className={`${styles.ascii} ${fase === 'formado' ? styles.oculto : ''}`}
          aria-hidden="true"
          style={{
            left: `${campo.izquierda}px`,
            top: `${campo.arriba}px`,
            fontSize: `${campo.tamanoCelda}px`,
            columnGap: `${campo.separacion}px`,
          }}
        >
          {campo.columnas.map((celdas, indiceColumna) => (
            <span key={indiceColumna} className={styles.columna}>
              {celdas.map((celda, indiceCelda) => (
                <span
                  key={indiceCelda}
                  className={styles.caracter}
                  style={
                    enLluvia
                      ? {
                          opacity: celda.opacidadFinal,
                          transitionDuration: `${DURACION_ADELGAZADO_MS}ms`,
                          transitionDelay: `${celda.demoraAdelgazado}ms`,
                        }
                      : {
                          opacity: fase === 'oculto' ? 0 : celda.opacidadLlena,
                          transitionDuration: `${DURACION_LLENADO_MS}ms`,
                          transitionDelay: `${celda.demoraLlenado}ms`,
                        }
                  }
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
