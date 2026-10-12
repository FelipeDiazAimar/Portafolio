// Captura portadas de proyectos con Chrome headless (CDP) + sharp.
// Lee apps/web/src/data/proyectos.json y guarda en apps/web/public/proyectos/<slug>/.
// - Con sitio: verifica HEAD/GET (15 s), navega, captura escritorio/móvil/completa.
// - Sin sitio o caído: usa imagen de respaldo (sharp → WebP, ancho máx 1600).
// Reúsa lanzarChrome/nuevaPestana/cerrarChrome de ./cdp-ayuda.mjs.
// NOTA: el viewport se maneja con una sesión CDP persistente (un WebSocket por
// pestaña) porque el helper cdp() abre y cierra un WS por comando y Chrome
// descarta el Emulation.setDeviceMetricsOverride al cerrarse la sesión
// (verificado: todo salía a 762×484). La sesión también permite esperar el
// evento Page.loadEventFired + 4 s como pide la especificación.
// Comentarios en español. Uso desde apps/web: node scripts/capturar-proyectos.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { lanzarChrome, nuevaPestana, cerrarChrome } from './cdp-ayuda.mjs';

// Puerto de depuración remota (fijo por especificación).
const PUERTO = 9444;
// Límite de aceptación para portada.webp (400 KB).
const LIMITE_PORTADA = 400 * 1024;

const dormir = (ms) => new Promise((res) => setTimeout(res, ms));
const dirScript = path.dirname(fileURLToPath(import.meta.url));
const rutaJson = path.join(dirScript, '..', 'src', 'data', 'proyectos.json');
const dirPublic = path.join(dirScript, '..', 'public', 'proyectos');
// Raíz del repo (PORTAFOLIO) para resolver respaldos fuera de apps/web.
const raizRepo = path.join(dirScript, '..', '..', '..');

function existe(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

// Abre una sesión CDP persistente sobre un único WebSocket.
// Devuelve { lista, enviar, cerrar, eventos }. Hay que esperar `lista`
// (apertura) antes de enviar comandos. Usa ids incrementales y timeout 30 s.
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

// Evalúa JS en la pestaña a través de la sesión persistente.
async function evaluarSesion(sesion, expresion) {
  const r = await sesion.enviar('Runtime.evaluate', {
    expression: expresion,
    returnByValue: true,
  });
  return r?.result?.value;
}

// Captura la pestaña a través de la sesión persistente (devuelve Buffer PNG).
async function capturaSesion(sesion) {
  const r = await sesion.enviar('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
  });
  if (!r?.data) throw new Error('captureScreenshot no devolvió imagen');
  return Buffer.from(r.data, 'base64');
}

// Espera Page.loadEventFired (20 s máx) + 4 s extra. No toca banners de cookies.
async function esperarCarga(sesion) {
  const inicio = Date.now();
  while (!sesion.eventos.includes('Page.loadEventFired') && Date.now() - inicio < 20000) {
    await dormir(250);
  }
  await dormir(4000);
}

// Busca referencias/justphones/**/public/Cover.png (ignora node_modules y .git).
function buscarCoverJustphones() {
  const base = path.join(raizRepo, 'referencias', 'justphones');
  const hallados = [];
  const pila = [base];
  while (pila.length > 0) {
    const dir = pila.pop();
    let entradas;
    try {
      entradas = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entradas) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === '.next') continue;
      const ruta = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (pila.length < 200) pila.push(ruta);
      } else if (e.isFile() && e.name === 'Cover.png') {
        // Solo vale si vive bajo un directorio "public".
        if (ruta.split(path.sep).includes('public')) hallados.push(ruta);
      }
    }
    if (hallados.length > 0) break;
  }
  hallados.sort((a, b) => a.length - b.length);
  return hallados[0] ?? null;
}

