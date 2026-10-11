// Ciclo lento de "se arma y se desarma" de la PC de 2024, como función pura del
// tiempo. 0 = todas las piezas en su lugar, 1 = separadas del todo ("vista
// explotada"). Se queda un rato quieta en cada extremo para que se pueda mirar.
// Casi todo el ciclo está armada: la vista explotada es un momento, no el estado normal.
const ARMADA = 7;
const SEPARANDO = 1.6;
const DESARMADA = 1.2;
const ARMANDO = 1.6;

export const DURACION_CICLO = ARMADA + SEPARANDO + DESARMADA + ARMANDO;

const suave = (x) => x * x * (3 - 2 * x);

export function fraccionExplosion(t) {
  const x = ((t % DURACION_CICLO) + DURACION_CICLO) % DURACION_CICLO;
  if (x < ARMADA) return 0;
  if (x < ARMADA + SEPARANDO) return suave((x - ARMADA) / SEPARANDO);
  if (x < ARMADA + SEPARANDO + DESARMADA) return 1;
  return 1 - suave((x - ARMADA - SEPARANDO - DESARMADA) / ARMANDO);
}
