// Logos dibujados en canvas para la constelación de "Hoy". Sólo pintan píxeles.
import { PARTES } from './simboloUtn.js';

// Símbolo de la UTN: dos barras y dos medios anillos, a partir de la misma
// geometría que usa la bandera de 2022. `lado` es el alto del símbolo en píxeles.
export function dibujarLogoUtn(ctx, w, h, color = '#f2f6ff') {
  ctx.clearRect(0, 0, w, h);
  const lado = h * 0.9;
  const px = (x) => w / 2 + x * lado;
  const py = (y) => h / 2 - y * lado;
  ctx.fillStyle = color;
  PARTES.forEach((parte) => {
    if (parte.tipo === 'rect') {
      ctx.fillRect(px(parte.x0), py(parte.y1), (parte.x1 - parte.x0) * lado, (parte.y1 - parte.y0) * lado);
      return;
    }
    // El eje y de la geometría va hacia arriba y el del canvas hacia abajo: la mitad
    // "inferior" del círculo (y menor) es la de ángulos 0 a π del canvas.
    const [desde, hasta] = parte.mitad === 'inferior' ? [0, Math.PI] : [Math.PI, Math.PI * 2];
    ctx.beginPath();
    ctx.arc(px(parte.cx), py(parte.cy), parte.r1 * lado, desde, hasta);
    ctx.arc(px(parte.cx), py(parte.cy), parte.r0 * lado, hasta, desde, true);
    ctx.closePath();
    ctx.fill();
  });
}

// Logo de SAP: el rombo azul con degradado y las tres letras.
export function dibujarLogoSap(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, w * 0.4, h);
  g.addColorStop(0, '#00b8f1');
  g.addColorStop(1, '#0070f2');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w, 0);
  ctx.lineTo(w * 0.62, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${h * 0.62}px -apple-system, "Segoe UI", Arial, sans-serif`;
  ctx.fillText('SAP', w * 0.38, h * 0.54);
}
