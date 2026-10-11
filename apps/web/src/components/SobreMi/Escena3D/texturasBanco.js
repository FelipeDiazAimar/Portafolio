// Texturas del banco de trabajo de 2025, dibujadas en canvas 2D (no importan three).

// Tapete de corte antiestático: verde oscuro con cuadrícula, marcas de medida y
// un rótulo en la esquina.
export function dibujarTapete(ctx, w, h) {
  ctx.fillStyle = '#0d2a22';
  ctx.fillRect(0, 0, w, h);
  const paso = w / 32;
  for (let i = 0; i <= 32; i += 1) {
    const x = i * paso;
    ctx.strokeStyle = i % 4 === 0 ? 'rgba(160, 235, 205, 0.4)' : 'rgba(160, 235, 205, 0.15)';
    ctx.lineWidth = i % 4 === 0 ? 3 : 1.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let j = 0; j <= Math.round(h / paso); j += 1) {
    const y = j * paso;
    ctx.strokeStyle = j % 4 === 0 ? 'rgba(160, 235, 205, 0.4)' : 'rgba(160, 235, 205, 0.15)';
    ctx.lineWidth = j % 4 === 0 ? 3 : 1.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(200, 245, 225, 0.55)';
  ctx.font = `600 ${h * 0.045}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText('ESD SAFE  ·  TALLER', w * 0.03, h * 0.95);
  ctx.textAlign = 'right';
  ctx.fillText('0    10    20    30 cm', w * 0.97, h * 0.95);
}

// Pantalla de la notebook en reparación: diagnóstico con barras de estado.
export function dibujarDiagnostico(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0a1424');
  g.addColorStop(1, '#060c18');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#10213d';
  ctx.fillRect(0, 0, w, h * 0.11);
  ctx.fillStyle = '#e8f0ff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = `700 ${h * 0.058}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillText('DIAGNÓSTICO DE HARDWARE', w * 0.04, h * 0.055);
  [['#ff5f57', 0.93], ['#febc2e', 0.955], ['#28c840', 0.98]].forEach(([color, x]) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(w * x, h * 0.055, h * 0.016, 0, Math.PI * 2);
    ctx.fill();
  });

  const filas = [
    ['CPU', 0.92, '#3de0c0', 'OK'],
    ['MEMORIA', 0.78, '#3de0c0', 'OK'],
    ['DISCO SSD', 0.64, '#ffc247', 'REVISAR'],
    ['BATERÍA', 0.38, '#ff6a5a', 'CAMBIAR'],
    ['VENTILADOR', 0.86, '#3de0c0', 'OK'],
  ];
  filas.forEach(([nombre, valor, color, estado], i) => {
    const y = h * (0.22 + i * 0.15);
    ctx.fillStyle = '#c9d6f2';
    ctx.font = `600 ${h * 0.05}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(nombre, w * 0.05, y);
    ctx.fillStyle = 'rgba(160, 190, 255, 0.16)';
    ctx.beginPath();
    ctx.roundRect(w * 0.3, y - h * 0.022, w * 0.46, h * 0.044, h * 0.03);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(w * 0.3, y - h * 0.022, w * 0.46 * valor, h * 0.044, h * 0.03);
    ctx.fill();
    ctx.textAlign = 'right';
    ctx.font = `700 ${h * 0.047}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillText(estado, w * 0.95, y);
  });
}

// Placa en reparación: PCB verde con pistas doradas y puntos de soldadura.
export function dibujarPlacaReparacion(ctx, w, h) {
  ctx.fillStyle = '#0e5a3c';
  ctx.fillRect(0, 0, w, h);
  let s = 31;
  const r = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < 90; i += 1) {
    const x0 = r() * w;
    const y0 = r() * h;
    const largo = 20 + r() * 110;
    const horizontal = r() < 0.5;
    const sentido = r() < 0.5 ? 1 : -1;
    const x1 = horizontal ? x0 + largo * sentido : x0;
    const y1 = horizontal ? y0 : y0 + largo * sentido;
    ctx.strokeStyle = `rgba(214, 178, 76, ${0.35 + r() * 0.4})`;
    ctx.lineWidth = 3 + r() * 2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x1 + 14 * sentido, y1 + 14);
    ctx.stroke();
    ctx.fillStyle = 'rgba(230, 200, 110, 0.7)';
    ctx.beginPath();
    ctx.arc(x0, y0, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, w - 20, h - 20);
  ctx.font = `600 ${h * 0.07}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText('REPAIR-01', w * 0.05, h * 0.93);
}
