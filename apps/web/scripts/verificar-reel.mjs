// Verificación de la sección "Sobre mí" (reel de hitos) con Chrome headless.
// Uso, con el dev server levantado (no lo levanta este script):
//   node apps/web/scripts/verificar-reel.mjs [capturas|pruebas|todo]
//   BASE_URL=http://127.0.0.1:3000 (por defecto)
// Deja las capturas en scripts/.regresion/reel/ y termina con código 1 si alguna prueba falla.
// Puerto 9452 para no chocar con los otros scripts. Comentarios en español.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { abrirSesion, cerrarChrome, nuevaPestana } from './cdp-ayuda.mjs';

const PUERTO = 9452;
const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const RUTA_CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SALIDA = path.join(path.dirname(fileURLToPath(import.meta.url)), '.regresion', 'reel');
const dormir = (ms) => new Promise((res) => setTimeout(res, ms));
const modo = process.argv[2] ?? 'todo';

// Con GPU por software (SwiftShader): el reel necesita WebGL y `--disable-gpu` lo apagaría.
async function lanzar(dirPerfil) {
  const proc = spawn(RUTA_CHROME, ['--headless=new', `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${dirPerfil}`, '--hide-scrollbars', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', 'about:blank'], { stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${PUERTO}/json`)).ok) return proc;
    } catch {
      /* todavía no escucha */
    }
    await dormir(400);
  }
  cerrarChrome(proc);
  throw new Error('Chrome no respondió');
}

