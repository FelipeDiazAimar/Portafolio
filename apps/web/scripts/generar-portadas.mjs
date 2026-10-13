// Genera portadas sintéticas 1440×900 para proyectos sin captura ni respaldo.
// Renderiza una plantilla HTML inline con el mismo Chrome headless (CDP) y
// la guarda como apps/web/public/proyectos/<slug>/portada.webp (WebP ≤400 KB).
// Reúsa lanzarChrome/nuevaPestana/cerrarChrome de ./cdp-ayuda.mjs.
// NOTA: usa sesión CDP persistente (un WebSocket por pestaña) porque el helper
// cdp() abre y cierra un WS por comando y Chrome descarta el
// Emulation.setDeviceMetricsOverride al cerrarse la sesión (verificado: todo
// salía a 762×484 en vez de 1440×900).
// Comentarios en español. Uso desde apps/web: node scripts/generar-portadas.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { lanzarChrome, nuevaPestana, cerrarChrome } from './cdp-ayuda.mjs';

// Mismo Chrome headless que capturar-proyectos.mjs.
const PUERTO = 9444;
// Límite de aceptación para portada.webp (400 KB).
const LIMITE_PORTADA = 400 * 1024;

const dormir = (ms) => new Promise((res) => setTimeout(res, ms));
const dirScript = path.dirname(fileURLToPath(import.meta.url));
const rutaJson = path.join(dirScript, '..', 'src', 'data', 'proyectos.json');
const dirPublic = path.join(dirScript, '..', 'public', 'proyectos');

