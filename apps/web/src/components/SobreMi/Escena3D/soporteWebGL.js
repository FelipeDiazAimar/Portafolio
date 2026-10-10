// ¿Hay WebGL? `crearLienzo` se inyecta para poder probar la función sin DOM.
export function hayWebGL(crearLienzo = () => document.createElement('canvas')) {
  try {
    const lienzo = crearLienzo();
    return Boolean(lienzo.getContext('webgl2') || lienzo.getContext('webgl'));
  } catch {
    return false;
  }
}
