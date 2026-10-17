// Categorías de las tecnologías (para filtrar el xilófono de Habilidades). Cada tecnología del
// catálogo (data/tecnologias.js) va en exactamente una categoría.
export const CATEGORIAS = [
  { id: 'lenguajes', nombre: 'Lenguajes', tecnologias: ['typescript', 'javascript', 'python', 'go', 'php', 'html', 'css'] },
  {
    id: 'frontend',
    nombre: 'Frontend',
    tecnologias: [
      'nextjs', 'react', 'vite', 'tailwind', 'shadcn', 'mui', 'zustand', 'tanstack', 'radix',
      'reacthookform', 'zod', 'reactrouter', 'bootstrap', 'axios', 'recharts', 'leaflet', 'expo', 'electron',
    ],
  },
  { id: 'animacion', nombre: '3D y animación', tecnologias: ['framer', 'gsap', 'threejs', 'webgl', 'lenis', 'godot'] },
  { id: 'backend', nombre: 'Backend', tecnologias: ['node', 'express', 'socketio', 'flask', 'jwt', 'sequelize'] },
  { id: 'datos', nombre: 'Datos', tecnologias: ['supabase', 'postgresql', 'mysql', 'sqlite', 'sqlserver', 'firebase', 'awss3'] },
  { id: 'ia', nombre: 'IA', tecnologias: ['gemini', 'openrouter', 'genkit', 'mcp', 'claude'] },
  { id: 'integraciones', nombre: 'Integraciones', tecnologias: ['sap', 'mercadopago', 'whatsapp', 'activedirectory'] },
  { id: 'infra', nombre: 'Infra y DevOps', tecnologias: ['docker', 'kubernetes', 'vercel', 'render', 'cloudflare', 'git', 'github'] },
  { id: 'calidad', nombre: 'Calidad', tecnologias: ['vitest', 'testinglibrary', 'prettier', 'eslint'] },
];
