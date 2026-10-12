// Catálogo local de proyectos y acceso a la API remota (con respaldo local).
// Todos los comentarios están en español.
import proyectosLocales from '../data/proyectos.json' with { type: 'json' };
import { TECNOLOGIAS } from '../data/tecnologias.js';

// Adapta un proyecto remoto (Supabase/API) a los campos del catálogo local.
// Mapea title→titulo, description→resumen y technologies→stack.
// Los campos extra que vengan de la API (demo, repo, imagen, etc.) se conservan.
export function normalizarProyectoRemoto(row) {
  if (!row || typeof row !== 'object') return row;

  return {
    ...row,
    slug: row.slug ?? row.id,
    titulo: row.titulo ?? row.title ?? '',
    resumen: row.resumen ?? row.description ?? '',
    stack: row.stack ?? row.technologies ?? row.tecnologias ?? [],
  };
}

// Devuelve todos los proyectos locales ordenados por `orden` ascendente.
export function listarProyectos() {
  return [...proyectosLocales].sort((a, b) => a.orden - b.orden);
}

// Devuelve solo los proyectos destacados, ordenados por `orden`.
export function listarDestacados() {
  return listarProyectos().filter((proyecto) => proyecto.destacado);
}

// Busca un proyecto por su `slug`. Devuelve el proyecto o null si no existe.
export function obtenerProyecto(slug) {
  return listarProyectos().find((proyecto) => proyecto.slug === slug) ?? null;
}

// Devuelve las entradas del catálogo TECNOLOGIAS en el orden del `stack`
// del proyecto. Los ids que no existan en el catálogo se ignoran.
export function tecnologiasDe(proyecto) {
  if (!proyecto || !Array.isArray(proyecto.stack)) return [];
  const porId = new Map(TECNOLOGIAS.map((tecnologia) => [tecnologia.id, tecnologia]));
  return proyecto.stack.map((id) => porId.get(id)).filter(Boolean);
}

// Cifras para la cabecera de la sección: total de proyectos,
// cantidad de tipo cliente y cantidad de tipo laboral.
export function resumenCifras() {
  const total = proyectosLocales.length;
  const clientes = proyectosLocales.filter((proyecto) => proyecto.tipo === 'cliente').length;
  const laborales = proyectosLocales.filter((proyecto) => proyecto.tipo === 'laboral').length;
  return { total, clientes, laborales };
}

function baseUrlApi(urlExplicita) {
  if (urlExplicita) return urlExplicita.replace(/\/$/, '');
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
  }
  return 'http://localhost:4000';
}

// Lista los proyectos desde la API remota; si falla, usa el catálogo local.
export async function listarProyectosDesdeApi(baseUrl) {
  try {
    const res = await fetch(`${baseUrlApi(baseUrl)}/api/proyectos`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const payload = await res.json();
    const lista = Array.isArray(payload) ? payload : payload.proyectos ?? [];
    if (!Array.isArray(lista) || lista.length === 0) throw new Error('API sin proyectos');
    return lista.map(normalizarProyectoRemoto);
  } catch {
    return proyectosLocales;
  }
}

// Obtiene un proyecto por `slug` desde la API remota (con respaldo local).
export async function obtenerProyectoDesdeApi(slug, baseUrl) {
  const lista = await listarProyectosDesdeApi(baseUrl);
  return lista.find((proyecto) => proyecto.slug === slug) ?? null;
}
