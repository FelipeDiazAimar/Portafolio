// Trayectoria del avioncito del email.
//
// En vez de unir tramos (círculo + recta), se define la CURVATURA en función de
// la distancia recorrida y se integra: entra al rizo y sale de él con una rampa
// suave (smoothstep), como un avión real que va inclinando las alas. La
// posición, el ángulo y la curvatura son continuos en todo el vuelo, así que no
// hay un solo tirón.
//
// Convención de pantalla: y crece hacia abajo; el ángulo θ apunta en
// (cos θ, sin θ), así que arriba es -π/2. Sentido +1 = rizo horario.
const PASO_PX = 1;
const ARRANQUE = -Math.PI / 2; // sale de la manija hacia arriba
const SALIDA = Math.PI / 4; // y termina yéndose a 45°

const suave = (x) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

export function crearRutaAvion({ inicio, ancho, alto, vueltas = 1 }) {
  const radio = Math.min(118, Math.max(70, ancho * 0.085));
  // El rizo se abre hacia donde hay lugar: si a la derecha no entra, gira al revés.
  const sentido = inicio.x + radio * 2.3 < ancho - 24 ? 1 : -1;
  const giroTotal = vueltas * 2 * Math.PI + SALIDA;
  const rampa = radio * 1.3; // cuanto más larga, más gradual entra y sale de la inclinación
  const meseta = giroTotal * radio - rampa; // con curvatura 1/radio, el giro total es k·(meseta + rampa)
  const largoGiro = meseta + 2 * rampa;
  const largoSalida = Math.hypot(ancho, alto) * 1.1;
  const total = largoGiro + largoSalida;

  const curvaturaEn = (s) => {
    if (s < rampa) return suave(s / rampa) / radio;
    if (s < rampa + meseta) return 1 / radio;
    if (s < largoGiro) return (1 - suave((s - rampa - meseta) / rampa)) / radio;
    return 0;
  };

  // Integración numérica a un píxel por muestra (trapecio en el ángulo y
  // punto medio en la posición).
  const n = Math.ceil(total / PASO_PX) + 1;
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  const angulos = new Float64Array(n);
  const curvaturas = new Float64Array(n);
  xs[0] = inicio.x;
  ys[0] = inicio.y;
  angulos[0] = ARRANQUE;
  curvaturas[0] = curvaturaEn(0);
  for (let i = 1; i < n; i++) {
    const s = i * PASO_PX;
    const k = curvaturaEn(s);
    curvaturas[i] = k;
    angulos[i] = angulos[i - 1] + sentido * ((curvaturas[i - 1] + k) / 2) * PASO_PX;
    const medio = (angulos[i - 1] + angulos[i]) / 2;
    xs[i] = xs[i - 1] + Math.cos(medio) * PASO_PX;
    ys[i] = ys[i - 1] + Math.sin(medio) * PASO_PX;
  }

  const lerp = (a, b, t) => a + (b - a) * t;
  function enRuta(distancia) {
    const s = Math.min(total, Math.max(0, distancia));
    const posicion = Math.min(n - 1, s / PASO_PX);
    const i = Math.min(n - 2, Math.floor(posicion));
    const t = posicion - i;
    return {
      x: lerp(xs[i], xs[i + 1], t),
      y: lerp(ys[i], ys[i + 1], t),
      angulo: lerp(angulos[i], angulos[i + 1], t),
      // curvatura con signo y normalizada por el radio: ±1 en la meseta del rizo
      curvatura: sentido * lerp(curvaturas[i], curvaturas[i + 1], t) * radio,
    };
  }

  return { total, radio, sentido, enRuta };
}

