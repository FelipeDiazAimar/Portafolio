// Animaciones del banco de trabajo de 2025, como funciones puras del tiempo `t`
// (segundos): el parpadeo de los LEDs de la placa en reparación y el ciclo del
// destornillador (baja a un tornillo, lo aprieta girando y vuelve a subir).
export const CANTIDAD_LEDS = 12;

// ¿Está prendido el LED `i` en el instante `t`? Cada uno tiene su propia
// frecuencia y fase, así que la placa parpadea sin ningún patrón evidente.
export function ledEncendido(i, t) {
  return Math.sin(t * (1.3 + i * 0.37) + i * 1.9) > 0.15;
}

const BAJANDO = 1.1;
const APRETANDO = 1.6;
const SUBIENDO = 1.1;
const EN_ALTO = 1.6;
export const DURACION_DESTORNILLADOR = BAJANDO + APRETANDO + SUBIENDO + EN_ALTO;

const suave = (x) => x * x * (3 - 2 * x);
const ciclo = (t) => ((t % DURACION_DESTORNILLADOR) + DURACION_DESTORNILLADOR) % DURACION_DESTORNILLADOR;

// 0 = el destornillador está apoyado en el tornillo, 1 = levantado del todo.
export function alturaDestornillador(t) {
  const x = ciclo(t);
  if (x < BAJANDO) return 1 - suave(x / BAJANDO);
  if (x < BAJANDO + APRETANDO) return 0;
  if (x < BAJANDO + APRETANDO + SUBIENDO) return suave((x - BAJANDO - APRETANDO) / SUBIENDO);
  return 1;
}

// Giro acumulado (radianes) del destornillador: sólo avanza mientras aprieta, y
// se conserva entre ciclos (nunca retrocede).
const VUELTAS_POR_CICLO = 2.5;
export function giroDestornillador(t) {
  const completos = Math.floor(t / DURACION_DESTORNILLADOR);
  const x = ciclo(t);
  const apretado = Math.min(1, Math.max(0, (x - BAJANDO) / APRETANDO));
  return (completos + apretado) * VUELTAS_POR_CICLO * Math.PI * 2;
}
