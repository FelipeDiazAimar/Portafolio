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

// --- Distribución en 3D por fuerzas ---------------------------------------
// Repulsión entre todos los nodos, resortes en los enlaces y una leve atracción al
// centro. `pos` y `vel` son listas de [x, y, z] que se modifican en el lugar;
// `fijos[i]` en true deja ese nodo quieto (por ejemplo, el que se está arrastrando).
// Es la misma simulación para armar la distribución inicial y para reacomodar el
// resto cuando se arrastra un nodo.
export const FUERZAS = { ideal: 1.0, repulsion: 0.34, centro: 0.05, amortiguacion: 0.82 };

export function pasoFuerzas(pos, vel, fijos, alpha = 1, f = FUERZAS) {
  const n = pos.length;
  const fuerza = pos.map(() => [0, 0, 0]);
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const dx = pos[i][0] - pos[j][0];
      const dy = pos[i][1] - pos[j][1];
      const dz = pos[i][2] - pos[j][2];
      const d2 = Math.max(dx * dx + dy * dy + dz * dz, 0.0004);
      const d = Math.sqrt(d2);
      const empuje = f.repulsion / d2;
      fuerza[i][0] += (dx / d) * empuje;
      fuerza[i][1] += (dy / d) * empuje;
      fuerza[i][2] += (dz / d) * empuje;
      fuerza[j][0] -= (dx / d) * empuje;
      fuerza[j][1] -= (dy / d) * empuje;
      fuerza[j][2] -= (dz / d) * empuje;
    }
  }
  for (const { a, b } of ENLACES_GRAFO) {
    const i = INDICE.get(a);
    const j = INDICE.get(b);
    const dx = pos[j][0] - pos[i][0];
    const dy = pos[j][1] - pos[i][1];
    const dz = pos[j][2] - pos[i][2];
    const d = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 1e-4);
    const tension = (d - f.ideal) * 0.9;
    fuerza[i][0] += (dx / d) * tension;
    fuerza[i][1] += (dy / d) * tension;
    fuerza[i][2] += (dz / d) * tension;
    fuerza[j][0] -= (dx / d) * tension;
    fuerza[j][1] -= (dy / d) * tension;
    fuerza[j][2] -= (dz / d) * tension;
  }
  for (let i = 0; i < n; i += 1) {
    if (fijos?.[i]) {
      vel[i][0] = 0;
      vel[i][1] = 0;
      vel[i][2] = 0;
      continue;
    }
    for (let k = 0; k < 3; k += 1) {
      fuerza[i][k] -= pos[i][k] * f.centro;
      vel[i][k] = (vel[i][k] + fuerza[i][k] * 0.14 * alpha) * f.amortiguacion;
      pos[i][k] += vel[i][k];
    }
  }
}

// Posiciones iniciales sobre una esfera (espiral de Fibonacci): sin azar y sin que
// dos nodos arranquen en el mismo punto.
function esferaInicial(n, radio) {
  const dorado = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: n }, (_, i) => {
    const y = n === 1 ? 0 : 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const angulo = i * dorado;
    return [Math.cos(angulo) * r * radio, y * radio, Math.sin(angulo) * r * radio];
  });
}

// Distribución inicial: corre la simulación hasta que se asienta y escala el
// resultado para que el nodo más lejano quede a `radio` del centro. Sin azar: mismo
// resultado siempre. El radio por defecto crece con la cantidad de nodos, así al
// sumar más no se amontonan.
export function distribuir(radio = 2.6 * Math.sqrt(NODOS_GRAFO.length / 24), iteraciones = 520) {
  const n = NODOS_GRAFO.length;
  const pos = esferaInicial(n, 1.1);
  const vel = pos.map(() => [0, 0, 0]);
  for (let it = 0; it < iteraciones; it += 1) {
    pasoFuerzas(pos, vel, null, Math.max(0.05, 1 - it / iteraciones));
  }
  const maximo = Math.max(...pos.map(([x, y, z]) => Math.hypot(x, y, z)));
  const escala = radio / maximo;
  return pos.map(([x, y, z]) => [x * escala, y * escala, z * escala]);
}
