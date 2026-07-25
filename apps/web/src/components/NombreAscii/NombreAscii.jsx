'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './NombreAscii.module.css';

const DEMORA_INICIO_MS = 3300;

// Fase 1: se dibuja la onda sonora completa.
const DISPERSION_ONDA_MS = 550;
const DURACION_ONDA_MS = 300;
const ESPERA_ONDA_MS = 650;
// Fase 2: la onda se atenúa (arriba, abajo y en el medio) y deja leer el nombre.
const DISPERSION_REVELADO_MS = 450;
const DURACION_REVELADO_MS = 600;
const ESPERA_REVELADO_MS = 1000;
// Fase 3: los caracteres se apagan de a poco y entra el texto normal.
const DISPERSION_DESVANECIDO_MS = 550;
const DURACION_DESVANECIDO_MS = 500;

// Máximo de filas de lluvia arriba y abajo del nombre. Cuánto usa cada
// columna lo decide la envolvente de onda.
const FILAS_LLUVIA = 18;
// Separación horizontal entre columnas, en fracción del alto de celda.
const SEPARACION_COLUMNAS = 0.6;
// Brillo máximo del fondo en la fase 2: la onda tiene que quedar por
// debajo del nombre, no competirle.
const BRILLO_FONDO_REVELADO = 0.6;

// Nada de bloques (█) ni glifos raros: en muchas fuentes monoespaciadas
// caen en el rectángulo de "carácter faltante". Solo ASCII imprimible.
const CARACTERES_DENSOS = 'MW#@$%&B8NQ';
const CARACTERES_LLUVIA = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789!?*/|:;<>=+-_%$#@&^~';

function elegir(alfabeto) {
  return alfabeto[Math.floor(Math.random() * alfabeto.length)];
}

