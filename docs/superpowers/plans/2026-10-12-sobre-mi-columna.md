# Sobre mí: columna vertebral 3D — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la línea de tiempo horizontal de "Sobre mí" por un recorrido cinematográfico por scroll a lo largo de una columna vertebral 3D en S, brillante, con los 7 hitos y sus modelos alrededor.

**Architecture:** Un único canvas R3F (`MundoColumna`) contiene la columna, sus vértebras y las 7 escenas existentes colgadas de su "ancla". El scroll se traduce (módulo puro `recorrido.js`) en un estado continuo `s` que **mueve y gira el mundo** para que el hito actual quede en el origen mirando a la cámara: así las escenas siguen viendo la cámara en la misma pose que hoy. Durante los viajes la cámara la conduce `CamaraRecorrido`; en las estancias, el `OrbitControls` de siempre.

**Tech Stack:** Next.js 15 (App Router, webpack), React 19 (JSX, sin TypeScript), CSS Modules, framer-motion 12, three 0.186, @react-three/fiber 9.8, @react-three/drei 10.7, @react-three/postprocessing 3.1.1, `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-12-sobre-mi-columna-design.md` (leerla entera antes de empezar).

## Global Constraints

- Rama: `feature/sobre-mi-columna` (ya existe: es `main` = 70de461, que ya incluye la spec y la sección Proyectos, más el commit de este plan). **Nunca** trabajar en `C:\Users\Asus\Desktop\Trabajo\PORTAFOLIO` directamente: ahí puede haber trabajo sin commitear de otro agente o del usuario. Se trabaja en un worktree aparte (Task 1, Step 1).
- No hacer `git push`. No mergear. No tocar `apps/web/src/data/hitos.json`, `proyectos.json`, `globals.css`, `packages/config/tokens/tokens.css` ni nada de la sección Proyectos.
- Idioma del código: nombres, comentarios y textos en **español**, con el estilo de los archivos vecinos (comentarios que explican el porqué, `const` en camelCase español, componentes en PascalCase español).
- Dependencias nuevas, versiones exactas: `@react-three/postprocessing@3.1.1`, `postprocessing@6.39.4`. Ninguna otra.
- Constantes de geometría: `SEPARACION 9`, `RADIO_ANCLA 3.5`, `PASO_ANGULO 140°`, `AMPLITUD_S 1.4`, `RADIO_TUBO 0.06`, `RADIO_HALO 0.2`.
- Recorrido: `PESO_ESTANCIA 1`, `PESO_VIAJE 1.4`, `UMBRAL_IMAN 0.35`, alto del contenedor `calc(100svh + W·55svh)` (escritorio) / `45svh` (≤768 px), con `W = N + 1.4·(N-1)`.
- Cámara: `FOV_BASE 38`; escritorio `alabeoMax 12°`, `fovMax 55`, `distanciaPrimera 1.4`; celular `alabeoMax 0`, `fovMax 46`, `distanciaPrimera 2.2`.
- Spring del scroll: `stiffness 120, damping 30, mass 0.6`. Imán: 160 ms. Llegada: 400 ms.
- Lados: hito de índice par → modelo a la izquierda (`setViewOffset` +0.22·ancho) y texto a la derecha; impar → al revés; celular → modelo arriba (+0.2·alto) y texto abajo.
- Tests: `node --test <archivos>` (no hay script `test`; los `.js` usan ESM y Node 24 lo detecta solo). Build: `npm run build -w apps/web` desde la raíz del worktree.

## Review Focus

1. **Recargar la página con el scroll a mitad de la sección** (o volver con "atrás"): la cámara, el mundo, el hito activo y los textos deben quedar coherentes con ese progreso sin necesidad de mover el scroll. → Task 5 (efecto "Estado inicial" en `SobreMi.jsx`) y Task 8, Step 4, caso 1.
2. **Saltar varios hitos de golpe con el minimapa** (p. ej. de 2022 a Hoy): el imán no debe "pelear" con el `scrollTo` suave, y al terminar debe quedar en la estancia pedida con su escena real montada (no la silueta). → Verificación en Task 8 (paso "salto con minimapa").
3. **Pasar por el grafo de Hoy y volver**: el grafo toma los controles de la cámara; al empezar un viaje tiene que soltarlos y no debe seguir escuchando la rueda/punteros desde otros hitos (sus listeners están en `window`). → Task 3 (cambios en `Grafo.jsx`) y Task 8.
4. **Tema claro**: la columna, el fondo de viaje, la niebla y el bloom deben leerse sobre fondo claro (sin "lavado" blanco). → Task 7 y Task 8 (capturas en tema claro).
5. **Celular / táctil**: arrastrar horizontalmente gira el modelo, arrastrar verticalmente scrollea la página; el imán no salta mientras hay un dedo apoyado; la hoja de texto inferior no tapa el modelo. → Task 5 (imán con `touches`) y Task 8 (viewport 390×844).

---

### Task 1: Worktree, dependencias y geometría pura

**Files:**
- Create: `apps/web/src/lib/columna/geometria.js`
- Test: `apps/web/src/lib/columna/geometria.test.js`
- Modify: `apps/web/package.json`, `package-lock.json` (dependencias)

**Interfaces:**
- Produces (usado por Tasks 2, 4, 5, 6, 7): `SEPARACION`, `RADIO_ANCLA`, `PASO_ANGULO`, `AMPLITUD_S`, `RADIO_TUBO`, `RADIO_HALO`, `EXTRA`, `PUNTOS_POR_TRAMO`; `altoTotal(n)`, `ejeEn(y, n) → {x,y,z}`, `vertebra(i, n) → {centro:{x,y,z}, angulo}`, `ancla(i, n) → {posicion:{x,y,z}, angulo}`, `puntosColumna(n, cantidad=64) → {x,y,z}[]`, `fraccionEnAltura(y, n)`, `longitudHasta(i, n)`, `puntoEnFraccion(f, n) → {x,y,z}`, `aPantalla(punto, s, n) → {x,y,z}`, `transformacionMundo(s, n) → {pivote:[x,y,z], rotacionY, contenido:[x,y,z]}`, `puntosMinimapa(n, {ancho, alto, margen=10}) → {camino:{x,y}[], hitos:{x,y}[]}`.

- [ ] **Step 1: Crear el worktree e instalar**

```bash
cd /c/Users/Asus/Desktop/Trabajo/PORTAFOLIO
git worktree add ../PORTAFOLIO-columna feature/sobre-mi-columna
cd ../PORTAFOLIO-columna
npm install
npm install -w apps/web --save-exact @react-three/postprocessing@3.1.1 postprocessing@6.39.4
git log --oneline -2
```

Expected: el log muestra `docs: plan de implementación de la columna vertebral de Sobre mí` arriba de `70de461`. `apps/web/package.json` tiene `"@react-three/postprocessing": "3.1.1"` y `"postprocessing": "6.39.4"`.
**Todos los pasos siguientes de este plan se ejecutan dentro de `C:\Users\Asus\Desktop\Trabajo\PORTAFOLIO-columna`.**

- [ ] **Step 2: Escribir el test (falla)**

Crear `apps/web/src/lib/columna/geometria.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AMPLITUD_S,
  PASO_ANGULO,
  PUNTOS_POR_TRAMO,
  RADIO_ANCLA,
  SEPARACION,
  ancla,
  aPantalla,
  ejeEn,
  fraccionEnAltura,
  longitudHasta,
  puntoEnFraccion,
  puntosColumna,
  puntosMinimapa,
  transformacionMundo,
  vertebra,
} from './geometria.js';

const N = 7;
const cerca = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

test('vertebra: una cada SEPARACION de altura y PASO_ANGULO de giro', () => {
  for (let i = 0; i < N; i += 1) {
    const v = vertebra(i, N);
    assert.ok(cerca(v.centro.y, i * SEPARACION));
    assert.ok(cerca(v.angulo, i * PASO_ANGULO));
  }
});

test('ancla: a RADIO_ANCLA del eje, en el plano horizontal de su vértebra', () => {
  for (let i = 0; i < N; i += 1) {
    const { centro } = vertebra(i, N);
    const { posicion } = ancla(i, N);
    assert.ok(cerca(Math.hypot(posicion.x - centro.x, posicion.z - centro.z), RADIO_ANCLA));
    assert.ok(cerca(posicion.y, centro.y));
  }
});

test('ejeEn: la S nunca se aleja más que AMPLITUD_S y es continua', () => {
  let previo = ejeEn(-SEPARACION, N);
  for (let y = -SEPARACION; y <= SEPARACION * N; y += 0.05) {
    const p = ejeEn(y, N);
    assert.ok(Math.abs(p.x) <= AMPLITUD_S + 1e-9);
    assert.ok(Math.hypot(p.x - previo.x, p.z - previo.z) < 0.05);
    previo = p;
  }
});

test('longitudHasta: crece con el índice y deja cola y punta', () => {
  assert.ok(longitudHasta(0, N) > 0);
  assert.ok(longitudHasta(N - 1, N) < 1);
  for (let i = 1; i < N; i += 1) assert.ok(longitudHasta(i, N) > longitudHasta(i - 1, N));
});

test('puntoEnFraccion es la inversa de fraccionEnAltura', () => {
  for (const y of [-5, 0, 4.5, 13, 30, 54, 60]) {
    const p = puntoEnFraccion(fraccionEnAltura(y, N), N);
    assert.ok(cerca(p.y, y, 1e-3), 'y=' + y + ' → ' + p.y);
  }
});

test('aPantalla: en el estado entero i el ancla i queda en el origen y su vértebra detrás', () => {
  for (let i = 0; i < N; i += 1) {
    const p = aPantalla(ancla(i, N).posicion, i, N);
    assert.ok(cerca(p.x, 0) && cerca(p.y, 0) && cerca(p.z, 0), JSON.stringify(p));
    const v = aPantalla(vertebra(i, N).centro, i, N);
    assert.ok(cerca(v.x, 0) && cerca(v.y, 0) && cerca(v.z, -RADIO_ANCLA));
  }
});

test('transformacionMundo coincide con aPantalla (rotación de three sobre y)', () => {
  const s = 2.4;
  const { pivote, rotacionY, contenido } = transformacionMundo(s, N);
  const q = ancla(3, N).posicion;
  const x = q.x + contenido[0];
  const z = q.z + contenido[2];
  // Object3D.rotation.y = a: x' = x·cos a + z·sin a ; z' = −x·sin a + z·cos a
  const cos = Math.cos(rotacionY);
  const sin = Math.sin(rotacionY);
  const esperado = aPantalla(q, s, N);
  assert.ok(cerca(x * cos + z * sin + pivote[0], esperado.x));
  assert.ok(cerca(-x * sin + z * cos + pivote[2], esperado.z));
  assert.ok(cerca(q.y + contenido[1] + pivote[1], esperado.y));
});

test('puntosColumna: de la cola a la punta, en orden', () => {
  const pts = puntosColumna(N, 64);
  assert.equal(pts.length, 64);
  assert.ok(cerca(pts[0].y, -SEPARACION));
  assert.ok(cerca(pts[63].y, SEPARACION * N));
});

test('puntosMinimapa: todo dentro del recuadro y los hitos de abajo hacia arriba', () => {
  const { camino, hitos } = puntosMinimapa(N, { ancho: 28, alto: 220 });
  assert.equal(hitos.length, N);
  assert.ok(camino.length > 10);
  [...camino, ...hitos].forEach((p) => assert.ok(p.x >= 0 && p.x <= 28 && p.y >= 0 && p.y <= 220));
  for (let i = 1; i < N; i += 1) assert.ok(hitos[i].y < hitos[i - 1].y);
  for (let i = 0; i < N; i += 1) {
    assert.ok(cerca(camino[i * PUNTOS_POR_TRAMO].x, hitos[i].x) && cerca(camino[i * PUNTOS_POR_TRAMO].y, hitos[i].y));
  }
});
```

- [ ] **Step 3: Correrlo y ver que falla**

Run: `node --test apps/web/src/lib/columna/geometria.test.js`
Expected: FAIL — `Cannot find module '.../geometria.js'`.

- [ ] **Step 4: Implementar**

Crear `apps/web/src/lib/columna/geometria.js`:

