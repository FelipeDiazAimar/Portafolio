'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { usePortfolio } from '@/contexto/ProveedorPortfolio.jsx';
import { esDisenoVertical, prefiereMovimientoReducido } from '@/lib/entrada.js';
import RevelarEsqueleto from '@/components/RayosX/RevelarEsqueleto.jsx';
import { convertirAAscii, leerColoresDelTema, pintarAscii } from './conversionAscii.js';
import styles from './RetratoAscii.module.css';

const RUTA_RETRATO = '/retrato.png';
// La conversión a ASCII sólo necesita una grilla de ~140 columnas: se baja la
// variante chica que sirve el optimizador de imágenes (unos 100 KB) y no el
// PNG original de varios MB. La proporción es la misma.
const RUTA_PARA_ASCII = `/_next/image?url=${encodeURIComponent(RUTA_RETRATO)}&w=640&q=75`;
// Medidas reales del archivo. Tienen que coincidir con el `aspect-ratio` de
// `.marco`: la foto es `object-fit: contain` y el ASCII llena la caja entera,
// así que si el marco tuviera otra proporción las dos capas dejarían de
// registrar entre sí y el barrido mostraría foto donde el ASCII dibuja sujeto.
const ANCHO_RETRATO = 1792;
const ALTO_RETRATO = 2390;

// El retrato ocupa casi todo el alto del hero, así que la grilla es más fina
// que la del tamaño de tarjeta para que el ASCII siga leyéndose como una cara.
const COLUMNAS_ASCII = 140;
// En teléfono la cara ocupa menos píxeles y la conversión pesa más que lo que
// se llega a distinguir: grilla más gruesa.
const COLUMNAS_ASCII_MOVIL = 100;
// Mismo valor que en NombreAscii: es lo que hace que las dos intros arranquen
// juntas apenas se va el splash de Bienvenida.
const DEMORA_INICIO_MS = 3300;
const DURACION_ESCRITURA_MS = 3200;
// Cuánto se queda el ASCII completo a la vista antes de dar paso a la foto.
const PAUSA_ASCII_MS = 2600;
// Tiene que coincidir con --duracion-revelado del CSS.
const DURACION_REVELADO_FOTO_MS = 700;
// Tiempo máximo de espera por la imagen antes de degradar a la foto.
const TIEMPO_MAXIMO_DE_CARGA_MS = 8000;
// Cuántas alturas de pantalla de scroll tarda el retrato en apagarse del todo.
const ALTURAS_PARA_DESVANECER = 0.85;

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

