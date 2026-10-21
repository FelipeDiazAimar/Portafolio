// Qué sección de la página principal se está mirando, para mantener la URL (#hash) al día mientras
// se hace scroll. `secciones`: [{ id, top, bottom }] en el orden de la página (top/bottom son las
// del getBoundingClientRect). Cuenta como "la actual" la última cuyo borde de arriba ya pasó una
// línea de lectura situada a `referencia` × el alto de la ventana (por defecto, 40 % desde arriba).
export const IDS_SECCIONES = ['inicio', 'sobre-mi', 'proyectos', 'experiencia', 'titulos', 'habilidades', 'contacto'];

export function seccionActual(secciones, alto, referencia = 0.4) {
  const linea = alto * referencia;
  let actual = null;
  for (const seccion of secciones) {
    if (seccion.top <= linea) actual = seccion.id;
  }
  return actual ?? secciones[0]?.id ?? null;
}

// URL (ruta + búsqueda + hash) para una sección: el inicio va sin hash.
export function urlDeSeccion(id, ruta, busqueda = '') {
  return id === 'inicio' ? `${ruta}${busqueda}` : `${ruta}${busqueda}#${id}`;
}
