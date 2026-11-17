// Capturas DESPUÉS + pruebas de la sección Proyectos + verificación del header.
// Uso desde la raíz del monorepo:
//   BASE_URL=http://127.0.0.1:3001 node apps/web/scripts/captura-seccion.mjs despues|seccion|header|todo
// Requiere el dev server levantado (no lo levanta este script).
// Usa UNA sesión CDP persistente por pestaña para que el viewport aplique.
// Puerto 9446 para no chocar con otros agentes. Comentarios en español.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lanzarChrome, nuevaPestana, cerrarChrome } from './cdp-ayuda.mjs';

const PUERTO = 9446;
const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:3001';
const VP_DESKTOP = { width: 1500, height: 820, deviceScaleFactor: 1, mobile: false };
const VP_MOVIL = { width: 390, height: 844, deviceScaleFactor: 1, mobile: true };

const dormir = (ms) => new Promise((res) => setTimeout(res, ms));
const dirScript = path.dirname(fileURLToPath(import.meta.url));
const dirDespues = path.join(dirScript, '.regresion', 'despues');
const dirSeccion = path.join(dirScript, '.regresion', 'seccion');

// Sesión CDP persistente con recolección de errores de consola.
// Igual que abrirSesion del helper, pero guarda Runtime.exceptionThrown y
// console.error (Runtime.consoleAPICalled) en `eventos` para el reporte.
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

// Lee el estado observable del presentador: título, problemática, HUD e índice.
async function leerEstadoPresentador(sesion) {
  return ev(
    sesion,
    `(() => {
      const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
      const activa = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
      const titulo = document.querySelector('h3')?.textContent?.trim() ?? '';
      const linea = Array.from(document.querySelectorAll('p')).find((p) => p.textContent.includes('·'))?.textContent?.trim() ?? '';
      const problema = document.querySelector('[role="tabpanel"] p:nth-of-type(2)')?.textContent?.trim()?.slice(0, 120) ?? '';
      const hud = document.querySelector('[aria-label="Stack de este proyecto"]')?.textContent?.trim()?.slice(0, 200) ?? '';
      const capaActiva = Array.from(document.querySelectorAll('div')).filter((d) => d.className.includes('capaActiva')).length;
      return { activa, titulo, linea, problema, hud, capaActiva, totalTabs: tabs.length };
    })()`,
  );
}

// Mueve el mouse al centro del tab i-ésimo (coordenadas vía getBoundingClientRect).
async function hoverTab(sesion, indice) {
  const rect = await ev(
    sesion,
    `(() => {
      const el = document.querySelectorAll('[role="tab"]')[${indice}];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`,
  );
  if (!rect) throw new Error(`Tab ${indice} no encontrado para hover`);
  await sesion.enviar('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: Math.round(rect.x),
    y: Math.round(rect.y),
  });
  // La lista activa con 120 ms de intención + animación de 350 ms.
  await dormir(700);
}

// Pulsa una flecha vía CDP (el presentador escucha keydown global).
async function pulsarFlecha(sesion, tecla) {
  const codigo = tecla === 'ArrowDown' ? 40 : 38;
  await sesion.enviar('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: tecla,
    code: tecla,
    windowsVirtualKeyCode: codigo,
    nativeVirtualKeyCode: codigo,
  });
  await sesion.enviar('Input.dispatchKeyEvent', { type: 'keyUp', key: tecla, code: tecla });
  await dormir(700);
}

// Lleva el scroll al progreso p del contenedor #proyectos (0 a 1).
async function irAProgreso(sesion, p) {
  const m = await ev(
    sesion,
    `(() => {
      const el = document.querySelector('#proyectos');
      if (!el) return null;
      const top = el.getBoundingClientRect().top + window.scrollY;
      return { top, h: el.offsetHeight, vh: window.innerHeight, y: window.scrollY };
    })()`,
  );
  if (!m) throw new Error('#proyectos no encontrado');
  const destino = m.top + p * (m.h - m.vh);
  await ev(sesion, `window.scrollTo(0, ${Math.round(destino)})`);
  await dormir(1200);
  return ev(sesion, `window.scrollY`);
}

