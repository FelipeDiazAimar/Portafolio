const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = require('../config/env');

let client = null;

function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const err = new Error('Supabase no está configurado: faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    err.status = 500;
    throw err;
  }

  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  }

  return client;
}

module.exports = { getSupabaseClient };
