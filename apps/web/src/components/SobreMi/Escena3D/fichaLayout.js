// Cálculos (en píxeles de pantalla) para la ficha del grafo y su encuadre. Son
// funciones puras: la escena sólo les pasa medidas y aplica el resultado.

// `area` = { izq, arriba, der, abajo }: el rectángulo de pantalla donde se puede dibujar.

// Cuánto de la ficha queda fuera del área (0 = entra entera).
function desborde(centro, ancho, alto, area) {
  const izq = centro.x - ancho / 2;
  const der = centro.x + ancho / 2;
  const arriba = centro.y - alto / 2;
  const abajo = centro.y + alto / 2;
  return (
    Math.max(0, area.izq - izq) +
    Math.max(0, der - area.der) +
    Math.max(0, area.arriba - arriba) +
    Math.max(0, abajo - area.abajo)
  );
}

// Dónde va el centro de la ficha respecto del nodo (en píxeles, y hacia abajo):
// prueba a la derecha, a la izquierda, arriba y abajo, se queda con el lado que
// mejor entra y, si ninguno entra entero, la desliza hasta meterla en el área.
// Devuelve { x, y, lado } con el centro en coordenadas de pantalla.
export function ubicarFicha({ nodo, ancho, alto, area, separacion = 22 }) {
  const candidatos = [
    { lado: 'derecha', x: nodo.x + ancho / 2 + separacion, y: nodo.y - alto * 0.15 },
    { lado: 'izquierda', x: nodo.x - ancho / 2 - separacion, y: nodo.y - alto * 0.15 },
    { lado: 'arriba', x: nodo.x, y: nodo.y - alto / 2 - separacion },
    { lado: 'abajo', x: nodo.x, y: nodo.y + alto / 2 + separacion },
  ];
  let mejor = candidatos[0];
  let menor = Infinity;
  for (const c of candidatos) {
    const d = desborde(c, ancho, alto, area);
    if (d < menor - 1e-9) {
      menor = d;
      mejor = c;
    }
  }
  // Si aun así sobra algo, se desliza dentro del área (si la ficha es más grande
  // que el área, se alinea con el borde de arriba/izquierda).
  const x = Math.min(Math.max(mejor.x, area.izq + ancho / 2), Math.max(area.der - ancho / 2, area.izq + ancho / 2));
  const y = Math.min(Math.max(mejor.y, area.arriba + alto / 2), Math.max(area.abajo - alto / 2, area.arriba + alto / 2));
  return { x, y, lado: mejor.lado };
}

// Zoom y desplazamiento (en píxeles) que hacen entrar en `area` una caja que hoy
// ocupa `caja` = { izq, arriba, der, abajo }; `origen` es el punto de pantalla
// alrededor del cual escala el zoom. Nunca agranda por encima de `maximo`.
export function encuadrar({ caja, area, origen, margen = 24, maximo = 1.15 }) {
  const anchoCaja = Math.max(caja.der - caja.izq, 1);
  const altoCaja = Math.max(caja.abajo - caja.arriba, 1);
  const anchoArea = Math.max(area.der - area.izq - margen * 2, 1);
  const altoArea = Math.max(area.abajo - area.arriba - margen * 2, 1);
  const zoom = Math.min(maximo, anchoArea / anchoCaja, altoArea / altoCaja);
  // Centro de la caja una vez escalada alrededor de `origen`.
  const centro = { x: (caja.izq + caja.der) / 2, y: (caja.arriba + caja.abajo) / 2 };
  const escalado = { x: origen.x + (centro.x - origen.x) * zoom, y: origen.y + (centro.y - origen.y) * zoom };
  const meta = { x: (area.izq + area.der) / 2, y: (area.arriba + area.abajo) / 2 };
  return { zoom, dx: meta.x - escalado.x, dy: meta.y - escalado.y };
}
