# Sobre mí 3D, tanda 1 (infraestructura + notebook del origen) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el bloque ASCII provisorio por un canvas WebGL grande y girable, con luces azules y desarme al hover, y dejar funcionando la primera escena real: la notebook del origen con arranque de Windows, escritorio, terminal y comandos que se escriben.

**Architecture:** Un solo `<Canvas>` de `@react-three/fiber` que se carga de forma diferida (`next/dynamic`, `ssr: false`) y renderiza sólo la escena del hito activo. Las escenas son componentes con props `{ activa, reducido }` y piezas `PiezaDesarmable` que se separan según un valor continuo `desarme` (un `ref`, no estado de React, para no re-renderizar por cuadro). La pantalla de la notebook es una textura de `<canvas>` 2D dibujada a partir de una máquina de estados pura (`estadoPantalla(t)`), que es la parte que se prueba con tests. Si no hay WebGL o algo falla, se muestra el `EscenarioHito` ASCII.

**Tech Stack:** React 19 / Next 15, CSS Modules, JSX sin TypeScript, `three@0.186.1`, `@react-three/fiber@9.8.1`, `@react-three/drei@10.7.9`, `framer-motion` (ya instalado, sólo `useReducedMotion`). Tests de funciones puras con `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-10-sobre-mi-3d-design.md` (y, para el layout y el estado de la sección, `docs/superpowers/specs/2026-10-10-sobre-mi-linea-tiempo-design.md`).

## Global Constraints

- Sin TypeScript, sin Tailwind. CSS Modules y JSX plano; identificadores y comentarios en español.
- Versiones **exactas**: `three@0.186.1`, `@react-three/fiber@9.8.1`, `@react-three/drei@10.7.9` (verificadas: `fiber` exige `react >=19 <19.4`, `drei` exige `react ^19`). Instalar con `--save-exact`.
- Todo `import` de `three`, `@react-three/*` vive **sólo** dentro de `EscenaCanvas.jsx` y de lo que éste importa, para que quede en el chunk diferido. `Escena3D.jsx` y `escenas/index.js` **no** importan `three` de forma estática (sólo `import()` dinámicos).
- Carpeta de trabajo: `apps/web/src/components/SobreMi/Escena3D/`. Rama: `feature/sobre-mi` (ya existe).
- Colores de la serie: azul `#5b8cff` (emisivo), cian `#3de0ff` (contorno), cuerpos `#10141c`. Fondo del canvas transparente.
- Densidad de píxeles `dpr={[1, 2]}`; `frameloop` es `'never'` cuando la sección no está visible.
- `prefers-reduced-motion: reduce` → sin giro automático, sin animación de arranque (la notebook muestra su estado final), desarme sin resorte largo.
- El repo no tiene test runner ni script `test`. Las funciones puras se prueban con `node --test <archivo>` directo. El resto: `cd apps/web && npm run build` (0 errores) y comprobación manual en el navegador.
- **No correr `npm run build` mientras corre `npm run dev:web`**: comparten `apps/web/.next` y se corrompen. Apagar el servidor de desarrollo antes de compilar.
- Decisión de diseño (no está en la spec): arrastrar el modelo y el hover chocan (para arrastrar hay que estar con el cursor encima). Por eso **el hover sobre el modelo abre el detalle recién tras 900 ms** (`ESPERA_HOVER_MODELO_MS`), y un `pointerdown` sobre el canvas cancela la espera y cierra el detalle. El hover sobre el punto activo de la línea de tiempo sigue siendo inmediato.

## Review Focus

- Arrastrar el modelo con el mouse no debe abrir el detalle a mitad del gesto ni dejarlo abierto después (Task 3).
- Pérdida del contexto WebGL en caliente → vuelve al ASCII sin pantalla en blanco (Task 2, comprobación con `WEBGL_lose_context`).
- Cambiar de hito muy rápido (scroll) no deja dos escenas montadas ni una escena de otro hito (Task 2).
- Con `prefers-reduced-motion`, la notebook muestra directamente el estado final y no gira (Task 4).
- Sección fuera de pantalla: el render se pausa (`frameloop: 'never'`) y al volver continúa sin saltos de tiempo (Task 2 y 4: `delta` acotado).
- Pantalla táctil: el scroll vertical sobre el canvas no queda bloqueado (Task 2, `touch-action: pan-y`; sólo verificable en dispositivo real).

---

### Task 1: Funciones puras y sus tests

**Files:**
- Create: `apps/web/src/components/SobreMi/Escena3D/soporteWebGL.js`
- Create: `apps/web/src/components/SobreMi/Escena3D/desarme.js`
- Create: `apps/web/src/components/SobreMi/Escena3D/pantallaNotebook.js`
- Test: `apps/web/src/components/SobreMi/Escena3D/escena3d.test.js`

**Interfaces:**
- Produces: `hayWebGL(crearLienzo?: () => {getContext(tipo): any}) → boolean`
- Produces: `amortiguar(actual: number, objetivo: number, lambda: number, dt: number) → number`
- Produces: `calcularDispersion(posicion: [x,y,z], semilla: number, radio?: number) → [x,y,z]`
- Produces: `LINEAS`, `CARACTERES_POR_SEGUNDO`, `DURACION_TOTAL`
- Produces: `estadoPantalla(t: number) → { fase: 'apagada'|'arranque'|'escritorio'|'terminal', progreso: number, apertura: number, lineas: string[], cursorVisible: boolean }`
- Produces: `teclaPresionada(t: number, totalTeclas: number) → number` (índice de tecla o `-1`)

- [ ] **Step 1: Escribir el test que falla**

Crear `escena3d.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { hayWebGL } from './soporteWebGL.js';
import { amortiguar, calcularDispersion } from './desarme.js';
import { estadoPantalla, teclaPresionada, DURACION_TOTAL, LINEAS } from './pantallaNotebook.js';

const cerca = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} no está cerca de ${b}`);

test('hayWebGL: false si ningún contexto está disponible', () => {
  assert.equal(hayWebGL(() => ({ getContext: () => null })), false);
});

test('hayWebGL: true con webgl2 o sólo con webgl', () => {
  assert.equal(hayWebGL(() => ({ getContext: (tipo) => (tipo === 'webgl2' ? {} : null) })), true);
  assert.equal(hayWebGL(() => ({ getContext: (tipo) => (tipo === 'webgl' ? {} : null) })), true);
});

