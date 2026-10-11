// Dibuja UN cuadro de la pantalla de la notebook en un contexto 2D, a partir de
// lo que decide `estadoPantalla`: arranque con la manzana y la barra de carga,
// escritorio de macOS (barra de menú, Dock) y una ventana de Terminal. No
// importa three: sólo pinta píxeles.
import { dibujarManzanaEn } from './manzanaPath.js';

const SANS = '-apple-system, "SF Pro Text", "Helvetica Neue", "Segoe UI", system-ui, sans-serif';
const MONO = 'Menlo, "SF Mono", Consolas, "Cascadia Mono", monospace';
const ALTO_MENU = 0.034;

// Fondo de escritorio: ondas suaves en violeta, azul y naranja.
function fondoEscritorio(ctx, w, h) {
  const base = ctx.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, '#2a1a6e');
  base.addColorStop(0.45, '#4a35c8');
  base.addColorStop(1, '#16123d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  const onda = (cy, alto, color, fase) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += w / 40) {
      ctx.lineTo(x, cy + Math.sin(x / w * Math.PI * 2 + fase) * alto);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  };
  onda(h * 0.62, h * 0.07, 'rgba(255, 130, 90, 0.55)', 0.4);
  onda(h * 0.74, h * 0.06, 'rgba(255, 90, 140, 0.55)', 1.6);
  onda(h * 0.86, h * 0.05, 'rgba(70, 60, 200, 0.7)', 2.8);
  const brillo = ctx.createRadialGradient(w * 0.25, h * 0.15, 10, w * 0.25, h * 0.15, w * 0.5);
  brillo.addColorStop(0, 'rgba(120, 180, 255, 0.45)');
  brillo.addColorStop(1, 'rgba(120, 180, 255, 0)');
  ctx.fillStyle = brillo;
  ctx.fillRect(0, 0, w, h);
}

