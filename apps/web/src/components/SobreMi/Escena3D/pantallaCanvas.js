import * as THREE from 'three';

// Crea un <canvas> 2D y la textura de three que lo muestra. Hay que volver a
// marcar `textura.needsUpdate = true` cada vez que se redibuja el canvas.
export function crearPantalla(ancho, alto) {
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext('2d');
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 8;
  return { lienzo, ctx, textura, ancho, alto };
}
