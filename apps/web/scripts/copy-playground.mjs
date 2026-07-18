import { existsSync, rmSync, cpSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');
const playgroundDist = path.resolve(webRoot, '../playground/dist');
const target = path.resolve(webRoot, 'public/playground');

if (!existsSync(playgroundDist)) {
  throw new Error(`No se encontró ${playgroundDist}. Corré "npm run build -w apps/playground" primero.`);
}

rmSync(target, { recursive: true, force: true });
cpSync(playgroundDist, target, { recursive: true });

console.log(`Copiado ${playgroundDist} -> ${target}`);
