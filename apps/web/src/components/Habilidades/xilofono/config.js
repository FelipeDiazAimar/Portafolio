// Configuración del xilófono de Habilidades. Adaptado de "The Endless Glass Xylophone" de
// Sujen Phea (https://github.com/Sujenphea/xylophone, MIT). El solver de fluido viene de
// WebGL-Fluid-Simulation de Pavel Dobryakov (MIT).

// Celular o táctil: menos resolución.
export function calidad() {
  const tactil = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  const chico = typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 900;
  const esMovil = Boolean(tactil && chico);
  return {
    esMovil,
    maxDpr: esMovil ? 1.5 : 2,
  };
}

// Capas: el fondo se renderiza solo (para desenfocarlo); las barras van en la suya.
export const CAPA_VIDRIO = 1;
export const CAPA_FONDO = 2;

export const XILOFONO = {
  // Una barra por habilidad: el catálogo tiene 64 (ver data/tecnologias.js).
  cantidad: 64,
  radio: 1,
  caidaInclinacion: 2,
  pasoTheta: 0.175,
  desfaseTheta: Math.PI,
  // Giro propio de cada barra (rad/s). En 0: las caras con el logo quedan quietas y legibles;
  // el movimiento lo da la cinta que avanza.
  velocidadGiro: 0,
  envolturaTinte: 10,
  grupo: { escala: 0.5, rotXGrados: 25, rotZGrados: 30 },
  // El scroll de la página hace avanzar la cinta (barras por píxel) y además avanza sola, lento.
  scroll: { sensibilidad: 0.004, suavizado: 5 },
  // Barras por segundo: cada una tarda ~3 s en cruzar el foco.
  avanceSolo: 0.32,
};

// Fondo de la escena: 'aurora' (cortinas de luz, adaptado de <Aurora /> de React Bits) o
// 'manchas' (el anterior: degradé con manchas de luz). Para volver, cambiar sólo esta línea.
export const FONDO = 'aurora';

export const AURORA = {
  amplitud: 1, // alto de las ondas del borde
  suavidad: 0.5, // qué tan difuso es el borde (0..1)
  alto: 0.5, // cuánto baja la aurora en la sección (0..1)
  escala: 1, // tamaño de las ondas (menos = más anchas y calmas)
  resplandor: 0.7, // cuánto se derrama la luz pasando el borde
  brillo: 1,
  capas: 2, // cortinas (1..3); las de atrás, más tenues
  velocidad: 0.6,
  desdeAbajo: false, // false: cuelga desde arriba
};

export const FLUIDO = {
  resolucion: 128,
  rotor: 0.2,
  radioGota: 0.6,
  fuerzaGota: 20,
  iteracionesPresion: 1,
  disipacionVelocidad: 0.93,
  disipacionPresion: 0.97,
};

export const ESCARCHA = {
  // mucho menos desenfoque que el original: deja ver lo que hay detrás (más vidrio)
  intensidad: 0.22,
  desenfoqueMaxPx: 48,
};

// Paletas en azul eléctrico (el acento del sitio, más saturado) en vez del arcoíris del
// original, con neutros para el vidrio.
export const PALETAS = {
  oscuro: {
    fondoA: '#05070f',
    fondoB: '#0a1a4d',
    manchas: '#0050ff',
    logo: '#ffffff',
    resalte: '#0a5cff',
    tinte: ['#0038ff', '#0057ff', '#1f7bff', '#00a6ff', '#0057ff'],
    iridA: '#0057ff',
    iridB: '#7fd4ff',
    cuerpo: 0.2, // brillo del cuerpo del vidrio (blanco = 1)
    transmision: 0.97, // cuánto del fondo (refractado) deja ver
    opacidad: 0.62, // alfa base del vidrio (el borde y el logo suben a opaco)
    especular: 0.6,
    bordeLuz: 0.8,
    aurora: ['#0a2cff', '#0057ff', '#2f7bff', '#0038ff'],
    brilloAurora: 0.62, // en oscuro, más tenue: el texto blanco y gris tiene que leerse encima
  },
  claro: {
    fondoA: '#f4f7ff',
    fondoB: '#d6e2ff',
    manchas: '#3d7bff',
    logo: '#0047ff',
    resalte: '#0050ff',
    tinte: ['#0038ff', '#0057ff', '#1f7bff', '#00a6ff', '#0057ff'],
    iridA: '#1f6bff',
    iridB: '#a8d8ff',
    cuerpo: 1,
    transmision: 0.93,
    opacidad: 0.62,
    especular: 0.5,
    bordeLuz: 0.6,
    aurora: ['#3d7bff', '#7fd4ff', '#8fb2ff', '#0a5cff'],
    brilloAurora: 1,
  },
};
