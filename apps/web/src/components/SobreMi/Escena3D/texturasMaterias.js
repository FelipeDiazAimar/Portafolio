// Texturas de la escena de 2023, dibujadas en canvas 2D (no importan three).

// Medidas de la tarjeta compartidas con la escena, en proporción de sus lados:
// la casilla (centro y lado, este último relativo al ALTO) y la barra de
// progreso (desde x0 hasta x1 del ancho, a la altura y).
export const CASILLA = { x: 0.135, lado: 0.4 };
export const BARRA = { x0: 0.27, x1: 0.93, y: 0.86, alto: 0.05 };

// Parte un nombre en líneas que entren en `ancho` píxeles con la fuente actual.
function envolver(ctx, texto, ancho) {
  const lineas = [];
  let actual = '';
  for (const palabra of texto.split(' ')) {
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

// Círculo de diámetro `lado` centrado en (x, y): las casillas son redondas.
const circulo = (ctx, x, y, lado) => {
  ctx.beginPath();
  ctx.arc(x, y, lado / 2, 0, Math.PI * 2);
};

// Tarjeta de una materia: panel de vidrio oscuro con esquinas redondeadas, brillo
// diagonal, borde con degradado azul-cian, etiqueta pequeña, nombre grande,
// casilla vacía a la izquierda, número decorativo y riel de la barra de
// progreso. La casilla llena, la tilde y la barra llena son objetos aparte que
// la escena anima encima. Lo que queda fuera del panel es transparente.
export function dibujarTarjeta(ctx, w, h, nombre, indice) {
  const radio = h * 0.1;
  ctx.clearRect(0, 0, w, h);

  // Panel.
  const fondo = ctx.createLinearGradient(0, 0, w, h);
  fondo.addColorStop(0, '#16213a');
  fondo.addColorStop(0.55, '#0d1526');
  fondo.addColorStop(1, '#090e1b');
  ctx.fillStyle = fondo;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, radio);
  ctx.fill();

  // Brillo diagonal tipo vidrio, recortado al panel.
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, radio);
  ctx.clip();
  const brillo = ctx.createLinearGradient(0, 0, w * 0.7, h * 1.1);
  brillo.addColorStop(0, 'rgba(180, 210, 255, 0.16)');
  brillo.addColorStop(0.45, 'rgba(180, 210, 255, 0.03)');
  brillo.addColorStop(1, 'rgba(180, 210, 255, 0)');
  ctx.fillStyle = brillo;
  ctx.fillRect(0, 0, w, h);

  // Número grande y tenue como textura de fondo.
  ctx.fillStyle = 'rgba(120, 160, 255, 0.07)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `800 ${h * 0.62}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillText(String(indice + 1).padStart(2, '0'), w * 0.97, h * 0.72);
  ctx.restore();

  // Borde con degradado.
  const borde = ctx.createLinearGradient(0, 0, w, h);
  borde.addColorStop(0, 'rgba(120, 170, 255, 0.95)');
  borde.addColorStop(0.5, 'rgba(70, 110, 220, 0.35)');
  borde.addColorStop(1, 'rgba(61, 224, 255, 0.85)');
  ctx.strokeStyle = borde;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(4, 4, w - 8, h - 8, radio - 3);
  ctx.stroke();

  // Casilla vacía: círculo de vidrio hundido con aro de degradado.
  const lado = h * CASILLA.lado;
  const cx = w * CASILLA.x;
  const cy = h / 2;
  const hueco = ctx.createLinearGradient(cx, cy - lado / 2, cx, cy + lado / 2);
  hueco.addColorStop(0, '#060a14');
  hueco.addColorStop(1, '#0f1a30');
  ctx.fillStyle = hueco;
  circulo(ctx, cx, cy, lado);
  ctx.fill();
  const aro = ctx.createLinearGradient(cx - lado / 2, cy - lado / 2, cx + lado / 2, cy + lado / 2);
  aro.addColorStop(0, 'rgba(140, 185, 255, 0.95)');
  aro.addColorStop(1, 'rgba(61, 224, 255, 0.7)');
  ctx.strokeStyle = aro;
  ctx.lineWidth = 6;
  circulo(ctx, cx, cy, lado);
  ctx.stroke();

  // Etiqueta pequeña con espaciado.
  const x = w * 0.27;
  ctx.fillStyle = 'rgba(110, 215, 255, 0.85)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${h * 0.062}px "Segoe UI", system-ui, sans-serif`;
  ctx.letterSpacing = `${h * 0.012}px`;
  ctx.fillText(`MATERIA ${String(indice + 1).padStart(2, '0')}`, x, h * 0.19);
  ctx.letterSpacing = '0px';

  // Nombre, en hasta tres líneas.
  ctx.fillStyle = '#f0f5ff';
  const fuente = Math.round(h * 0.125);
  ctx.font = `700 ${fuente}px "Segoe UI", system-ui, sans-serif`;
  const lineas = envolver(ctx, nombre, w * 0.66 - 10);
  const salto = fuente * 1.18;
  const centro = h * 0.5;
  lineas.forEach((linea, i) => ctx.fillText(linea, x, centro + (i - (lineas.length - 1) / 2) * salto));

  // Riel de la barra de progreso.
  ctx.fillStyle = 'rgba(160, 190, 255, 0.14)';
  ctx.beginPath();
  ctx.roundRect(w * BARRA.x0, h * BARRA.y - (h * BARRA.alto) / 2, w * (BARRA.x1 - BARRA.x0), h * BARRA.alto, h * BARRA.alto);
  ctx.fill();
}

