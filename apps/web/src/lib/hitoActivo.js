// Hito activo para un progreso de scroll en [0, 1]. El rebote elástico de
// iOS/macOS y los resize pueden dar valores fuera de rango o NaN: se acotan.
export function indiceDeHito(progreso, total) {
  if (total <= 0 || !Number.isFinite(progreso)) return 0;
  const acotado = Math.min(1, Math.max(0, progreso));
  return Math.min(total - 1, Math.floor(acotado * total));
}

// Progreso que cae justo en el centro del tramo de un hito: es adonde hay que
// scrollear para "ir" a ese hito sin quedar en el borde con el vecino.
export function progresoDeHito(indice, total) {
  return (indice + 0.5) / total;
}
