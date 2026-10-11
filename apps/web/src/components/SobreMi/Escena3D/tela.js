// Simulación de una tela colgada de una varilla: una malla de partículas unidas
// por resortes rígidos (integración de Verlet + resolución iterativa de
// restricciones de distancia). Es todo cálculo, sin three: las posiciones viven
// en `tela.p` (x, y, z por partícula) y la escena las copia a la geometría.
//
// Convención: la fila 0 es el borde de arriba, pegado a la varilla (partículas
// fijas); las filas siguientes cuelgan hacia abajo (-y).
import { progresoEntrada } from './entrada.js';

export const PASO = 1 / 60;
// Alta a propósito: con menos, los pliegues de la tela recién desenrollada no
// llegan a abrirse (en el plano no tienen por dónde) y queda arrugada.
const GRAVEDAD = 16;
const AMORTIGUACION = 0.985;
const ITERACIONES = 8;
// Al desenrollarse, la tela empieza con las filas casi juntas, pegadas arriba.
const COMPRESION_ENROLLADA = 0.04;

export function crearTela({ columnas, filas, ancho, alto, yTope, enrollada = false }) {
  const n = columnas * filas;
  const p = new Float32Array(n * 3);
  const q = new Float32Array(n * 3);
  const fijas = new Uint8Array(n);
  const dx = ancho / (columnas - 1);
  const dy = alto / (filas - 1);

  for (let f = 0; f < filas; f += 1) {
    for (let c = 0; c < columnas; c += 1) {
      const i = f * columnas + c;
      p[i * 3] = -ancho / 2 + c * dx;
      p[i * 3 + 1] = yTope - f * dy * (enrollada ? COMPRESION_ENROLLADA : 1);
      p[i * 3 + 2] = 0;
      fijas[i] = f === 0 ? 1 : 0;
    }
  }
  q.set(p);

  // Resortes: horizontales, verticales y las dos diagonales de cada celda
  // (las diagonales evitan que la malla se "corte" en rombos).
  // Cada resorte guarda sus componentes de reposo: `rx` (horizontal) y `ry`
  // (vertical). El largo de reposo es hypot(rx, ry): al desenrollar sólo se
  // estira la componente vertical, como una bandera enrollada en su varilla que
  // conserva todo el ancho.
  const a = [];
  const b = [];
  const rx = [];
  const ry = [];
  const unir = (i, j, x, y) => {
    a.push(i);
    b.push(j);
    rx.push(x);
    ry.push(y);
  };
  for (let f = 0; f < filas; f += 1) {
    for (let c = 0; c < columnas; c += 1) {
      const i = f * columnas + c;
      if (c < columnas - 1) unir(i, i + 1, dx, 0);
      if (f < filas - 1) unir(i, i + columnas, 0, dy);
      if (c < columnas - 1 && f < filas - 1) {
        unir(i, i + columnas + 1, dx, dy);
        unir(i + 1, i + columnas, dx, dy);
      }
    }
  }

  return {
    columnas,
    filas,
    n,
    ancho,
    alto,
    yTope,
    p,
    q,
    fijas,
    ra: Int32Array.from(a),
    rb: Int32Array.from(b),
    rx: Float32Array.from(rx),
    ry: Float32Array.from(ry),
    // Largo de reposo con la tela desenrollada (estiramiento = 1).
    rl: Float32Array.from(rx.map((x, k) => Math.hypot(x, ry[k]))),
  };
}

// Cuánto de la tela está desenrollado `t` segundos después de empezar: arranca
// recogida (0,04), espera `retraso` y se despliega en `duracion` con una
// desaceleración al final. Se le pasa a `pasoTela` como `estiramiento`.
export function estiramientoDesenrollado(t, retraso, duracion) {
  return 0.04 + 0.96 * progresoEntrada(t, retraso, duracion);
}

// Aceleración (en z) que el viento le da a un punto de la tela en el instante t.
// Varía en el espacio y el tiempo para que la tela ondule y no se mueva entera.
export function fuerzaViento(x, y, t) {
  const rafaga = 0.6 + 0.4 * Math.sin(t * 0.7);
  return rafaga * (1.6 * Math.sin(x * 2.1 + t * 1.7 + y * 1.3) + 0.8 * Math.sin(x * 4.3 - t * 2.9 + y * 2.1));
}

