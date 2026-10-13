// Cómo se ve la tarjeta de cada proyecto en la marquesina y de fondo en su vista.
// - `logo`: logo real del proyecto (sacado de su repo), con `fondo` acorde a sus colores.
// - Sin logo (sistemas internos o proyectos sin marca propia): el nombre en tipografía,
//   `nombre` + `bajada`, sobre un degradé del color del proyecto.
// `claro` indica que el fondo es claro (para el velo y el texto encima).
export const MARCAS = {
  'mbrf-captura': { nombre: 'Traza SF', bajada: 'Data collector · MBRF' },
  'mbrf-control': { nombre: 'Control de planta', bajada: 'Planeamiento · MBRF' },
  neifert: { logo: '/proyectos/neifert/marca.webp', fondo: '#0d0f14' },
  'dario-martinez': { logo: '/proyectos/dario-martinez/marca.webp', fondo: '#f4f6fb', claro: true },
  justphones: { logo: '/proyectos/justphones/marca.webp', fondo: '#111214' },
  algobonito: { logo: '/proyectos/algobonito/marca.webp', fondo: '#f3ede4', claro: true },
  'calida-escencia': { logo: '/proyectos/calida-escencia/marca.webp', fondo: '#f6efe9', claro: true },
  asistente: { nombre: 'Asistente IA', bajada: 'Atención primaria' },
  'control-salidas-rrhh': { nombre: 'Control de salidas', bajada: 'RRHH · MBRF' },
  'gestor-proyectos-sap': { nombre: 'Gestor SAP', bajada: 'Proyectos · MBRF' },
  bibliotech: { nombre: 'BiblioTech', bajada: 'Biblioteca inteligente' },
  movii: { logo: '/proyectos/movii/marca.webp', fondo: '#10131c', nombre: 'Movii', bajada: 'Última milla' },
  'crm-inmobiliaria': { nombre: 'CRM', bajada: 'Inmobiliaria' },
};

export function marcaDe(slug) {
  return MARCAS[slug] ?? {};
}
