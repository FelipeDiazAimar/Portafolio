// Perspectiva de cuatro puntos, sin DOM: la transformación CSS (matrix3d) que lleva una caja de
// `ancho` × `alto` (con transform-origin en 0 0) a un cuadrilátero cualquiera de la pantalla.
// Se usa para apoyar un elemento HTML sobre una portada del reel, que está en un canvas 3D.
//
// `esquinas`: [arribaIzq, arribaDer, abajoDer, abajoIzq], cada una [x, y] en px.
export function coeficientes([p0, p1, p2, p3]) {
  const dx1 = p1[0] - p2[0];
  const dx2 = p3[0] - p2[0];
  const dy1 = p1[1] - p2[1];
  const dy2 = p3[1] - p2[1];
  const sx = p0[0] - p1[0] + p2[0] - p3[0];
  const sy = p0[1] - p1[1] + p2[1] - p3[1];
  const den = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(den) < 1e-9) return null; // cuadrilátero degenerado (tres puntos en línea)
  const g = (sx * dy2 - dx2 * sy) / den;
  const h = (dx1 * sy - sx * dy1) / den;
  return {
    a: p1[0] - p0[0] + g * p1[0],
    b: p3[0] - p0[0] + h * p3[0],
    c: p0[0],
    d: p1[1] - p0[1] + g * p1[1],
    e: p3[1] - p0[1] + h * p3[1],
    f: p0[1],
    g,
    h,
  };
}

// Dónde cae el punto (u, v) del cuadrado unidad.
export function proyectar(k, u, v) {
  const w = k.g * u + k.h * v + 1;
  return [(k.a * u + k.b * v + k.c) / w, (k.d * u + k.e * v + k.f) / w];
}

export function matrizCss(ancho, alto, esquinas) {
  const k = coeficientes(esquinas);
  if (!k) return null;
  const n = (x) => +x.toFixed(7);
  // matrix3d va por columnas: la primera es lo que aporta x, la segunda y, la cuarta el traslado
  return `matrix3d(${n(k.a / ancho)},${n(k.d / ancho)},0,${n(k.g / ancho)},${n(k.b / alto)},${n(k.e / alto)},0,${n(k.h / alto)},0,0,1,0,${n(k.c)},${n(k.f)},0,1)`;
}
