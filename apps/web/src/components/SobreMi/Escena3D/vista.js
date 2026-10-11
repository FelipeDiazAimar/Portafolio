// Encuadre de la cámara según el alto del canvas.
//
// El canvas de escritorio es alto (sobresale de la columna hasta el borde de
// arriba de la sección). Con la cámara a una distancia fija, un canvas más alto
// "agrandaría" todo lo que se ve, porque el campo de visión vertical es fijo. Para
// que los modelos midan lo mismo en pantalla, la cámara se aleja en proporción.
export const FOV = 38;
const TAN_MITAD_FOV = Math.tan((FOV * Math.PI) / 360);
export const DISTANCIA_MINIMA = 6;
// Escala de referencia: píxeles de pantalla por unidad de escena (la que tenían
// los modelos con un canvas de ~780 px y la cámara a 6 unidades).
export const PIXELES_POR_UNIDAD = 189;

// `distancia`: a dónde va la cámara; `mitadAlto`: cuánto mide, en unidades de
// escena, la mitad del alto visible en el plano z = 0 (donde está el modelo).
export function vistaParaAltura(alturaPx) {
  const distancia = Math.max(DISTANCIA_MINIMA, alturaPx / (PIXELES_POR_UNIDAD * 2 * TAN_MITAD_FOV));
  return { distancia, mitadAlto: distancia * TAN_MITAD_FOV };
}
