// Sólo se graban los caracteres que YA se rompieron: los que siguen colgados
// no se mueven, así que su posición es siempre la original y guardarla sería
// desperdiciar el buffer. Cada carácter recibe una "ranura" al romperse —el
// orden en que se fue rompiendo— y cada foto guarda las ranuras que existían
// en ese momento. Una foto vieja es más corta que una nueva, y eso está bien:
// si una ranura no entra en la foto, ese carácter todavía estaba colgado.
const FLOATS_POR_CUERPO = 3;
const INTERVALO_INICIAL = 2;
// Techo de fotos. El peso de cada una depende de cuánto se haya roto, así que
// el peor caso (todo roto, ~380 cuerpos) ronda los 6 MB.
const MAX_CUADROS = 1400;

// La reconstrucción tiene que ser el recorrido inverso exacto, no un tween de
// vuelta al origen: por eso se guarda una foto cada tantos cuadros y en el
// rebobinado se recorren al revés tal cual.
export function crearGrabadora() {
  let cuadros = [];
  let intervalo = INTERVALO_INICIAL;
  let contador = 0;

  return {
    get cantidad() {
      return cuadros.length;
    },
    grabarCuadro(cuerposRotos) {
      contador += 1;
      // La primera foto entra siempre: es el nombre intacto, o sea el destino
      // final del rebobinado.
      if (cuadros.length > 0 && contador % intervalo !== 0) return;

      const foto = new Float32Array(cuerposRotos.length * FLOATS_POR_CUERPO);
      for (let i = 0; i < cuerposRotos.length; i += 1) {
        foto[i * FLOATS_POR_CUERPO] = cuerposRotos[i].position.x;
        foto[i * FLOATS_POR_CUERPO + 1] = cuerposRotos[i].position.y;
        foto[i * FLOATS_POR_CUERPO + 2] = cuerposRotos[i].angle;
      }
      cuadros.push(foto);

      if (cuadros.length >= MAX_CUADROS) {
        // En vez de cortar la grabación —que obligaría a rebobinar desde el
        // medio de lo que pasó— se conserva una foto de cada dos y se duplica
        // el intervalo: la línea de tiempo sigue entera de punta a punta,
        // sólo baja la resolución. La foto 0 se conserva siempre.
        cuadros = cuadros.filter((_, indice) => indice % 2 === 0);
        intervalo *= 2;
      }
    },
    leerCuadro(indice) {
      return cuadros[indice];
    },
    liberar() {
      cuadros = [];
    },
  };
}

// null significa que en esa foto el carácter todavía no se había roto: seguía
// colgado en su posición original.
export function leerCelda(foto, ranura) {
  if (ranura < 0 || (ranura + 1) * FLOATS_POR_CUERPO > foto.length) return null;
  return {
    x: foto[ranura * FLOATS_POR_CUERPO],
    y: foto[ranura * FLOATS_POR_CUERPO + 1],
    angulo: foto[ranura * FLOATS_POR_CUERPO + 2],
  };
}
