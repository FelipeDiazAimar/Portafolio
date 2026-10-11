// Texturas del banco de trabajo de 2025, dibujadas en canvas 2D (no importan three).

// Tapete de corte antiestático con cuadrícula, marcas de medida y un rótulo. Con
// `claro` usa una variante verde claro (para el tema claro del sitio).
export function dibujarTapete(ctx, w, h, claro = false) {
  ctx.fillStyle = claro ? '#8fd3b6' : '#0d2a22';
  ctx.fillRect(0, 0, w, h);
  const paso = w / 32;
  const trazo = (principal) =>
    claro
      ? principal ? 'rgba(20, 90, 60, 0.45)' : 'rgba(20, 90, 60, 0.18)'
      : principal ? 'rgba(160, 235, 205, 0.4)' : 'rgba(160, 235, 205, 0.15)';
  for (let i = 0; i <= 32; i += 1) {
    ctx.strokeStyle = trazo(i % 4 === 0);
    ctx.lineWidth = i % 4 === 0 ? 3 : 1.5;
    ctx.beginPath();
    ctx.moveTo(i * paso, 0);
    ctx.lineTo(i * paso, h);
    ctx.stroke();
  }
  for (let j = 0; j <= Math.round(h / paso); j += 1) {
    ctx.strokeStyle = trazo(j % 4 === 0);
    ctx.lineWidth = j % 4 === 0 ? 3 : 1.5;
    ctx.beginPath();
    ctx.moveTo(0, j * paso);
    ctx.lineTo(w, j * paso);
    ctx.stroke();
  }
  ctx.fillStyle = claro ? 'rgba(10, 70, 45, 0.7)' : 'rgba(200, 245, 225, 0.55)';
  ctx.font = `600 ${h * 0.045}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText('ESD SAFE  ·  TALLER', w * 0.03, h * 0.95);
  ctx.textAlign = 'right';
  ctx.fillText('0    10    20    30 cm', w * 0.97, h * 0.95);
}

// Pantalla de la notebook en reparación: diagnóstico con barras de estado.
export function dibujarDiagnostico(ctx, w, h, claro = false) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, claro ? '#f4f7ff' : '#0a1424');
  g.addColorStop(1, claro ? '#e4ebf8' : '#060c18');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = claro ? '#d3def5' : '#10213d';
  ctx.fillRect(0, 0, w, h * 0.11);
  ctx.fillStyle = claro ? '#14203a' : '#e8f0ff';
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
    ['CPU', 0.92, '#1fb996', 'OK'],
    ['MEMORIA', 0.78, '#1fb996', 'OK'],
    ['DISCO SSD', 0.64, '#e9a21d', 'REVISAR'],
    ['BATERÍA', 0.38, '#e5483a', 'CAMBIAR'],
    ['VENTILADOR', 0.86, '#1fb996', 'OK'],
  ];
  filas.forEach(([nombre, valor, color, estado], i) => {
    const y = h * (0.22 + i * 0.15);
    ctx.fillStyle = claro ? '#2a3a5c' : '#c9d6f2';
    ctx.font = `600 ${h * 0.05}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(nombre, w * 0.05, y);
    ctx.fillStyle = claro ? 'rgba(40, 70, 140, 0.14)' : 'rgba(160, 190, 255, 0.16)';
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

// Placa en reparación: PCB verde con máscara de soldadura, pistas de cobre, vías,
// serigrafía blanca y marcas de zonas. Los componentes van encima como objetos.
export function dibujarPlacaReparacion(ctx, w, h) {
  const base = ctx.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, '#0d6a45');
  base.addColorStop(1, '#09523a');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  let s = 31;
  const r = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < 200; i += 1) {
    const x0 = r() * w;
    const y0 = r() * h;
    const largo = 24 + r() * 130;
    const horizontal = r() < 0.5;
    const sentido = r() < 0.5 ? 1 : -1;
    const x1 = horizontal ? x0 + largo * sentido : x0;
    const y1 = horizontal ? y0 : y0 + largo * sentido;
    ctx.strokeStyle = `rgba(30, 150, 100, ${0.5 + r() * 0.4})`;
    ctx.lineWidth = 3 + r() * 3;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x1 + 16 * sentido, y1 + 16);
    ctx.stroke();
    // Vías: anillo dorado con agujero.
    ctx.fillStyle = 'rgba(224, 188, 90, 0.9)';
    ctx.beginPath();
    ctx.arc(x0, y0, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#052a1d';
    ctx.beginPath();
    ctx.arc(x0, y0, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Serigrafía.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 3;
  ctx.strokeRect(12, 12, w - 24, h - 24);
  ctx.lineWidth = 2;
  ctx.font = `700 ${h * 0.058}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('REPAIR-01  REV 2.3', w * 0.05, h * 0.085);
  ctx.font = `600 ${h * 0.04}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillText('C12', w * 0.07, h * 0.95);
  ctx.fillText('R7', w * 0.45, h * 0.95);
}

// Pantalla del multímetro: LCD verdoso con los dígitos grandes, la unidad y el modo.
export function dibujarLcd(ctx, w, h, valor) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#b6d5a0');
  g.addColorStop(1, '#9bbf86');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(30, 55, 30, 0.12)';
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
  ctx.fillStyle = '#16301a';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  ctx.font = `700 ${h * 0.7}px "Cascadia Mono", Consolas, "Courier New", monospace`;
  ctx.fillText(valor, w * 0.8, h * 0.52);
  ctx.textAlign = 'left';
  ctx.font = `700 ${h * 0.3}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillText('V', w * 0.82, h * 0.6);
  ctx.font = `600 ${h * 0.16}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillText('DC', w * 0.04, h * 0.14);
  ctx.fillText('AUTO', w * 0.04, h * 0.88);
  ctx.fillText('HOLD', w * 0.8, h * 0.14);
}

