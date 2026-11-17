// Genera los dioramas isométricos de los hitos de "Sobre mí" (uno por hito y por tema).
//
//   node scripts/hitos/build.mjs            → public/hitos/diorama-<id>-oscuro.svg y -claro.svg
//   node scripts/hitos/build.mjs --solo 3   → sólo el hito 3
//
// Cada SVG es autónomo (estilos adentro, movimiento sólo con CSS) y se usa de dos maneras: como
// imagen dentro de la portada del reel (se dibuja en un canvas) y como <img> en la lista sin
// WebGL. El papel de cada tema tiene que ser el mismo que usa la portada
// (src/components/SobreMi/portadas/componerPortada.js → TEMAS): cada sólido se rellena con él.
//
// Además escribe una página de vista previa por archivo en scripts/.regresion/hitos/ (ignorada
// por git), que es donde corren las comprobaciones de anatomy-asset (capture.mjs, lines.mjs).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALTO, ANCHO, AZIMUT, ELEVACION, a, k, ponerProyeccion, puntosIsla } from './taller.mjs';
import origen from './escenas/0-origen.mjs';
import abanderado from './escenas/1-abanderado.mjs';
import ingles from './escenas/2-ingles.mjs';
import experiencias from './escenas/3-experiencias.mjs';
import tecnico from './escenas/4-tecnico.mjs';
import fullstack from './escenas/5-fullstack.mjs';
import hoy from './escenas/6-hoy.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const SALIDA = join(AQUI, '../../public/hitos');
const VISTA = join(AQUI, '../.regresion/hitos');
const hitos = JSON.parse(readFileSync(join(AQUI, '../../src/data/hitos.json'), 'utf8'));
const ESCENAS = [origen, abanderado, ingles, experiencias, tecnico, fullstack, hoy];
const PAPEL = { oscuro: '#11141b', claro: '#fbfaf6' };
// En oscuro el kit deja las caras casi del color del papel (pensado para una figura grande).
// Acá los dioramas se ven chicos dentro de una portada: se aclara la rampa neutra (grafito) y
// las líneas, para que cada pieza se lea. Los acentos tienen sus propias rampas y no cambian.
const GRAFITO = '--anatomy-face:#2a2f3a;--anatomy-top:#2d323e;--anatomy-shade-0:#161a21;--anatomy-shade-1:#1a1e26;--anatomy-shade-2:#1f232c;--anatomy-shade-3:#242932;--anatomy-lit-top:#3a404d;--anatomy-lit-shade:#2c313c;--anatomy-mid:#8a909c;--anatomy-lo:#5d6370;--anatomy-faint:#434956';

const solo = process.argv.includes('--solo') ? Number(process.argv[process.argv.indexOf('--solo') + 1]) : null;

// Achica los `d` sin perder nada: coordenadas relativas y sin ceros de más.
const num = (t) => (t / 10).toString().replace(/^(-?)0\./, '$1.');
function achicarD(d) {
  if (!/^[MLZ0-9 .\-]+$/.test(d)) return d;
  const fichas = d.match(/[MLZ]|-?\d*\.?\d+/g);
  let out = '';
  let cx = 0, cy = 0, sx = 0, sy = 0, primero = true, previo = '';
  for (let i = 0; i < fichas.length; ) {
    const c = fichas[i++];
    if (c === 'Z') { out += 'z'; cx = sx; cy = sy; previo = 'z'; continue; }
    const x = Math.round(parseFloat(fichas[i++]) * 10);
    const y = Math.round(parseFloat(fichas[i++]) * 10);
    const dx = primero ? x : x - cx;
    const dy = primero ? y : y - cy;
    const cmd = c === 'M' ? (primero ? 'M' : 'm') : 'l';
    const par = num(dx) + (dy < 0 ? '' : ' ') + num(dy);
    out += (cmd === previo && cmd === 'l' ? (dx < 0 ? '' : ' ') : cmd) + par;
    previo = cmd;
    primero = false;
    cx = x; cy = y;
    if (c === 'M') { sx = x; sy = y; }
  }
  return out;
}
const achicar = (svg) => svg.replace(/ d="([^"]*)"/g, (_, d) => ` d="${achicarD(d)}"`);