// Resuelve la imagen de respaldo para un slug (ruta absoluta o null).
function resolverRespaldo(slug) {
  const portfolio = (f) => path.join(raizRepo, 'Portfolio', 'public', f);
  switch (slug) {
    case 'justphones': {
      const p0 = portfolio('P0.png');
      if (existe(p0)) return p0;
      return buscarCoverJustphones();
    }
    case 'algobonito':
      return existe(portfolio('P5.jpg')) ? portfolio('P5.jpg') : null;
    case 'calida-escencia':
      return existe(portfolio('P6.jpg')) ? portfolio('P6.jpg') : null;
    case 'asistente':
      return existe(portfolio('P3.jpg')) ? portfolio('P3.jpg') : null;
    case 'bibliotech':
      return existe(portfolio('P4.jpg')) ? portfolio('P4.jpg') : null;
    case 'neifert': {
      const p = path.join(raizRepo, 'referencias', 'NeifertAutomotores', 'public', 'og-image.png');
      return existe(p) ? p : null;
    }
    case 'dario-martinez': {
      const p = path.join(raizRepo, 'referencias', 'DarioMartinez', 'public', 'FOTOFRENTE.jpeg');
      return existe(p) ? p : null;
    }
    case 'crm-inmobiliaria': {
      // Lista el dir y toma la primera imagen por orden alfabético.
      const dir = path.join(raizRepo, 'referencias', 'CRM-Inmobiliaria', 'image', 'Inmueble');
      try {
        const archivos = fs
          .readdirSync(dir)
          .filter((n) => /\.(jpe?g|png|webp|avif)$/i.test(n))
          .sort((a, b) => a.localeCompare(b));
        if (archivos.length === 0) return null;
        return path.join(dir, archivos[0]);
      } catch {
        return null;
      }
    }
    default:
      return null;
  }
}

// Comprueba una URL con HEAD y luego GET (timeout 15 s). Ok si 2xx/3xx.
// Hace hasta 2 rondas para tolerar fallos transitorios (HEAD suele fallar
// en algunos hostings y el GET siguiente es el que vale).
async function comprobarUrl(url) {
  for (let ronda = 0; ronda < 2; ronda++) {
    for (const metodo of ['HEAD', 'GET']) {
      try {
        const res = await fetch(url, {
          method: metodo,
          signal: AbortSignal.timeout(15000),
          redirect: 'follow',
        });
        // Libera el socket sin descargar el cuerpo.
        try {
          await res.body?.cancel();
        } catch {
          // Ignorar errores al cancelar el cuerpo.
        }
        if (res.status >= 200 && res.status < 400) return { ok: true, estado: res.status };
        if (metodo === 'GET') break; // Pasa a la siguiente ronda.
        // Si HEAD no da 2xx/3xx, se intenta con GET.
      } catch {
        if (metodo === 'GET') break; // Pasa a la siguiente ronda.
        // Si HEAD falla (red/timeout), se intenta con GET.
      }
    }
    if (ronda === 0) await dormir(1000);
  }
  return { ok: false, estado: 0 };
}

// Convierte un Buffer PNG a WebP. Para portada reintenta con menor calidad
// hasta quedar en ≤400 KB (empieza en quality 82 según especificación).
async function bufAWebp(bufPng, rutaWebp, esPortada, anchoResize = null) {
  fs.mkdirSync(path.dirname(rutaWebp), { recursive: true });
  const calidades = esPortada ? [82, 70, 60, 50] : [82];
  for (const calidad of calidades) {
    let pipe = sharp(bufPng);
    if (anchoResize) pipe = pipe.resize({ width: anchoResize, withoutEnlargement: true });
    await pipe.webp({ quality: calidad }).toFile(rutaWebp);
    const tam = fs.statSync(rutaWebp).size;
    if (!esPortada || tam <= LIMITE_PORTADA || calidad === 50) return tam;
  }
  return fs.statSync(rutaWebp).size;
}

// Genera portada.webp desde una imagen de respaldo (WebP, ancho máx 1600, ≤400 KB).
async function respaldoPortada(origen, destino) {
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  for (const calidad of [82, 70, 60, 50]) {
    await sharp(origen)
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: calidad })
      .toFile(destino);
    const tam = fs.statSync(destino).size;
    if (tam <= LIMITE_PORTADA || calidad === 50) return tam;
  }
  return fs.statSync(destino).size;
}

