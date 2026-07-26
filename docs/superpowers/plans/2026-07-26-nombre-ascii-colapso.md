# Colapso físico al hover (fase 2 de NombreAscii) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cuando el mouse pasa sobre el nombre ya asentado en tipografía limpia, éste vuelve a ASCII y la pila se derrumba con física real hasta el pie de la sección; un stickman entra, barre todo a la derecha y sale; después se rebobina cuadro a cuadro hasta reformar el nombre.

**Architecture:** Un componente nuevo `ColapsoFisico` se monta por portal en `document.body` (para escapar del `pointer-events: none` y el `z-index: -1` del hero) con un `<canvas>` que cubre los primeros 100vh del documento. Corre un único `requestAnimationFrame` que avanza Matter.js con delta fijo, graba cada cuadro en un `Float32Array` y dibuja los caracteres con `fillText`. Una máquina de estados local (`derrumbe` → `barrido` → `salida` → `rebobinado`) coordina la entrada del stickman y el rebobinado, que reproduce las fotos grabadas en orden inverso. `NombreAscii` sólo detecta el hover (por `mousemove` en `window` contra el rect del nombre, no por eventos del DOM) y monta/desmonta el componente.

**Tech Stack:** React 19 / Next.js 15 (App Router), JSX (sin TypeScript), CSS Modules, `matter-js` (dependencia nueva), Canvas 2D.

## Global Constraints

- Sin TypeScript — `.jsx` / `.js` plano.
- CSS Modules únicamente.
- Identificadores en español: `ColapsoFisico`, `crearMundo`, `cuerposDeCaracteres`, `cuerpoCursor`, `cuerpoEscoba`, `destruirMundo`, `fraccionQuieta`, `moverCuerpo`, `sacarDeEscena`, `crearGrabadora`, `grabarCuadro`, `leerCuadro`, `leerCelda`, `leerStickman`, `liberar`, `dibujarStickman`, `desplazamientoEscoba`, `colapsando`, `faseColapso`.
- **El repo no tiene suite de tests.** La verificación de cada tarea es `cd apps/web && npm run build` (debe terminar en 0 errores) más la comprobación manual en el navegador que indica cada tarea. Las tareas 1-3 crean módulos que todavía no son alcanzables desde la UI: ahí la única verificación posible es que el build compile. El comportamiento real se verifica en las tareas 4 y 5.
- Matter.js se usa sólo como motor: **no** `Matter.Render` (hay que dibujar caracteres, no rectángulos) ni `Matter.MouseConstraint` (agarraría piezas; se necesita empujar). El bucle es propio.
- `Engine.update` siempre con delta fijo `1000 / 60`: con delta variable la simulación se desestabiliza al caer un cuadro y la grabación deja de ser reproducible.
- El efecto no se dispara si `(hover: hover) and (pointer: fine)` no matchea (táctiles) o si matchea `prefers-reduced-motion: reduce`.
- Todo lo nuevo es decorativo: `aria-hidden="true"`. El nombre accesible lo sigue aportando el `<span className={styles.soloLectura}>` que ya existe en `NombreAscii`.
- Coordenadas: **todo en coordenadas de página** (`clientX + window.scrollX`), porque el overlay está posicionado en absoluto respecto del documento, no del viewport.
- Los valores numéricos (`UMBRAL_QUIETUD`, `VELOCIDAD_STICKMAN_PX`, `MARGEN_FIN_BARRIDO_PX`, medidas del stickman) son puntos de partida — ajustar a ojo en el navegador, como el resto de los efectos del proyecto.
- Refinamiento sobre la spec: la función que la spec llama `piezasQuietas` se implementa como `fraccionQuieta`, porque devuelve una fracción 0..1, no una cantidad de piezas.

---

### Task 1: Mundo físico

**Files:**
- Modify: `apps/web/package.json` (vía `npm install`)
- Create: `apps/web/src/components/ColapsoFisico/mundoFisico.js`