test('hayWebGL: false si crear el lienzo lanza', () => {
  assert.equal(hayWebGL(() => { throw new Error('sin DOM'); }), false);
});

test('amortiguar: no se mueve con dt 0 y converge con dt grande', () => {
  assert.equal(amortiguar(0, 1, 7, 0), 0);
  cerca(amortiguar(0, 1, 7, 0.1), 1 - Math.exp(-0.7));
  assert.ok(amortiguar(0, 1, 7, 2) > 0.999);
});

test('calcularDispersion: determinista y con alcance acotado', () => {
  const a = calcularDispersion([1, 0.5, -0.3], 3, 2);
  const b = calcularDispersion([1, 0.5, -0.3], 3, 2);
  assert.deepEqual(a, b);
  const largo = Math.hypot(...a);
  assert.ok(largo >= 2 * 0.6 - 1e-9 && largo <= 2 * 1.4 + 1e-9, `largo ${largo}`);
});

test('calcularDispersion: desde el origen no produce NaN y semillas distintas difieren', () => {
  const desdeOrigen = calcularDispersion([0, 0, 0], 1);
  assert.ok(desdeOrigen.every(Number.isFinite));
  assert.notDeepEqual(calcularDispersion([1, 1, 1], 1), calcularDispersion([1, 1, 1], 2));
});

test('estadoPantalla: apagada → arranque → escritorio', () => {
  assert.equal(estadoPantalla(0).fase, 'apagada');
  const arranque = estadoPantalla(2);
  assert.equal(arranque.fase, 'arranque');
  cerca(arranque.progreso, 0.4);
  assert.equal(estadoPantalla(4.5).fase, 'escritorio');
});

test('estadoPantalla: la terminal se abre antes de escribir nada', () => {
  const abriendo = estadoPantalla(5.4);
  assert.equal(abriendo.fase, 'terminal');
  cerca(abriendo.apertura, 0.5);
  assert.deepEqual(abriendo.lineas, []);
});

test('estadoPantalla: el comando se escribe letra por letra y luego aparece la salida', () => {
  assert.deepEqual(estadoPantalla(6.0).lineas, ['> wh']);
  assert.deepEqual(estadoPantalla(6.9).lineas, ['> whoami', 'quien repara y mejora']);
});

test('estadoPantalla: al terminar quedan todas las líneas', () => {
  const final = estadoPantalla(DURACION_TOTAL + 5);
  assert.equal(final.lineas.length, LINEAS.length * 2);
  assert.equal(final.lineas.at(-1), 'beep beep beep');
});

