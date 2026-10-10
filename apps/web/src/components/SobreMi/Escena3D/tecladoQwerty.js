// Distribución del teclado de la notebook: 5 filas de 12 teclas. Una celda con
// texto vacío es una tecla sin leyenda (por ejemplo, las de la barra espaciadora).
export const DISPOSICION = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'", '↵'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/', '⇧', 'del'],
  ['ctrl', 'fn', 'alt', '', '', '', '', '', 'alt', '←', '↓', '→'],
];

export const COLUMNAS = DISPOSICION[0].length;
export const TOTAL_TECLAS = COLUMNAS * DISPOSICION.length;

// Índice (fila * COLUMNAS + columna) de la tecla de una letra, o -1 si no hay.
export function indiceDeLetra(letra) {
  if (!letra) return -1;
  return DISPOSICION.flat().indexOf(letra.toLowerCase());
}
