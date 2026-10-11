// Tablero de trazabilidad que se va creando en la planta de 2026: cada widget
// aparece de a uno (primero un recuadro punteado, después se llena con datos) y
// un cursor marca el que se está colocando. `construccion` (0–1) es el avance de
// todo el armado. Sólo pinta píxeles.
const SANS = '-apple-system, "Segoe UI", "Helvetica Neue", system-ui, sans-serif';
const MONO = '"Cascadia Mono", Menlo, Consolas, monospace';

const WIDGETS = [
  { tipo: 'kpi', x: 0.03, y: 0.2, ancho: 0.225, alto: 0.17, titulo: 'Cajas trazadas hoy', valor: 12480, formato: (v) => Math.round(v).toLocaleString('es-AR') },
  { tipo: 'kpi', x: 0.2675, y: 0.2, ancho: 0.225, alto: 0.17, titulo: 'Lotes activos', valor: 38, formato: (v) => String(Math.round(v)) },
  { tipo: 'kpi', x: 0.505, y: 0.2, ancho: 0.225, alto: 0.17, titulo: 'Trazabilidad', valor: 99.2, formato: (v) => `${v.toFixed(1).replace('.', ',')} %` },
  { tipo: 'kpi', x: 0.7425, y: 0.2, ancho: 0.225, alto: 0.17, titulo: 'Lectura de QR', valor: 0.4, formato: (v) => `${v.toFixed(1).replace('.', ',')} s` },
  { tipo: 'barras', x: 0.03, y: 0.405, ancho: 0.33, alto: 0.53, titulo: 'Producción por línea' },
  { tipo: 'linea', x: 0.3775, y: 0.405, ancho: 0.33, alto: 0.53, titulo: 'Cajas por hora' },
  { tipo: 'dona', x: 0.725, y: 0.405, ancho: 0.245, alto: 0.25, titulo: 'Destino' },
  { tipo: 'tabla', x: 0.725, y: 0.675, ancho: 0.245, alto: 0.26, titulo: 'Últimos lotes' },
];
// Cada widget empieza a aparecer en su momento (de 0 a 1 del armado) y tarda esto en llenarse.
const INICIOS = [0, 0.1, 0.2, 0.3, 0.42, 0.56, 0.7, 0.82];
const DURACION_WIDGET = 0.22;

const limitar = (x) => Math.min(1, Math.max(0, x));

function encabezado(ctx, w, h, construccion) {
  ctx.fillStyle = '#131c33';
  ctx.fillRect(0, 0, w, h * 0.14);
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = `700 ${h * 0.05}px ${SANS}`;
  ctx.fillText('Tablero de trazabilidad', w * 0.03, h * 0.07);
  ctx.fillStyle = '#7f8db0';
  ctx.font = `500 ${h * 0.03}px ${SANS}`;
  ctx.fillText('MBRF · Planta San Jorge', w * 0.37, h * 0.075);
  ctx.fillStyle = construccion < 1 ? '#2f7bff' : '#1f9d6b';
  ctx.beginPath();
  ctx.roundRect(w * 0.76, h * 0.03, w * 0.21, h * 0.08, h * 0.02);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = `700 ${h * 0.034}px ${SANS}`;
  ctx.fillText(construccion < 1 ? '+ Agregando widgets…' : '✓ Tablero publicado', w * 0.865, h * 0.072);
  ctx.textAlign = 'left';
}

function barras(ctx, h, x, y, ancho, alto, llenado) {
  const valores = [0.62, 0.84, 0.5, 0.92, 0.7, 0.78];
  const base = y + alto * 0.88;
  const maxAlto = alto * 0.66;
  const paso = (ancho * 0.88) / valores.length;
  valores.forEach((v, k) => {
    const bx = x + ancho * 0.06 + k * paso;
    const bh = maxAlto * v * llenado;
    ctx.fillStyle = k === 3 ? '#3de0c0' : '#2f7bff';
    ctx.beginPath();
    ctx.roundRect(bx, base - bh, paso * 0.66, bh, h * 0.006);
    ctx.fill();
    ctx.fillStyle = '#7f8db0';
    ctx.font = `500 ${h * 0.024}px ${SANS}`;
    ctx.fillText(`L${k + 1}`, bx + paso * 0.14, base + h * 0.03);
  });
}