// Abre la página con un tamaño, un tema y (si se pide) movimiento reducido o sin WebGL.
async function abrir({ ancho, alto, movil = false, tema = 'dark', reducido = false, sinWebGL = false }) {
  const { id } = await nuevaPestana(PUERTO, 'about:blank');
  const s = await abrirSesion(PUERTO, id);
  const eventos = [];
  await s.enviar('Page.enable');
  await s.enviar('Runtime.enable');
  await s.enviar('Emulation.setDeviceMetricsOverride', { width: ancho, height: alto, deviceScaleFactor: 1, mobile: movil });
  if (movil) await s.enviar('Emulation.setTouchEmulationEnabled', { enabled: true });
  await s.enviar('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reducido ? 'reduce' : 'no-preference' }] });
  // la intro de agentes traba la página unos segundos: estas pruebas son del reel, no de ella
  const previo = [`try{localStorage.setItem('theme','${tema}');sessionStorage.setItem('portafolio:intro-agentes','1')}catch(e){}`, `window.__errores=[];const ce=console.error;console.error=(...a)=>{window.__errores.push(a.map(String).join(' ').slice(0,300));ce(...a)};window.addEventListener('error',e=>window.__errores.push('EXC '+e.message))`];
  if (sinWebGL) previo.push(`const g=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...r){return /webgl/.test(t)?null:g.call(this,t,...r)}`);
  await s.enviar('Page.addScriptToEvaluateOnNewDocument', { source: previo.join(';') });
  await s.enviar('Page.navigate', { url: `${BASE_URL}/` });
  const evaluar = async (expresion) => {
    const r = await s.enviar('Runtime.evaluate', { expression: expresion, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result?.value;
  };
  // Espera a que la página esté armada (en dev la primera carga puede tardar) y un poco más.
  for (let i = 0; i < 80; i++) {
    await dormir(500);
    const lista = await evaluar(`document.readyState === 'complete' && !!document.getElementById('sobre-mi') && !!document.getElementById('contacto')`).catch(() => false);
    if (lista) break;
  }
  await dormir(2500);
  const capturar = async (nombre) => {
    const { data } = await s.enviar('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SALIDA, `${nombre}.png`), Buffer.from(data, 'base64'));
  };
  // Lleva el scroll, de un salto, al hito `i` (puede ser fraccionario).
  const irAHito = (i) =>
    evaluar(`(()=>{const c=document.getElementById('sobre-mi');const top=c.getBoundingClientRect().top+scrollY;const largo=c.offsetHeight-innerHeight-(c.querySelector('[data-cola]')?.offsetHeight??0);scrollTo({top:top+largo*(${i}/6),behavior:'instant'});return true})()`);
  const tecla = async (key, code, vk) => {
    await s.enviar('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk });
    await s.enviar('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk });
  };
  return { s, id, evaluar, capturar, irAHito, tecla, eventos, cerrar: () => s.cerrar() };
}

const estado = `(()=>{const p=document.querySelector('#sobre-mi [data-entro]');const cv=document.querySelector('#sobre-mi canvas');return{plano:!!document.querySelector('#sobre-mi[data-plano]'),activa:cv?.dataset.activa??null,anio:document.querySelector('#sobre-mi [aria-current=step]')?.textContent?.split(':')[0]??null,fase:p?parseFloat(getComputedStyle(p).getPropertyValue('--fase')):null,desborde:document.documentElement.scrollWidth-innerWidth,errores:window.__errores,hash:location.hash}})()`;

async function capturas() {
  const tamanos = [
    { nombre: 'pc-1920', ancho: 1920, alto: 1080 },
    { nombre: 'pc-1536', ancho: 1536, alto: 730 },
    { nombre: 'tablet-820', ancho: 820, alto: 1180 },
    { nombre: 'cel-390', ancho: 390, alto: 844, movil: true },
    { nombre: 'cel-360', ancho: 360, alto: 740, movil: true },
  ];
  const pedidos = process.argv[3] ? tamanos.filter((t) => process.argv[3].split(',').includes(t.nombre)) : tamanos;
  for (const t of pedidos) {
    for (const tema of ['dark', 'light']) {
      const p = await abrir({ ...t, tema });
      for (const hito of t.nombre === 'pc-1536' || t.nombre === 'cel-390' ? [0, 2, 5, 6] : [0, 3]) {
        await p.irAHito(hito);
        await dormir(hito === 0 ? 4200 : 2600);
        await p.capturar(`${t.nombre}-${tema === 'dark' ? 'oscuro' : 'claro'}-h${hito}`);
      }
      const e = await p.evaluar(estado);
      console.log(`${t.nombre} ${tema}: desborde ${e.desborde}px · errores ${e.errores.length}${e.errores.length ? ' → ' + e.errores[0] : ''}`);
      p.cerrar();
    }
  }
}

async function pruebas() {
  const fallas = [];
  const comprobar = (nombre, ok, detalle = '') => {
    console.log(`${ok ? '✔' : '✖'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
    if (!ok) fallas.push(nombre);
  };

  // 1. arranque, scroll → fase, imán, teclado, regla de años, pausa fuera de pantalla
  let p = await abrir({ ancho: 1536, alto: 730 });
  // Espera a que la cinta quede asentada en `anio` (hasta `tope` ms): con WebGL por software un
  // cuadro puede tardar diez veces más que en una máquina real, y lo que se prueba es adónde llega.
  const llegarA = async (anio, tope = 9000) => {
    let ultimo = null;
    for (let t = 0; t < tope; t += 200) {
      await dormir(200);
      ultimo = await p.evaluar(estado);
      if (ultimo.anio === anio && Math.abs(ultimo.fase - Math.round(ultimo.fase)) < 0.02) break;
    }
    return ultimo;
  };
  await p.irAHito(0);
  await dormir(3500);
  let e = await p.evaluar(estado);
  comprobar('arranca en Origen con el reel (no la lista plana)', !e.plano && e.anio === 'Origen' && Math.abs(e.fase) < 0.02, JSON.stringify({ plano: e.plano, anio: e.anio, fase: e.fase }));
  comprobar('el bucle corre con la sección a la vista', e.activa === 'true', `activa=${e.activa}`);
  comprobar('la URL sigue a la sección', e.hash === '#sobre-mi', e.hash);

  await p.irAHito(2);
  await dormir(2400);
  await p.irAHito(2.08);
  e = await llegarA('2023');
  comprobar('un corrimiento mínimo vuelve al mismo hito (2,08 → 2023)', e.anio === '2023' && Math.abs(e.fase - 2) < 0.03, `anio=${e.anio} fase=${e.fase}`);

  // diorama animado: aparece al asentarse y calza con el de la textura
  const vivo = `(()=>{const v=document.querySelector('#sobre-mi [data-visible]');const cs=[...v.children].map(f=>f.getBoundingClientRect());const l=Math.min(...cs.map(c=>c.left)),t=Math.min(...cs.map(c=>c.top)),r=Math.max(...cs.map(c=>c.right)),b=Math.max(...cs.map(c=>c.bottom));return{visible:v.dataset.visible,caja:[l+2,t+2,r-l-4,b-t-4].map(Math.round),src:v.children[0].lastElementChild.shadowRoot?.querySelector('svg')?.id??null}})()`;
  // espera a que el diorama animado de `patron` esté a la vista (hasta `tope` ms)
  const vivoListo = async (patron, tope = 9000) => {
    let ultimo = null;
    for (let t = 0; t < tope; t += 200) {
      await dormir(200);
      ultimo = await p.evaluar(vivo);
      if (ultimo.visible === 'true' && patron.test(ultimo.src ?? '')) break;
    }
    await dormir(500);
    return p.evaluar(vivo);
  };
  let v = await vivoListo(/diorama-2-/);
  comprobar('el diorama animado aparece sobre la portada asentada', v.visible === 'true' && /diorama-2-/.test(v.src ?? ''), JSON.stringify(v));
  const recorte = async () => {
    // pantalla entera y recorte aparte: el `clip` de CDP devuelve una imagen vacía con el viewport emulado
    const { data } = await p.s.enviar('Page.captureScreenshot', { format: 'png' });
    const zona = sharp(Buffer.from(data, 'base64')).extract({ left: v.caja[0], top: v.caja[1], width: v.caja[2], height: v.caja[3] }).removeAlpha();
    // en grises y suavizado: el SVG insertado es más nítido que la textura, y eso no es un error
    return zona.greyscale().blur(1.2).raw().toBuffer({ resolveWithObject: true });
  };
  const conVivo = await recorte();
  // tras cada cambio se espera a que el navegador repinte: si no, la captura trae el cuadro anterior
  await p.evaluar(`document.querySelector('#sobre-mi [data-visible]').style.visibility='hidden'`);
  await dormir(300);
  const sinVivo = await recorte();
  await p.evaluar(`document.querySelector('#sobre-mi [data-visible]').style.visibility=''`);
  const comparar = (a, b) => {
    let n = 0;
    for (let i = 0; i < a.data.length; i++) if (Math.abs(a.data[i] - b.data[i]) > 14) n++;
    return n / a.data.length;
  };
  // ¿cuánto habría que correr la capa animada para que calce mejor con la textura? Tiene que ser nada.
  const { width: W, height: H } = conVivo.info;
  let mejor = null;
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      let error = 0;
      for (let y = 6; y < H - 6; y += 2) for (let x = 6; x < W - 6; x += 2) error += Math.abs(conVivo.data[y * W + x] - sinVivo.data[(y + dy) * W + x + dx]);
      if (!mejor || error < mejor.error) mejor = { dx, dy, error };
    }
  }
  comprobar('el diorama animado calza con el quieto (sin corrimiento)', Math.abs(mejor.dx) <= 1 && Math.abs(mejor.dy) <= 1, `mejor corrimiento: ${mejor.dx}, ${mejor.dy} px`);
  // contraprueba: sin su imagen, la capa animada es sólo el fondo y tiene que tapar el diorama quieto
  await p.evaluar(`[...document.querySelector('#sobre-mi [data-visible]').children].forEach(f=>f.lastElementChild.style.visibility='hidden')`);
  await dormir(300);
  const soloFondo = await recorte();
  await p.evaluar(`[...document.querySelector('#sobre-mi [data-visible]').children].forEach(f=>f.lastElementChild.style.visibility='')`);
  await dormir(300);
  const tapado = comparar(soloFondo, sinVivo);
  const opacidad = await p.evaluar(`getComputedStyle(document.querySelector('#sobre-mi [data-visible]')).opacity`);
  comprobar('la capa animada se pinta de verdad y su fondo tapa el diorama quieto', opacidad === '1' && tapado > 0.08, `opacidad ${opacidad} · ${(tapado * 100).toFixed(1)} % cambia al ocultar el SVG`);
  await p.capturar('vivo-h2');

  // a mitad de camino entre dos hitos no hay diorama animado
  await p.irAHito(2.1);
  let retirado = false;
  for (let i = 0; i < 8 && !retirado; i++) {
    await dormir(60);
    retirado = (await p.evaluar(vivo)).visible === 'false';
  }
  comprobar('mientras la cinta se mueve, el diorama animado se retira', retirado);
  await p.irAHito(2);
  await dormir(1500);
  await p.tecla('ArrowRight', 'ArrowRight', 39);
  e = await llegarA('2024');
  comprobar('flecha derecha avanza un hito', e.anio === '2024', `anio=${e.anio}`);
  await p.tecla('End', 'End', 35);
  e = await llegarA('Hoy');
  comprobar('Fin lleva al último', e.anio === 'Hoy', `anio=${e.anio}`);
  await p.tecla('Home', 'Home', 36);
  e = await llegarA('Origen');
  comprobar('Inicio vuelve al primero', e.anio === 'Origen', `anio=${e.anio}`);

  await p.evaluar(`document.querySelectorAll('#sobre-mi nav button')[4].click()`);
  e = await llegarA('2025');
  comprobar('la regla de años lleva a 2025', e.anio === '2025', `anio=${e.anio}`);

  // arrastre con el mouse hacia la izquierda: avanza
  const arrastre = async (dx) => {
    const y = 300;
    await p.s.enviar('Input.dispatchMouseEvent', { type: 'mousePressed', x: 500, y, button: 'left', clickCount: 1 });
    for (let i = 1; i <= 8; i++) await p.s.enviar('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 500 + (dx * i) / 8, y, button: 'left', buttons: 1 });
    await p.s.enviar('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 500 + dx, y, button: 'left', clickCount: 1 });
  };
  await arrastre(-420);
  e = await llegarA('2026');
  comprobar('arrastrar a la izquierda avanza (2025 → 2026)', e.anio === '2026', `anio=${e.anio}`);

  // cambio de tema con la sección a la vista: se rehacen las portadas y el diorama animado
  await p.evaluar(`document.documentElement.setAttribute('data-theme','light')`);
  v = await vivoListo(/-claro$/, 14000);
  e = await p.evaluar(estado);
  comprobar('al cambiar de tema, las portadas y el diorama animado pasan a claro', v.visible === 'true' && /-claro$/.test(v.src ?? '') && e.anio === '2026' && e.errores.length === 0, JSON.stringify({ visible: v.visible, src: v.src, anio: e.anio, errores: e.errores.slice(0, 1) }));
  await p.capturar('tema-cambiado');
  await p.evaluar(`document.documentElement.setAttribute('data-theme','dark')`);
  await dormir(1500);

  // un toque en la tarjeta de la derecha lleva a ese hito; uno en la del centro no mueve nada
  await p.irAHito(2);
  await dormir(2200);
  const click = async (x, y) => {
    await p.s.enviar('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await p.s.enviar('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  };
  // (la cinta tiene que estar asentada: a mitad de camino un toque no acerca nada)
  await llegarA('2023');
  await dormir(600);
  await click(768, 330);
  await dormir(2500);
  e = await p.evaluar(estado);
  const zoom = await p.evaluar(`JSON.stringify({abierto:document.querySelector('#sobre-mi [data-detalle]').dataset.detalle,marcas:document.querySelectorAll('#sobre-mi [aria-pressed]').length,nota:document.querySelector('#sobre-mi [aria-live] p')?.textContent??null})`);
  comprobar('tocar la tarjeta del centro la acerca, con sus puntos y la primera nota, sin cambiar de hito', e.anio === '2023' && zoom.includes('"abierto":"true","marcas":2,"nota":"First de Cambridge"'), zoom);
  await p.tecla('Escape', 'Escape', 27);
  await dormir(1500);
  comprobar('Escape devuelve la portada a su lugar', (await p.evaluar(`document.querySelector('#sobre-mi [data-detalle]').dataset.detalle`)) === 'false');
  await click(1380, 200);
  e = await llegarA('2024');
  comprobar('tocar la tarjeta de la derecha lleva a ese hito', e.anio === '2024', `anio=${e.anio}`);
  // un solo giro de rueda (100 px) alcanza para pasar al hito siguiente
  await p.s.enviar('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 768, y: 330, deltaX: 0, deltaY: 100 });
  e = await llegarA('2025');
  comprobar('un giro de rueda pasa al hito siguiente', e.anio === '2025', `anio=${e.anio}`);
  await p.s.enviar('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 768, y: 330, deltaX: 0, deltaY: -100 });
  e = await llegarA('2024');
  comprobar('y uno hacia arriba vuelve al anterior', e.anio === '2024', `anio=${e.anio}`);
  // apretar a mitad de un asentamiento no deja la cinta entre dos hitos
  await p.irAHito(4.3);
  await dormir(260);
  await click(300, 620);
  await dormir(2200);
  e = await p.evaluar(estado);
  comprobar('un toque a mitad del asentamiento no deja la cinta entre dos hitos', Math.abs(e.fase - Math.round(e.fase)) < 0.02, `fase=${e.fase}`);

  // el final: en "Hoy" la marquesina de Proyectos todavía no tapa nada; un empujón chico vuelve a
  // "Hoy" y uno decidido pasa a Proyectos
  await p.irAHito(6);
  e = await llegarA('Hoy');
  const libre = await p.evaluar(`document.getElementById('proyectos').getBoundingClientRect().top - innerHeight*0.3 >= innerHeight - 2`);
  comprobar('en "Hoy" las tarjetas de Proyectos no tapan la regla de años', e.anio === 'Hoy' && libre === true, `anio=${e.anio} libre=${libre}`);
  const yHoy = await p.evaluar('Math.round(scrollY)');
  await p.s.enviar('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 768, y: 330, deltaX: 0, deltaY: 40 });
  await dormir(2500);
  let y = await p.evaluar('Math.round(scrollY)');
  comprobar('desde "Hoy", un corrimiento chico hacia abajo vuelve a "Hoy"', Math.abs(y - yHoy) < 3, `scroll ${yHoy} → ${y}`);
  await p.s.enviar('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 768, y: 330, deltaX: 0, deltaY: 160 });
  let arribaProyectos = null;
  for (let t = 0; t < 9000; t += 250) {
    await dormir(250);
    arribaProyectos = await p.evaluar(`Math.round(document.getElementById('proyectos').getBoundingClientRect().top)`);
    if (Math.abs(arribaProyectos) < 3) break;
  }
  comprobar('y un empujón decidido pasa a Proyectos', Math.abs(arribaProyectos) < 3, `borde de Proyectos a ${arribaProyectos} px`);
  // por la puerta se llega con las fichas ya en su lugar (sin entrada) y no queda nada colgado
  const enVuelo = await p.evaluar(`[...document.querySelectorAll('#proyectos [data-mq-item] > div.overflow-hidden')].filter(f=>f.style.transform).length`);
  await p.capturar('entrada-proyectos');
  await dormir(1500);
  const resto = await p.evaluar(`JSON.stringify({seccion:document.getElementById('proyectos').style.transform,recorte:document.querySelector('#sobre-mi [data-entro]').style.clipPath,puerta:document.querySelector('#sobre-mi [data-activo]').dataset.activo,sinIman:document.documentElement.dataset.sinIman??null})`);
  comprobar('al cruzar la puerta, Proyectos ya está armada y no queda nada colgado', enVuelo === 0 && resto === '{"seccion":"","recorte":"","puerta":"false","sinIman":null}', `en vuelo ${enVuelo} · ${resto}`);

  // la vuelta: subiendo desde Proyectos se sale por la misma puerta y se queda en "Hoy"; durante
  // el pasaje la página no se deja scrollear
  await dormir(1500);
  await p.s.enviar('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 768, y: 330, deltaX: 0, deltaY: -120 });
  await dormir(700);
  const enVuelta = await p.evaluar(`document.documentElement.dataset.portal ?? null`);
  await p.s.enviar('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 768, y: 330, deltaX: 0, deltaY: -900 });
  let vuelta = null;
  for (let t = 0; t < 30000; t += 300) {
    await dormir(300);
    vuelta = await p.evaluar(`JSON.stringify({y:Math.round(scrollY),portal:document.documentElement.dataset.portal??null,seccion:document.getElementById('proyectos').style.transform,recorte:document.querySelector('#sobre-mi [data-entro]').style.clipPath})`);
    if (vuelta.includes('"portal":null')) break;
  }
  await dormir(1200);
  y = await p.evaluar('Math.round(scrollY)');
  e = await p.evaluar(estado);
  comprobar('subiendo desde Proyectos se vuelve por la puerta a "Hoy", sin que el scroll la interrumpa', enVuelta === 'true' && Math.abs(y - yHoy) < 3 && e.anio === 'Hoy' && vuelta.includes('"seccion":"","recorte":""'), `en pasaje ${enVuelta} · scroll ${y} (Hoy = ${yHoy}) · ${vuelta}`);

  await p.evaluar(`scrollTo({top:0,behavior:'instant'})`);
  await dormir(1200);
  e = await p.evaluar(estado);
  comprobar('fuera de pantalla el bucle se detiene', e.activa === 'false', `activa=${e.activa}`);
  const sinImagen = await p.evaluar(`[...document.querySelector('#sobre-mi [data-visible]').children].every(f=>!f.lastElementChild.shadowRoot?.querySelector('svg'))`);
  comprobar('fuera de pantalla no queda ningún SVG animándose', sinImagen === true);
  await p.evaluar(`document.getElementById('contacto').scrollIntoView({behavior:'instant'})`);
  await dormir(1500);
  e = await p.evaluar(estado);
  comprobar('más abajo sigue detenido y la URL cambió de sección', e.activa === 'false' && e.hash !== '#sobre-mi', `activa=${e.activa} hash=${e.hash}`);
  comprobar('sin scroll horizontal (1536)', e.desborde <= 0, `${e.desborde}px`);
  comprobar('consola sin errores (1536)', e.errores.length === 0, e.errores[0] ?? '');
  p.cerrar();

  // 2. movimiento reducido: usable e instantáneo, sin errores de hidratación
  p = await abrir({ ancho: 1536, alto: 730, reducido: true });
  await p.irAHito(4);
  e = await llegarA('2025');
  comprobar('movimiento reducido: el salto es instantáneo', e.anio === '2025' && Math.abs(e.fase - 4) < 0.001, `anio=${e.anio} fase=${e.fase}`);
  await p.capturar('reducido-h4');
  comprobar('movimiento reducido: consola sin errores', e.errores.length === 0, e.errores[0] ?? '');
  p.cerrar();

  // 3. sin WebGL: la lista plana, con los siete hitos y sus dioramas
  p = await abrir({ ancho: 1536, alto: 730, sinWebGL: true });
  await p.evaluar(`document.getElementById('sobre-mi').scrollIntoView({behavior:'instant'})`);
  await dormir(1500);
  const plano = await p.evaluar(`(()=>{const s=document.querySelector('#sobre-mi[data-plano]');return{hay:!!s,hitos:s?s.querySelectorAll('li').length:0,imagenes:s?[...s.querySelectorAll('img')].filter(i=>i.complete&&i.naturalWidth>0).length:0,errores:window.__errores}})()`);
  await p.evaluar(`document.querySelectorAll('#sobre-mi img').forEach(i=>i.loading='eager')`);
  await dormir(800);
  await p.capturar('sin-webgl');
  comprobar('sin WebGL aparece la lista plana con 7 hitos', plano.hay && plano.hitos === 7, JSON.stringify(plano));
  p.cerrar();

  // 4. celular: sin desborde y con el reel
  p = await abrir({ ancho: 390, alto: 844, movil: true });
  await p.irAHito(3);
  await dormir(2600);
  e = await p.evaluar(estado);
  comprobar('celular 390: reel activo, sin scroll horizontal ni errores', !e.plano && e.desborde <= 0 && e.errores.length === 0, JSON.stringify({ plano: e.plano, desborde: e.desborde, errores: e.errores.slice(0, 1) }));
  p.cerrar();

  console.log(fallas.length ? `\n${fallas.length} prueba(s) fallaron` : '\nTodas las pruebas pasaron');
  return fallas.length;
}

fs.mkdirSync(SALIDA, { recursive: true });
const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'reel-'));
const chrome = await lanzar(perfil);
let fallas = 0;
try {
  if (modo === 'capturas' || modo === 'todo') await capturas();
  if (modo === 'pruebas' || modo === 'todo') fallas = await pruebas();
} finally {
  cerrarChrome(chrome);
  await dormir(600);
  try {
    fs.rmSync(perfil, { recursive: true, force: true, maxRetries: 8, retryDelay: 300 });
  } catch {
    /* Chrome todavía tiene tomado el perfil temporal: lo limpia el sistema */
  }
}
process.exit(fallas ? 1 : 0);
