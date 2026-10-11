// Ondulación de la bandera: cuánto se adelanta o atrasa (eje z) el punto (u, v)
// de la tela en el instante `t`. `u` va de 0 en el asta a 1 en la punta libre;
// `v` va de 0 a 1 a lo alto. La amplitud crece con `u` (el borde del asta no se
// mueve y la punta es lo que más flamea).
//
// Para que se vea como una tela y no como una chapa se suman varias ondas: una
// grande que viaja del asta a la punta, pliegues más chicos que viajan en otra
// dirección, y una onda a lo alto que hace que el borde de arriba y el de abajo
// no se muevan juntos. Una ráfaga lenta modula la fuerza del viento.
export const AMPLITUD_MAXIMA = 0.34;

export function desplazamientoBandera(u, v, t) {
  const viento = 0.85 + 0.15 * Math.sin(t * 0.7);
  const onda = Math.sin(u * 5.2 - t * 2.6 + v * 1.8);
  const pliegue = Math.sin(u * 9.5 - t * 3.7 - v * 2.6);
  const alto = Math.sin(v * 4.2 + t * 1.9 + u * 2.0);
  // `u ** 1.3`: la tela está floja cerca del asta y se suelta recién hacia la punta.
  return u ** 1.3 * viento * (0.17 * onda + 0.07 * pliegue + 0.06 * alto);
}
