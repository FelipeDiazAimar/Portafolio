// Ancho de un carácter monoespaciado relativo a su alto (con line-height 1).
// Lo necesitamos para que la celda de sampleo tenga exactamente la misma
// proporción que el carácter renderizado — si no, el ASCII sale estirado.
export function medirRatioMonoespaciado() {
  const ctx = document.createElement('canvas').getContext('2d');
  const referencia = 100;
  ctx.font = `${referencia}px monospace`;
  return ctx.measureText('0').width / referencia;
}

// Calca el texto limpio TAL COMO EL NAVEGADOR LO DIBUJA: lee la posición y
// la tipografía real de cada línea del DOM y las repinta en un canvas del
// mismo tamaño. Así la grilla resultante se superpone pixel a pixel con el
// texto final, en vez de ser un dibujo aparte que hay que adivinar dónde va.
export function calcarTextoLimpio(elementoLimpio, contenedor) {
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

  // Se guardan las mismas métricas con las que se calca, porque el colapso
  // necesita repintar el texto limpio sobre SU canvas: mientras el efecto
  // corre, el nombre se dibuja ahí (no en el DOM) para poder agujerearlo
  // celda por celda a medida que el mouse lo va rompiendo.
  const lineasCalcadas = lineas.map((linea, indice) => {
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
    const x = rect.left - izquierda;
    ctx.fillText(linea.textContent, x, lineaBase);

    // Caja de cada letra por separado: el colapso convierte a ASCII la LETRA
    // entera que toca el mouse, así que necesita saber dónde empieza y
    // termina cada una. Se mide por prefijos para que el letter-spacing y el
    // kerning queden incluidos, igual que al pintar la línea completa.
    const texto = linea.textContent;
    const letras = [];
    for (let k = 0; k < texto.length; k += 1) {
      const hastaAntes = ctx.measureText(texto.slice(0, k)).width;
      const hastaDespues = ctx.measureText(texto.slice(0, k + 1)).width;
      letras.push({
        caracter: texto[k],
        x: x + hastaAntes,
        ancho: hastaDespues - hastaAntes,
      });
    }

    return {
      texto,
      fuente: ctx.font,
      espaciado: estilo.letterSpacing,
      x,
      lineaBase,
      bordeArriba: rect.top - arriba,
      bordeAbajo: rect.bottom - arriba,
      letras,
    };
  });

  const tamanoFuente = parseFloat(getComputedStyle(lineas[0]).fontSize);

  return {
    pixeles: ctx.getImageData(0, 0, ancho, alto),
    ancho,
    alto,
    tamanoFuente,
    lineas: lineasCalcadas,
    izquierda: izquierda - rectContenedor.left,
    arriba: arriba - rectContenedor.top,
  };
}