// Selector rotativo del multímetro visto desde arriba: círculo oscuro con las
// posiciones impresas alrededor (el puntero lo pone un objeto aparte).
export function dibujarSelector(ctx, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const r = w / 2;
  ctx.fillStyle = '#15171c';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  const etiquetas = ['OFF', 'V~', 'V=', 'mV', 'Ω', 'A=', 'A~', 'hFE', 'Hz', '♪'];
  ctx.fillStyle = '#f5f1dc';
  ctx.strokeStyle = '#f5f1dc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${r * 0.12}px "Segoe UI", system-ui, sans-serif`;
  etiquetas.forEach((texto, i) => {
    const a = -Math.PI / 2 + ((i - 0.5) / etiquetas.length) * Math.PI * 2 + 0.3;
    ctx.fillText(texto, cx + Math.cos(a) * r * 0.82, cy + Math.sin(a) * r * 0.82);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62);
    ctx.lineTo(cx + Math.cos(a) * r * 0.7, cy + Math.sin(a) * r * 0.7);
    ctx.stroke();
  });
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.97, 0, Math.PI * 2);
  ctx.stroke();
}

// Pantalla del teléfono en reparación: fondo degradado, hora y aviso de modo
// diagnóstico con iconos de apps.
export function dibujarPantallaTelefono(ctx, w, h, claro = false) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, claro ? '#3a6fe0' : '#14306e');
  g.addColorStop(1, claro ? '#7b5cf0' : '#3a1c7a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${h * 0.12}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillText('9:41', w / 2, h * 0.2);
  ctx.font = `500 ${h * 0.035}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillText('Sábado 11 de octubre', w / 2, h * 0.29);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.beginPath();
  ctx.roundRect(w * 0.1, h * 0.42, w * 0.8, h * 0.2, h * 0.025);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${h * 0.04}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillText('Modo diagnóstico', w / 2, h * 0.49);
  ctx.font = `500 ${h * 0.03}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillText('Pantalla  ·  Batería  ·  Cámara', w / 2, h * 0.555);
  for (let i = 0; i < 4; i += 1) {
    ctx.fillStyle = ['#ff6a5a', '#ffc247', '#3de0c0', '#5b8cff'][i];
    ctx.beginPath();
    ctx.roundRect(w * (0.12 + i * 0.2), h * 0.74, w * 0.15, w * 0.15, w * 0.04);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.beginPath();
  ctx.roundRect(w * 0.3, h * 0.93, w * 0.4, h * 0.012, h * 0.01);
  ctx.fill();
}
