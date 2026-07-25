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
// Cuántas columnas de onda sobresalen a los costados del nombre — sin
// esto el campo terminaba justo en el ancho del texto y se notaba el
// corte vertical en los laterales.
const COLUMNAS_MARGEN_LATERAL = 7;
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
      const modulacion = alturaDeOnda(c, totalColumnas) / FILAS_LLUVIA;
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
        // En la fase 2 sólo queda el nombre: el barrido es vertical (desde
        // arriba y desde abajo hacia el centro), no lateral — la punta de
        // CADA trazo de margen se apaga primero, su propio centro al final.
        celdas.push(celda(caracter, magnitud, 0, false, t));
      }
      columnas.push(celdas);
      continue;
    }

    const alcance = alturaDeOnda(c, totalColumnas);

    // Techo del apagado lateral para ESTA columna (0 en el centro del
    // nombre, más oscuro hacia los costados). No se aplica igual en toda
    // la altura: ver `atenuacionHorizontalEnT`.
    const atenuacionHorizontal = atenuacionHorizontalGlobal(c);
    const distHorizontal = distanciaHorizontalGlobal(c);

    // El apagado lateral crece con la distancia vertical al nombre (t): a
    // la altura del propio nombre (t≈0) no hay apagado lateral — así el
    // degradado corre desde las esquinas arriba/abajo hacia el centro, no
    // desde los costados a la altura del nombre. En la punta de cada rayo
    // (t≈1) sí pega el apagado lateral completo.
    function atenuacionHorizontalEnT(t) {
      return 1 - (1 - atenuacionHorizontal) * Math.min(1, t) ** 1.4;
    }

    // t: 0 pegado al nombre, 1 en la punta de ESTA columna — el decaimiento
    // es relativo a su propia altura, así todas se apagan justo en su punta.
    function celdaDeLluvia(distancia) {
      const caracter = elegir(CARACTERES_LLUVIA);
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
      return celda(caracter, enOnda, 0, false, t);
    }

    for (let d = FILAS_LLUVIA; d >= 1; d--) celdas.push(celdaDeLluvia(d));

    for (let f = 0; f < filasNombre; f++) {
      // A la altura del nombre (t=0) no hay apagado lateral: por eso el
      // degradado se ve venir desde arriba/abajo hacia el centro, y no
      // también desde los costados a esta altura.
      const enOnda = 0.82 + Math.random() * 0.18;
      if (esGlifo(columnaTexto, f)) {
        // El nombre queda excluido del apagado: es lo único que se sigue
        // viendo al final de la fase 2. `esNombre` también lo excluye del
        // cambio periódico de caracteres, para que no titile.
        celdas.push(celda(elegir(CARACTERES_DENSOS), enOnda, 1, true, 0));
      } else {
        // Huecos entre las letras: a la altura del nombre, así que el
        // barrido vertical los deja para el final igual que a los glifos.
        celdas.push(celda(elegir(CARACTERES_LLUVIA), enOnda, 0, false, 0));
      }
    }

    for (let d = 1; d <= FILAS_LLUVIA; d++) celdas.push(celdaDeLluvia(d));

    columnas.push(celdas);
  }

  return {
    columnas,
    tamanoCelda: celdaAlto,
    separacion,
    izquierda: izquierda - margen * paso,
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

  // Sube sólo cuando se construye un campo NUEVO (primera vez o resize),
  // nunca en el titileo de caracteres — la cadena de fases se engancha acá
  // en vez de en `campo`, porque el titileo reemplaza `campo` por un objeto
  // nuevo en cada tick y eso reiniciaba los temporizadores de fase sin fin.
  const [cicloCampo, setCicloCampo] = useState(0);

  const construirCampo = useCallback(() => {
    if (!refContenedor.current || !refLimpio.current) return;
    const calco = calcarTextoLimpio(refLimpio.current, refContenedor.current);
    if (!calco) return;
    setCampo(generarCampo(calco));
    setCicloCampo((id) => id + 1);
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
