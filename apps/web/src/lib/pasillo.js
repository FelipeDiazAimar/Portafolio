// Geometría del recorrido de Experiencia, sin three.js (se prueba con node --test).
//
// Cada trabajo es un pasillo recto. Al final de cada uno hay un cruce cuadrado donde se dobla
// 90° (alternando derecha / izquierda, así el recorrido avanza en zigzag y nunca se pisa) y
// empieza el pasillo siguiente. Todo vive en el plano del suelo (x, z); "adelante" del primer
// pasillo es -z, como mira la cámara de three por defecto.
//
// La cámara va por la línea central: recta por cada pasillo y una curva (Bézier cuadrática con
// el control en el centro del cruce) en cada giro. `puntoEn(recorrido, s)` da la posición y la
// dirección a `s` metros del inicio, medidos sobre el camino.

export const ANCHO = 4.4;
export const ALTO = 3.2;
// metros antes del primer objeto y después del último, y separación entre objetos
const MARGEN_INICIO = 3.2;
const MARGEN_FINAL = 4.6;
const SEPARACION = 2.4;
// dónde arranca la cámara (desde el comienzo del primer pasillo)
const ARRANQUE = 0.6;
// el último pasillo tiene una antesala libre antes de la puerta del fondo, y la cámara la
// atraviesa: termina PASADA la puerta, adentro de la luz
export const ANTESALA = 2.4;
// después de cada giro, un tramo despejado antes de que empiece el pasillo siguiente (respiro entre
// un trabajo y otro)
export const VESTIBULO = 2.6;
export const DESPUES_DE_LA_PUERTA = 1.6;
const MUESTRAS_CURVA = 48;

// Direcciones en el suelo, en orden horario visto desde arriba: adelante, derecha, atrás, izquierda.
const DIRECCIONES = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

// Derecha de una dirección (en el suelo, con y hacia arriba).
export const derechaDe = ([dx, dz]) => [-dz, dx];

// Giro (rotation.y de three) que lleva el -z local a la dirección `dir`.
export const guinadaDe = ([dx, dz]) => Math.atan2(-dx, -dz);

export function largoDePasillo(cantidadObjetos) {
  return MARGEN_INICIO + Math.max(0, cantidadObjetos - 1) * SEPARACION + MARGEN_FINAL;
}

// Arma el recorrido para una lista de trabajos ({ objetos: [{ lado }] }).
export function armarRecorrido(trabajos) {
  const pasillos = [];
  let rumbo = 0;
  let inicio = [0, 0];
  trabajos.forEach((trabajo, i) => {
    const dir = DIRECCIONES[rumbo];
    const der = derechaDe(dir);
    const objetos = trabajo.objetos ?? [];
    const ultimo = i === trabajos.length - 1;
    const vestibulo = i > 0 ? VESTIBULO : 0;
    const largo = vestibulo + largoDePasillo(objetos.length) + (ultimo ? ANTESALA : 0);
    // 1 = dobla a la derecha, -1 = a la izquierda, 0 = el último no dobla
    const giro = ultimo ? 0 : i % 2 === 0 ? 1 : -1;
    const fin = [inicio[0] + dir[0] * largo, inicio[1] + dir[1] * largo];
    const cruce = ultimo ? null : [fin[0] + (dir[0] * ANCHO) / 2, fin[1] + (dir[1] * ANCHO) / 2];
    const colocados = objetos.map((objeto, n) => {
      const a = vestibulo + MARGEN_INICIO + n * SEPARACION;
      const lado = objeto.lado === 'der' ? 1 : -1;
      return {
        indice: n,
        a,
        lado,
        // pie del objeto contra la pared (en el mundo)
        x: inicio[0] + dir[0] * a + der[0] * lado * (ANCHO / 2),
        z: inicio[1] + dir[1] * a + der[1] * lado * (ANCHO / 2),
      };
    });
    pasillos.push({ indice: i, inicio, dir, der, largo, vestibulo, giro, fin, cruce, objetos: colocados });
    if (!ultimo) {
      rumbo = (rumbo + giro + 4) % 4;
      const nueva = DIRECCIONES[rumbo];
      inicio = [cruce[0] + (nueva[0] * ANCHO) / 2, cruce[1] + (nueva[1] * ANCHO) / 2];
    }
  });

  // tramos del camino de la cámara: recta por pasillo y curva por cruce
  const tramos = [];
  pasillos.forEach((p, i) => {
    const desde = i === 0 ? [p.inicio[0] + p.dir[0] * ARRANQUE, p.inicio[1] + p.dir[1] * ARRANQUE] : p.inicio;
    const hasta = p.cruce ? p.fin : [p.fin[0] + p.dir[0] * DESPUES_DE_LA_PUERTA, p.fin[1] + p.dir[1] * DESPUES_DE_LA_PUERTA];
    tramos.push(recta(desde, hasta, i));
    if (p.cruce) tramos.push(curva(p.fin, p.cruce, pasillos[i + 1].inicio, i));
  });
  let acumulado = 0;
  for (const tramo of tramos) {
    tramo.desde = acumulado;
    acumulado += tramo.largo;
    tramo.hasta = acumulado;
  }
  // dónde empieza cada pasillo sobre el camino (para saltar a un trabajo)
  const comienzos = pasillos.map((_, i) => tramos.find((t) => t.pasillo === i && t.tipo === 'recta').desde);
  return { pasillos, tramos, largo: acumulado, comienzos };
}

