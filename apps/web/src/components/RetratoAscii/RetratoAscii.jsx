'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { convertirAAscii, leerColoresDelTema, pintarAscii } from './conversionAscii.js';
import styles from './RetratoAscii.module.css';

const RUTA_RETRATO = '/Yo.png';
const ANCHO_RETRATO = 433;
const ALTO_RETRATO = 577;

const COLUMNAS_ASCII = 110;
// Mismo valor que en NombreAscii: es lo que hace que las dos intros arranquen
// juntas apenas se va el splash de Bienvenida.
const DEMORA_INICIO_MS = 3300;
const DURACION_ESCRITURA_MS = 3200;
// Tiene que coincidir con --duracion-revelado del CSS.
const DURACION_REVELADO_FOTO_MS = 700;

// Recorte en L: las filas ya terminadas más el trozo escrito de la fila en
// curso. Es lo que hace que el ASCII se "escriba" sin repintar el canvas.
function recorteDeEscritura(progreso, columnas, filas) {
  if (progreso >= 1) return 'none';

  const reveladas = progreso * columnas * filas;
  const fila = Math.floor(reveladas / columnas);
  const columna = reveladas - fila * columnas;

  const yCompleto = (100 * fila) / filas;
  const ySiguiente = (100 * (fila + 1)) / filas;
  const xParcial = (100 * columna) / columnas;

  return `polygon(0% 0%, 100% 0%, 100% ${yCompleto}%, ${xParcial}% ${yCompleto}%, ${xParcial}% ${ySiguiente}%, 0% ${ySiguiente}%)`;
}

export default function RetratoAscii() {
  const refMarco = useRef(null);
  const refLienzo = useRef(null);
  const refImagen = useRef(null);
  const refAscii = useRef(null);

  // 'esperando' -> 'escribiendo' -> 'revelando' -> 'foto'
  const [fase, setFase] = useState('esperando');
  const [esperaCumplida, setEsperaCumplida] = useState(false);
  const [listo, setListo] = useState(false);
  const [reducido, setReducido] = useState(false);

  useEffect(() => {
    setReducido(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  // Convierte y pinta. Se llama una vez al cargar la imagen; la Task 4 la
  // vuelve a llamar cuando cambia el tema.
  const repintar = useCallback(() => {
    const lienzo = refLienzo.current;
    const marco = refMarco.current;
    const imagen = refImagen.current;
    if (!lienzo || !marco || !imagen) return false;

    const { colorTexto, colorFondo, invertida } = leerColoresDelTema();
    const ascii = convertirAAscii(imagen, { columnas: COLUMNAS_ASCII, invertida });
    refAscii.current = ascii;

    const { width: ancho, height: alto } = marco.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    lienzo.width = ancho * dpr;
    lienzo.height = alto * dpr;
    const ctx = lienzo.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    pintarAscii(ctx, ascii, ancho, alto, colorTexto, colorFondo);

    // El canvas queda pintado entero desde que carga la imagen, pero la
    // escritura no arranca hasta DEMORA_INICIO_MS. Sin recortarlo acá, el
    // retrato completo asoma cuando se va el splash de Bienvenida y después
    // desaparece de golpe al empezar a escribirse.
    lienzo.style.clipPath = recorteDeEscritura(0, ascii.columnas, ascii.filas);
    return true;
  }, []);

  // Carga de la imagen y primer pintado. Con reduced-motion no se pinta nunca.
  useEffect(() => {
    if (reducido) return undefined;
    let cancelado = false;
    const imagen = new window.Image();
    imagen.onload = () => {
      if (cancelado) return;
      refImagen.current = imagen;
      try {
        // Si no se pudo pintar no hay ASCII que escribir: se degrada a
        // mostrar la foto en vez de dejar el marco vacío esperando una
        // intro que no puede arrancar.
        if (repintar()) setListo(true);
        else setFase('foto');
      } catch {
        // Cualquier fallo de la conversión o del canvas: se muestra la foto.
        setFase('foto');
      }
    };
    // Si la imagen no carga, el <Image> de next/image apunta al mismo archivo
    // y también va a fallar, así que esto no recupera nada: sólo evita que
    // `listo` quede en false para siempre y con él la fase trabada en
    // 'esperando'. Degradación, no rescate.
    imagen.onerror = () => {
      if (cancelado) return;
      setFase('foto');
    };
    imagen.src = RUTA_RETRATO;
    return () => {
      cancelado = true;
    };
  }, [reducido, repintar]);

  useEffect(() => {
    const temporizador = setTimeout(() => setEsperaCumplida(true), DEMORA_INICIO_MS);
    return () => clearTimeout(temporizador);
  }, []);

  // Con reduced-motion se salta la intro entera: la foto ya visible.
  useEffect(() => {
    if (reducido) setFase('foto');
  }, [reducido]);

  // La escritura no puede arrancar antes de que el canvas esté pintado: si no,
  // el clip-path destaparía un lienzo vacío.
  useEffect(() => {
    if (fase !== 'esperando' || !esperaCumplida || !listo) return;
    setFase('escribiendo');
  }, [fase, esperaCumplida, listo]);

  // Escritura: avance LINEAL, sin easing. Una máquina de escribir tiene
  // cadencia constante; con ease-out las últimas filas se arrastran.
  useEffect(() => {
    if (fase !== 'escribiendo') return undefined;
    const lienzo = refLienzo.current;
    const ascii = refAscii.current;
    if (!lienzo || !ascii) {
      // Sin ASCII no hay nada que escribir: se salta al cruce en vez de
      // dejar la fase trabada.
      setFase('revelando');
      return undefined;
    }

    const inicio = performance.now();
    let bucle = 0;

    function cuadro(ahora) {
      const progreso = Math.min(1, (ahora - inicio) / DURACION_ESCRITURA_MS);
      lienzo.style.clipPath = recorteDeEscritura(progreso, ascii.columnas, ascii.filas);
      if (progreso >= 1) {
        setFase('revelando');
        return;
      }
      bucle = requestAnimationFrame(cuadro);
    }

    bucle = requestAnimationFrame(cuadro);
    return () => cancelAnimationFrame(bucle);
  }, [fase]);

  // Cruce ASCII -> foto. Al terminar, el canvas recupera opacity 1 ya tapado
  // por la máscara (--radio arranca en 0), así que el cambio no se ve.
  useEffect(() => {
    if (fase !== 'revelando') return undefined;
    const temporizador = setTimeout(() => setFase('foto'), DURACION_REVELADO_FOTO_MS);
    return () => clearTimeout(temporizador);
  }, [fase]);

  const fotoRevelada = fase !== 'esperando' && fase !== 'escribiendo';

  return (
    <div className={styles.marco} ref={refMarco}>
      <Image
        src={RUTA_RETRATO}
        alt=""
        width={ANCHO_RETRATO}
        height={ALTO_RETRATO}
        priority
        className={`${styles.foto} ${fotoRevelada ? styles.revelada : ''}`}
      />
      <canvas
        ref={refLienzo}
        aria-hidden="true"
        className={`${styles.ascii} ${fase === 'revelando' ? styles.desvaneciendo : ''} ${
          fase === 'foto' ? styles.enmascarado : ''
        }`}
      />
    </div>
  );
}
