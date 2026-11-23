// Motor de movimiento común al "glow-up" (inspirado en lusion.co): un resorte de segundo orden
// para suavizar cualquier valor y el estado del scroll (posición y velocidad) que leen las líneas,
// las apariciones y el "wave" de las imágenes. Sin React ni DOM al importar.

// Resorte de segundo orden (t3ssel8r): `f` = frecuencia (Hz), `z` = amortiguación (1 = crítico,
// < 1 rebota un poco), `r` = respuesta inicial (0 = arranca suave, > 1 se pasa y vuelve).
// Lusion usa f = 1.5, z = 0.8 para el scroll.
export class SecondOrderDynamics {
  constructor(f = 1.5, z = 0.8, r = 0, x0 = 0) {
    this.configurar(f, z, r);
    this.xp = x0;
    this.y = x0;
    this.yd = 0;
  }

  configurar(f, z, r) {
    const w = 2 * Math.PI * f;
    this.k1 = z / (Math.PI * f);
    this.k2 = 1 / (w * w);
    this.k3 = (r * z) / w;
  }

  // Lleva el valor a `x` (sin saltos). Devuelve el valor suavizado.
  actualizar(dt, x) {
    if (dt <= 0) return this.y;
    const dt1 = Math.min(dt, 1 / 20); // tras una pestaña dormida no se dispara
    const xd = (x - this.xp) / dt1;
    this.xp = x;
    // estabilidad: k2 nunca por debajo del límite del paso
    const k2 = Math.max(this.k2, (dt1 * dt1) / 2 + (dt1 * this.k1) / 2, dt1 * this.k1);
    this.y += dt1 * this.yd;
    this.yd += (dt1 * (x + this.k3 * xd - this.y - this.k1 * this.yd)) / k2;
    return this.y;
  }

  // Salto sin animación (al redimensionar, al teletransportarse).
  fijar(x) {
    this.xp = x;
    this.y = x;
    this.yd = 0;
  }
}

// Normaliza la rueda entre navegadores y dispositivos (líneas → píxeles; un clic de rueda ≈ 100 px).
export function normalizeWheel(evento) {
  let px = evento.deltaX;
  let py = evento.deltaY;
  if (evento.deltaMode === 1) {
    px *= 40;
    py *= 40;
  } else if (evento.deltaMode === 2) {
    px *= 800;
    py *= 800;
  }
  return { pixelX: px, pixelY: py, spinX: Math.sign(px), spinY: Math.sign(py) };
}

export const limitar = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const mapear = (x, a, b, c = 0, d = 1) => c + ((x - a) / (b - a)) * (d - c);
export const suave = (x) => {
  const t = limitar(x);
  return t * t * (3 - 2 * t);
};

// ---- estado del scroll, compartido ------------------------------------------------------------
// `y`: posición; `vel`: px por cuadro crudo (Lenis o la diferencia de scrollY); `fuerza`: 0..2 suave,
// la "u_scrollXStrength" de Lusion (lo que deforma las imágenes en un scroll rápido).
export const scroll = { y: 0, vel: 0, fuerza: 0, direccion: 1 };

const oyentes = new Set();
// Se suscribe al cuadro común (ticker de GSAP). Devuelve la función para salir.
export function alCuadro(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

let ultimoY = null;
let suavizadoFuerza = 0;
// La llama ScrollSuave en cada cuadro del ticker de GSAP (`dt` en segundos).
export function tickMovimiento(dt) {
  if (typeof window === 'undefined') return;
  const lenis = window.__lenis;
  // (el scroll suavizado puede pasarse un poco del final o del principio; la página no se mueve más
  // allá, así que lo que sigue al scroll tampoco)
  const limite = lenis?.limit ?? document.documentElement.scrollHeight - window.innerHeight;
  const y = Math.min(Math.max(0, lenis ? lenis.animatedScroll : window.scrollY), Math.max(0, limite));
  const vel = lenis && lenis.isScrolling ? lenis.velocity : ultimoY === null ? 0 : y - ultimoY;
  ultimoY = y;
  scroll.y = y;
  scroll.vel = vel;
  if (Math.abs(vel) > 0.1) scroll.direccion = Math.sign(vel);
  const objetivo = Math.min(Math.abs(vel) * 0.04, 2);
  suavizadoFuerza += (objetivo - suavizadoFuerza) * Math.min(1, dt * 6);
  scroll.fuerza = suavizadoFuerza;
  oyentes.forEach((fn) => fn(dt, scroll));
}

export function movimientoReducido() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