// ---------------------------------------------------------------------------
// Ruta por las letras de "Hablemos.": el avión sube, hace un rizo cuyo punto más alto cae en
// el hueco de la "o", sigue hacia la izquierda, hace otro rizo por el hueco de la "b" y se
// va por arriba. Los rizos son círculos horarios (giros a la derecha) apoyados sobre cada
// letra: el avión la toca "por dentro" en pleno giro.
//
// Se arma con rectas y arcos y se suaviza con un filtro gaussiano a lo largo del recorrido,
// así las uniones recta-arco no tienen quiebres de curvatura.
const SIGMA_PX = 22; // ancho del suavizado: la curvatura cambia ≤ 0,02 (normalizada) por px
const CARRERA_MINIMA_PX = 3 * SIGMA_PX; // entre dos giros distintos tiene que haber recta para no pisarse
const GIRO_ENTRADA_MAXIMO_PX = 150; // radio del giro amplio con el que sube y se acomoda hacia las letras
const RADIO_SALIDA_PX = 110;
const GIRO_SALIDA = (100 * Math.PI) / 180; // sale girando 100° a la derecha: queda yéndose hacia arriba, un poco a la derecha

class Lapiz {
  constructor(x, y, angulo) {
    this.x = x;
    this.y = y;
    this.angulo = angulo;
    this.xs = [x];
    this.ys = [y];
  }

  recta(largo) {
    if (largo <= 0) return;
    const n = Math.max(1, Math.ceil(largo));
    const paso = largo / n;
    for (let i = 0; i < n; i++) {
      this.x += Math.cos(this.angulo) * paso;
      this.y += Math.sin(this.angulo) * paso;
      this.xs.push(this.x);
      this.ys.push(this.y);
    }
  }

  // giro +1: horario en pantalla (a la derecha); -1: antihorario.
  arco(radio, angulo, giro) {
    const n = Math.max(1, Math.ceil(radio * angulo));
    const d = angulo / n;
    const cuerda = 2 * radio * Math.sin(d / 2);
    for (let i = 0; i < n; i++) {
      const medio = this.angulo + (giro * d) / 2;
      this.x += Math.cos(medio) * cuerda;
      this.y += Math.sin(medio) * cuerda;
      this.angulo += giro * d;
      this.xs.push(this.x);
      this.ys.push(this.y);
    }
  }
}

// Muestrea la poligonal a una muestra por píxel de recorrido.
function resamplear(xs, ys) {
  const salidaX = [xs[0]];
  const salidaY = [ys[0]];
  let falta = 1; // lo que falta recorrer para la próxima muestra
  for (let i = 1; i < xs.length; i++) {
    let dx = xs[i] - xs[i - 1];
    let dy = ys[i] - ys[i - 1];
    let largo = Math.hypot(dx, dy);
    let x = xs[i - 1];
    let y = ys[i - 1];
    while (largo >= falta) {
      x += (dx / largo) * falta;
      y += (dy / largo) * falta;
      salidaX.push(x);
      salidaY.push(y);
      dx = xs[i] - x;
      dy = ys[i] - y;
      largo -= falta;
      falta = 1;
    }
    falta -= largo;
  }
  return { xs: salidaX, ys: salidaY };
}

function suavizarGauss(xs, ys, sigma) {
  const mitad = Math.ceil(sigma * 3);
  const pesos = [];
  let suma = 0;
  for (let j = -mitad; j <= mitad; j++) {
    const w = Math.exp((-j * j) / (2 * sigma * sigma));
    pesos.push(w);
    suma += w;
  }
  const n = xs.length;
  const sx = new Array(n);
  const sy = new Array(n);
  for (let i = 0; i < n; i++) {
    let ax = 0;
    let ay = 0;
    for (let j = -mitad; j <= mitad; j++) {
      const k = Math.min(n - 1, Math.max(0, i + j));
      ax += xs[k] * pesos[j + mitad];
      ay += ys[k] * pesos[j + mitad];
    }
    sx[i] = ax / suma;
    sy[i] = ay / suma;
  }
  return { xs: sx, ys: sy };
}

