import * as THREE from 'three';

// Texto chico dibujado en un canvas (el `Text` de drei pide una fuente por red).
export function texturaTexto(texto, color) {
  const lienzo = document.createElement('canvas');
  lienzo.width = 256;
  lienzo.height = 96;
  const ctx = lienzo.getContext('2d');
  ctx.font = '700 60px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(texto, 128, 50);
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}
