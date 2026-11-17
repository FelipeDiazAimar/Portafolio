// Capturas de la fase mixta de #proyectos (muro → presentador → mixto).
// Uso desde la raíz del monorepo:
//   node apps/web/scripts/captura-mixto.mjs
// Requiere el dev server en http://127.0.0.1:3001 (no lo levanta este script).
// Usa sesión CDP persistente por pestaña para que el viewport aplique.
// Puerto 9447. Salida: apps/web/scripts/.regresion/mixto/. Comentarios en español.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lanzarChrome, nuevaPestana, cerrarChrome } from './cdp-ayuda.mjs';

const PUERTO = 9447;
const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:3001';
const VP_DESKTOP = { width: 1500, height: 820, deviceScaleFactor: 1, mobile: false };
const VP_MOVIL = { width: 390, height: 844, deviceScaleFactor: 1, mobile: true };

// Pequeña espera (ms).
const dormir = (ms) => new Promise((res) => setTimeout(res, ms));
const dirScript = path.dirname(fileURLToPath(import.meta.url));
const dirMixto = path.join(dirScript, '.regresion', 'mixto');

// Sesión CDP persistente con recolección de errores de consola.
// Guarda Runtime.exceptionThrown, console.error y Log.error en `eventos`.
async function abrirSesionEventos(puerto, id) {
  const lista = await (await fetch(`http://127.0.0.1:${puerto}/json/list`)).json();
  const pestana = lista.find((p) => p.id === id);
  if (!pestana?.webSocketDebuggerUrl) throw new Error(`Pestaña no encontrada: ${id}`);
  const eventos = [];
  let proximoId = 0;
  const pendientes = new Map();
  const ws = new WebSocket(pestana.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('Timeout al abrir sesión CDP')), 15000);
    ws.addEventListener('open', () => {
      clearTimeout(t);
      res();
    });
    ws.addEventListener('error', (e) => {
      clearTimeout(t);
      rej(e?.error ?? new Error('Error WS al abrir sesión CDP'));
    });
  });
  ws.addEventListener('message', (evento) => {
    let msg;
    try {
      msg = JSON.parse(String(evento.data));
    } catch {
      return;
    }
    // Eventos del navegador (sin id): recolectar errores de consola.
    if (msg.id == null) {
      if (msg.method === 'Runtime.exceptionThrown') {
        eventos.push({ tipo: 'exceptionThrown', detalle: msg.params?.exceptionDetails?.text ?? JSON.stringify(msg.params).slice(0, 500) });
      } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
        const args = (msg.params.args ?? []).map((a) => a?.value ?? a?.description ?? '').join(' ').slice(0, 500);
        eventos.push({ tipo: 'console.error', detalle: args });
      } else if (msg.method === 'Log.entryAdded' && /error/i.test(msg.params?.entry?.level ?? '')) {
        eventos.push({ tipo: 'log.error', detalle: (msg.params.entry.text ?? '').slice(0, 500) });
      }
      return;
    }
    if (!pendientes.has(msg.id)) return;
    const { resolver, rechazar, temporizador } = pendientes.get(msg.id);
    pendientes.delete(msg.id);
    clearTimeout(temporizador);
    if (msg.error) rechazar(new Error(`CDP: ${msg.error.message ?? JSON.stringify(msg.error)}`));
    else resolver(msg.result ?? {});
  });
  const enviar = (metodo, params = {}) =>
    new Promise((resolver, rechazar) => {
      const idMsg = ++proximoId;
      const temporizador = setTimeout(() => {
        pendientes.delete(idMsg);
        rechazar(new Error(`Timeout CDP (30 s) en ${metodo}`));
      }, 30000);
      pendientes.set(idMsg, { resolver, rechazar, temporizador });
      ws.send(JSON.stringify({ id: idMsg, method: metodo, params }));
    });
  const cerrar = () => {
    try {
      ws.close();
    } catch {
      // Ignorar errores al cerrar.
    }
  };
  return { enviar, cerrar, eventos };
}