```js
// Geometría de la columna vertebral de "Sobre mí" (unidades de escena). Funciones
// puras, sin three: las usan el mundo 3D, la cámara y el minimapa.

export const SEPARACION = 9;
export const RADIO_ANCLA = 3.5;
export const PASO_ANGULO = (140 * Math.PI) / 180;
export const AMPLITUD_S = 1.4;
export const RADIO_TUBO = 0.06;
export const RADIO_HALO = 0.2;
// La columna sigue un tramo antes del primer hito (cola) y otro después del último (punta).
export const EXTRA = SEPARACION;

// Alto entre la primera y la última vértebra.
export function altoTotal(n) {
  return SEPARACION * Math.max(n - 1, 1);
}

// Punto del eje de la columna a la altura `y`: una S suave en el espacio (no plana).
export function ejeEn(y, n) {
  const alto = altoTotal(n);
  return {
    x: AMPLITUD_S * Math.sin((2 * Math.PI * y) / alto),
    y,
    z: AMPLITUD_S * 0.5 * Math.sin((Math.PI * y) / alto),
  };
}

export function vertebra(i, n) {
  return { centro: ejeEn(i * SEPARACION, n), angulo: i * PASO_ANGULO };
}

// Dónde va el modelo del hito `i`: a RADIO_ANCLA del eje, en su ángulo. El modelo se
// rota `angulo` en y, así su +z local apunta hacia afuera de la columna.
export function ancla(i, n) {
  const { centro, angulo } = vertebra(i, n);
  return {
    posicion: { x: centro.x + RADIO_ANCLA * Math.sin(angulo), y: centro.y, z: centro.z + RADIO_ANCLA * Math.cos(angulo) },
    angulo,
  };
}

// Puntos para construir la curva (de la cola a la punta).
export function puntosColumna(n, cantidad = 64) {
  const desde = -EXTRA;
  const hasta = altoTotal(n) + EXTRA;
  return Array.from({ length: cantidad }, (_, k) => ejeEn(desde + ((hasta - desde) * k) / (cantidad - 1), n));
}

// Largo acumulado del eje, muestreado fino, para pasar de altura a fracción del largo
// (la misma parametrización que usa TubeGeometry: `getPointAt`).
const MUESTRAS = 2048;
const tablas = new Map();
function tabla(n) {
  if (tablas.has(n)) return tablas.get(n);
  const desde = -EXTRA;
  const hasta = altoTotal(n) + EXTRA;
  const ys = [];
  const acumulado = [0];
  let previo = ejeEn(desde, n);
  ys.push(desde);
  for (let k = 1; k <= MUESTRAS; k += 1) {
    const y = desde + ((hasta - desde) * k) / MUESTRAS;
    const p = ejeEn(y, n);
    acumulado.push(acumulado[k - 1] + Math.hypot(p.x - previo.x, p.y - previo.y, p.z - previo.z));
    ys.push(y);
    previo = p;
  }
  const t = { ys, acumulado, total: acumulado[MUESTRAS] };
  tablas.set(n, t);
  return t;
}

// Fracción [0,1] del largo de la columna hasta la altura `y`.
export function fraccionEnAltura(y, n) {
  const { ys, acumulado, total } = tabla(n);
  const paso = ys[1] - ys[0];
  const k = Math.min(MUESTRAS - 1, Math.max(0, Math.floor((y - ys[0]) / paso)));
  const resto = Math.min(1, Math.max(0, (y - ys[k]) / paso));
  return (acumulado[k] + (acumulado[k + 1] - acumulado[k]) * resto) / total;
}

// Fracción del largo a la altura de la vértebra `i`.
export function longitudHasta(i, n) {
  return fraccionEnAltura(i * SEPARACION, n);
}

// Punto del eje en la fracción `f` del largo (inversa de fraccionEnAltura).
export function puntoEnFraccion(f, n) {
  const { ys, acumulado, total } = tabla(n);
  const objetivo = Math.min(1, Math.max(0, f)) * total;
  let bajo = 0;
  let alto = MUESTRAS;
  while (alto - bajo > 1) {
    const medio = (bajo + alto) >> 1;
    if (acumulado[medio] <= objetivo) bajo = medio;
    else alto = medio;
  }
  const tramo = acumulado[alto] - acumulado[bajo] || 1;
  const y = ys[bajo] + ((ys[alto] - ys[bajo]) * (objetivo - acumulado[bajo])) / tramo;
  return ejeEn(y, n);
}

// Lleva un punto del mundo de la columna a coordenadas de pantalla canónicas para el
// estado `s` (índice de hito fraccionario): el ancla del hito `s` queda en el origen
// mirando a +z. Mundo = T(0,0,-R) · Ry(-θ) · T(-c).
export function aPantalla(punto, s, n) {
  const c = ejeEn(s * SEPARACION, n);
  const theta = s * PASO_ANGULO;
  const x = punto.x - c.x;
  const y = punto.y - c.y;
  const z = punto.z - c.z;
  const cos = Math.cos(-theta);
  const sin = Math.sin(-theta);
  return { x: x * cos + z * sin, y, z: -x * sin + z * cos - RADIO_ANCLA };
}

// Lo que necesitan los grupos del mundo 3D para el estado `s`.
export function transformacionMundo(s, n) {
  const c = ejeEn(s * SEPARACION, n);
  return { pivote: [0, 0, -RADIO_ANCLA], rotacionY: -s * PASO_ANGULO, contenido: [-c.x, -c.y, -c.z] };
}

// Minimapa: la S proyectada en 2D (x lateral, y hacia arriba = hitos más nuevos).
// Devuelve el camino de la columna y la posición de cada hito en píxeles. El camino tiene
// PUNTOS_POR_TRAMO puntos entre dos hitos: el hito i es exactamente camino[i * PUNTOS_POR_TRAMO].
export const PUNTOS_POR_TRAMO = 8;
export function puntosMinimapa(n, { ancho, alto, margen = 10 }) {
  const desde = 0;
  const hasta = altoTotal(n);
  const aPx = (p) => ({
    x: ancho / 2 + (p.x / AMPLITUD_S) * (ancho / 2 - margen / 2),
    y: alto - margen - ((p.y - desde) / (hasta - desde)) * (alto - 2 * margen),
  });
  const cantidad = Math.max(n - 1, 1) * PUNTOS_POR_TRAMO + 1;
  const camino = Array.from({ length: cantidad }, (_, k) => aPx(ejeEn(desde + ((hasta - desde) * k) / (cantidad - 1), n)));
  const hitos = Array.from({ length: n }, (_, i) => aPx(vertebra(i, n).centro));
  return { camino, hitos };
}
```

- [ ] **Step 5: Correr y ver que pasa**

Run: `node --test apps/web/src/lib/columna/geometria.test.js`
Expected: `ℹ pass 9`, `ℹ fail 0`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json package-lock.json apps/web/src/lib/columna/geometria.js apps/web/src/lib/columna/geometria.test.js
git commit -m "feat(web): geometría de la columna vertebral de Sobre mí

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Recorrido puro (scroll → tramo → pose)

**Files:**
- Create: `apps/web/src/lib/columna/recorrido.js`
- Test: `apps/web/src/lib/columna/recorrido.test.js`

**Interfaces:**
- Consumes: `RADIO_ANCLA`, `aPantalla`, `longitudHasta`, `puntoEnFraccion` (Task 1).
- Produces: `PESO_ESTANCIA`, `PESO_VIAJE`, `UMBRAL_IMAN`, `FOV_BASE`, `OPCIONES_ESCRITORIO`, `OPCIONES_MOVIL`; `suavizado(t)`, `pesoTotal(n)`, `tramoDe(p, n) → {tipo:'estancia'|'viaje', indice, t}`, `giroDe(t)`, `estadoDe(tramo, {reducido}) → s`, `activoDe(tramo) → índice`, `llenadoDe(tramo, n) → [0,1]`, `progresoDeEstancia(i, n) → p`, `imanDe(p, n) → p | null`, `poseCanonica(d)`, `poseCamara(tramo, d, n, opciones) → {posicion:[x,y,z], mira:[x,y,z], fov, giroZ}`, `anioEnViaje(desde, hasta, t) → string`, `opacidadAnio(t) → [0,1]`.

- [ ] **Step 1: Escribir el test (falla)**

Crear `apps/web/src/lib/columna/recorrido.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { longitudHasta } from './geometria.js';
import {
  OPCIONES_ESCRITORIO,
  OPCIONES_MOVIL,
  PESO_ESTANCIA,
  PESO_VIAJE,
  UMBRAL_IMAN,
  activoDe,
  anioEnViaje,
  estadoDe,
  imanDe,
  llenadoDe,
  opacidadAnio,
  pesoTotal,
  poseCamara,
  poseCanonica,
  progresoDeEstancia,
  tramoDe,
} from './recorrido.js';

const N = 7;
const D = 6;
const W = pesoTotal(N);
// p del avance `t` dentro del viaje `i`
const pViaje = (i, t) => (i * (PESO_ESTANCIA + PESO_VIAJE) + PESO_ESTANCIA + t * PESO_VIAJE) / W;

test('pesoTotal: 7 estancias y 6 viajes', () => {
  assert.ok(Math.abs(W - (7 + 6 * 1.4)) < 1e-9);
});

test('tramoDe: extremos, rango y valores inválidos', () => {
  assert.deepEqual(tramoDe(0, N), { tipo: 'estancia', indice: 0, t: 0 });
  assert.equal(tramoDe(1, N).tipo, 'estancia');
  assert.equal(tramoDe(1, N).indice, N - 1);
  assert.deepEqual(tramoDe(-0.3, N), tramoDe(0, N));
  assert.deepEqual(tramoDe(1.7, N), tramoDe(1, N));
  assert.deepEqual(tramoDe(Number.NaN, N), tramoDe(0, N));
  assert.equal(tramoDe(0.5, 1).indice, 0);
});

test('tramoDe: reconoce viajes y su avance', () => {
  const tramo = tramoDe(pViaje(2, 0.25), N);
  assert.equal(tramo.tipo, 'viaje');
  assert.equal(tramo.indice, 2);
  assert.ok(Math.abs(tramo.t - 0.25) < 1e-9);
});

test('progresoDeEstancia: cae en el medio de su propia estancia', () => {
  for (let i = 0; i < N; i += 1) {
    const tramo = tramoDe(progresoDeEstancia(i, N), N);
    assert.equal(tramo.tipo, 'estancia');
    assert.equal(tramo.indice, i);
    assert.ok(Math.abs(tramo.t - 0.5) < 1e-9);
  }
});

test('estadoDe: entero en las estancias y monótono', () => {
  let previo = -Infinity;
  for (let k = 0; k <= 2000; k += 1) {
    const tramo = tramoDe(k / 2000, N);
    const s = estadoDe(tramo);
    if (tramo.tipo === 'estancia') assert.equal(s, tramo.indice);
    assert.ok(s >= previo - 1e-12);
    previo = s;
  }
});

test('estadoDe con movimiento reducido salta en la mitad del viaje', () => {
  assert.equal(estadoDe({ tipo: 'viaje', indice: 3, t: 0.49 }, { reducido: true }), 3);
  assert.equal(estadoDe({ tipo: 'viaje', indice: 3, t: 0.5 }, { reducido: true }), 4);
});

test('activoDe cambia en la mitad del viaje', () => {
  assert.equal(activoDe({ tipo: 'viaje', indice: 1, t: 0.49 }), 1);
  assert.equal(activoDe({ tipo: 'viaje', indice: 1, t: 0.5 }), 2);
  assert.equal(activoDe({ tipo: 'estancia', indice: 4, t: 0.1 }), 4);
});

test('llenadoDe: monótono y exacto en cada estancia', () => {
  let previo = -Infinity;
  for (let k = 0; k <= 2000; k += 1) {
    const tramo = tramoDe(k / 2000, N);
    const f = llenadoDe(tramo, N);
    if (tramo.tipo === 'estancia') assert.ok(Math.abs(f - longitudHasta(tramo.indice, N)) < 1e-12);
    assert.ok(f >= previo - 1e-12);
    previo = f;
  }
});

test('imanDe: nada en estancias; en viajes decide por el umbral', () => {
  assert.equal(imanDe(progresoDeEstancia(3, N), N), null);
  assert.equal(imanDe(pViaje(2, UMBRAL_IMAN + 0.01), N), progresoDeEstancia(3, N));
  assert.equal(imanDe(pViaje(2, UMBRAL_IMAN - 0.01), N), progresoDeEstancia(2, N));
});

test('poseCamara: canónica en las estancias', () => {
  assert.deepEqual(poseCamara(tramoDe(progresoDeEstancia(2, N), N), D, N), poseCanonica(D));
});

for (const [nombre, opciones] of [
  ['escritorio', OPCIONES_ESCRITORIO],
  ['celular', OPCIONES_MOVIL],
]) {
  test('poseCamara (' + nombre + '): continua en todo el recorrido y dentro de los límites', () => {
    let previa = poseCamara(tramoDe(0, N), D, N, opciones);
    for (let k = 1; k <= 4000; k += 1) {
      const p = k / 4000;
      const pose = poseCamara(tramoDe(p, N), D, N, opciones);
      const salto = Math.hypot(...pose.posicion.map((v, j) => v - previa.posicion[j]));
      const saltoMira = Math.hypot(...pose.mira.map((v, j) => v - previa.mira[j]));
      assert.ok(salto < 0.6, 'la posición salta ' + salto + ' en p=' + p);
      assert.ok(saltoMira < 1.2, 'la mira salta ' + saltoMira + ' en p=' + p);
      assert.ok(Math.abs(pose.fov - previa.fov) < 1.5, 'el fov salta en p=' + p);
      assert.ok(Math.abs(pose.giroZ) <= opciones.alabeoMax + 1e-12);
      assert.ok(pose.fov >= 38 - 1e-9 && pose.fov <= opciones.fovMax + 1e-9);
      previa = pose;
    }
  });
}

test('anioEnViaje: cuenta entre años y cambia en la mitad con textos', () => {
  assert.equal(anioEnViaje('2022', '2023', 0), '2022');
  assert.equal(anioEnViaje('2022', '2026', 0.5), '2024');
  assert.equal(anioEnViaje('2022', '2023', 1), '2023');
  assert.equal(anioEnViaje('Origen', '2022', 0.49), 'Origen');
  assert.equal(anioEnViaje('Origen', '2022', 0.5), '2022');
  assert.equal(anioEnViaje('2026', 'Hoy', 0.7), 'Hoy');
});

test('opacidadAnio: invisible en los extremos, plena en el medio', () => {
  assert.equal(opacidadAnio(0), 0);
  assert.equal(opacidadAnio(0.5), 1);
  assert.equal(opacidadAnio(1), 0);
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `node --test apps/web/src/lib/columna/recorrido.test.js`
Expected: FAIL — `Cannot find module '.../recorrido.js'`.

- [ ] **Step 3: Implementar**

Crear `apps/web/src/lib/columna/recorrido.js`:

```js
// Scroll → recorrido por la columna. El progreso de la sección [0,1] se reparte en
// estancias (quieto en un hito) y viajes (de un hito al siguiente) alternados:
// E0 V0 E1 V1 … E(n-1). Funciones puras: las usan la sección, la cámara y los tests.
import { RADIO_ANCLA, aPantalla, longitudHasta, puntoEnFraccion } from './geometria.js';

export const PESO_ESTANCIA = 1;
export const PESO_VIAJE = 1.4;
// Desde qué avance de un viaje el imán lleva al hito siguiente (antes, al anterior).
export const UMBRAL_IMAN = 0.35;

