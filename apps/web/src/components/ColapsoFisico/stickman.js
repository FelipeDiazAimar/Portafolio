export const ALTO_STICKMAN = 96;

// Qué tan cerca del cuerpo queda la escoba al final del retorno, y cuánto se
// aleja en el empuje.
const ALCANCE_MINIMO = 20;
const AMPLITUD_BARRIDO = 52;
// Fracción del ciclo que dura el empuje. El resto es el retorno, que va más
// rápido porque la escoba vuelve levantada y sin peso.
const PROPORCION_EMPUJE = 0.68;

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
// alguien que arrastra la escoba y la vuelve a traer.
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

// Offset horizontal de la punta de la escoba respecto de la `x` del
// stickman. Lo usan el dibujo Y el cuerpo físico de la escoba: si cada uno
// lo calculara por su cuenta, lo que se ve barriendo y lo que empuja se
// desincronizarían.
export function desplazamientoEscoba(paso, barriendo) {
  if (!barriendo) return ALCANCE_MINIMO;
  return ALCANCE_MINIMO + curvaBarrido(paso) * AMPLITUD_BARRIDO;
}

// Stickman procedural: sólo líneas, sin sprites ni assets.
export function dibujarStickman(ctx, { x, suelo, paso, barriendo }, color) {
  const alcance = desplazamientoEscoba(paso, barriendo);
  const empujando = barriendo && estaEmpujando(paso);
  const cabezaY = suelo - ALTO_STICKMAN;
  const hombroY = suelo - ALTO_STICKMAN * 0.72;
  const caderaY = suelo - ALTO_STICKMAN * 0.42;
  const balanceo = Math.sin(paso * Math.PI * 2) * 9;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2.5;

  // Cabeza y torso, apenas inclinado hacia la escoba.
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

  // El palo va de las manos al cabezal. En el retorno la escoba se levanta
  // unos px del piso, que es lo que hace legible el gesto de barrer.
  const manoX = x + 4 + alcance * 0.34;
  const manoY = hombroY + 5;
  const puntaX = x + alcance;
  const puntaY = suelo - (empujando ? 6 : 14);

  ctx.beginPath();
  ctx.moveTo(manoX, manoY);
  ctx.lineTo(puntaX, puntaY);
  ctx.stroke();

  // Los dos brazos agarran el palo en puntos distintos, como en una escoba real.
  ctx.beginPath();
  ctx.moveTo(x + 2, hombroY);
  ctx.lineTo(manoX, manoY);
  ctx.moveTo(x + 2, hombroY + 6);
  ctx.lineTo(manoX + (puntaX - manoX) * 0.3, manoY + (puntaY - manoY) * 0.3);
  ctx.stroke();

  // Cabezal: una barra perpendicular al palo más un abanico de cerdas. Sin
  // esto la escoba se leía como una raya suelta (o como una tercera pierna).
  const largo = Math.hypot(puntaX - manoX, puntaY - manoY) || 1;
  const dirX = (puntaX - manoX) / largo;
  const dirY = (puntaY - manoY) / largo;
  const perpX = -dirY;
  const perpY = dirX;
  const medioCabezal = 10;

  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(puntaX - perpX * medioCabezal, puntaY - perpY * medioCabezal);
  ctx.lineTo(puntaX + perpX * medioCabezal, puntaY + perpY * medioCabezal);
  ctx.stroke();

  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let i = -2; i <= 2; i += 1) {
    const proporcion = i / 2;
    const baseX = puntaX + perpX * medioCabezal * proporcion;
    const baseY = puntaY + perpY * medioCabezal * proporcion;
    ctx.moveTo(baseX, baseY);
    ctx.lineTo(baseX + dirX * 11 + perpX * proporcion * 5, baseY + dirY * 11);
  }
  ctx.stroke();

  ctx.restore();
}
