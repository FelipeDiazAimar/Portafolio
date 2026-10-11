// Qué medio muestra el fondo de un hito, `segundos` después de volverse activo:
//  - sin video: siempre la foto;
//  - con video y sin foto: el video desde el principio;
//  - con foto y video: primero la foto y, pasada la `espera`, el video.
export function mostrarVideo(hito, segundos, espera) {
  if (!hito.video) return false;
  if (!hito.imagen) return true;
  return segundos >= espera;
}
