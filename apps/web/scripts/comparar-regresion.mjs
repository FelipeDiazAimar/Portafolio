// Comparación de regresión visual (hero + sobre-mi, dark/light) con sharp en raw.
// Uso: node apps/web/scripts/comparar-regresion.mjs
// Compara apps/web/scripts/.regresion/antes vs .regresion/despues.
// Criterio: menos de 1,5 % de píxeles distintos con umbral por canal de 24.
// Para sobre-mi compara SOLO la zona de texto x:0–700, y:80–330 (el hito 0 anima).
// Sale con código 1 si algún par difiere >= 1,5 % (FALLO: no seguir).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const UMBRAL_CANAL = 24;
const UMBRAL_PORCENTAJE = 1.5;

const dirScript = path.dirname(fileURLToPath(import.meta.url));
const dirAntes = path.join(dirScript, '.regresion', 'antes');
const dirDespues = path.join(dirScript, '.regresion', 'despues');

// Pares a comparar; sobreMi lleva recorte de zona de texto.
const PARES = [
  { nombre: 'hero-dark', recorte: null },
  { nombre: 'hero-light', recorte: null },
  { nombre: 'sobre-mi-dark', recorte: { left: 0, top: 80, width: 700, height: 250 } },
  { nombre: 'sobre-mi-light', recorte: { left: 0, top: 80, width: 700, height: 250 } },
];

// Lee un PNG como raw (aplica recorte si se pide).
async function leerRaw(ruta, recorte) {
  let pipeline = sharp(ruta);
  if (recorte) {
    pipeline = pipeline.extract(recorte);
  }
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  return { data, info };
}

// Compara dos buffers raw: píxel distinto si algún canal RGB difiere > umbral.
function compararBuffers(a, b, canales) {
  // Ignora alfa: compara solo los 3 primeros canales.
  const porPixel = Math.min(canales, 3);
  const totalPixeles = Math.floor(a.length / canales);
  let distintos = 0;
  for (let p = 0; p < totalPixeles; p++) {
    const base = p * canales;
    let dif = false;
    for (let c = 0; c < porPixel; c++) {
      if (Math.abs(a[base + c] - b[base + c]) > UMBRAL_CANAL) {
        dif = true;
        break;
      }
    }
    if (dif) distintos++;
  }
  return { distintos, totalPixeles };
}

async function principal() {
  const filas = [];
  let fallo = false;
  for (const par of PARES) {
    const rutaAntes = path.join(dirAntes, `${par.nombre}.png`);
    const rutaDespues = path.join(dirDespues, `${par.nombre}.png`);
    if (!fs.existsSync(rutaAntes) || !fs.existsSync(rutaDespues)) {
      const cual = !fs.existsSync(rutaAntes) ? rutaAntes : rutaDespues;
      filas.push({ captura: par.nombre, difPct: 'N/A', pixelesDistintos: 'N/A', total: 'N/A', resultado: `NO PASA (falta ${cual})` });
      fallo = true;
      continue;
    }
    const { data: bufA, info: infoA } = await leerRaw(rutaAntes, par.recorte);
    const { data: bufB, info: infoB } = await leerRaw(rutaDespues, par.recorte);
    if (infoA.width !== infoB.width || infoA.height !== infoB.height || infoA.channels !== infoB.channels) {
      filas.push({
        captura: par.nombre,
        difPct: 'N/A',
        pixelesDistintos: 'N/A',
        total: `${infoA.width}x${infoA.height}x${infoA.channels} vs ${infoB.width}x${infoB.height}x${infoB.channels}`,
        resultado: 'NO PASA (dimensiones distintas)',
      });
      fallo = true;
      continue;
    }
    const { distintos, totalPixeles } = compararBuffers(bufA, bufB, infoA.channels);
    const pct = (distintos / totalPixeles) * 100;
    const pasa = pct < UMBRAL_PORCENTAJE;
    if (!pasa) fallo = true;
    filas.push({
      captura: par.nombre,
      difPct: `${pct.toFixed(3)} %`,
      pixelesDistintos: distintos,
      total: totalPixeles,
      resultado: pasa ? 'PASA' : 'NO PASA (>= 1,5 %)',
    });
  }
  console.table(filas);
  if (fallo) {
    console.error(`FALLO: alguna captura difiere >= ${UMBRAL_PORCENTAJE} % (umbral canal ${UMBRAL_CANAL}). No seguir: revisar Tailwind.`);
    process.exit(1);
  } else {
    console.log(`OK: las 4 capturas difieren < ${UMBRAL_PORCENTAJE} % (umbral canal ${UMBRAL_CANAL}).`);
  }
}

await principal();
