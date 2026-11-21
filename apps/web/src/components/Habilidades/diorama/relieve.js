// Relieve de un logo en 2D: a partir de su silueta (el canal alfa) se arma un bisel suave, como si
// el logo fuera una pieza en relieve iluminada desde arriba a la izquierda. La silueta se
// desenfoca para tener una "altura" que sube desde el borde, y su pendiente da la normal en cada
// píxel. El interior queda neutro (el color del logo, tal cual) y sólo los bordes se aclaran del
// lado de la luz y se oscurecen del otro. Sirve para cualquier logo: la forma sale del SVG
// rasterizado, sin extruir nada (algunos íconos no se dejaban extruir enteros).
//
// El sombreado se guarda como gris: 0,5 = neutro, más claro = de cara a la luz, más oscuro = a la
// sombra.

const LUZ = (() => {
  const v = [-0.55, -0.62, 0.56]; // en el lienzo, y crece hacia abajo: la luz viene de arriba
  const n = Math.hypot(...v);
  return v.map((c) => c / n);
})();

// Desenfoque de caja separable (suma corrida): rápido aunque el radio crezca.
function desenfocar(origen, ancho, alto, radio) {
  const tmp = new Float32Array(origen.length);
  const destino = new Float32Array(origen.length);
  const lado = radio * 2 + 1;
  for (let y = 0; y < alto; y++) {
    const fila = y * ancho;
    let suma = 0;
    for (let x = -radio; x <= radio; x++) suma += origen[fila + Math.min(ancho - 1, Math.max(0, x))];
    for (let x = 0; x < ancho; x++) {
      tmp[fila + x] = suma / lado;
      suma += origen[fila + Math.min(ancho - 1, x + radio + 1)] - origen[fila + Math.max(0, x - radio)];
    }
  }
  for (let x = 0; x < ancho; x++) {
    let suma = 0;
    for (let y = -radio; y <= radio; y++) suma += tmp[Math.min(alto - 1, Math.max(0, y)) * ancho + x];
    for (let y = 0; y < alto; y++) {
      destino[y * ancho + x] = suma / lado;
      suma += tmp[Math.min(alto - 1, y + radio + 1) * ancho + x] - tmp[Math.max(0, y - radio) * ancho + x];
    }
  }
  return destino;
}

// `alfa`: Float32Array 0..1. Devuelve el sombreado (Float32Array, 0,5 = neutro).
export function sombreadoDeAlfa(alfa, ancho, alto, { radio = 3, fuerza = 9 } = {}) {
  let h = desenfocar(alfa, ancho, alto, radio);
  h = desenfocar(h, ancho, alto, radio);
  const s = new Float32Array(alfa.length);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = y * ancho + x;
      const dx = (h[i + (x < ancho - 1 ? 1 : 0)] - h[i - (x > 0 ? 1 : 0)]) * fuerza;
      const dy = (h[i + (y < alto - 1 ? ancho : 0)] - h[i - (y > 0 ? ancho : 0)]) * fuerza;
      const largo = Math.hypot(dx, dy, 1);
      const nx = -dx / largo;
      const ny = -dy / largo;
      const nz = 1 / largo;
      // de frente (interior plano) da exactamente 0: el color queda como es
      const luz = nx * LUZ[0] + ny * LUZ[1] + nz * LUZ[2] - LUZ[2];
      s[i] = Math.min(1, Math.max(0, 0.5 + luz * 1.1));
    }
  }
  return s;
}

// Atlas de relieve a partir del atlas de logos (canvas blanco sobre transparente): mismo tamaño y
// grilla. RGB = sombreado (gris), alfa = la silueta. Donde no hay logo, el gris es neutro (así el
// filtrado de la textura no oscurece los bordes).
export function atlasDeRelieve(lienzoLogos, opciones) {
  const { width: ancho, height: alto } = lienzoLogos;
  const datos = lienzoLogos.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, ancho, alto);
  const alfa = new Float32Array(ancho * alto);
  for (let i = 0; i < alfa.length; i++) alfa[i] = datos.data[i * 4 + 3] / 255;
  const s = sombreadoDeAlfa(alfa, ancho, alto, opciones);
  const salida = document.createElement('canvas');
  salida.width = ancho;
  salida.height = alto;
  const ctx = salida.getContext('2d');
  const imagen = ctx.createImageData(ancho, alto);
  for (let i = 0; i < alfa.length; i++) {
    const g = Math.round(s[i] * 255);
    imagen.data[i * 4] = g;
    imagen.data[i * 4 + 1] = g;
    imagen.data[i * 4 + 2] = g;
    imagen.data[i * 4 + 3] = datos.data[i * 4 + 3];
  }
  ctx.putImageData(imagen, 0, 0);
  return salida;
}

// Un logo suelto, en relieve y con su color, listo para mostrar (el del dock). `svg`: el markup
// del ícono; `color`: '#rrggbb'. Devuelve una promesa con { color: dataURL, mascara: dataURL } (la
// máscara es la silueta, para el barrido de luz).
export function logoEnRelieve(svg, color, lado = 192) {
  return new Promise((resolver) => {
    // blanco (react-icons pinta con currentColor) y al tamaño del lienzo; sin xmlns no carga como imagen
    let copia = svg
      .replace(/currentColor/g, '#ffffff')
      .replace(/\swidth="[^"]*"/, ` width="${lado}"`)
      .replace(/\sheight="[^"]*"/, ` height="${lado}"`);
    if (!/xmlns=/.test(copia)) copia = copia.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    const imagen = new Image();
    imagen.onload = () => {
      const lienzo = document.createElement('canvas');
      lienzo.width = lienzo.height = lado;
      const ctx = lienzo.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(imagen, 0, 0, lado, lado);
      const mascara = lienzo.toDataURL('image/png');
      const datos = ctx.getImageData(0, 0, lado, lado);
      const alfa = new Float32Array(lado * lado);
      for (let i = 0; i < alfa.length; i++) alfa[i] = datos.data[i * 4 + 3] / 255;
      const s = sombreadoDeAlfa(alfa, lado, lado, { radio: Math.max(2, Math.round(lado / 64)), fuerza: 9 });
      const n = parseInt(color.slice(1), 16);
      const base = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      for (let i = 0; i < alfa.length; i++) {
        const k = 1 + (s[i] - 0.5) * 1.1;
        datos.data[i * 4] = Math.min(255, base[0] * k + (k > 1 ? (k - 1) * 90 : 0));
        datos.data[i * 4 + 1] = Math.min(255, base[1] * k + (k > 1 ? (k - 1) * 90 : 0));
        datos.data[i * 4 + 2] = Math.min(255, base[2] * k + (k > 1 ? (k - 1) * 90 : 0));
      }
      ctx.putImageData(datos, 0, 0);
      resolver({ color: lienzo.toDataURL('image/png'), mascara });
    };
    imagen.onerror = () => resolver(null);
    imagen.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(copia)}`;
  });
}
