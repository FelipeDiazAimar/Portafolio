// Física de la credencial colgante: una cinta Verlet elástica y la tarjeta como
// cuerpo rígido de dos puntos (el agujero P y el borde de abajo C).
export const CINTA_PUNTOS = 18;
const GRAVEDAD = 2200;
const SUBPASOS = 3;
// Pocas iteraciones con rigidez baja: la cinta se estira con el peso y rebota
// como un elástico (con rigidez 1 y 10 iteraciones quedaba como una cuerda).
const RIGIDEZ_CINTA = 0.22;
const ITERACIONES = 7;
const AMORTIGUACION = 0.991;

export function crearCredencial({ ancla, largoCinta, largoTarjeta, impulso = 2.2 }) {
  const seg = largoCinta / (CINTA_PUNTOS - 1);
  const cuerda = Array.from({ length: CINTA_PUNTOS }, (_, i) => ({ x: ancla.x, y: ancla.y + i * seg }));
  const fin = cuerda.at(-1);
  return {
    ancla,
    seg,
    largoTarjeta,
    cuerda,
    prevCuerda: cuerda.map((q) => ({ ...q })),
    P: { x: fin.x, y: fin.y },
    prevP: { x: fin.x, y: fin.y },
    // arranca colgando en reposo, con un impulso lateral suave para que se balancee
    C: { x: fin.x, y: fin.y + largoTarjeta },
    prevC: { x: fin.x - impulso, y: fin.y + largoTarjeta },
    giro: 0,
    vGiro: 0,
    agarre: null, // { x, y, t } mientras se arrastra
  };
}

function integrar(q, prev, h) {
  const vx = (q.x - prev.x) * AMORTIGUACION;
  const vy = (q.y - prev.y) * AMORTIGUACION;
  prev.x = q.x;
  prev.y = q.y;
  q.x += vx;
  q.y += vy + GRAVEDAD * h * h;
}

export function pasoCredencial(f, dt) {
  const h = dt / SUBPASOS;
  const { cuerda, ancla } = f;
  for (let s = 0; s < SUBPASOS; s++) {
    for (let i = 1; i < cuerda.length; i++) integrar(cuerda[i], f.prevCuerda[i], h);
    integrar(f.P, f.prevP, h);
    integrar(f.C, f.prevC, h);
    for (let it = 0; it < ITERACIONES; it++) {
      cuerda[0].x = ancla.x;
      cuerda[0].y = ancla.y;
      for (let i = 0; i < cuerda.length - 1; i++) {
        const a = cuerda[i];
        const b = cuerda[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1e-4;
        const dif = ((d - f.seg) / d) * RIGIDEZ_CINTA;
        if (i === 0) {
          b.x -= dx * dif;
          b.y -= dy * dif;
        } else {
          a.x += dx * dif * 0.5;
          a.y += dy * dif * 0.5;
          b.x -= dx * dif * 0.5;
          b.y -= dy * dif * 0.5;
        }
      }
      // el final de la cinta y el agujero de la tarjeta coinciden (la tarjeta pesa más)
      const fin = cuerda.at(-1);
      const jx = f.P.x - fin.x;
      const jy = f.P.y - fin.y;
      fin.x += jx * 0.7;
      fin.y += jy * 0.7;
      f.P.x -= jx * 0.3;
      f.P.y -= jy * 0.3;
      // la tarjeta es rígida: P y C a distancia fija
      const ex = f.C.x - f.P.x;
      const ey = f.C.y - f.P.y;
      const ed = Math.hypot(ex, ey) || 1e-4;
      const edif = (ed - f.largoTarjeta) / ed;
      f.P.x += ex * edif * 0.4;
      f.P.y += ey * edif * 0.4;
      f.C.x -= ex * edif * 0.6;
      f.C.y -= ey * edif * 0.6;
      if (f.agarre) {
        const { t } = f.agarre;
        const gx = f.P.x + (f.C.x - f.P.x) * t;
        const gy = f.P.y + (f.C.y - f.P.y) * t;
        const mx = f.agarre.x - gx;
        const my = f.agarre.y - gy;
        f.P.x += mx * (1 - t) * 0.9 + (t < 0.5 ? mx * 0.1 : 0);
        f.P.y += my * (1 - t) * 0.9 + (t < 0.5 ? my * 0.1 : 0);
        f.C.x += mx * t * 0.9 + (t >= 0.5 ? mx * 0.1 : 0);
        f.C.y += my * t * 0.9 + (t >= 0.5 ? my * 0.1 : 0);
      }
    }
  }
  // giro sobre el eje de la cinta: lo empuja la velocidad lateral y se asienta de frente o de espaldas
  const vx = (f.C.x - f.prevC.x) / h;
  f.vGiro += Math.min(0.02, Math.max(-0.02, vx * 0.00003)) - Math.sin(f.giro * 2) * 0.012;
  f.vGiro = Math.min(0.22, Math.max(-0.22, f.vGiro * 0.955));
  f.giro += f.vGiro;
}

// Hasta dónde se puede estirar al arrastrar (más que el largo en reposo: es elástica).
export function alcanceArrastre(f, t) {
  return f.seg * (CINTA_PUNTOS - 1) * 1.35 + f.largoTarjeta * t + 30;
}

// Al soltar conserva la mitad del impulso: se lanza, pero no sale disparada.
export function soltar(f) {
  const amortiguar = (q, prev) => {
    prev.x += (q.x - prev.x) * 0.5;
    prev.y += (q.y - prev.y) * 0.5;
  };
  f.cuerda.forEach((q, i) => amortiguar(q, f.prevCuerda[i]));
  amortiguar(f.P, f.prevP);
  amortiguar(f.C, f.prevC);
  f.agarre = null;
}

// Cuánto mide la cinta ahora respecto de su largo en reposo.
export function estiramiento(f) {
  let largo = 0;
  for (let i = 1; i < f.cuerda.length; i++) largo += Math.hypot(f.cuerda[i].x - f.cuerda[i - 1].x, f.cuerda[i].y - f.cuerda[i - 1].y);
  return largo / (f.seg * (CINTA_PUNTOS - 1));
}
