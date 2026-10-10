import proyectosLocales from '../data/proyectos.json';

export function normalizarProyectoRemoto(row) {
  if (!row || typeof row !== 'object') return row;

  return {
    slug: row.slug ?? row.id,
    titulo: row.titulo ?? row.title ?? '',
    resumen: row.resumen ?? row.description ?? '',
    stack: row.stack ?? row.technologies ?? row.tecnologias ?? [],
    // Se conservan los campos extra (demo, repo, imagen, etc.) si vienen de Supabase.
    ...row,
  };
}

export function listarProyectos() {
  return proyectosLocales;
}

export function obtenerProyecto(slug) {
  return proyectosLocales.find((proyecto) => proyecto.slug === slug) ?? null;
}

function baseUrlApi(urlExplicita) {
  if (urlExplicita) return urlExplicita.replace(/\/$/, '');
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
  }
  return 'http://localhost:4000';
}

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

export async function obtenerProyectoDesdeApi(slug, baseUrl) {
  const lista = await listarProyectosDesdeApi(baseUrl);
  return lista.find((proyecto) => proyecto.slug === slug) ?? null;
}