// Evalúa JS en la pestaña y devuelve el valor.
async function ev(sesion, expresion) {
  const res = await sesion.enviar('Runtime.evaluate', {
    expression: expresion,
    returnByValue: true,
    awaitPromise: true,
  });
  return res?.result?.value;
}

// Captura la pantalla actual a PNG.
async function cap(sesion, ruta) {
  const res = await sesion.enviar('Page.captureScreenshot', { format: 'png', fromSurface: true });
  if (!res?.data) throw new Error('captureScreenshot sin datos');
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  fs.writeFileSync(ruta, Buffer.from(res.data, 'base64'));
  return ruta;
}

// Espera hasta que la expresión sea verdadera (poll cada 250 ms).
async function esperarQue(sesion, expresion, maxMs = 15000) {
  const inicio = Date.now();
  for (;;) {
    const ok = await ev(sesion, expresion);
    if (ok) return true;
    if (Date.now() - inicio > maxMs) return false;
    await dormir(250);
  }
}

// Lee la tarjeta expandida: si existe y su h3.
async function leerTarjeta(sesion) {
  return ev(
    sesion,
    `(() => {
      const t = document.querySelector('[data-zona-mixto="tarjeta"]');
      if (!t) return { hay: false, h3: '' };
      const h3 = t.querySelector('h3')?.textContent?.trim() ?? '';
      return { hay: true, h3 };
    })()`,
  );
}

// Mueve el mouse a (x, y) vía CDP.
async function moverMouse(sesion, x, y) {
  await sesion.enviar('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: Math.round(x),
    y: Math.round(y),
  });
}

// Centro de un elemento descrito por una expresión JS que devuelve selector.
async function centroDe(sesion, expresionRect) {
  return ev(sesion, expresionRect);
}

// Lleva el scroll hasta la fase mixta (cierre del contenedor #proyectos).
// Usa getBoundingClientRect + window.scrollTo; espera 2 s y devuelve la
// visibilidad de [data-zona-mixto="fase"].
async function irAFaseMixta(sesion) {
  const listo = await esperarQue(
    sesion,
    `!!document.querySelector('#proyectos') && !!document.querySelector('[data-zona-mixto="fase"]') && !!document.querySelector('#nav-justphones')`,
    20000,
  );
  if (!listo) throw new Error('No apareció la fase mixta (#proyectos / #nav-justphones)');
  await ev(
    sesion,
    `(() => {
      const el = document.querySelector('#proyectos');
      const r = el.getBoundingClientRect();
      const arribaAbs = r.top + window.scrollY;
      const destino = arribaAbs + el.offsetHeight - window.innerHeight - 10;
      window.scrollTo(0, Math.max(0, Math.round(destino)));
      return true;
    })()`,
  );
  await dormir(2000);
  return ev(
    sesion,
    `(() => {
      const f = document.querySelector('[data-zona-mixto="fase"]');
      if (!f) return null;
      const r = f.getBoundingClientRect();
      return {
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        vh: window.innerHeight,
        visible: r.top < window.innerHeight * 0.9 && r.bottom > window.innerHeight * 0.1,
      };
    })()`,
  );
}