// `rayosX`: el hero pasó al fondo de esqueletos (la foto se funde). `alDispararRayosX`: lo pide
// el revelado tras 4 s con el cursor sobre la foto.
export default function RetratoAscii({ rayosX = false, alDispararRayosX }) {
  const { seccionActiva } = usePortfolio();
  const refMarco = useRef(null);
  const refLienzo = useRef(null);
  const refImagen = useRef(null);
  const refAscii = useRef(null);

  // 'esperando' -> 'escribiendo' -> 'sosteniendo' -> 'revelando' -> 'foto'
  // Ya en 'foto', el hover es el revelado del esqueleto (RevelarEsqueleto).
  const [fase, setFase] = useState('esperando');
  const [esperaCumplida, setEsperaCumplida] = useState(false);
  const [listo, setListo] = useState(false);
  const [reducido, setReducido] = useState(false);

  const refFase = useRef(fase);
  refFase.current = fase;

  useEffect(() => {
    setReducido(prefiereMovimientoReducido());
  }, []);

  // Convierte y pinta. Se llama al cargar la imagen, al cambiar el tema (del
  // sitio o del sistema operativo) y al redimensionar la ventana.
  const repintar = useCallback(() => {
    const lienzo = refLienzo.current;
    const marco = refMarco.current;
    const imagen = refImagen.current;
    if (!lienzo || !marco || !imagen) return false;

    const { colorTexto, colorFondo, invertida } = leerColoresDelTema();
    const columnas = esDisenoVertical()
      ? COLUMNAS_ASCII_MOVIL
      : COLUMNAS_ASCII;
    const ascii = convertirAAscii(imagen, { columnas, invertida });
    refAscii.current = ascii;

    const { width: ancho, height: alto } = marco.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    lienzo.width = ancho * dpr;
    lienzo.height = alto * dpr;
    const ctx = lienzo.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    pintarAscii(ctx, ascii, ancho, alto, colorTexto, colorFondo, invertida);

    // El clip-path depende de en qué fase está la intro, así que se lee de
    // `refFase` (espejo actualizado en cada render) en vez de meter `fase`
    // en las dependencias: eso re-suscribiría los efectos de tema y resize
    // en cada cambio de fase.
    //
    // - 'esperando': la intro todavía no arrancó. El canvas queda pintado
    //   entero desde que carga la imagen, pero la escritura no empieza hasta
    //   DEMORA_INICIO_MS. Sin recortarlo acá, el retrato completo asoma
    //   cuando se va el splash de Bienvenida y después desaparece de golpe
    //   al empezar a escribirse.
    // - 'escribiendo': el rAF de la escritura ya está animando el
    //   clip-path cuadro a cuadro. Si un cambio de tema o un resize dispara
    //   `repintar` acá, no hay que tocarlo: pisarlo con el recorte en 0
    //   reiniciaría la escritura a mitad de camino.
    // - Cualquier otra fase ('revelando', 'transicion', 'foto', 'ascii'): la
    //   intro ya terminó, así que el clip-path tiene que quedar en 'none'.
    //   Si se dejara el recorte en 0 (o lo que sea que tuviera antes) de
    //   forma permanente, el ASCII no se volvería a ver nunca más.
    if (refFase.current === 'esperando') {
      lienzo.style.clipPath = recorteDeEscritura(0, ascii.columnas, ascii.filas);
    } else if (refFase.current !== 'escribiendo') {
      lienzo.style.clipPath = 'none';
    }
    return true;
  }, []);

  // Los otros llamadores de `repintar` corren fuera de la ruta de carga, que
  // es la única con su propio try/catch. Como `repintar` limpia el bitmap
  // (`lienzo.width = …`) antes de pintar, una excepción a mitad de camino
  // dejaría el canvas vacío y sin rescate: un toggle de tema apagaría el
  // retrato para siempre. Se degrada a mostrar la foto, igual que la carga.
  const repintarSeguro = useCallback(() => {
    try {
      // `repintar` devuelve false tanto ante un fallo como cuando la imagen
      // todavía no cargó. Sólo el primer caso es motivo de degradar: si se
      // degradara también en el segundo, un toggle de tema o un resize
      // mientras carga la foto cancelaría la intro para siempre.
      if (!repintar() && refImagen.current) setFase('foto');
    } catch {
      setFase('foto');
    }
  }, [repintar]);

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
    imagen.src = RUTA_PARA_ASCII;
    // Ni `onload` ni `onerror` cubren una petición que se cuelga sin resolver
    // ni fallar. Sin este rescate la fase queda en 'esperando' para siempre y
    // el marco vacío: el canvas recortado a cero y la foto en opacity 0.
    const rescate = setTimeout(() => {
      if (cancelado) return;
      if (refFase.current === 'esperando') setFase('foto');
    }, TIEMPO_MAXIMO_DE_CARGA_MS);
    return () => {
      cancelado = true;
      clearTimeout(rescate);
    };
  }, [reducido, repintar]);

  // El canvas se pinta una sola vez, así que un cambio de tema lo dejaría con
  // los colores viejos: caracteres claros sobre fondo claro, o al revés. Y no
  // alcanza con repintar: `leerColoresDelTema` también da vuelta la rampa, así
  // que hay que rehacer la conversión entera, no sólo el pintado.
  useEffect(() => {
    if (reducido) return undefined;
    const observador = new MutationObserver(() => repintarSeguro());
    observador.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    // Sin `data-theme` en <html>, los tokens los resuelve una media query de
    // prefers-color-scheme: el tema puede cambiar desde el sistema operativo
    // sin que mute ningún atributo, así que el observador solo no alcanza.
    const consultaSistema = window.matchMedia('(prefers-color-scheme: light)');
    const alCambiarElSistema = () => repintarSeguro();
    consultaSistema.addEventListener('change', alCambiarElSistema);
    return () => {
      observador.disconnect();
      consultaSistema.removeEventListener('change', alCambiarElSistema);
    };
  }, [reducido, repintarSeguro]);

  // El marco mide en vh, así que al redimensionar cambia de tamaño y el
  // bitmap quedaría estirado. Con debounce: repintar convierte la imagen
  // entera y no vale la pena hacerlo en cada evento del arrastre.
  useEffect(() => {
    if (reducido) return undefined;
    let temporizador;
    function alRedimensionar() {
      clearTimeout(temporizador);
      temporizador = setTimeout(repintarSeguro, 200);
    }
    window.addEventListener('resize', alRedimensionar);
    return () => {
      window.removeEventListener('resize', alRedimensionar);
      clearTimeout(temporizador);
    };
  }, [reducido, repintarSeguro]);

  // El retrato se difumina con el scroll. Se escribe una variable CSS directo
  // en el nodo, sin estado de React: cambia en cada cuadro de scroll.
  useEffect(() => {
    const marco = refMarco.current;
    if (!marco) return undefined;
    let cuadro = 0;
    function actualizar() {
      cuadro = 0;
      const progreso = Math.min(
        1,
        Math.max(0, window.scrollY / (window.innerHeight * ALTURAS_PARA_DESVANECER))
      );
      marco.style.setProperty('--desvanecido', progreso.toFixed(3));
    }
    function alScrollear() {
      if (!cuadro) cuadro = requestAnimationFrame(actualizar);
    }
    actualizar();
    window.addEventListener('scroll', alScrollear, { passive: true });
    return () => {
      window.removeEventListener('scroll', alScrollear);
      cancelAnimationFrame(cuadro);
    };
  }, []);

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
        setFase('sosteniendo');
        return;
      }
      bucle = requestAnimationFrame(cuadro);
    }

    bucle = requestAnimationFrame(cuadro);
    return () => cancelAnimationFrame(bucle);
  }, [fase]);

  // El ASCII ya está completo: se deja un rato a la vista para que se lea
  // antes de que la foto lo reemplace.
  useEffect(() => {
    if (fase !== 'sosteniendo') return undefined;
    const temporizador = setTimeout(() => setFase('revelando'), PAUSA_ASCII_MS);
    return () => clearTimeout(temporizador);
  }, [fase]);

  // Cruce ASCII -> foto. Al terminar, el canvas recupera opacity 1 ya tapado
  // por la máscara (--radio arranca en 0), así que el cambio no se ve.
  useEffect(() => {
    if (fase !== 'revelando') return undefined;
    const temporizador = setTimeout(() => setFase('foto'), DURACION_REVELADO_FOTO_MS);
    return () => clearTimeout(temporizador);
  }, [fase]);

  const fotoRevelada = !['esperando', 'escribiendo', 'sosteniendo'].includes(fase);

  return (
    <div className={`${styles.marco} ${rayosX ? styles.apagado : ''}`} ref={refMarco}>
      <Image
        src={RUTA_RETRATO}
        alt=""
        width={ANCHO_RETRATO}
        height={ALTO_RETRATO}
        priority
        className={`${styles.foto} ${fotoRevelada ? styles.revelada : ''}`}
      />
      {/* El ASCII sólo vive en la intro: terminada, se oculta. */}
      <canvas
        ref={refLienzo}
        aria-hidden="true"
        className={`${styles.ascii} ${fase === 'revelando' ? styles.desvaneciendo : ''} ${fase === 'foto' ? styles.oculto : ''}`}
      />
      {/* Hover: debajo del cursor aparece el esqueleto (rayos X). */}
      {fase === 'foto' ? (
        <RevelarEsqueleto refMarco={refMarco} foto={refImagen.current ?? RUTA_PARA_ASCII} activo={fase === 'foto' && !rayosX && seccionActiva === 'inicio'} alDisparar={alDispararRayosX} />
      ) : null}
    </div>
  );
}
