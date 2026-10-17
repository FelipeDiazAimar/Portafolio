// Lógica pura del efecto de rayos X del hero (sin three ni DOM, para poder probarla).

// Curva suave 0..1 (empieza y termina despacio).
export function suave(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

// Acumula el tiempo que el cursor pasa sobre la foto y avisa una sola vez al llegar al límite.
export function crearAcumulador(limiteMs) {
  let acumulado = 0;
  let disparado = false;
  return {
    // Suma `dtMs` si el cursor está adentro. Devuelve true sólo en el cuadro en que se cruza el límite.
    sumar(dtMs, adentro) {
      if (disparado || !adentro) return false;
      acumulado += Math.max(0, dtMs);
      if (acumulado >= limiteMs) {
        disparado = true;
        return true;
      }
      return false;
    },
    reiniciar() {
      acumulado = 0;
      disparado = false;
    },
    get valor() {
      return acumulado;
    },
    get disparado() {
      return disparado;
    },
  };
}

// Grilla hexagonal del demo original: `cantidad` modelos en filas, las impares corridas medio paso,
// con las filas más juntas (× 0,65) y todo centrado en el origen. Devuelve [x, 0, z] por modelo.
export function grillaHexagonal(cantidad, separacion) {
  const lado = Math.ceil(Math.sqrt(cantidad));
  const mitad = ((lado - 1) * separacion) / 2;
  const separacionZ = separacion * 0.65;
  const mitadZ = ((lado - 1) * separacionZ) / 2;
  return Array.from({ length: cantidad }, (_, i) => {
    const x = i % lado;
    const z = Math.floor(i / lado);
    const corrimiento = z % 2 === 1 ? separacion / 2 : 0;
    return [x * separacion - mitad + corrimiento, 0, z * separacionZ - mitadZ];
  });
}

// Ubica el cráneo del modelo sobre la cara de la foto. La cámara del retrato es ortográfica y cubre
// el marco entero: x en [-aspecto, aspecto], y en [-1, 1] (alto del marco = 2 unidades).
// `calibracion`: centroX, centroY (0..1 del marco, y desde arriba) y alto (fracción del alto del
// marco que ocupa el cráneo). `craneo`: centro en y y alto del cráneo en coordenadas del modelo.
// Devuelve la posición y la escala del modelo.
export function encuadreRetrato(calibracion, aspecto, craneo) {
  const escala = (calibracion.alto * 2) / craneo.alto;
  return {
    escala,
    x: (calibracion.centroX * 2 - 1) * aspecto - (craneo.centroX ?? 0) * escala,
    y: 1 - calibracion.centroY * 2 - craneo.centroY * escala,
  };
}
