// Puntos de paso de la línea del sitio dibujados a mano (modo editor: `?editarLinea`).
//
// Se guardan relativos a cada sección, así siguen bien al cambiar el tamaño de la ventana:
//   { s: 'id de la sección' (o 'footer'), fx: x / ancho de la ventana, fy: (y − arriba de la sección) / alto de la ventana }
// Tramos editables (los extremos que empalman con las partes fijas los pone el código):
//   hero: la bajada del hero hasta el borde de Sobre mí
//   a:    de Proyectos hasta la punta de la línea del piso del pasillo
//   c:    del borde de abajo de Títulos hasta el punto de "Gracias por pasar."
// Prioridad: lo que se está editando en este navegador (localStorage) y, si no, lo guardado en el
// proyecto (src/data/lineaPuntos.json). Un tramo vacío usa el recorrido de siempre.
import guardados from '@/data/lineaPuntos.json';

export const TRAMOS_EDITABLES = [
  { id: 'hero', nombre: 'Hero → Sobre mí' },
  { id: 'a', nombre: 'Proyectos → Pasillo' },
  { id: 'c', nombre: 'Títulos → Final' },
];
export const SECCIONES_LINEA = ['inicio', 'sobre-mi', 'proyectos', 'experiencia', 'titulos', 'habilidades', 'contacto', 'footer'];
export const EVENTO_LINEA_EDITADA = 'portafolio:linea-editada';
const CLAVE = 'portafolio:linea-puntos';

export function editando() {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('editarLinea');
}

export function puntosLinea() {
  if (typeof window !== 'undefined' && editando()) {
    try {
      const local = JSON.parse(window.localStorage.getItem(CLAVE) ?? 'null');
      if (local) return { hero: [], a: [], c: [], ...local };
    } catch {
      /* sin almacenamiento */
    }
  }
  return { hero: [], a: [], c: [], ...guardados };
}

export function guardarPuntosLocal(puntos) {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(puntos));
  } catch {
    /* sin almacenamiento */
  }
  window.dispatchEvent(new Event(EVENTO_LINEA_EDITADA));
}

function nodoSeccion(id) {
  return id === 'footer' ? document.querySelector('footer') : document.getElementById(id);
}

// Arriba de cada sección en px de página.
export function arribasSecciones() {
  const y0 = window.scrollY;
  const mapa = {};
  for (const id of SECCIONES_LINEA) {
    const n = nodoSeccion(id);
    if (n) mapa[id] = n.getBoundingClientRect().top + y0;
  }
  return mapa;
}

// Punto guardado → px de página.
export function aPagina(p, arribas, vw = window.innerWidth, vh = window.innerHeight) {
  const arriba = arribas[p.s] ?? 0;
  return [p.fx * vw, arriba + p.fy * vh];
}

// px de página → punto guardado (en la sección que contiene esa altura).
export function dePagina(x, y, arribas, vw = window.innerWidth, vh = window.innerHeight) {
  let s = 'inicio';
  for (const id of SECCIONES_LINEA) {
    if (arribas[id] !== undefined && arribas[id] <= y) s = id;
  }
  return { s, fx: +(x / vw).toFixed(4), fy: +((y - (arribas[s] ?? 0)) / vh).toFixed(4) };
}