**Interfaces:**
- Consumes: `matter-js` (`Bodies`, `Body`, `Composite`, `Engine`).
- Produces:
  - `ALTO_ESCOBA` (number) — alto del cuerpo de la escoba; la Task 4 lo necesita para posicionarla apoyada en el piso.
  - `crearMundo({ ancho, alto, celdas, anchoCaracter, altoCaracter })` → `{ motor, cuerposDeCaracteres, cuerpoCursor, cuerpoEscoba }`, donde `celdas` es `Array<{ x, y, caracter }>` en coordenadas de página y `cuerposDeCaracteres` sale en el **mismo orden** que `celdas` (la Task 4 y la grabadora dependen de esa correspondencia por índice).
  - `moverCuerpo(cuerpo, x, y)` → void
  - `sacarDeEscena(cuerpo)` → void
  - `fraccionQuieta(cuerpos, umbralVelocidad?)` → number 0..1
  - `destruirMundo(motor)` → void

- [ ] **Step 1: Instalar la dependencia**

Run: `cd apps/web && npm install matter-js`
Expected: sale 0, `apps/web/package.json` gana una entrada `matter-js` en `dependencies`.

- [ ] **Step 2: Crear `mundoFisico.js`**

```js
import { Bodies, Body, Composite, Engine } from 'matter-js';

const GROSOR_PARED = 200;
const RADIO_CURSOR = 26;
const ANCHO_ESCOBA = 16;
export const ALTO_ESCOBA = 70;
// Las piezas que no participan (cursor y escoba mientras no barre) se
// mandan lejos en vez de sacarse del mundo: agregar/quitar cuerpos en
// caliente invalida los índices de la grabación.
const FUERA_DE_ESCENA = -9999;

// Un cuerpo por celda de glifo, en la posición exacta que ocupa hoy el
// carácter en pantalla. Nacen dinámicos: el pedido es que la pila entera se
// derrumbe al tocarla, no sólo la parte que roza el cursor.
export function crearMundo({ ancho, alto, celdas, anchoCaracter, altoCaracter }) {
  const motor = Engine.create();
  motor.gravity.y = 1;

  const cuerposDeCaracteres = celdas.map((celda) =>
    Bodies.rectangle(celda.x, celda.y, anchoCaracter, altoCaracter, {
      friction: 0.4,
      restitution: 0.15,
      // Las celdas son de pocos px: con el slop por defecto (0.05) se
      // encajan visiblemente unas dentro de otras al apilarse.
      slop: 0.02,
    })
  );

  // Piso al pie de la sección (no de la caja del nombre) y paredes a los
  // costados. Las paredes son gruesas a propósito: una pieza chica a
  // velocidad alta atraviesa una pared fina entre dos cuadros.
  const paredes = [
    Bodies.rectangle(ancho / 2, alto + GROSOR_PARED / 2, ancho * 3, GROSOR_PARED, {
      isStatic: true,
    }),
    Bodies.rectangle(-GROSOR_PARED / 2, alto / 2, GROSOR_PARED, alto * 3, { isStatic: true }),
    Bodies.rectangle(ancho + GROSOR_PARED / 2, alto / 2, GROSOR_PARED, alto * 3, {
      isStatic: true,
    }),
  ];

  // Cursor y escoba son estáticos y se teleportan a mano: así empujan en vez
  // de ser empujados.
  const cuerpoCursor = Bodies.circle(FUERA_DE_ESCENA, FUERA_DE_ESCENA, RADIO_CURSOR, {
    isStatic: true,
  });
  const cuerpoEscoba = Bodies.rectangle(
    FUERA_DE_ESCENA,
    FUERA_DE_ESCENA,
    ANCHO_ESCOBA,
    ALTO_ESCOBA,
    { isStatic: true }
  );

  Composite.add(motor.world, [
    ...cuerposDeCaracteres,
    ...paredes,
    cuerpoCursor,
    cuerpoEscoba,
  ]);

  return { motor, cuerposDeCaracteres, cuerpoCursor, cuerpoEscoba };
}

export function moverCuerpo(cuerpo, x, y) {
  Body.setPosition(cuerpo, { x, y });
}

export function sacarDeEscena(cuerpo) {
  Body.setPosition(cuerpo, { x: FUERA_DE_ESCENA, y: FUERA_DE_ESCENA });
}

// Fracción de piezas prácticamente quietas — dispara la entrada del stickman.
export function fraccionQuieta(cuerpos, umbralVelocidad = 0.4) {
  if (cuerpos.length === 0) return 1;
  let quietas = 0;
  for (const cuerpo of cuerpos) {
    if (cuerpo.speed < umbralVelocidad) quietas += 1;
  }
  return quietas / cuerpos.length;
}

export function destruirMundo(motor) {
  Composite.clear(motor.world, false);
  Engine.clear(motor);
}
```

