// Modo rendimiento del sitio (toggle arriba a la derecha): se lee de <html data-rendimiento>.
// Sin React, para que lo usen las escenas 3D.

export const EVENTO_RENDIMIENTO = 'portafolio:rendimiento';

export function modoRendimiento() {
  if (typeof document === 'undefined') return false;
  return document.documentElement.getAttribute('data-rendimiento') === 'true';
}

// Densidad de píxeles para un lienzo WebGL: la de la pantalla hasta `maximo`; en modo
// rendimiento, nunca más de 1 (en pantallas 2× son 4 veces menos píxeles).
export function densidadPixeles(maximo = 2) {
  const pantalla = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  return Math.min(pantalla, maximo, modoRendimiento() ? 1 : Infinity);
}
