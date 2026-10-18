// Buscador de tecnologías de Habilidades. "Inteligente" en tres sentidos:
// - tolera tildes, mayúsculas y errores de tipeo (distancia de edición);
// - entiende sinónimos y búsquedas por intención ("base de datos", "ia", "pagos", "mobile");
// - mira también los proyectos: buscar el nombre de un proyecto trae su stack.
// Puro (sin DOM), para poder probarlo.

export function normalizar(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// término (ya normalizado) → ids de tecnologías o de categorías (prefijo "cat:")
const SINONIMOS = {
  'base de datos': ['cat:datos'],
  'bases de datos': ['cat:datos'],
  bd: ['cat:datos'],
  db: ['cat:datos'],
  database: ['cat:datos'],
  sql: ['postgresql', 'mysql', 'sqlite', 'sqlserver'],
  postgres: ['postgresql'],
  pg: ['postgresql'],
  ia: ['cat:ia'],
  ai: ['cat:ia'],
  'inteligencia artificial': ['cat:ia'],
  llm: ['cat:ia'],
  gpt: ['openrouter', 'gemini', 'claude'],
  chatbot: ['gemini', 'openrouter', 'whatsapp'],
  agentes: ['mcp', 'claude', 'genkit'],
  agents: ['mcp', 'claude', 'genkit'],
  front: ['cat:frontend'],
  ui: ['cat:frontend'],
  interfaz: ['cat:frontend'],
  back: ['cat:backend'],
  api: ['cat:backend'],
  servidor: ['cat:backend'],
  server: ['cat:backend'],
  movil: ['expo'],
  mobile: ['expo'],
  celular: ['expo'],
  android: ['expo'],
  ios: ['expo'],
  app: ['expo', 'electron'],
  escritorio: ['electron'],
  desktop: ['electron'],
  estilos: ['tailwind', 'css', 'mui', 'shadcn', 'bootstrap'],
  diseno: ['tailwind', 'css', 'mui', 'shadcn', 'radix'],
  animacion: ['cat:animacion'],
  animaciones: ['cat:animacion'],
  '3d': ['threejs', 'webgl', 'godot'],
  motion: ['framer', 'gsap'],
  devops: ['cat:infra'],
  deploy: ['vercel', 'render', 'docker'],
  despliegue: ['vercel', 'render', 'docker'],
  nube: ['vercel', 'render', 'cloudflare', 'awss3'],
  cloud: ['vercel', 'render', 'cloudflare', 'awss3'],
  contenedores: ['docker', 'kubernetes'],
  tests: ['cat:calidad'],
  testing: ['cat:calidad'],
  pruebas: ['cat:calidad'],
  lint: ['eslint', 'prettier'],
  pagos: ['mercadopago'],
  cobros: ['mercadopago'],
  mapas: ['leaflet'],
  maps: ['leaflet'],
  graficos: ['recharts'],
  charts: ['recharts'],
  dashboard: ['recharts', 'mui'],
  'tiempo real': ['socketio'],
  realtime: ['socketio'],
  websocket: ['socketio'],
  sockets: ['socketio'],
  auth: ['jwt', 'activedirectory', 'supabase', 'firebase'],
  login: ['jwt', 'activedirectory', 'supabase', 'firebase'],
  autenticacion: ['jwt', 'activedirectory', 'supabase', 'firebase'],
  erp: ['sap'],
  mensajes: ['whatsapp'],
  chat: ['whatsapp', 'socketio'],
  formularios: ['reacthookform', 'zod'],
  forms: ['reacthookform', 'zod'],
  validacion: ['zod', 'reacthookform'],
  estado: ['zustand', 'tanstack'],
  state: ['zustand', 'tanstack'],
  juegos: ['godot', 'threejs'],
  videojuegos: ['godot', 'threejs'],
  game: ['godot', 'threejs'],
  almacenamiento: ['awss3', 'cloudflare', 'supabase'],
  storage: ['awss3', 'cloudflare', 'supabase'],
  archivos: ['awss3', 'cloudflare'],
  js: ['javascript'],
  ts: ['typescript'],
  py: ['python'],
  golang: ['go'],
  scroll: ['lenis', 'gsap'],
  rutas: ['reactrouter'],
  routing: ['reactrouter'],
};

// Distancia de edición (Levenshtein) acotada: corta en cuanto supera `maximo`.
export function distancia(a, b, maximo = 3) {
  if (Math.abs(a.length - b.length) > maximo) return maximo + 1;
  let previa = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const actual = [i];
    let menor = i;
    for (let j = 1; j <= b.length; j += 1) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      actual[j] = Math.min(previa[j] + 1, actual[j - 1] + 1, previa[j - 1] + costo);
      menor = Math.min(menor, actual[j]);
    }
    if (menor > maximo) return maximo + 1;
    previa = actual;
  }
  return previa[b.length];
}

