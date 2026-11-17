// Geometría del reel de hitos ("Sobre mí"), sin DOM ni three para poder probarla.
//
// El reel es una cinta curva de portadas. `fase` es un índice de hito fraccionario (0 = Origen,
// N-1 = Hoy) que persigue, amortiguado, al que marca el scroll. Cada portada se ubica según su
// índice relativo a la fase: la que está en 0 queda de frente, las vecinas giran por la pista.

export const ANCHO_PLANO = 2.38;
export const ALTO_PLANO = 1.5771;
export const SEGMENTOS = [48, 24];
export const CAMARA = { fov: 65.7, z: 8.1, cerca: 0.1, lejos: 40 };

export const PASO_THETA = 0.73; // ángulo de pista entre dos portadas vecinas
export const DESFASE_Z = 0.28;
export const PASO_VERTICAL = 0.52; // × la escala de la malla
export const BEND_BASE = 0.3;
export const BEND_MAX = 0.42;
export const ONDULACION = 0.006;
export const RIGIDEZ = 13;
export const DT_MAX = 0.05;
// Fracción del ancho de pantalla que ocupa la portada del centro.
// (La referencia pedía 37 % en escritorio; se bajó a 34 % y se separaron las tarjetas para que el
// titular de fondo se lea entre una y otra.)
export const FRACCION_CENTRAL = { escritorio: 0.34, movil: 0.77 };
// A cuántas portadas de distancia, en horizontal, queda la vecina.
export const SEPARACION = { escritorio: 1.34, movil: 0.98 };

export const limitar = (x, min, max) => Math.min(max, Math.max(min, x));

// Índice de una portada respecto de la fase. Con `envolver`, la cinta es un anillo y el
// resultado cae en [-total/2, total/2). Sin envolver es una línea de tiempo: Origen no tiene
// nada antes ni Hoy nada después.
export function relativoDe(indice, fase, total, envolver = false) {
  const r = indice - fase;
  if (!envolver || total <= 0) return r;
  const mitad = total / 2;
  return ((((r + mitad) % total) + total) % total) - mitad;
}

// Posición y giro de una portada a `relativo` pasos de la del centro. La pista es una elipse
// (radio en x, profundidad en z) y cada portada va tangente a ella; el paso vertical la sube un
// poco por cada lugar hacia la derecha.
export function poseDe(relativo, { radio, profundidad, paso }) {
  const theta = relativo * PASO_THETA;
  const sen = Math.sin(theta);
  const cos = Math.cos(theta);
  return {
    x: sen * radio,
    y: relativo * paso,
    z: cos * profundidad - DESFASE_Z,
    rotY: Math.atan2(profundidad * sen, radio * cos),
    rotX: relativo * -0.01,
    // pasado un cuarto de vuelta la portada mira hacia atrás: no se dibuja
    deFrente: Math.abs(theta) < Math.PI / 2,
  };
}

// phase += (target - phase) · (1 - e^(-13·dt)), con dt acotado: tras una pausa (pestaña
// oculta, sección fuera de pantalla) no pega un salto.
export function amortiguar(actual, objetivo, dt, rigidez = RIGIDEZ) {
  const paso = limitar(dt, 0, DT_MAX);
  return actual + (objetivo - actual) * (1 - Math.exp(-rigidez * paso));
}

// La curvatura sube de 0,30 a 0,42 con la velocidad (en hitos por segundo).
export function bendDe(velocidad, tope = 2.4) {
  const t = limitar(Math.abs(velocidad) / tope, 0, 1);
  return BEND_BASE + (BEND_MAX - BEND_BASE) * t;
}

// Inclinación contenida según la velocidad: la cinta "se recuesta" hacia donde va.
export function inclinacionDe(velocidad, tope = 0.09) {
  return limitar(velocidad * 0.035, -tope, tope);
}

export const faseDeProgreso = (progreso, total) => limitar(progreso, 0, 1) * Math.max(0, total - 1);
export const progresoDeFase = (fase, total) => (total > 1 ? limitar(fase / (total - 1), 0, 1) : 0);
export const hitoCercano = (fase, total) => limitar(Math.round(fase), 0, Math.max(0, total - 1));

