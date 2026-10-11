// Texturas dibujadas en canvas para la planta de 2026.

// Piso de la planta: baldosas con líneas de guía azules y las calles de las cintas marcadas.
export function dibujarSuelo(ctx, w, h, claro = false) {
  ctx.fillStyle = claro ? '#dfe6f1' : '#101827';
  ctx.fillRect(0, 0, w, h);
  const paso = w / 14;
  ctx.strokeStyle = claro ? 'rgba(60, 100, 190, 0.28)' : 'rgba(80, 140, 255, 0.22)';
  ctx.lineWidth = 2;
  for (let x = 0; x <= w; x += paso) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += paso) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  // Franjas amarillas de seguridad en el borde.
  ctx.fillStyle = claro ? '#e0a800' : '#b88a00';
  const franja = h * 0.012;
  ctx.fillRect(0, 0, w, franja);
  ctx.fillRect(0, h - franja, w, franja);
  ctx.fillRect(0, 0, franja, h);
  ctx.fillRect(w - franja, 0, franja, h);
}

// Cinta: tira oscura con ranuras transversales; al desplazar la textura parece avanzar.
// La imagen se repite en el eje x, así que el patrón tiene que cerrar en los bordes.
export function dibujarCinta(ctx, w, h) {
  ctx.fillStyle = '#161a23';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#242a36';
  const ranuras = 4;
  for (let i = 0; i < ranuras; i += 1) {
    ctx.fillRect((i / ranuras) * w, 0, w / ranuras / 2, h);
  }
  ctx.fillStyle = 'rgba(80, 150, 255, 0.35)';
  ctx.fillRect(0, 0, w, h * 0.05);
  ctx.fillRect(0, h * 0.95, w, h * 0.05);
}

// Cartel del nodo SAP: hexágono con el texto, en azul sobre fondo oscuro.
export function dibujarSap(ctx, w, h) {
  ctx.fillStyle = '#071226';
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#2f7bff');
  g.addColorStop(1, '#0a4fd0');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(w * 0.14, h * 0.2);
  ctx.lineTo(w * 0.86, h * 0.2);
  ctx.lineTo(w * 0.62, h * 0.8);
  ctx.lineTo(w * 0.14, h * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${h * 0.34}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillText('SAP', w * 0.44, h * 0.5);
}

// Etiqueta de trazabilidad: un código de barras y el lote debajo. Determinista.
export function dibujarCodigo(ctx, w, h) {
  ctx.fillStyle = '#f4f6fb';
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, h * 0.1);
  ctx.fill();
  let estado = 12345;
  const siguiente = () => {
    estado = (estado * 9301 + 49297) % 233280;
    return estado / 233280;
  };
  ctx.fillStyle = '#0b1220';
  let x = w * 0.08;
  while (x < w * 0.92) {
    const ancho = 1 + Math.floor(siguiente() * 4);
    ctx.fillRect(x, h * 0.14, ancho * (w / 160), h * 0.52);
    x += (ancho + 1 + Math.floor(siguiente() * 2)) * (w / 160);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${h * 0.14}px "Cascadia Mono", Consolas, monospace`;
  ctx.fillText('LOTE 2026-0412', w / 2, h * 0.8);
}