// Envolvente tipo onda sonora: cuántas filas de lluvia le tocan a cada
// columna. Varias senoidales de distinta frecuencia superpuestas más un
// jitter, para que el contorno suba y baje como un visualizador de audio
// en vez de recortarse como un rectángulo.
function alturaDeOnda(columna, totalColumnas) {
  const x = columna / Math.max(1, totalColumnas - 1);
  const perfil =
    0.5 +
    0.28 * Math.sin(2 * Math.PI * 1.5 * x) +
    0.18 * Math.sin(2 * Math.PI * 4.3 * x + 1.2) +
    0.12 * Math.sin(2 * Math.PI * 9.1 * x + 3.4) +
    (Math.random() - 0.5) * 0.14;
  return Math.max(1, Math.round(Math.min(1, Math.max(0.08, perfil)) * FILAS_LLUVIA));
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

// Arma las columnas verticales. Cada celda lleva su opacidad para la fase
// de onda y para la de revelado; el carácter NUNCA cambia, así los pasajes
// entre fases son fundidos y no letras que aparecen y desaparecen de golpe.
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

  function celda(caracter, opacidadOnda, opacidadRevelado) {
    return {
      caracter,
      opacidadOnda,
      opacidadRevelado,
      demoraOnda: Math.random() * DISPERSION_ONDA_MS,
      demoraRevelado: Math.random() * DISPERSION_REVELADO_MS,
      demoraDesvanecido: Math.random() * DISPERSION_DESVANECIDO_MS,
    };
  }

  const columnas = [];
  for (let c = 0; c < totalColumnas; c++) {
    // Cada columna tiene su propio "caudal": si todas pesaran igual el
    // conjunto se lee como un párrafo macizo, no como streams separados.
    const caudal = 0.65 + Math.random() * 0.35;
    const alcance = alturaDeOnda(c, totalColumnas);
    const celdas = [];

    // t: 0 pegado al nombre, 1 en la punta de ESTA columna — el decaimiento
    // es relativo a su propia altura, así todas se apagan justo en su punta.
    function celdaDeLluvia(distancia) {
      const caracter = elegir(CARACTERES_LLUVIA);
      // Fuera de la envolvente la celda no existe en ninguna de las fases.
      if (distancia > alcance) return celda(caracter, 0, 0);

      const t = distancia / (alcance + 1);
      const variacion = 0.82 + Math.random() * 0.18;

      // Fase 1: sólido en el centro, se desvanece hacia arriba y abajo.
      const enOnda = (1 - t) ** 1.15 * variacion;
      // Fase 2: además se abre en el medio. El seno vale 0 en las dos
      // puntas y máximo a mitad de camino, así el nombre queda despejado
      // y la onda sigue leyéndose como fondo.
      const enRevelado = Math.sin(Math.PI * t) ** 1.2 * BRILLO_FONDO_REVELADO * caudal * variacion;

      return celda(caracter, enOnda, enRevelado);
    }

    for (let d = FILAS_LLUVIA; d >= 1; d--) celdas.push(celdaDeLluvia(d));

    for (let f = 0; f < filasNombre; f++) {
      const enOnda = 0.82 + Math.random() * 0.18;
      if (esGlifo(c, f)) {
        // El nombre queda excluido de la apertura del medio: es lo único
        // que sube a opacidad plena en la fase 2.
        celdas.push(celda(elegir(CARACTERES_DENSOS), enOnda, 1));
      } else {
        // Huecos entre las letras: caracteres sueltos apenas perceptibles.
        const suelto = Math.random() < 0.4;
        celdas.push(
          celda(elegir(CARACTERES_LLUVIA), enOnda, suelto ? 0.12 + Math.random() * 0.1 : 0)
        );
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

// Opacidad y tiempos de cada celda según la fase en curso.
function estiloDeCelda(celda, fase) {
  if (fase === 'oculto') {
    return { opacity: 0, transitionDuration: '0ms', transitionDelay: '0ms' };
  }
  if (fase === 'onda') {
    return {
      opacity: celda.opacidadOnda,
      transitionDuration: `${DURACION_ONDA_MS}ms`,
      transitionDelay: `${celda.demoraOnda}ms`,
    };
  }
  if (fase === 'revelado') {
    return {
      opacity: celda.opacidadRevelado,
      transitionDuration: `${DURACION_REVELADO_MS}ms`,
      transitionDelay: `${celda.demoraRevelado}ms`,
    };
  }
  return {
    opacity: 0,
    transitionDuration: `${DURACION_DESVANECIDO_MS}ms`,
    transitionDelay: `${celda.demoraDesvanecido}ms`,
  };
}

export default function NombreAscii() {
  const refContenedor = useRef(null);
  const refLimpio = useRef(null);

  const [empezar, setEmpezar] = useState(false);
  // 'oculto' -> 'onda' -> 'revelado' -> 'desvanecido'
  const [fase, setFase] = useState('oculto');
  const [campo, setCampo] = useState(null);
  const [montado, setMontado] = useState(false);

  // Espejo de `fase` para leerla desde listeners sin re-suscribirlos.
  const refFase = useRef(fase);
  refFase.current = fase;

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

  // Ojo: `fase` NO puede estar acá. Al construir el campo se dispara la
  // cadena de fases, y si eso reconstruía el campo el ciclo se reiniciaba
  // solo — el nombre asomaba y volvía al campo lleno para siempre.
  useEffect(() => {
    if (!empezar || campo) return;
    let cancelado = false;

    document.fonts.ready.then(() => {
      if (!cancelado) construirCampo();
    });

    return () => {
      cancelado = true;
    };
  }, [empezar, campo, construirCampo]);

  // El tamaño del nombre depende del viewport (clamp con vw), así que si
  // cambia hay que recalcar: si no, el ASCII queda corrido respecto al texto.
  // Solo mientras el campo aún se está armando: recalcar más tarde
  // reiniciaría la animación.
  useEffect(() => {
    let temporizador;
    function alRedimensionar() {
      if (refFase.current !== 'oculto' && refFase.current !== 'onda') return;
      clearTimeout(temporizador);
      temporizador = setTimeout(construirCampo, 150);
    }
    window.addEventListener('resize', alRedimensionar);
    return () => {
      window.removeEventListener('resize', alRedimensionar);
      clearTimeout(temporizador);
    };
  }, [construirCampo]);

  // Encadena las fases. El primer salto va en un frame aparte para que el
  // navegador tenga un estado inicial (opacidad 0) desde donde transicionar.
  useEffect(() => {
    if (!campo) return;

    const cuadro = requestAnimationFrame(() => setFase('onda'));

    const finOnda = DISPERSION_ONDA_MS + DURACION_ONDA_MS + ESPERA_ONDA_MS;
    const finRevelado =
      finOnda + DISPERSION_REVELADO_MS + DURACION_REVELADO_MS + ESPERA_REVELADO_MS;

    const aRevelado = setTimeout(() => setFase('revelado'), finOnda);
    const aDesvanecido = setTimeout(() => setFase('desvanecido'), finRevelado);

    return () => {
      cancelAnimationFrame(cuadro);
      clearTimeout(aRevelado);
      clearTimeout(aDesvanecido);
    };
  }, [campo]);

  function reiniciar() {
    setCampo(null);
    setFase('oculto');
    setEmpezar(true);
  }

  return (
    <div className={styles.contenedor} ref={refContenedor}>
      <span className={styles.soloLectura}>Felipe Diaz Aimar</span>

      <div
        ref={refLimpio}
        className={`${styles.textoLimpio} ${fase === 'desvanecido' ? styles.visible : ''}`}
        aria-hidden="true"
      >
        <span>Felipe</span>
        <span>Diaz Aimar</span>
      </div>

      {campo && (
        <div
          className={styles.ascii}
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
                  style={estiloDeCelda(celda, fase)}
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
