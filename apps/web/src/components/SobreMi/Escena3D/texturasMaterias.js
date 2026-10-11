// Texturas de la escena de 2023, dibujadas en canvas 2D (no importan three).

// Parte un nombre en líneas que entren en `ancho` píxeles con la fuente actual.
function envolver(ctx, texto, ancho) {
  const palabras = texto.split(' ');
  const lineas = [];
  let actual = '';
  for (const palabra of palabras) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (ctx.measureText(prueba).width > ancho && actual) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = prueba;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

// Tarjeta de una materia: panel oscuro con borde fino, casilla vacía a la
// izquierda y el nombre a la derecha. La tilde es un objeto aparte que aparece
// encima de la casilla. El centro de la casilla está en (CASILLA_X, 0.5) del
// lienzo (en proporción), para que la escena ubique la tilde ahí.
export const CASILLA_X = 0.12;

export function dibujarTarjeta(ctx, w, h, nombre) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#121a2c');
  g.addColorStop(1, '#0a101d');
  // Fondo opaco hasta las esquinas: la tarjeta es una caja y lo transparente se vería negro.
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(91, 140, 255, 0.55)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(5, 5, w - 10, h - 10, 22);
  ctx.stroke();

  // Casilla vacía.
  const lado = h * 0.34;
  const cx = w * CASILLA_X;
  ctx.strokeStyle = 'rgba(200, 215, 245, 0.7)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(cx - lado / 2, h / 2 - lado / 2, lado, lado, 8);
  ctx.stroke();

  // Nombre, en hasta tres líneas, centrado en vertical.
  ctx.fillStyle = '#e8eefc';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const fuente = Math.round(h * 0.15);
  ctx.font = `600 ${fuente}px "Segoe UI", system-ui, sans-serif`;
  const x = w * 0.24;
  const lineas = envolver(ctx, nombre, w - x - w * 0.06);
  const alto = fuente * 1.22;
  lineas.forEach((linea, i) => ctx.fillText(linea, x, h / 2 + (i - (lineas.length - 1) / 2) * alto));
}

// Tilde dibujada con trazo grueso, redondeado y con un degradado verde azulado.
export function dibujarTilde(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, h, w, 0);
  g.addColorStop(0, '#22d3a8');
  g.addColorStop(1, '#7ff3d6');
  ctx.strokeStyle = g;
  ctx.lineWidth = w * 0.14;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(80, 255, 210, 0.9)';
  ctx.shadowBlur = w * 0.08;
  ctx.beginPath();
  ctx.moveTo(w * 0.2, h * 0.54);
  ctx.lineTo(w * 0.43, h * 0.76);
  ctx.lineTo(w * 0.82, h * 0.26);
  ctx.stroke();
}

// Sello: disco azul con un anillo de texto, el nivel (B2) grande al centro y
// estrellas. Es un sello genérico: lleva el nombre y el nivel del examen, no el
// logo oficial.
export function dibujarSello(ctx, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const r = w / 2;
  const fondo = ctx.createRadialGradient(cx, cy * 0.8, r * 0.1, cx, cy, r);
  fondo.addColorStop(0, '#2c58c9');
  fondo.addColorStop(0.65, '#14307d');
  fondo.addColorStop(1, '#0a1a4d');
  ctx.fillStyle = fondo;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Anillos finos.
  ctx.strokeStyle = 'rgba(214, 228, 255, 0.85)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.93, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
  ctx.stroke();

  // Texto en arco, letra por letra (arriba y abajo).
  const enArco = (texto, radio, centro, tamano) => {
    ctx.font = `700 ${tamano}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillStyle = '#eaf1ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const paso = tamano * 0.82 / radio;
    const inicio = centro - ((texto.length - 1) * paso) / 2;
    [...texto].forEach((letra, i) => {
      const a = inicio + i * paso;
      ctx.save();
      ctx.translate(cx + Math.cos(a) * radio, cy + Math.sin(a) * radio);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillText(letra, 0, 0);
      ctx.restore();
    });
  };
  enArco('CAMBRIDGE ENGLISH', r * 0.78, -Math.PI / 2, r * 0.115);
  // Abajo el texto se lee al derecho: se recorre al revés.
  const abajo = 'FIRST CERTIFICATE';
  ctx.font = `700 ${r * 0.1}px "Segoe UI", system-ui, sans-serif`;
  const pasoAbajo = (r * 0.1 * 0.82) / (r * 0.78);
  const inicioAbajo = Math.PI / 2 + ((abajo.length - 1) * pasoAbajo) / 2;
  [...abajo].forEach((letra, i) => {
    const a = inicioAbajo - i * pasoAbajo;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78);
    ctx.rotate(a - Math.PI / 2);
    ctx.fillText(letra, 0, 0);
    ctx.restore();
  });

  // Centro: B2 grande.
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${r * 0.62}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillText('B2', cx, cy + r * 0.02);
  ctx.font = `600 ${r * 0.09}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(214, 228, 255, 0.9)';
  ctx.fillText('NIVEL', cx, cy - r * 0.4);

  // Estrellas a los costados del anillo medio.
  const estrella = (x, y, rad) => {
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 === 0 ? rad : rad * 0.42;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  };
  ctx.fillStyle = '#ffd86b';
  estrella(cx - r * 0.78, cy, r * 0.07);
  estrella(cx + r * 0.78, cy, r * 0.07);
}

// Resplandor: mancha circular que se desvanece hacia afuera, para sumar al fondo.
export function dibujarResplandor(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(120, 170, 255, 0.95)');
  g.addColorStop(0.35, 'rgba(70, 120, 255, 0.45)');
  g.addColorStop(1, 'rgba(40, 80, 255, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
