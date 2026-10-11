// Texturas dibujadas en canvas para la planta de 2026.
const SANS = '-apple-system, "Segoe UI", "Helvetica Neue", system-ui, sans-serif';
const MONO = '"Cascadia Mono", Menlo, Consolas, monospace';

// Generador determinista (misma semilla → mismo dibujo).
function azar(semilla) {
  let estado = semilla;
  return () => {
    estado = (estado * 9301 + 49297) % 233280;
    return estado / 233280;
  };
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

// Etiqueta chica que va sobre cada caja: un código de barras y el lote.
export function dibujarCodigo(ctx, w, h) {
  ctx.fillStyle = '#f4f6fb';
  ctx.fillRect(0, 0, w, h);
  const siguiente = azar(12345);
  ctx.fillStyle = '#0b1220';
  let x = w * 0.08;
  while (x < w * 0.92) {
    const ancho = 1 + Math.floor(siguiente() * 4);
    ctx.fillRect(x, h * 0.14, ancho * (w / 160), h * 0.52);
    x += (ancho + 1 + Math.floor(siguiente() * 2)) * (w / 160);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${h * 0.14}px ${MONO}`;
  ctx.fillText('LOTE 2026-0412', w / 2, h * 0.8);
}

const QR = 25;

// Matriz del QR: tres marcas de posición y el resto al azar (no es un QR válido).
function matrizQr() {
  const siguiente = azar(777);
  const filas = [];
  for (let f = 0; f < QR; f += 1) {
    const fila = [];
    for (let c = 0; c < QR; c += 1) {
      const enMarca = (f < 7 && c < 7) || (f < 7 && c >= QR - 7) || (f >= QR - 7 && c < 7);
      if (enMarca) {
        const ff = f < 7 ? f : f - (QR - 7);
        const cc = c < 7 ? c : c - (QR - 7);
        const borde = ff === 0 || ff === 6 || cc === 0 || cc === 6;
        const centro = ff >= 2 && ff <= 4 && cc >= 2 && cc <= 4;
        fila.push(borde || centro);
      } else {
        fila.push(siguiente() > 0.5);
      }
    }
    filas.push(fila);
  }
  return filas;
}
const MATRIZ_QR = matrizQr();

export const DATO_QR = 'SSCC 00 7791234 000412 8';

// Etiqueta de la caja, ampliada. `escaneo` (0–1) es el avance del láser sobre el QR y
// `lectura` (0–1) cuánto del dato leído ya se mostró.
export function dibujarEtiquetaAmpliada(ctx, w, h, { escaneo = 0, lectura = 0 } = {}) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#f7f8fb';
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, h * 0.04);
  ctx.fill();
  ctx.strokeStyle = 'rgba(111, 168, 255, 0.9)';
  ctx.lineWidth = 6;
  ctx.stroke();

  // Encabezado.
  ctx.fillStyle = '#0b1b3f';
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h * 0.17, [h * 0.04, h * 0.04, 0, 0]);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = `800 ${h * 0.09}px ${SANS}`;
  ctx.fillText('MBRF', w * 0.04, h * 0.085);
  ctx.textAlign = 'right';
  ctx.font = `500 ${h * 0.045}px ${SANS}`;
  ctx.fillText('PLANTA SAN JORGE · EXPEDICIÓN', w * 0.96, h * 0.085);

  // Producto y datos.
  ctx.fillStyle = '#0b1220';
  ctx.textAlign = 'left';
  ctx.font = `800 ${h * 0.07}px ${SANS}`;
  ctx.fillText('PECHUGA DE POLLO', w * 0.04, h * 0.27);
  ctx.font = `500 ${h * 0.05}px ${SANS}`;
  ctx.fillStyle = '#44506a';
  const datos = [
    ['PESO NETO', '10,00 kg'],
    ['LOTE', '2026-0412'],
    ['ELABORADO', '11-10-2026'],
    ['VENCE', '11-11-2026'],
  ];
  datos.forEach(([clave, valor], i) => {
    const y = h * (0.4 + i * 0.1);
    ctx.fillStyle = '#7a869f';
    ctx.font = `600 ${h * 0.04}px ${SANS}`;
    ctx.fillText(clave, w * 0.04, y);
    ctx.fillStyle = '#0b1220';
    ctx.font = `700 ${h * 0.054}px ${MONO}`;
    ctx.fillText(valor, w * 0.25, y);
  });

  // Código de barras abajo a la izquierda.
  const siguiente = azar(4242);
  ctx.fillStyle = '#0b1220';
  let x = w * 0.04;
  while (x < w * 0.5) {
    const ancho = 1 + Math.floor(siguiente() * 4);
    ctx.fillRect(x, h * 0.78, ancho * (w / 260), h * 0.14);
    x += (ancho + 1 + Math.floor(siguiente() * 2)) * (w / 260);
  }

  // QR a la derecha.
  const lado = h * 0.5;
  const qx = w * 0.6;
  const qy = h * 0.24;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(qx - lado * 0.04, qy - lado * 0.04, lado * 1.08, lado * 1.08);
  const celda = lado / QR;
  ctx.fillStyle = '#0b1220';
  MATRIZ_QR.forEach((fila, f) => {
    fila.forEach((activa, c) => {
      if (activa) ctx.fillRect(qx + c * celda, qy + f * celda, celda + 0.5, celda + 0.5);
    });
  });

  // Láser: una franja azul que baja sobre el QR.
  if (escaneo > 0 && escaneo < 1) {
    const ly = qy + escaneo * lado;
    const banda = ctx.createLinearGradient(0, ly - lado * 0.25, 0, ly);
    banda.addColorStop(0, 'rgba(61, 224, 192, 0)');
    banda.addColorStop(1, 'rgba(61, 224, 192, 0.45)');
    ctx.fillStyle = banda;
    ctx.fillRect(qx, Math.max(qy, ly - lado * 0.25), lado, Math.min(lado * 0.25, ly - qy));
    ctx.fillStyle = '#3de0c0';
    ctx.shadowColor = '#3de0c0';
    ctx.shadowBlur = 18;
    ctx.fillRect(qx - lado * 0.03, ly - 2, lado * 1.06, 5);
    ctx.shadowBlur = 0;
  }
  // Una vez leído, el QR se marca con las esquinas y queda teñido de verde.
  if (escaneo >= 1) {
    ctx.fillStyle = 'rgba(61, 224, 192, 0.16)';
    ctx.fillRect(qx, qy, lado, lado);
    ctx.strokeStyle = '#3de0c0';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    const esquina = lado * 0.16;
    const m = lado * 0.05;
    [
      [qx - m, qy - m, 1, 1],
      [qx + lado + m, qy - m, -1, 1],
      [qx - m, qy + lado + m, 1, -1],
      [qx + lado + m, qy + lado + m, -1, -1],
    ].forEach(([ex, ey, dx, dy]) => {
      ctx.beginPath();
      ctx.moveTo(ex + dx * esquina, ey);
      ctx.lineTo(ex, ey);
      ctx.lineTo(ex, ey + dy * esquina);
      ctx.stroke();
    });
  }

  // Dato leído, escrito de a poco debajo del QR.
  if (lectura > 0) {
    ctx.fillStyle = '#0d8f6f';
    ctx.textAlign = 'left';
    ctx.font = `700 ${h * 0.05}px ${SANS}`;
    ctx.fillText('✓ QR leído', qx - lado * 0.04, qy + lado * 1.17);
    ctx.fillStyle = '#0b1220';
    ctx.font = `700 ${h * 0.046}px ${MONO}`;
    ctx.fillText(DATO_QR.slice(0, Math.ceil(DATO_QR.length * lectura)), qx - lado * 0.04, qy + lado * 1.29);
  }
}

// Panel de SAP con el registro de la caja. `registro` (0–1): la fila nueva entra, se
// resalta y pasa a "Contabilizado".
export function dibujarPanelSap(ctx, w, h, { registro = 0 } = {}) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#f5f6f7';
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, h * 0.03);
  ctx.fill();
  ctx.save();
  ctx.clip();

  // Barra superior con el logo.
  ctx.fillStyle = '#354a5f';
  ctx.fillRect(0, 0, w, h * 0.13);
  const g = ctx.createLinearGradient(0, 0, w * 0.1, h * 0.13);
  g.addColorStop(0, '#00b8f1');
  g.addColorStop(1, '#0070f2');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(w * 0.03, h * 0.02);
  ctx.lineTo(w * 0.13, h * 0.02);
  ctx.lineTo(w * 0.1, h * 0.11);
  ctx.lineTo(w * 0.03, h * 0.11);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = `900 ${h * 0.065}px ${SANS}`;
  ctx.fillText('SAP', w * 0.045, h * 0.067);
  ctx.font = `500 ${h * 0.042}px ${SANS}`;
  ctx.fillText('Trazabilidad · Entradas de mercadería', w * 0.17, h * 0.067);

  // Título y resumen.
  ctx.fillStyle = '#1d2d3e';
  ctx.font = `700 ${h * 0.06}px ${SANS}`;
  ctx.fillText('Entradas de mercadería', w * 0.04, h * 0.23);
  ctx.fillStyle = '#556b82';
  ctx.font = `400 ${h * 0.036}px ${SANS}`;
  ctx.fillText('Planta San Jorge · hoy', w * 0.04, h * 0.3);

  // Tabla.
  const columnas = [0.04, 0.2, 0.44, 0.62, 0.78];
  const titulos = ['Documento', 'Material', 'Lote', 'Cantidad', 'Estado'];
  ctx.fillStyle = '#e5e9ee';
  ctx.fillRect(w * 0.03, h * 0.35, w * 0.94, h * 0.09);
  ctx.fillStyle = '#32363a';
  ctx.font = `700 ${h * 0.036}px ${SANS}`;
  titulos.forEach((t, i) => ctx.fillText(t, w * columnas[i], h * 0.395));

  const filas = [
    ['5000127391', 'Pechuga de pollo', '2026-0411', '24 cajas', 'Contabilizado'],
    ['5000127392', 'Pechuga de pollo', '2026-0411', '24 cajas', 'Contabilizado'],
    ['5000127393', 'Muslo deshuesado', '2026-0411', '18 cajas', 'Contabilizado'],
  ];
  const dibujarFila = (datos, y, estado, resaltada) => {
    if (resaltada) {
      ctx.fillStyle = 'rgba(255, 221, 87, 0.32)';
      ctx.fillRect(w * 0.03, y - h * 0.045, w * 0.94, h * 0.09);
    }
    ctx.strokeStyle = '#d9dde3';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.03, y + h * 0.045);
    ctx.lineTo(w * 0.97, y + h * 0.045);
    ctx.stroke();
    ctx.fillStyle = '#32363a';
    ctx.font = `400 ${h * 0.036}px ${SANS}`;
    datos.slice(0, 4).forEach((t, i) => ctx.fillText(t, w * columnas[i], y));
    const color = estado === 'ok' ? '#107e3e' : '#b46100';
    ctx.fillStyle = color;
    ctx.font = `700 ${h * 0.036}px ${SANS}`;
    ctx.fillText((estado === 'ok' ? '● ' : '◌ ') + datos[4], w * columnas[4], y);
  };
  filas.forEach((fila, i) => dibujarFila(fila, h * (0.495 + i * 0.09), 'ok', false));

  // Fila nueva: baja desde arriba al cargarse y pasa de "En proceso" a "Contabilizado".
  if (registro > 0) {
    const entrada = Math.min(1, registro / 0.5);
    ctx.globalAlpha = entrada;
    const y = h * 0.765 - (1 - entrada) * h * 0.05;
    const hecho = registro >= 0.75;
    dibujarFila(['5000127394', 'Pechuga de pollo', '2026-0412', '10 kg', hecho ? 'Contabilizado' : 'En proceso'], y, hecho ? 'ok' : 'pendiente', true);
    ctx.globalAlpha = 1;
  }

  // Aviso de confirmación abajo.
  if (registro >= 0.75) {
    ctx.fillStyle = '#107e3e';
    ctx.beginPath();
    ctx.roundRect(w * 0.04, h * 0.86, w * 0.5, h * 0.09, h * 0.02);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 ${h * 0.038}px ${SANS}`;
    ctx.fillText('✓ Lote 2026-0412 registrado en SAP', w * 0.06, h * 0.905);
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(0, 112, 242, 0.9)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, h * 0.03);
  ctx.stroke();
}
