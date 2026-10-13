// Helper CDP para capturas con Chrome headless.
// Sin dependencias externas: solo node:child_process, node:fs, node:path.
// Usa fetch y WebSocket globales de Node 24.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Ruta del ejecutable de Chrome en este equipo.
const RUTA_CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

// Pequeña espera (ms).
const dormir = (ms) => new Promise((res) => setTimeout(res, ms));

// Lanza Chrome headless con depuración remota y espera a que responda.
// Devuelve el ChildProcess para poder cerrarlo después con cerrarChrome().
export function lanzarChrome(puerto, dirPerfil) {
  const proc = spawn(
    RUTA_CHROME,
    [
      '--headless=new',
      `--remote-debugging-port=${puerto}`,
      `--user-data-dir=${dirPerfil}`,
      '--hide-scrollbars',
      '--disable-gpu',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  // Espera activa hasta que el endpoint /json responda (o agota reintentos).
  const esperarListo = async () => {
    const url = `http://127.0.0.1:${puerto}/json`;
    for (let i = 0; i < 60; i++) {
      try {
        const res = await fetch(url);
        if (res.ok) return proc;
      } catch {
        // Chrome aún no escucha: reintentar.
      }
      await dormir(500);
    }
    cerrarChrome(proc);
    throw new Error(`Chrome no respondió en http://127.0.0.1:${puerto}/json`);
  };

  return esperarListo();
}

// Crea una pestaña nueva en la URL indicada.
// Devuelve { id, webSocketDebuggerUrl } de la pestaña.
export async function nuevaPestana(puerto, url) {
  // Chrome moderno exige PUT en /json/new (POST devuelve 405).
  const res = await fetch(`http://127.0.0.1:${puerto}/json/new?${encodeURIComponent(url)}`, {
    method: 'PUT',
  });
  if (!res.ok) {
    throw new Error(`No se pudo crear la pestaña (${res.status}): ${url}`);
  }
  const datos = await res.json();
  return { id: datos.id, webSocketDebuggerUrl: datos.webSocketDebuggerUrl };
}

// Resuelve la URL del WebSocket depurador para una pestaña por su id.
async function urlDepurador(puerto, id) {
  const res = await fetch(`http://127.0.0.1:${puerto}/json/list`);
  if (!res.ok) throw new Error(`No se pudo listar pestañas (${res.status})`);
  const pestanas = await res.json();
  const pestana = pestanas.find((p) => p.id === id);
  if (!pestana?.webSocketDebuggerUrl) {
    throw new Error(`Pestaña no encontrada: ${id}`);
  }
  return pestana.webSocketDebuggerUrl;
}

// Envía un comando CDP a la pestaña y espera su respuesta.
// Abre un WebSocket, envía { id: 1, method, params }, espera el mensaje
// con ese id (cola por id) con timeout de 30 s y luego cierra.
export function cdp(puerto, id, metodo, params = {}) {
  return (async () => {
    const wsUrl = params?.__wsUrl ?? (await urlDepurador(puerto, id));
    const esperaMs = 30_000;
    return await new Promise((resolver, rechazar) => {
      const ws = new WebSocket(wsUrl);
      // Cola de mensajes pendientes por id (aquí solo usamos id 1).
      const pendientes = new Map();
      const temporizador = setTimeout(() => {
        pendientes.delete(1);
        try {
          ws.close();
        } catch {
          // Ignorar errores al cerrar tras el timeout.
        }
        rechazar(new Error(`Timeout CDP (30 s) en ${metodo}`));
      }, esperaMs);

      ws.addEventListener('open', () => {
        ws.send(JSON.stringify({ id: 1, method: metodo, params }));
      });
      ws.addEventListener('message', (evento) => {
        let msg;
        try {
          msg = JSON.parse(String(evento.data));
        } catch {
          return; // Mensaje no JSON: ignorar.
        }
        if (msg.id !== 1) return; // Solo nos interesa nuestra respuesta.
        pendientes.delete(1);
        clearTimeout(temporizador);
        try {
          ws.close();
        } catch {
          // Ignorar errores al cerrar.
        }
        if (msg.error) {
          rechazar(new Error(`CDP ${metodo}: ${msg.error.message ?? JSON.stringify(msg.error)}`));
        } else {
          resolver(msg.result ?? {});
        }
      });
      ws.addEventListener('error', (err) => {
        clearTimeout(temporizador);
        rechazar(err?.error ?? new Error(`Error WebSocket en ${metodo}`));
      });
      // Registra el id en espera en la cola.
      pendientes.set(1, true);
    });
  })();
}

// Sesión CDP persistente: un solo WebSocket para varios comandos seguidos.
// Hace falta porque con una conexión nueva por comando Chrome descarta
// estados como el override de viewport (las capturas salían a 762×484).
export async function abrirSesion(puerto, id) {
  const wsUrl = await urlDepurador(puerto, id);
  let proximoId = 0;
  const pendientes = new Map();
  const ws = new WebSocket(wsUrl);
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
    if (msg.id == null || !pendientes.has(msg.id)) return;
    const { resolver, rechazar, temporizador } = pendientes.get(msg.id);
    pendientes.delete(msg.id);
    clearTimeout(temporizador);
    if (msg.error) rechazar(new Error(`CDP: ${msg.error.message ?? JSON.stringify(msg.error)}`));
    else resolver(msg.result ?? {});
  });
  // Envía un comando por la sesión y espera su respuesta (timeout 30 s).
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
  return { enviar, cerrar };
}

// Captura la pestaña a PNG y la guarda en ruta (crea directorios).
export async function capturar(puerto, id, ruta) {
  const resultado = await cdp(puerto, id, 'Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
  });
  if (!resultado?.data) throw new Error('captureScreenshot no devolvió imagen');
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  fs.writeFileSync(ruta, Buffer.from(resultado.data, 'base64'));
  return ruta;
}

// Evalúa una expresión JS en la pestaña (Runtime.evaluate).
export async function evaluar(puerto, id, expresion) {
  const resultado = await cdp(puerto, id, 'Runtime.evaluate', {
    expression: expresion,
    returnByValue: true,
  });
  return resultado?.result?.value;
}

// Mata el proceso de Chrome (sin fallar si ya terminó).
export function cerrarChrome(proc) {
  if (!proc || proc.killed || proc.exitCode !== null) return;
  proc.kill();
}
