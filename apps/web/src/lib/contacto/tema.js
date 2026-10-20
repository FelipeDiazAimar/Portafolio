// Tema efectivo del sitio (mismas reglas que tokens.css): el atributo data-theme
// manda y, sin él, se sigue la preferencia del sistema (oscuro por defecto).
export function temaActual() {
  const atributo = document.documentElement.getAttribute('data-theme');
  if (atributo === 'light' || atributo === 'dark') return atributo;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

// Avisa cuando cambia el tema (por el toggle o por el sistema). Devuelve cómo dejar de escuchar.
export function observarTema(alCambiar) {
  const observador = new MutationObserver(alCambiar);
  observador.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const consulta = window.matchMedia('(prefers-color-scheme: light)');
  consulta.addEventListener('change', alCambiar);
  return () => {
    observador.disconnect();
    consulta.removeEventListener('change', alCambiar);
  };
}
