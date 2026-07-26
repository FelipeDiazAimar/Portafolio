// 3 floats por cuerpo (x, y, ángulo). El stickman NO se graba: no participa
// del rebobinado — una vez que se fue, se fue.
const FLOATS_POR_CUERPO = 3;
// Techo de memoria: ~380 cuerpos ≈ 4.6 KB por foto, 1400 fotos ≈ 6.4 MB.
// El barrido lento se lleva unas 800 fotos por sí solo y la fase de rotura la
// maneja el usuario, que puede demorar: de ahí el margen. El llamador graba
// uno de cada dos cuadros para que entren.
const MAX_CUADROS = 1400;

// La reconstrucción tiene que ser el recorrido inverso exacto, no un tween de
// vuelta al origen: por eso se guarda una foto por cuadro y en el rebobinado
// se recorren al revés tal cual.
export function crearGrabadora(cantidadCuerpos) {
  const cuadros = [];
  const largo = cantidadCuerpos * FLOATS_POR_CUERPO;

  return {
    get cantidad() {
      return cuadros.length;
    },
    // Válvula de escape: si la simulación se estira más de lo previsto se
    // corta la grabación en vez de comerse memoria sin techo.
    get lleno() {
      return cuadros.length >= MAX_CUADROS;
    },
    grabarCuadro(cuerpos) {
      if (cuadros.length >= MAX_CUADROS) return;
      const foto = new Float32Array(largo);
      for (let i = 0; i < cuerpos.length; i += 1) {
        foto[i * FLOATS_POR_CUERPO] = cuerpos[i].position.x;
        foto[i * FLOATS_POR_CUERPO + 1] = cuerpos[i].position.y;
        foto[i * FLOATS_POR_CUERPO + 2] = cuerpos[i].angle;
      }
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
