'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './NombreAscii.module.css';

const DEMORA_INICIO_MS = 3300;
const DEMORA_POR_FILA_MS = 60;
const DURACION_FILA_MS = 500;
const TAMANO_CELDA_X = 6;
const TAMANO_CELDA_Y = 11;
const TAMANO_FUENTE_PX = 70;
const CARACTERES_RELLENO = '/*+#%@$&01';
const LINEAS = ['Felipe', 'Diaz Aimar'];

// Genera una grilla de caracteres ASCII que calca la silueta real del
// texto: dibuja las líneas en un canvas oculto con la misma fuente que
// usa .textoLimpio, y por cada celda de la grilla pone un carácter si
// ese punto cae "dentro" de la letra (según el canal alfa del pixel).
function generarGrillaAscii(fontFamily) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const pesoFuente = 800;

  ctx.font = `${pesoFuente} ${TAMANO_FUENTE_PX}px ${fontFamily}`;
  const altoLinea = TAMANO_FUENTE_PX * 1.15;
  const anchoMaximo = Math.max(...LINEAS.map((linea) => ctx.measureText(linea).width));

  canvas.width = Math.ceil(anchoMaximo) + 4;
  canvas.height = Math.ceil(altoLinea * LINEAS.length);

  // Redimensionar el canvas resetea el contexto: hay que reaplicar el font.
  ctx.font = `${pesoFuente} ${TAMANO_FUENTE_PX}px ${fontFamily}`;
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'top';
  LINEAS.forEach((linea, indice) => ctx.fillText(linea, 0, indice * altoLinea));

  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const columnas = Math.floor(width / TAMANO_CELDA_X);
  const filas = Math.floor(height / TAMANO_CELDA_Y);
  const grilla = [];

  for (let fila = 0; fila < filas; fila++) {
    let filaTexto = '';
    for (let columna = 0; columna < columnas; columna++) {
      const x = Math.min(width - 1, Math.floor(columna * TAMANO_CELDA_X + TAMANO_CELDA_X / 2));
      const y = Math.min(height - 1, Math.floor(fila * TAMANO_CELDA_Y + TAMANO_CELDA_Y / 2));
      const alpha = data[(y * width + x) * 4 + 3];
      filaTexto += alpha > 128 ? CARACTERES_RELLENO[Math.floor(Math.random() * CARACTERES_RELLENO.length)] : ' ';
    }
    grilla.push(filaTexto);
  }

  return grilla;
}

function AsciiAnimado({ formado, onFormado }) {
  const [grilla, setGrilla] = useState(null);

  useEffect(() => {
    let cancelado = false;

    document.fonts.ready.then(() => {
      if (cancelado) return;
      const fontFamily = getComputedStyle(document.body).fontFamily;
      setGrilla(generarGrillaAscii(fontFamily));
    });

    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (!grilla) return;
    const duracionTotal = grilla.length * DEMORA_POR_FILA_MS + DURACION_FILA_MS;
    const temporizadorFin = setTimeout(onFormado, duracionTotal);
    return () => clearTimeout(temporizadorFin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grilla]);

  if (!grilla) return null;

  return (
    <pre className={`${styles.ascii} ${formado ? styles.oculto : ''}`} aria-hidden="true">
      {grilla.map((filaTexto, indice) => (
        <span key={indice} className={styles.fila} style={{ animationDelay: `${indice * DEMORA_POR_FILA_MS}ms` }}>
          {filaTexto}
          {'\n'}
        </span>
      ))}
    </pre>
  );
}

export default function NombreAscii() {
  const [empezar, setEmpezar] = useState(false);
  const [formado, setFormado] = useState(false);
  const [intento, setIntento] = useState(0);
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    const temporizadorInicio = setTimeout(() => setEmpezar(true), DEMORA_INICIO_MS);
    return () => clearTimeout(temporizadorInicio);
  }, []);

  // Portal a propósito: HeroInmersivo y toda su cadena de .capa tienen
  // pointer-events: none (es una capa decorativa, aria-hidden), así que
  // ningún elemento clickeable renderizado ahí adentro puede recibir clics
  // de forma confiable. Sacamos el botón del DOM del hero por completo.
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

      {empezar && <AsciiAnimado key={intento} formado={formado} onFormado={() => setFormado(true)} />}

      <div className={`${styles.textoLimpio} ${formado ? styles.visible : ''}`} aria-hidden="true">
        <span>Felipe</span>
        <span>Diaz Aimar</span>
      </div>

      <div className={`${styles.franja} ${styles.franjaSuperior} ${formado ? styles.encogida : ''}`} />
      <div className={`${styles.franja} ${styles.franjaInferior} ${formado ? styles.encogida : ''}`} />

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
