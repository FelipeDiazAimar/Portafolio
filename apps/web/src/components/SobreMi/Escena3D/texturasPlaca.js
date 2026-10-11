// Texturas de la placa madre y sus piezas, dibujadas en canvas 2D. Sólo pintan
// píxeles (no importan three): `materialesPC.js` las convierte en texturas.
import { PLACA, ZONAS, RANURAS_DIMM, tornillos } from './disposicionPlaca.js';

// Generador determinista (la misma placa siempre).
function azar(semilla) {
  let s = semilla;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// Coordenadas de la placa (unidades de escena) → píxeles del lienzo.
const aPx = (x, y, w, h) => [((x + PLACA.ancho / 2) / PLACA.ancho) * w, ((PLACA.alto / 2 - y) / PLACA.alto) * h];

function rectanguloDeZona(ctx, zona, w, h, margen = 0.02) {
  const [x0, y0] = aPx(zona.cx - zona.ancho / 2 - margen, zona.cy + zona.alto / 2 + margen, w, h);
  const [x1, y1] = aPx(zona.cx + zona.ancho / 2 + margen, zona.cy - zona.alto / 2 - margen, w, h);
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
}

function texto(ctx, cadena, x, y, w, h, tamano, alineacion = 'left') {
  const [px, py] = aPx(x, y, w, h);
  ctx.font = `600 ${tamano}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = alineacion;
  ctx.fillText(cadena, px, py);
}

// Cara de la placa. `modo`:
//  - 'color': el aspecto (negro mate, pistas tenues, serigrafía blanca);
//  - 'relieve': mapa de alturas (gris medio, pistas y serigrafía levantadas)
//    para el `bumpMap`.
export function dibujarPCB(ctx, w, h, modo = 'color') {
  const color = modo === 'color';
  ctx.fillStyle = color ? '#06090d' : '#7a7a7a';
  ctx.fillRect(0, 0, w, h);

  // Pistas de cobre bajo la máscara: muchas líneas ortogonales con codos.
  const r = azar(11);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < 520; i += 1) {
    const x0 = r() * w;
    const y0 = r() * h;
    const largo = 40 + r() * 260;
    const horizontal = r() < 0.5;
    const sentido = r() < 0.5 ? 1 : -1;
    const x1 = horizontal ? x0 + largo * sentido : x0;
    const y1 = horizontal ? y0 : y0 + largo * sentido;
    const codo = 14 + r() * 26;
    ctx.strokeStyle = color ? `rgba(96, 124, 150, ${0.24 + r() * 0.3})` : `rgba(200, 200, 200, ${0.5 + r() * 0.4})`;
    ctx.lineWidth = 2 + r() * 2.5;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x1 + codo * 0.7, y1 + codo * 0.7 * sentido);
    ctx.stroke();
    // Vías: puntos pequeños en los extremos.
    ctx.fillStyle = color ? 'rgba(160, 186, 210, 0.5)' : 'rgba(220, 220, 220, 0.8)';
    ctx.beginPath();
    ctx.arc(x0, y0, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Serigrafía (todo en blanco: en el relieve, un gris claro).
  const tinta = color ? 'rgba(240, 245, 250, 0.95)' : 'rgba(255, 255, 255, 0.9)';
  ctx.strokeStyle = tinta;
  ctx.fillStyle = tinta;
  ctx.lineWidth = 3;
  for (const nombre of ['socket', 'dimm', 'pcie1', 'pcie2', 'm2', 'chipset', 'atx24', 'eps', 'sata', 'bateria']) {
    rectanguloDeZona(ctx, ZONAS[nombre], w, h);
  }
  texto(ctx, 'CPU SOCKET', ZONAS.socket.cx, ZONAS.socket.cy - ZONAS.socket.alto / 2 - 0.07, w, h, 17, 'center');
  RANURAS_DIMM.forEach((x, i) => texto(ctx, `DIMM_${i + 1}`, x, ZONAS.dimm.cy - ZONAS.dimm.alto / 2 - 0.045, w, h, 12, 'center'));
  texto(ctx, 'PCIEX16_1', ZONAS.pcie1.cx + 0.5, ZONAS.pcie1.cy - 0.1, w, h, 14, 'center');
  texto(ctx, 'PCIEX4', ZONAS.pcie2.cx + 0.2, ZONAS.pcie2.cy - 0.1, w, h, 14, 'center');
  texto(ctx, 'M.2_1', ZONAS.m2.cx + 0.5, ZONAS.m2.cy, w, h, 13, 'left');
  texto(ctx, 'ATX_PWR', ZONAS.atx24.cx, ZONAS.atx24.cy - ZONAS.atx24.alto / 2 - 0.05, w, h, 12, 'center');
  texto(ctx, 'CPU_PWR', ZONAS.eps.cx, ZONAS.eps.cy - 0.1, w, h, 12, 'center');
  texto(ctx, 'SATA_6G', ZONAS.sata.cx, ZONAS.sata.cy - ZONAS.sata.alto / 2 - 0.05, w, h, 12, 'center');
  texto(ctx, 'CR2032', ZONAS.bateria.cx, ZONAS.bateria.cy - 0.19, w, h, 12, 'center');
  texto(ctx, 'ASCII  Z790-F', 0.1, -1.04, w, h, 40, 'left');
  texto(ctx, 'GAMING  WIFI', 0.1, -1.14, w, h, 20, 'left');

  // Agujeros de los tornillos: anillo claro.
  ctx.lineWidth = 4;
  for (const t of tornillos()) {
    const [px, py] = aPx(t.x, t.y, w, h);
    ctx.beginPath();
    ctx.arc(px, py, 18, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// Tapa metálica del procesador (IHS): níquel pulido con el texto grabado.
export function dibujarIHS(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#d8dbe0');
  g.addColorStop(0.5, '#a9aeb7');
  g.addColorStop(1, '#cfd3d9');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Bisel.
  ctx.strokeStyle = 'rgba(40, 44, 52, 0.55)';
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, w - 20, h - 20);
  ctx.fillStyle = 'rgba(52, 58, 68, 0.78)';
  ctx.textAlign = 'center';
  ctx.font = '700 64px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('CORE-X', w / 2, h * 0.38);
  ctx.font = '600 38px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('14K  ·  24C / 32T', w / 2, h * 0.53);
  ctx.font = '500 26px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('LGA1700  ·  125W', w / 2, h * 0.66);
  ctx.fillText('ASCII-LAB  ·  MADE IN AR', w / 2, h * 0.78);
}

// Pines del zócalo (la cuadrícula de contactos dorados sobre plástico oscuro).
export function dibujarPinesSocket(ctx, w, h) {
  ctx.fillStyle = '#14161b';
  ctx.fillRect(0, 0, w, h);
  const n = 42;
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      const x = ((i + 0.5) / n) * w;
      const y = ((j + 0.5) / n) * h;
      ctx.fillStyle = '#b8923a';
      ctx.beginPath();
      ctx.arc(x, y, w / n / 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 240, 200, 0.5)';
      ctx.beginPath();
      ctx.arc(x - w / n / 11, y - w / n / 11, w / n / 11, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Mapa de rugosidad del aluminio cepillado: rayas finas en una dirección.
export function dibujarCepillado(ctx, w, h) {
  ctx.fillStyle = '#8a8a8a';
  ctx.fillRect(0, 0, w, h);
  const r = azar(5);
  for (let i = 0; i < 1400; i += 1) {
    const y = r() * h;
    const tono = Math.floor(90 + r() * 120);
    ctx.strokeStyle = `rgba(${tono}, ${tono}, ${tono}, ${0.25 + r() * 0.5})`;
    ctx.lineWidth = 0.6 + r() * 1.6;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y + (r() - 0.5) * 3);
    ctx.stroke();
  }
}
