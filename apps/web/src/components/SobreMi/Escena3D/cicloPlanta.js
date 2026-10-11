// Guion de la planta de 2026, como función del tiempo `t` (segundos): las cajas
// recorren una cinta en L; cada ciclo la cinta se frena cuando una caja llega al
// escáner y ahí corre la secuencia: zoom a la caja, su etiqueta ampliada, el
// escaneo del QR, la lectura, la subida del dato y el registro en SAP. La escena
// no guarda estado: todo sale de `estadoPlanta(t)`, así se puede probar sin gráficos.

// Recorrido de las cajas: de la entrada, a lo largo de x, y al final de la L, a lo largo de -z.
export const RUTA = [
  [-2.3, 0.6],
  [0.5, 0.6],
  [0.5, -1.6],
];
const LARGOS = RUTA.slice(1).map(([x, z], i) => Math.hypot(x - RUTA[i][0], z - RUTA[i][1]));
export const LARGO = LARGOS.reduce((a, b) => a + b, 0);

export const CAJAS = 6;
// Velocidad de la cinta (unidades por segundo) y distancia (sobre la ruta) del escáner.
export const VELOCIDAD = 0.8;
export const S_ESCANER = 1.6;
// Cuánto antes de doblar empieza a girar la caja.
const RADIO_GIRO = 0.25;

// Momentos de la secuencia, en segundos desde que la caja llega al escáner.
export const PAUSA = 14;
const T = {
  zoomEntra: [0, 1.3],
  etiquetaEntra: [0.8, 1.5],
  escaneo: [2.3, 3.7],
  lectura: [3.7, 4.4],
  subida: [4.4, 5.6],
  sapEntra: [5.2, 5.9],
  registro: [5.8, 6.6],
  etiquetaSale: [6.8, 7.5],
  sapSale: [7.4, 8],
  tableroEntra: [7.6, 8.3],
  construccion: [8.1, 11.3],
  tableroSale: [12.3, 13],
  zoomSale: [12.6, 14],
};

// Segundos de cinta en marcha antes de frenar y duración de una vuelta completa.
const T_FRENA = S_ESCANER / VELOCIDAD;
const T_VUELTA = LARGO / VELOCIDAD;
export const CICLO = T_VUELTA + PAUSA;

const tramo = (x, [a, b]) => Math.min(1, Math.max(0, (x - a) / (b - a)));
const suave = (f) => f * f * (3 - 2 * f);

// Tiempo "de cinta": avanza con el reloj salvo mientras la cinta está frenada.
export function tiempoCinta(t) {
  const vueltas = Math.floor(t / CICLO);
  const u = t - vueltas * CICLO;
  let dentro;
  if (u < T_FRENA) dentro = u;
  else if (u < T_FRENA + PAUSA) dentro = T_FRENA;
  else dentro = u - PAUSA;
  return vueltas * T_VUELTA + dentro;
}

// Distancia recorrida por la caja `i` (de 0 a LARGO, y vuelve a empezar).
export function distanciaCaja(i, t) {
  const separacion = LARGO / CAJAS;
  const s = (tiempoCinta(t) * VELOCIDAD + i * separacion) % LARGO;
  return s < 0 ? s + LARGO : s;
}

// Posición (x, z) y orientación (`giro`, sobre el eje y) a la distancia `s` de la ruta.
export function puntoEnRuta(s) {
  const d = Math.min(Math.max(s, 0), LARGO);
  let resto = d;
  let indice = 0;
  while (indice < LARGOS.length - 1 && resto > LARGOS[indice]) {
    resto -= LARGOS[indice];
    indice += 1;
  }
  const [x0, z0] = RUTA[indice];
  const [x1, z1] = RUTA[indice + 1];
  const f = resto / LARGOS[indice];
  // Orientación: 0 mirando a +x y π/2 mirando a -z.
  const angulos = [0, Math.PI / 2];
  let giro = angulos[indice];
  // Cerca de la esquina la caja gira de a poco en vez de pegar el salto.
  const hastaEsquina = LARGOS[0] - d;
  if (Math.abs(hastaEsquina) < RADIO_GIRO) {
    const k = (RADIO_GIRO - hastaEsquina) / (2 * RADIO_GIRO);
    giro = angulos[0] + (angulos[1] - angulos[0]) * Math.min(Math.max(k, 0), 1);
  }
  return { x: x0 + (x1 - x0) * f, z: z0 + (z1 - z0) * f, giro };
}

// Pulso del láser del escáner cuando una caja pasa justo debajo: 0 lejos, 1 debajo.
export function progresoEscaneo(s) {
  const ancho = 0.25;
  const d = Math.abs(s - S_ESCANER);
  return d >= ancho ? 0 : 1 - d / ancho;
}

// Todo lo que cambia durante el ciclo, de 0 a 1 cada cosa:
//  zoom        acercamiento a la caja que está en el escáner
//  etiqueta    la etiqueta ampliada junto a la caja
//  escaneo     avance del láser sobre el QR
//  lectura     el QR ya se leyó y se muestra el dato
//  subida      el dato viaja hacia SAP
//  sap         el panel de SAP a la vista
//  registro    el nuevo registro se carga en el panel
//  tablero     el tablero de trazabilidad a la vista
//  construccion  avance de la creación del tablero (los widgets aparecen de a uno)
export function estadoPlanta(t) {
  const u = t - Math.floor(t / CICLO) * CICLO;
  const p = u - T_FRENA;
  if (p < 0 || p > PAUSA) {
    return { pausa: false, zoom: 0, etiqueta: 0, escaneo: 0, lectura: 0, subida: 0, sap: 0, registro: 0, tablero: 0, construccion: 0 };
  }
  const entra = (r) => suave(tramo(p, r));
  return {
    pausa: true,
    zoom: entra(T.zoomEntra) * (1 - entra(T.zoomSale)),
    etiqueta: entra(T.etiquetaEntra) * (1 - entra(T.etiquetaSale)),
    escaneo: tramo(p, T.escaneo),
    lectura: tramo(p, T.lectura),
    subida: tramo(p, T.subida),
    sap: entra(T.sapEntra) * (1 - entra(T.sapSale)),
    registro: tramo(p, T.registro),
    tablero: entra(T.tableroEntra) * (1 - entra(T.tableroSale)),
    construccion: tramo(p, T.construccion),
  };
}
