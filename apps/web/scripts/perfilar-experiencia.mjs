// Perfil de CPU de la sección Experiencia (Chrome headless con GPU): dónde se va el tiempo.
// Uso: BASE_URL=http://127.0.0.1:3001 node apps/web/scripts/perfilar-experiencia.mjs [avance 0..1]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { nuevaPestana, abrirSesion, cerrarChrome } from './cdp-ayuda.mjs';

const PUERTO = 9455;
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3001';
const AVANCE = Number(process.argv[2] ?? 0.03);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-perfil-'));
const proc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${perfil}`, '--use-angle=d3d11', '--enable-gpu', 'about:blank'], { stdio: 'ignore' });
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(`http://127.0.0.1:${PUERTO}/json`)).ok) break;
  } catch {}
  await dormir(500);
}
try {
  const { id } = await nuevaPestana(PUERTO, 'about:blank');
  const s = await abrirSesion(PUERTO, id);
  await s.enviar('Emulation.setDeviceMetricsOverride', { width: 1440, height: 860, deviceScaleFactor: 1, mobile: false });
  await s.enviar('Page.addScriptToEvaluateOnNewDocument', { source: "try{sessionStorage.setItem('portafolio:sin-intro','1')}catch(e){}" });
  await s.enviar('Page.enable');
  await s.enviar('Page.navigate', { url: `${BASE}/` });
  const ev = async (expr) => (await s.enviar('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.value;
  for (let i = 0; i < 120; i++) {
    if (await ev("document.readyState === 'complete' && !document.body.innerText.includes('Portfolio Web') && !!document.querySelector('#experiencia canvas')")) break;
    await dormir(500);
  }
  await dormir(3000);
  await s.enviar('Profiler.enable');
  await s.enviar('Profiler.setSamplingInterval', { interval: 500 });
  await ev(`(() => { const el = document.getElementById('experiencia'); const top = el.getBoundingClientRect().top + scrollY; window.scrollTo(0, top + (el.offsetHeight - innerHeight) * ${AVANCE}); })()`);
  await dormir(Number(process.env.ASENTAR ?? 0));
  await s.enviar('Profiler.start');
  await dormir(Number(process.env.DURACION ?? 8000));
  const { profile } = await s.enviar('Profiler.stop');
  const fps = () => ev(`new Promise((ok) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2500) requestAnimationFrame(f); else ok(Math.round((n * 1000) / (performance.now() - t0))); }; requestAnimationFrame(f); })`);
  console.log('fps tal cual', await fps());
  await ev(`(() => { window.__escenaPasillo.traverse((o) => { if (o.isMesh && o.material.transmission > 0) { o.userData.estaba = o.visible; o.visible = false; } }); })()`);
  console.log('fps sin transmisión', await fps());
  await ev(`(() => { window.__escenaPasillo.traverse((o) => { if (o.isMesh && o.material.transmission > 0) o.visible = o.userData.estaba; }); window.__escenaPasillo.traverse((o) => { if (o.isLight && o.castShadow) { o.userData.sombra = true; o.castShadow = false; } }); })()`);
  console.log('fps sin sombras', await fps());
  console.log('render', await ev(`(() => { const r = window.__rendererPasillo; const e = window.__escenaPasillo; let mallas = 0, visibles = 0, tri = 0; const porMat = {}; e.traverse((o) => { if (!o.isMesh) return; mallas++; let v = o.visible, p = o.parent; while (v && p) { v = p.visible; p = p.parent; } if (!v) return; visibles++; const g = o.geometry; const n = (g.index ? g.index.count : g.attributes.position.count) / 3; tri += n; const k = o.material.type + (o.material.transmission ? '+T' : ''); porMat[k] = (porMat[k] ?? 0) + 1; }); return JSON.stringify({ llamadas: r.info.render.calls, triangulos: r.info.render.triangles, mallas, visibles, triVisibles: Math.round(tri), porMat }); })()`));
  console.log('programas', await ev(`(() => { const r = window.__rendererPasillo; if (!r) return null; const tipos = {}; for (const p of r.info.programs) { const k = p.name || p.cacheKey.slice(0, 40); tipos[k] = (tipos[k] ?? 0) + 1; } return JSON.stringify({ total: r.info.programs.length, tipos }); })()`));
  // tiempo propio por función
  const porId = new Map(profile.nodes.map((n) => [n.id, n]));
  const propio = new Map();
  const intervalo = (profile.endTime - profile.startTime) / profile.samples.length / 1000;
  for (const idMuestra of profile.samples) {
    const n = porId.get(idMuestra);
    const clave = `${n.callFrame.functionName || '(anónima)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber + 1}`;
    propio.set(clave, (propio.get(clave) ?? 0) + intervalo);
  }
  [...propio.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .forEach(([k, v]) => console.log(`${v.toFixed(0).padStart(6)} ms  ${k}`));
  s.cerrar();
} finally {
  cerrarChrome(proc);
}