async function principal() {
  fs.mkdirSync(dirMixto, { recursive: true });
  const dirPerfil = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-mixto-'));
  const chrome = await lanzarChrome(PUERTO, dirPerfil);
  const pasos = [];
  const rutas = {};
  let eventosDesktop = [];
  let eventosMovil = [];
  try {
    // ---- Pestaña desktop 1500×820 en /#proyectos ----
    {
      const { id } = await nuevaPestana(PUERTO, `${BASE_URL}/#proyectos`);
      const sesion = await abrirSesionEventos(PUERTO, id);
      try {
        await sesion.enviar('Page.enable');
        await sesion.enviar('Runtime.enable');
        await sesion.enviar('Log.enable');
        await sesion.enviar('Emulation.setDeviceMetricsOverride', VP_DESKTOP);
        await dormir(3500);

        // 1) Reposo: scroll a la fase mixta, sin hover no hay tarjeta.
        const fase = await irAFaseMixta(sesion);
        const reposo = await leerTarjeta(sesion);
        const pasaReposo = reposo && reposo.hay === false;
        rutas.reposo = await cap(sesion, path.join(dirMixto, 'mixto-reposo.png'));
        pasos.push({ paso: 'reposo sin tarjeta', pasa: pasaReposo ? 'PASA' : 'FALLA', detalle: JSON.stringify({ fase, reposo }) });

        // 2) Hover sobre #nav-justphones → tarjeta con JustPhones.
        const rectNav = await centroDe(
          sesion,
          `(() => {
            const el = document.querySelector('#nav-justphones');
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
          })()`,
        );
        if (!rectNav) throw new Error('#nav-justphones sin rect');
        await moverMouse(sesion, rectNav.x, rectNav.y);
        await dormir(600);
        const tj = await leerTarjeta(sesion);
        const pasaNav = tj?.hay === true && (tj.h3 ?? '').includes('JustPhones');
        rutas.hoverNav = await cap(sesion, path.join(dirMixto, 'mixto-hover-nav.png'));
        pasos.push({ paso: 'hover nav expande JustPhones', pasa: pasaNav ? 'PASA' : 'FALLA', detalle: JSON.stringify(tj) });

        // 3) Hover sobre celda [data-slug="neifert"] → cambia a Neifert.
        const celda = await centroDe(
          sesion,
          `(() => {
            const celdas = Array.from(document.querySelectorAll('[data-zona-mixto="marquesina"] [data-slug="neifert"]'));
            if (!celdas.length) return null;
            const tj = document.querySelector('[data-zona-mixto="tarjeta"]');
            const rt = tj ? tj.getBoundingClientRect() : null;
            const tapada = (x, y) => !!rt && x >= rt.left && x <= rt.right && y >= rt.top && y <= rt.bottom;
            const vh = window.innerHeight, vw = window.innerWidth;
            for (const el of celdas) {
              const r = el.getBoundingClientRect();
              if (!r || r.width < 10 || r.height < 10) continue;
              const x = r.x + r.width / 2, y = r.y + r.height / 2;
              if (y < 0 || y > vh || x < 0 || x > vw) continue;
              if (tapada(x, y)) continue;
              return { x, y };
            }
            const r0 = celdas[0].getBoundingClientRect();
            return { x: r0.x + r0.width / 2, y: r0.y + r0.height / 2 };
          })()`,
        );
        if (!celda) throw new Error('Celda [data-slug="neifert"] no encontrada');
        await moverMouse(sesion, celda.x, celda.y);
        await dormir(600);
        const tm = await leerTarjeta(sesion);
        const pasaMarq = tm?.hay === true && (tm.h3 ?? '').includes('Neifert');
        rutas.hoverMarquesina = await cap(sesion, path.join(dirMixto, 'mixto-hover-marquesina.png'));
        pasos.push({ paso: 'hover marquesina cambia a Neifert', pasa: pasaMarq ? 'PASA' : 'FALLA', detalle: JSON.stringify(tm) });

        // 4) Salida: mouse a la esquina (5,5) → la tarjeta desaparece.
        await moverMouse(sesion, 5, 5);
        await dormir(600);
        const ts = await leerTarjeta(sesion);
        const pasaSalida = ts?.hay === false;
        rutas.salida = await cap(sesion, path.join(dirMixto, 'mixto-salida.png'));
        pasos.push({ paso: 'salida colapsa', pasa: pasaSalida ? 'PASA' : 'FALLA', detalle: JSON.stringify(ts) });

        // 5) Tema claro: repetir hover nav → tarjeta con JustPhones.
        await ev(sesion, `document.documentElement.setAttribute('data-theme', 'light')`);
        await dormir(1000);
        const rectNav2 = await centroDe(
          sesion,
          `(() => {
            const el = document.querySelector('#nav-justphones');
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
          })()`,
        );
        if (!rectNav2) throw new Error('#nav-justphones sin rect (light)');
        await moverMouse(sesion, rectNav2.x, rectNav2.y);
        await dormir(600);
        const tl = await leerTarjeta(sesion);
        const pasaLight = tl?.hay === true && (tl.h3 ?? '').includes('JustPhones');
        rutas.light = await cap(sesion, path.join(dirMixto, 'mixto-light.png'));
        pasos.push({ paso: 'light', pasa: pasaLight ? 'PASA' : 'FALLA', detalle: JSON.stringify(tl) });

        eventosDesktop = sesion.eventos.slice();
      } finally {
        sesion.cerrar();
      }
    }

    // ---- Pestaña móvil 390×844: tap sobre #nav-movii ----
    {
      const { id } = await nuevaPestana(PUERTO, `${BASE_URL}/#proyectos`);
      const sesion = await abrirSesionEventos(PUERTO, id);
      try {
        await sesion.enviar('Page.enable');
        await sesion.enviar('Runtime.enable');
        await sesion.enviar('Log.enable');
        await sesion.enviar('Emulation.setDeviceMetricsOverride', VP_MOVIL);
        await dormir(3500);
        await irAFaseMixta(sesion);
        // Tap vía click evaluado (equivale al toque en este nav).
        await ev(sesion, `(() => {
          const el = document.getElementById('nav-movii');
          if (!el) return false;
          el.scrollIntoView({ block: 'nearest' });
          el.click();
          return true;
        })()`);
        await dormir(700);
        const tm = await leerTarjeta(sesion);
        const pasaTap = tm?.hay === true && (tm.h3 ?? '').includes('Movii');
        rutas.movil = await cap(sesion, path.join(dirMixto, 'mixto-movil.png'));
        pasos.push({ paso: 'móvil tap+✕', pasa: 'PENDIENTE', detalle: JSON.stringify({ trasTap: tm }) });
        // Cierre con ✕ y verificación de desaparición.
        const cerro = await ev(
          sesion,
          `(() => {
            const btn = document.querySelector('[data-zona-mixto="tarjeta"] button[aria-label="Cerrar vista expandida"]')
              ?? document.querySelector('[data-zona-mixto="tarjeta"] button');
            if (!btn) return false;
            btn.click();
            return true;
          })()`,
        );
        await dormir(700);
        const trasCerrar = await leerTarjeta(sesion);
        const pasaCerrar = cerro === true && trasCerrar?.hay === false;
        const pasaMovil = pasaTap && pasaCerrar;
        pasos[pasos.length - 1] = {
          paso: 'móvil tap+✕',
          pasa: pasaMovil ? 'PASA' : 'FALLA',
          detalle: JSON.stringify({ trasTap: tm, cerro, trasCerrar }),
        };
        eventosMovil = sesion.eventos.slice();
      } finally {
        sesion.cerrar();
      }
    }

    // 7) Consola limpia: sin errores en desktop ni móvil.
    const consola = [...eventosDesktop.map((e) => ({ ...e, fase: 'desktop' })), ...eventosMovil.map((e) => ({ ...e, fase: 'movil' }))];
    pasos.push({ paso: 'consola limpia', pasa: consola.length === 0 ? 'PASA' : 'FALLA', detalle: JSON.stringify(consola).slice(0, 2000) });

    const resumen = { pasos, rutas, consola };
    fs.writeFileSync(path.join(dirMixto, 'resumen.json'), JSON.stringify(resumen, null, 2));
    console.log(JSON.stringify(resumen, null, 2));
    const fallas = pasos.filter((p) => p.pasa !== 'PASA').length;
    if (fallas > 0) process.exitCode = 1;
  } finally {
    cerrarChrome(chrome);
  }
}

await principal();
