// Ondulación de la bandera: cuánto se adelanta o atrasa (eje z) el punto (u, v)
// de la tela en el instante `t`. `u` va de 0 en el asta a 1 en la punta libre;
// `v` va de 0 a 1 a lo alto. La amplitud crece con `u`: el borde del asta no se
// mueve y la punta es lo que más flamea.
export const AMPLITUD_MAXIMA = 0.2;

export function desplazamientoBandera(u, v, t) {
  const onda = Math.sin(u * 5.5 - t * 3 + v * 1.4);
  const rizo = Math.sin(u * 11 - t * 4.2);
  return u * (0.16 * onda + 0.04 * rizo);
}