export function crearRutaPorLetras({ inicio, ancho, alto, letras }) {
  if (!letras || letras.length === 0) return null;
  // El avión viene de la derecha: se atraviesa primero la letra que está más a la derecha.
  const ordenadas = [...letras].sort((a, b) => b.x - a.x);
  const radioHueco = Math.min(...ordenadas.map((l) => l.radio));
  const radio = Math.min(62, Math.max(38, radioHueco * 3.4)); // radio del rizo (ya suavizado)
  // El filtro achica un círculo en exp(-σ²/2R²): se pre-compensa para que, ya suavizado, el rizo
  // tenga exactamente `radio` y su punto más alto caiga en el hueco.
  const radioArmado = radio * Math.exp((SIGMA_PX * SIGMA_PX) / (2 * radio * radio));
  const yHuecos = ordenadas.reduce((suma, l) => suma + l.y, 0) / ordenadas.length;
  const centroY = yHuecos + radio; // el hueco queda en el punto más alto del círculo
  const yVuelo = centroY + radioArmado; // altura de la recta por la que se entra a cada rizo

  const xDerecha = ordenadas[0].x;
  const xIzquierda = ordenadas.at(-1).x;
  const radioGiro = Math.min(GIRO_ENTRADA_MAXIMO_PX, inicio.x - xDerecha - CARRERA_MINIMA_PX);
  const carrera = Math.min(110, xIzquierda - RADIO_SALIDA_PX - 12);
  const valido =
    radioGiro >= 28 &&
    carrera >= CARRERA_MINIMA_PX &&
    ordenadas.every((l) => l.x > radio + 10 && l.x < ancho - radio - 10 && l.y > 24 && Math.abs(l.y - yHuecos) < 8) &&
    yVuelo < alto - 24 &&
    inicio.y > yVuelo + radioGiro + CARRERA_MINIMA_PX;
  if (!valido) return null;

  const lapiz = new Lapiz(inicio.x, inicio.y, ARRANQUE);
  lapiz.recta(inicio.y - (yVuelo + radioGiro)); // sube desde la manija
  lapiz.arco(radioGiro, Math.PI / 2, -1); // giro a la izquierda: de ir al norte a ir al oeste
  for (const letra of ordenadas) {
    lapiz.recta(lapiz.x - letra.x);
    lapiz.arco(radioArmado, 2 * Math.PI, 1); // rizo horario que toca la letra por arriba
  }
  lapiz.recta(carrera);
  lapiz.arco(RADIO_SALIDA_PX, GIRO_SALIDA, 1); // giro a la derecha: del oeste hacia arriba
  lapiz.recta((lapiz.y + 300) / Math.max(0.3, -Math.sin(lapiz.angulo))); // y se va por arriba de la pantalla

  // Se extiende en línea recta antes y después para que el filtro no deforme los extremos:
  // el punto de despegue queda exactamente en la manija.
  const base = resamplear(lapiz.xs, lapiz.ys);
  const relleno = Math.ceil(SIGMA_PX * 3) + 2;
  const xs = [];
  const ys = [];
  for (let k = relleno; k >= 1; k--) {
    xs.push(inicio.x - Math.cos(ARRANQUE) * k);
    ys.push(inicio.y - Math.sin(ARRANQUE) * k);
  }
  xs.push(...base.xs);
  ys.push(...base.ys);
  for (let k = 1; k <= relleno; k++) {
    xs.push(base.xs[base.xs.length - 1] + Math.cos(lapiz.angulo) * k);
    ys.push(base.ys[base.ys.length - 1] + Math.sin(lapiz.angulo) * k);
  }
  const lisa = suavizarGauss(xs, ys, SIGMA_PX);
  const recorte = resamplear(lisa.xs.slice(relleno, lisa.xs.length - relleno), lisa.ys.slice(relleno, lisa.ys.length - relleno));
  const px = recorte.xs;
  const py = recorte.ys;
  const n = px.length;

  // Ángulo (continuo, sin saltos de ±π) y curvatura a partir de la posición.
  const angulos = new Float64Array(n);
  angulos[0] = ARRANQUE;
  for (let i = 1; i < n; i++) {
    const a = Math.atan2(py[Math.min(n - 1, i + 1)] - py[i - 1], px[Math.min(n - 1, i + 1)] - px[i - 1]);
    let d = a - angulos[i - 1];
    d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
    angulos[i] = angulos[i - 1] + d;
  }
  const curvaturas = new Float64Array(n);
  const ventana = 6;
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - ventana);
    const b = Math.min(n - 1, i + ventana);
    curvaturas[i] = ((angulos[b] - angulos[a]) / (b - a)) * radio;
  }
  // Cercanía a los huecos de las letras (0 = lejos, 1 = en el centro): el avión se achica al
  // pasar por dentro para entrar en el hueco.
  const influencia = Math.max(60, radioHueco * 3.6);
  const cercanias = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let mejor = 0;
    for (const letra of ordenadas) {
      const t = 1 - Math.hypot(px[i] - letra.x, py[i] - letra.y) / influencia;
      if (t > 0) mejor = Math.max(mejor, t * t * (3 - 2 * t));
    }
    cercanias[i] = mejor;
  }

  const total = n - 1;
  const lerp = (a, b, t) => a + (b - a) * t;
  // Al pasar por el hueco de una letra el avión frena (queda a ~40 % de su velocidad): así se lo ve
  // cruzar por dentro de la "o" y de la "b" en vez de pasar de largo. `tau` es el "tiempo" acumulado
  // a lo largo de la ruta con esa velocidad reducida.
  const FRENADO_EN_HUECO = 0.6;
  const tau = new Float64Array(n);
  for (let i = 1; i < n; i++) tau[i] = tau[i - 1] + 1 / (1 - FRENADO_EN_HUECO * cercanias[i]);
  // fracción del tiempo (0 a 1, ya con el perfil de aceleración) → distancia recorrida
  function distanciaPara(fraccion) {
    const objetivo = Math.min(1, Math.max(0, fraccion)) * tau[n - 1];
    let a = 0;
    let b = n - 1;
    while (b - a > 1) {
      const m = (a + b) >> 1;
      if (tau[m] <= objetivo) a = m;
      else b = m;
    }
    return a + (objetivo - tau[a]) / Math.max(1e-9, tau[b] - tau[a]);
  }
  function enRuta(distancia) {
    const posicion = Math.min(total, Math.max(0, distancia));
    const i = Math.min(n - 2, Math.floor(posicion));
    const t = posicion - i;
    return {
      x: lerp(px[i], px[i + 1], t),
      y: lerp(py[i], py[i + 1], t),
      angulo: lerp(angulos[i], angulos[i + 1], t),
      curvatura: lerp(curvaturas[i], curvaturas[i + 1], t),
      cercania: lerp(cercanias[i], cercanias[i + 1], t),
    };
  }
  return { total, radio, sentido: 1, letras: ordenadas, enRuta, distanciaPara, duracionRelativa: tau[n - 1] / total };
}

