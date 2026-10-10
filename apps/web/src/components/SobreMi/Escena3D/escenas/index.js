// Registro de escenas: id de hito → import dinámico. Un hito sin entrada usa el
// respaldo ASCII. Este archivo NO importa three (sólo import() dinámicos), así
// que se puede usar desde fuera del chunk diferido.
const ESCENAS = {
  0: () => import('./EscenaPrueba.jsx'),
};

export const idsConEscena = new Set(Object.keys(ESCENAS).map(Number));

export function cargadorEscena(id) {
  return ESCENAS[id];
}
