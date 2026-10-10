'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { usePortfolio } from '@/contexto/ProveedorPortfolio.jsx';
import { calcarTextoLimpio, medirRatioMonoespaciado } from '@/lib/calcoTexto.js';
import { esTactil, prefiereMovimientoReducido, tieneHoverFino } from '@/lib/entrada.js';
import useToqueSobre from '@/hooks/useToqueSobre.js';
import useDestelloAleatorio from '@/hooks/useDestelloAleatorio.js';
import destello from '@/styles/destello.module.css';
import SubtituloHero from '@/components/SubtituloHero/SubtituloHero.jsx';
import TextoTipeado from '@/components/TextoTipeado/TextoTipeado.jsx';
import styles from './NombreAscii.module.css';

// matter-js pesa ~83 KB y el efecto está detrás de un gate de hover fino:
// con import estático viajaba en el chunk del layout raíz, o sea a TODAS las
// rutas y a todo visitante móvil, para nunca poder ejecutarse. Se carga
// recién cuando hace falta.
const ColapsoFisico = dynamic(
  () => import('@/components/ColapsoFisico/ColapsoFisico.jsx'),
  { ssr: false }
);

const DEMORA_INICIO_MS = 3300;
// Aire entre la última línea del nombre y el subtítulo.
const SEPARACION_SUBTITULO_PX = 6;
// Texto de presentación bajo el subtítulo. Lo que va entre ** ** sale en
// negrita, y después de cada coma o punto va un salto de renglón (\n).
const PRESENTACION =
  'Construyo **aplicaciones web de punta a punta**,\nde la interfaz a la base de datos.\nMe gusta el **código claro** y los **detalles cuidados**.';

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
const FILAS_LLUVIA_BASE = 18;
// En teléfono el nombre queda arriba, pegado al logo: con 18 filas la onda se
// extiende ~90 px hacia arriba y lo pisa. Menos filas, onda más baja.
const FILAS_LLUVIA_TELEFONO = 6;
// Separación horizontal entre columnas, en fracción del alto de celda.
const SEPARACION_COLUMNAS = 0.6;
// Cuántas columnas de onda sobresalen a los costados del nombre — sin
// esto el campo terminaba justo en el ancho del texto y se notaba el
// corte vertical en los laterales.
const COLUMNAS_MARGEN_LATERAL = 7;
// Cuánto más oscurecen las esquinas (lejos del nombre en vertical Y en
// horizontal) por encima del apagado lateral base, que ya se aplica en
// toda la altura.
const ATENUACION_ESQUINA = 0.55;
// Cada cuánto se re-sortean caracteres en las fases 1 y 2, y qué fracción
// de las celdas (que no sean parte del nombre) cambia por tick.
const INTERVALO_CAMBIO_CARACTERES_MS = 110;
const PROBABILIDAD_CAMBIO_CARACTER = 0.06;

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
function alturaDeOnda(columna, totalColumnas, FILAS_LLUVIA) {
  const x = columna / Math.max(1, totalColumnas - 1);
  const perfil =
    0.5 +
    0.28 * Math.sin(2 * Math.PI * 1.5 * x) +
    0.18 * Math.sin(2 * Math.PI * 4.3 * x + 1.2) +
    0.12 * Math.sin(2 * Math.PI * 9.1 * x + 3.4) +
    (Math.random() - 0.5) * 0.14;
  return Math.max(1, Math.round(Math.min(1, Math.max(0.08, perfil)) * FILAS_LLUVIA));
}