const acotar = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const mezclar = (a, b, t) => a + (b - a) * t;
const mezclar3 = (a, b, t) => [mezclar(a[0], b[0], t), mezclar(a[1], b[1], t), mezclar(a[2], b[2], t)];
// smootherstep: arranca y frena sin tirones (primera y segunda derivada nulas en los bordes).
export function suavizado(t) {
  const x = acotar(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

export function pesoTotal(n) {
  return n * PESO_ESTANCIA + Math.max(n - 1, 0) * PESO_VIAJE;
}

// { tipo: 'estancia'|'viaje', indice, t }. En un viaje, `indice` es el hito de abajo
// (el de menor índice) y `t` el avance hacia el siguiente.
export function tramoDe(p, n) {
  if (n <= 1) return { tipo: 'estancia', indice: 0, t: Number.isFinite(p) ? acotar(p) : 0 };
  let x = (Number.isFinite(p) ? acotar(p) : 0) * pesoTotal(n);
  for (let i = 0; i < n; i += 1) {
    if (x < PESO_ESTANCIA || i === n - 1) return { tipo: 'estancia', indice: i, t: acotar(x / PESO_ESTANCIA) };
    x -= PESO_ESTANCIA;
    if (x < PESO_VIAJE) return { tipo: 'viaje', indice: i, t: x / PESO_VIAJE };
    x -= PESO_VIAJE;
  }
  return { tipo: 'estancia', indice: n - 1, t: 1 };
}

// Cuánto giró/avanzó la columna dentro de un viaje: casi nada en el despegue y todo
// entre el medio y la llegada.
export function giroDe(t) {
  return suavizado((t - 0.15) / 0.75);
}

// Estado continuo `s` (índice de hito fraccionario) que ubica al mundo.
export function estadoDe(tramo, { reducido = false } = {}) {
  if (tramo.tipo === 'estancia') return tramo.indice;
  if (reducido) return tramo.indice + (tramo.t < 0.5 ? 0 : 1);
  return tramo.indice + giroDe(tramo.t);
}

// Hito cuyo contenido (escena, fondo, textos) manda.
export function activoDe(tramo) {
  if (tramo.tipo === 'estancia') return tramo.indice;
  return tramo.t < 0.5 ? tramo.indice : tramo.indice + 1;
}

// Fracción encendida de la columna.
export function llenadoDe(tramo, n) {
  const desde = longitudHasta(tramo.indice, n);
  if (tramo.tipo === 'estancia') return desde;
  return mezclar(desde, longitudHasta(tramo.indice + 1, n), tramo.t);
}

export function progresoDeEstancia(i, n) {
  return (i * (PESO_ESTANCIA + PESO_VIAJE) + PESO_ESTANCIA / 2) / pesoTotal(n);
}

// Adónde llevar el scroll cuando el usuario lo suelta: sólo actúa en un viaje (las
// estancias son zonas de descanso). Devuelve null si no hay que mover nada.
export function imanDe(p, n) {
  const tramo = tramoDe(p, n);
  if (tramo.tipo === 'estancia') return null;
  return progresoDeEstancia(tramo.t >= UMBRAL_IMAN ? tramo.indice + 1 : tramo.indice, n);
}

// Pose de la cámara (en coordenadas de pantalla canónicas: el mundo ya está
// transformado por estadoDe). `d` = distancia de la pose canónica (vistaParaAltura).
export const FOV_BASE = 38;
export const OPCIONES_ESCRITORIO = { alabeoMax: (12 * Math.PI) / 180, fovMax: 55, distanciaPrimera: 1.4 };
export const OPCIONES_MOVIL = { alabeoMax: 0, fovMax: 46, distanciaPrimera: 2.2 };

export function poseCanonica(d) {
  return { posicion: [0, d * 0.116, d * 0.993], mira: [0, 0, 0], fov: FOV_BASE, giroZ: 0 };
}

function poseAlejada(d) {
  return { posicion: [0, d * 0.116 + 3, d * 1.6], mira: [0, 1.5, -RADIO_ANCLA], fov: FOV_BASE, giroZ: 0 };
}

// En primera persona: pegada a la columna, un poco por detrás de la cabeza de luz y
// mirando hacia adelante por la curva.
function posePrimera(tramo, n, opciones) {
  const s = estadoDe(tramo);
  const f = llenadoDe(tramo, n);
  const cabeza = aPantalla(puntoEnFraccion(f, n), s, n);
  const adelante = aPantalla(puntoEnFraccion(f + 0.02, n), s, n);
  let tx = adelante.x - cabeza.x;
  let ty = adelante.y - cabeza.y;
  let tz = adelante.z - cabeza.z;
  const largo = Math.hypot(tx, ty, tz) || 1;
  tx /= largo;
  ty /= largo;
  tz /= largo;
  const dp = opciones.distanciaPrimera;
  const posicion = [cabeza.x - tx * 2 + 0, cabeza.y - ty * 2 + dp * 0.35, cabeza.z - tz * 2 + dp];
  const mira = [cabeza.x + tx * 6, cabeza.y + ty * 6, cabeza.z + tz * 6];
  const giroZ = acotar(-tx * 0.8, -opciones.alabeoMax, opciones.alabeoMax);
  const fov = mezclar(FOV_BASE, opciones.fovMax, suavizado((tramo.t - 0.2) / 0.3) * (1 - suavizado((tramo.t - 0.65) / 0.25)));
  return { posicion, mira, fov, giroZ };
}

function mezclarPose(a, b, t) {
  return {
    posicion: mezclar3(a.posicion, b.posicion, t),
    mira: mezclar3(a.mira, b.mira, t),
    fov: mezclar(a.fov, b.fov, t),
    giroZ: mezclar(a.giroZ, b.giroZ, t),
  };
}

export function poseCamara(tramo, d, n, opciones = OPCIONES_ESCRITORIO) {
  const canonica = poseCanonica(d);
  if (tramo.tipo === 'estancia') return canonica;
  const t = tramo.t;
  const primera = posePrimera(tramo, n, opciones);
  // Despegue: se aleja (0 → 0.2). Entrada en primera persona (0.2 → 0.35).
  if (t < 0.2) return mezclarPose(canonica, poseAlejada(d), suavizado(t / 0.2));
  if (t < 0.35) return mezclarPose(poseAlejada(d), primera, suavizado((t - 0.2) / 0.15));
  if (t < 0.8) return primera;
  // Llegada: de la primera persona a la pose canónica del hito siguiente.
  return mezclarPose(primera, canonica, suavizado((t - 0.8) / 0.2));
}

// Año que se muestra durante el viaje: cuenta del origen al destino si los dos son
// números; si no ("Origen", "Hoy"), cambia en la mitad.
export function anioEnViaje(desde, hasta, t) {
  const a = Number(desde);
  const b = Number(hasta);
  if (Number.isInteger(a) && Number.isInteger(b) && String(desde).trim() !== '' && String(hasta).trim() !== '') {
    return String(Math.round(mezclar(a, b, acotar((t - 0.2) / 0.6))));
  }
  return t < 0.5 ? String(desde) : String(hasta);
}

export function opacidadAnio(t) {
  return Math.min(acotar((t - 0.1) / 0.15), 1 - acotar((t - 0.75) / 0.15));
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `node --test apps/web/src/lib/columna/recorrido.test.js apps/web/src/lib/columna/geometria.test.js`
Expected: `ℹ pass 23`, `ℹ fail 0`. Si el test de continuidad falla, **no** aflojar los umbrales: revisar que las uniones de `poseCamara` (0.2, 0.35, 0.8) mezclen hacia la pose que sigue.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/columna/recorrido.js apps/web/src/lib/columna/recorrido.test.js
git commit -m "feat(web): recorrido por scroll de la columna (tramos, estado, imán y cámara)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Ajustes a piezas existentes para vivir en un mundo compartido

Las escenas dejan de tener su propio canvas: tres de ellas pueden estar montadas a la vez (activo ± 1), la cámara se mueve durante los viajes y sólo el hito activo puede escuchar al usuario.

**Files:**
- Modify: `apps/web/src/components/SobreMi/Escena3D/EscalaResponsiva.jsx` (reemplazo completo)
- Modify: `apps/web/src/components/SobreMi/Escena3D/ControlGiro.jsx` (dos guardas)
- Modify: `apps/web/src/components/SobreMi/Escena3D/escenas/Escena1Bandera.jsx` (guardas por `activa`)
- Modify: `apps/web/src/components/SobreMi/Escena3D/escenas/hoy/Grafo.jsx` (prop `activa`)
- Modify: `apps/web/src/components/SobreMi/Escena3D/escenas/Escena6Constelacion.jsx:324`
- Modify: `apps/web/src/components/SobreMi/FondoHito.jsx` y `FondoHito.module.css`
- Modify: `apps/web/src/components/SobreMi/DescripcionHito.module.css`

**Interfaces:**
- Produces: `EscalaResponsiva({ ancho = 4.2, fraccion = 1, children })`; `Grafo({ tiempo, claro, activa = true })`; `FondoHito({ hitos, activo, presente = true })`; `ControlGiro` no toca la cámara cuando `controls.enabled === false`.

- [ ] **Step 1: `EscalaResponsiva` con la pose canónica**

Reemplazar todo `EscalaResponsiva.jsx` por:

```jsx
'use client';

import { useThree } from '@react-three/fiber';
import { vistaParaAltura } from './vista.js';

// Achica la escena cuando no entra a lo ancho (celular, o la mitad de pantalla que le
// toca al modelo en escritorio). `ancho` es el ancho, en unidades de escena, que necesita
// el modelo más ancho de la serie; `fraccion` es la parte del ancho del canvas que le
// corresponde. El ancho visible se calcula con la cámara en su pose canónica (y no con
// la cámara actual): durante el viaje la cámara se mueve y el modelo no debe cambiar
// de tamaño.
export default function EscalaResponsiva({ ancho = 4.2, fraccion = 1, children }) {
  const size = useThree((estado) => estado.size);
  const { mitadAlto } = vistaParaAltura(size.height);
  const visible = 2 * mitadAlto * (size.width / Math.max(size.height, 1)) * fraccion;
  const escala = Math.min(1, visible / ancho);
  return <group scale={escala}>{children}</group>;
}
```

- [ ] **Step 2: `ControlGiro` quieto mientras está apagado**

En `ControlGiro.jsx`, en el efecto que vuelve la cámara al frente, reemplazar:

```jsx
    const controles = refControles.current;
    if (!controles) return;
    const distancia = camera.position.length();
```

por:

```jsx
    const controles = refControles.current;
    // Apagado = la cámara la maneja el recorrido de la columna: no se la toca.
    if (!controles || !controles.enabled) return;
    const distancia = camera.position.length();
```

Y en el `useFrame`, reemplazar:

```jsx
    if (controles?.giroLibre) return;
```

por:

```jsx
    if (controles?.giroLibre) return;
    // `setAzimuthalAngle` mueve la cámara: no mientras viaja por la columna.
    if (controles && !controles.enabled) return;
```

- [ ] **Step 3: La bandera sólo escucha cuando es el hito activo**

En `Escena1Bandera.jsx`, justo después de `const camera = useThree((estado) => estado.camera);` (línea ~158) agregar:

```jsx
  // Puede estar montada como vecina del hito activo: entonces no responde al puntero.
  const refActiva = useRef(activa);
  refActiva.current = activa;
```

Y como **primera línea** del cuerpo de `const alMover = (evento) => {` (línea ~206) y de `const alApretar = (evento) => {` agregar:

```jsx
      if (!refActiva.current) return;
```

- [ ] **Step 4: El grafo suelta la cámara y deja de escuchar cuando no es el activo**

En `Grafo.jsx`:

1. Firma: `export default function Grafo({ tiempo, claro, activa = true }) {` y, justo debajo de `refControles.current = controles;`, agregar:

```jsx
  // Montado como vecino (o durante un viaje) el grafo no toma la cámara ni escucha al usuario.
  const refActiva = useRef(activa);
  refActiva.current = activa;
```

2. Como **primera línea** del cuerpo de cada uno de estos handlers del efecto de listeners: `alBajar` (línea ~361), `alMover` (~396), `alRodar` (~482), `alDobleClick` (~490) y `alTeclear` (~496), agregar:

```jsx
      if (!refActiva.current) return;
```

Y reemplazar `const sinGesto = (evento) => evento.preventDefault();` por:

```jsx
    const sinGesto = (evento) => {
      if (refActiva.current) evento.preventDefault();
    };
```

(`alSubir` y `alCambiarTamano` quedan sin guarda: soltar un arrastre en curso siempre tiene que funcionar.)

3. En el `useFrame` principal, reemplazar:

```jsx
    if (listo) tomarControles();
    else soltarControles();
```

por:

```jsx
    if (!refActiva.current) {
      // Al empezar un viaje: devuelve límites, punto de giro y cámara de frente.
      soltarControles();
      return;
    }
    if (listo) tomarControles();
    else soltarControles();
```

En `Escena6Constelacion.jsx` (línea ~324) pasar la prop: `<Grafo tiempo={tiempo} claro={claro} activa={activa} />`.

- [ ] **Step 5: `FondoHito` a pantalla completa y con `presente`**

En `FondoHito.jsx`:
- Firma: `export default function FondoHito({ hitos, activo, presente = true }) {`
- En el primer `useEffect`, reemplazar `if (reducido || !hitoActivo.video) {` por `if (!presente || reducido || !hitoActivo.video) {` y la lista de dependencias `[activo, hitoActivo, reducido]` por `[activo, hitoActivo, reducido, presente]`.
- En `<Image ... sizes="(max-width: 768px) 100vw, 62vw"` cambiar a `sizes="100vw"`.

En `FondoHito.module.css`, reemplazar el bloque `.fondo { ... }` completo (desde el comentario de arriba hasta su `}`) por:

```css
/* Ocupa todo el panel, detrás del mundo 3D, y se funde con el fondo por los bordes
   con una máscara radial (no pinta color: sirve en tema claro y oscuro). Se ve sólo
   al llegar a un hito (la opacidad la maneja la sección). */
.fondo {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  -webkit-mask-image: radial-gradient(ellipse 80% 75% at 50% 50%, #000 40%, transparent 100%);
  mask-image: radial-gradient(ellipse 80% 75% at 50% 50%, #000 40%, transparent 100%);
  transition: opacity 0.5s ease;
}
```

- [ ] **Step 6: La bio en el flujo de la columna de textos**

En `DescripcionHito.module.css` reemplazar el primer bloque:

```css
/* En escritorio se superpone al escenario (que se desarma debajo). */
.descripcion {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  opacity: 0;
```

por:

```css
/* Debajo del encabezado, en la columna de textos del lado opuesto al modelo. */
.descripcion {
  position: relative;
  margin-top: 1.5rem;
  opacity: 0;
```

Y dentro de `@media (max-width: 768px)` reemplazar:

```css
  .descripcion {
    position: static;
    opacity: 1;
    transform: none;
    pointer-events: auto;
    margin-top: 1rem;
  }
```

por:

```css
  .descripcion {
    margin-top: 1rem;
  }
```

- [ ] **Step 7: Verificar que nada se rompió**

Run: `node --test apps/web/src/components/SobreMi/Escena3D/escena3d.test.js apps/web/src/lib/sobreMi.test.js apps/web/src/lib/columna/*.test.js`
Expected: todo `pass`, `fail 0`.
Run: `npm run build -w apps/web`
Expected: `Compiled successfully` (la sección vieja sigue funcionando; estos cambios son compatibles con ella).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/SobreMi
git commit -m "refactor(web): escenas de Sobre mí listas para compartir un único mundo 3D

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: El mundo 3D — columna, vértebras, siluetas y cámara

**Files (todos nuevos, en `apps/web/src/components/SobreMi/Columna3D/`):**
- `colores.js`, `curva.js`, `shaderColumna.js`, `texturaTexto.js`
- `Columna.jsx`, `Vertebras.jsx`, `Silueta.jsx`, `Estaciones.jsx` (versión inicial: sólo siluetas)
- `CamaraRecorrido.jsx`, `MundoColumna.jsx`

**Interfaces:**
- Consumes: Task 1 y 2; `LucesAzules`, `ControlGiro`, `vista.js` (`DISTANCIA_MINIMA`, `FOV`, `vistaParaAltura`), `escenas/index.js` (`esEscenaFija`, `limiteDeGiro`, `cargadorEscena`).
- Produces: `MundoColumna({ hitos, refTramo, activo, tipo, origen, visitas, lado, esMovil, reducido, claro, visible, onError })` — `refTramo` es un `useRef` cuyo `.current` es el último `tramoDe(...)`; `lado ∈ 'izquierda'|'derecha'|'arriba'`; `tipo ∈ 'estancia'|'viaje'`; `origen` = índice del hito del que salió el viaje en curso; `visitas` = array de enteros por hito.
- `leerColores(claro) → { acento, fondo, apagado }` (strings CSS hex).

- [ ] **Step 1: Utilidades**

`colores.js`:

```js
// Colores del mundo 3D, leídos de los tokens del sitio. El fondo de viaje en tema claro
// es un gris azulado (más oscuro que el fondo de la página) para que la columna se lea.
export function leerColores(claro) {
  const estilo = getComputedStyle(document.documentElement);
  const leer = (nombre, respaldo) => estilo.getPropertyValue(nombre).trim() || respaldo;
  return {
    acento: leer('--color-accent', '#5b8cff'),
    fondo: claro ? '#e9edf5' : leer('--color-bg', '#0b0d12'),
    apagado: claro ? '#8a93a6' : '#2a3350',
  };
}
```

`curva.js`:

```js
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
```

`texturaTexto.js`:

```js
import * as THREE from 'three';

// Texto chico dibujado en un canvas (el `Text` de drei pide una fuente por red).
export function texturaTexto(texto, color) {
  const lienzo = document.createElement('canvas');
  lienzo.width = 256;
  lienzo.height = 96;
  const ctx = lienzo.getContext('2d');
  ctx.font = '700 60px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(texto, 128, 50);
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}
```

`shaderColumna.js`:

```js
import * as THREE from 'three';

// Material del tubo de la columna. `uv.x` recorre el largo (0 = cola, 1 = punta):
//  - hasta `uLlenado` está encendida (acento por encima del umbral del bloom) con pulsos
//    de energía que suben y una estela que brilla de más justo detrás de la cabeza;
//  - en `uLlenado` hay una cabeza blanca;
//  - el resto, apagada y translúcida.
// Se desvanece con la profundidad (niebla propia: el material no usa la de la escena).
const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying float vProfundidad;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vProfundidad = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uLlenado;
  uniform float uTiempo;
  uniform float uIntensidad;
  uniform float uAlfaApagado;
  uniform vec3 uColor;
  uniform vec3 uApagado;
  varying vec2 vUv;
  varying float vProfundidad;
  void main() {
    float x = vUv.x;
    float encendido = step(x, uLlenado);
    float pulsos = 0.35 * pow(0.5 + 0.5 * sin(40.0 * x - 6.0 * uTiempo), 8.0);
    float estela = encendido * exp(-(uLlenado - x) / 0.012);
    float cabeza = exp(-pow((x - uLlenado) / 0.004, 2.0));
    vec3 color = mix(uApagado, uColor * (2.2 + pulsos * 3.0 + estela * 3.0), encendido);
    color += vec3(1.0) * cabeza * 4.0;
    float alfa = mix(uAlfaApagado, 1.0, max(encendido, cabeza));
    float niebla = exp(-pow(vProfundidad * 0.03, 2.0));
    gl_FragColor = vec4(color * uIntensidad, alfa * niebla);
  }
`;

export function crearMaterialColumna({ intensidad = 1, aditivo = false } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: !aditivo,
    blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending,
    toneMapped: false,
    uniforms: {
      uLlenado: { value: 0 },
      uTiempo: { value: 0 },
      uIntensidad: { value: intensidad },
      uAlfaApagado: { value: aditivo ? 0.08 : 0.18 },
      uColor: { value: new THREE.Color('#5b8cff') },
      uApagado: { value: new THREE.Color('#2a3350') },
    },
  });
}
```

- [ ] **Step 2: Columna y vértebras**

`Columna.jsx`:

```jsx
'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RADIO_HALO, RADIO_TUBO } from '@/lib/columna/geometria.js';
import { llenadoDe } from '@/lib/columna/recorrido.js';
import { curvaColumna } from './curva.js';
import { crearMaterialColumna } from './shaderColumna.js';

// El eje luminoso: un tubo fino (núcleo) y uno más grueso aditivo (halo) que da el
// resplandor aunque el bloom esté apagado.
export default function Columna({ n, refTramo, colores, reducido }) {
  const curva = curvaColumna(n);
  const geoNucleo = useMemo(() => new THREE.TubeGeometry(curva, 400, RADIO_TUBO, 12, false), [curva]);
  const geoHalo = useMemo(() => new THREE.TubeGeometry(curva, 200, RADIO_HALO, 12, false), [curva]);
  const nucleo = useMemo(() => crearMaterialColumna(), []);
  const halo = useMemo(() => crearMaterialColumna({ intensidad: 0.25, aditivo: true }), []);

  useEffect(() => {
    [nucleo, halo].forEach((material) => {
      material.uniforms.uColor.value.set(colores.acento);
      material.uniforms.uApagado.value.set(colores.apagado);
    });
  }, [nucleo, halo, colores]);

  useEffect(
    () => () => {
      geoNucleo.dispose();
      geoHalo.dispose();
      nucleo.dispose();
      halo.dispose();
    },
    [geoNucleo, geoHalo, nucleo, halo]
  );

  useFrame((_, delta) => {
    const llenado = llenadoDe(refTramo.current, n);
    [nucleo, halo].forEach((material) => {
      material.uniforms.uLlenado.value = llenado;
      // Con movimiento reducido los pulsos quedan quietos.
      if (!reducido) material.uniforms.uTiempo.value += Math.min(delta, 0.05);
    });
  });

  return (
    <>
      <mesh geometry={geoNucleo} material={nucleo} />
      <mesh geometry={geoHalo} material={halo} />
    </>
  );
}
```

`Vertebras.jsx`:

```jsx
'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { ancla, longitudHasta, vertebra } from '@/lib/columna/geometria.js';
import { activoDe, llenadoDe } from '@/lib/columna/recorrido.js';
import { curvaColumna } from './curva.js';

const Z = new THREE.Vector3(0, 0, 1);

// Un anillo por hito, perpendicular a la columna, y una "costilla" que lo une con su
// modelo. Apagado → encendido (con un destello) cuando la luz lo pasa; el del hito
// actual late despacio.
export default function Vertebras({ n, refTramo, colores, reducido }) {
  const curva = curvaColumna(n);
  const datos = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => {
        const { centro } = vertebra(i, n);
        const { posicion } = ancla(i, n);
        const fraccion = longitudHasta(i, n);
        const tangente = curva.getTangentAt(fraccion);
        const centro3 = new THREE.Vector3(centro.x, centro.y, centro.z);
        const hacia = new THREE.Vector3(posicion.x, posicion.y, posicion.z).sub(centro3);
        return {
          centro: centro3,
          giro: new THREE.Quaternion().setFromUnitVectors(Z, tangente),
          fraccion,
          // La costilla llega hasta un poco más de la mitad: no atraviesa el modelo.
          costilla: [centro3.toArray(), centro3.clone().addScaledVector(hacia, 0.55).toArray()],
        };
      }),
    [n, curva]
  );
  const geoAnillo = useMemo(() => new THREE.TorusGeometry(0.42, 0.035, 12, 64), []);
  const materiales = useMemo(
    () => datos.map(() => new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false })),
    [datos]
  );
  const refAnillos = useRef([]);
  const encendidaDesde = useRef(datos.map(() => -1));
  const base = useMemo(() => new THREE.Color(colores.acento), [colores.acento]);
  const apagado = useMemo(() => new THREE.Color(colores.apagado), [colores.apagado]);

  useEffect(
    () => () => {
      geoAnillo.dispose();
      materiales.forEach((m) => m.dispose());
    },
    [geoAnillo, materiales]
  );

  useFrame(({ clock }) => {
    const tramo = refTramo.current;
    const llenado = llenadoDe(tramo, n);
    const activo = activoDe(tramo);
    const ahora = clock.elapsedTime;
    datos.forEach((dato, i) => {
      const encendida = llenado >= dato.fraccion - 1e-6;
      if (encendida && encendidaDesde.current[i] < 0) encendidaDesde.current[i] = ahora;
      if (!encendida) encendidaDesde.current[i] = -1;
      const destello = encendida && !reducido ? Math.max(0, 1 - (ahora - encendidaDesde.current[i]) / 0.3) : 0;
      const latido = !reducido && tramo.tipo === 'estancia' && i === activo ? 0.5 + 0.5 * Math.sin((ahora * 2 * Math.PI) / 2.4) : 0;
      const material = materiales[i];
      material.color.copy(encendida ? base : apagado).multiplyScalar(encendida ? 2 + destello * 3 + latido : 1);
      material.opacity = encendida ? 1 : 0.25;
      const anillo = refAnillos.current[i];
      if (anillo) anillo.scale.setScalar(1 + latido * 0.08);
    });
  });

  return datos.map((dato, i) => (
    <group key={i}>
      <mesh
        ref={(malla) => {
          refAnillos.current[i] = malla;
        }}
        position={dato.centro}
        quaternion={dato.giro}
        geometry={geoAnillo}
        material={materiales[i]}
      />
      <Line points={dato.costilla} color={colores.acento} lineWidth={1.5} transparent opacity={0.45} />
    </group>
  ));
}
```

- [ ] **Step 3: Siluetas y estaciones (versión inicial)**

`Silueta.jsx`:

```jsx
'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import { texturaTexto } from './texturaTexto.js';