// Perfil de velocidad: arranca desde cero (el avioncito "nace" de la manija y
// toma carrera), vuela parejo y se acelera al irse. Se integra una vez y se
// normaliza para que la fracción recorrida vaya de 0 a 1.
const MUESTRAS_VELOCIDAD = 600;
const fraccionAcumulada = (() => {
  const acumulado = new Float64Array(MUESTRAS_VELOCIDAD + 1);
  for (let i = 1; i <= MUESTRAS_VELOCIDAD; i++) {
    const t = (i - 0.5) / MUESTRAS_VELOCIDAD;
    const velocidad = suave(t / 0.2) * (1 + 0.8 * suave((t - 0.5) / 0.5));
    acumulado[i] = acumulado[i - 1] + velocidad / MUESTRAS_VELOCIDAD;
  }
  const total = acumulado[MUESTRAS_VELOCIDAD];
  return acumulado.map((valor) => valor / total);
})();

// t (0 a 1, tiempo normalizado del vuelo) → fracción (0 a 1) del recorrido.
export function fraccionRecorrida(t) {
  const x = Math.min(1, Math.max(0, t)) * MUESTRAS_VELOCIDAD;
  const i = Math.min(MUESTRAS_VELOCIDAD - 1, Math.floor(x));
  return fraccionAcumulada[i] + (fraccionAcumulada[i + 1] - fraccionAcumulada[i]) * (x - i);
}
