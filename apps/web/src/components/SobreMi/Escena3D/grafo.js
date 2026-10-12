// Grafo de conocimiento del final de "Hoy" (al estilo de Obsidian): nodos con la
// trayectoria, los proyectos y las tecnologías, unidos por enlaces. La distribución
// sale de una simulación de fuerzas determinista, así es siempre la misma y se
// puede probar sin gráficos.

export const GRUPOS = {
  yo: { nombre: 'Yo', color: '#ffffff' },
  trayectoria: { nombre: 'Trayectoria', color: '#6fa8ff' },
  proyectos: { nombre: 'Proyectos', color: '#3de0c0' },
  tecnologias: { nombre: 'Tecnologías', color: '#ffc247' },
};

// `detalle` es el texto que aparece al pasar el mouse por el nodo.
export const NODOS_GRAFO = [
  { id: 'yo', etiqueta: 'Felipe Diaz Aimar', grupo: 'yo', detalle: 'Busco una nueva oportunidad para seguir creciendo.' },

  { id: 'trayectoria', etiqueta: 'Trayectoria', grupo: 'trayectoria', detalle: 'De armar y reparar equipos a sistemas industriales.' },
  { id: 'origen', etiqueta: 'Origen', grupo: 'trayectoria', detalle: 'Siempre me fascinó todo lo que hacía beep.' },
  { id: 'isfa', etiqueta: 'ISFA', grupo: 'trayectoria', detalle: 'Abanderado en 2022.' },
  { id: 'utn', etiqueta: 'UTN', grupo: 'trayectoria', detalle: 'Ingeniería en Sistemas, cursando el 4.º año.' },
  { id: 'cambridge', etiqueta: 'Cambridge First', grupo: 'trayectoria', detalle: 'Certificado de inglés en 2023.' },
  { id: 'laboratorio', etiqueta: 'Lab. UTN', grupo: 'trayectoria', detalle: 'Ayudante de laboratorio: reparación, instalación y desarme de equipos.' },
  { id: 'ingreso', etiqueta: 'Profesor de ingreso', grupo: 'trayectoria', detalle: 'Programación: Python, C y lógica de procesos. Más de 90 alumnos.' },
  { id: 'tecnico', etiqueta: 'Técnico informático', grupo: 'trayectoria', detalle: 'Reparación de PCs, notebooks, impresoras y teléfonos.' },
  { id: 'mbrf', etiqueta: 'MBRF', grupo: 'trayectoria', detalle: 'Desarrollador fullstack en trazabilidad industrial, planta San Jorge.' },

  { id: 'proyectos', etiqueta: 'Proyectos', grupo: 'proyectos', detalle: 'Trabajo freelance y para clientes.' },
  { id: 'justphones', etiqueta: 'JustPhones', grupo: 'proyectos', detalle: 'Proyecto freelance.' },
  { id: 'calidad', etiqueta: 'Calidad Esencia', grupo: 'proyectos', detalle: 'Proyecto freelance.' },
  { id: 'algobonito', etiqueta: 'AlgoBonitoSV', grupo: 'proyectos', detalle: 'Proyecto freelance.' },
  { id: 'asistente', etiqueta: 'AsistenteInteligente', grupo: 'proyectos', detalle: 'Proyecto freelance.' },
  { id: 'dario', etiqueta: 'Darío Martínez Computación', grupo: 'proyectos', detalle: 'Técnico y desarrollador de su sitio web.' },
  { id: 'neifert', etiqueta: 'Neifert Automotores', grupo: 'proyectos', detalle: 'Cliente freelance.' },

  { id: 'tecnologias', etiqueta: 'Tecnologías', grupo: 'tecnologias', detalle: 'Con lo que trabajo y lo que aprendí.' },
  { id: 'python', etiqueta: 'Python', grupo: 'tecnologias', detalle: 'Lo enseño y lo uso.' },
  { id: 'c', etiqueta: 'C', grupo: 'tecnologias', detalle: 'Lo enseño en el ingreso a la UTN.' },
  { id: 'nextjs', etiqueta: 'Next.js', grupo: 'tecnologias', detalle: 'Este portfolio está hecho con Next.js y React.' },
  { id: 'sap', etiqueta: 'SAP', grupo: 'tecnologias', detalle: 'Integración con los sistemas de trazabilidad de MBRF.' },
  { id: 'kubernetes', etiqueta: 'Kubernetes', grupo: 'tecnologias', detalle: 'Lo aprendí trabajando en MBRF.' },
  { id: 'hardware', etiqueta: 'Hardware', grupo: 'tecnologias', detalle: 'Diagnóstico y reparación de equipos.' },
];

const ENLACES_BASE = [
  ['yo', 'trayectoria'],
  ['yo', 'proyectos'],
  ['yo', 'tecnologias'],
  // Trayectoria, en orden cronológico.
  ['trayectoria', 'origen'],
  ['origen', 'isfa'],
  ['isfa', 'utn'],
  ['utn', 'cambridge'],
  ['utn', 'laboratorio'],
  ['laboratorio', 'ingreso'],
  ['ingreso', 'tecnico'],
  ['tecnico', 'mbrf'],
  ['trayectoria', 'mbrf'],
  // Proyectos.
  ['proyectos', 'justphones'],
  ['proyectos', 'calidad'],
  ['proyectos', 'algobonito'],
  ['proyectos', 'asistente'],
  ['proyectos', 'dario'],
  ['proyectos', 'neifert'],
  ['tecnico', 'dario'],
  ['mbrf', 'neifert'],
  // Tecnologías.
  ['tecnologias', 'python'],
  ['tecnologias', 'c'],
  ['tecnologias', 'nextjs'],
  ['tecnologias', 'sap'],
  ['tecnologias', 'kubernetes'],
  ['tecnologias', 'hardware'],
  ['ingreso', 'python'],
  ['ingreso', 'c'],
  ['mbrf', 'sap'],
  ['mbrf', 'kubernetes'],
  ['laboratorio', 'hardware'],
  ['tecnico', 'hardware'],
  ['algobonito', 'nextjs'],
  ['asistente', 'python'],
];

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
  return 0.05 + Math.min(grado(id), 9) * 0.011;
}

// Distribución por fuerzas (repulsión entre todos, atracción por los enlaces y una
// leve atracción al centro). Parte de una disposición circular, así que no hay azar:
// mismo resultado siempre. Devuelve [x, y, z] por nodo, con el nodo más lejano a
// `radio` del centro.
export function distribuir(radio = 2.6, iteraciones = 420) {
  const n = NODOS_GRAFO.length;
  const pos = NODOS_GRAFO.map((_, i) => {
    const angulo = (i / n) * Math.PI * 2;
    const vuelta = 0.6 + (i % 3) * 0.35;
    return [Math.cos(angulo) * vuelta, Math.sin(angulo) * vuelta];
  });
  const pares = ENLACES_GRAFO.map(({ a, b }) => [INDICE.get(a), INDICE.get(b)]);
  const ideal = 0.85;
  let paso = 0.14;
  for (let it = 0; it < iteraciones; it += 1) {
    const fuerza = pos.map(() => [0, 0]);
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        const dx = pos[i][0] - pos[j][0];
        const dy = pos[i][1] - pos[j][1];
        const d2 = Math.max(dx * dx + dy * dy, 0.0004);
        const f = 0.2 / d2;
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
  return pos.map(([x, y], i) => [x * escala, y * escala, profundidad[NODOS_GRAFO[i].grupo] + ((i * 7) % 5 - 2) * 0.05]);
}