- [ ] **Step 3: Verificar que compila**

Run: `cd apps/web && npm run build`
Expected: `✓ Compiled successfully`, 0 errores. (El módulo todavía no lo importa nadie; esto sólo confirma que la dependencia resuelve y la sintaxis es válida.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json apps/web/package-lock.json apps/web/src/components/ColapsoFisico/mundoFisico.js
git commit -m "feat(web): mundo fisico Matter.js para el colapso del nombre"
```

---

### Task 2: Grabadora de cuadros

**Files:**
- Create: `apps/web/src/components/ColapsoFisico/grabadora.js`

**Interfaces:**
- Consumes: nada (JS puro).
- Produces:
  - `crearGrabadora(cantidadCuerpos)` → `{ cantidad, lleno, grabarCuadro(cuerpos, stickman), leerCuadro(indice), liberar() }`, donde `cantidad` y `lleno` son getters y `stickman` es `{ x, paso, barriendo }`.
  - `leerCelda(foto, indice)` → `{ x, y, angulo }`
  - `leerStickman(foto)` → `{ x, paso, barriendo }` (`barriendo` como boolean)

- [ ] **Step 1: Crear `grabadora.js`**

```js
// 3 floats por cuerpo (x, y, ángulo) + 3 del stickman (x, paso, barriendo).
const FLOATS_POR_CUERPO = 3;
const FLOATS_STICKMAN = 3;
// Techo de memoria: ~380 cuerpos ≈ 4.6 KB por cuadro, 900 cuadros ≈ 4 MB.
const MAX_CUADROS = 900;

// La reconstrucción tiene que ser el recorrido inverso exacto, no un tween de
// vuelta al origen: por eso se guarda una foto por cuadro y en el rebobinado
// se recorren al revés tal cual.
export function crearGrabadora(cantidadCuerpos) {
  const cuadros = [];
  const largo = cantidadCuerpos * FLOATS_POR_CUERPO + FLOATS_STICKMAN;

  return {
    get cantidad() {
      return cuadros.length;
    },
    // Válvula de escape: si la simulación se estira más de lo previsto se
    // corta la grabación en vez de comerse memoria sin techo.
    get lleno() {
      return cuadros.length >= MAX_CUADROS;
    },
    grabarCuadro(cuerpos, stickman) {
      if (cuadros.length >= MAX_CUADROS) return;
      const foto = new Float32Array(largo);
      for (let i = 0; i < cuerpos.length; i += 1) {
        foto[i * FLOATS_POR_CUERPO] = cuerpos[i].position.x;
        foto[i * FLOATS_POR_CUERPO + 1] = cuerpos[i].position.y;
        foto[i * FLOATS_POR_CUERPO + 2] = cuerpos[i].angle;
      }
      foto[largo - 3] = stickman.x;
      foto[largo - 2] = stickman.paso;
      foto[largo - 1] = stickman.barriendo ? 1 : 0;
      cuadros.push(foto);
    },
    leerCuadro(indice) {
      return cuadros[indice];
    },
    liberar() {
      cuadros.length = 0;
    },
  };
}

export function leerCelda(foto, indice) {
  return {
    x: foto[indice * FLOATS_POR_CUERPO],
    y: foto[indice * FLOATS_POR_CUERPO + 1],
    angulo: foto[indice * FLOATS_POR_CUERPO + 2],
  };
}

export function leerStickman(foto) {
  return {
    x: foto[foto.length - 3],
    paso: foto[foto.length - 2],
    barriendo: foto[foto.length - 1] === 1,
  };
}
```

- [ ] **Step 2: Verificar que compila**

Run: `cd apps/web && npm run build`
Expected: `✓ Compiled successfully`, 0 errores.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ColapsoFisico/grabadora.js
git commit -m "feat(web): grabadora de cuadros para el rebobinado del colapso"
```

---

### Task 3: Stickman

**Files:**
- Create: `apps/web/src/components/ColapsoFisico/stickman.js`

**Interfaces:**
- Consumes: nada (dibuja sobre un `CanvasRenderingContext2D` que recibe por parámetro).
- Produces (lo que consume la Task 4):
  - `desplazamientoEscoba(paso, barriendo)` → number (offset horizontal de la punta de la escoba respecto de la `x` del stickman)
  - `dibujarStickman(ctx, { x, suelo, paso, barriendo }, color)` → void
- También exporta `ALTO_STICKMAN` (number), pero sólo lo usa el propio módulo: se exporta para poder ajustarlo desde afuera si hiciera falta, ninguna otra task lo importa.

- [ ] **Step 1: Crear `stickman.js`**

```js
export const ALTO_STICKMAN = 90;

// Offset horizontal de la punta de la escoba respecto de la `x` del
// stickman. Lo usan el dibujo Y el cuerpo físico de la escoba: si cada uno
// lo calculara por su cuenta, lo que se ve barriendo y lo que empuja se
// desincronizarían.
export function desplazamientoEscoba(paso, barriendo) {
  // Los brazos estiran y encogen al ritmo de la caminata (mismo `paso` que
  // mueve las piernas, al doble de frecuencia).
  return barriendo ? 30 + Math.sin(paso * 2) * 26 : 22;
}

// Stickman procedural: sólo líneas, sin sprites ni assets.
export function dibujarStickman(ctx, { x, suelo, paso, barriendo }, color) {
  const cabeza = suelo - ALTO_STICKMAN;
  const balanceo = Math.sin(paso) * 12;
  const puntaX = x + desplazamientoEscoba(paso, barriendo);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.arc(x, cabeza, 9, 0, Math.PI * 2);
  ctx.moveTo(x, cabeza + 9);
  ctx.lineTo(x, suelo - 34);
  ctx.moveTo(x, suelo - 34);
  ctx.lineTo(x - balanceo, suelo);
  ctx.moveTo(x, suelo - 34);
  ctx.lineTo(x + balanceo, suelo);
  ctx.stroke();

  // Brazos -> palo -> cerdas, en un solo trazo continuo.
  ctx.beginPath();
  ctx.moveTo(x, cabeza + 24);
  ctx.lineTo(puntaX, suelo - 30);
  ctx.lineTo(puntaX + 8, suelo);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(puntaX - 4, suelo);
  ctx.lineTo(puntaX + 20, suelo);
  ctx.stroke();

  ctx.restore();
}
```

- [ ] **Step 2: Verificar que compila**

Run: `cd apps/web && npm run build`
Expected: `✓ Compiled successfully`, 0 errores.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ColapsoFisico/stickman.js
git commit -m "feat(web): stickman procedural que barre los caracteres"
```

---

### Task 4: Componente `ColapsoFisico`

**Files:**
- Create: `apps/web/src/components/ColapsoFisico/ColapsoFisico.jsx`
- Create: `apps/web/src/components/ColapsoFisico/ColapsoFisico.module.css`

**Interfaces:**
- Consumes: `mundoFisico.js`, `grabadora.js`, `stickman.js` (Tasks 1-3); `Engine` de `matter-js`; `createPortal` de `react-dom`.
- Produces: `export default function ColapsoFisico({ campo, refContenedor, posicionInicialRaton, alTerminar })`.
  - `campo`: el objeto que devuelve `generarCampo` en `NombreAscii`, **con la propiedad `paso` que agrega la Task 5**.
  - `refContenedor`: ref al `.contenedor` de `NombreAscii`, para ubicar la grilla en coordenadas de página.
  - `posicionInicialRaton`: `{ x, y }` en coordenadas de página, la posición del cursor en el momento del disparo.
  - `alTerminar`: callback sin argumentos, se llama al final del rebobinado.

- [ ] **Step 1: Crear `ColapsoFisico.module.css`**

```css
/* Portal a document.body: adentro del hero heredaría pointer-events:none y
   quedaría detrás del contenido por el z-index:-1 de .hero. Se posiciona
   en absoluto sobre los primeros 100vh del documento, que es justo lo que
   ocupa el hero, así scrollea junto con él. */
.overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
  z-index: 1;
  /* Decorativo: la detección del hover es por mousemove en window. */
  pointer-events: none;
}

