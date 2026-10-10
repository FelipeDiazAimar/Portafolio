import { calcularDispersion } from './desarme.js';

// Física del "desarme": cada pieza sale disparada, cae con gravedad y, al pasar
// `LIMITE_CAIDA`, queda quieta ya fuera de la vista. Es todo funciones puras
// sobre un estado { p, v, r, w, quieto } relativo a la posición armada de la
// pieza (p: posición, v: velocidad, r: rotación, w: velocidad angular).
export const GRAVEDAD = 9;
// Altura (relativa) a partir de la cual la pieza ya está fuera del encuadre.
export const LIMITE_CAIDA = -14;

const DOS_PI = Math.PI * 2;
const envolver = (angulo) => angulo - DOS_PI * Math.round(angulo / DOS_PI);

// Empuje inicial: hacia afuera del centro de la escena (misma dirección que la
// dispersión de antes), con un impulso hacia arriba para que "salte" antes de
// caer, y un giro propio. Determinista por semilla.
export function velocidadInicial(posicion, semilla) {
  const [dx, dy, dz] = calcularDispersion(posicion, semilla);
  const largo = Math.hypot(dx, dy, dz) || 1;
  const impulso = 2.4;
  const azar = (n) => {
    const s = Math.sin(semilla * 39.346 + n * 11.135) * 24634.6345;
    return s - Math.floor(s);
  };
  const giro = (n) => (azar(n) < 0.5 ? -1 : 1) * (2 + azar(n + 7) * 4);
  return {
    v: [(dx / largo) * impulso, (dy / largo) * impulso + 2.2, (dz / largo) * impulso],
    w: [giro(1), giro(2), giro(3)],
  };
}

// Un paso de caída (Euler semi-implícito). Una pieza quieta no se mueve.
export function avanzarCaida(estado, dt) {
  if (estado.quieto) return estado;
  const v = [estado.v[0], estado.v[1] - GRAVEDAD * dt, estado.v[2]];
  const p = [estado.p[0] + v[0] * dt, estado.p[1] + v[1] * dt, estado.p[2] + v[2] * dt];
  const r = [estado.r[0] + estado.w[0] * dt, estado.r[1] + estado.w[1] * dt, estado.r[2] + estado.w[2] * dt];
  return { p, v, r, w: estado.w, quieto: p[1] < LIMITE_CAIDA };
}

// Un paso de regreso al lugar armado: posición y rotación se acercan a cero de
// forma exponencial. La rotación se envuelve a [-π, π] primero, para que no
// "desenrosque" las vueltas que dio al caer.
export function volverAlOrigen(estado, dt, lambda) {
  const factor = Math.exp(-lambda * dt);
  const p = estado.p.map((valor) => valor * factor);
  const r = estado.r.map((valor) => envolver(valor) * factor);
  const estadoNuevo = { p, v: [0, 0, 0], r, w: [0, 0, 0], quieto: false };
  const llego = Math.hypot(...p) < 1e-3 && Math.hypot(...r) < 1e-3;
  return { estado: estadoNuevo, llego };
}
