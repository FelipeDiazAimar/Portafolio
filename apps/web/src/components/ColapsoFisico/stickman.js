export const ALTO_STICKMAN = 90;

// Offset horizontal de la punta de la escoba respecto de la `x` del
// stickman. Lo usan el dibujo Y el cuerpo físico de la escoba: si cada uno
// lo calculara por su cuenta, lo que se ve barriendo y lo que empuja se
// desincronizarían.
export function desplazamientoEscoba(paso, barriendo) {
  // Los brazos estiran y encogen al ritmo de la caminata (mismo `paso` que
  // mueve las piernas, al doble de frecuencia).
  return barriendo ? 30 + Math.sin(paso * 2) * 26 : 22;
}

// Stickman procedural: sólo líneas, sin sprites ni assets.
export function dibujarStickman(ctx, { x, suelo, paso, barriendo }, color) {
  const cabeza = suelo - ALTO_STICKMAN;
  const balanceo = Math.sin(paso) * 12;
  const puntaX = x + desplazamientoEscoba(paso, barriendo);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.arc(x, cabeza, 9, 0, Math.PI * 2);
  ctx.moveTo(x, cabeza + 9);
  ctx.lineTo(x, suelo - 34);
  ctx.moveTo(x, suelo - 34);
  ctx.lineTo(x - balanceo, suelo);
  ctx.moveTo(x, suelo - 34);
  ctx.lineTo(x + balanceo, suelo);
  ctx.stroke();

  // Brazos -> palo -> cerdas, en un solo trazo continuo.
  ctx.beginPath();
  ctx.moveTo(x, cabeza + 24);
  ctx.lineTo(puntaX, suelo - 30);
  ctx.lineTo(puntaX + 8, suelo);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(puntaX - 4, suelo);
  ctx.lineTo(puntaX + 20, suelo);
  ctx.stroke();

  ctx.restore();
}
