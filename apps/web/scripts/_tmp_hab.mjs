import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { lanzarChrome, nuevaPestana, abrirSesion, cerrarChrome } from './cdp-ayuda.mjs';
const P = 9491; const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const proc = await lanzarChrome(P, fs.mkdtempSync(path.join(os.tmpdir(), 'hab-')));
try {
  const id = await nuevaPestana(P, 'http://127.0.0.1:3111/');
  const s = await abrirSesion(P, id.id);
  await s.enviar('Emulation.setDeviceMetricsOverride', { width: 1500, height: 820, deviceScaleFactor: 1, mobile: false });
  const ev = async (e) => (await s.enviar('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
  await dormir(30000);
  await ev(`document.querySelector('a[href="#habilidades"]')?.click()`);
  await dormir(15000);
  for (let k = 0; k < 2; k++) {
    console.log(k, await ev(`(()=>{const m=document.querySelector('[class*=MarcaUso_marca]');return m?m.dataset.visible+' '+m.dataset.lado+' '+m.style.transform:'sin'})()`));
    const sh = await s.enviar('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(process.env.TEMP + `/hab${k}.png`, Buffer.from(sh.data, 'base64'));
    await dormir(3000);
  }
  s.cerrar();
} finally { cerrarChrome(proc); }