test('teclaPresionada: -1 sin tecleo y un índice válido mientras se teclea', () => {
  assert.equal(teclaPresionada(0, 60), -1);
  assert.equal(teclaPresionada(7.0, 60), -1);
  // primera letra de "whoami": 'w' = 119 → (119 * 7 + 0) % 60 = 53
  assert.equal(teclaPresionada(5.8 + 1 / 12 + 0.01, 60), 53);
});
```

- [ ] **Step 2: Verificar que falla**

Run: `node --test apps/web/src/components/SobreMi/Escena3D/escena3d.test.js`
Expected: FAIL con `ERR_MODULE_NOT_FOUND` (los módulos no existen todavía).

- [ ] **Step 3: Implementar `soporteWebGL.js`**

```js
// ¿Hay WebGL? `crearLienzo` se inyecta para poder probar la función sin DOM.
export function hayWebGL(crearLienzo = () => document.createElement('canvas')) {
  try {
    const lienzo = crearLienzo();
    return Boolean(lienzo.getContext('webgl2') || lienzo.getContext('webgl'));
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Implementar `desarme.js`**

```js
// Acerca `actual` a `objetivo` de forma exponencial e independiente de la tasa
// de cuadros (la misma fórmula que `MathUtils.damp` de three).
export function amortiguar(actual, objetivo, lambda, dt) {
  return objetivo + (actual - objetivo) * Math.exp(-lambda * dt);
}

// A dónde va una pieza cuando se desarma, relativo a su posición armada: sale
// hacia afuera del centro de la escena con un poco de azar. Determinista (misma
// semilla → misma dispersión) para que el desarme sea siempre igual.
export function calcularDispersion([x, y, z], semilla, radio = 2.2) {
  const azar = (n) => {
    const s = Math.sin(semilla * 12.9898 + n * 78.233) * 43758.5453;
    return s - Math.floor(s);
  };
  const dx = x + (azar(1) - 0.5);
  const dy = y + (azar(2) - 0.5);
  const dz = z + (azar(3) - 0.5);
  const largo = Math.hypot(dx, dy, dz) || 1;
  const alcance = radio * (0.6 + azar(4) * 0.8);
  return [(dx / largo) * alcance, (dy / largo) * alcance, (dz / largo) * alcance];
}
```

- [ ] **Step 5: Implementar `pantallaNotebook.js`**

```js
// Guion de la pantalla de la notebook del origen, como función pura del tiempo
// `t` (segundos desde que la escena está activa). El dibujo real vive en
// `dibujarPantalla.js`; acá sólo se decide QUÉ se ve en cada instante.
export const LINEAS = [
  { comando: 'whoami', salida: 'quien repara y mejora' },
  { comando: 'beep', salida: 'beep beep beep' },
];
export const CARACTERES_POR_SEGUNDO = 12;

const PAUSA_TRAS_COMANDO = 0.5;
const PAUSA_TRAS_SALIDA = 0.7;
// Cuánto dura "hundida" una tecla después de escribirse su letra.
const VENTANA_TECLA = 0.09;

const T_ARRANQUE = 0.8;
const T_ESCRITORIO = 3.8;
const T_APERTURA = 5.0;
const T_COMANDOS = 5.8;

function construirHorario() {
  let inicio = T_COMANDOS;
  return LINEAS.map((linea) => {
    const salidaEn = inicio + linea.comando.length / CARACTERES_POR_SEGUNDO + PAUSA_TRAS_COMANDO;
    const entrada = { ...linea, inicio, salidaEn };
    inicio = salidaEn + PAUSA_TRAS_SALIDA;
    return entrada;
  });
}

const HORARIO = construirHorario();
export const DURACION_TOTAL = HORARIO[HORARIO.length - 1].salidaEn + PAUSA_TRAS_SALIDA;

export function estadoPantalla(t) {
  if (t < T_ARRANQUE) {
    return { fase: 'apagada', progreso: 0, apertura: 0, lineas: [], cursorVisible: false };
  }
  if (t < T_ESCRITORIO) {
    return {
      fase: 'arranque',
      progreso: (t - T_ARRANQUE) / (T_ESCRITORIO - T_ARRANQUE),
      apertura: 0,
      lineas: [],
      cursorVisible: false,
    };
  }
  if (t < T_APERTURA) {
    return { fase: 'escritorio', progreso: 1, apertura: 0, lineas: [], cursorVisible: false };
  }

  const apertura = Math.min(1, (t - T_APERTURA) / (T_COMANDOS - T_APERTURA));
  const lineas = [];
  for (const entrada of HORARIO) {
    if (t < entrada.inicio) break;
    const escritos = Math.min(
      entrada.comando.length,
      Math.floor((t - entrada.inicio) * CARACTERES_POR_SEGUNDO)
    );
    lineas.push(`> ${entrada.comando.slice(0, escritos)}`);
    if (t >= entrada.salidaEn) lineas.push(entrada.salida);
  }
  return {
    fase: 'terminal',
    progreso: 1,
    apertura,
    lineas,
    cursorVisible: Math.floor(t * 2) % 2 === 0,
  };
}

// Índice de la tecla que está hundida en el instante `t`, o -1. La tecla de
// cada letra sale de su código, así "escribir" siempre mueve las mismas teclas.
export function teclaPresionada(t, totalTeclas) {
  for (const entrada of HORARIO) {
    for (let k = 0; k < entrada.comando.length; k += 1) {
      const instante = entrada.inicio + (k + 1) / CARACTERES_POR_SEGUNDO;
      if (t >= instante && t < instante + VENTANA_TECLA) {
        return (entrada.comando.charCodeAt(k) * 7 + k) % totalTeclas;
      }
    }
  }
  return -1;
}
```

- [ ] **Step 6: Verificar que pasa**

Run: `node --test apps/web/src/components/SobreMi/Escena3D/escena3d.test.js`
Expected: PASS, 11 tests, 0 fail.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/SobreMi/Escena3D
git commit -m "feat(web): funciones puras del 3D (webgl, desarme, guion de la notebook) con tests

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Infraestructura del canvas 3D con escena de prueba

**Files:**
- Modify: `apps/web/package.json` (dependencias)
- Create: `Escena3D/Escena3D.jsx` + `Escena3D.module.css`
- Create: `Escena3D/LimiteErrores.jsx`
- Create: `Escena3D/EscenaCanvas.jsx`
- Create: `Escena3D/LucesAzules.jsx`
- Create: `Escena3D/ControlGiro.jsx`
- Create: `Escena3D/useDesarme.jsx`
- Create: `Escena3D/PiezaDesarmable.jsx`
- Create: `Escena3D/materiales.js`
- Create: `Escena3D/escenas/index.js`
- Create: `Escena3D/escenas/EscenaPrueba.jsx`

(Todas las rutas son relativas a `apps/web/src/components/SobreMi/`.)

**Interfaces:**
- Consumes: `hayWebGL`, `amortiguar`, `calcularDispersion` (Task 1); `EscenarioHito` (existente, `{ hito, desarmado }`).
- Produces: `<Escena3D hito desarmado onInteraccion />` (default). `hito.id` selecciona la escena; sin escena registrada → ASCII.
- Produces: `idsConEscena: Set<number>` y `cargadorEscena(id) → () => Promise<{default: Component}>` en `escenas/index.js`.
- Produces: contrato de escena: `default function Escena({ activa: boolean, reducido: boolean })`.
- Produces: `<PiezaDesarmable posicion giro semilla dispersion>` y `useDesarme() → { current: number }`.

- [ ] **Step 1: Instalar dependencias**

```bash
cd C:/Users/Asus/Desktop/Trabajo/PORTAFOLIO
npm install -w apps/web three@0.186.1 @react-three/fiber@9.8.1 @react-three/drei@10.7.9 --save-exact
```

Verificar: `grep -n "three" apps/web/package.json` muestra las tres con versión exacta (sin `^`). Si `npm` avisa de peer dependencies de React, revisar que la versión de React instalada esté en `>=19 <19.4` (`node -e "console.log(require('react/package.json').version)"`); si no, fijar `react` y `react-dom` a la última 19.3.x.

- [ ] **Step 2: `materiales.js`**

```js
import * as THREE from 'three';

// Materiales compartidos por todas las escenas, para que se vean como una serie.
export const cuerpoOscuro = new THREE.MeshStandardMaterial({
  color: '#10141c',
  metalness: 0.65,
  roughness: 0.35,
});

export const azulEmisivo = new THREE.MeshStandardMaterial({
  color: '#5b8cff',
  emissive: '#5b8cff',
  emissiveIntensity: 1.8,
  roughness: 0.4,
});

export const cianEmisivo = new THREE.MeshStandardMaterial({
  color: '#3de0ff',
  emissive: '#3de0ff',
  emissiveIntensity: 1.6,
  roughness: 0.4,
});
```

- [ ] **Step 3: `useDesarme.jsx`**

```jsx
'use client';

import { createContext, useContext, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { amortiguar } from './desarme.js';

// `desarme` va de 0 (armada) a 1 (dispersa). Es un ref y no estado de React:
// cambia cada cuadro y no debe re-renderizar nada.
const ContextoDesarme = createContext({ current: 0 });

export function ProveedorDesarme({ desarmado, children }) {
  const valor = useRef(0);
  useFrame((_, delta) => {
    // `delta` acotado: al volver de una pestaña oculta no debe dar un salto.
    valor.current = amortiguar(valor.current, desarmado ? 1 : 0, 7, Math.min(delta, 0.05));
  });
  return <ContextoDesarme.Provider value={valor}>{children}</ContextoDesarme.Provider>;
}

export function useDesarme() {
  return useContext(ContextoDesarme);
}
```

- [ ] **Step 4: `PiezaDesarmable.jsx`**

```jsx
'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { calcularDispersion } from './desarme.js';
import { useDesarme } from './useDesarme.jsx';

// Envuelve una pieza: en reposo está en `posicion`; con `desarme` > 0 se aleja
// hacia su punto de dispersión y gira hasta `giro` (radianes). Si la pieza ya
// necesita su propia rotación fija, ponerla en un <group> hijo: esta rotación
// la pisa.
export default function PiezaDesarmable({
  posicion = [0, 0, 0],
  giro = [0, 0, 0],
  semilla = 1,
  dispersion,
  children,
}) {
  const grupo = useRef(null);
  const desarme = useDesarme();
  const destino = useMemo(
    () => dispersion ?? calcularDispersion(posicion, semilla),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispersion, semilla, posicion[0], posicion[1], posicion[2]]
  );

  useFrame(() => {
    const d = desarme.current;
    grupo.current.position.set(
      posicion[0] + destino[0] * d,
      posicion[1] + destino[1] * d,
      posicion[2] + destino[2] * d
    );
    grupo.current.rotation.set(giro[0] * d, giro[1] * d, giro[2] * d);
  });

  return (
    <group ref={grupo} position={posicion}>
      {children}
    </group>
  );
}
```

- [ ] **Step 5: `LucesAzules.jsx`**

```jsx
// Rig de luces de la serie: ambiente tenue, luz clave azul y contraluz cian.
// Los valores son un punto de partida: ajustar a ojo en el navegador.
export default function LucesAzules() {
  return (
    <>
      <ambientLight intensity={0.35} color="#9db8ff" />
      <directionalLight position={[3, 4, 3]} intensity={2.4} color="#6f9bff" />
      <pointLight position={[-3.5, 1.2, -2.5]} intensity={45} distance={14} color="#3de0ff" />
      <pointLight position={[2.5, -1, 3]} intensity={18} distance={10} color="#5b8cff" />
    </>
  );
}
```

- [ ] **Step 6: `ControlGiro.jsx`**

```jsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { OrbitControls } from '@react-three/drei';

const ESPERA_TRAS_SOLTAR_MS = 3000;

// Giro con arrastre (la cámara orbita), sin zoom ni desplazamiento. Gira solo y
// despacio cuando nadie lo toca, y retoma unos segundos después de soltar.
export default function ControlGiro({ quieto = false, children }) {
  const refControles = useRef(null);
  const refEspera = useRef(0);
  const [girando, setGirando] = useState(true);

  useEffect(() => {
    // OrbitControls pone `touch-action: none`, que bloquearía el scroll
    // vertical de la página sobre el canvas. Con `pan-y` el navegador se queda
    // con el gesto vertical y el modelo sólo gira con arrastre horizontal.
    const elemento = refControles.current?.domElement;
    if (elemento) elemento.style.touchAction = 'pan-y';
    return () => clearTimeout(refEspera.current);
  }, []);

  return (
    <>
      <OrbitControls
        ref={refControles}
        enableZoom={false}
        enablePan={false}
        enableDamping
        autoRotate={girando && !quieto}
        autoRotateSpeed={1.1}
        minPolarAngle={Math.PI / 2.7}
        maxPolarAngle={Math.PI / 1.9}
        onStart={() => {
          clearTimeout(refEspera.current);
          setGirando(false);
        }}
        onEnd={() => {
          refEspera.current = setTimeout(() => setGirando(true), ESPERA_TRAS_SOLTAR_MS);
        }}
      />
      {children}
    </>
  );
}
```

- [ ] **Step 7: `escenas/EscenaPrueba.jsx` y `escenas/index.js`**

`escenas/EscenaPrueba.jsx`:

```jsx
'use client';

import PiezaDesarmable from '../PiezaDesarmable.jsx';
import { cuerpoOscuro, azulEmisivo } from '../materiales.js';

// Escena mínima para validar la infraestructura: un cubo de 2×2×2 cubitos que
// se desarma. Se reemplaza por la escena real de cada hito.
const POSICIONES = [-0.45, 0.45].flatMap((x) =>
  [-0.45, 0.45].flatMap((y) => [-0.45, 0.45].map((z) => [x, y, z]))
);

export default function EscenaPrueba() {
  return (
    <group>
      {POSICIONES.map((posicion, i) => (
        <PiezaDesarmable key={i} posicion={posicion} semilla={i + 1} giro={[1.2, 0.8, 0]}>
          <mesh material={i % 2 ? azulEmisivo : cuerpoOscuro}>
            <boxGeometry args={[0.8, 0.8, 0.8]} />
          </mesh>
        </PiezaDesarmable>
      ))}
    </group>
  );
}
```

`escenas/index.js`:

```js
// Registro de escenas: id de hito → import dinámico. Un hito sin entrada usa el
// respaldo ASCII. Este archivo NO importa three (sólo import() dinámicos), así
// que se puede usar desde fuera del chunk diferido.
const ESCENAS = {
  0: () => import('./EscenaPrueba.jsx'),
};

export const idsConEscena = new Set(Object.keys(ESCENAS).map(Number));

export function cargadorEscena(id) {
  return ESCENAS[id];
}
```

- [ ] **Step 8: `EscenaCanvas.jsx`**

```jsx
'use client';

import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useReducedMotion } from 'framer-motion';
import LucesAzules from './LucesAzules.jsx';
import ControlGiro from './ControlGiro.jsx';
import { ProveedorDesarme } from './useDesarme.jsx';
import { cargadorEscena } from './escenas/index.js';

// Cuánto se dispersa la escena saliente antes de montar la del hito nuevo.
const MS_SALIDA = 350;

export default function EscenaCanvas({ idHito, desarmado, visible, onError }) {
  const reducido = useReducedMotion();
  const [idMostrado, setIdMostrado] = useState(idHito);
  const [saliendo, setSaliendo] = useState(false);

  // Cambio de hito: la escena actual se dispersa y recién después se monta la
  // nueva. Si el hito vuelve a cambiar a mitad de camino, el efecto se
  // reinicia y sólo queda montada la última.
  useEffect(() => {
    if (idHito === idMostrado) return undefined;
    setSaliendo(true);
    const espera = setTimeout(
      () => {
        setIdMostrado(idHito);
        setSaliendo(false);
      },
      reducido ? 0 : MS_SALIDA
    );
    return () => clearTimeout(espera);
  }, [idHito, idMostrado, reducido]);

  const Escena = useMemo(() => lazy(cargadorEscena(idMostrado)), [idMostrado]);

  return (
    <Canvas
      dpr={[1, 2]}
      frameloop={visible ? 'always' : 'never'}
      camera={{ position: [0, 0.8, 5.6], fov: 38 }}
      gl={{ alpha: true, antialias: true }}
      style={{ position: 'absolute', inset: 0 }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', (evento) => {
          evento.preventDefault();
          onError();
        });
      }}
    >
      <LucesAzules />
      <ProveedorDesarme desarmado={desarmado || saliendo}>
        <ControlGiro quieto={Boolean(reducido)}>
          <Suspense fallback={null}>
            <Escena key={idMostrado} activa={visible} reducido={Boolean(reducido)} />
          </Suspense>
        </ControlGiro>
      </ProveedorDesarme>
    </Canvas>
  );
}
```

- [ ] **Step 9: `LimiteErrores.jsx`**

```jsx
'use client';

import { Component } from 'react';

// Atrapa errores de render del canvas (por ejemplo un fallo al crear el
// contexto WebGL) y avisa para que se muestre el respaldo en vez de romper la
// sección entera.
export default class LimiteErrores extends Component {
  state = { fallo: false };

  static getDerivedStateFromError() {
    return { fallo: true };
  }

  componentDidCatch() {
    this.props.onError?.();
  }

  render() {
    return this.state.fallo ? null : this.props.children;
  }
}
```

- [ ] **Step 10: `Escena3D.jsx` y `Escena3D.module.css`**

`Escena3D.jsx`:

```jsx
'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import EscenarioHito from '../EscenarioHito.jsx';
import LimiteErrores from './LimiteErrores.jsx';
import { hayWebGL } from './soporteWebGL.js';
import { idsConEscena } from './escenas/index.js';
import styles from './Escena3D.module.css';

// Todo `three` queda en este chunk, que sólo se pide cuando la sección se acerca
// a la pantalla.
const EscenaCanvas = dynamic(() => import('./EscenaCanvas.jsx'), { ssr: false, loading: () => null });

export default function Escena3D({ hito, desarmado, onInteraccion }) {
  const refCaja = useRef(null);
  const [webgl, setWebgl] = useState(false);
  const [montado, setMontado] = useState(false);
  const [visible, setVisible] = useState(false);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    setWebgl(hayWebGL());
  }, []);

  useEffect(() => {
    const caja = refCaja.current;
    if (!caja) return undefined;
    // Margen: se monta (y se empieza a cargar el chunk) un poco antes de verse.
    const observador = new IntersectionObserver(
      ([entrada]) => {
        setVisible(entrada.isIntersecting);
        if (entrada.isIntersecting) setMontado(true);
      },
      { rootMargin: '300px' }
    );
    observador.observe(caja);
    return () => observador.disconnect();
  }, []);

  const usar3D = webgl && idsConEscena.has(hito.id) && !fallo;

  return (
    <div
      ref={refCaja}
      className={styles.caja}
      onPointerDown={(evento) => {
        if (evento.target.tagName === 'CANVAS') onInteraccion?.();
      }}
    >
      {usar3D ? (
        montado ? (
          <LimiteErrores onError={() => setFallo(true)}>
            <EscenaCanvas
              idHito={hito.id}
              desarmado={desarmado}
              visible={visible}
              onError={() => setFallo(true)}
            />
          </LimiteErrores>
        ) : null
      ) : (
        <EscenarioHito hito={hito} desarmado={desarmado} />
      )}
    </div>
  );
}
```

`Escena3D.module.css`:

```css
/* En escritorio ocupa todo el alto que le deja la columna (la zona es flex:1). */
.caja {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}

@media (max-width: 768px) {
  /* En celular la zona no estira: el modelo tiene un alto fijo. */
  .caja {
    position: relative;
    inset: auto;
    height: 14rem;
  }
}
```

- [ ] **Step 11: Verificar que compila**

Apagar el servidor de desarrollo si está corriendo. Run: `cd apps/web && npm run build`
Expected: build sin errores. (`Escena3D` todavía no se usa: esto sólo confirma que compila y que `three` se resuelve.)

- [ ] **Step 12: Commit**

```bash
git add apps/web/package.json package-lock.json apps/web/src/components/SobreMi/Escena3D
git commit -m "feat(web): infraestructura del canvas 3D (carga diferida, luces, giro, desarme, respaldo)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Layout de la columna y conexión en `SobreMi`

**Files:**
- Modify: `apps/web/src/components/SobreMi/SobreMi.jsx`
- Modify: `apps/web/src/components/SobreMi/SobreMi.module.css`

**Interfaces:**
- Consumes: `<Escena3D hito desarmado onInteraccion />` (Task 2).
- Produces: el modelo ocupa todo el alto restante de la columna; el hover sobre la columna abre el detalle con 900 ms de espera; `pointerdown` sobre el canvas cierra el detalle.

- [ ] **Step 1: Cambiar `SobreMi.jsx`**

Leer el archivo y aplicar estos cambios:

1. Reemplazar el import `import EscenarioHito from './EscenarioHito.jsx';` por `import Escena3D from './Escena3D/Escena3D.jsx';`.
2. Cambiar `import { useCallback, useRef, useState } from 'react';` por `import { useCallback, useEffect, useRef, useState } from 'react';`.
3. Debajo de los imports agregar la constante:

```jsx
// Para arrastrar el modelo hay que estar con el cursor encima, así que abrir el
// detalle al instante en cuanto entra el mouse lo abriría a mitad de cada
// arrastre. Se espera un momento; un `pointerdown` sobre el canvas lo cancela.
const ESPERA_HOVER_MODELO_MS = 900;
```

4. Dentro de `SobreMiContenido`, junto a los otros hooks, agregar:

```jsx
  const refEspera = useRef(0);
  useEffect(() => () => clearTimeout(refEspera.current), []);
```

5. Reemplazar `onPointerEnter`/`onPointerLeave` del `<div className={styles.columna} ...>` por:

```jsx
          onPointerEnter={(evento) => {
            if (evento.pointerType !== 'mouse') return;
            clearTimeout(refEspera.current);
            refEspera.current = setTimeout(() => setDetalleAbierto(true), ESPERA_HOVER_MODELO_MS);
          }}
          onPointerLeave={(evento) => {
            if (evento.pointerType !== 'mouse') return;
            clearTimeout(refEspera.current);
            setDetalleAbierto(false);
          }}
```

6. Reemplazar `<EscenarioHito hito={hito} desarmado={detalleAbierto} />` por:

```jsx
            <Escena3D
              hito={hito}
              desarmado={detalleAbierto}
              onInteraccion={() => {
                clearTimeout(refEspera.current);
                setDetalleAbierto(false);
              }}
            />
```

- [ ] **Step 2: Cambiar `SobreMi.module.css`**

En la regla `.columna` (escritorio) reemplazar `width: min(42%, 34rem);` por:

```css
  width: min(46%, 40rem);
  /* Ocupa todo el alto del panel: el modelo se estira hasta abajo. */
  align-self: stretch;
```

En la regla `.zona` (escritorio) reemplazar `min-height: 18rem;` por:

```css
  flex: 1;
  min-height: 18rem;
```

Dentro de `@media (max-width: 768px)`, en la regla `.columna` agregar `align-self: auto;` y en la regla `.zona` reemplazar `min-height: 0;` por:

```css
    flex: none;
    min-height: 0;
```

- [ ] **Step 3: Verificar que compila**

Run (servidor de desarrollo apagado): `cd apps/web && npm run build`
Expected: build sin errores.

- [ ] **Step 4: Comprobación manual**

Run: `npm run dev:web` (desde la raíz); abrir la URL que imprima (puede ser 3001) y scrollear hasta "Sobre mí". En el hito **Origen** (id 0, escena de prueba):
- Se ve el cubo de cubitos, **grande**, ocupando el espacio bajo el título; luces azules, sin fondo negro (se ve el fondo del sitio).
- Gira solo, despacio. Arrastrar con el mouse lo gira; al soltar, retoma unos 3 s después.
- Sacar el mouse de la columna y dejarlo ≥ 900 ms sobre el modelo: los cubitos se dispersan y aparece la descripción. Sacar el mouse: se rearma.
- Mover el mouse sobre el modelo y **arrastrar antes de 900 ms**: gira sin abrir el detalle. Si el detalle ya estaba abierto, un `pointerdown` sobre el modelo lo cierra y se rearma.
- Pasar a otro hito (2022…): se ve el bloque ASCII (esos hitos aún no tienen escena). Volver al Origen: el cubo vuelve a armarse.
- Hover sobre el punto activo de la línea de tiempo: abre el detalle **al instante**.

Para el respaldo, en la consola de las DevTools: `document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()`. Expected: el canvas desaparece y vuelve el bloque ASCII, sin pantalla en blanco ni error que bloquee la página.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/SobreMi/SobreMi.jsx apps/web/src/components/SobreMi/SobreMi.module.css
git commit -m "feat(web): el modelo 3D ocupa la columna y el hover espera 900 ms para no pisar el arrastre

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Escena 0 — la notebook del origen

**Files:**
- Create: `Escena3D/dibujarPantalla.js`
- Create: `Escena3D/pantallaCanvas.js`
- Create: `Escena3D/escenas/Escena0Notebook.jsx`
- Modify: `Escena3D/escenas/index.js`

(Rutas relativas a `apps/web/src/components/SobreMi/`.)

**Interfaces:**
- Consumes: `estadoPantalla`, `teclaPresionada`, `DURACION_TOTAL` (Task 1); `PiezaDesarmable`, `cuerpoOscuro`, `azulEmisivo`, `cianEmisivo` (Task 2).
- Produces: `dibujarPantalla(ctx, ancho, alto, estado)` (dibuja un cuadro de la pantalla); `crearPantalla(ancho, alto) → { lienzo, ctx, textura, ancho, alto }`; escena con contrato `{ activa, reducido }`.

- [ ] **Step 1: `dibujarPantalla.js`**

```js
// Dibuja UN cuadro de la pantalla de la notebook en un contexto 2D, a partir de
// lo que decide `estadoPantalla`. No importa three: sólo pinta píxeles.
const FUENTE = '30px Consolas, "Cascadia Mono", "Courier New", monospace';
const AZUL = '#5b8cff';

function fondoEscritorio(ctx, w, h) {
  const g = ctx.createRadialGradient(w * 0.3, h * 0.2, 40, w * 0.5, h * 0.6, w * 0.85);
  g.addColorStop(0, '#2b5cff');
  g.addColorStop(0.5, '#0f2a7a');
  g.addColorStop(1, '#050b24');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function logo(ctx, cx, cy, lado) {
  // Logo estilizado de cuatro paneles (no es el logo oficial de Windows).
  const hueco = lado * 0.06;
  const celda = (lado - hueco) / 2;
  ctx.fillStyle = AZUL;
  for (let fila = 0; fila < 2; fila += 1) {
    for (let col = 0; col < 2; col += 1) {
      ctx.fillRect(cx - lado / 2 + col * (celda + hueco), cy - lado / 2 + fila * (celda + hueco), celda, celda);
    }
  }
}

function indicadorCarga(ctx, cx, cy, radio, progreso) {
  const puntos = 8;
  for (let i = 0; i < puntos; i += 1) {
    const angulo = (i / puntos) * Math.PI * 2;
    const fase = (progreso * 3 - i / puntos) % 1;
    const brillo = 0.2 + 0.8 * (fase < 0 ? fase + 1 : fase);
    ctx.fillStyle = `rgba(155, 190, 255, ${brillo})`;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(angulo) * radio, cy + Math.sin(angulo) * radio, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function iconos(ctx) {
  const items = ['Mi PC', 'Papelera', 'Proyectos'];
  ctx.font = '22px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  items.forEach((texto, i) => {
    const x = 70;
    const y = 50 + i * 118;
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.roundRect(x - 30, y, 60, 60, 12);
    ctx.fill();
    ctx.fillStyle = '#e6eeff';
    ctx.fillText(texto, x, y + 88);
  });
  ctx.textAlign = 'left';
}

function barraTareas(ctx, w, h) {
  ctx.fillStyle = 'rgba(8, 12, 28, 0.88)';
  ctx.fillRect(0, h - 58, w, 58);
  const lado = 30;
  const hueco = 18;
  const total = 4;
  const inicio = w / 2 - (total * lado + (total - 1) * hueco) / 2;
  for (let i = 0; i < total; i += 1) {
    ctx.fillStyle = i === 0 ? AZUL : 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.roundRect(inicio + i * (lado + hueco), h - 44, lado, lado, 7);
    ctx.fill();
  }
}

function ventanaTerminal(ctx, w, h, estado) {
  const facil = 1 - (1 - estado.apertura) ** 3;
  const ancho = w * 0.7;
  const alto = h * 0.68;
  const x = (w - ancho) / 2;
  const y = h * 0.1;

  ctx.save();
  ctx.globalAlpha = facil;
  ctx.translate(w / 2, y + alto / 2);
  ctx.scale(0.85 + 0.15 * facil, 0.85 + 0.15 * facil);
  ctx.translate(-w / 2, -(y + alto / 2));

  ctx.fillStyle = '#0a0f1c';
  ctx.beginPath();
  ctx.roundRect(x, y, ancho, alto, 14);
  ctx.fill();
  ctx.fillStyle = '#131a2e';
  ctx.beginPath();
  ctx.roundRect(x, y, ancho, 44, [14, 14, 0, 0]);
  ctx.fill();
  ['#ff5f57', '#febc2e', '#28c840'].forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + 26 + i * 26, y + 22, 7, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.font = FUENTE;
  ctx.textBaseline = 'top';
  const lineas = [...estado.lineas];
  const ultima = lineas[lineas.length - 1];
  // Si lo último es una salida (o no hay nada), la terminal muestra un prompt
  // nuevo esperando.
  if (ultima === undefined || !ultima.startsWith('> ')) lineas.push('> ');

  lineas.forEach((linea, i) => {
    const ly = y + 70 + i * 44;
    if (linea.startsWith('> ')) {
      ctx.fillStyle = AZUL;
      ctx.fillText('>', x + 28, ly);
      ctx.fillStyle = '#e6eeff';
      ctx.fillText(linea.slice(2), x + 28 + ctx.measureText('> ').width, ly);
    } else {
      ctx.fillStyle = '#8fb4ff';
      ctx.fillText(linea, x + 28, ly);
    }
  });

  if (estado.cursorVisible && estado.apertura >= 1) {
    const i = lineas.length - 1;
    const ancho_texto = ctx.measureText(lineas[i]).width;
    ctx.fillStyle = '#e6eeff';
    ctx.fillRect(x + 28 + ancho_texto + 4, y + 70 + i * 44 + 4, 16, 30);
  }
  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}

export function dibujarPantalla(ctx, w, h, estado) {
  ctx.clearRect(0, 0, w, h);
  if (estado.fase === 'apagada') {
    ctx.fillStyle = '#03050a';
    ctx.fillRect(0, 0, w, h);
    return;
  }
  if (estado.fase === 'arranque') {
    ctx.fillStyle = '#03050a';
    ctx.fillRect(0, 0, w, h);
    logo(ctx, w / 2, h * 0.42, 150);
    indicadorCarga(ctx, w / 2, h * 0.78, 26, estado.progreso);
    return;
  }
  fondoEscritorio(ctx, w, h);
  iconos(ctx);
  barraTareas(ctx, w, h);
  if (estado.fase === 'terminal') ventanaTerminal(ctx, w, h, estado);
}
```

- [ ] **Step 2: `pantallaCanvas.js`**

```js
import * as THREE from 'three';

// Crea un <canvas> 2D y la textura de three que lo muestra. Hay que volver a
// marcar `textura.needsUpdate = true` cada vez que se redibuja el canvas.
export function crearPantalla(ancho, alto) {
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext('2d');
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 8;
  return { lienzo, ctx, textura, ancho, alto };
}
```

- [ ] **Step 3: `escenas/Escena0Notebook.jsx`**

```jsx
'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import PiezaDesarmable from '../PiezaDesarmable.jsx';
import { cuerpoOscuro, azulEmisivo, cianEmisivo } from '../materiales.js';
import { crearPantalla } from '../pantallaCanvas.js';
import { dibujarPantalla } from '../dibujarPantalla.js';
import { estadoPantalla, teclaPresionada, DURACION_TOTAL } from '../pantallaNotebook.js';

const COLUMNAS = 12;
const FILAS = 5;
const TOTAL_TECLAS = COLUMNAS * FILAS;
const COLOR_TECLA = new THREE.Color('#1c2433');
const COLOR_PRESIONADA = new THREE.Color('#5b8cff');
const RELACION = 2.95 / 1.95;
const PIXELES_ANCHO = 1024;

function posicionTecla(i) {
  const columna = i % COLUMNAS;
  const fila = Math.floor(i / COLUMNAS);
  return [(columna - (COLUMNAS - 1) / 2) * 0.245, 0, -0.55 + fila * 0.24];
}

// Las 60 teclas son UNA malla instanciada (una sola draw call). Cada cuadro,
// sólo si cambió la tecla hundida, se baja esa instancia y se tiñe de azul.
function Teclado({ refPresionada }) {
  const malla = useRef(null);
  const auxiliar = useMemo(() => new THREE.Object3D(), []);
  const anterior = useRef(-1);

  function poner(i, y, color) {
    if (i < 0) return;
    const [x, , z] = posicionTecla(i);
    auxiliar.position.set(x, y, z);
    auxiliar.updateMatrix();
    malla.current.setMatrixAt(i, auxiliar.matrix);
    malla.current.setColorAt(i, color);
  }

  useEffect(() => {
    for (let i = 0; i < TOTAL_TECLAS; i += 1) poner(i, 0, COLOR_TECLA);
    malla.current.instanceMatrix.needsUpdate = true;
    malla.current.instanceColor.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame(() => {
    const actual = refPresionada.current;
    if (actual === anterior.current) return;
    poner(anterior.current, 0, COLOR_TECLA);
    poner(actual, -0.03, COLOR_PRESIONADA);
    anterior.current = actual;
    malla.current.instanceMatrix.needsUpdate = true;
    malla.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={malla} args={[undefined, undefined, TOTAL_TECLAS]}>
      <boxGeometry args={[0.2, 0.05, 0.2]} />
      <meshStandardMaterial color="#ffffff" metalness={0.4} roughness={0.5} />
    </instancedMesh>
  );
}

export default function Escena0Notebook({ activa, reducido }) {
  const pantalla = useMemo(() => crearPantalla(PIXELES_ANCHO, Math.round(PIXELES_ANCHO / RELACION)), []);
  // Con movimiento reducido se muestra directamente el estado final.
  const tiempo = useRef(reducido ? DURACION_TOTAL + 5 : 0);
  const refTecla = useRef(-1);
  const ultimaClave = useRef('');

  useEffect(() => () => pantalla.textura.dispose(), [pantalla]);

  useFrame((_, delta) => {
    if (!activa) return;
    // `delta` acotado: al volver de una pestaña oculta el guion no salta.
    if (!reducido) tiempo.current += Math.min(delta, 0.05);
    const t = tiempo.current;
    const estado = estadoPantalla(t);
    refTecla.current = reducido ? -1 : teclaPresionada(t, TOTAL_TECLAS);

    // Sólo se redibuja la pantalla si cambió algo visible.
    const clave = [
      estado.fase,
      estado.progreso.toFixed(2),
      estado.apertura.toFixed(2),
      estado.lineas.join('/'),
      estado.cursorVisible,
    ].join('|');
    if (clave !== ultimaClave.current) {
      ultimaClave.current = clave;
      dibujarPantalla(pantalla.ctx, pantalla.ancho, pantalla.alto, estado);
      pantalla.textura.needsUpdate = true;
    }
  });

  return (
    <group position={[0, -0.55, 0]} rotation={[0, -0.5, 0]}>
      <PiezaDesarmable semilla={1}>
        <mesh position={[0, -0.5, 0]} material={cuerpoOscuro}>
          <boxGeometry args={[3.2, 0.14, 2.2]} />
        </mesh>
        <mesh position={[0, -0.575, 1.1]} material={azulEmisivo}>
          <boxGeometry args={[2.4, 0.012, 0.02]} />
        </mesh>
      </PiezaDesarmable>

      <PiezaDesarmable posicion={[0, -0.405, 0]} semilla={2} giro={[0.4, 0.6, 0.2]}>
        <Teclado refPresionada={refTecla} />
      </PiezaDesarmable>

      <PiezaDesarmable posicion={[0, -0.428, 0.78]} semilla={3} giro={[0.2, -0.5, 0.3]}>
        <mesh material={cianEmisivo}>
          <boxGeometry args={[1.0, 0.012, 0.6]} />
        </mesh>
      </PiezaDesarmable>

      {/* Tapa: bisagra atrás, abierta ~100°. El grupo interno lleva la
          rotación fija; PiezaDesarmable sólo mueve y gira la tapa al desarmar. */}
      <PiezaDesarmable posicion={[0, -0.43, -1.1]} semilla={4} giro={[0.7, 0.5, 0]}>
        <group rotation={[-1.75, 0, 0]}>
          <mesh position={[0, 0.03, 1.1]} material={cuerpoOscuro}>
            <boxGeometry args={[3.2, 0.06, 2.2]} />
          </mesh>
          <mesh position={[0, -0.002, 1.1]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[2.95, 1.95]} />
            <meshBasicMaterial map={pantalla.textura} toneMapped={false} />
          </mesh>
        </group>
      </PiezaDesarmable>
    </group>
  );
}
```

- [ ] **Step 4: Registrar la escena**

En `escenas/index.js` cambiar la entrada `0` por:

```js
  0: () => import('./Escena0Notebook.jsx'),
```

(`EscenaPrueba.jsx` queda en el repo como escena de referencia para las próximas; no se borra.)

- [ ] **Step 5: Verificar que compila**

Run (servidor de desarrollo apagado): `cd apps/web && npm run build`
Expected: build sin errores.

- [ ] **Step 6: Comprobación manual**

Run: `npm run dev:web`, scrollear hasta "Sobre mí" con el hito **Origen** activo. Esperar al montaje. Verificar, y ajustar a ojo (posiciones, luces, rotación de partida) si algo no se ve bien:
- Se ve una notebook abierta, **grande**, apoyada sobre su base, con la pantalla hacia la cámara (no al revés ni inclinada de forma rara). La pantalla arranca apagada.
- Secuencia: ~1 s negra → logo de cuatro paneles con indicador de carga → escritorio azul con íconos y barra de tareas → la ventana de terminal se abre → se escribe `whoami` letra por letra con las teclas correspondientes hundiéndose y teñidas de azul → aparece `quien repara y mejora` → se escribe `beep` → `beep beep beep` → el cursor queda parpadeando.
- El texto de la terminal se lee nítido; el giro no lo deforma ni lo espeja.
- Hover ≥ 900 ms: base, teclado, trackpad y tapa se dispersan y aparece la descripción. Al salir, se rearma y **la pantalla sigue donde estaba** (no reinicia).
- Cambiar de hito y volver al Origen: la secuencia **arranca de nuevo** (escena nueva).
- Emulación de `prefers-reduced-motion: reduce` (DevTools → Rendering) y recargar: la notebook aparece directo con la terminal terminada, sin giro automático y sin teclas hundiéndose.
- Salir del viewport (scrollear lejos) y volver: continúa sin saltos.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/SobreMi/Escena3D
git commit -m "feat(web): escena del origen, notebook con arranque, escritorio y terminal

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Cierre de la tanda

**Files:**
- Modify: los archivos de `Escena3D/` que haga falta según lo observado.

- [ ] **Step 1: Ajuste fino**

Con `npm run dev:web` abierto, repasar a ojo en escritorio y en un ancho de ~390 px (iframe, como en la primera tanda): tamaño y encuadre del modelo (`camera.position`, `fov` en `EscenaCanvas.jsx`), intensidad de las luces (`LucesAzules.jsx`), velocidad del giro, y que en celular el modelo de 14 rem de alto no empuje la descripción fuera de la columna (la columna scrollea por dentro). Tema claro y oscuro.

- [ ] **Step 2: Tests y build finales**

Run: `node --test apps/web/src/lib/sobreMi.test.js apps/web/src/components/SobreMi/Escena3D/escena3d.test.js`
Expected: PASS, 19 tests (8 + 11), 0 fail.

Apagar el servidor de desarrollo. Run: `cd apps/web && npm run build`
Expected: build sin errores. En la salida, el tamaño de `First Load JS` de `/` **no** debe haber crecido de forma notable respecto al anterior (≈ 158 kB): `three` debe quedar en un chunk aparte. Si creció mucho, revisar que nada fuera de `EscenaCanvas.jsx` importe `three` de forma estática.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/SobreMi
git commit -m "style(web): ajuste fino del canvas 3D y la notebook

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

(Omitir el commit si el Step 1 no cambió nada.) La rama queda lista para la revisión final y para decidir el merge con `superpowers:finishing-a-development-branch`.
