// 3 floats por cuerpo (x, y, ángulo) + 3 del stickman (x, paso, barriendo).
const FLOATS_POR_CUERPO = 3;
const FLOATS_STICKMAN = 3;
// Techo de memoria: ~380 cuerpos ≈ 4.6 KB por cuadro, 900 cuadros ≈ 4 MB.
const MAX_CUADROS = 900;

// La reconstrucción tiene que ser el recorrido inverso exacto, no un tween de
// vuelta al origen: por eso se guarda una foto por cuadro y en el rebobinado
// se recorren al revés tal cual.
export function crearGrabadora(cantidadCuerpos) {
  const cuadros = [];
  const largo = cantidadCuerpos * FLOATS_POR_CUERPO + FLOATS_STICKMAN;

  return {
    get cantidad() {
      return cuadros.length;
    },
    // Válvula de escape: si la simulación se estira más de lo previsto se
    // corta la grabación en vez de comerse memoria sin techo.
    get lleno() {
      return cuadros.length >= MAX_CUADROS;
    },
    grabarCuadro(cuerpos, stickman) {
      if (cuadros.length >= MAX_CUADROS) return;
      const foto = new Float32Array(largo);
      for (let i = 0; i < cuerpos.length; i += 1) {
        foto[i * FLOATS_POR_CUERPO] = cuerpos[i].position.x;
        foto[i * FLOATS_POR_CUERPO + 1] = cuerpos[i].position.y;
        foto[i * FLOATS_POR_CUERPO + 2] = cuerpos[i].angle;
      }
      foto[largo - 3] = stickman.x;
      foto[largo - 2] = stickman.paso;
      foto[largo - 1] = stickman.barriendo ? 1 : 0;
      cuadros.push(foto);
    },
    leerCuadro(indice) {
      return cuadros[indice];
    },
    liberar() {
      cuadros.length = 0;
    },
  };
}

export function leerCelda(foto, indice) {
  return {
    x: foto[indice * FLOATS_POR_CUERPO],
    y: foto[indice * FLOATS_POR_CUERPO + 1],
    angulo: foto[indice * FLOATS_POR_CUERPO + 2],
  };
}

export function leerStickman(foto) {
  return {
    x: foto[foto.length - 3],
    paso: foto[foto.length - 2],
    barriendo: foto[foto.length - 1] === 1,
  };
}
