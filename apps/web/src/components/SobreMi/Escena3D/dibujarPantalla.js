// Dibuja UN cuadro de la pantalla de la notebook en un contexto 2D, a partir de
// lo que decide `estadoPantalla`. No importa three: sólo pinta píxeles.
const FUENTE = '30px Consolas, "Cascadia Mono", "Courier New", monospace';
const AZUL = '#5b8cff';

function fondoEscritorio(ctx, w, h) {
  const g = ctx.createRadialGradient(w * 0.3, h * 0.2, 40, w * 0.5, h * 0.6, w * 0.85);
  g.addColorStop(0, '#2b5cff');
  g.addColorStop(0.5, '#0f2a7a');
  g.addColorStop(1, '#050b24');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// Logo estilizado de cuatro paneles (no es el logo oficial de Windows). Se usa
// en el arranque de la pantalla y en la tapa de la notebook.
export function dibujarLogo(ctx, cx, cy, lado, color = AZUL) {
  const hueco = lado * 0.06;
  const celda = (lado - hueco) / 2;
  ctx.fillStyle = color;
  for (let fila = 0; fila < 2; fila += 1) {
    for (let col = 0; col < 2; col += 1) {
      ctx.fillRect(cx - lado / 2 + col * (celda + hueco), cy - lado / 2 + fila * (celda + hueco), celda, celda);
    }
  }
}

function indicadorCarga(ctx, cx, cy, radio, progreso) {
  const puntos = 8;
  for (let i = 0; i < puntos; i += 1) {
    const angulo = (i / puntos) * Math.PI * 2;
    const fase = (progreso * 3 - i / puntos) % 1;
    const brillo = 0.2 + 0.8 * (fase < 0 ? fase + 1 : fase);
    ctx.fillStyle = `rgba(155, 190, 255, ${brillo})`;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(angulo) * radio, cy + Math.sin(angulo) * radio, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function iconoMiPc(ctx, x, y) {
  ctx.strokeStyle = '#e6eeff';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.roundRect(x - 22, y + 12, 44, 28, 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y + 40);
  ctx.lineTo(x, y + 48);
  ctx.moveTo(x - 12, y + 49);
  ctx.lineTo(x + 12, y + 49);
  ctx.stroke();
}

function iconoPapelera(ctx, x, y) {
  ctx.strokeStyle = '#e6eeff';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 15, y + 20);
  ctx.lineTo(x + 15, y + 20);
  ctx.lineTo(x + 12, y + 50);
  ctx.lineTo(x - 12, y + 50);
  ctx.closePath();
  ctx.moveTo(x - 20, y + 15);
  ctx.lineTo(x + 20, y + 15);
  ctx.moveTo(x - 6, y + 10);
  ctx.lineTo(x + 6, y + 10);
  ctx.moveTo(x - 4, y + 26);
  ctx.lineTo(x - 4, y + 44);
  ctx.moveTo(x + 4, y + 26);
  ctx.lineTo(x + 4, y + 44);
  ctx.stroke();
}

function iconoCarpeta(ctx, x, y, escala = 1) {
  ctx.fillStyle = '#f5c04a';
  ctx.beginPath();
  ctx.roundRect(x - 24 * escala, y + 16 * escala, 48 * escala, 34 * escala, 5 * escala);
  ctx.fill();
  ctx.fillStyle = '#e0a52f';
  ctx.beginPath();
  ctx.roundRect(x - 24 * escala, y + 11 * escala, 22 * escala, 10 * escala, 3 * escala);
  ctx.fill();
}

function iconos(ctx) {
  const items = [
    { texto: 'Mi PC', dibujar: iconoMiPc },
    { texto: 'Papelera', dibujar: iconoPapelera },
    { texto: 'Proyectos', dibujar: iconoCarpeta },
  ];
  ctx.font = '22px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  items.forEach(({ texto, dibujar }, i) => {
    const x = 70;
    const y = 50 + i * 118;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.roundRect(x - 34, y - 4, 68, 68, 14);
    ctx.fill();
    dibujar(ctx, x, y);
    ctx.fillStyle = '#e6eeff';
    ctx.fillText(texto, x, y + 92);
  });
  ctx.textAlign = 'left';
}

