// Reparte un texto con partes resaltadas en renglones que entren en `ancho`.
// `partes` viene de `dividirResaltado` ([{ texto, resaltado }]) y `medir(texto,
// resaltado)` devuelve el ancho en píxeles de ese texto (en la fuente real, que
// sólo conoce el navegador). Devuelve una lista de renglones; cada renglón es una
// lista de fragmentos { texto, resaltado } sin espacios sobrantes en los extremos.
export function partirEnRenglones(partes, ancho, medir) {
  // Palabras con su estilo; los espacios se miden aparte y se pegan al fragmento
  // siguiente de la misma línea.
  const palabras = [];
  for (const { texto, resaltado } of partes) {
    for (const pedazo of texto.split(/(\s+)/)) {
      if (pedazo !== '') palabras.push({ texto: pedazo, resaltado, espacio: /^\s+$/.test(pedazo) });
    }
  }

  const renglones = [];
  let actual = [];
  let usado = 0;
  const cerrar = () => {
    // Sin espacios al final ni al principio del renglón.
    while (actual.length && actual[actual.length - 1].espacio) actual.pop();
    while (actual.length && actual[0].espacio) actual.shift();
    if (actual.length) renglones.push(fusionar(actual));
    actual = [];
    usado = 0;
  };

  for (const palabra of palabras) {
    const largo = medir(palabra.texto, palabra.resaltado);
    if (palabra.espacio) {
      if (actual.length) {
        actual.push(palabra);
        usado += largo;
      }
      continue;
    }
    if (usado + largo > ancho && actual.length) cerrar();
    actual.push(palabra);
    usado += largo;
  }
  cerrar();
  return renglones;
}

// Une fragmentos contiguos con el mismo estilo.
function fusionar(items) {
  const salida = [];
  items.forEach((item) => {
    const estilo = item.resaltado;
    const previo = salida[salida.length - 1];
    if (previo && previo.resaltado === estilo) previo.texto += item.texto;
    else salida.push({ texto: item.texto, resaltado: estilo });
  });
  return salida;
}
