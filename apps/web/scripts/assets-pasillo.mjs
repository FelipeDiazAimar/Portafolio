// Baja de Poly Haven (CC0) los modelos y texturas del pasillo de Experiencia y los deja listos
// para la web en apps/web/public/pasillo:
//   m/<id>.glb                    modelo optimizado (texturas WebP, geometría meshopt)
//   t/<id>_{diff,nor,arm}.webp     texturas PBR
//   indice.json                    medidas reales de cada modelo (m) y peso, para ubicarlos
//
// Uso (desde la raíz del monorepo):  node apps/web/scripts/assets-pasillo.mjs [ids...]
// Sin ids procesa todo lo que falta. Se puede cortar y volver a correr: saltea lo ya hecho.
// Necesita red. Usa `npx @gltf-transform/cli` (se descarga solo) y sharp (devDependency).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dirScript = path.dirname(fileURLToPath(import.meta.url));
const raizWeb = path.resolve(dirScript, '..');
const { AMBIENTES, todosLosModelos, todasLasTexturas } = await import(pathToFileURL(path.join(raizWeb, 'src/data/pasilloAssets.js')).href);
const sharp = (await import('sharp')).default;

const SALIDA = path.join(raizWeb, 'public/pasillo');
const CACHE = path.join(os.tmpdir(), 'pasillo-polyhaven');
const UA = { 'User-Agent': 'portfolio-asset-script/1.0' };
const API = 'https://api.polyhaven.com';

fs.mkdirSync(path.join(SALIDA, 'm'), { recursive: true });
fs.mkdirSync(path.join(SALIDA, 't'), { recursive: true });
fs.mkdirSync(CACHE, { recursive: true });

// ---- sin repetidos entre pasillos --------------------------------------------------------------
function verificarUnicos() {
  const vistos = new Map();
  const errores = [];
  for (const [ambiente, a] of Object.entries(AMBIENTES)) {
    for (const id of [...Object.values(a.modelos).flat(), ...Object.values(a.texturas)]) {
      if (vistos.has(id)) errores.push(`${id} está en ${vistos.get(id)} y en ${ambiente}`);
      else vistos.set(id, ambiente);
    }
  }
  if (errores.length) throw new Error(`Assets repetidos entre pasillos:\n  ${errores.join('\n  ')}`);
}
verificarUnicos();

async function json(url) {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

async function bajar(url, destino) {
  if (fs.existsSync(destino)) return;
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
}

// Texturas más grandes para muebles grandes; las cosas chicas no necesitan más de 512.
function tamanoTextura(dim) {
  const mayor = Math.max(...dim) / 1000;
  return mayor > 1.2 ? 1024 : 512;
}

const indicePath = path.join(SALIDA, 'indice.json');
const indice = fs.existsSync(indicePath) ? JSON.parse(fs.readFileSync(indicePath, 'utf8')) : { modelos: {}, texturas: {} };

async function procesarModelo(id) {
  const destino = path.join(SALIDA, 'm', `${id}.glb`);
  if (fs.existsSync(destino) && indice.modelos[id]) return 'ya estaba';
  const info = await json(`${API}/info/${id}`);
  const archivos = await json(`${API}/files/${id}`);
  const gltf = archivos.gltf['1k'].gltf;
  const dir = path.join(CACHE, id);
  await bajar(gltf.url, path.join(dir, `${id}.gltf`));
  for (const [rel, v] of Object.entries(gltf.include ?? {})) await bajar(v.url, path.join(dir, rel));
  const args = ['-y', '@gltf-transform/cli@4.5.1', 'optimize', path.join(dir, `${id}.gltf`), destino, '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', String(tamanoTextura(info.dimensions)), '--join', 'false', '--instance', 'false', '--palette', 'false', '--flatten', 'false'];
  // los modelos muy densos se simplifican (no se nota a la distancia del pasillo)
  if (info.polycount > 40000) args.push('--simplify', 'true', '--simplify-ratio', '0.35', '--simplify-error', '0.002');
  else args.push('--simplify', 'false');
  execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, { stdio: 'pipe', shell: process.platform === 'win32' });
  const [x, y, z] = info.dimensions; // mm, ejes de Blender (z arriba)
  indice.modelos[id] = {
    nombre: info.name,
    // en metros y ejes de glTF: ancho (x), alto (y), fondo (z)
    medidas: [x / 1000, z / 1000, y / 1000].map((v) => Math.round(v * 1000) / 1000),
    kb: Math.round(fs.statSync(destino).size / 1024),
  };
  return `${indice.modelos[id].kb} KB`;
}

async function procesarTextura(id) {
  const piezas = { diff: 'Diffuse', nor: 'nor_gl', arm: 'arm' };
  const destinos = Object.keys(piezas).map((k) => path.join(SALIDA, 't', `${id}_${k}.webp`));
  if (destinos.every((d) => fs.existsSync(d)) && indice.texturas[id]) return 'ya estaba';
  const archivos = await json(`${API}/files/${id}`);
  for (const [k, clave] of Object.entries(piezas)) {
    const fuente = archivos[clave]?.['1k']?.jpg ?? archivos[clave]?.['1k']?.png;
    if (!fuente) throw new Error(`${id}: falta ${clave}`);
    const crudo = path.join(CACHE, 'tex', path.basename(new URL(fuente.url).pathname));
    await bajar(fuente.url, crudo);
    await sharp(crudo).resize(1024, 1024, { fit: 'inside' }).webp({ quality: k === 'diff' ? 82 : 88 }).toFile(path.join(SALIDA, 't', `${id}_${k}.webp`));
  }
  const kb = destinos.reduce((t, d) => t + fs.statSync(d).size, 0) / 1024;
  indice.texturas[id] = { kb: Math.round(kb) };
  return `${Math.round(kb)} KB`;
}

const pedidos = process.argv.slice(2);
const modelos = pedidos.length ? todosLosModelos().filter((id) => pedidos.includes(id)) : todosLosModelos();
const texturas = pedidos.length ? todasLasTexturas().filter((id) => pedidos.includes(id)) : todasLasTexturas();

let fallas = 0;
for (const id of texturas) {
  try {
    console.log(`textura ${id}: ${await procesarTextura(id)}`);
  } catch (e) {
    fallas++;
    console.error(`textura ${id}: FALLÓ ${e.message}`);
  }
  fs.writeFileSync(indicePath, JSON.stringify(indice, null, 1));
}
for (const id of modelos) {
  try {
    console.log(`modelo ${id}: ${await procesarModelo(id)}`);
  } catch (e) {
    fallas++;
    console.error(`modelo ${id}: FALLÓ ${e.message.split('\n')[0]}`);
  }
  fs.writeFileSync(indicePath, JSON.stringify(indice, null, 1));
}
const total = Object.values(indice.modelos).reduce((t, m) => t + m.kb, 0) + Object.values(indice.texturas).reduce((t, m) => t + m.kb, 0);
console.log(`listo: ${Object.keys(indice.modelos).length} modelos, ${Object.keys(indice.texturas).length} texturas, ${(total / 1024).toFixed(1)} MB${fallas ? `, ${fallas} fallas` : ''}`);
process.exitCode = fallas ? 1 : 0;
