import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter } from 'three';

// Atlas de logos: una celda cuadrada por habilidad, en blanco sobre transparente (el shader
// sólo usa el alfa como máscara y le pone el color de la paleta).
// Los logos salen del DOM: Habilidades renderiza oculto un <IconoTecnologia> por habilidad
// (el mismo componente de los proyectos), y acá se toma su <svg> o, si no tiene ícono, su sigla.

export const CELDAS = 8; // 8 × 8 = 64 habilidades
const LADO_CELDA = 128;
const MARGEN = 18;

function svgAImagen(svg) {
  const copia = svg.cloneNode(true);
  copia.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  copia.setAttribute('width', String(LADO_CELDA));
  copia.setAttribute('height', String(LADO_CELDA));
  // react-icons pinta con currentColor: se fija blanco para que el alfa sea la forma.
  copia.setAttribute('color', '#ffffff');
  copia.setAttribute('fill', '#ffffff');
  copia.style.color = '#ffffff';
  // Un contorno blanco fino engorda cada logo (~2 % de su tamaño): a tamaños chicos, como en las
  // esferas del árbol, un trazo delgado se filtra y queda semitransparente (gris en vez de blanco).
  const caja = (copia.getAttribute('viewBox') ?? '0 0 24 24').split(/[\s,]+/).map(Number);
  const ancho = caja[2] || 24;
  copia.setAttribute('stroke', '#ffffff');
  copia.setAttribute('stroke-width', String(ancho * 0.03));
  copia.setAttribute('stroke-linejoin', 'round');
  const texto = new XMLSerializer().serializeToString(copia).replace(/currentColor/g, '#ffffff');
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(texto)}`;
  return new Promise((resolver) => {
    const imagen = new Image();
    imagen.onload = () => resolver(imagen);
    imagen.onerror = () => resolver(null);
    imagen.src = url;
  });
}

function dibujarSigla(ctx, texto, x, y) {
  const lado = LADO_CELDA - MARGEN * 2;
  let tamano = lado * 0.62;
  ctx.font = `800 ${tamano}px system-ui, sans-serif`;
  const ancho = ctx.measureText(texto).width;
  if (ancho > lado) tamano *= lado / ancho;
  ctx.font = `800 ${tamano}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(texto, x + LADO_CELDA / 2, y + LADO_CELDA / 2 + tamano * 0.04);
  // un marco redondeado, como la sigla de los proyectos
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(x + MARGEN * 0.6, y + MARGEN * 1.4, LADO_CELDA - MARGEN * 1.2, LADO_CELDA - MARGEN * 2.8, 16);
  ctx.stroke();
}

// Atlas de nombres: una franja por habilidad, texto blanco alineado a la izquierda (va sobre la
// barra, a continuación del logo). Con la tipografía del sitio.
export const CELDAS_NOMBRES = [4, 16]; // 4 columnas × 16 filas = 64
const ANCHO_NOMBRE = 512;
const ALTO_NOMBRE = 192; // la franja del nombre en la barra mide 0,84 × 0,32 (2,6:1): la celda va en la misma proporción

export function crearAtlasNombres(nombres) {
  const lienzo = document.createElement('canvas');
  lienzo.width = CELDAS_NOMBRES[0] * ANCHO_NOMBRE;
  lienzo.height = CELDAS_NOMBRES[1] * ALTO_NOMBRE;
  const ctx = lienzo.getContext('2d', { willReadFrequently: true }); // por software: ver crearAtlas
  const familia = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  nombres.forEach((nombre, i) => {
    const x = (i % CELDAS_NOMBRES[0]) * ANCHO_NOMBRE;
    const y = Math.floor(i / CELDAS_NOMBRES[0]) * ALTO_NOMBRE;
    let tamano = ALTO_NOMBRE * 0.66;
    ctx.font = `800 ${tamano}px ${familia}`;
    const ancho = ctx.measureText(nombre).width;
    const maximo = ANCHO_NOMBRE - 16;
    if (ancho > maximo) tamano *= maximo / ancho;
    ctx.font = `800 ${tamano}px ${familia}`;
    // las letras van engordadas con un contorno: al achicarse en pantalla, un trazo fino se
    // difumina y el blanco se pierde
    ctx.lineWidth = Math.max(2, tamano * 0.035);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#ffffff';
    ctx.strokeText(nombre, x + 8, y + ALTO_NOMBRE / 2);
    ctx.fillText(nombre, x + 8, y + ALTO_NOMBRE / 2);
  });
  const textura = new CanvasTexture(lienzo);
  textura.minFilter = LinearMipmapLinearFilter;
  textura.magFilter = LinearFilter;
  textura.anisotropy = 16;
  return textura;
}

// `nodos`: un elemento por habilidad (en el orden del atlas). Devuelve la textura y una
// promesa que se resuelve cuando están todos los logos dibujados.
export function crearAtlas(nodos) {
  const lienzo = document.createElement('canvas');
  lienzo.width = CELDAS * LADO_CELDA;
  lienzo.height = CELDAS * LADO_CELDA;
  // Lienzo por software (willReadFrequently): uno acelerado por GPU puede perder su contenido cuando
  // se crea el contexto WebGL de la escena, y el atlas quedaba con casi todos los logos borrados.
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#ffffff';
  const textura = new CanvasTexture(lienzo);
  textura.minFilter = LinearMipmapLinearFilter;
  textura.magFilter = LinearFilter;
  textura.anisotropy = 8;
  const listo = Promise.all(
    nodos.map(async (nodo, i) => {
      if (!nodo || i >= CELDAS * CELDAS) return;
      const x = (i % CELDAS) * LADO_CELDA;
      const y = Math.floor(i / CELDAS) * LADO_CELDA;
      const svg = nodo.querySelector('svg');
      if (svg) {
        const imagen = await svgAImagen(svg);
        if (imagen) ctx.drawImage(imagen, x + MARGEN, y + MARGEN, LADO_CELDA - MARGEN * 2, LADO_CELDA - MARGEN * 2);
        return;
      }
      const sigla = nodo.textContent?.trim();
      if (sigla) dibujarSigla(ctx, sigla, x, y);
    })
  ).then(() => {
    textura.needsUpdate = true;
  });
  return { textura, listo };
}
