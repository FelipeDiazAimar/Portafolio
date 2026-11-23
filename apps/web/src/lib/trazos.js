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
    if (lazo.u <= u) continue;
    tramo(u, lazo.u);
    const A = guia(lazo.u);
    const T = tangente(guia, lazo.u);
    const s = lazo.sentido ?? 1;
    const N = [-T[1], T[0]];
    const C = [A[0] + s * lazo.r * N[0], A[1] + s * lazo.r * N[1]];
    const t0 = Math.atan2(A[1] - C[1], A[0] - C[0]);
    const total = TAU * (lazo.giros ?? 1);
    // El rulo avanza mientras gira (como una "l" cursiva): entra en A y sale más adelante, en E,
    // sobre la misma guía y con su misma dirección (sin quiebre). El centro viaja del círculo tangente
    // en A al círculo tangente en E, y el ángulo se ajusta para terminar justo en E.
    const avance = lazo.r * (lazo.avance ?? 1.35);
    let u2 = lazo.u;
    while (u2 < 1) {
      const p = guia(u2);
      if (Math.hypot(p[0] - A[0], p[1] - A[1]) >= avance) break;
      u2 += 0.0005;
    }
    u2 = Math.min(1, u2);
    const E = guia(u2);
    const TE = tangente(guia, u2);
    const NE = [-TE[1], TE[0]];
    const CE = [E[0] + s * lazo.r * NE[0], E[1] + s * lazo.r * NE[1]];
    const tFin = t0 + s * total;
    let tE = Math.atan2(E[1] - CE[1], E[0] - CE[0]);
    while (tE - tFin > Math.PI) tE -= TAU;
    while (tFin - tE > Math.PI) tE += TAU;
    const n = Math.max(24, Math.ceil((total * lazo.r) / paso));
    for (let k = 1; k <= n; k += 1) {
      const f = k / n;
      const e = f * f * (3 - 2 * f);
      const t = t0 + s * total * f + (tE - tFin) * e;
      const cx = C[0] + (CE[0] - C[0]) * e;
      const cy = C[1] + (CE[1] - C[1]) * e;
      agregar([cx + Math.cos(t) * lazo.r, cy + Math.sin(t) * lazo.r]);
    }
    u = Math.min(1, u2);
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

export function grosorLinea(vw) {
  return Math.min(16, Math.max(9, vw * 0.0095));
}

// Guía suave que pasa por todos los puntos (Catmull-Rom centrípeta): u 0..1 se reparte entre los
// tramos según su largo, así la velocidad es pareja. Para encadenar secciones en un solo trazo.
// Redondea un recorrido marcado a mano (Chaikin): corta cada esquina en sus cuartos, varias veces.
// Los primeros fijosIni y los últimos fijosFin puntos quedan exactos (son los empalmes).
export function suavizar(puntos, { fijosIni = 1, fijosFin = 1, vueltas = 3 } = {}) {
  if (puntos.length < 3) return puntos;
  const ini = puntos.slice(0, Math.max(0, fijosIni - 1));
  const fin = puntos.slice(puntos.length - Math.max(0, fijosFin - 1));
  let medio = puntos.slice(ini.length, puntos.length - fin.length);
  for (let v = 0; v < vueltas; v += 1) {
    const sig = [medio[0]];
    for (let i = 0; i < medio.length - 1; i += 1) {
      const [ax, ay] = medio[i];
      const [bx, by] = medio[i + 1];
      if (i > 0) sig.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25]);
      if (i < medio.length - 2) sig.push([ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
    }
    sig.push(medio[medio.length - 1]);
    medio = sig;
  }
  return [...ini, ...medio, ...fin];
}

// Saca los puntos marcados demasiado cerca del anterior (dejan esquinas cerradas al redondear).
// El primero y el último quedan siempre.
export function ralear(puntos, distancia) {
  if (puntos.length < 3) return puntos;
  const sale = [puntos[0]];
  for (let i = 1; i < puntos.length - 1; i += 1) {
    const [ax, ay] = sale[sale.length - 1];
    if (Math.hypot(puntos[i][0] - ax, puntos[i][1] - ay) >= distancia) sale.push(puntos[i]);
  }
  const ultimo = puntos[puntos.length - 1];
  const [ax, ay] = sale[sale.length - 1];
  if (sale.length > 1 && Math.hypot(ultimo[0] - ax, ultimo[1] - ay) < distancia * 0.5) sale.pop();
  sale.push(ultimo);
  return sale;
}

