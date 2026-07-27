'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { usePortfolio } from '@/contexto/ProveedorPortfolio.jsx';
import { convertirAAscii, leerColoresDelTema, pintarAscii } from './conversionAscii.js';
import styles from './RetratoAscii.module.css';

const RUTA_RETRATO = '/Yo.png';
// Medidas reales del archivo. Tienen que coincidir con el `aspect-ratio` de
// `.marco`: la foto es `object-fit: contain` y el ASCII llena la caja entera,
// así que si el marco tuviera otra proporción las dos capas dejarían de
// registrar entre sí y el barrido mostraría foto donde el ASCII dibuja sujeto.
const ANCHO_RETRATO = 433;
const ALTO_RETRATO = 577;

const COLUMNAS_ASCII = 110;
// Mismo valor que en NombreAscii: es lo que hace que las dos intros arranquen
// juntas apenas se va el splash de Bienvenida.
const DEMORA_INICIO_MS = 3300;
const DURACION_ESCRITURA_MS = 3200;
// Tiene que coincidir con --duracion-revelado del CSS.
const DURACION_REVELADO_FOTO_MS = 700;
const DURACION_BARRIDO_MS = 700;
const BORDE_MASCARA_PX = 48;
// Ni `onload` ni `onerror` cubren una petición que se cuelga sin resolver ni
// fallar. Sin este rescate la fase queda en 'esperando' para siempre y el
// marco vacío: el canvas recortado a cero y la foto en opacity 0.
const TIEMPO_MAXIMO_DE_CARGA_MS = 8000;

