// Guion de la escena de 2023, como funciones puras del tiempo `t` (segundos desde
// que la escena está activa): las materias se tildan de a una y, cuando se
// tildó la última, aparece el sello de Cambridge.
//
// Las materias son de los primeros años de Ingeniería en Sistemas de Información
// (UTN). Pueden ajustarse sin tocar nada más: el resto de la escena se arma sola
// a partir de esta lista.
export const MATERIAS = [
  'Análisis Matemático I',
  'Álgebra y Geometría Analítica',
  'Algoritmos y Estructuras de Datos',
  'Sistemas y Procesos de Negocio',
  'Matemática Discreta',
  'Arquitectura de Computadoras',
  'Física I',
  'Ingeniería y Sociedad',
  'Paradigmas de Programación',
  'Sintaxis y Semántica de Lenguajes',
  'Análisis Matemático II',
  'Física II',
];

const INICIO = 0.9;
const PASO = 0.5;
const DURACION_TILDE = 0.45;
const DURACION_SELLO = 1.4;
const PAUSA_ANTES_DEL_SELLO = 0.5;

// Cuándo termina de tildarse la última materia.
export const T_FIN_TILDES = INICIO + (MATERIAS.length - 1) * PASO + DURACION_TILDE;
const T_SELLO = T_FIN_TILDES + PAUSA_ANTES_DEL_SELLO;

const acotar = (x) => Math.min(1, Math.max(0, x));

// Avance (0 a 1) del tildado de la materia `indice`.
export function progresoTilde(indice, t) {
  return acotar((t - (INICIO + indice * PASO)) / DURACION_TILDE);
}

// Avance (0 a 1) de la aparición del sello. Con una desaceleración al final.
export function progresoSello(t) {
  const x = acotar((t - T_SELLO) / DURACION_SELLO);
  return 1 - (1 - x) ** 3;
}

// La tilde "salta" al aparecer: pasa un poco de su tamaño y vuelve (easeOutBack).
export function escalaTilde(p) {
  const x = acotar(p);
  const c1 = 2.2;
  const c3 = c1 + 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
}

// Brillo de la tarjeta: un destello al tildarse (pico a mitad del tildado) que
// después se apaga hasta un resplandor tenue de "materia aprobada".
export function brilloTarjeta(p) {
  const x = acotar(p);
  if (x >= 1) return 0.25;
  return Math.sin(x * Math.PI);
}
