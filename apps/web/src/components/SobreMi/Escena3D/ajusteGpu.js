// TEMPORAL: ajuste manual de la posición de la gráfica de 2024. El panel
// (`AjusteGpuTemporal.jsx`) escribe acá y la escena (`Escena3PC.jsx`) lo lee en
// cada cuadro. Los desplazamientos están en unidades de la escena. Se borra
// cuando la posición quede decidida.
export const ajusteGpu = {
  x: 0,
  y: 0,
  z: 0,
  // Mientras se ajusta, la placa se queda armada (sin la vista explotada).
  congelar: true,
  // Escala del modelo de la placa (unidades de la escena por unidad del modelo);
  // la escena la completa para poder mostrar la posición en unidades del modelo.
  escala: 1,
};
