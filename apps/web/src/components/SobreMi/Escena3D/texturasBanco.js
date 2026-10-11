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

// Pantalla del multímetro: LCD verdoso con los dígitos grandes, la unidad y el modo.
export function dibujarLcd(ctx, w, h, valor) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#b9c5b6');
  g.addColorStop(1, '#a6b4a4');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#141c18';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  ctx.font = `700 ${h * 0.78}px "Cascadia Mono", Consolas, "Courier New", monospace`;
  ctx.fillText(valor, w * 0.9, h * 0.52);
  ctx.textAlign = 'left';
  ctx.font = `700 ${h * 0.18}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillText('V', w * 0.03, h * 0.82);
  ctx.fillText('DC', w * 0.03, h * 0.18);
}

// Pantalla del teléfono en reparación: fondo degradado, hora y aviso de modo
// diagnóstico con iconos de apps.
export function dibujarPantallaTelefono(ctx, w, h, claro = false) {
  ctx.clearRect(0, 0, w, h);
  // Vidrio negro redondeado (el borde del teléfono) y, adentro, la pantalla.
  ctx.fillStyle = '#05060a';
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, w * 0.14);
  ctx.fill();
  const margen = w * 0.032;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(margen, margen, w - margen * 2, h - margen * 2, w * 0.115);
  ctx.clip();
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, claro ? '#3a6fe0' : '#14306e');
  g.addColorStop(1, claro ? '#7b5cf0' : '#3a1c7a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${h * 0.11}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillText('9:41', w / 2, h * 0.22);
  ctx.font = `500 ${h * 0.026}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillText('Sábado 11 de octubre', w / 2, h * 0.3);
  // Barra de estado: señal a la izquierda y batería a la derecha.
  ctx.textAlign = 'left';
  ctx.font = `700 ${h * 0.02}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillText('9:41', w * 0.12, h * 0.045);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(w * 0.76, h * 0.03, w * 0.12, h * 0.018, h * 0.005);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.beginPath();
  ctx.roundRect(w * 0.1, h * 0.4, w * 0.8, h * 0.2, h * 0.02);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = `700 ${h * 0.032}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillText('Modo diagnóstico', w / 2, h * 0.47);
  ctx.font = `500 ${h * 0.024}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillText('Pantalla  ·  Batería  ·  Cámara', w / 2, h * 0.53);
  for (let i = 0; i < 4; i += 1) {
    ctx.fillStyle = ['#ff6a5a', '#ffc247', '#3de0c0', '#5b8cff'][i];
    ctx.beginPath();
    ctx.roundRect(w * (0.12 + i * 0.2), h * 0.72, w * 0.15, w * 0.15, w * 0.04);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.beginPath();
  ctx.roundRect(w * 0.32, h * 0.955, w * 0.36, h * 0.008, h * 0.005);
  ctx.fill();
  ctx.restore();
  // Muesca del iPhone X: pegada al borde de arriba, con las esquinas de abajo redondeadas.
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.roundRect(w * 0.215, 0, w * 0.57, h * 0.05, [0, 0, w * 0.045, w * 0.045]);
  ctx.fill();
}
