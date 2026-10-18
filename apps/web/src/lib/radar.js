// Radar de categorías de Habilidades (reemplaza a los chips). Puro: sin DOM, para poder probarlo.
// Un eje por categoría; el área muestra en cuántos proyectos se usó cada una.

// Para cada categoría: cuántas tecnologías tiene, en cuántos proyectos distintos se usó (al menos
// una de sus tecnologías en el stack) y cuántos usos suma en total.
export function usoPorCategoria(categorias, proyectos) {
  const total = proyectos.length;
  return categorias.map((categoria) => {
    const propias = new Set(categoria.tecnologias);
    let conUso = 0;
    let usos = 0;
    proyectos.forEach((proyecto) => {
      const n = (proyecto.stack ?? []).filter((id) => propias.has(id)).length;
      if (n > 0) conUso += 1;
      usos += n;
    });
    return { id: categoria.id, nombre: categoria.nombre, tecnologias: categoria.tecnologias.length, proyectos: conUso, usos, total };
  });
}

// Ángulo del eje i de n: el primero arriba y en sentido horario (en radianes, y hacia abajo).
export function anguloDeEje(i, n) {
  return -Math.PI / 2 + (i / n) * Math.PI * 2;
}

// Vértices del polígono: `valores` en 0..1, con un mínimo para que un eje en cero no colapse el
// polígono sobre el centro.
export function puntosRadar(valores, cx, cy, radio, minimo = 0.14) {
  const n = valores.length;
  return valores.map((valor, i) => {
    const r = radio * (minimo + (1 - minimo) * Math.min(1, Math.max(0, valor)));
    const a = anguloDeEje(i, n);
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });
}

// Trazado SVG cerrado. Siempre con la misma estructura (M, n-1 L y Z), así se puede animar de un
// polígono a otro (por ejemplo desde todos los puntos en el centro).
export function trazadoRadar(puntos) {
  return puntos.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ') + ' Z';
}
