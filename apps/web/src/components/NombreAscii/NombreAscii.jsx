'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './NombreAscii.module.css';

const DEMORA_INICIO_MS = 3300;
const DEMORA_POR_COLUMNA_MS = 30;
const DURACION_COLUMNA_MS = 500;
const TAMANO_FUENTE_NOMBRE_PX = 80;
const FILAS_RELLENO = 10;
const DENSIDAD_RELLENO = 0.8;
const CARACTERES_RELLENO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const LINEAS = ['Felipe', 'Diaz Aimar'];

// Mide cuántos px de ancho ocupa un carácter monoespaciado en relación a
// su alto (con line-height 1) — así la grilla de sampleo tiene la MISMA
// proporción que el <pre> real y el ASCII no sale estirado ni achatado.
function medirRatioMonoespaciado() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const referencia = 100;
  ctx.font = `${referencia}px monospace`;
  return ctx.measureText('0').width / referencia;
}

function caracterAleatorio() {
  return CARACTERES_RELLENO[Math.floor(Math.random() * CARACTERES_RELLENO.length)];
}

// Genera la grilla completa (por filas): relleno disperso arriba, el
// nombre calcado del canvas (según el canal alfa de cada celda), y más
// relleno abajo. Devuelve también qué porcentaje de la altura total
// ocupa el relleno, para que las franjas de degradado cubran esa zona.
function generarGrillaAscii(fontFamily) {
  const ratioMonoespaciado = medirRatioMonoespaciado();
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const pesoFuente = 800;

  ctx.font = `${pesoFuente} ${TAMANO_FUENTE_NOMBRE_PX}px ${fontFamily}`;
  const altoLinea = TAMANO_FUENTE_NOMBRE_PX * 1.15;
  const anchoMaximo = Math.max(...LINEAS.map((linea) => ctx.measureText(linea).width));

  canvas.width = Math.ceil(anchoMaximo) + 4;
  canvas.height = Math.ceil(altoLinea * LINEAS.length);

  // Redimensionar el canvas resetea el contexto: hay que reaplicar el font.
  ctx.font = `${pesoFuente} ${TAMANO_FUENTE_NOMBRE_PX}px ${fontFamily}`;
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'top';
  LINEAS.forEach((linea, indice) => ctx.fillText(linea, 0, indice * altoLinea));

  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const celdaAlto = 11;
  const celdaAncho = Math.max(1, Math.round(celdaAlto * ratioMonoespaciado));
  const numColumnas = Math.floor(width / celdaAncho);
  const filasNombre = Math.floor(height / celdaAlto);

  function filaDelNombre(fila) {
    let texto = '';
    for (let columna = 0; columna < numColumnas; columna++) {
      const x = Math.min(width - 1, Math.floor(columna * celdaAncho + celdaAncho / 2));
      const y = Math.min(height - 1, Math.floor(fila * celdaAlto + celdaAlto / 2));
      const alpha = data[(y * width + x) * 4 + 3];
      texto += alpha > 128 ? caracterAleatorio() : ' ';
    }
    return texto;
  }

  function filaDeRelleno() {
    let texto = '';
    for (let columna = 0; columna < numColumnas; columna++) {
      texto += Math.random() < DENSIDAD_RELLENO ? caracterAleatorio() : ' ';
    }
    return texto;
  }

  const filas = [];
  for (let i = 0; i < FILAS_RELLENO; i++) filas.push(filaDeRelleno());
  for (let fila = 0; fila < filasNombre; fila++) filas.push(filaDelNombre(fila));
  for (let i = 0; i < FILAS_RELLENO; i++) filas.push(filaDeRelleno());

  const porcentajeRelleno = (FILAS_RELLENO / filas.length) * 100;

  return { filas, porcentajeRelleno };
}

// Da vuelta la grilla de filas a columnas: cada string resultante se lee
// de arriba hacia abajo en una posición horizontal fija — son las
// "líneas verticales" que se animan como streams independientes, en vez
// de un párrafo que se revela línea por línea.
function transponerAColumnas(filas) {
  const numColumnas = filas[0]?.length ?? 0;
  const columnas = [];
  for (let c = 0; c < numColumnas; c++) {
    let columna = '';
    for (let f = 0; f < filas.length; f++) {
      columna += filas[f][c] ?? ' ';
    }
    columnas.push(columna);
  }
  return columnas;
}

function AsciiAnimado({ formado, onFormado, onGrilla }) {
  const [columnas, setColumnas] = useState(null);

  useEffect(() => {
    let cancelado = false;

    document.fonts.ready.then(() => {
      if (cancelado) return;
      const fontFamily = getComputedStyle(document.body).fontFamily;
      const { filas, porcentajeRelleno } = generarGrillaAscii(fontFamily);
      setColumnas(transponerAColumnas(filas));
      onGrilla(porcentajeRelleno);
    });

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!columnas) return;
    const duracionTotal = columnas.length * DEMORA_POR_COLUMNA_MS + DURACION_COLUMNA_MS;
    const temporizadorFin = setTimeout(onFormado, duracionTotal);
    return () => clearTimeout(temporizadorFin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnas]);

  if (!columnas) return null;

  return (
    <div className={`${styles.ascii} ${formado ? styles.oculto : ''}`} aria-hidden="true">
      {columnas.map((columnaTexto, indiceColumna) => (
        <span
          key={indiceColumna}
          className={styles.columna}
          style={{ animationDelay: `${indiceColumna * DEMORA_POR_COLUMNA_MS}ms` }}
        >
          {columnaTexto.split('').map((caracter, indiceFila) => (
            <span key={indiceFila} className={styles.caracter}>
              {caracter}
            </span>
          ))}
        </span>
      ))}
    </div>
  );
}

export default function NombreAscii() {
  const [empezar, setEmpezar] = useState(false);
  const [formado, setFormado] = useState(false);
  const [intento, setIntento] = useState(0);
  const [montado, setMontado] = useState(false);
  const [porcentajeRelleno, setPorcentajeRelleno] = useState(35);

  useEffect(() => {
    const temporizadorInicio = setTimeout(() => setEmpezar(true), DEMORA_INICIO_MS);
    return () => clearTimeout(temporizadorInicio);
  }, []);

  useEffect(() => {
    setMontado(true);
  }, []);

  function reiniciar() {
    setFormado(false);
    setEmpezar(true);
    setIntento((valor) => valor + 1);
  }

  return (
    <div className={styles.contenedor}>
      <span className={styles.soloLectura}>Felipe Diaz Aimar</span>

      {empezar && (
        <AsciiAnimado
          key={intento}
          formado={formado}
          onFormado={() => setFormado(true)}
          onGrilla={setPorcentajeRelleno}
        />
      )}

      <div className={`${styles.textoLimpio} ${formado ? styles.visible : ''}`} aria-hidden="true">
        <span>Felipe</span>
        <span>Diaz Aimar</span>
      </div>

      {/* Más transparente lejos del nombre (bordes), más opaco (tapado)
          cerca del nombre, en el medio. */}
      <div
        className={styles.franja}
        style={{
          top: 0,
          height: formado ? '0%' : `${porcentajeRelleno}%`,
          background: 'linear-gradient(to bottom, transparent 0%, var(--color-bg) 100%)',
        }}
      />
      <div
        className={styles.franja}
        style={{
          bottom: 0,
          height: formado ? '0%' : `${porcentajeRelleno}%`,
          background: 'linear-gradient(to top, transparent 0%, var(--color-bg) 100%)',
        }}
      />

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
