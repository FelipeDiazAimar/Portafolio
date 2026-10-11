// Distribución de la placa madre de la escena de 2024. La placa es una ATX
// parada (la cara con los componentes mira a +z): x va de izquierda a derecha, y
// de abajo hacia arriba. Las proporciones siguen una placa real (≈ 305 × 244 mm
// escalada), con el panel de entradas a la izquierda, el VRM arriba y a la
// izquierda del zócalo, la RAM a la derecha y las ranuras PCIe abajo.
export const PLACA = { ancho: 3.0, alto: 2.4, grosor: 0.06 };

// Cada zona es un rectángulo { cx, cy, ancho, alto } en el plano de la placa.
export const ZONAS = {
  io: { cx: -1.35, cy: 0.55, ancho: 0.3, alto: 1.3 },
  vrmSuperior: { cx: -0.55, cy: 1.0, ancho: 0.9, alto: 0.36 },
  vrmIzquierdo: { cx: -1.05, cy: 0.42, ancho: 0.2, alto: 0.66 },
  socket: { cx: -0.4, cy: 0.38, ancho: 0.64, alto: 0.64 },
  eps: { cx: 0.2, cy: 1.12, ancho: 0.42, alto: 0.14 },
  dimm: { cx: 0.855, cy: 0.5, ancho: 0.7, alto: 1.24 },
  atx24: { cx: 1.38, cy: 0.45, ancho: 0.2, alto: 0.7 },
  chipset: { cx: 0.85, cy: -0.55, ancho: 0.56, alto: 0.56 },
  sata: { cx: 1.3, cy: -0.6, ancho: 0.28, alto: 0.55 },
  pcie1: { cx: -0.35, cy: -0.15, ancho: 1.3, alto: 0.12 },
  pcie2: { cx: -0.6, cy: -0.6, ancho: 0.8, alto: 0.12 },
  m2: { cx: -0.55, cy: -0.95, ancho: 0.9, alto: 0.2 },
  bateria: { cx: 0.25, cy: -0.45, ancho: 0.3, alto: 0.3 },
};

// Los cuatro bancos de DIMM: centro de cada ranura en x.
export const RANURAS_DIMM = [0.6, 0.77, 0.94, 1.11];

// Condensadores sólidos (cilindros) en los huecos entre zonas: a la izquierda del
// zócalo, debajo, a la derecha y arriba. Determinista.
export function condensadores() {
  const lista = [];
  // Dos columnas entre el VRM izquierdo y el zócalo.
  for (let fila = 0; fila < 7; fila += 1) {
    for (const x of [-0.9, -0.82]) lista.push({ x, y: 0.1 + fila * 0.09, r: 0.035, h: 0.11 });
  }
  // Una fila entre el zócalo y las ranuras PCIe.
  for (let i = 0; i < 7; i += 1) lista.push({ x: -0.7 + i * 0.09, y: -0.015, r: 0.03, h: 0.1 });
  // Tres columnas a la derecha del zócalo.
  for (const x of [0.02, 0.14, 0.26]) {
    for (let fila = 0; fila < 5; fila += 1) lista.push({ x, y: 0.12 + fila * 0.12, r: 0.035, h: 0.12 });
  }
  // Una fila entre el VRM de arriba y el zócalo.
  for (let i = 0; i < 7; i += 1) lista.push({ x: -0.7 + i * 0.1, y: 0.77, r: 0.028, h: 0.09 });
  return lista;
}

// Tornillos de fijación: cuatro en las esquinas libres y dos en el centro.
export function tornillos() {
  return [
    { x: -1.1, y: 1.12 },
    { x: 1.4, y: 1.1 },
    { x: -1.3, y: -1.1 },
    { x: 1.4, y: -1.1 },
    { x: 0.35, y: 0.85 },
    { x: 0.0, y: -0.9 },
  ];
}

// Posiciones (centradas) de las `n` aletas de un disipador que mide `ancho`.
export function aletas(n, ancho) {
  return Array.from({ length: n }, (_, i) => (i / (n - 1) - 0.5) * ancho);
}
