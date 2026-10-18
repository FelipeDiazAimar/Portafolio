// Teletransporte entre secciones: el menú no recorre el scroll, lleva directo a la sección real.
//
// - Hover sobre un ítem (vista previa): el scroll salta al instante a esa sección, como si ya
//   hubieras ido, y al sacar el mouse del menú vuelve a donde estabas. Mientras dura, el header y lo
//   que depende del scroll quedan congelados, para que el menú no cambie bajo el mouse.
// - Clic: el salto queda confirmado.
// Todo pasa en la misma página con la sección real (su 3D, su interacción), sin copias.

const DEMORA_SALIDA_MS = 160; // pasar de un ítem al siguiente no vuelve al origen entre medio

/* ------------------------------ lógica pura ------------------------------ */

// Y de scroll al que hay que ir para ver la sección `id` arriba de todo. `medir(id)` devuelve
// { top (relativo a la ventana), margen (scroll-margin-top) } o null si no existe.
export function destinoDeScroll(id, scrollActual, medir, maximo = Infinity) {
  if (id === 'inicio') return 0;
  const m = medir(id);
  if (!m) return null;
  return Math.min(Math.max(0, Math.round(m.top + scrollActual - (m.margen || 0))), Math.max(0, maximo));
}

// Máquina de estados de la vista previa. `origen`: scroll desde el que se empezó a mirar;
// `viendo`: id de la sección que se está mirando.
export function crearMaquina() {
  let origen = null;
  let viendo = null;
  return {
    // Empieza o cambia la vista previa. Devuelve el origen guardado.
    mirar(id, scrollActual) {
      if (origen === null) origen = scrollActual;
      viendo = id;
      return origen;
    },
    // Termina la vista previa volviendo. Devuelve a dónde volver (o null si no había).
    volver() {
      const a = origen;
      origen = null;
      viendo = null;
      return a;
    },
    // Termina la vista previa quedándose donde se está.
    quedarse() {
      origen = null;
      viendo = null;
    },
    get activa() {
      return origen !== null;
    },
    get viendo() {
      return viendo;
    },
  };
}

/* --------------------------- almacén (navegador) --------------------------- */

const maquina = crearMaquina();
const oyentes = new Set();
let congelado = false;
let temporizadorSalida = 0;
let saltos = 0;

// Posición real del mouse. Tras un clic el header cambia de forma (píldora grande → mini-píldoras)
// y el ítem que queda bajo el mouse quieto dispararía una vista previa que nadie pidió (otro salto
// y otro velo). Hasta que el mouse se mueva de verdad, esos hovers se ignoran.
const mouse = { x: 0, y: 0 };
let anclaClic = null;
if (typeof window !== 'undefined') {
  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }, { passive: true });
}
function mouseQuieto() {
  if (!anclaClic) return false;
  if (Math.hypot(mouse.x - anclaClic.x, mouse.y - anclaClic.y) < 6) return true;
  anclaClic = null;
  return false;
}

function avisar() {
  oyentes.forEach((f) => f());
}

export function alCambiarTeletransporte(f) {
  oyentes.add(f);
  return () => oyentes.delete(f);
}

// ¿Hay una vista previa en curso? Lo leen el header y lo que depende del scroll para no reaccionar.
export function estaCongelado() {
  return congelado;
}

export function cantidadDeSaltos() {
  return saltos;
}

function medirSeccion(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  // Sin scroll-margin-top: ese margen deja aire sobre el destino cuando se llega por un ancla, pero
  // en un teletransporte la sección tiene que quedar pegada al borde, sin una franja de la anterior.
  return { top: el.getBoundingClientRect().top, margen: 0 };
}

function maximoScroll() {
  return document.documentElement.scrollHeight - window.innerHeight;
}

function saltar(y, rapido) {
  window.scrollTo({ top: y, behavior: 'instant' });
  saltos += 1;
  // `rapido`: salto de vista previa (velo corto); si no, el de un clic
  document.documentElement.dataset.saltoRapido = rapido ? 'true' : 'false';
  avisar();
}

function congelar(valor) {
  congelado = valor;
  if (valor) document.documentElement.dataset.sinIman = 'true';
  else delete document.documentElement.dataset.sinIman;
  avisar();
}

// Hover sobre un ítem del menú: salta a esa sección.
export function vistaPrevia(id) {
  clearTimeout(temporizadorSalida);
  if (mouseQuieto()) return;
  const y = destinoDeScroll(id, window.scrollY, medirSeccion, maximoScroll());
  if (y === null) return;
  // ya estás ahí (por ejemplo, el logo estando en el hero): no hay nada que mirar
  if (!maquina.activa && Math.abs(y - window.scrollY) < 2) return;
  const yaEstaba = maquina.activa && maquina.viendo === id;
  maquina.mirar(id, window.scrollY);
  if (!congelado) congelar(true);
  if (!yaEstaba) saltar(y, true);
}

// El mouse salió del ítem: si no entra a otro enseguida, vuelve a donde estaba.
export function terminarVistaPrevia() {
  clearTimeout(temporizadorSalida);
  if (!maquina.activa) return;
  temporizadorSalida = setTimeout(() => {
    const origen = maquina.volver();
    if (origen !== null && Math.abs(origen - window.scrollY) >= 2) saltar(origen, true);
    congelar(false);
  }, DEMORA_SALIDA_MS);
}

// Clic: queda en la sección (o va, si no se estaba mirando), sin recorrer el scroll.
export function irASeccion(id) {
  clearTimeout(temporizadorSalida);
  const y = destinoDeScroll(id, window.scrollY, medirSeccion, maximoScroll());
  if (y === null) return false;
  const yaEstaba = maquina.activa && maquina.viendo === id;
  maquina.quedarse();
  // Si el hover ya te llevó ahí, el clic sólo confirma: nada de un segundo velo (parpadeo).
  if (!yaEstaba) saltar(y, false);
  congelar(false);
  anclaClic = { x: mouse.x, y: mouse.y };
  const hash = id === 'inicio' ? window.location.pathname + window.location.search : `#${id}`;
  window.history.replaceState(null, '', hash);
  return true;
}

// Con la vista previa en curso, el usuario hizo scroll con la rueda o tocó la pantalla: se queda.
export function confirmarVistaPrevia() {
  if (!maquina.activa) return;
  clearTimeout(temporizadorSalida);
  maquina.quedarse();
  congelar(false);
}
