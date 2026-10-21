// Física de la credencial colgante: una cinta Verlet elástica y la tarjeta como
// cuerpo rígido de dos puntos (el agujero P y el borde de abajo C).
export const CINTA_PUNTOS = 18;
const GRAVEDAD = 7000;
const SUBPASOS = 3;
// La cinta es un elástico: pocas iteraciones con rigidez baja la dejan estirarse. Mientras
// se la agarra es muy blanda (se puede estirar muchas veces su largo, sin tope) y al soltarla
// recupera la firmeza.
const RIGIDEZ_REPOSO = 0.7;
const RIGIDEZ_ARRASTRE = 0.05;
// Estirada de más, la cinta tira con la rigidez blanda de siempre (si no, al soltarla desde muy
// lejos lanzaría la tarjeta hacia arriba como un resorte); cerca del reposo es firme y cuelga tensa.
const RIGIDEZ_MUY_ESTIRADA = 0.16;
const ESTIRAMIENTO_FIRME = 1.15;
const ESTIRAMIENTO_BLANDO = 1.8;
const ITERACIONES = 12;
// Amortiguación por subpaso. Agarrada casi no frena (sigue al puntero sin arrastrar peso). Suelta
// frena lo justo para que, con gravedad real, vuelva como un péndulo amortiguado: una o dos
// oscilaciones cortas y queda quieta, sin rebotar hacia arriba.
const AMORT_AGARRADA = 0.991;
const AMORT_SUELTA = 0.88;
// El extremo libre de la tarjeta se frena menos que la cinta: así el giro vuelve a la vertical en ~3 s
// sin rebotar (con el mismo freno que la cinta tardaba más de 15 s en enderezarse).
const AMORT_TARJETA_SUELTA = 0.98;
// Segundos simulados al crearla: nace ya colgando y quieta, no se balancea sola al cargar.
const SEGUNDOS_PARA_ASENTAR = 20;

export function crearCredencial({ ancla, largoCinta, largoTarjeta }) {
  const seg = largoCinta / (CINTA_PUNTOS - 1);
  const cuerda = Array.from({ length: CINTA_PUNTOS }, (_, i) => ({ x: ancla.x, y: ancla.y + i * seg }));
  const fin = cuerda.at(-1);
  const f = {
    ancla,
    seg,
    largoTarjeta,
    cuerda,
    prevCuerda: cuerda.map((q) => ({ ...q })),
    P: { x: fin.x, y: fin.y },
    prevP: { x: fin.x, y: fin.y },
    C: { x: fin.x, y: fin.y + largoTarjeta },
    prevC: { x: fin.x, y: fin.y + largoTarjeta },
    giro: 0,
    vGiro: 0,
    agarre: null, // { x, y, t } mientras se arrastra
  };
  // Que cuelgue ya estirada por su propio peso, quieta.
  for (let i = 0; i < SEGUNDOS_PARA_ASENTAR * 60; i++) pasoCredencial(f, 1 / 60);
  f.giro = 0;
  f.vGiro = 0;
  return f;
}

function integrar(q, prev, h, amortiguacion) {
  const vx = (q.x - prev.x) * amortiguacion;
  const vy = (q.y - prev.y) * amortiguacion;
  prev.x = q.x;
  prev.y = q.y;
  q.x += vx;
  q.y += vy + GRAVEDAD * h * h;
}

export function pasoCredencial(f, dt) {
  const h = dt / SUBPASOS;
  const { cuerda, ancla } = f;
  const mezcla = Math.min(1, Math.max(0, (estiramiento(f) - ESTIRAMIENTO_FIRME) / (ESTIRAMIENTO_BLANDO - ESTIRAMIENTO_FIRME)));
  const rigidez = f.agarre ? RIGIDEZ_ARRASTRE : RIGIDEZ_REPOSO + (RIGIDEZ_MUY_ESTIRADA - RIGIDEZ_REPOSO) * mezcla;
  const amortiguacion = f.agarre ? AMORT_AGARRADA : AMORT_SUELTA;
  for (let s = 0; s < SUBPASOS; s++) {
    for (let i = 1; i < cuerda.length; i++) integrar(cuerda[i], f.prevCuerda[i], h, amortiguacion);
    integrar(f.P, f.prevP, h, amortiguacion);
    integrar(f.C, f.prevC, h, f.agarre ? amortiguacion : AMORT_TARJETA_SUELTA);
    for (let it = 0; it < ITERACIONES; it++) {
      cuerda[0].x = ancla.x;
      cuerda[0].y = ancla.y;
      for (let i = 0; i < cuerda.length - 1; i++) {
        const a = cuerda[i];
        const b = cuerda[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1e-4;
        // una cinta tira pero no empuja: sólo resiste el estiramiento (sin esto, al soltarla
        // se comportaba como una varilla y la tarjeta salía disparada hacia arriba)
        if (d <= f.seg) continue;
        const dif = ((d - f.seg) / d) * rigidez;
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
