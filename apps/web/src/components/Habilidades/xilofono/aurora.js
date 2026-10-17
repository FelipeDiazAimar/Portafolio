// Colores para el fondo "aurora" (adaptado de <Aurora /> de React Bits, reactbits.dev): los
// colores se mezclan en OKLCH, así el degradé entre dos azules no pasa por grises apagados.
// Funciones puras (sin three ni DOM) para poder probarlas.

export const MAX_COLORES_AURORA = 5;

// '#rrggbb' → [r, g, b] en 0..1
export function hexARgb(hex) {
  const limpio = hex.replace('#', '');
  const completo = limpio.length === 3 ? limpio.split('').map((c) => c + c).join('') : limpio;
  const n = parseInt(completo, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// sRGB (0..1) → OKLCH [L, C, h en radianes]
export function aOklch(rgb) {
  const [r, g, b] = rgb.map((c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const lab = [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
  return [lab[0], Math.hypot(lab[1], lab[2]), Math.atan2(lab[2], lab[1])];
}

// Desenrolla los tonos para que el degradé vaya por el camino corto del círculo de color.
export function desenrollarTonos(colores) {
  const conocido = colores.findIndex((c) => c[1] > 0.02);
  let previo = conocido === -1 ? 0 : colores[conocido][2];
  return colores.map((c) => {
    let tono = c[1] > 0.02 ? c[2] : previo;
    while (tono - previo > Math.PI) tono -= Math.PI * 2;
    while (tono - previo < -Math.PI) tono += Math.PI * 2;
    previo = tono;
    return [c[0], c[1], tono];
  });
}

// Lista de colores hex → valores para los uniforms del shader (hasta 5 colores, mínimo 2).
export function coloresAurora(hexes) {
  const lista = hexes.slice(0, MAX_COLORES_AURORA);
  const pares = lista.length >= 2 ? lista : [lista[0] ?? '#0057ff', lista[0] ?? '#0057ff'];
  const oklch = desenrollarTonos(pares.map((h) => aOklch(hexARgb(h))));
  const relleno = Array.from({ length: MAX_COLORES_AURORA }, (_, i) => oklch[Math.min(i, oklch.length - 1)]);
  return { colores: relleno, cantidad: oklch.length };
}
