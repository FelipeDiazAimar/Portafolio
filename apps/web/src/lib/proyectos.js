import proyectos from '../data/proyectos.json';

export function listarProyectos() {
  return proyectos;
}

export function obtenerProyecto(slug) {
  return proyectos.find((proyecto) => proyecto.slug === slug) ?? null;
}
