// Dibuja la cara de una placa madre en un lienzo: fondo oscuro y pistas de
// circuito en cian, como líneas ortogonales con codos a 45° y puntos de unión.
const FONDO = '#08111d';
const PISTA = '#2fb8d8';

// Generador determinista (misma placa siempre).
function azar(semilla) {
  let s = semilla;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function dibujarPlaca(ctx, w, h) {
  ctx.fillStyle = FONDO;
  ctx.fillRect(0, 0, w, h);

  // Cuadrícula fina de fondo.
  ctx.strokeStyle = 'rgba(47, 184, 216, 0.07)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += w / 24) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += h / 24) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Pistas: segmentos horizontales y verticales con un codo a 45°.
  const r = azar(7);
  ctx.strokeStyle = PISTA;
  ctx.fillStyle = PISTA;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < 46; i += 1) {
    const x0 = Math.round(r() * 22) * (w / 24) + w / 48;
    const y0 = Math.round(r() * 22) * (h / 24) + h / 48;
    const largo = (2 + Math.floor(r() * 5)) * (w / 24);
    const horizontal = r() < 0.5;
    const sentido = r() < 0.5 ? 1 : -1;
    const x1 = horizontal ? x0 + largo * sentido : x0;
    const y1 = horizontal ? y0 : y0 + largo * sentido;
    const codo = (w / 24) * 0.9;
    ctx.globalAlpha = 0.35 + r() * 0.5;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x1 + (horizontal ? codo : codo) * 0.7, y1 + codo * 0.7 * sentido);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x0, y0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x1 + codo * 0.7, y1 + codo * 0.7 * sentido, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
