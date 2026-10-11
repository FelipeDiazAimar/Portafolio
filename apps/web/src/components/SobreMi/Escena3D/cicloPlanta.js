// Guion de la planta de 2026: las cajas recorren una cinta en L (x, z sobre el
// piso de la planta), pasan bajo el escáner y, ya leídas, mandan un código de
// trazabilidad hacia el nodo SAP. Todo es función del tiempo `t` (segundos),
// así la escena no guarda estado y se puede probar sin gráficos.

// Recorrido de las cajas: de la entrada, a lo largo de x, y al final de la L, a lo largo de -z.
export const RUTA = [
  [-2.3, 0.6],
  [0.5, 0.6],
  [0.5, -1.6],
];
const LARGOS = RUTA.slice(1).map(([x, z], i) => Math.hypot(x - RUTA[i][0], z - RUTA[i][1]));
export const LARGO = LARGOS.reduce((a, b) => a + b, 0);

export const CAJAS = 6;
// Velocidad de la cinta (unidades por segundo).
export const VELOCIDAD = 0.5;
// Distancia (sobre la ruta) donde está el escáner y donde el código llega al nodo SAP.
export const S_ESCANER = 1.6;
export const S_LLEGADA = 2.7;
// Cuánto dura el destello del nodo cuando llega un código.
const DURACION_DESTELLO = 0.6;
// Cuánto antes de doblar empieza a girar la caja.
const RADIO_GIRO = 0.25;

// Distancia recorrida por la caja `i` en el instante `t` (de 0 a LARGO, y vuelve a empezar).
export function distanciaCaja(i, t) {
  const separacion = LARGO / CAJAS;
  const s = (t * VELOCIDAD + i * separacion) % LARGO;
  return s < 0 ? s + LARGO : s;
}

// Posición (x, z) y orientación (`giro`, sobre el eje y) a la distancia `s` de la ruta.
export function puntoEnRuta(s) {
  const d = Math.min(Math.max(s, 0), LARGO);
  let resto = d;
  let tramo = 0;
  while (tramo < LARGOS.length - 1 && resto > LARGOS[tramo]) {
    resto -= LARGOS[tramo];
    tramo += 1;
  }
  const [x0, z0] = RUTA[tramo];
  const [x1, z1] = RUTA[tramo + 1];
  const f = resto / LARGOS[tramo];
  // Orientación: 0 mirando a +x y π/2 mirando a -z.
  const angulos = [0, Math.PI / 2];
  let giro = angulos[tramo];
  // Cerca de la esquina la caja gira de a poco en vez de pegar el salto.
  const hastaEsquina = LARGOS[0] - d;
  if (Math.abs(hastaEsquina) < RADIO_GIRO) {
    const k = (RADIO_GIRO - hastaEsquina) / (2 * RADIO_GIRO);
    giro = angulos[0] + (angulos[1] - angulos[0]) * Math.min(Math.max(k, 0), 1);
  }
  return { x: x0 + (x1 - x0) * f, z: z0 + (z1 - z0) * f, giro };
}

// Pulso del láser del escáner: 0 lejos, 1 justo debajo, y baja de nuevo.
export function progresoEscaneo(s) {
  const ancho = 0.25;
  const d = Math.abs(s - S_ESCANER);
  return d >= ancho ? 0 : 1 - d / ancho;
}

// Avance del código de trazabilidad de una caja: 0 si todavía no se leyó (o ya llegó
// al nodo), y de casi 0 a casi 1 mientras viaja hacia el nodo SAP.
export function faseCodigo(s) {
  if (s < S_ESCANER) return 0;
  const f = (s - S_ESCANER) / (S_LLEGADA - S_ESCANER);
  return f >= 1 ? 0 : f;
}

// Brillo del nodo SAP (0 a 1): destella cuando llega un código y se apaga de a poco.
export function brilloSap(t) {
  let brillo = 0;
  for (let i = 0; i < CAJAS; i += 1) {
    const desde = (distanciaCaja(i, t) - S_LLEGADA) / VELOCIDAD;
    if (desde >= 0 && desde < DURACION_DESTELLO) brillo = Math.max(brillo, 1 - desde / DURACION_DESTELLO);
  }
  return brillo;
}
