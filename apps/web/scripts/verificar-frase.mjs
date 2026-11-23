// Verifica "Gracias por pasar." en 3D de metal pulido (pie de #contacto): que se arme el lienzo WebGL,
// que las letras aparezcan y que el cursor abra la lente. Con el dev server levantado:
//   node apps/web/scripts/verificar-frase.mjs      (env BASE_URL, GPU=0 para WebGL por software)
// Deja capturas en scripts/.regresion/frase/ y termina con código 1 si algo falla.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { abrirSesion, cerrarChrome, nuevaPestana } from './cdp-ayuda.mjs';

const PUERTO = Number(process.env.PUERTO ?? 9457 + Math.floor(Math.random() * 400));
const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const RUTA_CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SALIDA = path.join(path.dirname(fileURLToPath(import.meta.url)), '.regresion', 'frase');
const dormir = (ms) => new Promise((res) => setTimeout(res, ms));
fs.mkdirSync(SALIDA, { recursive: true });

const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'frase-'));
const gpu = process.env.GPU === '0' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=d3d11', '--enable-gpu'];
const proc = spawn(RUTA_CHROME, ['--headless=new', `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${perfil}`, '--hide-scrollbars', ...gpu, 'about:blank'], { stdio: 'ignore' });
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(`http://127.0.0.1:${PUERTO}/json`)).ok) break;
  } catch {
    /* todavía no */
  }
  await dormir(400);
}

const fallas = [];
const chequear = (nombre, ok, detalle = '') => {
  console.log(`${ok ? 'OK  ' : 'FALLA'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
  if (!ok) fallas.push(nombre);
};

try {
  const { id } = await nuevaPestana(PUERTO, 'about:blank');
  const s = await abrirSesion(PUERTO, id);
  await s.enviar('Page.enable');
  await s.enviar('Runtime.enable');
  await s.enviar('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await s.enviar('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await s.enviar('Page.addScriptToEvaluateOnNewDocument', {
    source: `try{localStorage.setItem('theme','${process.env.TEMA ?? 'dark'}');sessionStorage.setItem('portafolio:sin-intro','1');sessionStorage.setItem('portafolio:bienvenida-vista','1');sessionStorage.setItem('portafolio:intro-agentes','1')}catch(e){};window.__errores=[];const ce=console.error;console.error=(...a)=>{window.__errores.push(a.map(String).join(' ').slice(0,300));ce(...a)};window.addEventListener('error',e=>window.__errores.push('EXC '+e.message))`,
  });
  await s.enviar('Page.navigate', { url: `${BASE_URL}/` });
  const evaluar = async (expresion) => {
    const r = await s.enviar('Runtime.evaluate', { expression: expresion, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result?.value;
  };
  const esperar = async (expresion, ms = 40000) => {
    const fin = Date.now() + ms;
    while (Date.now() < fin) {
      if (await evaluar(expresion).catch(() => false)) return true;
      await dormir(300);
    }
    return false;
  };
  const capturar = async (nombre) => {
    const { data } = await s.enviar('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SALIDA, `${nombre}.png`), Buffer.from(data, 'base64'));
  };

  await esperar(`!!document.querySelector('[class*="CierreFooter_vidrio"]')`);
  await dormir(3000);
  // Baja hasta el final de la página, donde está el cierre del pie.
  await evaluar(`document.documentElement.dataset.sinIman='true';scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'});true`);
  const listo = await esperar(`document.querySelector('[class*="CierreFooter_vidrio"]')?.dataset.modo==='3d'`);
  chequear('modo 3D activo', listo);
  // El scroll del sitio es suave y a veces se queda corto: se insiste hasta que la frase entre en pantalla.
  for (let i = 0; i < 12; i++) {
    const y = await evaluar(`document.querySelector('[class*="CierreFooter_vidrio"]').getBoundingClientRect().top`);
    if (y < 420) break;
    await evaluar(`scrollBy({top:Math.max(300,${Math.round(0)}+ (document.querySelector('[class*="CierreFooter_vidrio"]').getBoundingClientRect().top-300)),behavior:'instant'});true`);
    await dormir(700);
  }
  await dormir(3500);
  const caja = await evaluar(`(()=>{const e=document.querySelector('[class*="CierreFooter_vidrio"]');const r=e.getBoundingClientRect();const c=e.querySelector('canvas');const cr=c?.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,canvas:cr?{w:cr.width,h:cr.height,x:cr.x,y:cr.y}:null}})()`);
  console.log('caja', JSON.stringify(caja));
  chequear('hay canvas', !!caja.canvas);
  await capturar('1-reposo');

  const cx = Math.round(caja.x + caja.w * 0.45);
  const cy = Math.round(caja.y + caja.h * 0.4);
  for (const [x, y] of [[cx - 80, cy + 20], [cx - 30, cy + 10], [cx, cy]]) {
    await s.enviar('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, pointerType: 'mouse' });
    await dormir(250);
  }
  await dormir(1800);
  await capturar('2-hover');
  await s.enviar('Input.dispatchMouseEvent', { type: 'mouseMoved', x: Math.round(caja.x + caja.w * 0.15), y: Math.round(caja.y + caja.h * 0.75) });
  await dormir(1800);
  await capturar('3-hover-segunda-linea');

  const errores = await evaluar('window.__errores');
  chequear('sin errores de consola', errores.length === 0, errores.join(' | ').slice(0, 400));
} finally {
  cerrarChrome(proc);
}
process.exit(fallas.length ? 1 : 0);