function suavizar(t) {
  return 1 - (1 - t) ** 3;
}

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
  const { seccionActiva } = usePortfolio();
  const refMarco = useRef(null);
  const refLienzo = useRef(null);
  const refImagen = useRef(null);
  const refAscii = useRef(null);
  const refUltimoInterior = useRef({ x: 0, y: 0 });
  const refOrigen = useRef({ x: 0, y: 0 });
  const refProgreso = useRef(0);
  const refDestino = useRef('foto');
  const refPolaridad = useRef(false);
  const refRadioMaximo = useRef(0);

  // 'esperando' -> 'escribiendo' -> 'revelando' -> 'foto'
  // y de ahí en más: 'foto' <-> 'transicion' <-> 'ascii'
  const [fase, setFase] = useState('esperando');
  const [esperaCumplida, setEsperaCumplida] = useState(false);
  const [listo, setListo] = useState(false);
  const [reducido, setReducido] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const [interactivo, setInteractivo] = useState(false);
  const [listoParaHover, setListoParaHover] = useState(false);

  const refFase = useRef(fase);
  refFase.current = fase;

  useEffect(() => {
    setReducido(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    setInteractivo(window.matchMedia('(hover: hover) and (pointer: fine)').matches);
  }, []);

  // Convierte y pinta. Se llama al cargar la imagen, al cambiar el tema (del
  // sitio o del sistema operativo) y al redimensionar la ventana.
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

    // El clip-path depende de en qué fase está la intro, así que se lee de
    // `refFase` (espejo actualizado en cada render) en vez de meter `fase`
    // en las dependencias: eso re-suscribiría a los dos efectos de la Task 4
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
      if (!repintar()) setFase('foto');
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
    imagen.src = RUTA_RETRATO;
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

  // Marca que la intro terminó, para armar el hover una sola vez.
  useEffect(() => {
    if (fase === 'foto' && !listoParaHover) setListoParaHover(true);
  }, [fase, listoParaHover]);

  // La detección NO usa eventos del DOM: `.capa` tiene pointer-events:none, el
  // hero está en z-index:-1 y `.seccionHero` también anula punteros, así que
  // un onMouseEnter sobre el retrato nunca se dispararía. Se compara la
  // posición del cursor contra el rect del marco.
  useEffect(() => {
    if (!listoParaHover || !interactivo || reducido) return undefined;
    if (seccionActiva !== 'inicio') return undefined;

    function evaluar(adentro) {
      const deseado = adentro ? 'ascii' : 'foto';
      const actual = refFase.current;
      if (actual === deseado) return;

      if (actual === 'transicion') {
        // Ya hay un barrido corriendo: sólo se invierte el sentido.
        refDestino.current = deseado;
        return;
      }

      refOrigen.current = { ...refUltimoInterior.current };
      refPolaridad.current = deseado === 'foto';
      refProgreso.current = 0;
      refDestino.current = deseado;
      // El radio es una propiedad inline y conserva el valor terminal del
      // barrido anterior. La clase de polaridad cambia en el commit de React,
      // pero el bucle recién escribe el radio en su primer rAF: sin este
      // reseteo síncrono queda un frame con la polaridad nueva y el radio
      // viejo, que muestra u oculta el ASCII entero de golpe.
      refLienzo.current?.style.setProperty('--radio', '0px');
      refFase.current = 'transicion';
      setSaliendo(refPolaridad.current);
      setFase('transicion');
    }

    function alMoverse(evento) {
      const marco = refMarco.current;
      if (!marco) return;
      const rect = marco.getBoundingClientRect();
      const adentro =
        evento.clientX >= rect.left &&
        evento.clientX <= rect.right &&
        evento.clientY >= rect.top &&
        evento.clientY <= rect.bottom;

      if (adentro) {
        // Relativas al marco, que es lo que consume la máscara. Se guarda la
        // última posición INTERIOR: al salir, el centro del círculo tiene que
        // caer sobre la imagen, no fuera de ella.
        refUltimoInterior.current = {
          x: evento.clientX - rect.left,
          y: evento.clientY - rect.top,
        };
      }
      evaluar(adentro);
    }

    // Si el cursor abandona la ventana no llegan más mousemove y el retrato
    // se quedaría en ASCII para siempre.
    function alSalirDelDocumento() {
      evaluar(false);
    }

    window.addEventListener('mousemove', alMoverse, { passive: true });
    document.addEventListener('mouseleave', alSalirDelDocumento);
    return () => {
      window.removeEventListener('mousemove', alMoverse);
      document.removeEventListener('mouseleave', alSalirDelDocumento);
    };
  }, [listoParaHover, interactivo, reducido, seccionActiva]);

  useEffect(() => {
    if (fase !== 'transicion') return undefined;
    const lienzo = refLienzo.current;
    const marco = refMarco.current;
    if (!lienzo || !marco) return undefined;

    const { width: ancho, height: alto } = marco.getBoundingClientRect();
    const origen = refOrigen.current;
    // La esquina más lejana, más el borde: por debajo de eso quedaría una
    // esquina sin cubrir al final del barrido.
    refRadioMaximo.current =
      Math.max(
        Math.hypot(origen.x, origen.y),
        Math.hypot(ancho - origen.x, origen.y),
        Math.hypot(origen.x, alto - origen.y),
        Math.hypot(ancho - origen.x, alto - origen.y)
      ) + BORDE_MASCARA_PX;

    lienzo.style.setProperty('--origen-x', `${origen.x}px`);
    lienzo.style.setProperty('--origen-y', `${origen.y}px`);

    let anterior = performance.now();
    let bucle = 0;

    function cuadro(ahora) {
      const avance = (ahora - anterior) / DURACION_BARRIDO_MS;
      anterior = ahora;

      // Con polaridad normal el ASCII crece con el progreso; con la invertida
      // el progreso es cuánto se borró. El destino se lee cada cuadro porque
      // el mouse puede cambiarlo a mitad de camino.
      const objetivo = refPolaridad.current
        ? (refDestino.current === 'foto' ? 1 : 0)
        : (refDestino.current === 'ascii' ? 1 : 0);

      const paso = objetivo > refProgreso.current ? avance : -avance;
      refProgreso.current = Math.min(1, Math.max(0, refProgreso.current + paso));

      lienzo.style.setProperty(
        '--radio',
        `${suavizar(refProgreso.current) * refRadioMaximo.current}px`
      );

      if (refProgreso.current === objetivo) {
        // El espejo se adelanta al render: si no, un mousemove entre el fin
        // del bucle y el próximo render entraría en la rama de inversión y
        // escribiría un destino que ya nadie lee.
        refFase.current = refDestino.current;
        setFase(refDestino.current);
        return;
      }
      bucle = requestAnimationFrame(cuadro);
    }

    bucle = requestAnimationFrame(cuadro);
    return () => cancelAnimationFrame(bucle);
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
      {/* El `|| fase === 'foto'` NO es redundante: `listoParaHover` lo
          enciende un efecto un commit después de que la fase cambia, y en ese
          render intermedio el canvas ya recuperó opacity 1 al perder
          `desvaneciendo`. Sin la máscara en ese mismo cuadro, el ASCII entero
          destella sobre la foto. */}
      <canvas
        ref={refLienzo}
        aria-hidden="true"
        className={`${styles.ascii} ${fase === 'revelando' ? styles.desvaneciendo : ''} ${
          listoParaHover || fase === 'foto' ? styles.enmascarado : ''
        } ${saliendo ? styles.saliendo : ''}`}
      />
    </div>
  );
}
