// Capturas del pasillo de Experiencia en varios puntos del recorrido (Chrome headless + WebGL por software).
// Uso: BASE_URL=http://127.0.0.1:3000 SALIDA=<carpeta> node apps/web/scripts/verificar-experiencia.mjs [movil]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { nuevaPestana, abrirSesion, cerrarChrome } from './cdp-ayuda.mjs';

const PUERTO = 9452;
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const SALIDA = process.env.SALIDA ?? path.join(os.tmpdir(), 'experiencia');
const movil = process.argv.includes('movil');
const PUNTOS = (process.env.PUNTOS ?? '0,0.06,0.15,0.2,0.33,0.5,0.66,0.85,1').split(',').map(Number);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(SALIDA, { recursive: true });
const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-chrome-'));
const proc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${perfil}`, '--hide-scrollbars', ...(process.env.GPU ? ['--use-angle=d3d11', '--enable-gpu'] : ['--enable-unsafe-swiftshader', '--use-angle=swiftshader']), 'about:blank'], { stdio: 'ignore' });
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(`http://127.0.0.1:${PUERTO}/json`)).ok) break;
  } catch {}
  await dormir(500);
}
try {
  const { id } = await nuevaPestana(PUERTO, 'about:blank');
  const s = await abrirSesion(PUERTO, id);
  const errores = [];
  await s.enviar('Runtime.enable');
  if (movil) await s.enviar('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  await s.enviar('Emulation.setDeviceMetricsOverride', movil ? { width: 390, height: 844, deviceScaleFactor: 1, mobile: true } : { width: 1440, height: 860, deviceScaleFactor: 1, mobile: false });
  if (process.env.REDUCIDO) await s.enviar('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await s.enviar('Page.addScriptToEvaluateOnNewDocument', { source: ("try{localStorage.setItem('theme',process_tema);sessionStorage.setItem('portafolio:sin-intro','1');sessionStorage.setItem('portafolio:bienvenida-vista','1');if(EFECTO_X)localStorage.setItem('pasillo:efecto',EFECTO_X);if(FONDO_X)localStorage.setItem('pasillo:fondo',FONDO_X);if(RENDIMIENTO_X)localStorage.setItem('portafolio:rendimiento','true')}catch(e){}; window.__errores=[]; addEventListener('error',e=>window.__errores.push(String(e.message))); const __ce=console.error; console.error=(...a)=>{window.__errores.push(a.map(String).join(' ').slice(0,240)); __ce(...a)}; const __cw=console.warn; console.warn=(...a)=>{window.__errores.push('W '+a.map(x=>x&&x.stack?x.stack.split(String.fromCharCode(10)).slice(0,3).join(' | '):String(x)).join(' ').slice(0,400)); __cw(...a)}; addEventListener('unhandledrejection',e=>window.__errores.push('REJ '+String(e.reason&&e.reason.stack||e.reason).slice(0,400)));").replace("process_tema", `'${process.env.TEMA ?? 'dark'}'`).replaceAll('EFECTO_X', JSON.stringify(process.env.EFECTO ?? '')).replaceAll('FONDO_X', JSON.stringify(process.env.FONDO ?? '')).replaceAll('RENDIMIENTO_X', JSON.stringify(process.env.RENDIMIENTO ?? '')) });
  await s.enviar('Page.enable');
  await s.enviar('Page.navigate', { url: `${BASE}/` });
  const ev = async (expr) => (await s.enviar('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.value;
  for (let i = 0; i < 120; i++) {
    if (await ev("document.readyState === 'complete' && !document.body.innerText.includes('Portfolio Web') && !!document.querySelector('#contacto') && !!document.querySelector('#experiencia canvas, #experiencia[data-plano]')")) break;
    await dormir(500);
  }
  await dormir(6000);
  console.log('plano?', await ev("!!document.querySelector('#experiencia[data-plano]')"));
  const inspeccionar = async () => {
    console.log(await ev(`JSON.stringify((() => {
      const e = window.__escenaPasillo; if (!e) return 'sin escena';
      const lista = [];
      e.traverse((o) => {
        if (!o.isMesh || !o.visible) return;
        o.geometry.computeBoundingSphere();
        const m = o.matrixWorld.elements;
        const esc = Math.max(Math.hypot(m[0], m[1], m[2]), Math.hypot(m[4], m[5], m[6]), Math.hypot(m[8], m[9], m[10]));
        let p = o, id = null; while (p && !id) { id = p.userData?.id ?? null; p = p.parent; }
        lista.push({ r: +(o.geometry.boundingSphere.radius * esc).toFixed(2), id, nombre: o.name, mat: o.material?.type, x: +m[12].toFixed(1), y: +m[13].toFixed(1), z: +m[14].toFixed(1) });
      });
      return lista.filter((x) => x.id).sort((a, b) => b.r - a.r).slice(0, 10);
    })())`));
  };
  if (process.env.BARRIDO) {
    // recorre la sección entera scrolleando de a poco y mide los cuadros lentos
    const res = await ev(`new Promise((ok) => {
      const el = document.getElementById('experiencia');
      const top = el.getBoundingClientRect().top + scrollY;
      const rec = el.offsetHeight - innerHeight;
      const tiempos = [];
      let u = 0, previo = performance.now();
      const paso = () => {
        const ahora = performance.now();
        tiempos.push(ahora - previo);
        previo = ahora;
        u += 0.0025;
        window.scrollTo(0, top + rec * Math.min(1, u));
        if (u < 1) requestAnimationFrame(paso);
        else {
          tiempos.sort((a, b) => a - b);
          const p = (q) => Math.round(tiempos[Math.floor(q * (tiempos.length - 1))]);
          ok({ cuadros: tiempos.length, mediana: p(0.5), p95: p(0.95), p99: p(0.99), peor: Math.round(tiempos[tiempos.length - 1]), lentos: tiempos.filter((t) => t > 50).length });
        }
      };
      requestAnimationFrame(paso);
    })`);
    console.log('barrido', JSON.stringify(res));
  }
  for (const u of PUNTOS) {
    await ev(`(() => { const el = document.getElementById('experiencia'); const top = el.getBoundingClientRect().top + scrollY; const rec = el.offsetHeight - innerHeight; window.__lenis?.stop?.(); document.documentElement.style.scrollBehavior='auto'; window.scrollTo(0, top + rec * ${u}); window.__lenis?.start?.(); return scrollY; })()`);
    await dormir(Number(process.env.ESPERA ?? 3500));
    const info = await ev(`JSON.stringify({ puesto: document.querySelector('#experiencia h3')?.textContent, puntos: [...document.querySelectorAll('[data-punto]')].filter(e=>e.style.visibility==='visible').map(e=>e.textContent.slice(0,30)) })`);
    if (process.env.MOVIENDO) {
      // scroll continuo y captura en pleno movimiento (los efectos de borde reaccionan a la velocidad)
      ev(`(() => { const el = document.getElementById('experiencia'); const rec = el.offsetHeight - innerHeight; let n = 0; const paso = () => { window.scrollBy(0, rec * 0.0025); if (++n < 160) requestAnimationFrame(paso); }; requestAnimationFrame(paso); })()`);
      await dormir(1400);
      const { data } = await s.enviar('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(SALIDA, `mov-${process.env.FONDO ?? process.env.EFECTO ?? 'x'}-${String(u).replace('.', '_')}.png`), Buffer.from(data, 'base64'));
    }
    const fps = await ev(`new Promise((ok) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else ok(Math.round((n * 1000) / (performance.now() - t0))); }; requestAnimationFrame(f); })`);
    console.log(u, info, 'fps', fps);
    if (process.env.INSPECCIONAR) await inspeccionar();
    const { data } = await s.enviar('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SALIDA, `${movil ? 'movil' : 'esc'}-${process.env.TEMA ?? 'dark'}-${String(u).replace('.', '_')}.png`), Buffer.from(data, 'base64'));
  }
  if (process.env.LIBRE) {
    // recorrido libre: botón, caminar con W, mirar arrastrando y salir con Esc
    await ev(`[...document.querySelectorAll('#experiencia button')].find((b) => b.textContent.includes('Recorrer libre'))?.click()`);
    await dormir(1500);
    const tecla = (type, key, code, vk) => s.enviar('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: vk });
    await tecla('keyDown', 'w', 'KeyW', 87);
    await dormir(2500);
    await tecla('keyUp', 'w', 'KeyW', 87);
    for (const [type, x] of [['mousePressed', 700], ['mouseMoved', 600], ['mouseMoved', 500], ['mouseReleased', 500]]) await s.enviar('Input.dispatchMouseEvent', { type, x, y: 430, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
    await dormir(1500);
    console.log('libre', await ev(`JSON.stringify({ overflow: document.documentElement.style.overflow, puesto: document.querySelector('#experiencia h3')?.textContent, ayuda: !!document.querySelector('#experiencia kbd') })`));
    const cap = await s.enviar('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SALIDA, 'libre.png'), Buffer.from(cap.data, 'base64'));
    await tecla('keyDown', 'Escape', 'Escape', 27);
    await tecla('keyUp', 'Escape', 'Escape', 27);
    await dormir(1500);
    console.log('salió', await ev(`JSON.stringify({ overflow: document.documentElement.style.overflow, ayuda: !!document.querySelector('#experiencia kbd') })`));
  }
  // enfocar un objeto: con CLIC3D se toca el modelo 3D (debajo de su punto); si no, el punto
  if (process.env.CLIC3D) {
    const pos = await ev(`(() => { const b = document.querySelector('[data-punto][style*="visible"] .' + [...document.querySelector('[data-punto]').firstElementChild.classList][0]); if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + 11, r.top + 11 + Number(process_bajada)]; })()`.replace('process_bajada', process.env.CLIC3D));
    console.log('clic 3D en', pos);
    if (pos) {
      if (movil) {
        await s.enviar('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pos[0], y: pos[1] }] });
        await s.enviar('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await s.enviar('Input.dispatchMouseEvent', { type, x: pos[0], y: pos[1], button: 'left', clickCount: 1, pointerType: 'mouse' });
    }
  } else await ev(`document.querySelector('[data-punto][style*="visible"] button')?.click()`);
  await dormir(4000);
  // FLECHAS=n: pasa n objetos con → (prueba saltar a objetos lejanos del pasillo)
  for (let k = 0; k < Number(process.env.FLECHAS ?? 0); k++) {
    for (const type of ['keyDown', 'keyUp']) await s.enviar('Input.dispatchKeyEvent', { type, key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await dormir(2500);
  }
  if (process.env.FLECHAS) await dormir(3000);
  console.log('panel', await ev(`document.querySelector('[data-panel] h3')?.textContent ?? null`));
  await dormir(800);
  const { data } = await s.enviar('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(SALIDA, `${movil ? 'movil' : 'esc'}-${process.env.TEMA ?? 'dark'}-tooltip.png`), Buffer.from(data, 'base64'));
  console.log('errores', await ev(`JSON.stringify(Object.entries((window.__errores ?? []).reduce((h, e) => { const k = String(e).slice(0, 110); h[k] = (h[k] ?? 0) + 1; return h; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 8))`), errores);
  s.cerrar();
} finally {
  cerrarChrome(proc);
}
