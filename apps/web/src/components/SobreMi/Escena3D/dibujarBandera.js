// Dibuja la bandera argentina en un lienzo: tres franjas (celeste, blanca,
// celeste) y un sol simplificado en el centro (disco con rayos alternados).
const CELESTE = '#74acdf';
const BLANCO = '#ffffff';
const SOL = '#f6b40e';
const BORDE_SOL = '#b9770e';

export function dibujarBandera(ctx, w, h) {
  const franja = h / 3;
  ctx.fillStyle = CELESTE;
  ctx.fillRect(0, 0, w, franja);
  ctx.fillStyle = BLANCO;
  ctx.fillRect(0, franja, w, franja);
  ctx.fillStyle = CELESTE;
  ctx.fillRect(0, franja * 2, w, franja);

  const cx = w / 2;
  const cy = h / 2;
  const radio = h * 0.085;
  const rayos = 32;
  ctx.fillStyle = SOL;
  ctx.strokeStyle = BORDE_SOL;
  ctx.lineWidth = 2;
  for (let i = 0; i < rayos; i += 1) {
    // Rayos alternados: largos y rectos, cortos y más anchos.
    const largo = i % 2 === 0 ? h * 0.075 : h * 0.05;
    const ancho = i % 2 === 0 ? 0.05 : 0.075;
    const angulo = (i / rayos) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angulo - ancho) * radio, cy + Math.sin(angulo - ancho) * radio);
    ctx.lineTo(cx + Math.cos(angulo) * (radio + largo), cy + Math.sin(angulo) * (radio + largo));
    ctx.lineTo(cx + Math.cos(angulo + ancho) * radio, cy + Math.sin(angulo + ancho) * radio);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, radio, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}