.lienzo {
  display: block;
  width: 100%;
  height: 100%;
}
```

- [ ] **Step 2: Crear `ColapsoFisico.jsx`**

```jsx
'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Engine } from 'matter-js';
import {
  ALTO_ESCOBA,
  crearMundo,
  destruirMundo,
  fraccionQuieta,
  moverCuerpo,
  sacarDeEscena,
} from './mundoFisico.js';
import { crearGrabadora, leerCelda, leerStickman } from './grabadora.js';
import { desplazamientoEscoba, dibujarStickman } from './stickman.js';
import styles from './ColapsoFisico.module.css';

const PASO_MS = 1000 / 60;
const UMBRAL_QUIETUD = 0.85;
const MINIMO_DERRUMBE_MS = 1200;
const VELOCIDAD_STICKMAN_PX = 2.2;
const MARGEN_FIN_BARRIDO_PX = 120;
const AVANCE_PASO_CAMINATA = 0.18;
const X_INICIAL_STICKMAN = -60;
const HOLGURA_SALIDA_PX = 80;

export default function ColapsoFisico({ campo, refContenedor, posicionInicialRaton, alTerminar }) {
  const refLienzo = useRef(null);
  // El callback puede cambiar de identidad entre renders; se lee por ref para
  // que el efecto no se reinicie (reiniciarlo destruiría la simulación).
  const refAlTerminar = useRef(alTerminar);
  refAlTerminar.current = alTerminar;

  useEffect(() => {
    const lienzo = refLienzo.current;
    const contenedor = refContenedor.current;
    if (!lienzo || !contenedor) return undefined;

    const overlay = lienzo.parentElement;
    const ancho = overlay.clientWidth;
    const alto = overlay.clientHeight;
    const suelo = alto;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    lienzo.width = ancho * dpr;
    lienzo.height = alto * dpr;
    const ctx = lienzo.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // --- Grilla -> celdas en coordenadas de página -----------------------
    // Analítico y no midiendo cada <span>: cientos de getBoundingClientRect
    // serían cientos de reflows forzados justo en el cuadro del disparo.
    const rect = contenedor.getBoundingClientRect();
    const origenX = rect.left + window.scrollX;
    const origenY = rect.top + window.scrollY;
    const anchoCaracter = campo.paso - campo.separacion;

    const celdas = [];
    campo.columnas.forEach((columna, c) => {
      columna.forEach((celda, i) => {
        if (!celda.esNombre) return;
        celdas.push({
          caracter: celda.caracter,
          x: origenX + campo.izquierda + c * campo.paso + anchoCaracter / 2,
          y: origenY + campo.arriba + i * campo.tamanoCelda + campo.tamanoCelda / 2,
        });
      });
    });

    if (celdas.length === 0) {
      refAlTerminar.current();
      return undefined;
    }

    // --- Mundo, grabadora y estado local --------------------------------
    const { motor, cuerposDeCaracteres, cuerpoCursor, cuerpoEscoba } = crearMundo({
      ancho,
      alto,
      celdas,
      anchoCaracter,
      altoCaracter: campo.tamanoCelda,
    });
    const grabadora = crearGrabadora(cuerposDeCaracteres.length);

    const color = getComputedStyle(document.body).color;
    const fuente = `${campo.tamanoCelda}px monospace`;

    const raton = { ...posicionInicialRaton };
    const stickman = { x: X_INICIAL_STICKMAN, paso: 0 };
    let fase = 'derrumbe';
    let indiceRebobinado = 0;
    let bucle = 0;
    const inicio = performance.now();

    function alMoverse(evento) {
      raton.x = evento.clientX + window.scrollX;
      raton.y = evento.clientY + window.scrollY;
    }
    window.addEventListener('mousemove', alMoverse, { passive: true });

    // --- Simulación ------------------------------------------------------
    function actualizarStickman() {
      if (fase === 'derrumbe') return;
      stickman.x += VELOCIDAD_STICKMAN_PX;
      stickman.paso += AVANCE_PASO_CAMINATA;
      if (fase === 'barrido') {
        moverCuerpo(
          cuerpoEscoba,
          stickman.x + desplazamientoEscoba(stickman.paso, true),
          suelo - ALTO_ESCOBA / 2
        );
      } else {
        sacarDeEscena(cuerpoEscoba);
      }
    }

    function empezarRebobinado() {
      fase = 'rebobinado';
      indiceRebobinado = grabadora.cantidad - 1;
      sacarDeEscena(cuerpoEscoba);
      sacarDeEscena(cuerpoCursor);
    }

    function evaluarTransicion(ahora) {
      if (fase === 'derrumbe') {
        // El mínimo de tiempo existe porque fraccionQuieta da alto en el
        // primer cuadro, antes de que la gravedad acelere nada.
        const asentado =
          ahora - inicio > MINIMO_DERRUMBE_MS &&
          fraccionQuieta(cuerposDeCaracteres) > UMBRAL_QUIETUD;
        if (asentado) fase = 'barrido';
        return;
      }
      if (fase === 'barrido' && stickman.x > ancho - MARGEN_FIN_BARRIDO_PX) {
        fase = 'salida';
        return;
      }
      if (fase === 'salida' && stickman.x > ancho + HOLGURA_SALIDA_PX) {
        empezarRebobinado();
      }
    }

    // --- Dibujo ----------------------------------------------------------
    function abrirCuadro() {
      ctx.clearRect(0, 0, ancho, alto);
      ctx.font = fuente;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
    }

    function dibujarCaracter(caracter, x, y, angulo) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angulo);
      ctx.fillText(caracter, 0, 0);
      ctx.restore();
    }

    function dibujarDesdeMotor() {
      abrirCuadro();
      for (let i = 0; i < cuerposDeCaracteres.length; i += 1) {
        const cuerpo = cuerposDeCaracteres[i];
        dibujarCaracter(celdas[i].caracter, cuerpo.position.x, cuerpo.position.y, cuerpo.angle);
      }
      if (fase !== 'derrumbe') {
        dibujarStickman(
          ctx,
          { x: stickman.x, suelo, paso: stickman.paso, barriendo: fase === 'barrido' },
          color
        );
      }
    }

    function dibujarDesdeFoto(foto) {
      abrirCuadro();
      for (let i = 0; i < celdas.length; i += 1) {
        const posicion = leerCelda(foto, i);
        dibujarCaracter(celdas[i].caracter, posicion.x, posicion.y, posicion.angulo);
      }
      // En los cuadros grabados durante el derrumbe el stickman todavía está
      // en su x inicial, fuera de pantalla: dibujarlo siempre es inofensivo.
      const grabado = leerStickman(foto);
      dibujarStickman(ctx, { ...grabado, suelo }, color);
    }

    // --- Bucle único -----------------------------------------------------
    function terminar() {
      refAlTerminar.current();
    }

    function cuadro(ahora) {
      if (fase === 'rebobinado') {
        const foto = grabadora.leerCuadro(indiceRebobinado);
        if (!foto) return terminar();
        dibujarDesdeFoto(foto);
        indiceRebobinado -= 1;
        if (indiceRebobinado < 0) return terminar();
      } else {
        moverCuerpo(cuerpoCursor, raton.x, raton.y);
        actualizarStickman();
        // Delta fijo: con delta variable la simulación se desestabiliza al
        // caer un cuadro y la grabación deja de ser reproducible.
        Engine.update(motor, PASO_MS);
        grabadora.grabarCuadro(cuerposDeCaracteres, {
          x: stickman.x,
          paso: stickman.paso,
          barriendo: fase === 'barrido',
        });
        evaluarTransicion(ahora);
        if (grabadora.lleno && fase !== 'rebobinado') empezarRebobinado();
        dibujarDesdeMotor();
      }
      bucle = requestAnimationFrame(cuadro);
      return undefined;
    }

    bucle = requestAnimationFrame(cuadro);

    return () => {
      cancelAnimationFrame(bucle);
      window.removeEventListener('mousemove', alMoverse);
      grabadora.liberar();
      destruirMundo(motor);
    };
    // posicionInicialRaton se lee una sola vez al montar, a propósito: no
    // debe reiniciar la simulación si cambia.
    //
    // `campo` como dependencia es seguro SÓLO porque el intervalo que
    // resortea caracteres corre únicamente en la fase 'onda', y el colapso
    // se dispara en 'desvanecido': mientras este componente vive, `campo`
    // no se reemplaza. Si eso cambiara, cada tick del titileo destruiría y
    // recrearía la simulación — el mismo bug que ya rompió dos veces la
    // cadena de fases de NombreAscii.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campo, refContenedor]);

  return createPortal(
    <div className={styles.overlay} aria-hidden="true">
      <canvas ref={refLienzo} className={styles.lienzo} />
    </div>,
    document.body
  );
}
```

- [ ] **Step 3: Verificar que compila**

Run: `cd apps/web && npm run build`
Expected: `✓ Compiled successfully`, 0 errores. (Sigue sin estar montado por nadie; la verificación de comportamiento es la Task 5.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/ColapsoFisico/ColapsoFisico.jsx apps/web/src/components/ColapsoFisico/ColapsoFisico.module.css
git commit -m "feat(web): overlay de canvas que simula, graba y rebobina el colapso"
```

