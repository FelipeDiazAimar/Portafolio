// Dibuja la bandera argentina en un lienzo: tres franjas (celeste, blanca,
// celeste) y un sol simplificado en el centro (disco con rayos alternados). Con
// `vertical` las franjas van de costado (una al lado de la otra), para una
// bandera colgada a lo largo.
const CELESTE = '#74acdf';
const BLANCO = '#ffffff';
const SOL = '#f6b40e';
const BORDE_SOL = '#b9770e';

export function dibujarBandera(ctx, w, h, vertical = false) {
  const franja = (vertical ? w : h) / 3;
  const franjaEn = (i) => (vertical ? [franja * i, 0, franja, h] : [0, franja * i, w, franja]);
  ctx.fillStyle = CELESTE;
  ctx.fillRect(...franjaEn(0));
  ctx.fillStyle = BLANCO;
  ctx.fillRect(...franjaEn(1));
  ctx.fillStyle = CELESTE;
  ctx.fillRect(...franjaEn(2));

  const cx = w / 2;
  const cy = h / 2;
  // El sol se mide con el lado corto, así no se deforma en una bandera alargada.
  const lado = Math.min(w, h);
  const radio = lado * 0.085;
  const rayos = 32;
  ctx.fillStyle = SOL;
  ctx.strokeStyle = BORDE_SOL;
  ctx.lineWidth = 2;
  for (let i = 0; i < rayos; i += 1) {
    // Rayos alternados: largos y rectos, cortos y más anchos.
    const largo = i % 2 === 0 ? lado * 0.075 : lado * 0.05;
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
