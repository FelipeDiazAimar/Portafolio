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