function linea(ctx, x, y, ancho, alto, llenado) {
  const puntos = [0.3, 0.45, 0.4, 0.62, 0.55, 0.78, 0.7, 0.9];
  const base = y + alto * 0.88;
  const alturaMax = alto * 0.66;
  const posicion = (k) => [x + ancho * 0.06 + (k / (puntos.length - 1)) * ancho * 0.88, base - puntos[k] * alturaMax];
  ctx.strokeStyle = '#3de0c0';
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const visibles = (puntos.length - 1) * llenado;
  const entero = Math.floor(visibles);
  for (let k = 0; k <= entero; k += 1) {
    const [px, py] = posicion(k);
    if (k === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  if (entero < puntos.length - 1) {
    const f = visibles - entero;
    const [ax, ay] = posicion(entero);
    const [bx, by] = posicion(entero + 1);
    ctx.lineTo(ax + (bx - ax) * f, ay + (by - ay) * f);
  }
  ctx.stroke();
}

function dona(ctx, x, y, ancho, alto, llenado) {
  const cx = x + ancho * 0.5;
  const cy = y + alto * 0.58;
  const radio = Math.min(ancho, alto) * 0.3;
  const tramos = [
    [0.55, '#2f7bff'],
    [0.3, '#3de0c0'],
    [0.15, '#ffc247'],
  ];
  let angulo = -Math.PI / 2;
  ctx.lineWidth = radio * 0.42;
  tramos.forEach(([parte, color]) => {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, radio, angulo, angulo + parte * Math.PI * 2 * llenado);
    ctx.stroke();
    angulo += parte * Math.PI * 2;
  });
}

function tabla(ctx, h, x, y, ancho, alto) {
  ['2026-0412', '2026-0411', '2026-0410'].forEach((lote, k) => {
    const fy = y + alto * (0.34 + k * 0.22);
    ctx.fillStyle = '#e6ebf7';
    ctx.font = `600 ${h * 0.028}px ${MONO}`;
    ctx.fillText(lote, x + ancho * 0.06, fy);
    ctx.fillStyle = '#3de0c0';
    ctx.beginPath();
    ctx.arc(x + ancho * 0.88, fy - h * 0.008, h * 0.011, 0, Math.PI * 2);
    ctx.fill();
  });
}

function cursorMouse(ctx, h, { x, y }) {
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#0d1424';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + h * 0.075);
  ctx.lineTo(x + h * 0.022, y + h * 0.058);
  ctx.lineTo(x + h * 0.046, y + h * 0.058);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

export function dibujarTablero(ctx, w, h, { construccion = 0 } = {}) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0d1424';
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, h * 0.03);
  ctx.fill();
  ctx.save();
  ctx.clip();
  encabezado(ctx, w, h, construccion);

  let cursor = null;
  WIDGETS.forEach((wd, i) => {
    const x = wd.x * w;
    const y = wd.y * h;
    const ancho = wd.ancho * w;
    const alto = wd.alto * h;
    const aparece = limitar((construccion - INICIOS[i] + 0.04) / 0.08);
    const llenado = limitar((construccion - INICIOS[i]) / DURACION_WIDGET);
    // Recuadro punteado: el lugar donde va a ir el widget.
    if (llenado < 1) {
      ctx.setLineDash([h * 0.015, h * 0.012]);
      ctx.strokeStyle = `rgba(111, 168, 255, ${0.5 * aparece})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(x, y, ancho, alto, h * 0.015);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (llenado <= 0) return;
    if (llenado < 1) cursor = { x: x + ancho * 0.5, y: y + alto * 0.55 };

    const escala = 0.94 + 0.06 * llenado;
    ctx.save();
    ctx.globalAlpha = Math.min(1, llenado * 2);
    ctx.translate(x + ancho / 2, y + alto / 2);
    ctx.scale(escala, escala);
    ctx.translate(-(x + ancho / 2), -(y + alto / 2));
    ctx.fillStyle = '#17213b';
    ctx.beginPath();
    ctx.roundRect(x, y, ancho, alto, h * 0.015);
    ctx.fill();
    ctx.fillStyle = '#8c9bbf';
    ctx.font = `600 ${h * 0.028}px ${SANS}`;
    ctx.fillText(wd.titulo, x + ancho * 0.06, y + alto * (wd.tipo === 'kpi' ? 0.24 : 0.09));

    if (wd.tipo === 'kpi') {
      ctx.fillStyle = '#ffffff';
      ctx.font = `800 ${h * 0.075}px ${SANS}`;
      ctx.fillText(wd.formato(wd.valor * llenado), x + ancho * 0.06, y + alto * 0.66);
    } else if (wd.tipo === 'barras') barras(ctx, h, x, y, ancho, alto, llenado);
    else if (wd.tipo === 'linea') linea(ctx, x, y, ancho, alto, llenado);
    else if (wd.tipo === 'dona') dona(ctx, x, y, ancho, alto, llenado);
    else tabla(ctx, h, x, y, ancho, alto);
    ctx.restore();
  });

  if (cursor) cursorMouse(ctx, h, cursor);
  ctx.restore();
  ctx.strokeStyle = 'rgba(61, 224, 192, 0.85)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, h * 0.03);
  ctx.stroke();
}