function barraMenu(ctx, w, h) {
  const alto = h * ALTO_MENU;
  ctx.fillStyle = 'rgba(20, 16, 50, 0.55)';
  ctx.fillRect(0, 0, w, alto);
  dibujarManzanaEn(ctx, w * 0.022, alto / 2, alto * 0.62, '#ffffff');
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${alto * 0.46}px ${SANS}`;
  ctx.fillText('Finder', w * 0.04, alto / 2);
  ctx.font = `400 ${alto * 0.46}px ${SANS}`;
  ['Archivo', 'Edición', 'Visualización', 'Ir', 'Ventana', 'Ayuda'].reduce((x, texto) => {
    ctx.fillText(texto, x, alto / 2);
    return x + ctx.measureText(texto).width + w * 0.017;
  }, w * 0.083);
  ctx.textAlign = 'right';
  ctx.fillText('sáb 11 oct  9:41', w * 0.985, alto / 2);
  // Batería y wifi.
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1, alto * 0.06);
  ctx.beginPath();
  ctx.roundRect(w * 0.84, alto * 0.3, w * 0.022, alto * 0.4, alto * 0.08);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(w * 0.842, alto * 0.34, w * 0.015, alto * 0.32);
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.arc(w * 0.81, alto * 0.7, alto * (0.12 + i * 0.1), -Math.PI * 0.78, -Math.PI * 0.22);
    ctx.stroke();
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

// Íconos del Dock: cuadrados redondeados de colores con un símbolo simple.
const DOCK = [
  { a: '#4aa8ff', b: '#1b64e6', icono: 'cara' },
  { a: '#6cd4ff', b: '#1e86ff', icono: 'brujula' },
  { a: '#6bd96b', b: '#1fa84a', icono: 'mensaje' },
  { a: '#ffd54a', b: '#ff9f1c', icono: 'nota' },
  { a: '#ff6b81', b: '#d6264f', icono: 'musica' },
  { a: '#3a3f4d', b: '#15171f', icono: 'terminal' },
];

function iconoDock(ctx, x, y, lado, { a, b, icono }) {
  const g = ctx.createLinearGradient(x, y, x, y + lado);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x, y, lado, lado, lado * 0.23);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = lado * 0.06;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const cx = x + lado / 2;
  const cy = y + lado / 2;
  if (icono === 'cara') {
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.roundRect(x + lado * 0.2, y + lado * 0.2, lado * 0.6, lado * 0.6, lado * 0.16);
    ctx.fill();
    ctx.fillStyle = b;
    ctx.beginPath();
    ctx.arc(cx - lado * 0.12, cy - lado * 0.06, lado * 0.045, 0, Math.PI * 2);
    ctx.arc(cx + lado * 0.12, cy - lado * 0.06, lado * 0.045, 0, Math.PI * 2);
    ctx.fill();
  } else if (icono === 'brujula') {
    ctx.beginPath();
    ctx.arc(cx, cy, lado * 0.32, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ff5b4a';
    ctx.beginPath();
    ctx.moveTo(cx + lado * 0.18, cy - lado * 0.18);
    ctx.lineTo(cx + lado * 0.04, cy + lado * 0.04);
    ctx.lineTo(cx - lado * 0.04, cy - lado * 0.04);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx - lado * 0.18, cy + lado * 0.18);
    ctx.lineTo(cx + lado * 0.04, cy + lado * 0.04);
    ctx.lineTo(cx - lado * 0.04, cy - lado * 0.04);
    ctx.closePath();
    ctx.fill();
  } else if (icono === 'mensaje') {
    ctx.beginPath();
    ctx.ellipse(cx, cy - lado * 0.02, lado * 0.3, lado * 0.23, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - lado * 0.16, cy + lado * 0.16);
    ctx.lineTo(cx - lado * 0.26, cy + lado * 0.3);
    ctx.lineTo(cx - lado * 0.04, cy + lado * 0.2);
    ctx.fill();
  } else if (icono === 'nota') {
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.roundRect(x + lado * 0.2, y + lado * 0.16, lado * 0.6, lado * 0.68, lado * 0.06);
    ctx.fill();
    ctx.strokeStyle = b;
    ctx.lineWidth = lado * 0.035;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(x + lado * 0.3, y + lado * (0.36 + i * 0.16));
      ctx.lineTo(x + lado * 0.7, y + lado * (0.36 + i * 0.16));
      ctx.stroke();
    }
  } else if (icono === 'musica') {
    ctx.beginPath();
    ctx.arc(cx - lado * 0.1, cy + lado * 0.16, lado * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - lado * 0.02, cy + lado * 0.16);
    ctx.lineTo(cx - lado * 0.02, cy - lado * 0.26);
    ctx.lineTo(cx + lado * 0.2, cy - lado * 0.2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(x + lado * 0.28, y + lado * 0.34);
    ctx.lineTo(x + lado * 0.42, y + lado * 0.48);
    ctx.lineTo(x + lado * 0.28, y + lado * 0.62);
    ctx.moveTo(x + lado * 0.5, y + lado * 0.64);
    ctx.lineTo(x + lado * 0.7, y + lado * 0.64);
    ctx.stroke();
  }
}

function dock(ctx, w, h) {
  const lado = h * 0.074;
  const hueco = lado * 0.22;
  const total = DOCK.length * lado + (DOCK.length - 1) * hueco;
  const x0 = (w - total) / 2;
  const y = h - lado - h * 0.026;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x0 - lado * 0.3, y - lado * 0.2, total + lado * 0.6, lado * 1.4, lado * 0.42);
  ctx.fill();
  ctx.stroke();
  DOCK.forEach((item, i) => iconoDock(ctx, x0 + i * (lado + hueco), y + lado * 0.05, lado * 0.9, item));
  // Punto de "app abierta" bajo la Terminal.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.beginPath();
  ctx.arc(x0 + 5 * (lado + hueco) + lado * 0.45, y + lado * 1.12, lado * 0.045, 0, Math.PI * 2);
  ctx.fill();
}

// Disco "Macintosh HD" arriba a la derecha, como en macOS.
function discoDuro(ctx, w, h) {
  const x = w * 0.93;
  const y = h * 0.1;
  const lado = h * 0.07;
  ctx.fillStyle = '#e6e8ee';
  ctx.beginPath();
  ctx.roundRect(x - lado * 0.7, y, lado * 1.4, lado * 0.9, lado * 0.12);
  ctx.fill();
  ctx.fillStyle = '#9aa1b3';
  ctx.fillRect(x - lado * 0.7, y + lado * 0.62, lado * 1.4, lado * 0.28);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = `500 ${h * 0.022}px ${SANS}`;
  ctx.fillText('Macintosh HD', x, y + lado * 1.35);
  ctx.textAlign = 'left';
}

function ventanaTerminal(ctx, w, h, estado) {
  const facil = 1 - (1 - estado.apertura) ** 3;
  const ancho = w * 0.66;
  const alto = h * 0.62;
  const x = (w - ancho) / 2;
  const y = h * 0.1;
  const barra = h * 0.06;
  const letra = h * 0.036;

  ctx.save();
  ctx.globalAlpha = facil;
  ctx.translate(w / 2, y + alto / 2);
  ctx.scale(0.85 + 0.15 * facil, 0.85 + 0.15 * facil);
  ctx.translate(-w / 2, -(y + alto / 2));

  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = h * 0.04;
  ctx.shadowOffsetY = h * 0.012;
  ctx.fillStyle = 'rgba(18, 18, 24, 0.94)';
  ctx.beginPath();
  ctx.roundRect(x, y, ancho, alto, h * 0.018);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#2d2d36';
  ctx.beginPath();
  ctx.roundRect(x, y, ancho, barra, [h * 0.018, h * 0.018, 0, 0]);
  ctx.fill();
  ['#ff5f57', '#febc2e', '#28c840'].forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + barra * 0.5 + i * barra * 0.42, y + barra / 2, barra * 0.15, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = '#c9ccd6';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `500 ${barra * 0.4}px ${SANS}`;
  ctx.fillText('felipe — -zsh — 80×24', x + ancho / 2, y + barra / 2);
  ctx.textAlign = 'left';

  ctx.font = `${letra}px ${MONO}`;
  ctx.textBaseline = 'top';
  const lineas = [...estado.lineas];
  const ultima = lineas[lineas.length - 1];
  // Si lo último es una salida (o no hay nada), la terminal muestra un prompt
  // nuevo esperando.
  if (ultima === undefined || !ultima.startsWith('> ')) lineas.push('> ');
  const paso = letra * 1.4;
  const prompt = 'felipe@mac ~ % ';

  lineas.forEach((linea, i) => {
    const ly = y + barra + letra * 0.8 + i * paso;
    if (linea.startsWith('> ')) {
      ctx.fillStyle = '#7ddf8a';
      ctx.fillText(prompt, x + letra, ly);
      ctx.fillStyle = '#f2f3f7';
      ctx.fillText(linea.slice(2), x + letra + ctx.measureText(prompt).width, ly);
    } else {
      ctx.fillStyle = '#c9ccd6';
      ctx.fillText(linea, x + letra, ly);
    }
  });

  if (estado.cursorVisible && estado.apertura >= 1) {
    const i = lineas.length - 1;
    const texto = lineas[i].startsWith('> ') ? prompt + lineas[i].slice(2) : lineas[i];
    ctx.fillStyle = '#e9eaf0';
    ctx.fillRect(x + letra + ctx.measureText(texto).width + 2, y + barra + letra * 0.8 + i * paso, letra * 0.6, letra * 1.15);
  }
  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}

export function dibujarPantalla(ctx, w, h, estado) {
  ctx.clearRect(0, 0, w, h);
  if (estado.fase === 'apagada') {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    return;
  }
  if (estado.fase === 'arranque') {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    dibujarManzanaEn(ctx, w / 2, h * 0.46, h * 0.2, '#ffffff');
    // Barra de carga fina, como la del arranque de un Mac.
    const ancho = w * 0.15;
    const x = (w - ancho) / 2;
    const y = h * 0.66;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.beginPath();
    ctx.roundRect(x, y, ancho, h * 0.008, h * 0.004);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(x, y, ancho * Math.min(1, estado.progreso), h * 0.008, h * 0.004);
    ctx.fill();
    return;
  }
  fondoEscritorio(ctx, w, h);
  discoDuro(ctx, w, h);
  if (estado.fase === 'terminal') ventanaTerminal(ctx, w, h, estado);
  barraMenu(ctx, w, h);
  dock(ctx, w, h);
}
