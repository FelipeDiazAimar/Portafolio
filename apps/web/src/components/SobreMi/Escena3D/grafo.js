// Grafo de conocimiento del final de "Hoy" (al estilo de Obsidian): nodos con la
// trayectoria, los proyectos y las tecnologías, unidos por enlaces. La distribución
// sale de una simulación de fuerzas determinista, así es siempre la misma y se
// puede probar sin gráficos.

import { ENLACES_BASE, GRUPOS, NODOS_GRAFO } from './grafoDatos.js';

export { GRUPOS, NODOS_GRAFO };
export const ENLACES_GRAFO = ENLACES_BASE.map(([a, b]) => ({ a, b }));

const INDICE = new Map(NODOS_GRAFO.map((n, i) => [n.id, i]));
export const indiceDe = (id) => INDICE.get(id);

// Ids de los nodos unidos al `id` por algún enlace.
export function vecinos(id) {
  const lista = [];
  for (const { a, b } of ENLACES_GRAFO) {
    if (a === id) lista.push(b);
    else if (b === id) lista.push(a);
  }
  return lista;
}

// Cantidad de enlaces de cada nodo: define su tamaño.
export function grado(id) {
  return vecinos(id).length;
}

// Radio (en unidades de la escena) del punto de cada nodo, según su grado (el nodo
// central es el más grande).
export function radioNodo(id) {
  if (id === 'yo') return 0.16;
  const propio = NODOS_GRAFO[INDICE.get(id)]?.tamano;
  if (propio) return propio;
  return 0.05 + Math.min(grado(id), 9) * 0.011;
}

// Distribución por fuerzas (repulsión entre todos, atracción por los enlaces y una
// leve atracción al centro). Parte de una disposición circular, así que no hay azar:
// mismo resultado siempre. Devuelve [x, y, z] por nodo, con el nodo más lejano a
// `radio` del centro.
// El radio por defecto crece con la cantidad de nodos, así al sumar más no se amontonan.
export function distribuir(radio = 2.6 * Math.sqrt(NODOS_GRAFO.length / 24), iteraciones = 420) {
  const n = NODOS_GRAFO.length;
  const pos = NODOS_GRAFO.map((_, i) => {
    const angulo = (i / n) * Math.PI * 2;
    const vuelta = 0.6 + (i % 3) * 0.35;
    return [Math.cos(angulo) * vuelta, Math.sin(angulo) * vuelta];
  });
  const pares = ENLACES_GRAFO.map(({ a, b }) => [INDICE.get(a), INDICE.get(b)]);
  const ideal = 1.0;
  let paso = 0.14;
  for (let it = 0; it < iteraciones; it += 1) {
    const fuerza = pos.map(() => [0, 0]);
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        const dx = pos[i][0] - pos[j][0];
        const dy = pos[i][1] - pos[j][1];
        const d2 = Math.max(dx * dx + dy * dy, 0.0004);
        const f = 0.34 / d2;
        const d = Math.sqrt(d2);
        fuerza[i][0] += (dx / d) * f;
        fuerza[i][1] += (dy / d) * f;
        fuerza[j][0] -= (dx / d) * f;
        fuerza[j][1] -= (dy / d) * f;
      }
    }
    for (const [i, j] of pares) {
      const dx = pos[j][0] - pos[i][0];
      const dy = pos[j][1] - pos[i][1];
      const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1e-4);
      const f = (d - ideal) * 0.9;
      fuerza[i][0] += (dx / d) * f;
      fuerza[i][1] += (dy / d) * f;
      fuerza[j][0] -= (dx / d) * f;
      fuerza[j][1] -= (dy / d) * f;
    }
    for (let i = 0; i < n; i += 1) {
      fuerza[i][0] -= pos[i][0] * 0.05;
      fuerza[i][1] -= pos[i][1] * 0.05;
      pos[i][0] += fuerza[i][0] * paso;
      pos[i][1] += fuerza[i][1] * paso;
    }
    paso *= 0.9935;
  }
  const maximo = Math.max(...pos.map(([x, y]) => Math.hypot(x, y)));
  const escala = radio / maximo;
  // Un poco de profundidad por grupo, para que al girar se vea que es un volumen.
  const profundidad = { yo: 0, trayectoria: 0.35, proyectos: -0.35, tecnologias: 0.0 };
  return pos.map(([x, y], i) => [x * escala, y * escala, (profundidad[NODOS_GRAFO[i].grupo] ?? 0) + ((i * 7) % 5 - 2) * 0.05]);
}
