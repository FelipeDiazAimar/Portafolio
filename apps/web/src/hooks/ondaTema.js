const DURACION_MS = 1300;
const CURVA = 'cubic-bezier(.45,.05,.35,1)';

// Cambia el tema con una onda expansiva que nace en `origen` (el botón que se
// tocó) y avanza hasta cubrir toda la pantalla. `aplicar` hace el cambio real
// (atributo de <html>, estado); acá sólo se anima la revelación del estado nuevo.
// Sin View Transitions o con movimiento reducido, aplica el cambio sin animar.
export default function cambiarTemaConOnda(origen, aplicar) {
  const sinAnimacion =
    typeof document.startViewTransition !== 'function' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (sinAnimacion) {
    aplicar();
    return;
  }

  const caja = origen?.getBoundingClientRect?.();
  const x = caja ? caja.left + caja.width / 2 : window.innerWidth - 60;
  const y = caja ? caja.top + caja.height / 2 : 40;
  const radio = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

  const html = document.documentElement;
  // Evita que las transiciones de color propias mezclen estados dentro de la captura.
  html.classList.add('onda-tema');

  const aro = document.createElement('div');
  aro.className = 'onda-tema-aro';
  aro.style.left = `${x}px`;
  aro.style.top = `${y}px`;
  document.body.appendChild(aro);

  const transicion = document.startViewTransition(aplicar);

  transicion.ready.then(() => {
    html.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radio}px at ${x}px ${y}px)`] },
      { duration: DURACION_MS, easing: CURVA, pseudoElement: '::view-transition-new(root)', fill: 'both' },
    );
    aro.animate(
      [
        { width: '0px', height: '0px', opacity: 1 },
        { width: `${radio * 2}px`, height: `${radio * 2}px`, opacity: 0 },
      ],
      { duration: DURACION_MS, easing: CURVA, fill: 'both' },
    );
  });

  transicion.finished.finally(() => {
    aro.remove();
    html.classList.remove('onda-tema');
  });
}
