const { getSupabaseClient } = require('../lib/supabaseClient');

function normalizarProyecto(row) {
  if (!row || typeof row !== 'object') return row;

  const pick = (...keys) => {
    for (const key of keys) {
      const value = row[key];
      if (typeof value === 'string' && value.trim().length > 0) return value;
      if (Array.isArray(value) && value.length > 0) return value;
      if (typeof value === 'boolean') return value;
    }
    return undefined;
  };

  return {
    ...row,
    slug: row.slug ?? row.id,
    titulo: pick('titulo', 'title') ?? '',
    resumen: pick('resumen', 'description') ?? '',
    stack: pick('stack', 'technologies', 'tecnologias') ?? [],
    descripcion_larga: pick('descripcion_larga', 'longDescription', 'longdescription') ?? '',
    imagen: pick('imagen', 'imageUrl', 'imageurl') ?? '',
    demo: pick('demo', 'liveLink', 'livelink') ?? '',
    destacado: Boolean(pick('destacado', 'isInProduction', 'isinproduction') ?? false),
  };
}

async function leerTabla(supabase, tabla) {
  const { data, error } = await supabase.from(tabla).select('*');

  if (error) {
    const err = new Error(`${tabla}: ${error.message}`);
    err.cause = error;
    // PGRST205 = tabla/vista no existe; 404 de PostgREST
    err.esTablaFaltante = error.code === 'PGRST205' || /Could not find the table/i.test(error.message);
    throw err;
  }

  return data ?? [];
}

async function listProyectos() {
  const supabase = getSupabaseClient();

  try {
    const data = await leerTabla(supabase, 'proyectos');
    return data.map(normalizarProyecto);
  } catch (err) {
    if (!err.esTablaFaltante) {
      const wrapped = new Error(err.message);
      wrapped.status = 502;
      throw wrapped;
    }
    // Fallback a la BD del portfolio viejo sin exigir la vista.
    const legacy = await leerTabla(supabase, 'projects');
    return legacy.map(normalizarProyecto);
  }
}

module.exports = { listProyectos, normalizarProyecto };
