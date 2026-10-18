// Colores del mundo 3D, leídos de los tokens del sitio. El fondo de viaje es el MISMO de la página en
// los dos temas: si fuera otro (antes, un gris azulado en tema claro), la unión con las secciones de
// arriba y de abajo se vería como un escalón de color.
export function leerColores(claro) {
  const estilo = getComputedStyle(document.documentElement);
  const leer = (nombre, respaldo) => estilo.getPropertyValue(nombre).trim() || respaldo;
  return {
    acento: leer('--color-accent', '#5b8cff'),
    fondo: leer('--color-bg', claro ? '#f5f6f8' : '#0b0d12'),
    apagado: claro ? '#8a93a6' : '#2a3350',
  };
}