// En qué hito asentar la cinta cuando el scroll se detiene. Manda la intención: si desde el
// último hito asentado se avanzó más que `umbral` (un giro de rueda, un deslizamiento corto),
// se va al siguiente en esa dirección en vez de volver. Si se recorrió más de un hito, al más
// cercano.
export function hitoDestino(fase, asentado, total, umbral = 0.14) {
  const d = fase - asentado;
  let destino = asentado;
  if (Math.abs(d) >= 1) destino = Math.round(fase);
  else if (d > umbral) destino = asentado + 1;
  else if (d < -umbral) destino = asentado - 1;
  return limitar(destino, 0, Math.max(0, total - 1));
}

// ¿El punto (x, y) cae dentro del cuadrilátero convexo `q` ([[x, y] × 4], en orden)?
export function dentroDeCuadrilatero(q, x, y) {
  let signo = 0;
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = q[i];
    const [bx, by] = q[(i + 1) % 4];
    const cruz = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    if (Math.abs(cruz) < 1e-9) continue;
    if (signo === 0) signo = Math.sign(cruz);
    else if (Math.sign(cruz) !== signo) return false;
  }
  return true;
}

// Un impulso de entrada (rueda, tecla) nunca mueve más que `maximo`: sin saltos.
export const impulsoLimitado = (delta, maximo) => limitar(delta, -maximo, maximo);

// Arrastre → cuántos hitos avanzar. Hacia la izquierda avanza; hacia abajo también. Gana el eje
// con más recorrido, para que un gesto en diagonal no sume dos veces.
export function hitosDeArrastre(dx, dy, anchoVista, altoVista) {
  const horizontal = -dx / Math.max(1, anchoVista * 0.42);
  const vertical = dy / Math.max(1, altoVista * 0.5);
  return Math.abs(horizontal) >= Math.abs(vertical) ? horizontal : vertical;
}

// Ancho y alto visibles a una profundidad `z` del mundo, con la cámara del reel.
export function vistaEn(z, aspecto) {
  const alto = 2 * (CAMARA.z - z) * Math.tan((CAMARA.fov * Math.PI) / 360);
  return { ancho: alto * aspecto, alto };
}

// Medidas de la pista para el tamaño de la vista: la portada del centro ocupa el 37 % del ancho
// en escritorio y el 77 % en celular; el radio se abre con la pantalla y en pantallas angostas
// las vecinas se recortan a los costados (el paso vertical sigue bajo, no se apilan).
export function medidasPista(anchoPx, altoPx, movil = false) {
  const aspecto = anchoPx / Math.max(1, altoPx);
  // profundidad generosa: las vecinas se alejan y giran de verdad (no un carrusel chato)
  const profundidad = movil ? 2.2 : 3.2;
  const zCentro = profundidad - DESFASE_Z;
  const vista = vistaEn(zCentro, aspecto);
  const fraccion = movil ? FRACCION_CENTRAL.movil : FRACCION_CENTRAL.escritorio;
  let escala = (vista.ancho * fraccion) / ANCHO_PLANO;
  // en pantallas muy anchas y bajas la portada no puede pasarse del 62 % del alto
  escala = Math.min(escala, (vista.alto * 0.62) / ALTO_PLANO);
  const anchoPortada = ANCHO_PLANO * escala;
  const radio = (anchoPortada * (movil ? SEPARACION.movil : SEPARACION.escritorio)) / Math.sin(PASO_THETA);
  return { escala, radio, profundidad, paso: PASO_VERTICAL * escala * (movil ? 0.55 : 1), aspecto };
}

// Alto de scroll (en px) que recorre un hito, y progreso (0–1) al que queda cada uno.
export const pasoDeScroll = (altoVista, movil = false) => altoVista * (movil ? 0.6 : 0.7);
export const progresoDeHito = (indice, total) => progresoDeFase(indice, total);
