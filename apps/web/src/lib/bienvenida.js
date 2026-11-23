// La Bienvenida es la portada del inicio: tapa el hero hasta que el visitante baja (rueda, dedo,
// teclado o el botón). Lo que arranca "al aparecer el hero" (nombre, retrato, menú) espera este
// aviso en vez de un tiempo fijo, porque ahora cuánto dura la portada depende del visitante.
//
// Al irse no se puede volver subiendo. Al recargar vuelve sólo si la página estaba en el hero: si
// el visitante estaba más abajo (Sobre mí, Proyectos...) recarga ahí, sin portada. `?bienvenida`
// en la URL la fuerza. Fuera del inicio, o con un #ancla, no se muestra.

export const EVENTO_FIN_BIENVENIDA = 'portafolio:bienvenida-fin';
export const CLAVE_BIENVENIDA_VISTA = 'portafolio:bienvenida-vista';

let terminada = false;

// El script del <head> (layout) marca <html data-sin-bienvenida> antes de pintar cuando la portada
// no va: así no se ve ni un cuadro en una recarga.
export function bienvenidaTerminada() {
  if (terminada || typeof document === 'undefined') return terminada;
  return document.documentElement.hasAttribute('data-sin-bienvenida');
}

export function terminarBienvenida() {
  if (terminada) return;
  terminada = true;
  window.dispatchEvent(new Event(EVENTO_FIN_BIENVENIDA));
}

// Corre `fn` `demora` ms después de que se va la portada (o ya, si no hay). Devuelve con qué
// cancelarlo.
export function trasBienvenida(fn, demora = 0) {
  if (typeof window === 'undefined') return () => {};
  let reloj = 0;
  const arrancar = () => {
    reloj = setTimeout(fn, demora);
  };
  if (bienvenidaTerminada()) {
    arrancar();
    return () => clearTimeout(reloj);
  }
  window.addEventListener(EVENTO_FIN_BIENVENIDA, arrancar, { once: true });
  return () => {
    clearTimeout(reloj);
    window.removeEventListener(EVENTO_FIN_BIENVENIDA, arrancar);
  };
}

// Para el script del <head>: decide antes de pintar si la portada no va. Al dejar la página (recarga,
// cerrar, ir a otro sitio) anota si quedó fuera del hero; la próxima carga en esta pestaña lo lee.
// Los scripts de prueba ponen la clave en '1' antes de cargar para saltearla.
export const SCRIPT_BIENVENIDA = `(function() {
  try {
    var clave = '${CLAVE_BIENVENIDA_VISTA}';
    var forzada = new URLSearchParams(location.search).has('bienvenida');
    if (forzada) sessionStorage.removeItem(clave);
    if (location.pathname !== '/' || (!forzada && (location.hash.length > 1 || sessionStorage.getItem(clave) === '1'))) {
      document.documentElement.setAttribute('data-sin-bienvenida', '');
      // recarga (F5, Ctrl+Shift+R) sin portada: igual se ve el loader (CargadorRecarga)
      var nav = performance.getEntriesByType('navigation')[0];
      if (nav && nav.type === 'reload') document.documentElement.setAttribute('data-cargador-recarga', '');
    }
    addEventListener('pagehide', function() {
      try {
        if (location.pathname !== '/') return;
        if (window.scrollY < window.innerHeight * 0.5) sessionStorage.removeItem(clave);
        else sessionStorage.setItem(clave, '1');
      } catch (e) {}
    });
  } catch (e) {}
})();`;
