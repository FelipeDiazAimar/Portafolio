// Efecto de rayos X del hero. Adaptado de "Skeleton Fluid Reveal" de Cullen Webber
// (https://github.com/cullenwebber/three-skull, MIT; artículo en Codrops). El original es WebGPU +
// TSL; acá va portado a WebGL/GLSL como el resto del sitio. Los modelos (`man.glb`,
// `skeleton.glb`) vienen de ese repositorio.

// Tiempo con el cursor sobre la foto hasta que todo el hero pasa al fondo de esqueletos.
export const DISPARO_FONDO_MS = 4000;

// Tema claro: se prueba un negativo (fondo claro, huesos azul oscuro). En false, la escena es
// oscura en los dos temas.
export const TEMA_CLARO_RAYOSX = true;

export const MODELOS = {
  cuerpo: '/modelos/rayosx/man.glb',
  esqueleto: '/modelos/rayosx/skeleton.glb',
  draco: '/draco/',
};

// Material de rayos X (fresnel): brillante en la silueta, oscuro de frente, y se apaga hacia abajo.
export const MATERIAL = {
  nucleo: [0.0, 0.05, 0.1],
  borde: [0.2, 0.6, 1.0],
  emisivo: 0.75,
  // desde qué altura (en el modelo) se apaga hacia abajo, y hasta cuál llega a pleno
  alturaBase: 0.5,
  alturaCuerpo: 1.0,
  alturaEsqueleto: 0.9,
};

// Fondo: la escena del demo, de costado, con la cámara que acompaña al mouse.
export const FONDO = {
  // muchos más que el demo (12): la grilla llena toda la pantalla
  cantidad: 64,
  separacion: 0.65,
  fov: 17,
  posicion: [1.5, 1.5, 0.55],
  mira: [-0.52, 0.45, -0.45],
  parallax: [0.125, 0.075],
  suavizado: 0.25, // segundos
  niebla: [1, 5],
  // cuánto más lejos que el demo va la cámara (para que entren más esqueletos)
  alejar: 1.45,
  // tu esqueleto vuela desde la foto hasta su lugar en la grilla
  duracionEntrada: 1.9, // segundos
  // fluido: cuánto se esparce la tinta y qué tan rápido vuelve a cerrarse
  dispersion: 0.01,
  retorno: 0.015,
  pincel: 0.2, // ancho del trazo, fracción del ancho de pantalla
};

// Retrato: un solo esqueleto, de frente, ubicado sobre la cara de la foto. El revelado persiste.
export const RETRATO = {
  // cráneo del modelo (coordenadas del modelo): centro y alto
  craneo: { centroX: 0, centroY: 0.775, alto: 0.2 },
  // dónde está la cara en la foto (`public/retrato.png`, 1792×2390): 0..1 del marco, y desde arriba
  calibracion: { centroX: 0.515, centroY: 0.435, alto: 0.42 },
  girarY: 0, // radianes, si el modelo no queda de frente
  dispersion: 0.0015,
  retorno: 0,
  pincel: 0.22, // fracción del ancho del marco
  niebla: [3.5, 6],
};

export const COLORES = {
  oscuro: { tinte: [0.0, 0.0, 0.2] },
  claro: { fondo: [0.8, 0.87, 1.0], hueso: [0.04, 0.16, 0.54] },
};
