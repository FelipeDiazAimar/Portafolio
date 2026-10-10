// Qué tipo de puntero tiene el dispositivo. Se consulta cuando hace falta (no
// al importar) porque `window` no existe en el servidor.

// Mouse o trackpad: hay un cursor que pasa por encima de las cosas sin tocar.
export function tieneHoverFino() {
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

// Pantalla táctil sin cursor: el dedo sólo "existe" mientras toca.
export function esTactil() {
  return window.matchMedia('(pointer: coarse)').matches;
}

export function prefiereMovimientoReducido() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
