// Geometría y guion de la constelación de "Hoy": los modelos de los hitos
// anteriores orbitan en un anillo alrededor de un núcleo y están unidos por líneas
// de luz; después todo se recoge en el núcleo, que se expande en una red neuronal.
// Todo es función pura, así se puede probar sin gráficos.

export const NODOS = 6;
export const RADIO = 2.2;
// Los nodos pares suben un poco y los impares bajan, para que el anillo no sea plano.
const DESNIVEL = 0.28;
export const CENTRO = -1;

// Posición [x, y, z] del nodo `i` del anillo.
export function posicionNodo(i, n = NODOS, radio = RADIO) {
  const angulo = (i / n) * Math.PI * 2;
  return [Math.cos(angulo) * radio, i % 2 === 0 ? DESNIVEL : -DESNIVEL, Math.sin(angulo) * radio];
}

// Punto de un extremo de enlace: un nodo del anillo o el núcleo (CENTRO).
export function puntoDe(indice, n = NODOS, radio = RADIO) {
  return indice === CENTRO ? [0, 0, 0] : posicionNodo(indice, n, radio);
}

// Enlaces de luz: la cadena cronológica (cada hito con el siguiente), el último
// hito con el núcleo ("Hoy") y un hilo tenue de cada nodo al núcleo.
export function enlaces(n = NODOS) {
  const lista = [];
  for (let i = 0; i < n - 1; i += 1) lista.push({ desde: i, hasta: i + 1, tipo: 'cadena' });
  lista.push({ desde: n - 1, hasta: CENTRO, tipo: 'cadena' });
  for (let i = 0; i < n; i += 1) lista.push({ desde: i, hasta: CENTRO, tipo: 'hilo' });
  return lista;
}

// Punto a la fracción `f` (0–1) del tramo entre dos puntos.
export function puntoEnTramo(a, b, f) {
  return a.map((v, i) => v + (b[i] - v) * f);
}

// Fracción (0–1) del recorrido de un pulso de luz. Cada enlace `k` arranca desfasado.
export function fasePulso(t, k, velocidad = 0.32) {
  const x = (t * velocidad + k * 0.17) % 1;
  return x < 0 ? x + 1 : x;
}

// ---------------------------------------------------------------------------
// Guion de la escena: los nodos aparecen de a uno hasta formar la constelación,
// ésta se recoge en el núcleo y el núcleo se expande en una red neuronal.

const tramo = (x, [a, b]) => Math.min(1, Math.max(0, (x - a) / (b - a)));

export const T_INICIO = 0.7;
export const PASO = 0.95;
export const DURACION_NODO = 0.8;
export const T_COLAPSO = [8.2, 9.6];
export const T_RED = [9.4, 12.6];

// Aparición del nodo `i` (0–1): empieza en su turno y tarda `DURACION_NODO`.
export function aparicion(i, t) {
  return Math.min(1, Math.max(0, (t - T_INICIO - i * PASO) / DURACION_NODO));
}

// El núcleo aparece primero, antes que cualquier nodo.
export function aparicionNucleo(t) {
  return Math.min(1, Math.max(0, t / T_INICIO));
}

// Cuánto de la constelación ya se recogió en el núcleo (0 = completa, 1 = sólo el núcleo).
export function colapso(t) {
  return tramo(t, T_COLAPSO);
}

// Cuánto se expandió la red neuronal (0–1).
export function expansion(t) {
  return tramo(t, T_RED);
}

// Avance (0–1) con que se dibuja cada enlace: sale cuando aparece su nodo de destino.
export function progresoEnlace(enlace, t, n = NODOS) {
  if (enlace.tipo === 'hilo') return aparicion(enlace.desde, t);
  if (enlace.hasta === CENTRO) return aparicion(n - 1, t - PASO);
  return aparicion(enlace.hasta, t);
}
