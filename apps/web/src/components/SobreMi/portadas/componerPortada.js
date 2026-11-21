// Portada de un hito: una "tapa de sitio web" completa dibujada en un canvas 2D, que después
// se usa como textura de su malla curva en el reel. Tira de navegación, jerarquía tipográfica
// fuerte, el diorama isométrico como protagonista, la foto real como detalle y un pie sobrio.
//
// Se dibuja en una grilla de 1600 × 1060 (la proporción exacta del plano, 2,38 : 1,5771) y se
// escala al ancho pedido, así la textura sale nítida al tamaño con que se ve.
import { dividirResaltado } from '@/lib/resaltado.js';

export const BASE = { ancho: 1600, alto: 1060 };
// Dónde va el diorama (4:3) y qué parte de la portada tapa el diorama animado que se le
// superpone a la del frente: arranca pasada la columna de texto y termina antes del filo.
export const DIORAMA = { x: 668, y: 188.75, w: 990, h: 742.5 };
export const ZONA_VIVA = { x: 770, y: 189, w: 826, h: 742 };
// La foto del hito (o el recuadro de su video). Al pasarle el mouse, la escena la abre hasta
// ocupar toda la portada (ver EscenaReel.js).
export const FOTO = { x: 76, y: 792, w: 236, h: 158, r: 20 };

// El papel de cada tema es también el `paper` con que se generan los dioramas (scripts/hitos):
// si no coinciden, cada sólido del dibujo se ve como un parche.
export const TEMAS = {
  oscuro: { papel: '#11141b', tinta: '#f3f4f6', tenue: 'rgba(243,244,246,0.6)', fantasma: 'rgba(243,244,246,0.32)', linea: 'rgba(255,255,255,0.1)', chip: 'rgba(255,255,255,0.06)', contorno: 'rgba(255,255,255,0.1)' },
  claro: { papel: '#fbfaf6', tinta: '#15171c', tenue: 'rgba(21,23,28,0.62)', fantasma: 'rgba(21,23,28,0.34)', linea: 'rgba(21,23,28,0.1)', chip: 'rgba(21,23,28,0.05)', contorno: 'rgba(0,0,0,0.1)' },
};

export const rutaDiorama = (id, claro) => `/hitos/diorama-${id}-${claro ? 'claro' : 'oscuro'}.svg`;

export function cargarImagen(src) {
  return new Promise((resolver) => {
    if (!src) return resolver(null);
    const imagen = new Image();
    imagen.decoding = 'async';
    imagen.onload = () => resolver(imagen);
    imagen.onerror = () => resolver(null);
    imagen.src = src;
    return undefined;
  });
}

// Familias reales de next/font (los nombres llevan un hash): se leen de las variables CSS.
export function leerFuentes() {
  const estilo = getComputedStyle(document.documentElement);
  const sans = estilo.getPropertyValue('--font-inter').trim() || 'system-ui, sans-serif';
  const serif = estilo.getPropertyValue('--font-serif').trim() || 'Georgia, serif';
  return { sans, serif };
}

// El canvas no espera a las fuentes: hay que pedirlas antes de dibujar.
export async function esperarFuentes({ sans, serif }) {
  if (!document.fonts?.load) return;
  try {
    await Promise.all([
      document.fonts.load(`500 20px ${sans}`),
      document.fonts.load(`600 20px ${sans}`),
      document.fonts.load(`600 60px ${serif}`),
    ]);
    await document.fonts.ready;
  } catch {
    /* sin la API de fuentes se dibuja con las de respaldo */
  }
}

