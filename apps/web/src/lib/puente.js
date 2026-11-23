// Puente entre "Sobre mí" y Proyectos (glow-up): el reel deja acá su escena para que Proyectos
// pueda calcar sus portadas (forma en pantalla, imagen y opacidad) en el momento en que se
// rompen en conectores. Sin React.
let reel = null;

export function registrarReel(valor, deQuien = null) {
  // al desmontar sólo se borra si sigue siendo la misma escena
  if (valor === null && deQuien && reel?.escena !== deQuien) return;
  reel = valor;
  // a mano de las pruebas (scripts de verificación)
  if (typeof window !== 'undefined') window.__puenteReel = valor;
}

// Cuántas divisiones por lado tiene el calco: la portada es un tramo de cilindro en perspectiva,
// así que se copia como una grilla de puntos (no como un rectángulo).
export const GRILLA = 12;

// Las portadas visibles del reel, de atrás hacia adelante: su imagen, su opacidad y la grilla de
// (GRILLA + 1)² puntos de la superficie en px de la ventana (fila por fila, desde arriba a la izquierda).
export function calcarPortadas() {
  const escena = reel?.escena;
  const lienzo = reel?.lienzo;
  if (!escena || !lienzo?.isConnected) return [];
  const caja = lienzo.getBoundingClientRect();
  const lista = [];
  escena.portadas.forEach((portada, i) => {
    if (!portada.malla.visible) return;
    const u = portada.material.uniforms;
    const opacidad = u.uOpacidad.value;
    // sin imagen compuesta todavía no se calca (quedaría una placa vacía)
    if (opacidad < 0.05 || !u.uMapa.value?.image) return;
    const puntos = [];
    for (let fila = 0; fila <= GRILLA; fila += 1) {
      for (let col = 0; col <= GRILLA; col += 1) {
        const p = escena.puntoEn(i, col / GRILLA, fila / GRILLA);
        if (!p) return;
        puntos.push([p[0] + caja.left, p[1] + caja.top]);
      }
    }
    lista.push({ orden: portada.malla.renderOrder, imagen: u.uMapa.value.image, opacidad, niebla: u.uNiebla.value, puntos, grilla: GRILLA });
  });
  return lista.sort((a, b) => a.orden - b.orden);
}
