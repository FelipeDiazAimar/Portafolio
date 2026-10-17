// Datos del grafo de conocimiento del final de "Hoy". Para sumar algo basta editar
// ESTE archivo; la distribución, los colores, el tamaño y el hover se arman solos.
//
//  - GRUPOS: cada grupo tiene un nombre y un color. Para un grupo nuevo (por ejemplo
//    "Certificados") se agrega acá y se usa su clave en `grupo` de los nodos.
//  - NODOS_GRAFO: { id, etiqueta, grupo, detalle } con `id` único. Opcionales:
//      url      al hacer click en el nodo se abre ese enlace en otra pestaña,
//      tamano   radio del punto (si no, depende de cuántos enlaces tenga).
//  - ENLACES_BASE: pares [idA, idB]. Todo nodo tiene que quedar unido al resto
//    (los tests lo verifican).
//
export const GRUPOS = {
  yo: { nombre: 'Yo', color: '#ffffff' },
  // Azul eléctrico (era un celeste): el mismo en tema claro y oscuro.
  trayectoria: { nombre: 'Trayectoria', color: '#1f6bff' },
  proyectos: { nombre: 'Proyectos', color: '#00f5c4' },
  tecnologias: { nombre: 'Tecnologías', color: '#ffb21a' },
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

export const ENLACES_BASE = [
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
