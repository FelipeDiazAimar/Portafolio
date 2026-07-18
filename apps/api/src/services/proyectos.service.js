const { getSupabaseClient } = require('../lib/supabaseClient');

async function listProyectos() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('proyectos').select('*');

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  return data;
}

module.exports = { listProyectos };