function barraTareas(ctx, w, h) {
  ctx.fillStyle = 'rgba(8, 12, 28, 0.88)';
  ctx.fillRect(0, h - 58, w, 58);
  const lado = 32;
  const hueco = 20;
  const total = 4;
  const inicio = w / 2 - (total * lado + (total - 1) * hueco) / 2;
  const centroY = h - 29;
  const centro = (i) => inicio + i * (lado + hueco) + lado / 2;

  // 0: inicio (logo de cuatro paneles)
  dibujarLogo(ctx, centro(0), centroY, 26);

  // 1: carpeta
  iconoCarpeta(ctx, centro(1), centroY - 22, 0.65);

  // 2: navegador (globo)
  ctx.strokeStyle = '#8fd0ff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(centro(2), centroY, 13, 0, Math.PI * 2);
  ctx.moveTo(centro(2) - 13, centroY);
  ctx.lineTo(centro(2) + 13, centroY);
  ctx.moveTo(centro(2), centroY - 13);
  ctx.bezierCurveTo(centro(2) + 9, centroY - 6, centro(2) + 9, centroY + 6, centro(2), centroY + 13);
  ctx.moveTo(centro(2), centroY - 13);
  ctx.bezierCurveTo(centro(2) - 9, centroY - 6, centro(2) - 9, centroY + 6, centro(2), centroY + 13);
  ctx.stroke();

  // 3: terminal
  ctx.fillStyle = '#0a0f1c';
  ctx.beginPath();
  ctx.roundRect(centro(3) - 15, centroY - 13, 30, 26, 5);
  ctx.fill();
  ctx.strokeStyle = AZUL;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(centro(3) - 8, centroY - 5);
  ctx.lineTo(centro(3) - 2, centroY);
  ctx.lineTo(centro(3) - 8, centroY + 5);
  ctx.moveTo(centro(3) + 1, centroY + 6);
  ctx.lineTo(centro(3) + 9, centroY + 6);
  ctx.stroke();
}

function ventanaTerminal(ctx, w, h, estado) {
  const facil = 1 - (1 - estado.apertura) ** 3;
  const ancho = w * 0.7;
  const alto = h * 0.68;
  const x = (w - ancho) / 2;
  const y = h * 0.1;

  ctx.save();
  ctx.globalAlpha = facil;
  ctx.translate(w / 2, y + alto / 2);
  ctx.scale(0.85 + 0.15 * facil, 0.85 + 0.15 * facil);
  ctx.translate(-w / 2, -(y + alto / 2));

  ctx.fillStyle = '#0a0f1c';
  ctx.beginPath();
  ctx.roundRect(x, y, ancho, alto, 14);
  ctx.fill();
  ctx.fillStyle = '#131a2e';
  ctx.beginPath();
  ctx.roundRect(x, y, ancho, 44, [14, 14, 0, 0]);
  ctx.fill();
  ['#ff5f57', '#febc2e', '#28c840'].forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + 26 + i * 26, y + 22, 7, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.font = FUENTE;
  ctx.textBaseline = 'top';
  const lineas = [...estado.lineas];
  const ultima = lineas[lineas.length - 1];
  // Si lo último es una salida (o no hay nada), la terminal muestra un prompt
  // nuevo esperando.
  if (ultima === undefined || !ultima.startsWith('> ')) lineas.push('> ');

  lineas.forEach((linea, i) => {
    const ly = y + 70 + i * 44;
    if (linea.startsWith('> ')) {
      ctx.fillStyle = AZUL;
      ctx.fillText('>', x + 28, ly);
      ctx.fillStyle = '#e6eeff';
      ctx.fillText(linea.slice(2), x + 28 + ctx.measureText('> ').width, ly);
    } else {
      ctx.fillStyle = '#8fb4ff';
      ctx.fillText(linea, x + 28, ly);
    }
  });

  if (estado.cursorVisible && estado.apertura >= 1) {
    const i = lineas.length - 1;
    const anchoTexto = ctx.measureText(lineas[i]).width;
    ctx.fillStyle = '#e6eeff';
    ctx.fillRect(x + 28 + anchoTexto + 4, y + 70 + i * 44 + 4, 16, 30);
  }
  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}

export function dibujarPantalla(ctx, w, h, estado) {
  ctx.clearRect(0, 0, w, h);
  if (estado.fase === 'apagada') {
    ctx.fillStyle = '#03050a';
    ctx.fillRect(0, 0, w, h);
    return;
  }
  if (estado.fase === 'arranque') {
    ctx.fillStyle = '#03050a';
    ctx.fillRect(0, 0, w, h);
    dibujarLogo(ctx, w / 2, h * 0.42, 150);
    indicadorCarga(ctx, w / 2, h * 0.78, 26, estado.progreso);
    return;
  }
  fondoEscritorio(ctx, w, h);
  iconos(ctx);
  barraTareas(ctx, w, h);
  if (estado.fase === 'terminal') ventanaTerminal(ctx, w, h, estado);
}
