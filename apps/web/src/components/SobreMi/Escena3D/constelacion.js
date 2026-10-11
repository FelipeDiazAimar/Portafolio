// Geometría de la constelación de "Hoy": los modelos de los hitos anteriores
// orbitan en un anillo alrededor de un núcleo y están unidos por líneas de luz.
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