// Marcador de un hito lejano (o mientras carga su escena): un icosaedro alámbrico que
// gira despacio y su año debajo, siempre de frente a la cámara.
export default function Silueta({ anio, color, reducido }) {
  const refForma = useRef(null);
  const textura = useMemo(() => texturaTexto(anio, color), [anio, color]);
  useEffect(() => () => textura.dispose(), [textura]);
  useFrame((_, delta) => {
    if (refForma.current && !reducido) refForma.current.rotation.y += Math.min(delta, 0.05) * 0.3;
  });
  return (
    <group>
      <mesh ref={refForma}>
        <icosahedronGeometry args={[0.9, 1]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.35} toneMapped={false} />
      </mesh>
      <Billboard position={[0, -1.35, 0]}>
        <mesh>
          <planeGeometry args={[1.6, 0.6]} />
          <meshBasicMaterial map={textura} transparent opacity={0.8} depthWrite={false} toneMapped={false} />
        </mesh>
      </Billboard>
    </group>
  );
}
```

`Estaciones.jsx` (versión inicial; la Task 6 la reemplaza entera):

```jsx
'use client';

import { useMemo } from 'react';
import { ancla } from '@/lib/columna/geometria.js';
import Silueta from './Silueta.jsx';

// Un grupo por hito en su ancla, rotado para que su +z mire hacia afuera de la columna.
function Estacion({ hito, indice, n, reducido, color }) {
  const { posicion, angulo } = useMemo(() => ancla(indice, n), [indice, n]);
  return (
    <group position={[posicion.x, posicion.y, posicion.z]} rotation={[0, angulo, 0]}>
      <Silueta anio={hito.anio} color={color} reducido={reducido} />
    </group>
  );
}

export default function Estaciones({ hitos, reducido, color }) {
  return hitos.map((hito, i) => (
    <Estacion key={hito.id} hito={hito} indice={i} n={hitos.length} reducido={reducido} color={color} />
  ));
}
```

- [ ] **Step 4: La cámara del recorrido**

`CamaraRecorrido.jsx`:

```jsx
'use client';

import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { poseCamara } from '@/lib/columna/recorrido.js';
import { vistaParaAltura } from '../Escena3D/vista.js';

// Desplazamiento del encuadre (fracción del ancho/alto) según dónde va el modelo.
const DESPLAZAMIENTO = {
  izquierda: { x: 0.22, y: 0 },
  derecha: { x: -0.22, y: 0 },
  arriba: { x: 0, y: 0.2 },
};

// Conduce la cámara durante los viajes y la deja en la pose canónica al llegar. Una vez
// "anclada" en un hito, la suelta: ahí manda el OrbitControls de siempre (ControlGiro).
// También corre el encuadre hacia el lado del modelo con `setViewOffset` (es un
// desplazamiento de proyección: el picking de las escenas sigue siendo correcto).
export default function CamaraRecorrido({ n, refTramo, lado, opciones, reducido }) {
  const anclada = useRef(false);
  const mira = useRef(new THREE.Vector3());
  const giro = useRef(0);
  const corrimiento = useRef({ x: 0, y: 0 });
  const auxiliar = useRef(new THREE.Vector3());

  useFrame((estado, delta) => {
    const { camera, size, controls } = estado;
    const dt = Math.min(delta, 0.05);
    const tramo = refTramo.current;
    const { distancia } = vistaParaAltura(size.height);

    const objetivo = DESPLAZAMIENTO[lado] ?? DESPLAZAMIENTO.izquierda;
    const k = reducido ? 1 : 1 - Math.exp(-4 * dt);
    corrimiento.current.x += (objetivo.x - corrimiento.current.x) * k;
    corrimiento.current.y += (objetivo.y - corrimiento.current.y) * k;
    camera.setViewOffset(
      size.width,
      size.height,
      corrimiento.current.x * size.width,
      corrimiento.current.y * size.height,
      size.width,
      size.height
    );

    // El grafo de Hoy todavía tiene la cámara: se espera a que la suelte.
    if (controls?.giroLibre) {
      camera.updateProjectionMatrix();
      return;
    }

    if (tramo.tipo === 'estancia' && anclada.current) {
      // Ya llegó: sólo se corrige la distancia si cambió el alto del canvas.
      if (Math.abs(camera.position.length() - distancia) > 0.01) camera.position.setLength(distancia);
      camera.updateProjectionMatrix();
      return;
    }

    anclada.current = false;
    if (controls) controls.enabled = false;

    const pose = poseCamara(tramo, distancia, n, opciones);
    const f = reducido ? 1 : 1 - Math.exp(-6 * dt);
    const destino = auxiliar.current.set(...pose.posicion);
    camera.position.lerp(destino, f);
    mira.current.lerp(destino.set(...pose.mira), f);
    camera.fov += (pose.fov - camera.fov) * f;
    giro.current += (pose.giroZ - giro.current) * f;
    camera.lookAt(mira.current);
    camera.rotateZ(giro.current);
    camera.updateProjectionMatrix();

    if (tramo.tipo === 'estancia') {
      const error =
        camera.position.distanceTo(auxiliar.current.set(...pose.posicion)) +
        mira.current.length() +
        Math.abs(camera.fov - pose.fov) +
        Math.abs(giro.current);
      if (error < 0.01) {
        camera.position.set(...pose.posicion);
        mira.current.set(0, 0, 0);
        camera.fov = pose.fov;
        giro.current = 0;
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
        anclada.current = true;
        if (controls) {
          controls.target.set(0, 0, 0);
          controls.enabled = true;
          controls.update();
        }
      }
    }
  });

  return null;
}
```

- [ ] **Step 5: El canvas**

`MundoColumna.jsx` (versión inicial; la Task 7 la reemplaza entera):

```jsx
'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { RADIO_ANCLA, transformacionMundo } from '@/lib/columna/geometria.js';
import { OPCIONES_ESCRITORIO, OPCIONES_MOVIL, estadoDe } from '@/lib/columna/recorrido.js';
import LucesAzules from '../Escena3D/LucesAzules.jsx';
import ControlGiro from '../Escena3D/ControlGiro.jsx';
import { DISTANCIA_MINIMA, FOV } from '../Escena3D/vista.js';
import { esEscenaFija, limiteDeGiro } from '../Escena3D/escenas/index.js';
import { leerColores } from './colores.js';
import Columna from './Columna.jsx';
import Vertebras from './Vertebras.jsx';
import Estaciones from './Estaciones.jsx';
import CamaraRecorrido from './CamaraRecorrido.jsx';

