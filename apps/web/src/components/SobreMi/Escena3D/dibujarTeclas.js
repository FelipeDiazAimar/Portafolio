import { DISPOSICION, COLUMNAS } from './tecladoQwerty.js';

// Dibuja las leyendas del teclado en un lienzo transparente que se pone como
// una lámina sobre las teclas: una celda por tecla, en el mismo orden que
// `DISPOSICION` (fila 0 arriba, hacia el fondo de la notebook).
export function dibujarTeclas(ctx, w, h, color = '#bcd2ff') {
  ctx.clearRect(0, 0, w, h);
  const celdaAncho = w / COLUMNAS;
  const celdaAlto = h / DISPOSICION.length;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  DISPOSICION.forEach((fila, f) => {
    fila.forEach((tecla, c) => {
      if (!tecla) return;
      const larga = tecla.length > 1;
      ctx.font = `600 ${larga ? 22 : 40}px "Segoe UI", system-ui, sans-serif`;
      ctx.fillText(larga ? tecla : tecla.toUpperCase(), (c + 0.5) * celdaAncho, (f + 0.5) * celdaAlto + 2);
    });
  });
}