// Un paso de simulación.
//  - estiramiento: cuánto del largo vertical de la tela está desenrollado (1 =
//    completa; menos de 1 la recoge hacia la varilla, para animar el desenrollado).
//    Tiene que cambiar de a poco (una rampa de ~2 s): un salto brusco pliega la
//    cadena de filas como un acordeón.
//  - viento: intensidad del viento (0 = aire quieto).
//  - agarre: { indice, x, y, z } para sujetar una partícula en un punto.
export function pasoTela(tela, dt, { estiramiento = 1, viento = 0, t = 0, agarre = null } = {}) {
  const { p, q, fijas, n } = tela;

  for (let i = 0; i < n; i += 1) {
    if (fijas[i]) continue;
    const ix = i * 3;
    const vx = (p[ix] - q[ix]) * AMORTIGUACION;
    const vy = (p[ix + 1] - q[ix + 1]) * AMORTIGUACION;
    const vz = (p[ix + 2] - q[ix + 2]) * AMORTIGUACION;
    q[ix] = p[ix];
    q[ix + 1] = p[ix + 1];
    q[ix + 2] = p[ix + 2];
    const aceleracionZ = viento ? viento * fuerzaViento(p[ix], p[ix + 1], t) : 0;
    p[ix] += vx;
    p[ix + 1] += vy - GRAVEDAD * dt * dt;
    p[ix + 2] += vz + aceleracionZ * dt * dt;
  }

  const agarrada = agarre ? agarre.indice : -1;
  if (agarre) {
    const ix = agarre.indice * 3;
    p[ix] = agarre.x;
    p[ix + 1] = agarre.y;
    p[ix + 2] = agarre.z;
    q[ix] = agarre.x;
    q[ix + 1] = agarre.y;
    q[ix + 2] = agarre.z;
  }

  const { ra, rb, rl, rx, ry } = tela;
  for (let iteracion = 0; iteracion < ITERACIONES; iteracion += 1) {
    for (let k = 0; k < rl.length; k += 1) {
      const i = ra[k];
      const j = rb[k];
      const pesoI = fijas[i] || i === agarrada ? 0 : 1;
      const pesoJ = fijas[j] || j === agarrada ? 0 : 1;
      const suma = pesoI + pesoJ;
      if (suma === 0) continue;
      const ix = i * 3;
      const jx = j * 3;
      const dx = p[jx] - p[ix];
      const dy = p[jx + 1] - p[ix + 1];
      const dz = p[jx + 2] - p[ix + 2];
      const distancia = Math.hypot(dx, dy, dz);
      if (distancia < 1e-9) continue;
      const reposo = estiramiento === 1 ? rl[k] : Math.hypot(rx[k], ry[k] * estiramiento);
      const diferencia = (distancia - reposo) / distancia;
      const ci = (diferencia * pesoI) / suma;
      const cj = (diferencia * pesoJ) / suma;
      p[ix] += dx * ci;
      p[ix + 1] += dy * ci;
      p[ix + 2] += dz * ci;
      p[jx] -= dx * cj;
      p[jx + 1] -= dy * cj;
      p[jx + 2] -= dz * cj;
    }
  }
}

// Empuja (como con la mano o el viento) las partículas cercanas a un punto: les
// suma una velocidad (vx, vy, vz) que decae con la distancia, hasta `radio`.
export function empujar(tela, x, y, z, vx, vy, vz, radio) {
  const { p, q, fijas, n } = tela;
  for (let i = 0; i < n; i += 1) {
    if (fijas[i]) continue;
    const ix = i * 3;
    const distancia = Math.hypot(p[ix] - x, p[ix + 1] - y, p[ix + 2] - z);
    if (distancia >= radio) continue;
    const peso = (1 - distancia / radio) ** 2;
    // En Verlet la velocidad es (p - q): moverla es mover q en sentido contrario.
    q[ix] -= vx * peso;
    q[ix + 1] -= vy * peso;
    q[ix + 2] -= vz * peso;
  }
}

// Índice de la partícula no fija más cercana a un punto, o -1 si hay una
// distancia máxima y ninguna entra.
export function particulaMasCercana(tela, x, y, z, distanciaMaxima = Infinity) {
  const { p, fijas, n } = tela;
  let mejor = -1;
  let mejorDistancia = distanciaMaxima;
  for (let i = 0; i < n; i += 1) {
    if (fijas[i]) continue;
    const distancia = Math.hypot(p[i * 3] - x, p[i * 3 + 1] - y, p[i * 3 + 2] - z);
    if (distancia < mejorDistancia) {
      mejorDistancia = distancia;
      mejor = i;
    }
  }
  return mejor;
}