// ---- Modo DESPUÉS: hero + sobre-mi en dark/light (1500×820) ----
async function modoDespues() {
  fs.mkdirSync(dirDespues, { recursive: true });
  const dirPerfil = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-seccion-despues-'));
  const chrome = await lanzarChrome(PUERTO, dirPerfil);
  const generados = [];
  try {
    for (const tema of ['dark', 'light']) {
      const { id } = await nuevaPestana(PUERTO, `${BASE_URL}/#inicio`);
      const sesion = await abrirSesionEventos(PUERTO, id);
      try {
        await sesion.enviar('Page.enable');
        await sesion.enviar('Runtime.enable');
        await sesion.enviar('Emulation.setDeviceMetricsOverride', VP_DESKTOP);
        await dormir(3000);
        if (tema === 'light') {
          await ev(sesion, `document.documentElement.setAttribute('data-theme','light')`);
          await dormir(1000);
        }
        generados.push(await cap(sesion, path.join(dirDespues, `hero-${tema}.png`)));
      } finally {
        sesion.cerrar();
      }
    }
    for (const tema of ['dark', 'light']) {
      const { id } = await nuevaPestana(PUERTO, `${BASE_URL}/#sobre-mi`);
      const sesion = await abrirSesionEventos(PUERTO, id);
      try {
        await sesion.enviar('Page.enable');
        await sesion.enviar('Runtime.enable');
        await sesion.enviar('Emulation.setDeviceMetricsOverride', VP_DESKTOP);
        await dormir(12000);
        if (tema === 'light') {
          await ev(sesion, `document.documentElement.setAttribute('data-theme','light')`);
          await dormir(1000);
        }
        generados.push(await cap(sesion, path.join(dirDespues, `sobre-mi-${tema}.png`)));
      } finally {
        sesion.cerrar();
      }
    }
    console.table(generados.map((archivo) => ({ archivo })));
  } finally {
    cerrarChrome(chrome);
  }
}

