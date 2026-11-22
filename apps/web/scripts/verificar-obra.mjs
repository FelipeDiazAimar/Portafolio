// Verificación de la obra guiada por scroll en "Sobre mí": con la intro de agentes activada, se
// avanza de a fracciones de hito y se mira que la portada que llega se construya con el scroll,
// que se desdibuje al volver y que quede construida al llegar.
// Uso, con el dev server levantado: node apps/web/scripts/verificar-obra.mjs
// Deja las capturas en scripts/.regresion/obra/ y termina con código 1 si algo falla.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { abrirSesion, cerrarChrome, nuevaPestana } from './cdp-ayuda.mjs';

const PUERTO = 9453;
const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const RUTA_CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SALIDA = path.join(path.dirname(fileURLToPath(import.meta.url)), '.regresion', 'obra');
const dormir = (ms) => new Promise((res) => setTimeout(res, ms));
fs.mkdirSync(SALIDA, { recursive: true });

const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'obra-'));
const proc = spawn(RUTA_CHROME, ['--headless=new', `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${perfil}`, '--hide-scrollbars', '--use-angle=d3d11', '--enable-gpu', 'about:blank'], { stdio: 'ignore' });
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
    source: `try{localStorage.setItem('theme','dark')}catch(e){};window.__errores=[];const ce=console.error;console.error=(...a)=>{window.__errores.push(a.map(String).join(' ').slice(0,300));ce(...a)};window.addEventListener('error',e=>window.__errores.push('EXC '+e.message))`,
  });
  await s.enviar('Page.navigate', { url: `${BASE_URL}/` });
  const evaluar = async (expresion) => {
    const r = await s.enviar('Runtime.evaluate', { expression: expresion, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result?.value;
  };
  const esperar = async (expresion, ms = 30000) => {
    const fin = Date.now() + ms;
    while (Date.now() < fin) {
      if (await evaluar(expresion).catch(() => false)) return true;
      await dormir(250);
    }
    return false;
  };
  const capturar = async (nombre) => {
    const { data } = await s.enviar('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SALIDA, `${nombre}.png`), Buffer.from(data, 'base64'));
  };
  const irAHito = (i) =>
    evaluar(`(()=>{const c=document.getElementById('sobre-mi');const top=c.getBoundingClientRect().top+scrollY;const largo=c.offsetHeight-innerHeight-(c.querySelector('[data-cola]')?.offsetHeight??0);document.documentElement.dataset.sinIman='true';scrollTo({top:top+largo*(${i}/6),behavior:'instant'});return true})()`);
  const capasHechas = async () => {
    const t = await evaluar(pildora);
    return t ? parseInt(t, 10) : null;
  };
  const fase = `parseFloat(getComputedStyle(document.querySelector('#sobre-mi [data-entro]')).getPropertyValue('--fase'))`;
  // lo que dice la píldora de la obra (si hay obra a la vista)
  const pildora = `(()=>{const t=[...document.querySelectorAll('#sobre-mi span')].find(e=>/capas$/.test(e.textContent))?.textContent??null;return t})()`;
  const llegar = async (i) => {
    await irAHito(i);
    await esperar(`Math.abs(${fase}-${i})<0.002`, 20000);
    await dormir(400);
  };

  await esperar(`document.readyState==='complete'&&!!document.getElementById('sobre-mi')`, 60000);
  await dormir(1500);
  await irAHito(0);
  // la intro: se acelera con clics (pointerdown) hasta que termina. Se anota cuántas capas trae:
  // con las partes de la portada son más de 8 (titular, card, ficha, líneas y regla)
  let capasIntro = 0;
  for (let k = 0; k < 120; k++) {
    const t = await evaluar(pildora).catch(() => null);
    if (t) capasIntro = Math.max(capasIntro, parseInt(t.split('/')[1], 10) || 0);
    if (await evaluar(`document.querySelector('#sobre-mi [data-entro]')?.dataset.entro==='true' && !document.querySelector('#sobre-mi [class*=grilla]')`).catch(() => false)) break;
    await s.enviar('Input.dispatchMouseEvent', { type: 'mousePressed', x: 30, y: 30, button: 'left', clickCount: 1 });
    await s.enviar('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 30, y: 30, button: 'left', clickCount: 1 });
    await dormir(500);
  }
  await dormir(1500);
  chequear('la intro terminó', await evaluar(`document.querySelector('#sobre-mi [data-entro]')?.dataset.entro==='true'`));
  chequear('la intro dibuja las partes de la portada', capasIntro > 8, `${capasIntro} capas`);
  await capturar('0-inicio');

  // sigue una obra hasta que termina: cuántos agentes llegó a haber a la vez y dónde está la píldora
  const agentes = `(()=>{const e=[...document.querySelectorAll('#sobre-mi span')].find(e=>/agentes?$/.test(e.textContent));if(!e)return null;const r=e.parentElement.getBoundingClientRect();return{n:parseInt(e.textContent,10),izq:r.left,abajo:innerHeight-r.bottom}})()`;
  const seguirObra = async (nombre) => {
    const vio = await esperar(`!!(${pildora})`, 8000);
    let max = 0;
    let lugar = null;
    let capturada = false;
    const fin = Date.now() + 25000;
    while (Date.now() < fin) {
      const a = await evaluar(agentes);
      if (!a) break;
      max = Math.max(max, a.n);
      lugar = a;
      if (!capturada && a.n >= 3) {
        await capturar(nombre);
        capturada = true;
      }
      await dormir(120);
    }
    const termino = await esperar(`!(${pildora})`, 5000);
    return { vio, termino, max, lugar };
  };
  // ida: hito por hito hasta "Hoy", cada portada la arman los agentes
  let maxAgentes = 0;
  let lugarPildora = null;
  for (let k = 1; k <= 6; k++) {
    await irAHito(k);
    const r = await seguirObra(`ida-${k}`);
    maxAgentes = Math.max(maxAgentes, r.max);
    lugarPildora = r.lugar ?? lugarPildora;
    chequear(`ida: la portada ${k} la arman los agentes`, r.vio && r.termino, r.vio ? '' : 'nunca apareció la obra');
  }
  chequear('lo que no se pisa se dibuja en paralelo', maxAgentes >= 3, `hasta ${maxAgentes} agentes a la vez`);
  chequear('la píldora queda abajo a la izquierda', lugarPildora && lugarPildora.izq < 80 && lugarPildora.abajo < 60, JSON.stringify(lugarPildora));
  // vuelta: de Hoy a 2025, se desarma la que se estaba viendo
  await irAHito(5);
  await esperar(`!!(${pildora})`, 8000);
  const c1 = await capasHechas();
  await dormir(1500);
  const c2 = await capasHechas();
  await capturar('vuelta-6-a-5');
  chequear('vuelta: se desarma la que se estaba viendo (Hoy)', c1 !== null && c2 !== null && c2 < c1, `${c1} → ${c2}`);
  const desarmada = await esperar(`!(${pildora})`, 25000);
  await dormir(800);
  await capturar('vuelta-en-5');
  chequear('vuelta: termina de desarmarse', desarmada);
  // otra vez hacia "Hoy": se vuelve a armar
  await irAHito(6);
  const otraVez = await esperar(`!!(${pildora})`, 8000);
  await esperar(`!(${pildora})`, 25000);
  chequear('se puede volver a armar', otraVez);
  // quieta a mitad de camino hacia atrás, siguen desarmando
  await llegar(5.6);
  const m1 = await capasHechas();
  await dormir(1200);
  const m2 = await capasHechas();
  chequear('a mitad de camino siguen solos', m1 !== null && m2 !== null && m2 < m1, `${m1} → ${m2}`);
  // y si se arrepiente (vuelve a Hoy), la rearman
  await llegar(6);
  await esperar(`!(${pildora})`, 25000);
  // parado a mitad de camino volviendo: terminan de desarmar y no la vuelven a armar solos
  await llegar(5.5);
  await esperar(`!(${pildora})`, 25000);
  await dormir(1500);
  chequear('desarmada a mitad de camino, no se rearma sola', !(await evaluar(pildora)), (await evaluar(pildora)) ?? '');
  await llegar(5.6);

  await llegar(6);
  const r1 = await capasHechas();
  await dormir(1200);
  const r2 = await capasHechas();
  chequear('arrepentido: la rearman', r2 === null || (r1 !== null && r2 > r1), `${r1} → ${r2}`);
  await esperar(`!(${pildora})`, 25000);
  await capturar('final-hoy');
  // la puerta: con "Hoy" en obra no se pasa a Proyectos
  await llegar(5);
  await esperar(`!(${pildora})`, 25000);
  await irAHito(6);
  await esperar(`!!(${pildora})`, 8000);
  const tope = await evaluar(`(()=>{const c=document.getElementById('sobre-mi');const top=c.getBoundingClientRect().top+scrollY;return top+c.offsetHeight-innerHeight-(c.querySelector('[data-cola]')?.offsetHeight??0)})()`);
  await evaluar(`(scrollTo({top:${tope}+400,behavior:'instant'}),true)`);
  await dormir(700);
  const tras = await evaluar(`({y:scrollY,portal:document.documentElement.dataset.portal??null,obra:!!(${pildora})})`);
  await capturar('puerta-cerrada');
  chequear('con Hoy en obra, la puerta no deja pasar', tras.y <= tope + 2 && !tras.portal, JSON.stringify({ ...tras, tope }));
  await esperar(`!(${pildora})`, 25000);
  // terminada "Hoy", la rueda hacia abajo vuelve a pasar por la puerta a Proyectos
  await dormir(600);
  for (let k = 0; k < 8; k++) {
    await s.enviar('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 700, y: 450, deltaX: 0, deltaY: 260 });
    await dormir(120);
  }
  const paso = await esperar(`(()=>{const p=document.getElementById('proyectos');return !!p&&p.getBoundingClientRect().top<40})()`, 20000);
  await capturar('puerta-abierta');
  chequear('terminada Hoy, la puerta deja pasar a Proyectos', paso);
  const errores = await evaluar('window.__errores');
  chequear('sin errores en consola', !errores.length, errores.slice(0, 3).join(' | '));
  s.cerrar();
} catch (e) {
  console.error(e);
  fallas.push('excepción');
} finally {
  cerrarChrome(proc);
}
console.log(fallas.length ? `\n${fallas.length} falla(s)` : '\nTodo bien');
process.exit(fallas.length ? 1 : 0);
