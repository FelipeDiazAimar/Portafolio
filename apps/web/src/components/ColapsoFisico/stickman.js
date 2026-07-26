export const ALTO_STICKMAN = 96;

// Qué tan cerca del cuerpo queda la escoba al final del retorno, y cuánto se
// aleja en el empuje.
const ALCANCE_MINIMO = 24;
const AMPLITUD_BARRIDO = 58;
// Fracción del ciclo que dura el empuje. El resto es el retorno, que va más
// rápido porque la escoba vuelve levantada y sin peso.
const PROPORCION_EMPUJE = 0.68;
// Cuánto sigue el palo por encima de la mano de arriba.
const SOBRANTE_PALO = 28;
// Medio ancho del cabezal (un palo de piso, no una escoba de cerdas).
const MEDIO_CABEZAL = 15;
// Cuánto se despegan los codos de la línea hombro-mano.
const CURVATURA_CODO = 11;

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

// Brazo en dos tramos con el codo salido hacia afuera, en vez de una recta
// del hombro a la mano.
function trazarBrazo(ctx, hombroX, hombroY, manoX, manoY, curvatura) {
  const dx = manoX - hombroX;
  const dy = manoY - hombroY;
  const largo = Math.hypot(dx, dy) || 1;
  const perpX = -dy / largo;
  const perpY = dx / largo;
  const codoX = (hombroX + manoX) / 2 + perpX * curvatura;
  const codoY = (hombroY + manoY) / 2 + perpY * curvatura;
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

  // Eje del palo: apunta desde la punta (en el piso) hacia arriba y atrás.
  const ejeX = hombroX - 12 - puntaX;
  const ejeY = hombroY - 34 - puntaY;
  const largoEje = Math.hypot(ejeX, ejeY) || 1;
  const dirX = ejeX / largoEje;
  const dirY = ejeY / largoEje;

  // Las dos manos agarran el palo a alturas distintas, y el palo sigue de
  // largo por encima de la mano de arriba.
  const manoBajaX = puntaX + dirX * largoEje * 0.46;
  const manoBajaY = puntaY + dirY * largoEje * 0.46;
  const manoAltaX = puntaX + dirX * largoEje * 0.8;
  const manoAltaY = puntaY + dirY * largoEje * 0.8;
  const topeX = puntaX + dirX * (largoEje + SOBRANTE_PALO);
  const topeY = puntaY + dirY * (largoEje + SOBRANTE_PALO);

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

  // Brazos con codo. El de abajo dobla al revés que el de arriba, que es
  // como quedan las manos cuando una agarra más abajo que la otra.
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  trazarBrazo(ctx, hombroX, hombroY, manoAltaX, manoAltaY, CURVATURA_CODO);
  trazarBrazo(ctx, hombroX, hombroY + 9, manoBajaX, manoBajaY, -CURVATURA_CODO);
  ctx.stroke();

  // Palo entero, del tope al piso.
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(topeX, topeY);
  ctx.lineTo(puntaX, puntaY);
  ctx.stroke();

  // Cabezal: una sola barra maciza perpendicular al palo. Es un palo de
  // piso, no una escoba: sin cerdas.
  const perpX = -dirY;
  const perpY = dirX;
  ctx.lineWidth = 5.5;
  ctx.beginPath();
  ctx.moveTo(puntaX - perpX * MEDIO_CABEZAL, puntaY - perpY * MEDIO_CABEZAL);
  ctx.lineTo(puntaX + perpX * MEDIO_CABEZAL, puntaY + perpY * MEDIO_CABEZAL);
  ctx.stroke();

  ctx.restore();
}
