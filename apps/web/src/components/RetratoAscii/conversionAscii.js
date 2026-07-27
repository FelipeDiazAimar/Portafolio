// Rampa de menos a más "tinta". Sólo ASCII imprimible: los bloques Unicode
// caen en el rectángulo de carácter faltante en varias monoespaciadas, cosa
// que este proyecto ya se comió con el campo del nombre.
export const RAMPA = ' .:-=+*#%@';
// Por debajo de este alfa se considera fondo recortado y la celda queda vacía.
export const UMBRAL_ALFA = 96;

// Ancho de un carácter monoespaciado relativo a su alto. Hace falta para que
// la grilla no deforme la foto: la celda de muestreo tiene que tener la misma
// proporción que el carácter que después se dibuja.
export function medirRatioMonoespaciado() {
  const ctx = document.createElement('canvas').getContext('2d');
  const referencia = 100;
  ctx.font = `${referencia}px monospace`;
  return ctx.measureText('0').width / referencia;
}

export function luminanciaDeColor(css) {
  const texto = css.trim();

  // Los tokens del proyecto son hexadecimales, y hex es lo que devuelve
  // getPropertyValue de una custom property.
  const hex = texto.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const digitos = hex[1];
    const completo =
      digitos.length === 3
        ? digitos
            .split('')
            .map((d) => d + d)
            .join('')
        : digitos;
    const r = parseInt(completo.slice(0, 2), 16);
    const g = parseInt(completo.slice(2, 4), 16);
    const b = parseInt(completo.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  const componentes = texto.match(/\d+(\.\d+)?/g);
  if (!componentes || componentes.length < 3) return 0;
  const [r, g, b] = componentes.map(Number);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// Con fondo oscuro y texto claro, un carácter denso emite MÁS luz, así que
// las zonas claras de la foto van a caracteres densos. En tema claro es al
// revés: si no se invierte la rampa, la foto se ve en negativo.
export function leerColoresDelTema() {
  // Se leen las custom properties de <html> y NO el computed color de <body>:
  // globals.css le pone a body `transition: color .3s`, así que justo después
  // de cambiar el tema getComputedStyle devuelve el valor INTERPOLADO, o sea
  // todavía el del tema anterior. Eso no sólo pintaría con el color viejo:
  // también decidiría mal `invertida` y dejaría la foto en negativo. Las
  // custom properties no transicionan, así que ya valen el color nuevo.
  const estilo = getComputedStyle(document.documentElement);
  const colorTexto = estilo.getPropertyValue('--color-fg').trim();
  const colorFondo = estilo.getPropertyValue('--color-bg').trim();
  return {
    colorTexto,
    colorFondo,
    invertida: luminanciaDeColor(colorTexto) < luminanciaDeColor(colorFondo),
  };
}

// `imagen` es un HTMLImageElement ya cargado.
export function convertirAAscii(imagen, { columnas, invertida }) {
  const ratio = medirRatioMonoespaciado();
  // Con celdas de muestreo de esta proporción, la grilla reproduce la imagen
  // sin estirarla al dibujarla con caracteres.
  const filas = Math.max(1, Math.round(columnas * (imagen.height / imagen.width) * ratio));

  const lienzo = document.createElement('canvas');
  lienzo.width = imagen.width;
  lienzo.height = imagen.height;
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(imagen, 0, 0);
  const { data } = ctx.getImageData(0, 0, imagen.width, imagen.height);

  const anchoCelda = imagen.width / columnas;
  const altoCelda = imagen.height / filas;
  const celdas = new Array(columnas * filas);

  for (let f = 0; f < filas; f += 1) {
    for (let c = 0; c < columnas; c += 1) {
      const desdeX = Math.floor(c * anchoCelda);
      const hastaX = Math.max(desdeX + 1, Math.floor((c + 1) * anchoCelda));
      const desdeY = Math.floor(f * altoCelda);
      const hastaY = Math.max(desdeY + 1, Math.floor((f + 1) * altoCelda));

      // Promedio del bloque, no muestreo de un punto: en una foto el punto
      // suelto engancha ruido y la grilla queda sucia.
      let sumaAlfa = 0;
      let sumaLuz = 0;
      let opacos = 0;
      for (let y = desdeY; y < hastaY; y += 1) {
        for (let x = desdeX; x < hastaX; x += 1) {
          const i = (y * imagen.width + x) * 4;
          const alfa = data[i + 3];
          sumaAlfa += alfa;
          if (alfa < UMBRAL_ALFA) continue;
          // Sólo los píxeles con sujeto aportan luminancia: promediar los
          // transparentes arrastraría el negro del RGB vacío.
          sumaLuz += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          opacos += 1;
        }
      }

      const total = (hastaX - desdeX) * (hastaY - desdeY);
      if (sumaAlfa / total < UMBRAL_ALFA || opacos === 0) {
        celdas[f * columnas + c] = ' ';
        continue;
      }

      const luz = sumaLuz / opacos / 255;
      const nivel = invertida ? 1 - luz : luz;
      const indice = Math.min(RAMPA.length - 1, Math.max(0, Math.round(nivel * (RAMPA.length - 1))));
      celdas[f * columnas + c] = RAMPA[indice];
    }
  }

  return { columnas, filas, celdas };
}

// El fondo opaco es necesario: sin él la foto se vería por detrás de los
// caracteres. Como es `--color-bg`, el mismo fondo de `.capa-inicio`, las
// zonas transparentes del recorte quedan invisibles.
export function pintarAscii(ctx, ascii, ancho, alto, colorTexto, colorFondo) {
  ctx.fillStyle = colorFondo;
  ctx.fillRect(0, 0, ancho, alto);

  const anchoCelda = ancho / ascii.columnas;
  const altoCelda = alto / ascii.filas;
  ctx.fillStyle = colorTexto;
  ctx.font = `${altoCelda}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let f = 0; f < ascii.filas; f += 1) {
    for (let c = 0; c < ascii.columnas; c += 1) {
      const caracter = ascii.celdas[f * ascii.columnas + c];
      if (caracter === ' ') continue;
      ctx.fillText(caracter, (c + 0.5) * anchoCelda, (f + 0.5) * altoCelda);
    }
  }
}