// Mueve y gira todo el mundo para que el hito del estado `s` quede en el origen
// mirando a la cámara: Mundo = T(0,0,-R) · Ry(-θ) · T(-c).
function Rig({ n, refTramo, reducido, children }) {
  const refPivote = useRef(null);
  const refContenido = useRef(null);
  useFrame(() => {
    const t = transformacionMundo(estadoDe(refTramo.current, { reducido }), n);
    refPivote.current.rotation.y = t.rotacionY;
    refContenido.current.position.set(...t.contenido);
  });
  return (
    <group ref={refPivote} position={[0, 0, -RADIO_ANCLA]}>
      <group ref={refContenido}>{children}</group>
    </group>
  );
}

function Niebla({ color }) {
  const scene = useThree((estado) => estado.scene);
  useEffect(() => {
    scene.fog = new THREE.FogExp2(color, 0.035);
    return () => {
      scene.fog = null;
    };
  }, [scene, color]);
  return null;
}

export default function MundoColumna({ hitos, refTramo, activo, lado, esMovil, reducido, claro, visible, onError }) {
  const n = hitos.length;
  const [colores, setColores] = useState(() => leerColores(claro));
  useEffect(() => setColores(leerColores(claro)), [claro]);
  const desmontando = useRef(false);
  useEffect(() => {
    desmontando.current = false;
    return () => {
      desmontando.current = true;
    };
  }, []);
  const idActivo = hitos[activo].id;

  return (
    <Canvas
      dpr={[1, 1.75]}
      frameloop={visible ? 'always' : 'never'}
      camera={{ position: [0, 0.7, DISTANCIA_MINIMA], fov: FOV, near: 0.1, far: 200 }}
      gl={{ alpha: true, antialias: true }}
      style={{ position: 'absolute', inset: 0 }}
      onCreated={({ gl }) => {
        const lienzo = gl.domElement;
        lienzo.addEventListener('webglcontextlost', (evento) => {
          // R3F fuerza la pérdida del contexto al desmontar el canvas: eso no es un fallo.
          if (desmontando.current || !lienzo.isConnected) return;
          evento.preventDefault();
          onError();
        });
      }}
    >
      <Niebla color={colores.fondo} />
      {/* Las luces quedan fuera del mundo: iluminan al hito actual igual que antes. */}
      <LucesAzules />
      <ControlGiro quieto={reducido} girable={!esEscenaFija(idActivo)} limiteAzimut={limiteDeGiro(idActivo)} />
      <CamaraRecorrido
        n={n}
        refTramo={refTramo}
        lado={lado}
        opciones={esMovil ? OPCIONES_MOVIL : OPCIONES_ESCRITORIO}
        reducido={reducido}
      />
      <Rig n={n} refTramo={refTramo} reducido={reducido}>
        <Columna n={n} refTramo={refTramo} colores={colores} reducido={reducido} />
        <Vertebras n={n} refTramo={refTramo} colores={colores} reducido={reducido} />
        <Estaciones hitos={hitos} reducido={reducido} color={colores.acento} />
      </Rig>
    </Canvas>
  );
}
```

- [ ] **Step 6: Compila**

Run: `npm run build -w apps/web`
Expected: `Compiled successfully`. Los archivos nuevos todavía no se importan desde ninguna página, así que el build sólo confirma que no se rompió nada; se ven funcionando en la Task 5. Además:
Run: `node --input-type=module -e "import('./apps/web/src/lib/columna/recorrido.js').then(m=>console.log(typeof m.poseCamara))"`
Expected: `function`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/SobreMi/Columna3D
git commit -m "feat(web): mundo 3D de la columna (tubo, vértebras, siluetas y cámara del recorrido)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: La sección nueva — scroll, imán, textos, minimapa, año y respaldo plano

**Files:**
- Rewrite: `apps/web/src/components/SobreMi/SobreMi.jsx`, `SobreMi.module.css`
- Create: `apps/web/src/components/SobreMi/Minimapa.jsx`, `Minimapa.module.css`, `AnioViaje.jsx`, `AnioViaje.module.css`, `SobreMiPlano.jsx`, `SobreMiPlano.module.css`
- Create: `apps/web/scripts/verificar-sobre-mi.mjs`
- Delete: `apps/web/src/components/SobreMi/LineaTiempo.jsx`, `LineaTiempo.module.css`, `Escena3D/Escena3D.jsx`, `Escena3D/Escena3D.module.css`, `Escena3D/EscenaCanvas.jsx`, `Escena3D/DistanciaCamara.jsx`, `apps/web/src/lib/hitoActivo.js`
- Modify: `apps/web/src/lib/sobreMi.test.js` (quitar los tests de `hitoActivo`)

**Interfaces:**
- Consumes: `MundoColumna` (Task 4), `recorrido.js`, `geometria.js`, `FondoHito({hitos, activo, presente})`, `EncabezadoHito({hito})`, `DescripcionHito({hito, visible})`, `EscenarioHito({hito, desarmado})`, `dividirResaltado(texto) → {texto, resaltado}[]`, `tiempoModeloMs(id)`, `hayWebGL()`, `LimiteErrores({onError})`, `useConsulta`, `useTema`.
- Produces: `Minimapa({ hitos, progreso, activo, onIr })`, `AnioViaje({ hitos, progreso, oculto })`, `SobreMiPlano({ hitos })`. DOM para la verificación: `section#sobre-mi`, `.panel[data-lado][data-tipo]`, `[data-textos][data-visible][data-bio]`, `section[data-plano]` en el respaldo, y `document.documentElement.dataset.sinIman` desactiva el imán (sólo para capturas).

- [ ] **Step 1: Borrar lo viejo y sus tests**

```bash
git rm apps/web/src/components/SobreMi/LineaTiempo.jsx apps/web/src/components/SobreMi/LineaTiempo.module.css \
  apps/web/src/components/SobreMi/Escena3D/Escena3D.jsx apps/web/src/components/SobreMi/Escena3D/Escena3D.module.css \
  apps/web/src/components/SobreMi/Escena3D/EscenaCanvas.jsx apps/web/src/components/SobreMi/Escena3D/DistanciaCamara.jsx \
  apps/web/src/lib/hitoActivo.js
```

En `apps/web/src/lib/sobreMi.test.js`: borrar la línea `import { indiceDeHito, progresoDeHito } from './hitoActivo.js';` y los tres tests `indiceDeHito: reparte…`, `indiceDeHito: acota…` y `progresoDeHito: cae…` completos.

Run: `grep -rn "hitoActivo\|LineaTiempo\|EscenaCanvas\|DistanciaCamara\|Escena3D/Escena3D" apps/web/src`
Expected: sólo aparece `SobreMi.jsx` (que se reescribe en el Step 3). Si aparece otro archivo, avisar y no seguir.

- [ ] **Step 2: Minimapa y año del viaje**

`Minimapa.jsx`:

```jsx
'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useMotionValueEvent } from 'framer-motion';
import { PUNTOS_POR_TRAMO, puntosMinimapa } from '@/lib/columna/geometria.js';
import { estadoDe, tramoDe } from '@/lib/columna/recorrido.js';
import styles from './Minimapa.module.css';

const ANCHO = 28;
const ALTO = 220;

// La columna en miniatura: la S, el tramo recorrido y un botón por hito. Es la línea de
// tiempo accesible (teclado y lectores de pantalla) y sirve para saltar a cualquier hito.
// El avance se pinta tocando el DOM directo (sin renders de React por cada scroll).
export default function Minimapa({ hitos, progreso, activo, onIr }) {
  const n = hitos.length;
  const { camino, hitos: puntos } = useMemo(() => puntosMinimapa(n, { ancho: ANCHO, alto: ALTO }), [n]);
  const trazo = useMemo(
    () => camino.map((p, k) => `${k ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' '),
    [camino]
  );
  const acumulado = useMemo(() => {
    const largos = [0];
    for (let k = 1; k < camino.length; k += 1) {
      largos.push(largos[k - 1] + Math.hypot(camino[k].x - camino[k - 1].x, camino[k].y - camino[k - 1].y));
    }
    return largos;
  }, [camino]);
  const total = acumulado[acumulado.length - 1];
  const refRecorrido = useRef(null);
  const refMarcador = useRef(null);

  const pintar = useCallback(
    (p) => {
      const s = estadoDe(tramoDe(p, n));
      const k = Math.min(camino.length - 1, Math.max(0, s * PUNTOS_POR_TRAMO));
      const k0 = Math.floor(k);
      const k1 = Math.min(camino.length - 1, k0 + 1);
      const r = k - k0;
      const largo = acumulado[k0] + (acumulado[k1] - acumulado[k0]) * r;
      refRecorrido.current?.setAttribute('stroke-dasharray', `${largo} ${total}`);
      refMarcador.current?.setAttribute('cx', String(camino[k0].x + (camino[k1].x - camino[k0].x) * r));
      refMarcador.current?.setAttribute('cy', String(camino[k0].y + (camino[k1].y - camino[k0].y) * r));
    },
    [n, camino, acumulado, total]
  );

  useMotionValueEvent(progreso, 'change', pintar);
  useEffect(() => pintar(progreso.get()), [pintar, progreso]);

  return (
    <nav className={styles.minimapa} aria-label="Línea de tiempo">
      <svg className={styles.svg} width={ANCHO} height={ALTO} viewBox={`0 0 ${ANCHO} ${ALTO}`} aria-hidden="true">
        <path d={trazo} className={styles.base} />
        <path ref={refRecorrido} d={trazo} className={styles.recorrido} strokeDasharray={`0 ${total}`} />
        <circle ref={refMarcador} r="3" className={styles.marcador} cx={puntos[0].x} cy={puntos[0].y} />
      </svg>
      {hitos.map((hito, i) => (
        <button
          key={hito.id}
          type="button"
          className={styles.boton}
          style={{ left: `${puntos[i].x}px`, top: `${puntos[i].y}px` }}
          aria-label={`${hito.anio} — ${hito.titulo}`}
          aria-current={i === activo ? 'step' : undefined}
          onClick={() => onIr(i)}
        >
          <span className={styles.punto} aria-hidden="true" />
          <span className={styles.tooltip} aria-hidden="true">
            {hito.anio}
          </span>
        </button>
      ))}
    </nav>
  );
}
```

`Minimapa.module.css`:

```css
.minimapa {
  position: absolute;
  z-index: 3;
  right: clamp(1rem, 2.5vw, 2rem);
  top: 50%;
  width: 28px;
  height: 220px;
  transform: translateY(-50%);
}

.svg {
  position: absolute;
  inset: 0;
  overflow: visible;
}

.base,
.recorrido {
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
}

.base {
  stroke: var(--color-border);
}

.recorrido {
  stroke: var(--color-accent);
  filter: drop-shadow(0 0 4px var(--color-accent));
}

.marcador {
  fill: #fff;
  filter: drop-shadow(0 0 6px var(--color-accent));
}

.boton {
  position: absolute;
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  margin: -9px 0 0 -9px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.punto {
  width: 8px;
  height: 8px;
  border: 1.5px solid var(--color-muted);
  border-radius: 50%;
  background: var(--color-bg);
  transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}

.boton[aria-current='step'] .punto {
  border-color: var(--color-accent);
  background: var(--color-accent);
  transform: scale(1.3);
}

.boton:hover .punto,
.boton:focus-visible .punto {
  border-color: var(--color-accent);
  transform: scale(1.3);
}

.boton:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
  border-radius: 50%;
}

.tooltip {
  position: absolute;
  right: calc(100% + 8px);
  top: 50%;
  padding: 0.2rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-chip-bg);
  color: var(--color-fg);
  font-size: 0.75rem;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transform: translateY(-50%);
  transition: opacity 0.15s ease;
}

.boton:hover .tooltip,
.boton:focus-visible .tooltip {
  opacity: 1;
}

@media (max-width: 768px) {
  .minimapa {
    top: auto;
    bottom: calc(42svh + 1.5rem);
    transform: scale(0.7);
    transform-origin: bottom right;
  }
}
```

`AnioViaje.jsx`:

```jsx
'use client';

import { useMotionValueEvent } from 'framer-motion';
import { useRef } from 'react';
import { anioEnViaje, opacidadAnio, tramoDe } from '@/lib/columna/recorrido.js';
import styles from './AnioViaje.module.css';

