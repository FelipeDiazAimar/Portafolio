// Aurora de Unicorn Studio ("Azure Wave"): dónde se muestra. Este valor es todo el rollback:
//   'bienvenida' → fondo del splash de carga (responde al mouse)
//   'ninguno'    → apagada en todo el sitio
// Para probar otra ubicación sin tocar código: ?aurora=ninguno (o ?aurora=bienvenida) en la URL.
export const UBICACION_AURORA = 'bienvenida';

export const UBICACIONES_AURORA = ['bienvenida', 'ninguno'];

// Sólo en el cliente (lee la URL): llamar desde un efecto, nunca durante el render.
export function ubicacionAurora() {
  if (typeof window === 'undefined') return UBICACION_AURORA;
  const pedida = new URLSearchParams(window.location.search).get('aurora');
  return UBICACIONES_AURORA.includes(pedida) ? pedida : UBICACION_AURORA;
}