function conAlfa(hex, alfa) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alfa})`;
}

function partir(ctx, texto, anchoMax) {
  const renglones = [];
  let actual = '';
  for (const palabra of texto.split(/\s+/)) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (actual && ctx.measureText(prueba).width > anchoMax) {
      renglones.push(actual);
      actual = palabra;
    } else {
      actual = prueba;
    }
  }
  if (actual) renglones.push(actual);
  return renglones;
}

function espaciado(ctx, valor) {
  if ('letterSpacing' in ctx) ctx.letterSpacing = valor;
}

function pastilla(ctx, x, y, ancho, alto, radio = alto / 2) {
  ctx.beginPath();
  ctx.roundRect(x, y, ancho, alto, radio);
}

// Frases en negrita de la descripción, cortas: son las "cifras" del pie de la portada.
export function clavesDe(hito, maximo = 3) {
  const vistas = new Set();
  return dividirResaltado(hito.descripcion)
    .filter((p) => p.resaltado && p.texto.length <= 26)
    .map((p) => p.texto.charAt(0).toUpperCase() + p.texto.slice(1))
    .filter((t) => (vistas.has(t.toLowerCase()) ? false : vistas.add(t.toLowerCase())))
    .slice(0, maximo);
}

export function componerPortada({ hito, indice, hitos, claro, ancho, fuentes, diorama, foto }) {
  const tema = claro ? TEMAS.claro : TEMAS.oscuro;
  const acento = hito.acento ?? '#5b8cff';
  const total = hitos.length;
  const escala = ancho / BASE.ancho;
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(BASE.ancho * escala);
  lienzo.height = Math.round(BASE.alto * escala);
  const ctx = lienzo.getContext('2d');
  ctx.scale(lienzo.width / BASE.ancho, lienzo.height / BASE.alto);
  ctx.textBaseline = 'alphabetic';
  const { sans, serif } = fuentes;

  // Papel y una luz muy tenue del color del hito detrás del diorama.
  ctx.fillStyle = tema.papel;
  ctx.fillRect(0, 0, BASE.ancho, BASE.alto);
  const luz = ctx.createRadialGradient(1165, 590, 40, 1165, 590, 640);
  luz.addColorStop(0, conAlfa(acento, claro ? 0.1 : 0.16));
  luz.addColorStop(1, conAlfa(acento, 0));
  ctx.fillStyle = luz;
  ctx.fillRect(0, 0, BASE.ancho, BASE.alto);

  // Antes del diorama se guarda el fondo de su zona: es lo que lleva detrás el diorama animado.
  // (Lo que se dibuja después —título, bajada, pie— no entra en esa zona.)
  const fondoVivo = document.createElement('canvas');
  fondoVivo.width = Math.round(ZONA_VIVA.w * escala);
  fondoVivo.height = Math.round(ZONA_VIVA.h * escala);
  fondoVivo.getContext('2d').drawImage(lienzo, ZONA_VIVA.x * escala, ZONA_VIVA.y * escala, ZONA_VIVA.w * escala, ZONA_VIVA.h * escala, 0, 0, fondoVivo.width, fondoVivo.height);

  // Diorama (4:3) a la derecha.
  if (diorama) ctx.drawImage(diorama, DIORAMA.x, DIORAMA.y, DIORAMA.w, DIORAMA.h);

  // Tira de navegación.
  const X = 76;
  ctx.fillStyle = tema.tinta;
  espaciado(ctx, '-0.4px');
  ctx.font = `700 25px ${sans}`;
  ctx.fillText('</>', X, 78);
  ctx.font = `500 20px ${sans}`;
  espaciado(ctx, '0px');
  let nx = 520;
  hitos.forEach((h, i) => {
    const anchoTexto = ctx.measureText(h.anio).width;
    ctx.fillStyle = i === indice ? tema.tinta : tema.fantasma;
    ctx.fillText(h.anio, nx, 77);
    if (i === indice) {
      ctx.fillStyle = acento;
      pastilla(ctx, nx, 90, anchoTexto, 3, 1.5);
      ctx.fill();
    }
    nx += anchoTexto + 34;
  });
  ctx.font = `600 20px ${sans}`;
  const etiqueta = 'Sobre mí';
  const anchoEtiqueta = ctx.measureText(etiqueta).width + 44;
  ctx.fillStyle = tema.tinta;
  pastilla(ctx, BASE.ancho - X - anchoEtiqueta, 48, anchoEtiqueta, 46);
  ctx.fill();
  ctx.fillStyle = tema.papel;
  ctx.fillText(etiqueta, BASE.ancho - X - anchoEtiqueta + 22, 78);

  // Antetítulo: el resumen del hito en una pastilla del color del hito.
  ctx.font = `500 22px ${sans}`;
  const anchoResumen = Math.min(640, ctx.measureText(hito.resumen).width + 62);
  ctx.fillStyle = conAlfa(acento, claro ? 0.14 : 0.2);
  pastilla(ctx, X, 232, anchoResumen, 46);
  ctx.fill();
  ctx.fillStyle = acento;
  ctx.beginPath();
  ctx.arc(X + 24, 255, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = tema.tinta;
  ctx.fillText(hito.resumen, X + 42, 262, anchoResumen - 58);

  const zonas = [];
  // dónde quedó cada parte (px de la portada): las dibuja un agente cada una en la intro
  const zona = (nombre, x0, y0, x1, y1) => zonas.push({ nombre, x0: x0 / BASE.ancho, y0: y0 / BASE.alto, x1: Math.min(1, x1 / BASE.ancho), y1: Math.min(1, y1 / BASE.alto) });
  zona('Navegación', X - 6, 40, BASE.ancho - X + 6, 102);
  zona('Etiqueta', X - 6, 226, X + anchoResumen + 6, 284);

  // Título: serif grande y apretada; se achica hasta entrar en tres renglones.
  const anchoTitulo = 690;
  let cuerpo = 112;
  let renglones = [];
  for (; cuerpo >= 64; cuerpo -= 6) {
    ctx.font = `600 ${cuerpo}px ${serif}`;
    espaciado(ctx, `${(-cuerpo * 0.028).toFixed(2)}px`);
    renglones = partir(ctx, hito.titulo, anchoTitulo);
    if (renglones.length <= 3 && renglones.every((r) => ctx.measureText(r).width <= anchoTitulo)) break;
  }
  ctx.fillStyle = tema.tinta;
  let y = 300 + cuerpo;
  for (const renglon of renglones) {
    ctx.fillText(renglon, X - 4, y);
    y += cuerpo * 1.02;
  }
  y -= cuerpo * 1.02;
  zona('Título', X - 10, 300, X + anchoTitulo + 4, y + cuerpo * 0.28);

  // Bajada: la descripción, sin marcas, hasta tres renglones.
  ctx.font = `400 25px ${sans}`;
  espaciado(ctx, '-0.2px');
  ctx.fillStyle = tema.tenue;
  const bajada = partir(ctx, hito.descripcion.replaceAll('**', ''), 640);
  const visibles = bajada.slice(0, 3);
  if (bajada.length > 3) visibles[2] = `${visibles[2].replace(/[\s,.;:]+\S*$/, '')}…`;
  y += 58;
  const yBajada = y - 28;
  for (const renglon of visibles) {
    ctx.fillText(renglon, X, y);
    y += 38;
  }
  zona('Bajada', X - 6, yBajada, X + 650, y - 38 + 12);

  // Detalle editorial: la foto real (si hay) y las palabras clave del hito.
  const yPie = FOTO.y;
  let xClaves = X;
  const conRecuadro = Boolean(foto || hito.video);
  if (!foto && hito.video) {
    // sin foto pero con video: un recuadro con el triángulo de reproducir, del color del hito
    ctx.fillStyle = conAlfa(acento, claro ? 0.16 : 0.24);
    pastilla(ctx, X, yPie, FOTO.w, FOTO.h, FOTO.r);
    ctx.fill();
    ctx.fillStyle = acento;
    ctx.beginPath();
    ctx.arc(X + FOTO.w / 2, yPie + FOTO.h / 2, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = tema.papel;
    ctx.beginPath();
    ctx.moveTo(X + FOTO.w / 2 - 10, yPie + FOTO.h / 2 - 15);
    ctx.lineTo(X + FOTO.w / 2 + 16, yPie + FOTO.h / 2);
    ctx.lineTo(X + FOTO.w / 2 - 10, yPie + FOTO.h / 2 + 15);
    ctx.closePath();
    ctx.fill();
    xClaves = X + FOTO.w + 30;
  }
  if (foto) {
    const anchoFoto = FOTO.w;
    const altoFoto = FOTO.h;
    const [fx, fy] = (hito.foco ?? '50% 50%').split(' ').map((v) => parseFloat(v) / 100);
    const proporcion = Math.max(anchoFoto / foto.naturalWidth, altoFoto / foto.naturalHeight);
    const anchoOrigen = anchoFoto / proporcion;
    const altoOrigen = altoFoto / proporcion;
    ctx.save();
    pastilla(ctx, X, yPie, anchoFoto, altoFoto, 20);
    ctx.clip();
    ctx.drawImage(foto, (foto.naturalWidth - anchoOrigen) * fx, (foto.naturalHeight - altoOrigen) * fy, anchoOrigen, altoOrigen, X, yPie, anchoFoto, altoFoto);
    ctx.restore();
    ctx.strokeStyle = tema.contorno;
    ctx.lineWidth = 1.5;
    pastilla(ctx, X + 0.75, yPie + 0.75, anchoFoto - 1.5, altoFoto - 1.5, 19.25);
    ctx.stroke();
    xClaves = X + anchoFoto + 30;
  }
  if (conRecuadro) zona(foto ? 'Foto' : 'Video', X - 4, yPie - 4, X + FOTO.w + 4, yPie + FOTO.h + 4);
  ctx.font = `500 21px ${sans}`;
  espaciado(ctx, '0px');
  let yClave = conRecuadro ? yPie + 6 : yPie + 56;
  const yClaves = yClave;
  let xMaxClaves = xClaves;
  let xClave = xClaves;
  for (const clave of clavesDe(hito, conRecuadro ? 3 : 4)) {
    const anchoClave = ctx.measureText(clave).width + 40;
    if (!conRecuadro && xClave + anchoClave > 730) {
      xClave = xClaves;
      yClave += 56;
    }
    ctx.fillStyle = tema.chip;
    pastilla(ctx, xClave, yClave, anchoClave, 44);
    ctx.fill();
    ctx.fillStyle = tema.tinta;
    ctx.fillText(clave, xClave + 20, yClave + 30);
    xMaxClaves = Math.max(xMaxClaves, xClave + anchoClave);
    if (conRecuadro) yClave += 56;
    else xClave += anchoClave + 12;
  }
  zona('Claves', xClaves - 6, yClaves - 6, xMaxClaves + 6, (conRecuadro ? yClave - 56 : yClave) + 50);
  zona('Diorama', DIORAMA.x, DIORAMA.y, DIORAMA.x + DIORAMA.w, DIORAMA.y + DIORAMA.h);

  // Pie: número de hito y lo que sigue.
  ctx.fillStyle = tema.linea;
  ctx.fillRect(X, 984, BASE.ancho - X * 2, 1.5);
  ctx.font = `500 19px ${sans}`;
  ctx.fillStyle = tema.fantasma;
  ctx.fillText(`Hito ${String(indice + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`, X, 1022);
  const siguiente = hitos[indice + 1];
  const cierre = siguiente ? `Sigue: ${siguiente.anio} — ${siguiente.titulo}  →` : 'San Francisco, Córdoba';
  ctx.textAlign = 'right';
  ctx.fillText(cierre, BASE.ancho - X, 1022);
  ctx.textAlign = 'left';
  zona('Pie', X - 6, 972, BASE.ancho - X + 6, 1034);

  return { portada: lienzo, fondoVivo, zonas };
}
