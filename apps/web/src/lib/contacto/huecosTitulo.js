// Dónde están, en la ventana, los huecos (contraformas) de la "o" y de la "b" de "Hablemos.".
// El avioncito del email pasa por dentro de ellos en sus rizos (ver rutaAvion.js).
//
// Se mide sobre el texto real: el rectángulo de cada letra sale de un Range del DOM y la
// forma de la tinta (dónde empieza el trazo, cuánto mide una "x") de las métricas del mismo
// tipo de letra en un canvas.
export function medirHuecosTitulo(titulo) {
  const nodo = titulo?.firstChild;
  if (!nodo || nodo.nodeType !== Node.TEXT_NODE) return null;
  const texto = nodo.data;
  const indiceB = texto.indexOf('b');
  const indiceO = texto.lastIndexOf('o');
  if (indiceB < 0 || indiceO < 0) return null;

  const estilo = getComputedStyle(titulo);
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = `${estilo.fontStyle} ${estilo.fontWeight} ${estilo.fontSize} ${estilo.fontFamily}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = estilo.letterSpacing;
  const tamano = parseFloat(estilo.fontSize);
  const metricasX = ctx.measureText('x');
  // La caja de texto de un Range empieza a una altura de ascenso de la línea base.
  const ascenso = metricasX.fontBoundingBoxAscent ?? tamano * 0.97;
  const alturaX = metricasX.actualBoundingBoxAscent ?? tamano * 0.55;
  const rango = document.createRange();

  // fraccionX: dónde cae el centro del hueco dentro de la tinta de la letra (0 = borde izquierdo).
  function medir(indice, fraccionX) {
    rango.setStart(nodo, indice);
    rango.setEnd(nodo, indice + 1);
    const caja = rango.getBoundingClientRect();
    const tinta = ctx.measureText(texto[indice]);
    const izquierda = caja.left - tinta.actualBoundingBoxLeft;
    const ancho = tinta.actualBoundingBoxLeft + tinta.actualBoundingBoxRight;
    return {
      x: izquierda + ancho * fraccionX,
      y: caja.top + ascenso - alturaX / 2,
      radio: tamano * 0.115,
    };
  }

  // La "o" es simétrica; en la "b" el hueco queda a la derecha del palo.
  return [medir(indiceO, 0.5), medir(indiceB, 0.6)];
}
