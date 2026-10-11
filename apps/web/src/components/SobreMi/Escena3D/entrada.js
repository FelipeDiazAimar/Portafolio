// Entrada diferida de un elemento: vale 0 hasta `retraso` segundos, sube hasta 1
// en `duracion` segundos con una desaceleración al final, y se queda en 1.
export function progresoEntrada(t, retraso, duracion) {
  const x = Math.min(1, Math.max(0, (t - retraso) / duracion));
  return 1 - (1 - x) ** 3;
}
