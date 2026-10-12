import * as THREE from 'three';
import { puntosColumna } from '@/lib/columna/geometria.js';

// La curva en S de la columna (de la cola a la punta). `getPointAt(f)` usa la misma
// fracción de largo que `llenadoDe` y que la coordenada `uv.x` del tubo.
const cache = new Map();

export function curvaColumna(n) {
  if (!cache.has(n)) {
    const puntos = puntosColumna(n, 64).map((p) => new THREE.Vector3(p.x, p.y, p.z));
    cache.set(n, new THREE.CatmullRomCurve3(puntos, false, 'centripetal'));
  }
  return cache.get(n);
}
