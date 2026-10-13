// Capturas de regresión visual (hero + sobre-mi, temas dark/light).
// Uso desde la raíz del monorepo: BASE_URL=http://127.0.0.1:3001 node apps/web/scripts/captura-regresion.mjs antes|despues
// El argumento indica la subcarpeta de scripts/.regresion/ donde guardar.
// Requiere el dev server levantado (no lo levanta este script).
// Usa UNA sesión CDP por pestaña para que el override de viewport aplique.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  lanzarChrome,
  nuevaPestana,
  abrirSesion,
  cerrarChrome,
} from './cdp-ayuda.mjs';

const PUERTO = 9445;
// El dev corre en 3001 si el 3000 está ocupado: se puede forzar con BASE_URL.
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const TEMAS = ['dark', 'light'];
const VIEWPORT = { width: 1500, height: 820, deviceScaleFactor: 1, mobile: false };

const dormir = (ms) => new Promise((res) => setTimeout(res, ms));
const dirScript = path.dirname(fileURLToPath(import.meta.url));

// Captura una URL en un tema dado, con sesión CDP persistente.
async function capturarTema(url, tema, ruta) {
  const { id } = await nuevaPestana(PUERTO, url);
  const sesion = await abrirSesion(PUERTO, id);
  try {
    await sesion.enviar('Page.enable');
    await sesion.enviar('Emulation.setDeviceMetricsOverride', VIEWPORT);
    return { sesion, ruta };
  } catch (e) {
    sesion.cerrar();
    throw e;
  }
}

async function principal() {
  const destino = process.argv[2];
  if (destino !== 'antes' && destino !== 'despues') {
    console.error('Uso: node scripts/captura-regresion.mjs antes|despues');
    process.exit(1);
  }

  // Verifica que el dev server responda; no lo levanta este script.
  try {
    const res = await fetch(BASE_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch {
    console.error(`ERROR: el dev server no responde en ${BASE_URL}. Levántalo primero (p. ej. npm run dev:web).`);
    process.exit(1);
  }

  const dirSalida = path.join(dirScript, '.regresion', destino);
  fs.mkdirSync(dirSalida, { recursive: true });
  // Perfil temporal del SO para no contaminar el perfil real de Chrome.
  const dirPerfil = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-regresion-'));

  const chrome = await lanzarChrome(PUERTO, dirPerfil);
  const generados = [];
  try {
    // Hero en ambos temas: pestaña en #inicio, espera 3 s (load + sleep).
    for (const tema of TEMAS) {
      const { sesion, ruta } = await capturarTema(
        `${BASE_URL}/#inicio`,
        tema,
        path.join(dirSalida, `hero-${tema}.png`),
      );
      try {
        await dormir(3000); // Page.loadEventFired + margen.
        if (tema === 'light') {
          // El tema dark es el valor por defecto del sitio; solo hay que forzar light.
          await sesion.enviar('Runtime.evaluate', {
            expression: `document.documentElement.setAttribute('data-theme','light')`,
            returnByValue: true,
          });
          await dormir(1000);
        }
        const cap = await sesion.enviar('Page.captureScreenshot', {
          format: 'png',
          fromSurface: true,
        });
        fs.writeFileSync(ruta, Buffer.from(cap.data, 'base64'));
        generados.push(ruta);
      } finally {
        sesion.cerrar();
      }
    }

    // Sobre-mi en ambos temas: navegar a #sobre-mi y esperar 12 s
    // (el modelo 3D del hito 0 debe armarse) antes de capturar.
    for (const tema of TEMAS) {
      const { sesion, ruta } = await capturarTema(
        `${BASE_URL}/#sobre-mi`,
        tema,
        path.join(dirSalida, `sobre-mi-${tema}.png`),
      );
      try {
        await dormir(12000);
        if (tema === 'light') {
          await sesion.enviar('Runtime.evaluate', {
            expression: `document.documentElement.setAttribute('data-theme','light')`,
            returnByValue: true,
          });
          await dormir(1000);
        }
        const cap = await sesion.enviar('Page.captureScreenshot', {
          format: 'png',
          fromSurface: true,
        });
        fs.writeFileSync(ruta, Buffer.from(cap.data, 'base64'));
        generados.push(ruta);
      } finally {
        sesion.cerrar();
      }
    }

    console.table(generados.map((archivo) => ({ archivo })));
  } finally {
    cerrarChrome(chrome);
  }
}

await principal();
