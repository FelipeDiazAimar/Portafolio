// Genera logos sintéticos 900×900 para los 13 proyectos.
// Renderiza una plantilla HTML inline con el mismo Chrome headless (CDP) y
// la guarda como apps/web/public/proyectos/<slug>/logo.webp.
// Lee el color de apps/web/src/data/proyectos.json; la sigla y el brand
// vienen del mapa fijo de abajo (sin logos de terceros, sin capturas).
// Reúsa lanzarChrome/nuevaPestana/abrirSesion/cerrarChrome de ./cdp-ayuda.mjs.
// NOTA: usa sesión CDP persistente (abrirSesion) para que el viewport de
// 900×900 fijado con Emulation.setDeviceMetricsOverride se mantenga hasta
// la captura (con un WS nuevo por comando Chrome lo descarta y la captura
// sale a 762×484 en vez de 900×900).
// Comentarios en español. Uso desde apps/web: node scripts/generar-logos.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { lanzarChrome, nuevaPestana, abrirSesion, cerrarChrome } from './cdp-ayuda.mjs';

// Puerto de depuración remota (igual que los otros scripts de capturas).
const PUERTO = 9444;
// Lado del logo en px.
const LADO = 900;

// Mapa fijo slug → sigla gigante + brand (pedido por la especificación).
const MAPA = {
  'mbrf-captura': { sigla: 'TSF', brand: 'Traza SF' },
  'mbrf-control': { sigla: 'MPC', brand: 'Control Planta' },
  neifert: { sigla: 'N', brand: 'Neifert' },
  'dario-martinez': { sigla: 'DM', brand: 'Darío Martínez' },
  justphones: { sigla: 'JP', brand: 'JustPhones' },
  algobonito: { sigla: 'AB', brand: 'Algo Bonito' },
  'calida-escencia': { sigla: 'CE', brand: 'Calida Escencia' },
  asistente: { sigla: 'IA', brand: 'Asistente IA' },
  'control-salidas-rrhh': { sigla: 'CSR', brand: 'Control Salidas' },
  'gestor-proyectos-sap': { sigla: 'GSAP', brand: 'Gestor SAP' },
  bibliotech: { sigla: 'BT', brand: 'BiblioTech' },
  movii: { sigla: 'M', brand: 'Movii' },
  'crm-inmobiliaria': { sigla: 'CRM', brand: 'CRM' },
};

const dormir = (ms) => new Promise((res) => setTimeout(res, ms));
const dirScript = path.dirname(fileURLToPath(import.meta.url));
const rutaJson = path.join(dirScript, '..', 'src', 'data', 'proyectos.json');
const dirPublic = path.join(dirScript, '..', 'public', 'proyectos');

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

// Tamaño de la sigla según su longitud para que siga gigante (~300px)
// pero sin desbordar el lienzo de 900px en siglas de 3–4 letras.
function tamanoSigla(sigla) {
  const n = String(sigla ?? '').length;
  if (n <= 1) return 340;
  if (n === 2) return 300;
  if (n === 3) return 220;
  return 170;
}

// Plantilla inline 900×900: fondo #0b0d12, degradado radial del color del
// proyecto (opacidad 0,35) arriba a la derecha, grilla de líneas finas cada
// 48px, sigla gigante centrada (Inter 800) y brand debajo (Inter 600).
// Sin logos de terceros ni capturas de sitios.
function plantilla(sigla, brand, color) {
  const halo = hexARgba(color, 0.35);
  const siglaTxt = escaparHtml(sigla);
  const brandTxt = escaparHtml(brand);
  const px = tamanoSigla(sigla);

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<style>
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{width:${LADO}px;height:${LADO}px;background:#0b0d12;color:#fff;
font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
position:relative;overflow:hidden}
.halo{position:absolute;top:-220px;right:-220px;width:850px;height:850px;
background:radial-gradient(circle,${halo} 0%,transparent 65%)}
.grilla{position:absolute;inset:0;
background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),
linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);
background-size:48px 48px}
.contenido{position:relative;z-index:1;width:100%;height:100%;
display:flex;flex-direction:column;align-items:center;justify-content:center;
text-align:center;padding:48px}
.sigla{font-weight:800;font-size:${px}px;line-height:1;color:#fff;
letter-spacing:.02em}
.brand{font-weight:600;font-size:34px;opacity:.85;margin:28px 0 0}
</style></head><body>
<div class="halo"></div><div class="grilla"></div>
<div class="contenido"><div class="sigla">${siglaTxt}</div>
<div class="brand">${brandTxt}</div></div>
</body></html>`;
}

// Renderiza la plantilla en Chrome (viewport real 900×900) y guarda logo.webp.
async function generarLogo(puerto, sigla, brand, color, destino) {
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const html = plantilla(sigla, brand, color);
  const { id } = await nuevaPestana(puerto, 'about:blank');
  const sesion = await abrirSesion(puerto, id);
  try {
    await sesion.enviar('Page.enable');
    await sesion.enviar('Emulation.setDeviceMetricsOverride', {
      width: LADO,
      height: LADO,
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
    // Guarda en WebP con ancho 900.
    await sharp(buf).resize({ width: LADO }).webp({ quality: 82 }).toFile(destino);
  } finally {
    sesion.cerrar();
  }
}

async function principal() {
  const proyectos = JSON.parse(fs.readFileSync(rutaJson, 'utf8'));
  // Color por slug leído del JSON (respaldo blanco si falta).
  const colorPorSlug = new Map((proyectos ?? []).map((p) => [p.slug, p.color ?? '#ffffff']));
  // Perfil temporal para no contaminar el perfil real de Chrome.
  const dirPerfil = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-logos-'));
  const chrome = await lanzarChrome(PUERTO, dirPerfil);
  const filas = [];
  try {
    // Genera el logo de los 13 slugs del mapa, en orden.
    for (const [slug, { sigla, brand }] of Object.entries(MAPA)) {
      const color = colorPorSlug.get(slug) ?? '#ffffff';
      const destino = path.join(dirPublic, slug, 'logo.webp');
      try {
        await generarLogo(PUERTO, sigla, brand, color, destino);
        filas.push({ slug, estado: 'plantilla', archivos: 'logo.webp' });
      } catch (err) {
        filas.push({ slug, estado: `error: ${err?.message ?? err}`, archivos: '' });
      }
    }
    // Tabla slug|estado|archivos como en los otros scripts de capturas.
    console.log('slug|estado|archivos');
    for (const f of filas) console.log(`${f.slug}|${f.estado}|${f.archivos}`);
    console.table(filas);
  } finally {
    cerrarChrome(chrome);
  }
}

await principal();