function recta(a, b, pasillo) {
  const largo = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return {
    tipo: 'recta',
    pasillo,
    largo,
    punto: (u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u],
  };
}

const bezier = (a, c, b, t) => {
  const m = 1 - t;
  return [m * m * a[0] + 2 * m * t * c[0] + t * t * b[0], m * m * a[1] + 2 * m * t * c[1] + t * t * b[1]];
};

// Curva del giro, recorrida a velocidad constante: se tabula el largo acumulado y se invierte.
function curva(a, c, b, pasillo) {
  const tabla = [0];
  let previo = a;
  for (let k = 1; k <= MUESTRAS_CURVA; k++) {
    const p = bezier(a, c, b, k / MUESTRAS_CURVA);
    tabla.push(tabla[k - 1] + Math.hypot(p[0] - previo[0], p[1] - previo[1]));
    previo = p;
  }
  const largo = tabla[MUESTRAS_CURVA];
  return {
    tipo: 'curva',
    pasillo,
    largo,
    punto: (u) => {
      const objetivo = u * largo;
      let k = 1;
      while (k < MUESTRAS_CURVA && tabla[k] < objetivo) k++;
      const tramo = tabla[k] - tabla[k - 1] || 1;
      const t = (k - 1 + (objetivo - tabla[k - 1]) / tramo) / MUESTRAS_CURVA;
      return bezier(a, c, b, t);
    },
  };
}

const limitar = (v, min, max) => Math.min(max, Math.max(min, v));

// Tramo que contiene la distancia `s` (limitada al camino).
export function tramoEn(recorrido, s) {
  const d = limitar(s, 0, recorrido.largo);
  return recorrido.tramos.find((t) => d <= t.hasta) ?? recorrido.tramos[recorrido.tramos.length - 1];
}

// Posición en el suelo a `s` metros del arranque.
export function puntoEn(recorrido, s) {
  const d = limitar(s, 0, recorrido.largo);
  const tramo = tramoEn(recorrido, d);
  return tramo.punto(tramo.largo ? (d - tramo.desde) / tramo.largo : 0);
}

// Pasillo "actual" para la interfaz: el giro ya cuenta como el pasillo siguiente pasada su mitad.
export function pasilloEn(recorrido, s) {
  const tramo = tramoEn(recorrido, s);
  if (tramo.tipo === 'curva' && s > (tramo.desde + tramo.hasta) / 2) return tramo.pasillo + 1;
  return tramo.pasillo;
}