function puntajeTexto(consulta, objetivo) {
  if (!consulta || !objetivo) return 0;
  if (objetivo === consulta) return 100;
  if (objetivo.startsWith(consulta)) return 85;
  const palabras = objetivo.split(' ');
  if (palabras.some((p) => p.startsWith(consulta))) return 72;
  if (consulta.length >= 3 && objetivo.includes(consulta)) return 58;
  if (consulta.length >= 4) {
    const tolerancia = consulta.length >= 7 ? 2 : 1;
    const mejor = Math.min(...palabras.map((p) => distancia(consulta, p.slice(0, consulta.length + 1), tolerancia)), distancia(consulta, objetivo, tolerancia));
    if (mejor <= tolerancia) return 48 - mejor * 6;
  }
  return 0;
}

// Devuelve hasta `limite` resultados: { id, nombre, puntaje, motivo, proyectos: [títulos] }.
export function buscarTecnologias(consulta, { tecnologias, categorias, proyectos = [] }, limite = 7) {
  const q = normalizar(consulta);
  if (!q) return [];
  const categoriaDe = new Map();
  categorias.forEach((c) => c.tecnologias.forEach((id) => categoriaDe.set(id, c)));
  const proyectosDe = new Map();
  proyectos.forEach((p) => (p.stack ?? []).forEach((id) => proyectosDe.set(id, [...(proyectosDe.get(id) ?? []), p.titulo])));

  const resultados = new Map();
  const sumar = (id, puntaje, motivo) => {
    if (puntaje <= 0) return;
    const previo = resultados.get(id);
    if (!previo || previo.puntaje < puntaje) resultados.set(id, { puntaje, motivo });
  };
  const expandir = (claves, puntaje, motivo) => {
    claves.forEach((clave) => {
      if (clave.startsWith('cat:')) {
        const cat = categorias.find((c) => c.id === clave.slice(4));
        cat?.tecnologias.forEach((id) => sumar(id, puntaje, motivo ?? cat.nombre));
      } else sumar(clave, puntaje, motivo);
    });
  };

  // 1) nombre, id y sigla de cada tecnología
  tecnologias.forEach((t) => {
    const p = Math.max(puntajeTexto(q, normalizar(t.nombre)), puntajeTexto(q, t.id), normalizar(t.sigla) === q ? 70 : 0);
    sumar(t.id, p, null);
  });
  // 2) categorías por nombre
  categorias.forEach((c) => {
    const p = puntajeTexto(q, normalizar(c.nombre));
    if (p >= 58) expandir([`cat:${c.id}`], 52, c.nombre);
  });
  // 3) sinónimos: la frase entera y cada palabra
  const palabras = q.split(' ');
  if (SINONIMOS[q]) expandir(SINONIMOS[q], 64, null);
  palabras.forEach((palabra) => {
    if (SINONIMOS[palabra]) expandir(SINONIMOS[palabra], 56, null);
  });
  // 4) proyectos: si la búsqueda nombra un proyecto, trae su stack
  proyectos.forEach((p) => {
    const puntaje = puntajeTexto(q, normalizar(p.titulo));
    if (puntaje >= 58) (p.stack ?? []).forEach((id) => sumar(id, 40, `Stack de ${p.titulo}`));
  });

  const porId = new Map(tecnologias.map((t) => [t.id, t]));
  return [...resultados.entries()]
    .filter(([id]) => porId.has(id))
    .map(([id, r]) => ({
      id,
      nombre: porId.get(id).nombre,
      puntaje: r.puntaje + Math.min(6, (proyectosDe.get(id)?.length ?? 0)), // a igual puntaje, la más usada
      motivo: r.motivo ?? categoriaDe.get(id)?.nombre ?? '',
      proyectos: proyectosDe.get(id) ?? [],
    }))
    .sort((a, b) => b.puntaje - a.puntaje || a.nombre.localeCompare(b.nombre))
    .slice(0, limite);
}