// El año enorme que cuenta durante el viaje (2022… 2023). Decorativo: el año real está
// en el encabezado del hito y en el minimapa.
export default function AnioViaje({ hitos, progreso, oculto }) {
  const ref = useRef(null);
  useMotionValueEvent(progreso, 'change', (p) => {
    const elemento = ref.current;
    if (!elemento) return;
    const tramo = tramoDe(p, hitos.length);
    if (oculto || tramo.tipo !== 'viaje') {
      elemento.style.opacity = '0';
      return;
    }
    elemento.textContent = anioEnViaje(hitos[tramo.indice].anio, hitos[tramo.indice + 1].anio, tramo.t);
    elemento.style.opacity = String(opacidadAnio(tramo.t));
  });
  return <p ref={ref} className={styles.anio} style={{ opacity: 0 }} aria-hidden="true" />;
}
```

`AnioViaje.module.css`:

```css
.anio {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  place-items: center;
  margin: 0;
  pointer-events: none;
  font-size: clamp(4rem, 14vw, 11rem);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  color: color-mix(in srgb, var(--color-accent) 8%, transparent);
  -webkit-text-stroke: 1.5px var(--color-accent);
}
```

- [ ] **Step 3: La sección**

`SobreMi.jsx` (reemplazo completo):

```jsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useMotionValueEvent, useReducedMotion, useScroll, useSpring } from 'framer-motion';
import hitos from '@/data/hitos.json';
import useConsulta from '@/hooks/useConsulta.js';
import useTema from '@/hooks/useTema.js';
import { activoDe, imanDe, pesoTotal, progresoDeEstancia, tramoDe } from '@/lib/columna/recorrido.js';
import { tiempoModeloMs } from '@/lib/tiempoModelo.js';
import { hayWebGL } from './Escena3D/soporteWebGL.js';
import LimiteErrores from './Escena3D/LimiteErrores.jsx';
import FondoHito from './FondoHito.jsx';
import EncabezadoHito from './EncabezadoHito.jsx';
import DescripcionHito from './DescripcionHito.jsx';
import Minimapa from './Minimapa.jsx';
import AnioViaje from './AnioViaje.jsx';
import SobreMiPlano from './SobreMiPlano.jsx';
import styles from './SobreMi.module.css';

// Todo `three` queda en este chunk, que se pide cuando la sección se acerca.
const MundoColumna = dynamic(() => import('./Columna3D/MundoColumna.jsx'), { ssr: false, loading: () => null });

const N = hitos.length;
const ESPERA_LLEGADA_MS = 400;
const ESPERA_IMAN_MS = 160;

function SobreMiRecorrido({ onFallo }) {
  const refContenedor = useRef(null);
  const refPanel = useRef(null);
  const reducido = Boolean(useReducedMotion());
  const esMovil = useConsulta('(max-width: 768px)');
  const claro = useTema().tema === 'light';

  const { scrollYProgress } = useScroll({ target: refContenedor, offset: ['start start', 'end end'] });
  // La rueda del mouse avanza a saltos: el resorte los suaviza. Con movimiento reducido
  // se usa el progreso crudo (no hay viaje que suavizar).
  const suave = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.6 });
  const progreso = reducido ? scrollYProgress : suave;

  // El tramo viaja por ref a los useFrame (sin renders por frame); React sólo se entera
  // cuando cambia el tipo de tramo, su índice o el hito activo.
  const refTramo = useRef(tramoDe(0, N));
  const [vista, setVista] = useState({ tipo: 'estancia', indice: 0, activo: 0 });
  const actualizar = useCallback((p) => {
    const tramo = tramoDe(p, N);
    refTramo.current = tramo;
    const activo = activoDe(tramo);
    setVista((previa) =>
      previa.tipo === tramo.tipo && previa.indice === tramo.indice && previa.activo === activo
        ? previa
        : { tipo: tramo.tipo, indice: tramo.indice, activo }
    );
  }, []);
  useMotionValueEvent(progreso, 'change', actualizar);
  // Estado inicial: al recargar con el scroll a mitad de la sección ya hay un progreso.
  useEffect(() => actualizar(progreso.get()), [actualizar, progreso]);

  // Origen de cada viaje (el hito del que se salió) y contador de visitas: el destino se
  // remonta al empezar el viaje para que su animación arranque de cero al llegar.
  const refUltimaEstancia = useRef(0);
  const [origen, setOrigen] = useState(0);
  const [visitas, setVisitas] = useState(() => hitos.map(() => 0));
  useEffect(() => {
    if (vista.tipo === 'estancia') {
      refUltimaEstancia.current = vista.indice;
      return;
    }
    const desde = refUltimaEstancia.current === vista.indice + 1 ? vista.indice + 1 : vista.indice;
    const destino = desde === vista.indice ? vista.indice + 1 : vista.indice;
    setOrigen(desde);
    setVisitas((previas) => previas.map((v, i) => (i === destino ? v + 1 : v)));
  }, [vista.tipo, vista.indice]);

  // Montaje diferido del canvas (cerca) y render sólo a la vista (enPantalla).
  const [cerca, setCerca] = useState(false);
  const [enPantalla, setEnPantalla] = useState(false);
  useEffect(() => {
    const contenedor = refContenedor.current;
    const panel = refPanel.current;
    if (!contenedor || !panel) return undefined;
    const precarga = new IntersectionObserver(([e]) => e.isIntersecting && setCerca(true), { rootMargin: '300px' });
    const aLaVista = new IntersectionObserver(([e]) => setEnPantalla(e.isIntersecting), { threshold: 0.5 });
    precarga.observe(contenedor);
    aLaVista.observe(panel);
    return () => {
      precarga.disconnect();
      aLaVista.disconnect();
    };
  }, []);

  // Llegada: el fondo y el encabezado aparecen a los 400 ms; la bio, cuando el modelo
  // cumplió su tiempo (primero el modelo, después la bio).
  const [presente, setPresente] = useState(false);
  const [bioVisible, setBioVisible] = useState(false);
  useEffect(() => {
    setPresente(false);
    setBioVisible(false);
    if (vista.tipo !== 'estancia' || !enPantalla) return undefined;
    const llegada = setTimeout(() => setPresente(true), reducido ? 0 : ESPERA_LLEGADA_MS);
    const bio = setTimeout(() => setBioVisible(true), reducido ? 0 : tiempoModeloMs(hitos[vista.indice].id));
    return () => {
      clearTimeout(llegada);
      clearTimeout(bio);
    };
  }, [vista.tipo, vista.indice, enPantalla, reducido]);

  const scrollAProgreso = useCallback(
    (p) => {
      const contenedor = refContenedor.current;
      if (!contenedor) return;
      const recorrido = contenedor.offsetHeight - window.innerHeight;
      const arriba = contenedor.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: arriba + p * recorrido, behavior: reducido ? 'auto' : 'smooth' });
    },
    [reducido]
  );
  const irAlHito = useCallback((i) => scrollAProgreso(progresoDeEstancia(i, N)), [scrollAProgreso]);

  // Imán: si el usuario suelta el scroll a mitad de un viaje, lo termina (o lo deshace).
  useEffect(() => {
    let espera = 0;
    let dedos = 0;
    const intentar = () => {
      const contenedor = refContenedor.current;
      if (dedos > 0 || !contenedor || document.documentElement.dataset.sinIman) return;
      const caja = contenedor.getBoundingClientRect();
      // Sólo con el panel fijo en pantalla (no al entrar o salir de la sección).
      if (caja.top > 1 || caja.bottom < window.innerHeight - 1) return;
      const objetivo = imanDe(scrollYProgress.get(), N);
      if (objetivo != null) scrollAProgreso(objetivo);
    };
    const alScroll = () => {
      clearTimeout(espera);
      espera = setTimeout(intentar, ESPERA_IMAN_MS);
    };
    const alTocar = (evento) => {
      dedos = evento.touches.length;
      if (!dedos) alScroll();
    };
    window.addEventListener('scroll', alScroll, { passive: true });
    window.addEventListener('touchstart', alTocar, { passive: true });
    window.addEventListener('touchend', alTocar, { passive: true });
    window.addEventListener('touchcancel', alTocar, { passive: true });
    return () => {
      clearTimeout(espera);
      window.removeEventListener('scroll', alScroll);
      window.removeEventListener('touchstart', alTocar);
      window.removeEventListener('touchend', alTocar);
      window.removeEventListener('touchcancel', alTocar);
    };
  }, [scrollYProgress, scrollAProgreso]);

  const hito = hitos[vista.activo];
  const lado = esMovil ? 'arriba' : vista.activo % 2 === 0 ? 'izquierda' : 'derecha';
  const textosVisibles = vista.tipo === 'estancia' && presente;

  return (
    <section id="sobre-mi" ref={refContenedor} className={styles.contenedor} style={{ '--peso': pesoTotal(N) }}>
      <div ref={refPanel} className={styles.panel} data-lado={lado} data-tipo={vista.tipo}>
        <div className={styles.fondo} data-presente={textosVisibles}>
          <FondoHito hitos={hitos} activo={vista.activo} presente={textosVisibles} />
        </div>
        <div className={styles.mundo} data-fundido={reducido && vista.tipo === 'viaje'}>
          {cerca ? (
            <LimiteErrores onError={onFallo}>
              <MundoColumna
                hitos={hitos}
                refTramo={refTramo}
                activo={vista.activo}
                tipo={vista.tipo}
                origen={origen}
                visitas={visitas}
                lado={lado}
                esMovil={esMovil}
                reducido={reducido}
                claro={claro}
                visible={enPantalla}
                onError={onFallo}
              />
            </LimiteErrores>
          ) : null}
        </div>
        <AnioViaje hitos={hitos} progreso={progreso} oculto={reducido} />
        <h2 className={styles.etiqueta}>Sobre mí</h2>
        <div className={styles.textos} data-textos data-visible={textosVisibles} data-bio={bioVisible}>
          {/* Se monta al llegar: así el año y el título se "descifran" cada vez. */}
          {textosVisibles ? <EncabezadoHito hito={hito} /> : null}
          <DescripcionHito hito={hito} visible={bioVisible} />
        </div>
        <Minimapa hitos={hitos} progreso={progreso} activo={vista.activo} onIr={irAlHito} />
      </div>
    </section>
  );
}

export default function SobreMi() {
  // En el servidor y en el primer render se arma el recorrido; si no hay WebGL (o el
  // mundo 3D falla) se cambia a la lista plana.
  const [plano, setPlano] = useState(false);
  useEffect(() => {
    if (!hayWebGL()) setPlano(true);
  }, []);
  const alFallar = useCallback(() => setPlano(true), []);
  if (hitos.length === 0) return null;
  return plano ? <SobreMiPlano hitos={hitos} /> : <SobreMiRecorrido onFallo={alFallar} />;
}
```

`SobreMi.module.css` (reemplazo completo):

```css
/* Sale del ancho de <main> (960px) sin tocarlo, y es alto: el panel sticky queda fijo
   mientras se recorre ese alto, y ese recorrido es el viaje por la columna. */
.contenedor {
  position: relative;
  width: 100vw;
  margin-left: calc(50% - 50vw);
  height: calc(100svh + var(--peso) * 55svh);
}

.panel {
  --fondo-viaje: var(--color-bg);
  position: sticky;
  top: 0;
  height: 100svh;
  overflow: hidden;
  background: var(--fondo-viaje);
}

:global([data-theme='light']) .panel {
  --fondo-viaje: #e9edf5;
}

@media (prefers-color-scheme: light) {
  :global(:root:not([data-theme='dark'])) .panel {
    --fondo-viaje: #e9edf5;
  }
}

/* Foto/video del hito: sólo al llegar. Encima, un velo del color de fondo para que el
   mundo 3D se lea. */
.fondo {
  position: absolute;
  inset: 0;
  z-index: 0;
  opacity: 0;
  transition: opacity 0.4s ease;
}

.fondo[data-presente='true'] {
  opacity: 1;
  transition-duration: 0.9s;
}

.fondo::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(
    ellipse at center,
    color-mix(in srgb, var(--fondo-viaje) 55%, transparent) 0%,
    var(--fondo-viaje) 85%
  );
}

.mundo {
  position: absolute;
  inset: 0;
  z-index: 1;
  transition: opacity 0.4s ease;
}

/* Movimiento reducido: en vez de viajar, el mundo se funde entre hitos. */
.mundo[data-fundido='true'] {
  opacity: 0;
}

.etiqueta {
  position: absolute;
  top: 5.5rem;
  left: clamp(1.25rem, 5vw, 4rem);
  z-index: 3;
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--color-muted);
}

