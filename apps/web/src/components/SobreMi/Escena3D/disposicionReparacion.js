// Distribución de la placa en reparación del banco de 2025. La placa está tendida
// sobre la mesa: x va de izquierda a derecha y z de atrás hacia adelante (el
// origen es el centro de la placa). Las zonas son los componentes grandes; el
// resto (resistencias, capacitores, LEDs) se reparte en los huecos que quedan.
export const PLACA_REPARACION = { ancho: 1.6, fondo: 1.07, grosor: 0.04 };

// Cada zona: centro (x, z) y tamaño (ancho en x, fondo en z).
export const ZONAS_REPARACION = {
  usb: { x: -0.58, z: -0.3, ancho: 0.34, fondo: 0.28 },
  chipGrande: { x: -0.1, z: -0.02, ancho: 0.44, fondo: 0.44 },
  chipMedio: { x: 0.46, z: -0.2, ancho: 0.3, fondo: 0.3 },
  chipChico: { x: 0.5, z: 0.22, ancho: 0.22, fondo: 0.22 },
  flex: { x: -0.1, z: 0.44, ancho: 0.62, fondo: 0.1 },
  bobina: { x: -0.58, z: 0.14, ancho: 0.2, fondo: 0.2 },
  tornillo: { x: 0.7, z: 0.38, ancho: 0.12, fondo: 0.12 },
};

const rectangulosColindan = (a, b) => Math.abs(a.x - b.x) < (a.ancho + b.ancho) / 2 && Math.abs(a.z - b.z) < (a.fondo + b.fondo) / 2;

// Recorre una grilla fina y deja los candidatos que no tocan ninguna zona ni a lo
// ya colocado, hasta llegar a `cantidad`. Determinista: mismo resultado siempre.
function repartir({ cantidad, tamano, paso, desde, margenZona, previos = [] }) {
  const elegidos = [];
  const margenPlaca = 0.06;
  // El borde del componente (no su centro) tiene que quedar a `margenPlaca` del canto.
  const limiteX = PLACA_REPARACION.ancho / 2 - margenPlaca - tamano.ancho / 2;
  const limiteZ = PLACA_REPARACION.fondo / 2 - margenPlaca - tamano.fondo / 2;
  for (let z = -limiteZ + desde; z <= limiteZ; z += paso) {
    for (let x = -limiteX + desde; x <= limiteX; x += paso) {
      if (elegidos.length >= cantidad) return elegidos;
      const candidato = { x, z, ancho: tamano.ancho, fondo: tamano.fondo };
      const grande = { ...candidato, ancho: candidato.ancho + margenZona * 2, fondo: candidato.fondo + margenZona * 2 };
      if (Object.values(ZONAS_REPARACION).some((zona) => rectangulosColindan(grande, zona))) continue;
      if ([...previos, ...elegidos].some((otro) => rectangulosColindan({ ...candidato, ancho: candidato.ancho + 0.02, fondo: candidato.fondo + 0.02 }, otro))) continue;
      elegidos.push(candidato);
    }
  }
  return elegidos;
}

// Orden de reparto: primero los LEDs, después los capacitores (más grandes) y, al
// final, las resistencias, que rellenan lo que queda. Cada función recalcula las
// anteriores para tener en cuenta lo que ya está ocupado.
const comoRectangulo = (c) => ({ x: c.x, z: c.z, ancho: c.r * 2, fondo: c.r * 2 });

// Doce LEDs de estado.
export function ledsReparacion() {
  return repartir({ cantidad: 12, tamano: { ancho: 0.08, fondo: 0.08 }, paso: 0.045, desde: 0, margenZona: 0.04 }).map((s) => ({ x: s.x, z: s.z }));
}

// Capacitores cilíndricos (electrolíticos chicos).
export function capacitoresPlaca() {
  const leds = ledsReparacion().map((l) => ({ x: l.x, z: l.z, ancho: 0.08, fondo: 0.08 }));
  return repartir({ cantidad: 10, tamano: { ancho: 0.1, fondo: 0.1 }, paso: 0.045, desde: 0, margenZona: 0.03, previos: leds }).map((s, i) => ({
    x: s.x,
    z: s.z,
    r: 0.05,
    h: 0.09 + (i % 3) * 0.02,
  }));
}

// Resistencias de montaje superficial: cajitas chatas de 0,07 × 0,035.
export function resistenciasSMD() {
  const previos = [
    ...ledsReparacion().map((l) => ({ x: l.x, z: l.z, ancho: 0.08, fondo: 0.08 })),
    ...capacitoresPlaca().map(comoRectangulo),
  ];
  return repartir({ cantidad: 36, tamano: { ancho: 0.07, fondo: 0.035 }, paso: 0.04, desde: 0, margenZona: 0.02, previos });
}
