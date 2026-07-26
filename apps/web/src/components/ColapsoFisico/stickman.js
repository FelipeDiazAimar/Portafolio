export const ALTO_STICKMAN = 96;

// Qué tan cerca del cuerpo queda la escoba al final del retorno, y cuánto se
// aleja en el empuje.
const ALCANCE_MINIMO = 24;
const AMPLITUD_BARRIDO = 58;
// Fracción del ciclo que dura el empuje. El resto es el retorno, que va más
// rápido porque la escoba vuelve levantada y sin peso.
const PROPORCION_EMPUJE = 0.68;
// Medio ancho del cabezal (un palo de piso, no una escoba de cerdas).
const MEDIO_CABEZAL = 15;
// Desvío del codo respecto del punto medio hombro-mano. Es un vector fijo
// hacia ABAJO y ATRÁS, no una perpendicular al brazo: con la perpendicular
// la dirección del codo dependía de dónde cayera la mano y terminaba
// apuntando hacia adelante o hacia arriba.
const DESVIO_CODO_X = -7;
const DESVIO_CODO_Y = 10;

// Posición dentro del ciclo de barrido, 0..1.
function faseDelCiclo(paso) {
  return paso - Math.floor(paso);
}

// True mientras la escoba está apoyada empujando. En el retorno se levanta:
// si arrastrara de vuelta desharía lo que acaba de juntar.
export function estaEmpujando(paso) {
  return faseDelCiclo(paso) < PROPORCION_EMPUJE;
}

// Un ciclo de barrido: empuje largo hacia adelante y retorno rápido, como
// alguien que arrastra el palo y lo vuelve a traer.
function curvaBarrido(paso) {
  const t = faseDelCiclo(paso);
  if (t < PROPORCION_EMPUJE) {
    // Empuje: arranca suave, acelera en el medio y frena al final del trazo.
    const p = t / PROPORCION_EMPUJE;
    return p * p * (3 - 2 * p);
  }
  // Retorno: lineal y más corto en tiempo.
  return 1 - (t - PROPORCION_EMPUJE) / (1 - PROPORCION_EMPUJE);
}

// Offset horizontal de la punta del palo respecto de la `x` del stickman. Lo
// usan el dibujo Y el cuerpo físico: si cada uno lo calculara por su cuenta,
// lo que se ve barriendo y lo que empuja se desincronizarían.
export function desplazamientoEscoba(paso, barriendo) {
  if (!barriendo) return ALCANCE_MINIMO;
  return ALCANCE_MINIMO + curvaBarrido(paso) * AMPLITUD_BARRIDO;
}

// Brazo en dos tramos, con el codo caído hacia atrás.
function trazarBrazo(ctx, hombroX, hombroY, manoX, manoY, desvioX, desvioY) {
  const codoX = (hombroX + manoX) / 2 + desvioX;
  const codoY = (hombroY + manoY) / 2 + desvioY;
  ctx.moveTo(hombroX, hombroY);
  ctx.lineTo(codoX, codoY);
  ctx.lineTo(manoX, manoY);
}

// Stickman procedural: sólo líneas, sin sprites ni assets.
export function dibujarStickman(ctx, { x, suelo, paso, barriendo }, color) {
  const alcance = desplazamientoEscoba(paso, barriendo);
  const empujando = barriendo && estaEmpujando(paso);
  const cabezaY = suelo - ALTO_STICKMAN;
  const hombroY = suelo - ALTO_STICKMAN * 0.74;
  const caderaY = suelo - ALTO_STICKMAN * 0.44;
  const balanceo = Math.sin(paso * Math.PI * 2) * 10;

  const hombroX = x + 3;
  const puntaX = x + alcance;
  const puntaY = suelo - (empujando ? 4 : 12);

  // El palo queda definido por sus DOS extremos, en vez de por un eje que se
  // extiende: así no puede pasarse de largo. Arriba llega apenas por encima
  // del hombro, que es donde termina un palo de piso real.
  const topeX = x + 8;
  const topeY = hombroY - 8;

  // Las dos manos agarran cerca del tope, a alturas distintas. El palo
  // sobresale un poco por encima de la mano de arriba.
  const manoAltaX = topeX + (puntaX - topeX) * 0.14;
  const manoAltaY = topeY + (puntaY - topeY) * 0.14;
  const manoBajaX = topeX + (puntaX - topeX) * 0.42;
  const manoBajaY = topeY + (puntaY - topeY) * 0.42;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Cabeza, torso y piernas.
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x, cabezaY, 8.5, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x, cabezaY + 8.5);
  ctx.lineTo(x + 4, caderaY);
  ctx.moveTo(x + 4, caderaY);
  ctx.lineTo(x - balanceo, suelo);
  ctx.moveTo(x + 4, caderaY);
  ctx.lineTo(x + balanceo, suelo);
  ctx.stroke();

  // Brazos con codo. Los dos codos caen hacia abajo y atrás; el de la mano
  // baja cuelga un poco más.
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  trazarBrazo(ctx, hombroX, hombroY, manoAltaX, manoAltaY, DESVIO_CODO_X, DESVIO_CODO_Y);
  trazarBrazo(
    ctx,
    hombroX,
    hombroY + 9,
    manoBajaX,
    manoBajaY,
    DESVIO_CODO_X + 2,
    DESVIO_CODO_Y + 3
  );
  ctx.stroke();

  // Palo entero, del tope al piso.
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(topeX, topeY);
  ctx.lineTo(puntaX, puntaY);
  ctx.stroke();

  // Cabezal: una sola barra maciza perpendicular al palo. Es un palo de
  // piso, no una escoba: sin cerdas.
  const largoPalo = Math.hypot(puntaX - topeX, puntaY - topeY) || 1;
  const perpX = -(puntaY - topeY) / largoPalo;
  const perpY = (puntaX - topeX) / largoPalo;
  ctx.lineWidth = 5.5;
  ctx.beginPath();
  ctx.moveTo(puntaX - perpX * MEDIO_CABEZAL, puntaY - perpY * MEDIO_CABEZAL);
  ctx.lineTo(puntaX + perpX * MEDIO_CABEZAL, puntaY + perpY * MEDIO_CABEZAL);
  ctx.stroke();

  ctx.restore();
}