// ---- Modo SECCIÓN: muro/transición/presentador + hovers + teclado + light + móvil ----
async function modoSeccion() {
  fs.mkdirSync(dirSeccion, { recursive: true });
  const dirPerfil = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-seccion-'));
  const chrome = await lanzarChrome(PUERTO, dirPerfil);
  const resumen = { capturas: [], hovers: [], teclado: [], movil: [], light: [], consola: [] };
  try {
    // Pestaña desktop dark.
    {
      const { id } = await nuevaPestana(PUERTO, `${BASE_URL}/`);
      const sesion = await abrirSesionEventos(PUERTO, id);
      try {
        await sesion.enviar('Page.enable');
        await sesion.enviar('Runtime.enable');
        await sesion.enviar('Emulation.setDeviceMetricsOverride', VP_DESKTOP);
        await dormir(3500);
        await ev(sesion, `document.querySelector('#proyectos').scrollIntoView()`);
        await dormir(1500);
        // Tres progresos del contenedor de 260svh.
        for (const [p, nombre] of [[0.1, 'p10-muro'], [0.45, 'p45-transicion'], [0.8, 'p80-presentador']]) {
          const y = await irAProgreso(sesion, p);
          const ruta = path.join(dirSeccion, `proyectos-${nombre}-dark.png`);
          await cap(sesion, ruta);
          resumen.capturas.push({ archivo: `proyectos-${nombre}-dark.png`, p, scrollY: Math.round(y) });
        }
        // Estado inicial (debería ser proyecto 0) y hovers en ítems 2 y 5.
        const antes = await leerEstadoPresentador(sesion);
        await hoverTab(sesion, 1);
        const tras2 = await leerEstadoPresentador(sesion);
        const cambia2 = tras2.titulo !== antes.titulo && tras2.activa === 1;
        resumen.hovers.push({
          item: 2,
          antesTitulo: antes.titulo,
          despuesTitulo: tras2.titulo,
          hudCambia: tras2.hud !== antes.hud,
          problemaCambia: tras2.problema !== antes.problema,
          resultado: cambia2 ? 'PASA' : 'NO PASA',
        });
        await hoverTab(sesion, 4);
        const tras5 = await leerEstadoPresentador(sesion);
        const cambia5 = tras5.titulo !== tras2.titulo && tras5.activa === 4;
        resumen.hovers.push({
          item: 5,
          antesTitulo: tras2.titulo,
          despuesTitulo: tras5.titulo,
          hudCambia: tras5.hud !== tras2.hud,
          problemaCambia: tras5.problema !== tras2.problema,
          resultado: cambia5 ? 'PASA' : 'NO PASA',
        });
        // Teclado: ↓ avanza, ↑ retrocede.
        const idxAntesTecla = (await leerEstadoPresentador(sesion)).activa;
        await pulsarFlecha(sesion, 'ArrowDown');
        const idxTrasDown = (await leerEstadoPresentador(sesion)).activa;
        await pulsarFlecha(sesion, 'ArrowUp');
        const idxTrasUp = (await leerEstadoPresentador(sesion)).activa;
        resumen.teclado.push({
          desde: idxAntesTecla,
          trasDown: idxTrasDown,
          trasUp: idxTrasUp,
          downPasa: idxTrasDown !== idxAntesTecla ? 'PASA' : 'NO PASA',
          upPasa: idxTrasUp !== idxTrasDown ? 'PASA' : 'NO PASA',
        });
        // Tema claro: re-captura en p≈0,8 y verifica un hover.
        await ev(sesion, `document.documentElement.setAttribute('data-theme','light')`);
        await dormir(1000);
        await irAProgreso(sesion, 0.8);
        await cap(sesion, path.join(dirSeccion, 'proyectos-p80-presentador-light.png'));
        resumen.capturas.push({ archivo: 'proyectos-p80-presentador-light.png', p: 0.8, tema: 'light' });
        const lAntes = await leerEstadoPresentador(sesion);
        await hoverTab(sesion, 1);
        const lDespues = await leerEstadoPresentador(sesion);
        resumen.light.push({
          cambia: lDespues.titulo !== lAntes.titulo ? 'PASA' : 'NO PASA',
          antesTitulo: lAntes.titulo,
          despuesTitulo: lDespues.titulo,
        });
        resumen.consola.push(...sesion.eventos.map((e) => ({ ...e, fase: 'desktop-dark+light' })));
      } finally {
        sesion.cerrar();
      }
    }
    // Pestaña móvil 390×844.
    {
      const { id } = await nuevaPestana(PUERTO, `${BASE_URL}/`);
      const sesion = await abrirSesionEventos(PUERTO, id);
      try {
        await sesion.enviar('Page.enable');
        await sesion.enviar('Runtime.enable');
        await sesion.enviar('Emulation.setDeviceMetricsOverride', VP_MOVIL);
        await dormir(3500);
        await ev(sesion, `document.querySelector('#proyectos').scrollIntoView()`);
        await dormir(1500);
        for (const [p, nombre] of [[0.1, 'p10-muro'], [0.8, 'p80-presentador']]) {
          await irAProgreso(sesion, p);
          const ruta = path.join(dirSeccion, `proyectos-${nombre}-movil.png`);
          await cap(sesion, ruta);
          resumen.capturas.push({ archivo: `proyectos-${nombre}-movil.png`, p, viewport: '390x844' });
        }
        // En móvil la lista es tira horizontal: click al ítem 2 y verifica cambio.
        await irAProgreso(sesion, 0.8);
        const mAntes = await leerEstadoPresentador(sesion);
        await ev(sesion, `document.querySelectorAll('[role="tab"]')[1].click()`);
        await dormir(800);
        const mDespues = await leerEstadoPresentador(sesion);
        resumen.movil.push({
          prueba: 'click-item-2',
          antesTitulo: mAntes.titulo,
          despuesTitulo: mDespues.titulo,
          resultado: mDespues.titulo !== mAntes.titulo && mDespues.activa === 1 ? 'PASA' : 'NO PASA',
        });
        // Sin desborde horizontal grosero en móvil.
        const scrollX = await ev(sesion, `document.documentElement.scrollWidth - document.documentElement.clientWidth`);
        resumen.movil.push({ prueba: 'sin-desborde-x', sobrantePx: scrollX, resultado: scrollX <= 1 ? 'PASA' : 'NO PASA' });
        resumen.consola.push(...sesion.eventos.map((e) => ({ ...e, fase: 'movil' })));
      } finally {
        sesion.cerrar();
      }
    }
    fs.writeFileSync(path.join(dirSeccion, 'resumen.json'), JSON.stringify(resumen, null, 2));
    console.log(JSON.stringify(resumen, null, 2));
  } finally {
    cerrarChrome(chrome);
  }
}