// Una cámara, una escala y un origen para los siete: un solo encuadre sobre todos los extremos.
const extremos = [...puntosIsla(), ...ESCENAS.flatMap((e) => e.puntos())];
const P = k.fitProjection(extremos, ANCHO, ALTO, { pad: 12, azimuth: AZIMUT, elevation: ELEVACION });
ponerProyeccion(P);

// Puntos de interés de cada diorama, ya proyectados (fracciones del dibujo): los usa el zoom de
// la portada para apoyar sus marcas encima. Y el vano de la puerta por donde se pasa a Proyectos.
const fraccion = (p3) => {
  const [x, y] = k.iso(p3, P);
  return { x: +(x / ANCHO).toFixed(4), y: +(y / ALTO).toFixed(4) };
};
const puntosHitos = {};
ESCENAS.forEach((escena, i) => {
  puntosHitos[hitos[i].id] = (escena.detalle ?? []).map(({ en, titulo, texto }) => ({ ...fraccion(en), titulo, texto }));
  if (escena.puerta) puntosHitos.puerta = escena.puerta.map(fraccion);
});
writeFileSync(join(AQUI, '../../src/data/puntosHitos.json'), `${JSON.stringify(puntosHitos, null, 2)}\n`);

mkdirSync(SALIDA, { recursive: true });
mkdirSync(VISTA, { recursive: true });

const hoja = { oscuro: [], claro: [] };
for (const tema of ['oscuro', 'claro']) {
  const oscuro = tema === 'oscuro';
  ESCENAS.forEach((escena, i) => {
    const hito = hitos[i];
    if (solo !== null && solo !== hito.id) return;
    const acentos = {
      hito: hito.acento,
      led: { hex: hito.acento, mode: 'ink' },
      zocalo: oscuro ? '#232a37' : '#565f70',
      celda: oscuro ? '#0a0e15' : '#1e2633',
      ebano: oscuro ? '#08080a' : '#3a3a3f',
      madera: oscuro ? '#6b4f36' : '#c4a17a',
      cesped: oscuro ? '#4f6a43' : '#a4bd8c',
      tronco: oscuro ? '#5a4636' : '#8f7257',
      papel: oscuro ? '#c9ccd3' : '#ffffff',
      // tinta y tiza: el tono `mid` de un acento `ink` es el hex tal cual, en los dos temas
      tinta: { hex: '#232831', mode: 'ink' },
      tiza: { hex: '#e6ede8', mode: 'ink' },
      ...(escena.acentos?.(oscuro) ?? {}),
    };
    const id = `diorama-${hito.id}-${tema}`;
    const svg = a.assetSvg({ width: ANCHO, height: ALTO, label: escena.etiqueta, body: achicar(escena.cuerpo()), paper: PAPEL[tema], accents: acentos, weight: 0.75, id, css: (oscuro ? `#${id}.iso{${GRAFITO}}` : '') + (escena.css ?? '') });
    writeFileSync(join(SALIDA, `${id}.svg`), svg);
    writeFileSync(join(VISTA, `${id}.html`), a.previewHtml({ title: id, svg, paper: PAPEL[tema], width: ANCHO }));
    hoja[tema].push(svg);
    console.log(`${id}.svg  ${(svg.length / 1024).toFixed(0)} KB  ${(svg.match(/<path/g) ?? []).length} trazos`);
  });
}

// Hoja de contactos por tema, para mirarlos todos juntos (y de a uno con ?solo=N).
for (const tema of ['oscuro', 'claro']) {
  const celdas = hoja[tema].map((svg, i) => `<div data-i="${i}">${svg}</div>`).join('');
  writeFileSync(
    join(VISTA, `hoja-${tema}.html`),
    `<!doctype html><meta charset="utf-8"><title>hoja ${tema}</title><style>body{margin:0;background:${PAPEL[tema]}}main{display:grid;grid-template-columns:repeat(var(--col,3),1fr)}svg{width:100%;height:auto;display:block}</style><main class="iso-plate">${celdas}</main><script>const q=new URLSearchParams(location.search);const s=q.get('solo');if(s!==null){document.querySelectorAll('[data-i]').forEach(d=>{if(!s.split(',').includes(d.dataset.i))d.remove()});document.querySelector('main').style.setProperty('--col',q.get('col')??s.split(',').length)}</script>`
  );
}
