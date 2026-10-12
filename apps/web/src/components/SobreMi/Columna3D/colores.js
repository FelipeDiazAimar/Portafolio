// Colores del mundo 3D, leídos de los tokens del sitio. El fondo de viaje en tema claro
// es un gris azulado (más oscuro que el fondo de la página) para que la columna se lea.
export function leerColores(claro) {
  const estilo = getComputedStyle(document.documentElement);
  const leer = (nombre, respaldo) => estilo.getPropertyValue(nombre).trim() || respaldo;
  return {
    acento: leer('--color-accent', '#5b8cff'),
    fondo: claro ? '#e9edf5' : leer('--color-bg', '#0b0d12'),
    apagado: claro ? '#8a93a6' : '#2a3350',
  };
}