// Relleno de la casilla: círculo con degradado verde azulado, brillo interior y
// un resplandor suave alrededor (por eso ocupa sólo el 62 % del lienzo).
export function dibujarRellenoCasilla(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  const lado = w * 0.62;
  const x = w / 2;
  const y = h / 2;
  ctx.shadowColor = 'rgba(60, 255, 210, 0.95)';
  ctx.shadowBlur = w * 0.14;
  const g = ctx.createLinearGradient(x - lado / 2, y + lado / 2, x + lado / 2, y - lado / 2);
  g.addColorStop(0, '#0fae8a');
  g.addColorStop(1, '#5af0c8');
  ctx.fillStyle = g;
  circulo(ctx, x, y, lado);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Reflejo en la mitad de arriba, recortado al círculo.
  ctx.save();
  circulo(ctx, x, y, lado - 8);
  ctx.clip();
  const reflejo = ctx.createLinearGradient(0, y - lado / 2, 0, y);
  reflejo.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
  reflejo.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = reflejo;
  ctx.fillRect(x - lado / 2, y - lado / 2, lado, lado / 2);
  ctx.restore();
}

// Tilde blanca de trazo grueso y redondeado. Se revela de izquierda a derecha.
export function dibujarTilde(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = w * 0.115;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0, 70, 55, 0.55)';
  ctx.shadowBlur = w * 0.04;
  ctx.beginPath();
  ctx.moveTo(w * 0.27, h * 0.53);
  ctx.lineTo(w * 0.45, h * 0.69);
  ctx.lineTo(w * 0.74, h * 0.33);
  ctx.stroke();
}

// Barra de progreso llena: degradado azul → verde azulado con brillo arriba.
export function dibujarBarraLlena(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, '#5b8cff');
  g.addColorStop(1, '#3de0c0');
  ctx.shadowColor = 'rgba(61, 224, 255, 0.9)';
  ctx.shadowBlur = h * 0.5;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(h * 0.4, h * 0.2, w - h * 0.8, h * 0.6, h);
  ctx.fill();
}

// Halo de la tarjeta: contorno redondeado desenfocado, para sumar (aditivo) detrás.
export function dibujarHaloTarjeta(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  const margen = w * 0.1;
  ctx.shadowColor = 'rgba(70, 240, 205, 1)';
  ctx.shadowBlur = w * 0.07;
  ctx.fillStyle = 'rgba(70, 240, 205, 0.9)';
  ctx.beginPath();
  ctx.roundRect(margen, margen, w - margen * 2, h - margen * 2, h * 0.09);
  ctx.fill();
}

// Base del sello, con los colores del escudo de Cambridge (rojo, blanco y oro):
// disco rojo con anillos dorados y texto en arco en crema. El escudo va aparte,
// encima, en el centro.
export function dibujarBaseSello(ctx, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const r = w / 2;
  const fondo = ctx.createRadialGradient(cx, cy * 0.8, r * 0.1, cx, cy, r);
  fondo.addColorStop(0, '#d12a30');
  fondo.addColorStop(0.7, '#a3141b');
  fondo.addColorStop(1, '#6e0b12');
  ctx.fillStyle = fondo;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(247, 214, 96, 0.95)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.93, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.66, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#fff4d4';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Arriba, al derecho.
  const arriba = 'CAMBRIDGE ENGLISH';
  const tam = r * 0.105;
  ctx.font = `700 ${tam}px "Segoe UI", system-ui, sans-serif`;
  const radioTexto = r * 0.8;
  const paso = (tam * 0.86) / radioTexto;
  const inicio = -Math.PI / 2 - ((arriba.length - 1) * paso) / 2;
  [...arriba].forEach((letra, i) => {
    const a = inicio + i * paso;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * radioTexto, cy + Math.sin(a) * radioTexto);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(letra, 0, 0);
    ctx.restore();
  });

  // Abajo, recorrido al revés para que también se lea al derecho.
  const abajo = 'FIRST  ·  B2';
  const inicioAbajo = Math.PI / 2 + ((abajo.length - 1) * paso) / 2;
  [...abajo].forEach((letra, i) => {
    const a = inicioAbajo - i * paso;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * radioTexto, cy + Math.sin(a) * radioTexto);
    ctx.rotate(a - Math.PI / 2);
    ctx.fillText(letra, 0, 0);
    ctx.restore();
  });

  // Estrellas doradas a los costados.
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
  ctx.fillStyle = '#ffe27a';
  estrella(cx - r * 0.8, cy, r * 0.065);
  estrella(cx + r * 0.8, cy, r * 0.065);
}

// Resplandor: mancha circular que se desvanece hacia afuera, para sumar al fondo.
export function dibujarResplandor(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  // Resplandor cálido (oro y rojo), a tono con el escudo.
  g.addColorStop(0, 'rgba(255, 214, 110, 0.95)');
  g.addColorStop(0.35, 'rgba(255, 120, 70, 0.42)');
  g.addColorStop(1, 'rgba(230, 50, 40, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