export function spline(puntos) {
  const P = [puntos[0], ...puntos, puntos[puntos.length - 1]];
  const tramos = [];
  for (let i = 1; i < P.length - 2; i += 1) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    const d = (a, b) => Math.max(1e-3, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])));
    const t1 = d(p0, p1);
    const t2 = t1 + d(p1, p2);
    const t3 = t2 + d(p2, p3);
    tramos.push({ p0, p1, p2, p3, t1, t2, t3, largo: Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) });
  }
  const total = tramos.reduce((s, t) => s + t.largo, 0) || 1;
  let acc = 0;
  tramos.forEach((t) => {
    t.desde = acc / total;
    acc += t.largo;
    t.hasta = acc / total;
  });
  const lerp2 = (a, b, ta, tb, t) => {
    const k = (t - ta) / (tb - ta || 1e-6);
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  };
  const guia = (u) => {
    const v = Math.min(1, Math.max(0, u));
    const tr = tramos.find((t) => v <= t.hasta) ?? tramos[tramos.length - 1];
    const local = (v - tr.desde) / Math.max(1e-6, tr.hasta - tr.desde);
    const t = tr.t1 + (tr.t2 - tr.t1) * local;
    const A1 = lerp2(tr.p0, tr.p1, 0, tr.t1, t);
    const A2 = lerp2(tr.p1, tr.p2, tr.t1, tr.t2, t);
    const A3 = lerp2(tr.p2, tr.p3, tr.t2, tr.t3, t);
    const B1 = lerp2(A1, A2, 0, tr.t2, t);
    const B2 = lerp2(A2, A3, tr.t1, tr.t3, t);
    return lerp2(B1, B2, tr.t1, tr.t2, t);
  };
  // dónde empieza y termina cada tramo (en u), para ubicar rulos
  guia.tramos = tramos.map((t) => [t.desde, t.hasta]);
  return guia;
}

// El color de la línea: azul eléctrico parejo (un solo tono: así no hay saltos de color donde se
// empalman sus partes).
export const COLOR_LINEA = { c0: '#3d77ff', c1: '#3d77ff' };

// Punto del trazo a un largo dado.
export function puntoEnLargo(trazo, largo) {
  const { puntos, largos } = trazo;
  if (largo <= 0) return puntos[0];
  const n = largos.length - 1;
  if (largo >= largos[n]) return puntos[n];
  let a = 0;
  let b = n;
  while (b - a > 1) {
    const m = (a + b) >> 1;
    if (largos[m] >= largo) b = m;
    else a = m;
  }
  const f = (largo - largos[a]) / Math.max(1e-6, largos[b] - largos[a]);
  return [puntos[a][0] + (puntos[b][0] - puntos[a][0]) * f, puntos[a][1] + (puntos[b][1] - puntos[a][1]) * f];
}

// Dónde entra la línea en Sobre mí: el punto del borde de arriba del panel (fracción del ancho) en
// que termina el tramo del hero y arranca la línea del reel. Así las dos se tocan.
export const ENTRADA_REEL = 0.3;

// Une dos trazos (el segundo empieza donde termina el primero).
export function unirTrazos(a, b) {
  const puntos = [...a.puntos, ...b.puntos.slice(1)];
  const largos = [0];
  for (let k = 1; k < puntos.length; k += 1) {
    largos.push(largos[k - 1] + Math.hypot(puntos[k][0] - puntos[k - 1][0], puntos[k][1] - puntos[k - 1][1]));
  }
  return { puntos, largos, largo: largos[largos.length - 1] };
}

// La regla de la punta en todo el sitio: a la altura del 56 % de la pantalla (px de página); al
// llegar al final de la página se adelanta, así la línea termina de dibujarse con el último scroll.
export function puntaDePagina(y, vh) {
  const maximo = document.documentElement.scrollHeight - vh;
  return y + vh * 0.56 + Math.min(1, Math.max(0, (y - (maximo - vh)) / vh)) * vh * 0.7;
}

// Títulos: la línea entra por el borde de arriba, al centro (viene del pasillo por el centro), gira
// como una hélice alrededor del carrusel y sale por el borde de abajo a esta altura del ancho.
export const ENTRADA_TITULOS = 0.5;
export const SALIDA_TITULOS = 0.725;
// por dónde baja la línea al salir de Títulos: por detrás del texto de la tarjeta, pegada al borde
// derecho (ahí sigue la de Habilidades)
export const BAJADA_TITULOS = 0.955;