// Captura un sitio en escritorio, móvil y página completa dentro de dirSalida.
// Usa una sesión persistente para que el viewport emulado se mantenga.
// Devuelve { portada, movil, completa } con true si el archivo se generó.
async function capturarSitio(puerto, url, dirSalida) {
  fs.mkdirSync(dirSalida, { recursive: true });
  const { webSocketDebuggerUrl } = await nuevaPestana(puerto, url);
  const sesion = crearSesion(webSocketDebuggerUrl);
  await sesion.lista;
  try {
    await sesion.enviar('Page.enable');

    // (c) Escritorio 1440×900 → portada.webp.
    await sesion.enviar('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    sesion.eventos.length = 0;
    await sesion.enviar('Page.navigate', { url });
    await esperarCarga(sesion);
    await bufAWebp(
      await capturaSesion(sesion),
      path.join(dirSalida, 'portada.webp'),
      true,
    );

    // (d) Celular 390×844 dsf 2 + recarga → movil.webp.
    await sesion.enviar('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    sesion.eventos.length = 0;
    await sesion.enviar('Page.navigate', { url });
    await esperarCarga(sesion);
    await bufAWebp(
      await capturaSesion(sesion),
      path.join(dirSalida, 'movil.webp'),
      false,
    );

    // (e) Completa: alto real con tope 7000, captura y reduce a 1000 de ancho.
    const metricas = await sesion.enviar('Page.getLayoutMetrics');
    const altoCss = Math.ceil(metricas?.cssContentSize?.height ?? 900);
    const alto = Math.min(Math.max(altoCss, 900), 7000);
    await sesion.enviar('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: alto,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await dormir(1500);
    await bufAWebp(
      await capturaSesion(sesion),
      path.join(dirSalida, 'completa.webp'),
      false,
      1000,
    );
  } finally {
    sesion.cerrar();
  }

  return {
    portada: existe(path.join(dirSalida, 'portada.webp')),
    movil: existe(path.join(dirSalida, 'movil.webp')),
    completa: existe(path.join(dirSalida, 'completa.webp')),
  };
}

async function principal() {
  const proyectos = JSON.parse(fs.readFileSync(rutaJson, 'utf8'));
  // Perfil temporal para no contaminar el perfil real de Chrome.
  const dirPerfil = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-proyectos-'));
  const chrome = await lanzarChrome(PUERTO, dirPerfil);
  const filas = [];
  try {
    for (const proyecto of proyectos) {
      const slug = proyecto.slug;
      const dirSalida = path.join(dirPublic, slug);
      const sitio = proyecto.enlaces?.sitio ?? null;

      // Sin sitio: solo cabe respaldo (lo genera generar-portadas.mjs si no hay).
      if (!sitio) {
        const origen = resolverRespaldo(slug);
        if (origen) {
          await respaldoPortada(origen, path.join(dirSalida, 'portada.webp'));
          filas.push({ slug, estado: 'respaldo', archivos: 'portada.webp' });
        } else {
          filas.push({ slug, estado: 'sin-sitio', archivos: '' });
        }
        continue;
      }

      // Con sitio: el asistente prueba dos URLs en orden.
      const candidatas =
        slug === 'asistente'
          ? ['https://asistente-inteligente.vercel.app', 'https://asistenteinteligente.onrender.com']
          : [sitio];
      let urlOk = null;
      for (const u of candidatas) {
        const r = await comprobarUrl(u);
        if (r.ok) {
          urlOk = u;
          break;
        }
      }
      // Caído (sin 2xx/3xx): anota y sigue con respaldo si hay.
      if (!urlOk) {
        const origen = resolverRespaldo(slug);
        if (origen) {
          await respaldoPortada(origen, path.join(dirSalida, 'portada.webp'));
          filas.push({ slug, estado: 'caído-respaldo', archivos: 'portada.webp' });
        } else {
          filas.push({ slug, estado: 'caído', archivos: '' });
        }
        continue;
      }

      // Sitio vivo: captura escritorio + móvil + completa.
      try {
        const gen = await capturarSitio(PUERTO, urlOk, dirSalida);
        const lista = [];
        if (gen.portada) lista.push('portada.webp');
        if (gen.movil) lista.push('movil.webp');
        if (gen.completa) lista.push('completa.webp');
        const etiqueta = urlOk !== sitio ? `ok-alt (${urlOk})` : 'ok';
        filas.push({ slug, estado: etiqueta, archivos: lista.join(',') });
      } catch (err) {
        // Si la captura falla, intenta respaldo antes de rendirse.
        const origen = resolverRespaldo(slug);
        if (origen) {
          await respaldoPortada(origen, path.join(dirSalida, 'portada.webp'));
          filas.push({ slug, estado: 'error-respaldo', archivos: 'portada.webp' });
        } else {
          filas.push({ slug, estado: `error: ${err?.message ?? err}`, archivos: '' });
        }
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
