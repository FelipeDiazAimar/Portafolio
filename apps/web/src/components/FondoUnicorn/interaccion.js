// Interacción con la escena de Unicorn más allá de lo que trae el export (que sólo sigue al mouse):
//  - hover: la onda sigue al puntero (trackMouse de cada capa, ver public/escenas/aurora.json);
//  - agarrar y arrastrar: el seguimiento sube al máximo y la onda se estira detrás del puntero; al
//    soltar vuelve sola a su forma;
//  - clic: un pulso que acelera la animación y se apaga en un segundo.
// Se maneja tocando en vivo `trackMouse` y `speed` de las capas: el SDK los lee en cada cuadro (la
// velocidad acumula tiempo, así que cambiarla no hace saltar la animación).

const SEGUIMIENTO_ARRASTRE = { gradient: 0.8, nebula: 1, normalMap: 0.9 };
const ACELERACION_PULSO = 4; // ×(1 + esto) la velocidad justo después del clic
const ACELERACION_ARRASTRE = 1.2;
// constantes de tiempo (ms): cuánto tarda en agarrar, en volver a su forma al soltar y en apagarse
// el pulso del clic. Por tiempo y no por cuadro: igual en 60 Hz que en 144 Hz.
const TAU_AGARRAR = 120;
const TAU_SOLTAR = 450;
const TAU_PULSO = 380;

// No se agarra la escena desde un botón o un link (que hagan lo suyo).
function esControl(objetivo) {
  return objetivo instanceof Element && !!objetivo.closest('a, button, input, select, textarea, label');
}

// `zona`: el elemento donde vale agarrar (la portada entera, con el texto encima incluido).
// Devuelve con qué desconectarla.
export function conectarInteraccion(escena, zona) {
  const capas = (escena?.layers ?? [])
    .filter((capa) => typeof capa.speed === 'number' || typeof capa.trackMouse === 'number')
    .map((capa) => ({
      capa,
      seguimiento: capa.trackMouse ?? 0,
      seguimientoMax: Math.max(capa.trackMouse ?? 0, SEGUIMIENTO_ARRASTRE[capa.type] ?? 0),
      velocidad: capa.speed,
    }));
  if (!capas.length || !zona) return () => {};

  let arrastrando = false;
  let fuerza = 0;
  let pulso = 0;
  let cuadro = 0;
  let previo = 0;

  const aplicar = () => {
    for (const { capa, seguimiento, seguimientoMax, velocidad } of capas) {
      if (seguimientoMax > 0) capa.trackMouse = seguimiento + (seguimientoMax - seguimiento) * fuerza;
      if (typeof velocidad === 'number') capa.speed = velocidad * (1 + pulso * ACELERACION_PULSO + fuerza * ACELERACION_ARRASTRE);
    }
  };

  // el bucle corre sólo mientras hay algo que animar
  const paso = (ahora) => {
    // la marca del primer cuadro puede ser anterior a performance.now() de despertar(): nunca negativo
    const dt = Math.min(Math.max(ahora - previo, 0), 100);
    previo = ahora;
    fuerza += ((arrastrando ? 1 : 0) - fuerza) * (1 - Math.exp(-dt / (arrastrando ? TAU_AGARRAR : TAU_SOLTAR)));
    pulso *= Math.exp(-dt / TAU_PULSO);
    const quieto = !arrastrando && fuerza < 0.002 && pulso < 0.002;
    if (quieto) {
      fuerza = 0;
      pulso = 0;
    }
    aplicar();
    cuadro = quieto ? 0 : requestAnimationFrame(paso);
  };
  const despertar = () => {
    if (cuadro) return;
    previo = performance.now();
    cuadro = requestAnimationFrame(paso);
  };

  const presionar = (evento) => {
    if (evento.button !== 0 || esControl(evento.target)) return;
    arrastrando = true;
    pulso = 1;
    zona.setAttribute('data-arrastrando', '');
    despertar();
  };
  const soltar = () => {
    if (!arrastrando) return;
    arrastrando = false;
    zona.removeAttribute('data-arrastrando');
    despertar();
  };

  zona.addEventListener('pointerdown', presionar);
  window.addEventListener('pointerup', soltar);
  window.addEventListener('pointercancel', soltar);
  window.addEventListener('blur', soltar);

  return () => {
    cancelAnimationFrame(cuadro);
    zona.removeEventListener('pointerdown', presionar);
    window.removeEventListener('pointerup', soltar);
    window.removeEventListener('pointercancel', soltar);
    window.removeEventListener('blur', soltar);
    zona.removeAttribute('data-arrastrando');
  };
}
