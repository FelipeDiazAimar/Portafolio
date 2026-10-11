// Colores de las escenas que tienen variante clara (notebook de Origen, materias
// de 2023 y banco de 2025). La variante clara se activa con el tema claro del
// sitio: sobre un fondo claro, un modelo oscuro y apagado se pierde.
const OSCURA = {
  chasis: '#1d2230',
  tapa: '#232a3a',
  tecla: '#1c2433',
  teclaTexto: '#bcd2ff',
  tarjeta: '#0d1526',
  tarjetaBorde: '#5b8cff',
  texto: '#f0f5ff',
  tapete: '#0d2a22',
  metal: '#c9d1de',
};

const CLARA = {
  chasis: '#e6e9ef',
  tapa: '#f2f4f8',
  tecla: '#fafbfd',
  teclaTexto: '#39455c',
  tarjeta: '#f4f7fd',
  tarjetaBorde: '#3a6fe0',
  texto: '#16203a',
  tapete: '#9fd8bf',
  metal: '#aab3c2',
};

export function paletaEscena(claro) {
  return claro ? CLARA : OSCURA;
}

// Color fijo de la tira RGB en la posición `f` (0 a 1) a lo largo de ella: el
// espectro completo, con saturación y brillo altos. Cíclico.
export function colorArcoiris(f) {
  const h = (((f % 1) + 1) % 1) * 6;
  const x = 1 - Math.abs((h % 2) - 1);
  const [r, g, b] = [
    [1, x, 0],
    [x, 1, 0],
    [0, 1, x],
    [0, x, 1],
    [x, 0, 1],
    [1, 0, x],
  ][Math.floor(h) % 6];
  const hex = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

// Lectura del multímetro (tensión de una fuente de 5 V): oscila un poco, con
// tres decimales, como un instrumento real.
export function valorMultimetro(t) {
  const v = 5 + Math.sin(t * 1.7) * 0.012 + Math.sin(t * 4.3) * 0.006;
  return v.toFixed(3);
}