function existe(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

// Abre una sesión CDP persistente sobre un único WebSocket.
// Hay que esperar `lista` (apertura) antes de enviar comandos.
function crearSesion(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let seq = 0;
  const pendientes = new Map();
  const eventos = [];
  ws.addEventListener('message', (ev) => {
    let msg;
    try {
      msg = JSON.parse(String(ev.data));
    } catch {
      return; // Mensaje no JSON: ignorar.
    }
    if (msg.id !== undefined && pendientes.has(msg.id)) {
      const { resolver, rechazar } = pendientes.get(msg.id);
      pendientes.delete(msg.id);
      if (msg.error) {
        rechazar(new Error(`CDP: ${msg.error.message ?? JSON.stringify(msg.error)}`));
      } else {
        resolver(msg.result ?? {});
      }
    } else if (msg.method) {
      eventos.push(msg.method);
    }
  });
  const lista = new Promise((res, rej) => {
    ws.addEventListener('open', () => res(), { once: true });
    ws.addEventListener('error', (e) => rej(e?.error ?? new Error('Error WebSocket')), {
      once: true,
    });
  });
  const enviar = (metodo, params = {}) =>
    new Promise((resolver, rechazar) => {
      const id = ++seq;
      pendientes.set(id, { resolver, rechazar });
      ws.send(JSON.stringify({ id, method: metodo, params }));
      setTimeout(() => {
        if (pendientes.has(id)) {
          pendientes.delete(id);
          rechazar(new Error(`Timeout CDP (30 s) en ${metodo}`));
        }
      }, 30000);
    });
  const cerrar = () => {
    pendientes.clear();
    try {
      ws.close();
    } catch {
      // Ignorar errores al cerrar.
    }
  };
  return { lista, enviar, cerrar, eventos };
}

// Escapa texto para interpolarlo en HTML.
function escaparHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// Convierte #rgb/#rrggbb a rgba(r,g,b,alpha).
function hexARgba(hex, alpha) {
  let h = String(hex ?? '#ffffff').trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) h = 'ffffff';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Plantilla inline 1440×900: fondo oscuro, degradado del color, grilla,
// cliente arriba, título + problema centro-izquierda, chips y stack abajo.
// Sin logos de terceros; para mbrf-* no se agrega logo alguno.
function plantilla(proyecto) {
  const color = proyecto.color ?? '#ffffff';
  const halo = hexARgba(color, 0.35);
  const cliente = escaparHtml(proyecto.cliente ?? '');
  const titulo = escaparHtml(proyecto.titulo ?? proyecto.slug);
  const problema = escaparHtml(proyecto.problema || proyecto.resumen || '');
  const metricas = Array.isArray(proyecto.metricas) ? proyecto.metricas : [];
  const chips = metricas.map((m) => `<span class="chip">${escaparHtml(m)}</span>`).join('');
  const stack = Array.isArray(proyecto.stack) ? proyecto.stack.slice(0, 5) : [];
  const stackTxt = escaparHtml(stack.join(' · ').toUpperCase());

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<style>
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{width:1440px;height:900px;background:#0b0d12;color:#fff;
font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
position:relative;overflow:hidden}
.halo{position:absolute;top:-260px;right:-260px;width:1000px;height:1000px;
background:radial-gradient(circle,${halo} 0%,transparent 65%)}
.grilla{position:absolute;inset:0;
background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),
linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);
background-size:48px 48px}
.contenido{position:relative;z-index:1;height:100%;padding:72px 80px;
display:flex;flex-direction:column}
.cliente{font-weight:600;font-size:22px;opacity:.7}
.centro{margin-top:96px}
.titulo{font-weight:800;font-size:88px;line-height:1.02;margin:24px 0 0;
max-width:1150px;display:-webkit-box;-webkit-line-clamp:2;
-webkit-box-orient:vertical;overflow:hidden}
.problema{font-weight:400;font-size:28px;line-height:1.4;opacity:.8;
max-width:900px;margin:28px 0 0}
.abajo{margin-top:auto;display:flex;justify-content:space-between;
align-items:flex-end;gap:32px}
.chips{display:flex;gap:12px;flex-wrap:wrap;max-width:950px}
.chip{border:1px solid ${color};border-radius:999px;font-size:20px;
padding:10px 22px;color:#fff;white-space:nowrap;background:rgba(255,255,255,.03)}
.stack{font-size:18px;letter-spacing:3px;text-transform:uppercase;
opacity:.7;text-align:right;max-width:380px;line-height:1.7}
</style></head><body>
<div class="halo"></div><div class="grilla"></div>
<div class="contenido">
<div class="cliente">${cliente}</div>
<div class="centro"><div class="titulo">${titulo}</div>
<div class="problema">${problema}</div></div>
<div class="abajo"><div class="chips">${chips}</div>
<div class="stack">${stackTxt}</div></div>
</div></body></html>`;
}

// Renderiza la plantilla en Chrome (viewport 1440×900 real) y guarda portada.webp.
async function generarPortada(puerto, proyecto, destino) {
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const html = plantilla(proyecto);
  const { webSocketDebuggerUrl } = await nuevaPestana(puerto, 'about:blank');
  const sesion = crearSesion(webSocketDebuggerUrl);
  await sesion.lista;
  try {
    await sesion.enviar('Page.enable');
    await sesion.enviar('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    // Inyecta el HTML sin navegar a red externa (evita depender de la red).
    await sesion.enviar('Runtime.evaluate', {
      expression: `document.open();document.write(${JSON.stringify(html)});document.close()`,
      returnByValue: true,
    });
    await dormir(1500);
    const r = await sesion.enviar('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
    });
    if (!r?.data) throw new Error('captureScreenshot no devolvió imagen');
    const buf = Buffer.from(r.data, 'base64');
    for (const calidad of [82, 70, 60, 50]) {
      await sharp(buf).webp({ quality: calidad }).toFile(destino);
      const tam = fs.statSync(destino).size;
      if (tam <= LIMITE_PORTADA || calidad === 50) break;
    }
  } finally {
    sesion.cerrar();
  }
}

async function principal() {
  const proyectos = JSON.parse(fs.readFileSync(rutaJson, 'utf8'));
  // Genera para los 5 laborales/académicos sin sitio y para cualquier
  // proyecto que haya quedado sin portada (sin captura ni respaldo).
  const objetivos = proyectos.filter((p) => !existe(path.join(dirPublic, p.slug, 'portada.webp')));
  if (objetivos.length === 0) {
    console.log('slug|estado|archivos');
    console.log('(sin pendientes: las 13 portadas ya existen)');
    return;
  }
  // Perfil temporal para no contaminar el perfil real de Chrome.
  const dirPerfil = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-portadas-'));
  const chrome = await lanzarChrome(PUERTO, dirPerfil);
  const filas = [];
  try {
    for (const proyecto of objetivos) {
      const destino = path.join(dirPublic, proyecto.slug, 'portada.webp');
      try {
        await generarPortada(PUERTO, proyecto, destino);
        filas.push({ slug: proyecto.slug, estado: 'plantilla', archivos: 'portada.webp' });
      } catch (err) {
        filas.push({ slug: proyecto.slug, estado: `error: ${err?.message ?? err}`, archivos: '' });
      }
    }
    // Tabla slug|estado|archivos pedida por la especificación.
    console.log('slug|estado|archivos');
    for (const f of filas) console.log(`${f.slug}|${f.estado}|${f.archivos}`);
    console.table(filas);
  } finally {
    cerrarChrome(chrome);
  }
}

await principal();