---

### Task 5: Enganchar en `NombreAscii`

**Files:**
- Modify: `apps/web/src/components/NombreAscii/NombreAscii.jsx`

**Interfaces:**
- Consumes: `ColapsoFisico` (Task 4).
- Produces: nada nuevo hacia afuera — `NombreAscii` sigue siendo un componente sin props.

- [ ] **Step 1: Exponer `paso` en el campo**

En `generarCampo`, el `return` final pasa a incluir `paso` (que ya está calculado unas líneas más arriba). Reemplazar:

```js
  return {
    columnas,
    tamanoCelda: celdaAlto,
    separacion,
    izquierda: izquierda - margen * paso,
    arriba: arriba - FILAS_LLUVIA * celdaAlto,
  };
```

por:

```js
  return {
    columnas,
    tamanoCelda: celdaAlto,
    separacion,
    // Distancia entre columnas (ancho de carácter + separación). La usa
    // ColapsoFisico para ubicar cada celda en píxeles sin medir el DOM.
    paso,
    izquierda: izquierda - margen * paso,
    arriba: arriba - FILAS_LLUVIA * celdaAlto,
  };
```

- [ ] **Step 2: Importar el componente**

Agregar junto a los imports existentes del archivo:

```jsx
import ColapsoFisico from '@/components/ColapsoFisico/ColapsoFisico.jsx';
```

