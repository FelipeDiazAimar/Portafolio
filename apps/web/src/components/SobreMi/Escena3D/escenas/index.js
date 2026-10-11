// Registro de escenas: id de hito → import dinámico. Un hito sin entrada usa el
// respaldo ASCII. Este archivo NO importa three (sólo import() dinámicos), así
// que se puede usar desde fuera del chunk diferido.
const ESCENAS = {
  0: () => import('./Escena0Notebook.jsx'),
  1: () => import('./Escena1Bandera.jsx'),
  2: () => import('./Escena2Materias.jsx'),
  3: () => import('./Escena3PC.jsx'),
  4: () => import('./Escena4Banco.jsx'),
};

// Escenas que NO giran: ni con el mouse ni solas. La cámara se queda de frente y
// los elementos están fijos en pantalla (por ejemplo, la bandera de 2022 colgada
// desde arriba).
const FIJAS = new Set([1]);

export function esEscenaFija(id) {
  return FIJAS.has(id);
}

// Escenas que se pueden girar sólo dentro de un rango a cada lado del frente
// (radianes): no tiene sentido verles la parte de atrás, sea una pared de
// tarjetas o una placa. En vez de dar vueltas, se mecen suavemente. Sin entrada =
// giro libre (la notebook).
const LIMITES_GIRO = { 2: 0.7, 3: 0.7, 4: 0.7 };

export function limiteDeGiro(id) {
  return LIMITES_GIRO[id] ?? null;
}

export const idsConEscena = new Set(Object.keys(ESCENAS).map(Number));

export function cargadorEscena(id) {
  return ESCENAS[id];
}
