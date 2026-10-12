// Utilidades para navegar por la lista de proyectos con el teclado.

// Índice siguiente al moverse `delta` posiciones, dando la vuelta en los extremos.
export function moverIndice(indice, total, delta) {
  // Sin elementos no hay a dónde moverse.
  if (total <= 0) return 0;
  return (((indice + delta) % total) + total) % total;
}

// Índice para teclas: ArrowDown/ArrowRight +1, ArrowUp/ArrowLeft -1, Home 0, End n-1; otra → null.
export function indicePorTecla(tecla, indice, total) {
  // Sin elementos, las teclas conocidas se quedan en el inicio.
  if (total <= 0) {
    if (
      tecla === 'ArrowDown' ||
      tecla === 'ArrowRight' ||
      tecla === 'ArrowUp' ||
      tecla === 'ArrowLeft' ||
      tecla === 'Home' ||
      tecla === 'End'
    ) {
      return 0;
    }
    return null;
  }
  // Avanzar una posición (con vuelta en los extremos).
  if (tecla === 'ArrowDown' || tecla === 'ArrowRight') {
    return moverIndice(indice, total, 1);
  }
  // Retroceder una posición (con vuelta en los extremos).
  if (tecla === 'ArrowUp' || tecla === 'ArrowLeft') {
    return moverIndice(indice, total, -1);
  }
  // Ir al primer proyecto.
  if (tecla === 'Home') {
    return 0;
  }
  // Ir al último proyecto.
  if (tecla === 'End') {
    return total - 1;
  }
  // Tecla no relacionada con la navegación.
  return null;
}
