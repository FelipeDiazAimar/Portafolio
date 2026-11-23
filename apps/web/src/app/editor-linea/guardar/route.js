// Guarda los puntos de la línea dibujados en el modo editor (`?editarLinea`) en
// src/data/lineaPuntos.json. Sólo en desarrollo: en producción no escribe nada.
import { promises as fs } from 'node:fs';
import path from 'node:path';

const TRAMOS = ['hero', 'a', 'c'];

function valido(cuerpo) {
  if (!cuerpo || typeof cuerpo !== 'object') return false;
  return TRAMOS.every((t) =>
    Array.isArray(cuerpo[t] ?? []) &&
    (cuerpo[t] ?? []).every((p) => p && typeof p.s === 'string' && Number.isFinite(p.fx) && Number.isFinite(p.fy))
  );
}

export async function POST(pedido) {
  if (process.env.NODE_ENV !== 'development') {
    return Response.json({ ok: false, error: 'sólo en desarrollo' }, { status: 403 });
  }
  let cuerpo;
  try {
    cuerpo = await pedido.json();
  } catch {
    return Response.json({ ok: false, error: 'JSON inválido' }, { status: 400 });
  }
  if (!valido(cuerpo)) return Response.json({ ok: false, error: 'formato inválido' }, { status: 400 });
  const limpio = Object.fromEntries(TRAMOS.map((t) => [t, (cuerpo[t] ?? []).map(({ s, fx, fy }) => ({ s, fx, fy }))]));
  const destino = path.join(process.cwd(), 'src', 'data', 'lineaPuntos.json');
  await fs.writeFile(destino, `${JSON.stringify(limpio, null, 2)}\n`, 'utf8');
  return Response.json({ ok: true, destino });
}
