// Precarga en momentos libres: lo pesado (escenas 3D, su código) se prepara antes de que haga
// falta, así llegar a una sección (scrolleando o con un teletransporte del menú) no la arma en
// ese instante. Sólo en PC: en el celular cada escena se libera al alejarse por memoria.

// PC con mouse (no táctil) y pantalla ancha.
export function esEscritorio() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(min-width: 901px) and (hover: hover) and (pointer: fine)').matches;
}

// Corre `fn` cuando la página ya cargó, pasó `demora` ms (la bienvenida) y el navegador está
// ocioso. Devuelve con qué cancelarlo.
export function cuandoInactivo(fn, demora = 4000) {
  if (typeof window === 'undefined') return () => {};
  let cancelado = false;
  let reloj = 0;
  let ocio = 0;
  const pedir = () => {
    if (cancelado) return;
    if ('requestIdleCallback' in window) ocio = window.requestIdleCallback(() => !cancelado && fn(), { timeout: 3000 });
    else reloj = setTimeout(() => !cancelado && fn(), 200);
  };
  const arrancar = () => {
    reloj = setTimeout(pedir, demora);
  };
  if (document.readyState === 'complete') arrancar();
  else window.addEventListener('load', arrancar, { once: true });
  return () => {
    cancelado = true;
    clearTimeout(reloj);
    if (ocio && 'cancelIdleCallback' in window) window.cancelIdleCallback(ocio);
    window.removeEventListener('load', arrancar);
  };
}

// Corre una lista de tareas (funciones que devuelven promesas) de a una, cada una en un momento
// libre, para no juntar todo el trabajo en el mismo cuadro.
export function enCola(tareas, demora = 4000) {
  let cancelar = () => {};
  let i = 0;
  const siguiente = (espera) => {
    if (i >= tareas.length) return;
    cancelar = cuandoInactivo(() => {
      const tarea = tareas[i++];
      Promise.resolve()
        .then(tarea)
        .catch(() => {})
        .finally(() => siguiente(250));
    }, espera);
  };
  siguiente(demora);
  return () => cancelar();
}
