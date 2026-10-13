// Recorre "Sobre mí" en Chrome headless (por CDP, sin dependencias) y saca capturas de
// cada estancia y de algunos momentos de los viajes. Comprueba el lado del modelo, que la
// bio aparezca y que no haya errores de consola.
//
// Uso: node apps/web/scripts/verificar-sobre-mi.mjs [url] [carpeta]
// Variables: TEMA=light · MOVIL=1 (390×844 táctil) · REDUCIDO=1 · SIN_WEBGL=1
//            CHROME=<ruta a chrome.exe>
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL_SITIO = process.argv[2] ?? 'http://localhost:3100/';
const SALIDA = process.argv[3] ?? join(tmpdir(), 'sobre-mi-capturas');
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PUERTO = 9333;
const MOVIL = Boolean(process.env.MOVIL);

// Mismos pesos que lib/columna/recorrido.js (7 hitos).
const N = 7;
const PE = 1;
const PV = 16.8;
const W = N * PE + (N - 1) * PV;
const estancia = (i) => (i * (PE + PV) + PE / 2) / W;
const viaje = (i, t) => (i * (PE + PV) + PE + t * PV) / W;

mkdirSync(SALIDA, { recursive: true });
const graficos = process.env.SIN_WEBGL
  ? ['--disable-webgl', '--disable-3d-apis']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PUERTO}`,
    `--user-data-dir=${join(tmpdir(), `chrome-sobre-mi-${Date.now()}`)}`,
    '--window-size=1440,900',
    '--hide-scrollbars',
    ...graficos,
    'about:blank',
  ],
  { stdio: 'ignore' }
);

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
let pagina;
for (let k = 0; k < 50 && !pagina; k += 1) {
  try {
    const lista = await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json();
    pagina = lista.find((t) => t.type === 'page');
  } catch {
    // Chrome todavía no abrió el puerto.
  }
  if (!pagina) await esperar(200);
}
if (!pagina) {
  console.error('No se pudo conectar con Chrome en', CHROME);
  chrome.kill();
  process.exit(1);
}

const ws = new WebSocket(pagina.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pendientes = new Map();
const errores = [];
ws.addEventListener('message', (evento) => {
  const m = JSON.parse(evento.data);
  if (m.id && pendientes.has(m.id)) {
    pendientes.get(m.id)(m);
    pendientes.delete(m.id);
  }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    errores.push(`${d.text} ${d.exception?.description ?? ''}`.trim());
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    errores.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
  }
});
const cdp = (method, params = {}) =>
  new Promise((r) => {
    id += 1;
    pendientes.set(id, r);
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluar = async (expresion) =>
  (await cdp('Runtime.evaluate', { expression: expresion, awaitPromise: true, returnByValue: true })).result?.result
    ?.value;
const capturar = async (nombre) => {
  const r = await cdp('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(SALIDA, `${nombre}.png`), Buffer.from(r.result.data, 'base64'));
};

await cdp('Runtime.enable');
await cdp('Page.enable');
const medios = [];
if (process.env.REDUCIDO) medios.push({ name: 'prefers-reduced-motion', value: 'reduce' });
if (process.env.TEMA) medios.push({ name: 'prefers-color-scheme', value: process.env.TEMA });
if (medios.length) await cdp('Emulation.setEmulatedMedia', { features: medios });
if (MOVIL) {
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
}
await cdp('Page.navigate', { url: URL_SITIO });
await esperar(6000);

const irA = (p) =>
  evaluar(`(() => {
    const s = document.getElementById('sobre-mi');
    const arriba = s.getBoundingClientRect().top + scrollY;
    const recorrido = s.offsetHeight - innerHeight;
    scrollTo({ top: arriba + ${p} * recorrido, behavior: 'instant' });
    return true;
  })()`);
const estado = () =>
  evaluar(`(() => {
    const panel = document.querySelector('#sobre-mi [data-lado]');
    const textos = document.querySelector('#sobre-mi [data-textos]');
    return { lado: panel?.dataset.lado, tipo: panel?.dataset.tipo, bio: textos?.dataset.bio === 'true' };
  })()`);

let fallas = 0;
if (await evaluar(`Boolean(document.querySelector('section[data-plano]'))`)) {
  await evaluar(`document.getElementById('sobre-mi').scrollIntoView()`);
  await esperar(1500);
  await capturar('plano');
  console.log('respaldo plano');
} else {
  await evaluar(`document.documentElement.dataset.sinIman = '1'`);
  for (let i = 0; i < N; i += 1) {
    await irA(estancia(i));
    await esperar(2500);
    await capturar(`estancia-${i}`);
    let e = await estado();
    for (let k = 0; k < 32 && !e.bio; k += 1) {
      await esperar(500);
      e = await estado();
    }
    await capturar(`estancia-${i}-bio`);
    const ladoEsperado = MOVIL ? 'arriba' : i % 2 === 0 ? 'izquierda' : 'derecha';
    const ok = e.lado === ladoEsperado && e.tipo === 'estancia' && e.bio;
    if (!ok) fallas += 1;
    console.log(`estancia ${i}: lado ${e.lado} (${ladoEsperado}) · tipo ${e.tipo} · bio: ${e.bio ? 'sí' : 'no'} ${ok ? 'OK' : 'FALLA'}`);
  }
  for (const i of [1, 4]) {
    await irA(estancia(i));
    await esperar(1500);
    for (const t of [0.1, 0.5, 0.9]) {
      await irA(viaje(i, t));
      await esperar(1500);
      await capturar(`viaje-${i}-${t}`);
      const e = await estado();
      console.log(`viaje ${i} t=${t}: tipo ${e.tipo}`);
    }
  }
}

console.log(errores.length ? `errores de consola:\n- ${errores.join('\n- ')}` : 'sin errores de consola');
console.log('capturas en', SALIDA);
ws.close();
chrome.kill();
process.exit(errores.length || fallas ? 1 : 0);
