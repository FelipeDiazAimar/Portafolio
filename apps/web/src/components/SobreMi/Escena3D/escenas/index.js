// Registro de escenas: id de hito → import dinámico. Un hito sin entrada usa el
// respaldo ASCII. Este archivo NO importa three (sólo import() dinámicos), así
// que se puede usar desde fuera del chunk diferido.
const ESCENAS = {
  0: () => import('./Escena0Notebook.jsx'),
  1: () => import('./Escena1Bandera.jsx'),
  3: () => import('./Escena3PC.jsx'),
};

// Escenas que NO giran: ni con el mouse ni solas. La cámara se queda de frente y
// los elementos están fijos en pantalla (por ejemplo, la bandera de 2022 colgada
// desde arriba).
const FIJAS = new Set([1]);

export function esEscenaFija(id) {
  return FIJAS.has(id);
}

export const idsConEscena = new Set(Object.keys(ESCENAS).map(Number));

export function cargadorEscena(id) {
  return ESCENAS[id];
}
