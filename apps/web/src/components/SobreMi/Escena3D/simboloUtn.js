// Geometría del símbolo de la UTN, medida sobre la imagen original (920×1080 px)
// y pasada a unidades donde el alto del símbolo vale 1 y el centro es (0, 0),
// con el eje y hacia arriba (el de three). Son cuatro partes:
//  - una barra vertical que atraviesa todo el alto,
//  - una barra horizontal en el medio,
//  - dos arcos (medios anillos) enfrentados: el de arriba abre hacia arriba
//    (es la mitad inferior de su círculo) y el de abajo abre hacia abajo.
const PIXELES_ALTO = 1080;
const CENTRO_X = 460;
const CENTRO_Y = 540;

const x = (px) => (px - CENTRO_X) / PIXELES_ALTO;
const y = (py) => (CENTRO_Y - py) / PIXELES_ALTO;
const largo = (px) => px / PIXELES_ALTO;

export const ALTO = 1;
export const ANCHO = 920 / PIXELES_ALTO;

// `mitad`: qué mitad del círculo ocupa el anillo ('inferior' o 'superior').
export const PARTES = [
  { tipo: 'rect', x0: x(380), x1: x(540), y0: y(1080), y1: y(0) },
  // La barra horizontal tiene el mismo grosor que la vertical (160 px) y está centrada.
  { tipo: 'rect', x0: x(20), x1: x(900), y0: y(620), y1: y(460) },
  { tipo: 'anillo', cx: x(460), cy: y(10), r0: largo(295), r1: largo(460), mitad: 'inferior' },
  { tipo: 'anillo', cx: x(460), cy: y(1070), r0: largo(295), r1: largo(460), mitad: 'superior' },
];
