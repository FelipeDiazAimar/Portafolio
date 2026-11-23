// Trazos 2D para las líneas del sitio (estilo lusion.co): una curva guía suave y, en algunos puntos,
// rulos que son círculos perfectos tangentes a la guía (entran y salen sin quiebre). Sin DOM.
//
// `guia(u)` (u 0..1) → [x, y]. `lazos`: [{ u, r, giros = 1, sentido = 1 }]. Devuelve los puntos en
// orden y su largo acumulado.

const TAU = Math.PI * 2;

function tangente(guia, u) {
  const e = 1e-4;
  const a = guia(Math.max(0, u - e));
  const b = guia(Math.min(1, u + e));
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  return [dx / l, dy / l];
}

export function trazar(guia, lazos = [], paso = 5) {
  const puntos = [];
  const agregar = (p) => {
    const ultimo = puntos[puntos.length - 1];
    if (!ultimo || Math.hypot(p[0] - ultimo[0], p[1] - ultimo[1]) > 0.5) puntos.push(p);
  };
  // un tramo de la guía, con tantos puntos como pida su largo
  const tramo = (u0, u1) => {
    let largo = 0;
    let previo = guia(u0);
    for (let k = 1; k <= 20; k += 1) {
      const p = guia(u0 + ((u1 - u0) * k) / 20);
      largo += Math.hypot(p[0] - previo[0], p[1] - previo[1]);
      previo = p;
    }
    const n = Math.max(2, Math.ceil(largo / paso));
    for (let k = 0; k <= n; k += 1) agregar(guia(u0 + ((u1 - u0) * k) / n));
  };
  const orden = [...lazos].sort((a, b) => a.u - b.u);
  let u = 0;
  for (const lazo of orden) {
    tramo(u, lazo.u);
    const A = guia(lazo.u);
    const T = tangente(guia, lazo.u);
    const s = lazo.sentido ?? 1;
    const N = [-T[1], T[0]];
    const C = [A[0] + s * lazo.r * N[0], A[1] + s * lazo.r * N[1]];
    const t0 = Math.atan2(A[1] - C[1], A[0] - C[0]);
    const total = TAU * (lazo.giros ?? 1);
    const n = Math.max(24, Math.ceil((total * lazo.r) / paso));
    for (let k = 1; k <= n; k += 1) {
      const t = t0 + s * (total * k) / n;
      agregar([C[0] + Math.cos(t) * lazo.r, C[1] + Math.sin(t) * lazo.r]);
    }
    u = lazo.u;
  }
  tramo(u, 1);
  const largos = [0];
  for (let k = 1; k < puntos.length; k += 1) {
    largos.push(largos[k - 1] + Math.hypot(puntos[k][0] - puntos[k - 1][0], puntos[k][1] - puntos[k - 1][1]));
  }
  return { puntos, largos, largo: largos[largos.length - 1] };
}

// "d" de un <path> a partir de los puntos.
export function aRuta(puntos) {
  return puntos.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
}

// Curva de Bézier cúbica como guía.
export function bezier(p0, p1, p2, p3) {
  return (u) => {
    const v = 1 - u;
    const a = v * v * v;
    const b = 3 * v * v * u;
    const c = 3 * v * u * u;
    const d = u * u * u;
    return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
  };
}

// Tabla "monótona" del avance de una coordenada (k = 0 → x, 1 → y) a lo largo del trazo: para cada
// punto, el máximo alcanzado hasta ahí. Sirve para que la punta siga a un lugar de la pantalla sin
// retroceder cuando un rulo vuelve atrás.
export function tablaAvance(trazo, k) {
  let max = -Infinity;
  return trazo.puntos.map((p) => (max = Math.max(max, p[k])));
}

// Largo del trazo en que la coordenada alcanza `valor` por primera vez (0..largo).
export function largoHasta(trazo, tabla, valor) {
  if (valor <= tabla[0]) return 0;
  const n = tabla.length - 1;
  if (valor >= tabla[n]) return trazo.largo;
  let a = 0;
  let b = n;
  while (b - a > 1) {
    const m = (a + b) >> 1;
    if (tabla[m] >= valor) b = m;
    else a = m;
  }
  const f = (valor - tabla[a]) / Math.max(1e-6, tabla[b] - tabla[a]);
  return trazo.largos[a] + (trazo.largos[b] - trazo.largos[a]) * f;
}

// Colores de LINES_DATA_LIST de lusion.co; en tema claro el blanco pasa a grafito.
export const PRESETS = {
  reel: { c0: '#5a90ff', c1: '#2a38ee' },
  goal: { c0: '#94fffb', c1: '#1285dc' },
  capability: { c0: '#ffffff', c1: '#bbbbbb', claro: { c0: '#2a2f3a', c1: '#8a91a0' } },
  office: { c0: '#ffffff', c1: '#bbbbbb', claro: { c0: '#2a2f3a', c1: '#8a91a0' } },
};

export function grosorLinea(vw) {
  return Math.min(16, Math.max(9, vw * 0.0095));
}