// Arma las columnas verticales. Cada celda lleva su opacidad para la fase
// de onda y para la de revelado; el carácter NUNCA cambia, así los pasajes
// entre fases son fundidos y no letras que aparecen y desaparecen de golpe.
function generarCampo(calco) {
  const FILAS_LLUVIA = window.matchMedia('(max-width: 640px)').matches
    ? FILAS_LLUVIA_TELEFONO
    : FILAS_LLUVIA_BASE;
  const { pixeles, ancho, alto, tamanoFuente, izquierda, arriba } = calco;
  const { data } = pixeles;

  const celdaAlto = Math.max(5, Math.round(tamanoFuente / 9));
  const separacion = celdaAlto * SEPARACION_COLUMNAS;
  const anchoCaracter = celdaAlto * medirRatioMonoespaciado();
  const paso = anchoCaracter + separacion;

  const columnasTexto = Math.floor(ancho / paso);
  const filasNombre = Math.floor(alto / celdaAlto);
  if (columnasTexto <= 0 || filasNombre <= 0) return null;

  // El campo es más ancho que el nombre: `margen` columnas de pura onda
  // sobresalen de cada lado. `c` sigue indexando 0..totalColumnas-1 (para
  // que la envolvente de la onda sea continua de punta a punta); el índice
  // dentro del texto se corrige restando el margen.
  const margen = COLUMNAS_MARGEN_LATERAL;
  const totalColumnas = columnasTexto + margen * 2;

  function esGlifo(columnaTexto, fila) {
    const x = Math.min(ancho - 1, Math.floor(columnaTexto * paso + anchoCaracter / 2));
    const y = Math.min(alto - 1, Math.floor(fila * celdaAlto + celdaAlto / 2));
    return data[(y * ancho + x) * 4 + 3] > 128;
  }

  // Distancia horizontal 0..1 en UNA sola escala continua para todo el
  // campo (texto + margen), medida desde el centro del nombre hasta la
  // punta del margen. Antes el texto medía su propio degradado relativo a
  // su ancho (0 en el centro, 1 en el borde del texto) y el margen el suyo
  // por separado (0 en ese mismo borde, 1 en la punta) — al evaluarlos
  // pegados uno a otro el brillo pegaba un salto justo en la costura
  // (texto terminaba tenue, margen arrancaba a pleno) y por lo mismo la
  // demora de revelado no eran comparables entre columnas de texto y de
  // margen, así que el barrido lateral no cerraba al mismo tiempo que el
  // vertical. Con una sola escala por índice de columna `c` (no por
  // columnaTexto) ambos problemas se resuelven juntos.
  const centroGlobal = (totalColumnas - 1) / 2;
  function distanciaHorizontalGlobal(c) {
    return Math.min(1, Math.abs(c - centroGlobal) / centroGlobal);
  }
  function atenuacionHorizontalGlobal(c) {
    return 0.15 + 0.85 * (1 - distanciaHorizontalGlobal(c)) ** 1.3;
  }

  // distanciaRevelado: 0 pegado al nombre, 1 en la punta más lejana. La
  // transición fase 1 -> fase 2 la usa como demora INVERTIDA: lo lejano
  // (distancia 1) arranca casi enseguida (demora ~0), lo cercano al nombre
  // (distancia 0) recién al final (demora ~máxima) — el barrido es
  // literalmente de afuera hacia adentro, hasta que sólo queda el nombre.
  function celda(caracter, opacidadOnda, opacidadRevelado, esNombre = false, distanciaRevelado = 0) {
    return {
      caracter,
      opacidadOnda,
      opacidadRevelado,
      esNombre,
      demoraOnda: Math.random() * DISPERSION_ONDA_MS,
      demoraRevelado: (1 - distanciaRevelado) * DISPERSION_REVELADO_MS + Math.random() * 80,
      demoraDesvanecido: Math.random() * DISPERSION_DESVANECIDO_MS,
    };
  }

  const filasTotales = FILAS_LLUVIA * 2 + filasNombre;
  const centroVertical = (filasTotales - 1) / 2;
  // Distancia vertical 0..1 en una ESCALA ABSOLUTA (misma fila = misma
  // distancia en cualquier columna). Antes el barrido de fase 2 usaba el
  // `t` de cada rayo, relativo a su propio alcance — dos columnas con
  // alcances distintos (uno más corto por la ondulación, o el margen con
  // el suyo) llegaban a t=1 a alturas reales distintas, así que el cierre
  // no se veía parejo fila por fila y terminaba leyéndose como si viniera
  // también de los costados. Con una sola escala por fila, arriba y abajo
  // se cierran juntos sin importar la columna.
  function distanciaVerticalGlobal(distanciaAbsolutaDesdeCentro) {
    return Math.min(1, distanciaAbsolutaDesdeCentro / centroVertical);
  }
  // Media altura visual de una columna de texto (nombre + lluvia tapeada).
  // El margen arranca su alcance en este valor y no en FILAS_LLUVIA: si no,
  // la altura caía en seco justo en el borde texto/margen — un bloque alto
  // pegado a columnas mucho más bajas. Así decae gradual, como el resto de
  // la onda.
  const semiAlturaTexto = filasNombre / 2 + FILAS_LLUVIA;

  const columnas = [];
  for (let c = 0; c < totalColumnas; c++) {
    const columnaTexto = c - margen;
    const esMargen = columnaTexto < 0 || columnaTexto >= columnasTexto;
    const celdas = [];

    // Las columnas de margen no tienen nombre que revelar: son un único
    // trazo que nace en el centro vertical del campo y se va cerrando
    // hacia arriba y abajo — el mismo perfil en las dos fases (apenas más
    // tenue en la de revelado), para que se lea como el final natural de
    // la onda y no como un bloque rectangular pegado al costado.
    if (esMargen) {
      const atenuacion = atenuacionHorizontalGlobal(c);
      // tBorde: 0 pegado al borde del texto, 1 en la punta del margen — el
      // techo de altura baja gradualmente desde la escala del nombre hasta
      // la escala normal de la lluvia. Es un concepto distinto de la
      // distancia horizontal global (esa mide brillo/demora; esta mide
      // cuántas filas alcanza el trazo), así que se queda con su propia
      // escala relativa al margen.
      const fuera = columnaTexto < 0 ? -columnaTexto : columnaTexto - columnasTexto + 1;
      const tBorde = Math.min(1, fuera / margen);
      const techo = FILAS_LLUVIA + (semiAlturaTexto - FILAS_LLUVIA) * (1 - tBorde) ** 1.4;
      const modulacion = alturaDeOnda(c, totalColumnas, FILAS_LLUVIA) / FILAS_LLUVIA;
      const alcance = Math.max(1, Math.round(techo * modulacion));

      for (let i = 0; i < filasTotales; i++) {
        const distancia = Math.abs(i - centroVertical);
        const caracter = elegir(CARACTERES_LLUVIA);
        if (distancia > alcance) {
          celdas.push(celda(caracter, 0, 0, false, 1));
          continue;
        }
        const t = distancia / (alcance + 1);
        const variacion = 0.82 + Math.random() * 0.18;
        const magnitud = (1 - t) ** 1.15 * variacion * atenuacion;
        // `distancia` ya es la distancia absoluta a centroVertical (misma
        // escala que usan las columnas de texto), así el barrido vertical
        // cierra a la misma altura en todas las columnas, sin importar
        // cuánto alcance tenga cada trazo de margen.
        celdas.push(celda(caracter, magnitud, 0, false, distanciaVerticalGlobal(distancia)));
      }
      columnas.push(celdas);
      continue;
    }

    const alcance = alturaDeOnda(c, totalColumnas, FILAS_LLUVIA);

    // Apagado lateral base para ESTA columna (1 en el centro del nombre,
    // más oscuro hacia los costados) — se aplica SIEMPRE, en toda la
    // altura, incluida la banda del nombre: el degradado va del centro
    // hacia los laterales izquierdo y derecho también, no sólo de arriba y
    // abajo hacia el centro.
    const atenuacionHorizontal = atenuacionHorizontalGlobal(c);

    // Encima de ese apagado lateral base, uno extra que crece con la
    // distancia vertical al nombre (t): las esquinas (lejos en las dos
    // direcciones) quedan más oscuras que el resto del lateral.
    function atenuacionHorizontalEnT(t) {
      const extra = 1 - (1 - ATENUACION_ESQUINA) * Math.min(1, t) ** 1.4;
      return atenuacionHorizontal * extra;
    }

    // t: 0 pegado al nombre, 1 en la punta de ESTA columna — el decaimiento
    // es relativo a su propia altura, así todas se apagan justo en su punta.
    // `distancia` en cambio es una distancia EN FILAS al borde del nombre;
    // sumándole medio alto de la banda del nombre se vuelve distancia
    // absoluta al centro vertical del campo, la misma escala que usa el
    // margen — así el barrido de fase 2 cierra parejo fila por fila, sin
    // depender de cuánto alcance tenga esta columna en particular.
    function celdaDeLluvia(distancia) {
      const caracter = elegir(CARACTERES_LLUVIA);
      const distanciaAbsoluta = (filasNombre - 1) / 2 + distancia;
      // Fuera de la envolvente la celda no existe en ninguna de las fases.
      if (distancia > alcance) return celda(caracter, 0, 0, false, 1);

      const t = distancia / (alcance + 1);
      const variacion = 0.82 + Math.random() * 0.18;

      // Fase 1: sólido en el centro, se desvanece hacia arriba y abajo, y
      // el apagado lateral se suma recién a medida que se aleja del nombre.
      const enOnda = (1 - t) ** 1.15 * variacion * atenuacionHorizontalEnT(t);
      // Fase 2: sólo queda el nombre — el resto del campo termina en 0. El
      // barrido es vertical (desde arriba y desde abajo hacia el centro),
      // no lateral: lo que está más lejos EN ALTURA se apaga primero.
      return celda(caracter, enOnda, 0, false, distanciaVerticalGlobal(distanciaAbsoluta));
    }

    for (let d = FILAS_LLUVIA; d >= 1; d--) celdas.push(celdaDeLluvia(d));

    for (let f = 0; f < filasNombre; f++) {
      // El apagado lateral base se aplica también a la altura del nombre:
      // el degradado corre desde el centro hacia los laterales acá
      // también, no sólo de arriba/abajo hacia el centro.
      const enOnda = (0.82 + Math.random() * 0.18) * atenuacionHorizontal;
      if (esGlifo(columnaTexto, f)) {
        // El nombre queda excluido del apagado: es lo único que se sigue
        // viendo al final de la fase 2. `esNombre` también lo excluye del
        // cambio periódico de caracteres, para que no titile.
        celdas.push(celda(elegir(CARACTERES_DENSOS), enOnda, 1, true, 0));
      } else {
        // Huecos entre las letras: su distancia al centro depende de en
        // qué fila de la banda del nombre caen (arriba/abajo dentro del
        // propio nombre), con la misma escala absoluta que el resto.
        const distanciaAbsoluta = Math.abs(f - (filasNombre - 1) / 2);
        celdas.push(
          celda(elegir(CARACTERES_LLUVIA), enOnda, 0, false, distanciaVerticalGlobal(distanciaAbsoluta))
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
    // Distancia entre columnas (ancho de carácter + separación). La usa
    // ColapsoFisico para ubicar cada celda en píxeles sin medir el DOM.
    paso,
    izquierda: izquierda - margen * paso,
    arriba: arriba - FILAS_LLUVIA * celdaAlto,
    // Origen y métricas del texto limpio SIN los corrimientos de arriba: el
    // colapso repinta el nombre sobre su canvas y necesita la caja real.
    textoIzquierda: izquierda,
    textoArriba: arriba,
    lineasLimpias: calco.lineas,
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

// Caja de cada letra en coordenadas de PÁGINA, para poder ponerle encima una
// zona clickeable. Misma conversión que usa ColapsoFisico para sus celdas.
function cajasDeLetras(campo, contenedor) {
  const rect = contenedor.getBoundingClientRect();
  const origenX = rect.left + window.scrollX;
  const origenY = rect.top + window.scrollY;
  const cajas = [];
  campo.lineasLimpias.forEach((linea) => {
    linea.letras.forEach((letra) => {
      cajas.push({
        caracter: letra.caracter,
        izquierda: origenX + campo.textoIzquierda + letra.x,
        arriba: origenY + campo.textoArriba + linea.bordeArriba,
        ancho: letra.ancho,
        alto: linea.bordeAbajo - linea.bordeArriba,
      });
    });
  });
  return cajas;
}

export default function NombreAscii() {
  const { seccionActiva } = usePortfolio();
  const refContenedor = useRef(null);
  const refLimpio = useRef(null);

  const [empezar, setEmpezar] = useState(false);
  // 'oculto' -> 'onda' -> 'revelado' -> 'desvanecido'
  const [fase, setFase] = useState('oculto');
  const [campo, setCampo] = useState(null);
  const [cajasLetras, setCajasLetras] = useState([]);
  // Índices de las letras que ya se convirtieron a ASCII durante un colapso:
  // esas dejan de ser clickeables hasta que el nombre se reconstruye.
  const [letrasRotas, setLetrasRotas] = useState(() => new Set());
  const [montado, setMontado] = useState(false);
  const [colapso, setColapso] = useState(null);
  // Pantalla táctil: no hay hover, así que el nombre se rompe con un toque.
  const [tactil, setTactil] = useState(false);
  // Dónde va el subtítulo, relativo al contenedor. Null hasta medir el nombre.
  const [posSubtitulo, setPosSubtitulo] = useState(null);
  // Tras un colapso hay que salir del área y volver a entrar para
  // re-disparar: si no, quedarse quieto encima lo relanzaría en loop.
  const refEsperandoSalida = useRef(false);
  // Se enciende con el primer colapso y ya no se apaga: a partir de ahí el
  // texto limpio entra y sale rápido, en las dos direcciones.
  const refYaColapso = useRef(false);

  // Espejo de `fase` para leerla desde listeners sin re-suscribirlos.
  const refFase = useRef(fase);
  refFase.current = fase;
  const refColapsoActivo = useRef(colapso);
  refColapsoActivo.current = colapso;

  useEffect(() => {
    setTactil(esTactil());
    setMontado(true);
    const temporizador = setTimeout(() => setEmpezar(true), DEMORA_INICIO_MS);
    return () => clearTimeout(temporizador);
  }, []);

  // Sube sólo cuando se construye un campo NUEVO (primera vez o resize),
  // nunca en el titileo de caracteres — la cadena de fases se engancha acá
  // en vez de en `campo`, porque el titileo reemplaza `campo` por un objeto
  // nuevo en cada tick y eso reiniciaba los temporizadores de fase sin fin.
  const [cicloCampo, setCicloCampo] = useState(0);

  const construirCampo = useCallback(() => {
    if (!refContenedor.current || !refLimpio.current) return;
    const calco = calcarTextoLimpio(refLimpio.current, refContenedor.current);
    if (!calco) return;
    const nuevoCampo = generarCampo(calco);
    setCampo(nuevoCampo);
    setCajasLetras(nuevoCampo ? cajasDeLetras(nuevoCampo, refContenedor.current) : []);
    setCicloCampo((id) => id + 1);
  }, []);

  const medirSubtitulo = useCallback(() => {
    const contenedor = refContenedor.current;
    const limpio = refLimpio.current;
    if (!contenedor || !limpio || !limpio.firstElementChild || !limpio.lastElementChild) return;
    const rectContenedor = contenedor.getBoundingClientRect();
    const primera = limpio.firstElementChild.getBoundingClientRect();
    const ultima = limpio.lastElementChild.getBoundingClientRect();
    setPosSubtitulo({
      left: primera.left - rectContenedor.left,
      top: ultima.bottom - rectContenedor.top + SEPARACION_SUBTITULO_PX,
    });
  }, []);

  // Se mide al montar, cuando las fuentes terminan de cargar y en cada cambio
  // de tamaño de pantalla.
  useEffect(() => {
    medirSubtitulo();
    let cancelado = false;
    document.fonts.ready.then(() => {
      if (!cancelado) medirSubtitulo();
    });
    let cuadro = 0;
    function alRedimensionar() {
      cancelAnimationFrame(cuadro);
      cuadro = requestAnimationFrame(medirSubtitulo);
    }
    window.addEventListener('resize', alRedimensionar);
    return () => {
      cancelado = true;
      cancelAnimationFrame(cuadro);
      window.removeEventListener('resize', alRedimensionar);
    };
  }, [medirSubtitulo, campo]);

  // Igual que `construirCampo` pero SIN reiniciar la cadena de fases. Sirve para
  // cuando el tamaño de la pantalla cambia después de la intro (girar el
  // teléfono, el modo responsive de DevTools): el campo, las hitboxes y el
  // colapso se calcularon con medidas viejas. En 'desvanecido' todas las
  // celdas están en opacidad 0, así que reemplazarlo no se ve.
  const reconstruirCampoSilencioso = useCallback(() => {
    if (!refContenedor.current || !refLimpio.current) return;
    const calco = calcarTextoLimpio(refLimpio.current, refContenedor.current);
    if (!calco) return;
    const nuevoCampo = generarCampo(calco);
    setCampo(nuevoCampo);
    setCajasLetras(nuevoCampo ? cajasDeLetras(nuevoCampo, refContenedor.current) : []);
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
      clearTimeout(temporizador);
      if (refFase.current === 'oculto' || refFase.current === 'onda') {
        temporizador = setTimeout(construirCampo, 150);
        return;
      }
      // Ya asentado: sólo se recalcula si no hay un colapso corriendo, que
      // usa el campo actual y se desarmaría.
      if (refFase.current === 'desvanecido' && !refColapsoActivo.current) {
        temporizador = setTimeout(reconstruirCampoSilencioso, 200);
      }
    }
    window.addEventListener('resize', alRedimensionar);
    return () => {
      window.removeEventListener('resize', alRedimensionar);
      clearTimeout(temporizador);
    };
  }, [construirCampo, reconstruirCampoSilencioso]);

  // Encadena las fases. El primer salto va en un frame aparte para que el
  // navegador tenga un estado inicial (opacidad 0) desde donde transicionar.
  useEffect(() => {
    if (cicloCampo === 0) return;

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
  }, [cicloCampo]);

  // Fase 1: los caracteres de ruido se van resorteando con el tiempo (los
  // del nombre no, para que se lea estable). Se corta al entrar en fase 2:
  // ahí el ruido ya está desvaneciéndose hacia 0, seguir cambiando el
  // carácter de algo que se apaga sólo se vería como un parpadeo suelto.
  // Actualiza por función, sin `campo` en las dependencias, así no reinicia
  // el intervalo en cada tick; y sólo reemplaza el array de la columna que
  // tuvo cambios, para no forzar un re-render de las que no.
  useEffect(() => {
    if (fase !== 'onda') return;

    const intervalo = setInterval(() => {
      setCampo((previo) => {
        if (!previo) return previo;
        let huboCambios = false;
        const columnas = previo.columnas.map((celdas) => {
          let columnaCambio = false;
          const nuevasCeldas = celdas.map((celda) => {
            if (celda.esNombre || Math.random() >= PROBABILIDAD_CAMBIO_CARACTER) return celda;
            columnaCambio = true;
            return { ...celda, caracter: elegir(CARACTERES_LLUVIA) };
          });
          if (!columnaCambio) return celdas;
          huboCambios = true;
          return nuevasCeldas;
        });
        return huboCambios ? { ...previo, columnas } : previo;
      });
    }, INTERVALO_CAMBIO_CARACTERES_MS);

    return () => clearInterval(intervalo);
  }, [fase]);

  // La detección NO usa eventos del DOM del nombre: .capa tiene
  // pointer-events:none, el hero está en z-index:-1 y .seccionHero también
  // anula punteros — es la cascada que ya rompió el botón de prueba durante
  // la fase 1. Se compara la posición del cursor contra el rect medido.
  useEffect(() => {
    if (fase !== 'desvanecido' || colapso || !campo) return undefined;
    if (seccionActiva !== 'inicio') return undefined;
    if (!tieneHoverFino()) return undefined;
    if (prefiereMovimientoReducido()) return undefined;

    function alMoverse(evento) {
      const nodo = refLimpio.current;
      if (!nodo) return;
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
      refYaColapso.current = true;
      setColapso({
        x: evento.clientX + window.scrollX,
        y: evento.clientY + window.scrollY,
      });
    }

    window.addEventListener('mousemove', alMoverse, { passive: true });
    return () => window.removeEventListener('mousemove', alMoverse);
  }, [fase, colapso, campo, seccionActiva]);

  // En táctil, un toque sobre el nombre lo hace estallar. Ver useToqueSobre:
  // no toca el scroll.
  useToqueSobre(
    refLimpio,
    tactil &&
      fase === 'desvanecido' &&
      !colapso &&
      !!campo &&
      seccionActiva === 'inicio' &&
      !prefiereMovimientoReducido(),
    (posicion) => {
      refYaColapso.current = true;
      navigator.vibrate?.(15);
      setColapso({ ...posicion, tactil: true });
    }
  );

  const subtituloVisible = fase === 'desvanecido' && letrasRotas.size === 0;

  // Destello ocasional del nombre: cruza el degradado a gris, cada vez distinto.
  useDestelloAleatorio({
    nodos: () => [refLimpio.current],
    activo: subtituloVisible,
    clase: destello.texto,
    minMs: 6000,
    maxMs: 13000,
  });
  // En táctil las hitboxes de letra no existen: tocar el nombre lo rompe en
  // vez de llevar a contacto.
  const zonaClickeableVisible = fase === 'desvanecido' && seccionActiva === 'inicio' && !tactil;

  return (
    <div className={styles.contenedor} ref={refContenedor}>
      {/* Único destino de teclado y lectores de pantalla. Las hitboxes de
          abajo son sólo blancos de mouse, para no dejar 17 tabulaciones. */}
      <a href="#contacto" className={styles.soloLectura}>
        Felipe Diaz Aimar
      </a>

      <div
        ref={refLimpio}
        className={`${styles.textoLimpio} ${
          fase === 'desvanecido' && !colapso ? styles.visible : ''
        } ${colapso || refYaColapso.current ? styles.rapida : ''}`}
        aria-hidden="true"
      >
        <span>Felipe</span>
        <span>Diaz Aimar</span>
      </div>

      {/* Bajo la última línea del nombre, alineado con su borde izquierdo. Se mide
          del DOM (no de las métricas del calco): el calco puede estar viejo si
          la pantalla cambió de tamaño, y el subtítulo quedaría flotando lejos. */}
      {posSubtitulo && (
        <div
          className={styles.subtitulo}
          style={{ left: `${posSubtitulo.left}px`, top: `${posSubtitulo.top}px` }}
        >
          {/* Se aparta sólo si el nombre realmente se rompió. Que el mouse
              pase por encima y active el colapso no alcanza: puede entrar al
              rectángulo del nombre sin llegar a tocar ninguna letra. */}
          <SubtituloHero texto="Desarrollador Full Stack" visible={subtituloVisible} />
          <TextoTipeado texto={PRESENTACION} visible={subtituloVisible} demoraMs={2200} />
        </div>
      )}

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

      {colapso && campo && (
        <ColapsoFisico
          campo={campo}
          modo="resortes"
          modoEntrada={colapso.tactil ? 'tactil' : 'raton'}
          refContenedor={refContenedor}
          posicionInicialRaton={colapso}
          visible={seccionActiva === 'inicio'}
          alConvertirLetra={(indice) =>
            setLetrasRotas((previo) => {
              if (previo.has(indice)) return previo;
              const siguiente = new Set(previo);
              siguiente.add(indice);
              return siguiente;
            })
          }
          alTerminar={() => {
            refEsperandoSalida.current = true;
            setLetrasRotas(new Set());
            setColapso(null);
          }}
        />
      )}

      {/* Una hitbox por letra, portaleada como el canvas para escapar del
          pointer-events:none del hero. Las letras que ya se convirtieron a
          ASCII se sacan: no hay glifo ahí, así que no hay dónde hacer clic. */}
      {montado &&
        zonaClickeableVisible &&
        cajasLetras.length > 0 &&
        createPortal(
          <div className={styles.zonaEnlace} aria-hidden="true">
            {cajasLetras.map((caja, indice) =>
              letrasRotas.has(indice) || caja.caracter === ' ' ? null : (
                <a
                  key={indice}
                  href="#contacto"
                  tabIndex={-1}
                  className={styles.hitboxLetra}
                  style={{
                    left: `${caja.izquierda}px`,
                    top: `${caja.arriba}px`,
                    width: `${caja.ancho}px`,
                    height: `${caja.alto}px`,
                  }}
                />
              )
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