// ---- Modo HEADER: click al enlace #proyectos y mide el aterrizaje ----
async function modoHeader() {
  fs.mkdirSync(dirSeccion, { recursive: true });
  const dirPerfil = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-header-'));
  const chrome = await lanzarChrome(PUERTO, dirPerfil);
  try {
    const { id } = await nuevaPestana(PUERTO, `${BASE_URL}/`);
    const sesion = await abrirSesionEventos(PUERTO, id);
    try {
      await sesion.enviar('Page.enable');
      await sesion.enviar('Runtime.enable');
      await sesion.enviar('Emulation.setDeviceMetricsOverride', VP_DESKTOP);
      await dormir(3500);
      await ev(sesion, `window.scrollTo(0, 0)`);
      await dormir(600);
      const hayEnlace = await ev(
        sesion,
        `!!(document.querySelector('a[href="#proyectos"]') || Array.from(document.querySelectorAll('a')).find((a) => a.getAttribute('href') === '#proyectos'))`,
      );
      await ev(
        sesion,
        `(document.querySelector('a[href="#proyectos"]') || Array.from(document.querySelectorAll('a')).find((a) => a.getAttribute('href') === '#proyectos'))?.click()`,
      );
      await dormir(2500);
      const medida = await ev(
        sesion,
        `(() => {
          const el = document.querySelector('#proyectos');
          const r = el.getBoundingClientRect();
          return { top: r.top, scrollY: window.scrollY, scrollMargin: getComputedStyle(el).scrollMarginTop };
        })()`,
      );
      // Tolerancia ±100 px considerando el scroll-margin actual de 5 rem (80 px).
      const top = medida?.top ?? NaN;
      const difVs0 = Math.abs(top);
      const difVs80 = Math.abs(top - 80);
      const pasa = difVs0 <= 100 || difVs80 <= 100;
      const salida = { hayEnlace, ...medida, difVs0, difVs80, resultado: pasa ? 'PASA' : 'NO PASA' };
      fs.writeFileSync(path.join(dirSeccion, 'header.json'), JSON.stringify(salida, null, 2));
      console.log(JSON.stringify(salida, null, 2));
    } finally {
      sesion.cerrar();
    }
  } finally {
    cerrarChrome(chrome);
  }
}

const modo = process.argv[2] ?? 'todo';
if (modo === 'despues') await modoDespues();
else if (modo === 'seccion') await modoSeccion();
else if (modo === 'header') await modoHeader();
else if (modo === 'todo') {
  await modoDespues();
  await modoSeccion();
  await modoHeader();
} else {
  console.error('Uso: node captura-seccion.mjs despues|seccion|header|todo');
  process.exit(1);
}