- [ ] **Step 3: Agregar el estado del colapso**

Debajo de `const [campo, setCampo] = useState(null);` agregar:

```jsx
  const [colapso, setColapso] = useState(null);
  // Tras un colapso hay que salir del área y volver a entrar para
  // re-disparar: si no, quedarse quieto encima lo relanzaría en loop.
  const refEsperandoSalida = useRef(false);
```

- [ ] **Step 4: Agregar la detección del hover**

Agregar este efecto después del efecto del titileo de caracteres (el que depende de `[fase]`):

```jsx
  // La detección NO usa eventos del DOM del nombre: .capa tiene
  // pointer-events:none, el hero está en z-index:-1 y .seccionHero también
  // anula punteros — es la cascada que ya rompió el botón de prueba durante
  // la fase 1. Se compara la posición del cursor contra el rect medido.
  useEffect(() => {
    if (fase !== 'desvanecido' || colapso) return undefined;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    function alMoverse(evento) {
      const nodo = refLimpio.current;
      if (!nodo) return;
      const rect = nodo.getBoundingClientRect();
      const adentro =
        evento.clientX >= rect.left &&
        evento.clientX <= rect.right &&
        evento.clientY >= rect.top &&
        evento.clientY <= rect.bottom;

      if (!adentro) {
        refEsperandoSalida.current = false;
        return;
      }
      if (refEsperandoSalida.current) return;
      setColapso({
        x: evento.clientX + window.scrollX,
        y: evento.clientY + window.scrollY,
      });
    }

    window.addEventListener('mousemove', alMoverse, { passive: true });
    return () => window.removeEventListener('mousemove', alMoverse);
  }, [fase, colapso]);
```