/* Textos del hito: en la mitad opuesta al modelo. */
.textos {
  position: absolute;
  top: 50%;
  z-index: 3;
  width: min(40%, 34rem);
  max-height: calc(100svh - 10rem);
  overflow-y: auto;
  scrollbar-width: none;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

.panel[data-lado='izquierda'] .textos {
  right: clamp(3.5rem, 7vw, 6rem);
  transform: translate(24px, -50%);
}

.panel[data-lado='derecha'] .textos {
  left: clamp(1.25rem, 5vw, 4rem);
  transform: translate(-24px, -50%);
}

.panel .textos[data-visible='true'] {
  opacity: 1;
  pointer-events: auto;
  transform: translate(0, -50%);
}

@media (max-width: 768px) {
  .contenedor {
    height: calc(100svh + var(--peso) * 45svh);
  }

  .etiqueta {
    top: 5rem;
    left: 1rem;
  }

  /* Modelo arriba, texto en una hoja abajo que scrollea por dentro. */
  .panel[data-lado] .textos {
    top: auto;
    right: 1rem;
    bottom: 1rem;
    left: 1rem;
    width: auto;
    max-height: 42svh;
    overscroll-behavior: contain;
    transform: translateY(24px);
  }

  .panel .textos[data-visible='true'] {
    transform: translateY(0);
  }
}
```

- [ ] **Step 4: Respaldo sin WebGL**

`SobreMiPlano.jsx`:

```jsx
import Image from 'next/image';
import { dividirResaltado } from '@/lib/resaltado.js';
import EncabezadoHito from './EncabezadoHito.jsx';
import EscenarioHito from './EscenarioHito.jsx';
import styles from './SobreMiPlano.module.css';

// Sin WebGL (o si el mundo 3D falla): los hitos uno debajo del otro, sin scroll guiado.
export default function SobreMiPlano({ hitos }) {
  return (
    <section id="sobre-mi" className={styles.plano} data-plano>
      <h2 className={styles.etiqueta}>Sobre mí</h2>
      <ol className={styles.lista}>
        {hitos.map((hito) => (
          <li key={hito.id} className={styles.hito}>
            {hito.imagen ? (
              <div className={styles.foto}>
                <Image src={hito.imagen} alt="" fill sizes="(max-width: 768px) 100vw, 40vw" className={styles.imagen} />
              </div>
            ) : null}
            <div className={styles.texto}>
              <EncabezadoHito hito={hito} />
              <EscenarioHito hito={hito} desarmado={false} />
              <p className={styles.bio}>
                {dividirResaltado(hito.descripcion).map((parte, i) =>
                  parte.resaltado ? <strong key={i}>{parte.texto}</strong> : <span key={i}>{parte.texto}</span>
                )}
              </p>
              {hito.credito ? (
                <p className={styles.credito}>
                  <a href={hito.credito.url} target="_blank" rel="noopener noreferrer">
                    {hito.credito.texto}
                  </a>
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
```

`SobreMiPlano.module.css`:

```css
.plano {
  padding: 5.5rem 0 4rem;
}

.etiqueta {
  margin: 0 0 2.5rem;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--color-muted);
}

.lista {
  display: grid;
  gap: 4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.hito {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
  gap: 2rem;
  align-items: start;
}

.foto {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  border-radius: 1rem;
}

.imagen {
  object-fit: cover;
}

.texto {
  display: grid;
  gap: 1rem;
}

.bio {
  margin: 0;
  line-height: 1.7;
  color: var(--color-fg);
}

.bio strong {
  color: var(--color-accent);
}

.credito {
  margin: 0;
  font-size: 0.78rem;
  color: var(--color-muted);
}

.credito a {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 3px;
}

@media (max-width: 768px) {
  .hito {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 5: Script de verificación**

Crear `apps/web/scripts/verificar-sobre-mi.mjs`:

```js
// Recorre "Sobre mí" en Chrome headless (por CDP, sin dependencias) y saca capturas de
// cada estancia y de algunos momentos de los viajes. Comprueba el lado del modelo, que la
// bio aparezca y que no haya errores de consola.
//
// Uso: node apps/web/scripts/verificar-sobre-mi.mjs [url] [carpeta]
// Variables: TEMA=light · MOVIL=1 (390×844 táctil) · REDUCIDO=1 · SIN_WEBGL=1
//            CHROME=<ruta a chrome.exe>
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL_SITIO = process.argv[2] ?? 'http://localhost:3100/';
const SALIDA = process.argv[3] ?? join(tmpdir(), 'sobre-mi-capturas');
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PUERTO = 9333;
const MOVIL = Boolean(process.env.MOVIL);

// Mismos pesos que lib/columna/recorrido.js (7 hitos).
const N = 7;
const PE = 1;
const PV = 1.4;
const W = N * PE + (N - 1) * PV;
const estancia = (i) => (i * (PE + PV) + PE / 2) / W;
const viaje = (i, t) => (i * (PE + PV) + PE + t * PV) / W;

mkdirSync(SALIDA, { recursive: true });
const graficos = process.env.SIN_WEBGL
  ? ['--disable-webgl', '--disable-3d-apis']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PUERTO}`,
    `--user-data-dir=${join(tmpdir(), `chrome-sobre-mi-${Date.now()}`)}`,
    '--window-size=1440,900',
    '--hide-scrollbars',
    ...graficos,
    'about:blank',
  ],
  { stdio: 'ignore' }
);

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
let pagina;
for (let k = 0; k < 50 && !pagina; k += 1) {
  try {
    const lista = await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json();
    pagina = lista.find((t) => t.type === 'page');
  } catch {
    // Chrome todavía no abrió el puerto.
  }
  if (!pagina) await esperar(200);
}
if (!pagina) {
  console.error('No se pudo conectar con Chrome en', CHROME);
  chrome.kill();
  process.exit(1);
}

const ws = new WebSocket(pagina.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pendientes = new Map();
const errores = [];
ws.addEventListener('message', (evento) => {
  const m = JSON.parse(evento.data);
  if (m.id && pendientes.has(m.id)) {
    pendientes.get(m.id)(m);
    pendientes.delete(m.id);
  }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    errores.push(`${d.text} ${d.exception?.description ?? ''}`.trim());
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    errores.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
  }
});
const cdp = (method, params = {}) =>
  new Promise((r) => {
    id += 1;
    pendientes.set(id, r);
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluar = async (expresion) =>
  (await cdp('Runtime.evaluate', { expression: expresion, awaitPromise: true, returnByValue: true })).result?.result
    ?.value;
const capturar = async (nombre) => {
  const r = await cdp('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(SALIDA, `${nombre}.png`), Buffer.from(r.result.data, 'base64'));
};

await cdp('Runtime.enable');
await cdp('Page.enable');
const medios = [];
if (process.env.REDUCIDO) medios.push({ name: 'prefers-reduced-motion', value: 'reduce' });
if (process.env.TEMA) medios.push({ name: 'prefers-color-scheme', value: process.env.TEMA });
if (medios.length) await cdp('Emulation.setEmulatedMedia', { features: medios });
if (MOVIL) {
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
}
await cdp('Page.navigate', { url: URL_SITIO });
await esperar(6000);

const irA = (p) =>
  evaluar(`(() => {
    const s = document.getElementById('sobre-mi');
    const arriba = s.getBoundingClientRect().top + scrollY;
    const recorrido = s.offsetHeight - innerHeight;
    scrollTo({ top: arriba + ${p} * recorrido, behavior: 'instant' });
    return true;
  })()`);
const estado = () =>
  evaluar(`(() => {
    const panel = document.querySelector('#sobre-mi [data-lado]');
    const textos = document.querySelector('#sobre-mi [data-textos]');
    return { lado: panel?.dataset.lado, tipo: panel?.dataset.tipo, bio: textos?.dataset.bio === 'true' };
  })()`);

let fallas = 0;
if (await evaluar(`Boolean(document.querySelector('section[data-plano]'))`)) {
  await evaluar(`document.getElementById('sobre-mi').scrollIntoView()`);
  await esperar(1500);
  await capturar('plano');
  console.log('respaldo plano');
} else {
  await evaluar(`document.documentElement.dataset.sinIman = '1'`);
  for (let i = 0; i < N; i += 1) {
    await irA(estancia(i));
    await esperar(2500);
    await capturar(`estancia-${i}`);
    let e = await estado();
    for (let k = 0; k < 32 && !e.bio; k += 1) {
      await esperar(500);
      e = await estado();
    }
    await capturar(`estancia-${i}-bio`);
    const ladoEsperado = MOVIL ? 'arriba' : i % 2 === 0 ? 'izquierda' : 'derecha';
    const ok = e.lado === ladoEsperado && e.tipo === 'estancia' && e.bio;
    if (!ok) fallas += 1;
    console.log(`estancia ${i}: lado ${e.lado} (${ladoEsperado}) · tipo ${e.tipo} · bio: ${e.bio ? 'sí' : 'no'} ${ok ? 'OK' : 'FALLA'}`);
  }
  for (const i of [1, 4]) {
    await irA(estancia(i));
    await esperar(1500);
    for (const t of [0.1, 0.5, 0.9]) {
      await irA(viaje(i, t));
      await esperar(1500);
      await capturar(`viaje-${i}-${t}`);
      const e = await estado();
      console.log(`viaje ${i} t=${t}: tipo ${e.tipo}`);
    }
  }
}

console.log(errores.length ? `errores de consola:\n- ${errores.join('\n- ')}` : 'sin errores de consola');
console.log('capturas en', SALIDA);
ws.close();
chrome.kill();
process.exit(errores.length || fallas ? 1 : 0);
```

- [ ] **Step 6: Tests, build y primera mirada**

Run: `node --test apps/web/src/lib/sobreMi.test.js apps/web/src/lib/columna/*.test.js apps/web/src/components/SobreMi/Escena3D/escena3d.test.js`
Expected: todo `pass`, `fail 0`.
Run: `npm run build -w apps/web`
Expected: `Compiled successfully`, sin warnings nuevos de imports.
Run (en otra terminal): `npm run dev -w apps/web -- -p 3100` y luego `node apps/web/scripts/verificar-sobre-mi.mjs http://localhost:3100/`
Expected: capturas en la carpeta que imprime; en todas las estancias se ve la columna con siluetas (las escenas reales llegan en la Task 6), `lado` coincide con el esperado y la salida termina con `sin errores de consola`. Mirar `viaje-1-0.5.png`: cámara pegada a la columna, columna encendida hasta la cabeza blanca.

- [ ] **Step 7: Commit**

```bash
git add -A apps/web/src/components/SobreMi apps/web/src/lib apps/web/scripts/verificar-sobre-mi.mjs
git commit -m "feat(web): Sobre mí como recorrido por la columna (scroll, imán, minimapa y textos)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Las escenas reales en sus estaciones

**Files:**
- Rewrite: `apps/web/src/components/SobreMi/Columna3D/Estaciones.jsx`
- Modify: `apps/web/src/components/SobreMi/Columna3D/MundoColumna.jsx` (props de `Estaciones` y de la firma)

**Interfaces:**
- Consumes: `cargadorEscena(id)`, `ProveedorDesarme({desarmado, reducido})`, `EscalaResponsiva({fraccion})`, `Silueta`.
- Produces: `Estaciones({ hitos, activo, tipo, origen, visitas, reducido, claro, fraccion, color })`.

- [ ] **Step 1: Reescribir `Estaciones.jsx`**

```jsx
'use client';

import { Suspense, lazy, useMemo } from 'react';
import { ancla } from '@/lib/columna/geometria.js';
import EscalaResponsiva from '../Escena3D/EscalaResponsiva.jsx';
import { ProveedorDesarme } from '../Escena3D/useDesarme.jsx';
import { cargadorEscena } from '../Escena3D/escenas/index.js';
import Silueta from './Silueta.jsx';

// Un grupo por hito en su ancla. El activo y sus vecinos montan la escena real (los
// vecinos quietos: `activa` = false); los lejanos, una silueta. La escena de origen de
// un viaje se dispersa mientras la cámara despega.
function Estacion({ hito, indice, n, cercana, activa, dispersa, visita, reducido, claro, fraccion, color }) {
  const { posicion, angulo } = useMemo(() => ancla(indice, n), [indice, n]);
  const cargar = cargadorEscena(hito.id);
  const Escena = useMemo(() => (cargar ? lazy(cargar) : null), [cargar]);
  const silueta = <Silueta anio={hito.anio} color={color} reducido={reducido} />;
  return (
    <group position={[posicion.x, posicion.y, posicion.z]} rotation={[0, angulo, 0]}>
      {cercana && Escena ? (
        <ProveedorDesarme desarmado={dispersa} reducido={reducido}>
          <EscalaResponsiva fraccion={fraccion}>
            <Suspense fallback={silueta}>
              <Escena key={visita} activa={activa} reducido={reducido} claro={claro} />
            </Suspense>
          </EscalaResponsiva>
        </ProveedorDesarme>
      ) : (
        silueta
      )}
    </group>
  );
}

export default function Estaciones({ hitos, activo, tipo, origen, visitas, reducido, claro, fraccion, color }) {
  return hitos.map((hito, i) => (
    <Estacion
      key={hito.id}
      hito={hito}
      indice={i}
      n={hitos.length}
      cercana={Math.abs(i - activo) <= 1}
      activa={tipo === 'estancia' && i === activo}
      dispersa={!reducido && tipo === 'viaje' && i === origen}
      visita={visitas[i]}
      reducido={reducido}
      claro={claro}
      fraccion={fraccion}
      color={color}
    />
  ));
}
```

- [ ] **Step 2: Pasarle los datos desde `MundoColumna`**

En `MundoColumna.jsx`:
- Firma: `export default function MundoColumna({ hitos, refTramo, activo, tipo, origen, visitas, lado, esMovil, reducido, claro, visible, onError }) {`
- Reemplazar `<Estaciones hitos={hitos} reducido={reducido} color={colores.acento} />` por:

```jsx
        <Estaciones
          hitos={hitos}
          activo={activo}
          tipo={tipo}
          origen={origen}
          visitas={visitas}
          reducido={reducido}
          claro={claro}
          fraccion={esMovil ? 1 : 0.5}
          color={colores.acento}
        />
```

- [ ] **Step 3: Verificar escena por escena**

Run: `npm run dev -w apps/web -- -p 3100` y `node apps/web/scripts/verificar-sobre-mi.mjs http://localhost:3100/`
Expected, revisando las capturas `estancia-0..6.png` y `estancia-*-bio.png`:
- Cada estancia muestra **su** modelo (notebook, bandera, materias, PC, banco, planta, constelación/grafo) en el lado esperado, del mismo tamaño aproximado que en `main` (comparar con una captura de `main` si hay dudas), con la columna detrás.
- La bandera cuelga desde el borde de arriba como antes.
- La bio aparece (`bio: sí`) recién en la captura tardía.
- En `viaje-4-0.1.png` el banco (origen) se está dispersando.
- La consola no tiene errores. Si una escena falla en su estación, arreglar **esa escena** (por ejemplo, una que lea `useThree().viewport`: reemplazarlo por `vistaParaAltura(size.height)` como hace `EscalaResponsiva`) y anotar el cambio en el commit.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/SobreMi
git commit -m "feat(web): las escenas de cada hito viven en su estación de la columna

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Brillo y estela — chispas, polvo, bloom y rendimiento

**Files:**
- Create: `apps/web/src/components/SobreMi/Columna3D/Estela.jsx`, `Polvo.jsx`, `Efectos.jsx`
- Rewrite: `apps/web/src/components/SobreMi/Columna3D/MundoColumna.jsx`

**Interfaces:**
- Consumes: `curvaColumna(n)`, `llenadoDe`, `altoTotal`, `EXTRA`, `@react-three/postprocessing` (`EffectComposer`, `Bloom`), drei `PerformanceMonitor`.
- Produces: `Estela({ n, refTramo, color, cantidad })`, `Polvo({ n, color, cantidad, reducido })`, `Efectos({ claro })`.

- [ ] **Step 1: Chispas de la cabeza**

`Estela.jsx`:

```jsx
'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { llenadoDe } from '@/lib/columna/recorrido.js';
import { curvaColumna } from './curva.js';

const VIDA_S = 1.2;
const POR_CUADRO = 6;

const vertexShader = /* glsl */ `
  attribute float vida;
  uniform float uTamano;
  varying float vVida;
  void main() {
    vVida = vida;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uTamano * vida * (300.0 / max(-mv.z, 0.1));
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vVida;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5 || vVida <= 0.0) discard;
    gl_FragColor = vec4(uColor * 2.0, vVida * (1.0 - d * 2.0));
  }
`;

// Chispas que suelta la cabeza de luz mientras avanza. Viven en el espacio de la
// columna: se quedan donde nacieron y, como el mundo se mueve, dibujan la estela.
export default function Estela({ n, refTramo, color, cantidad = 240 }) {
  const curva = curvaColumna(n);
  const datos = useMemo(
    () => ({
      posicion: new Float32Array(cantidad * 3),
      velocidad: new Float32Array(cantidad * 3),
      vida: new Float32Array(cantidad),
      siguiente: 0,
    }),
    [cantidad]
  );
  const geometria = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(datos.posicion, 3));
    g.setAttribute('vida', new THREE.BufferAttribute(datos.vida, 1));
    // Se mueven todo el tiempo: una esfera envolvente fija y grande evita que se recorten.
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 30, 0), 80);
    return g;
  }, [datos]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        uniforms: { uTamano: { value: 0.05 }, uColor: { value: new THREE.Color(color) } },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  useEffect(() => material.uniforms.uColor.value.set(color), [material, color]);
  useEffect(
    () => () => {
      geometria.dispose();
      material.dispose();
    },
    [geometria, material]
  );

  const cabeza = useRef(new THREE.Vector3());
  const anterior = useRef(null);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    curva.getPointAt(llenadoDe(refTramo.current, n), cabeza.current);
    const rapidez = anterior.current && dt > 0 ? anterior.current.distanceTo(cabeza.current) / dt : 0;
    anterior.current = (anterior.current ?? new THREE.Vector3()).copy(cabeza.current);

    if (rapidez > 0.3) {
      const nuevas = Math.min(POR_CUADRO, Math.ceil(rapidez * dt * 20));
      for (let k = 0; k < nuevas; k += 1) {
        const i = datos.siguiente;
        datos.siguiente = (i + 1) % cantidad;
        const angulo = Math.random() * Math.PI * 2;
        const fuerza = 0.2 + Math.random() * 0.4;
        datos.posicion.set([cabeza.current.x, cabeza.current.y, cabeza.current.z], i * 3);
        datos.velocidad.set(
          [Math.cos(angulo) * fuerza, (Math.random() - 0.5) * 0.4 * fuerza, Math.sin(angulo) * fuerza],
          i * 3
        );
        datos.vida[i] = 1;
      }
    }
    for (let i = 0; i < cantidad; i += 1) {
      if (datos.vida[i] <= 0) continue;
      datos.vida[i] = Math.max(0, datos.vida[i] - dt / VIDA_S);
      datos.posicion[i * 3] += datos.velocidad[i * 3] * dt;
      datos.posicion[i * 3 + 1] += datos.velocidad[i * 3 + 1] * dt;
      datos.posicion[i * 3 + 2] += datos.velocidad[i * 3 + 2] * dt;
    }
    geometria.attributes.position.needsUpdate = true;
    geometria.attributes.vida.needsUpdate = true;
  });

  return <points geometry={geometria} material={material} frustumCulled={false} />;
}
```

- [ ] **Step 2: Polvo**

`Polvo.jsx`:

```jsx
'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { EXTRA, altoTotal } from '@/lib/columna/geometria.js';

const vertexShader = /* glsl */ `
  attribute float fase;
  uniform float uTiempo;
  uniform float uTamano;
  varying float vAlfa;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uTamano * (300.0 / max(-mv.z, 0.1));
    vAlfa = 0.35 * (0.6 + 0.4 * sin(uTiempo * 0.8 + fase)) * exp(-pow(-mv.z * 0.03, 2.0));
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlfa;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(uColor, vAlfa * (1.0 - d * 2.0));
  }
`;

// Polvo que flota alrededor de la columna (un cilindro de radio 2 a 12) y parpadea
// despacio. Está en el espacio de la columna: el parallax sale solo al moverse el mundo.
export default function Polvo({ n, color, cantidad = 1200, reducido }) {
  const geometria = useMemo(() => {
    const posicion = new Float32Array(cantidad * 3);
    const fase = new Float32Array(cantidad);
    const desde = -EXTRA;
    const alto = altoTotal(n) + 2 * EXTRA;
    for (let i = 0; i < cantidad; i += 1) {
      const angulo = Math.random() * Math.PI * 2;
      const radio = 2 + Math.random() * 10;
      posicion.set([Math.cos(angulo) * radio, desde + Math.random() * alto, Math.sin(angulo) * radio], i * 3);
      fase[i] = Math.random() * Math.PI * 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(posicion, 3));
    g.setAttribute('fase', new THREE.BufferAttribute(fase, 1));
    return g;
  }, [n, cantidad]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTiempo: { value: 0 }, uTamano: { value: 0.04 }, uColor: { value: new THREE.Color(color) } },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  useEffect(() => material.uniforms.uColor.value.set(color), [material, color]);
  useEffect(
    () => () => {
      geometria.dispose();
      material.dispose();
    },
    [geometria, material]
  );
  useFrame((_, delta) => {
    if (!reducido) material.uniforms.uTiempo.value += Math.min(delta, 0.05);
  });
  return <points geometry={geometria} material={material} />;
}
```

- [ ] **Step 3: Bloom**

`Efectos.jsx`:

```jsx
'use client';

import { Bloom, EffectComposer } from '@react-three/postprocessing';

// El brillo de verdad: lo que supera el umbral (la columna encendida, la cabeza, las
// vértebras) irradia luz. En tema claro, más suave para no lavar el fondo.
export default function Efectos({ claro }) {
  return (
    <EffectComposer multisampling={4}>
      <Bloom mipmapBlur luminanceThreshold={0.9} luminanceSmoothing={0.2} intensity={claro ? 0.45 : 1.1} radius={0.7} />
    </EffectComposer>
  );
}
```

- [ ] **Step 4: `MundoColumna` con efectos y escalones de rendimiento**

Reemplazar todo `MundoColumna.jsx` por:

```jsx
'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { RADIO_ANCLA, transformacionMundo } from '@/lib/columna/geometria.js';
import { OPCIONES_ESCRITORIO, OPCIONES_MOVIL, estadoDe } from '@/lib/columna/recorrido.js';
import LucesAzules from '../Escena3D/LucesAzules.jsx';
import ControlGiro from '../Escena3D/ControlGiro.jsx';
import { DISTANCIA_MINIMA, FOV } from '../Escena3D/vista.js';
import { esEscenaFija, limiteDeGiro } from '../Escena3D/escenas/index.js';
import { leerColores } from './colores.js';
import Columna from './Columna.jsx';
import Vertebras from './Vertebras.jsx';
import Estaciones from './Estaciones.jsx';
import Estela from './Estela.jsx';
import Polvo from './Polvo.jsx';
import Efectos from './Efectos.jsx';
import CamaraRecorrido from './CamaraRecorrido.jsx';

// Mueve y gira todo el mundo para que el hito del estado `s` quede en el origen
// mirando a la cámara: Mundo = T(0,0,-R) · Ry(-θ) · T(-c).
function Rig({ n, refTramo, reducido, children }) {
  const refPivote = useRef(null);
  const refContenido = useRef(null);
  useFrame(() => {
    const t = transformacionMundo(estadoDe(refTramo.current, { reducido }), n);
    refPivote.current.rotation.y = t.rotacionY;
    refContenido.current.position.set(...t.contenido);
  });
  return (
    <group ref={refPivote} position={[0, 0, -RADIO_ANCLA]}>
      <group ref={refContenido}>{children}</group>
    </group>
  );
}

function Niebla({ color }) {
  const scene = useThree((estado) => estado.scene);
  useEffect(() => {
    scene.fog = new THREE.FogExp2(color, 0.035);
    return () => {
      scene.fog = null;
    };
  }, [scene, color]);
  return null;
}

// Escalones de rendimiento (nunca vuelven a subir en la sesión):
// 1 → sin bloom (queda el halo aditivo); 2 → menos chispas y polvo; 3 → dpr 1.
export default function MundoColumna({ hitos, refTramo, activo, tipo, origen, visitas, lado, esMovil, reducido, claro, visible, onError }) {
  const n = hitos.length;
  const [colores, setColores] = useState(() => leerColores(claro));
  useEffect(() => setColores(leerColores(claro)), [claro]);
  const [nivel, setNivel] = useState(0);
  const desmontando = useRef(false);
  useEffect(() => {
    desmontando.current = false;
    return () => {
      desmontando.current = true;
    };
  }, []);
  const idActivo = hitos[activo].id;

  return (
    <Canvas
      dpr={nivel >= 3 ? 1 : [1, 1.75]}
      frameloop={visible ? 'always' : 'never'}
      camera={{ position: [0, 0.7, DISTANCIA_MINIMA], fov: FOV, near: 0.1, far: 200 }}
      gl={{ alpha: true, antialias: true }}
      style={{ position: 'absolute', inset: 0 }}
      onCreated={({ gl }) => {
        const lienzo = gl.domElement;
        lienzo.addEventListener('webglcontextlost', (evento) => {
          // R3F fuerza la pérdida del contexto al desmontar el canvas: eso no es un fallo.
          if (desmontando.current || !lienzo.isConnected) return;
          evento.preventDefault();
          onError();
        });
      }}
    >
      <PerformanceMonitor onDecline={() => setNivel((previo) => Math.min(3, previo + 1))} />
      <Niebla color={colores.fondo} />
      {/* Las luces quedan fuera del mundo: iluminan al hito actual igual que antes. */}
      <LucesAzules />
      <ControlGiro quieto={reducido} girable={!esEscenaFija(idActivo)} limiteAzimut={limiteDeGiro(idActivo)} />
      <CamaraRecorrido
        n={n}
        refTramo={refTramo}
        lado={lado}
        opciones={esMovil ? OPCIONES_MOVIL : OPCIONES_ESCRITORIO}
        reducido={reducido}
      />
      <Rig n={n} refTramo={refTramo} reducido={reducido}>
        <Columna n={n} refTramo={refTramo} colores={colores} reducido={reducido} />
        <Vertebras n={n} refTramo={refTramo} colores={colores} reducido={reducido} />
        {reducido ? null : <Estela n={n} refTramo={refTramo} color={colores.acento} cantidad={nivel >= 2 ? 60 : 240} />}
        <Polvo n={n} color={colores.acento} cantidad={nivel >= 2 ? 400 : 1200} reducido={reducido} />
        <Estaciones
          hitos={hitos}
          activo={activo}
          tipo={tipo}
          origen={origen}
          visitas={visitas}
          reducido={reducido}
          claro={claro}
          fraccion={esMovil ? 1 : 0.5}
          color={colores.acento}
        />
      </Rig>
      {nivel >= 1 ? null : <Efectos claro={claro} />}
    </Canvas>
  );
}
```

- [ ] **Step 5: Verificar brillo, transparencia y rendimiento**

Run: `npm run dev -w apps/web -- -p 3100` y `node apps/web/scripts/verificar-sobre-mi.mjs http://localhost:3100/`
Expected:
- La columna encendida tiene halo de bloom; la cabeza es un punto blanco brillante; detrás de la cabeza hay estela; en `viaje-*-0.5.png` se ven chispas.
- **La foto/video del hito se sigue viendo detrás del canvas en `estancia-*-bio.png`** (el composer conserva la transparencia). Si el fondo desaparece (queda negro): pasar a `<EffectComposer multisampling={4} enableNormalPass={false}>` y, si persiste, apagar el bloom en las estancias (`{nivel >= 1 || tipo === 'estancia' ? null : <Efectos .../>}`) y anotarlo en el commit.
- En el navegador real (no headless), con DevTools → Rendering → "Frame Rendering Stats", ≥ 50 fps al viajar en una notebook con GPU integrada. Si no, comprobar que `PerformanceMonitor` baja de nivel (agregar temporalmente un `console.log(nivel)`; quitarlo antes del commit).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/SobreMi/Columna3D
git commit -m "feat(web): brillo, estela de chispas, polvo y escalones de rendimiento en la columna

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Verificación completa y build

**Files:** ninguno nuevo (sólo arreglos que surjan, cada uno con su commit).

- [ ] **Step 1: Tests**

Run: `node --test apps/web/src/lib/sobreMi.test.js apps/web/src/lib/columna/*.test.js apps/web/src/components/SobreMi/Escena3D/escena3d.test.js`
Expected: `fail 0`.

- [ ] **Step 2: Recorrido completo en escritorio, tema oscuro**

Run: `node apps/web/scripts/verificar-sobre-mi.mjs http://localhost:3100/`
Expected: 7 estancias con su modelo del lado correcto (`lado` OK en la salida), bio tardía en todas, viajes con cámara pegada a la columna en `t = 0.5`, cero errores de consola.

- [ ] **Step 3: Tema claro, celular, movimiento reducido y sin WebGL**

Run (cada uno; las variables de entorno las lee el script):
```bash
TEMA=light node apps/web/scripts/verificar-sobre-mi.mjs http://localhost:3100/ "$TMP/sm-claro"
MOVIL=1 node apps/web/scripts/verificar-sobre-mi.mjs http://localhost:3100/ "$TMP/sm-movil"
REDUCIDO=1 node apps/web/scripts/verificar-sobre-mi.mjs http://localhost:3100/ "$TMP/sm-reducido"
SIN_WEBGL=1 node apps/web/scripts/verificar-sobre-mi.mjs http://localhost:3100/ "$TMP/sm-plano"
```
Expected:
- Claro: la columna y el fondo de viaje se leen (sin lavado blanco), textos legibles.
- Móvil (390×844): modelo arriba, hoja de texto abajo que no lo tapa, minimapa chico sobre la hoja, `lado: arriba`.
- Reducido: en los viajes no hay cámara en primera persona (las capturas de viaje muestran el mundo fundido/estático), el año grande no aparece.
- Sin WebGL: la salida dice `respaldo plano` y la captura muestra la lista de hitos con fotos.

- [ ] **Step 4: Casos de la sección "Review Focus" (a mano, en Chrome real)**

1. Scrollear hasta la mitad de la sección (p. ej. hito 2024) y recargar (F5): sin mover nada, se ve el hito 2024 con su modelo y, tras su tiempo, su bio.
2. Desde 2022, click en "Hoy" en el minimapa: el viaje pasa por los hitos intermedios y termina en Hoy con el grafo real (no la silueta), sin rebotes del imán.
3. En Hoy, esperar a que el grafo esté armado, girarlo y seleccionar un nodo; scrollear hacia arriba: el viaje arranca sin saltos de cámara y, ya en 2026, la rueda del mouse scrollea normalmente (el grafo no la captura) y arrastrar no mueve nodos invisibles.
4. Cambiar el tema con el toggle del header estando en un hito: la columna y el fondo cambian de color sin recargar.
5. DevTools en modo dispositivo táctil: arrastrar horizontal gira el modelo; vertical scrollea; soltar a mitad de un viaje con el dedo apoyado no salta hasta levantarlo.

Cualquier falla: arreglarla, correr de nuevo el Step 1 y commitear con un mensaje `fix(web): …` que diga qué caso de Review Focus resolvía.

- [ ] **Step 5: Build de producción**

Run: `npm run build -w apps/web`
Expected: `Compiled successfully`, sin errores ni warnings nuevos.

- [ ] **Step 6: Commit final (si quedó algo) y resumen**

```bash
git status --short
git log --oneline main..HEAD
```

Expected: árbol limpio y la lista de commits de este plan. **No hacer push.** Informar al usuario la rama, el worktree (`C:\Users\Asus\Desktop\Trabajo\PORTAFOLIO-columna`) y cómo verlo: `npm run dev -w apps/web -- -p 3100` dentro del worktree.