- [ ] **Step 5: Ocultar el texto limpio y montar el colapso**

En el `return`, cambiar la línea del `className` de `textoLimpio`:

```jsx
        className={`${styles.textoLimpio} ${fase === 'desvanecido' ? styles.visible : ''}`}
```

por (las letras "reales" ceden su lugar a la pila ASCII mientras dura el efecto):

```jsx
        className={`${styles.textoLimpio} ${
          fase === 'desvanecido' && !colapso ? styles.visible : ''
        }`}
```

y agregar, justo antes del `</div>` de cierre del `.contenedor`:

```jsx
      {colapso && campo && (
        <ColapsoFisico
          campo={campo}
          refContenedor={refContenedor}
          posicionInicialRaton={colapso}
          alTerminar={() => {
            refEsperandoSalida.current = true;
            setColapso(null);
          }}
        />
      )}
```

- [ ] **Step 6: Verificar que compila**

Run: `cd apps/web && npm run build`
Expected: `✓ Compiled successfully`, 0 errores.

- [ ] **Step 7: Verificar el comportamiento en el navegador**

Run: `cd apps/web && npm run dev`, abrir la home y esperar a que el nombre termine de formarse en tipografía limpia.

Verificar, en orden:
1. Pasar el mouse por encima del nombre → se convierte en caracteres ASCII y la pila entera se derrumba.
2. Los caracteres caen hasta el **pie de la sección** (los 100vh del hero), no hasta el borde de la caja del nombre.
3. Mover el cursor entre los caracteres ya asentados los empuja.
4. Cuando se estabilizan, el stickman entra desde la izquierda barriendo, con los brazos estirando y encogiendo.
5. Amontona los caracteres contra el borde derecho, deja de barrer, sigue caminando y sale de pantalla.
6. Recién ahí arranca el rebobinado: el stickman vuelve caminando hacia atrás desbarriendo y sale por la izquierda, y los caracteres deshacen su caída hasta reformar el nombre.
7. Al terminar reaparece la tipografía limpia.
8. Quedarse quieto encima **no** re-dispara; salir del área y volver a entrar **sí**.
9. La consola del navegador no muestra errores ni warnings nuevos.

Si algún valor se ve mal (el stickman muy rápido/lento, entra antes de que se asiente la pila, la escoba no empuja bien), ajustar las constantes de `ColapsoFisico.jsx` señaladas en Global Constraints y volver a verificar.

Detener el servidor de dev al terminar.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/NombreAscii/NombreAscii.jsx
git commit -m "feat(web): dispara el colapso fisico al pasar el mouse sobre el nombre"
```
