# Sobre mí: línea de tiempo con scroll fijado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el placeholder de `sobre-mi` por una sección a pantalla completa que queda fija mientras el scroll avanza una línea de tiempo de 7 hitos, con fondo que cambia por hito y una descripción con palabras resaltadas al hacer hover (escritorio) o tocar un hito (celular).

**Architecture:** Un contenedor alto con un panel `position: sticky`. El progreso del scroll nativo (`useScroll` de framer-motion) se traduce a un índice de hito. Seis componentes chicos con una responsabilidad cada uno (`FondoHito`, `LineaTiempo`, `EncabezadoHito`, `EscenarioHito`, `DescripcionHito`, y `SobreMi` que los orquesta) más dos funciones puras testeadas (`dividirResaltado`, `indiceDeHito`). El estado `detalleAbierto` es un solo booleano: en escritorio lo mueve el hover/foco, en celular lo mueven los toques.

**Tech Stack:** React 19 / Next.js 15 (App Router), JSX sin TypeScript, CSS Modules, framer-motion (ya instalado), `next/image`. Tests de las funciones puras con `node:test` (incluido en Node ≥ 24, sin dependencias).

**Spec:** `docs/superpowers/specs/2026-10-10-sobre-mi-linea-tiempo-design.md`

## Global Constraints

- Sin TypeScript, sin Tailwind, sin dependencias nuevas. CSS Modules únicamente.
- Identificadores y comentarios en español: `SobreMi`, `LineaTiempo`, `FondoHito`, `DescripcionHito`, `EscenarioHito`, `EncabezadoHito`, `hitoActivo`, `detalleAbierto`, `dividirResaltado`, `indiceDeHito`, `progresoDeHito`.
- Scroll nativo con `position: sticky`; **no** se captura la rueda con `preventDefault`.
- Salida del ancho de `<main>`: `width: 100vw; margin-left: calc(50% - 50vw)`. No se toca `<main>` ni `globals.css`.
- Breakpoint de celular: `max-width: 768px` (el mismo que usa `Header.module.css`).
- Colores sólo con tokens: `var(--color-bg)`, `var(--color-fg)`, `var(--color-muted)`, `var(--color-accent)` (`#5b8cff`), `var(--color-border)`. El difuminado de la imagen usa `mask-image`, no un color fijo, para que funcione en ambos temas.
- Difuminado de la imagen en **tres bordes** en escritorio (izquierda, arriba, abajo) y en **dos** (arriba, abajo) en celular.
- `prefers-reduced-motion: reduce` apaga zoom, crossfade largo, desarme y transiciones de la cinta; la descripción sólo aparece y desaparece.
- Imágenes de fondo en `apps/web/public/hitos/hito-0.jpg` … `hito-6.jpg`, referenciadas por ruta pública. Todavía no existen: una imagen que falla se omite y el fondo queda del color del tema.
- Trabajar en la rama `feature/sobre-mi`; no commitear a `main` directamente.
- El repo no tiene suite de tests ni script `test`. Las funciones puras se prueban con `node --test <archivo>` directo; no se agrega script de npm ni test runner. El resto se verifica con `cd apps/web && npm run build` (0 errores) y la comprobación manual que indica cada tarea.
- Fuera de alcance: el modelo 3D (`EscenarioHito` es un marcador de posición) y la intro del retrato que se desarma.

## Review Focus

- `**` sin cerrar, vacío o consecutivo (`****`) en un texto del JSON: no debe romper ni dejar `**` visibles de forma accidental (Task 1, tests).
- Progreso de scroll fuera de `[0, 1]` o `NaN` (rebote elástico en iOS/macOS, resize): el índice debe quedar acotado a un hito válido (Task 1, tests).
- Imagen de hito inexistente (hoy todas): el fondo queda limpio, sin ícono de imagen rota ni error en consola que bloquee (Task 3, comprobación manual).
- Ventana angosta de escritorio (≈ 769–900 px): el título largo de un hito no debe desbordar ni pisar la cinta (Task 6, comprobación manual).
- Girar el celular o redimensionar con el detalle abierto: el panel se recompone sin quedar en un estado intermedio (Task 6, comprobación manual).

---

### Task 1: Funciones puras y sus tests

**Files:**
- Create: `apps/web/src/lib/resaltado.js`
- Create: `apps/web/src/lib/hitoActivo.js`
- Test: `apps/web/src/lib/sobreMi.test.js`

**Interfaces:**
- Produces: `dividirResaltado(texto: string) → Array<{ texto: string, resaltado: boolean }>`
- Produces: `indiceDeHito(progreso: number, total: number) → number` (entero en `[0, total - 1]`, `0` si `total <= 0` o `progreso` no es finito)
- Produces: `progresoDeHito(indice: number, total: number) → number` (centro del tramo del hito: `(indice + 0.5) / total`)

- [ ] **Step 1: Crear la rama**

```bash
cd C:/Users/Asus/Desktop/Trabajo/PORTAFOLIO
git switch -c feature/sobre-mi
```

- [ ] **Step 2: Escribir el test que falla**

Crear `apps/web/src/lib/sobreMi.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { dividirResaltado } from './resaltado.js';
import { indiceDeHito, progresoDeHito } from './hitoActivo.js';

test('dividirResaltado: texto sin marcas es un único fragmento normal', () => {
  assert.deepEqual(dividirResaltado('hola mundo'), [{ texto: 'hola mundo', resaltado: false }]);
});

test('dividirResaltado: separa lo resaltado del resto', () => {
  assert.deepEqual(dividirResaltado('a **b** c'), [
    { texto: 'a ', resaltado: false },
    { texto: 'b', resaltado: true },
    { texto: ' c', resaltado: false },
  ]);
});

test('dividirResaltado: resaltado al principio y al final', () => {
  assert.deepEqual(dividirResaltado('**a** y **b**'), [
    { texto: 'a', resaltado: true },
    { texto: ' y ', resaltado: false },
    { texto: 'b', resaltado: true },
  ]);
});

test('dividirResaltado: una marca sin cerrar queda como texto literal', () => {
  assert.deepEqual(dividirResaltado('a **b'), [{ texto: 'a **b', resaltado: false }]);
  assert.deepEqual(dividirResaltado('a **b** c **d'), [
    { texto: 'a ', resaltado: false },
    { texto: 'b', resaltado: true },
    { texto: ' c **d', resaltado: false },
  ]);
});

test('dividirResaltado: vacío y marcas vacías no generan fragmentos', () => {
  assert.deepEqual(dividirResaltado(''), []);
  assert.deepEqual(dividirResaltado('****'), []);
});

test('indiceDeHito: reparte el progreso en tramos iguales', () => {
  assert.equal(indiceDeHito(0, 7), 0);
  assert.equal(indiceDeHito(0.5, 7), 3);
  assert.equal(indiceDeHito(0.999, 7), 6);
  assert.equal(indiceDeHito(1, 7), 6);
});

test('indiceDeHito: acota progreso fuera de rango, NaN y total inválido', () => {
  assert.equal(indiceDeHito(-0.2, 7), 0);
  assert.equal(indiceDeHito(1.4, 7), 6);
  assert.equal(indiceDeHito(Number.NaN, 7), 0);
  assert.equal(indiceDeHito(0.5, 0), 0);
});

test('progresoDeHito: cae dentro del tramo de su propio hito', () => {
  for (let i = 0; i < 7; i += 1) {
    assert.equal(indiceDeHito(progresoDeHito(i, 7), 7), i);
  }
});
```

- [ ] **Step 3: Verificar que falla**

Run: `node --test apps/web/src/lib/sobreMi.test.js`
Expected: FAIL con `ERR_MODULE_NOT_FOUND` (los módulos todavía no existen). Puede aparecer además un aviso `MODULE_TYPELESS_PACKAGE_JSON`: es inofensivo.

- [ ] **Step 4: Implementar `resaltado.js`**

```js
// Separa un texto con marcas `**así**` en fragmentos. Una marca sin cerrar
// no se interpreta: queda como texto literal en vez de tragarse el resto.
export function dividirResaltado(texto) {
  const partes = texto.split('**');
  // Un número par de partes significa un número impar de `**`: el último no
  // tiene pareja, así que se vuelve a pegar al fragmento anterior.
  if (partes.length % 2 === 0) {
    const ultima = partes.pop();
    partes[partes.length - 1] += `**${ultima}`;
  }
  return partes
    .map((contenido, i) => ({ texto: contenido, resaltado: i % 2 === 1 }))
    .filter((parte) => parte.texto.length > 0);
}
```

- [ ] **Step 5: Implementar `hitoActivo.js`**

```js
// Hito activo para un progreso de scroll en [0, 1]. El rebote elástico de
// iOS/macOS y los resize pueden dar valores fuera de rango o NaN: se acotan.
export function indiceDeHito(progreso, total) {
  if (total <= 0 || !Number.isFinite(progreso)) return 0;
  const acotado = Math.min(1, Math.max(0, progreso));
  return Math.min(total - 1, Math.floor(acotado * total));
}

// Progreso que cae justo en el centro del tramo de un hito: es adonde hay que
// scrollear para "ir" a ese hito sin quedar en el borde con el vecino.
export function progresoDeHito(indice, total) {
  return (indice + 0.5) / total;
}
```

- [ ] **Step 6: Verificar que pasa**

Run: `node --test apps/web/src/lib/sobreMi.test.js`
Expected: PASS, 8 tests, 0 fail.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/resaltado.js apps/web/src/lib/hitoActivo.js apps/web/src/lib/sobreMi.test.js
git commit -m "feat(web): funciones puras de resaltado e indice de hito, con tests

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Datos de los hitos y hook de media query

**Files:**
- Create: `apps/web/src/data/hitos.json`
- Create: `apps/web/src/hooks/useConsulta.js`
- Create: `apps/web/public/hitos/.gitkeep`

**Interfaces:**
- Produces: `hitos.json`: array de `{ id: number, anio: string, titulo: string, resumen: string, descripcion: string, imagen: string }`. `descripcion` admite `**resaltado**`.
- Produces: `useConsulta(consulta: string) → boolean` (default export; `false` en el primer render y en el servidor, después refleja `window.matchMedia(consulta).matches` y se actualiza si cambia).

- [ ] **Step 1: Crear `hitos.json`**

```json
[
  {
    "id": 0,
    "anio": "Origen",
    "titulo": "Quien repara y mejora",
    "resumen": "Siempre me fascinó todo lo que hacía beep.",
    "descripcion": "Mi sueño fue ser la persona que **soluciona**: la que dedica su tiempo a **reparar, mejorar y proyectar sistemas** para hacer las cosas más fáciles. Desde el principio me gustó la tecnología y tuve una pasión por **cada cosa que hacía beep**.",
    "imagen": "/hitos/hito-0.jpg"
  },
  {
    "id": 1,
    "anio": "2022",
    "titulo": "Abanderado e ingeniería",
    "resumen": "Del ISFA a la UTN.",
    "descripcion": "Me recibí de **abanderado** en el Instituto San Francisco de Asís (**ISFA**), en San Francisco, Córdoba. Ese mismo año empecé **Ingeniería en Sistemas de Información** en la **UTN San Francisco**.",
    "imagen": "/hitos/hito-1.jpg"
  },
  {
    "id": 2,
    "anio": "2023",
    "titulo": "Inglés y adelanto de materias",
    "resumen": "Más libertad para empezar todo lo demás.",
    "descripcion": "A mediados de 2023 terminé de cursar inglés en el **EPI** y obtuve la certificación **First de Cambridge**. También **adelanté materias**, lo que me dejó **más libre** para empezar todas las cosas que quería hacer.",
    "imagen": "/hitos/hito-2.jpg"
  },
  {
    "id": 3,
    "anio": "2024",
    "titulo": "Primeras experiencias",
    "resumen": "Laboratorio, docencia y freelance.",
    "descripcion": "Sentí la necesidad de ganar experiencia. Fui **ayudante de laboratorio** en la UTN, donde participé en la **reparación, instalación y desarme de equipos**. Fui **profesor de ingreso** de Programación: Python, C, **diagramas de flujo** y **lógica de procesos**. Empecé a hacer **trabajo freelance**: **JustPhones**, **Calidad Esencia**, **AlgoBonitoSV** y **AsistenteInteligente**.",
    "imagen": "/hitos/hito-3.jpg"
  },
  {
    "id": 4,
    "anio": "2025",
    "titulo": "Técnico y docente",
    "resumen": "Más de 90 alumnos y un taller.",
    "descripcion": "Volví a ser **profesor de ingreso**, ahora con **más de 90 alumnos**. Me convertí en **técnico informático** en **Darío Martínez Computación**: reparé PCs, notebooks, impresoras, teléfonos, **hardware y software**. Salió la **web de Darío Martínez Computación**, y los fines de semana trabajé de **bartender y mozo** en boliches y eventos.",
    "imagen": "/hitos/hito-4.jpg"
  },
  {
    "id": 5,
    "anio": "2026",
    "titulo": "Fullstack en MBRF",
    "resumen": "Trazabilidad industrial a escala.",
    "descripcion": "Empecé en **MBRF**, en San Jorge, donde sigo como **desarrollador fullstack** en **sistemas de trazabilidad industrial** para las plantas del frigorífico y los centros de distribución de Argentina. Trabajo con **SAP**, aprendí **Kubernetes** y a **coordinar equipos**. En paralelo sigo con **Neifert Automotores** y **Darío Martínez Computación** como freelance, sumando a **compañeros de la facultad** para que también ganen experiencia, y curso el **4.º año** de la carrera.",
    "imagen": "/hitos/hito-5.jpg"
  },
  {
    "id": 6,
    "anio": "Hoy",
    "titulo": "Lo que viene",
    "resumen": "Quiero seguir creciendo.",
    "descripcion": "Busco una **nueva oportunidad** para crecer y seguir adelante en mi vida profesional, desarrollándome en lo que tanto me apasiona.",
    "imagen": "/hitos/hito-6.jpg"
  }
]
```

- [ ] **Step 2: Crear `useConsulta.js`**

```js
'use client';

import { useEffect, useState } from 'react';

// `window.matchMedia(consulta).matches`, reactivo. Arranca en `false` (en el
// servidor no hay `window`) y se corrige en el primer efecto.
export default function useConsulta(consulta) {
  const [coincide, setCoincide] = useState(false);

  useEffect(() => {
    const lista = window.matchMedia(consulta);
    const actualizar = () => setCoincide(lista.matches);
    actualizar();
    lista.addEventListener('change', actualizar);
    return () => lista.removeEventListener('change', actualizar);
  }, [consulta]);

  return coincide;
}
```

- [ ] **Step 3: Crear la carpeta de imágenes**

```bash
mkdir -p apps/web/public/hitos && touch apps/web/public/hitos/.gitkeep
```

- [ ] **Step 4: Verificar que el JSON es válido**

Run: `node -e "const h=require('./apps/web/src/data/hitos.json'); console.log(h.length, h.every(x=>x.id>=0&&x.anio&&x.titulo&&x.resumen&&x.descripcion&&x.imagen))"`
Expected: `7 true`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/data/hitos.json apps/web/src/hooks/useConsulta.js apps/web/public/hitos/.gitkeep
git commit -m "feat(web): datos de los hitos y hook useConsulta

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: FondoHito

**Files:**
- Create: `apps/web/src/components/SobreMi/FondoHito.jsx`
- Create: `apps/web/src/components/SobreMi/FondoHito.module.css`

**Interfaces:**
- Consumes: `hitos[]` (Task 2).
- Produces: `<FondoHito hitos={hitos} activo={number} />` (default export). Todas las imágenes están montadas; la activa tiene `opacity: 1`. Una imagen que falla se omite.

- [ ] **Step 1: Crear `FondoHito.jsx`**

```jsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import styles from './FondoHito.module.css';

// Todas las imágenes quedan montadas y sólo cambia la opacidad: así el cambio
// de hito es un crossfade y no una carga. Una imagen que no existe se omite
// en vez de dejar el ícono de imagen rota.
export default function FondoHito({ hitos, activo }) {
  const [fallidas, setFallidas] = useState({});

  return (
    <div className={styles.fondo} aria-hidden="true">
      {hitos.map((hito, i) =>
        fallidas[hito.id] ? null : (
          <div key={hito.id} className={`${styles.capa} ${i === activo ? styles.activa : ''}`}>
            <Image
              src={hito.imagen}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 62vw"
              priority={i === 0}
              className={styles.imagen}
              onError={() => setFallidas((previas) => ({ ...previas, [hito.id]: true }))}
            />
          </div>
        )
      )}
    </div>
  );
}
```

- [ ] **Step 2: Crear `FondoHito.module.css`**

```css
/* Ocupa la derecha del panel y se funde con el color del tema por tres bordes
   (izquierda, arriba y abajo) con dos máscaras combinadas. La máscara no
   pinta ningún color: funciona igual en tema claro y oscuro. */
.fondo {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 62%;
  z-index: 0;
  pointer-events: none;
  -webkit-mask-image:
    linear-gradient(to right, transparent 0%, #000 45%),
    linear-gradient(to bottom, transparent 0%, #000 18%, #000 82%, transparent 100%);
  -webkit-mask-composite: source-in;
  mask-image:
    linear-gradient(to right, transparent 0%, #000 45%),
    linear-gradient(to bottom, transparent 0%, #000 18%, #000 82%, transparent 100%);
  mask-composite: intersect;
  transition: opacity 0.5s ease;
}

.capa {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.7s ease;
}

.activa {
  opacity: 1;
}

.imagen {
  object-fit: cover;
  filter: brightness(0.72) saturate(1.1);
  transform: scale(1);
  transition: transform 8s linear;
}

/* Zoom lento mientras el hito está activo. */
.activa .imagen {
  transform: scale(1.06);
}

@media (max-width: 768px) {
  .fondo {
    width: 100%;
    /* En celular el fondo ocupa todo el ancho: sólo se funde arriba y abajo. */
    -webkit-mask-image: linear-gradient(to bottom, transparent 0%, #000 18%, #000 82%, transparent 100%);
    mask-image: linear-gradient(to bottom, transparent 0%, #000 18%, #000 82%, transparent 100%);
  }

  /* En el estado detalle del celular la imagen desaparece. */
  :global([data-detalle='true']) .fondo {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .capa {
    transition-duration: 0.01s;
  }

  .imagen,
  .activa .imagen {
    transition: none;
    transform: none;
  }
}
```

- [ ] **Step 3: Verificar que compila**

Run: `cd apps/web && npm run build`
Expected: build sin errores (el componente todavía no se usa; sólo debe compilar sin romper nada).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/SobreMi/FondoHito.jsx apps/web/src/components/SobreMi/FondoHito.module.css
git commit -m "feat(web): FondoHito con crossfade, zoom lento y difuminado en tres bordes

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: LineaTiempo

**Files:**
- Create: `apps/web/src/components/SobreMi/LineaTiempo.jsx`
- Create: `apps/web/src/components/SobreMi/LineaTiempo.module.css`

**Interfaces:**
- Consumes: `hitos[]` (Task 2).
- Produces: `<LineaTiempo hitos activo onSeleccionar onApuntarActivo onToqueHilo />` (default export):
  - `onSeleccionar(indice: number)`: clic/toque en un punto.
  - `onApuntarActivo(abierto: boolean)`: mouse entra/sale del punto **activo** (sólo `pointerType === 'mouse'`) o foco/desenfoque del punto activo.
  - `onToqueHilo()`: toque sobre el hilo fuera de un punto.

- [ ] **Step 1: Crear `LineaTiempo.jsx`**

```jsx
'use client';

import styles from './LineaTiempo.module.css';

// Cinta vertical: todos los puntos están en la misma columna y se trasladan
// para que el activo quede siempre en el centro (`--d` es la distancia, con
// signo, al activo). Los vecinos se atenúan y los lejanos desaparecen.
export default function LineaTiempo({ hitos, activo, onSeleccionar, onApuntarActivo, onToqueHilo }) {
  return (
    <nav
      className={styles.linea}
      aria-label="Línea de tiempo"
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) onToqueHilo();
      }}
    >
      <span className={styles.hiloPasado} aria-hidden="true" />
      <span className={styles.hiloFuturo} aria-hidden="true" />
      <ul className={styles.lista}>
        {hitos.map((hito, i) => {
          const distancia = Math.abs(i - activo);
          const esActivo = i === activo;
          return (
            <li
              key={hito.id}
              className={styles.item}
              style={{ '--d': i - activo }}
              data-distancia={Math.min(distancia, 3)}
            >
              <button
                type="button"
                className={`${styles.boton} ${esActivo ? styles.activo : ''}`}
                aria-current={esActivo ? 'step' : undefined}
                tabIndex={distancia > 2 ? -1 : 0}
                onClick={(evento) => {
                  evento.stopPropagation();
                  onSeleccionar(i);
                }}
                onPointerEnter={(evento) => {
                  if (esActivo && evento.pointerType === 'mouse') onApuntarActivo(true);
                }}
                onPointerLeave={(evento) => {
                  if (esActivo && evento.pointerType === 'mouse') onApuntarActivo(false);
                }}
                onFocus={() => {
                  if (esActivo) onApuntarActivo(true);
                }}
                onBlur={() => {
                  if (esActivo) onApuntarActivo(false);
                }}
              >
                <span className={styles.rotulo}>
                  <span className={styles.anio}>{hito.anio}</span>
                  <span className={styles.nombre}>{hito.titulo}</span>
                </span>
                <span className={styles.punto} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 2: Crear `LineaTiempo.module.css`**

```css
.linea {
  --paso: 5.25rem;
  position: absolute;
  top: 0;
  bottom: 0;
  right: clamp(1rem, 5vw, 4rem);
  width: 2rem;
  z-index: 3;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, #000 18%, #000 82%, transparent 100%);
  mask-image: linear-gradient(to bottom, transparent 0%, #000 18%, #000 82%, transparent 100%);
}

/* El hilo: la mitad de arriba (lo ya recorrido) brilla; la de abajo, apagada.
   Como la cinta se mueve y el centro no, siempre se lee como "avance". */
.hiloPasado,
.hiloFuturo {
  position: absolute;
  left: 50%;
  width: 2px;
  transform: translateX(-50%);
  pointer-events: none;
}

.hiloPasado {
  top: 0;
  height: 50%;
  background: linear-gradient(to bottom, transparent, var(--color-accent));
  box-shadow: 0 0 12px var(--color-accent);
}

.hiloFuturo {
  top: 50%;
  bottom: 0;
  background: linear-gradient(to bottom, var(--color-border), transparent);
}

.lista {
  list-style: none;
  margin: 0;
  padding: 0;
}

.item {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 0;
  transform: translateY(calc(var(--d) * var(--paso)));
  transition: transform 0.7s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.45s ease;
}

.item[data-distancia='0'] {
  opacity: 1;
}

.item[data-distancia='1'] {
  opacity: 0.6;
}

.item[data-distancia='2'] {
  opacity: 0.28;
}

.item[data-distancia='3'] {
  opacity: 0;
  pointer-events: none;
}

/* El botón se ancla a la derecha del item y su rótulo cuelga hacia la
   izquierda, sobre la imagen. */
.boton {
  position: absolute;
  top: 0;
  right: 0;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 0.4rem 0;
  border: 0;
  background: none;
  color: var(--color-fg);
  font: inherit;
  cursor: pointer;
}

.rotulo {
  display: grid;
  max-width: 12rem;
  text-align: right;
  text-shadow: 0 1px 12px rgba(0, 0, 0, 0.45);
}

.anio {
  font-size: 0.85rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: var(--color-muted);
}

.nombre {
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.25;
}

.punto {
  display: grid;
  place-items: center;
  width: 2rem;
  flex: none;
}

.punto::before {
  content: '';
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 50%;
  background: var(--color-bg);
  border: 2px solid var(--color-muted);
  transition: background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease, transform 0.3s ease;
}

.activo .anio {
  color: var(--color-accent);
}

.activo .punto::before {
  background: var(--color-accent);
  border-color: var(--color-accent);
  transform: scale(1.3);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-accent) 25%, transparent), 0 0 18px var(--color-accent);
}

.boton:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 4px;
  border-radius: 8px;
}

@media (max-width: 768px) {
  /* Estado inicial: la cinta está centrada. Se posiciona con `left` (no con
     `right`) para poder animar el paso a la derecha. */
  .linea {
    right: auto;
    left: 50%;
    width: 3rem;
    transform: translateX(-50%);
    transition: left 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  }

  /* Estado detalle: la cinta se alinea a la derecha y deja sólo el año, así
     la columna de la izquierda conserva casi todo el ancho. */
  :global([data-detalle='true']) .linea {
    left: calc(100% - 2.5rem);
  }

  :global([data-detalle='true']) .nombre {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .item,
  .linea {
    transition-duration: 0.01s;
  }
}
```

- [ ] **Step 3: Verificar que compila**

Run: `cd apps/web && npm run build`
Expected: build sin errores.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/SobreMi/LineaTiempo.jsx apps/web/src/components/SobreMi/LineaTiempo.module.css
git commit -m "feat(web): LineaTiempo, cinta vertical con punto activo centrado

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Columna izquierda (EncabezadoHito, EscenarioHito, DescripcionHito)

**Files:**
- Create: `apps/web/src/components/SobreMi/EncabezadoHito.jsx` + `EncabezadoHito.module.css`
- Create: `apps/web/src/components/SobreMi/EscenarioHito.jsx` + `EscenarioHito.module.css`
- Create: `apps/web/src/components/SobreMi/DescripcionHito.jsx` + `DescripcionHito.module.css`

**Interfaces:**
- Consumes: `dividirResaltado` (Task 1); `TextoDescifrado` (`activarCon="view"`, `secuencial`, `velocidad`, `caracteres`, `className`, `encryptedClassName`).
- Produces: `<EncabezadoHito hito />`, `<EscenarioHito hito desarmado={boolean} />`, `<DescripcionHito hito visible={boolean} />` (todos default export).

- [ ] **Step 1: Crear `EncabezadoHito.jsx`**

```jsx
'use client';

import TextoDescifrado from '@/components/TextoDescifrado/TextoDescifrado.jsx';
import styles from './EncabezadoHito.module.css';

const CARACTERES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=<>/\\|';

// Año y título del hito activo. `key` por hito remonta el texto y por eso
// se vuelve a descifrar cada vez que cambia el hito.
export default function EncabezadoHito({ hito }) {
  return (
    <header className={styles.encabezado}>
      <p className={styles.anio}>
        <TextoDescifrado
          key={`anio-${hito.id}`}
          texto={hito.anio}
          activarCon="view"
          secuencial
          velocidad={45}
          caracteres={CARACTERES}
          className={styles.revelado}
          encryptedClassName={styles.encriptado}
        />
      </p>
      <h3 className={styles.titulo}>
        <TextoDescifrado
          key={`titulo-${hito.id}`}
          texto={hito.titulo}
          activarCon="view"
          secuencial
          velocidad={30}
          caracteres={CARACTERES}
          className={styles.revelado}
          encryptedClassName={styles.encriptado}
        />
      </h3>
      <p className={styles.resumen}>{hito.resumen}</p>
    </header>
  );
}
```

- [ ] **Step 2: Crear `EncabezadoHito.module.css`**

```css
.encabezado {
  display: grid;
  gap: 0.5rem;
}

.anio {
  margin: 0;
  font-size: clamp(2.6rem, 7vw, 5.5rem);
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.03em;
  color: var(--color-accent);
  text-shadow: 0 0 32px color-mix(in srgb, var(--color-accent) 45%, transparent);
}

.titulo {
  margin: 0;
  font-size: clamp(1.25rem, 2.4vw, 1.9rem);
  font-weight: 700;
  line-height: 1.2;
  color: var(--color-fg);
}

.resumen {
  margin: 0;
  font-size: 1rem;
  color: var(--color-muted);
}

.revelado {
  color: inherit;
}

.encriptado {
  color: var(--color-muted);
  opacity: 0.7;
}

@media (max-width: 768px) {
  .anio {
    font-size: 2.4rem;
  }
}
```

- [ ] **Step 3: Crear `EscenarioHito.jsx`**

```jsx
import styles from './EscenarioHito.module.css';

const RAMPA = ' .:-=+*#%@';
const COLUMNAS = 34;
const FILAS = 14;

// MARCADOR DE POSICIÓN del modelo 3D (sub-proyecto 2): un bloque de caracteres
// con forma de mancha, distinto por hito. Es determinista (misma semilla →
// mismo bloque) para que el render del servidor y el del cliente coincidan.
function generarBloque(semilla) {
  let estado = semilla * 9301 + 49297;
  const siguiente = () => {
    estado = (estado * 9301 + 49297) % 233280;
    return estado / 233280;
  };

  const lineas = [];
  for (let fila = 0; fila < FILAS; fila += 1) {
    let linea = '';
    for (let columna = 0; columna < COLUMNAS; columna += 1) {
      const dx = (columna / (COLUMNAS - 1)) * 2 - 1;
      const dy = (fila / (FILAS - 1)) * 2 - 1;
      const forma = 1 - Math.min(1, Math.hypot(dx, dy * 1.4));
      const valor = forma * 0.8 + siguiente() * 0.35;
      linea += RAMPA[Math.min(RAMPA.length - 1, Math.floor(valor * RAMPA.length))];
    }
    lineas.push(linea);
  }
  return lineas.join('\n');
}

export default function EscenarioHito({ hito, desarmado }) {
  return (
    <div className={`${styles.escenario} ${desarmado ? styles.desarmado : ''}`} aria-hidden="true">
      <pre className={styles.bloque}>{generarBloque(hito.id + 1)}</pre>
    </div>
  );
}
```

- [ ] **Step 4: Crear `EscenarioHito.module.css`**

```css
.escenario {
  display: grid;
  place-items: center;
  min-height: 16rem;
}

.bloque {
  margin: 0;
  font-family: ui-monospace, 'Cascadia Mono', Menlo, Consolas, monospace;
  font-size: clamp(0.55rem, 1.05vw, 0.78rem);
  line-height: 1;
  color: var(--color-accent);
  text-shadow: 0 0 14px color-mix(in srgb, var(--color-accent) 70%, transparent);
  transition: opacity 0.5s ease, filter 0.5s ease, letter-spacing 0.6s ease, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Desarme: en escritorio el bloque se dispersa y se desvanece para dejar
   lugar a la descripción. En celular el estado detalle muestra los dos. */
@media (min-width: 769px) {
  .desarmado .bloque {
    opacity: 0;
    filter: blur(8px);
    letter-spacing: 0.6em;
    transform: scale(1.12);
  }
}

@media (max-width: 768px) {
  .escenario {
    min-height: 0;
    place-items: start;
  }

  .bloque {
    font-size: 0.5rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .bloque {
    transition: opacity 0.2s ease;
  }

  @media (min-width: 769px) {
    .desarmado .bloque {
      filter: none;
      letter-spacing: normal;
      transform: none;
    }
  }
}
```

- [ ] **Step 5: Crear `DescripcionHito.jsx`**

```jsx
import { dividirResaltado } from '@/lib/resaltado.js';
import styles from './DescripcionHito.module.css';

// El texto siempre está en el DOM (lo leen los lectores de pantalla); `visible`
// sólo decide si se ve. Las palabras clave llevan `--n` para que se enciendan
// escalonadas, una detrás de otra.
export default function DescripcionHito({ hito, visible }) {
  let claves = 0;
  const partes = dividirResaltado(hito.descripcion).map((parte, i) => {
    if (!parte.resaltado) return <span key={i}>{parte.texto}</span>;
    const n = claves;
    claves += 1;
    return (
      <strong key={i} className={styles.clave} style={{ '--n': n }}>
        {parte.texto}
      </strong>
    );
  });

  return (
    <div className={`${styles.descripcion} ${visible ? styles.visible : ''}`}>
      <p className={styles.texto}>{partes}</p>
    </div>
  );
}
```

- [ ] **Step 6: Crear `DescripcionHito.module.css`**

```css
/* En escritorio se superpone al escenario (que se desarma debajo). */
.descripcion {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  opacity: 0;
  transform: translateY(14px);
  pointer-events: none;
  transition: opacity 0.5s ease 0.15s, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.15s;
}

.visible {
  opacity: 1;
  transform: none;
  pointer-events: auto;
}

.texto {
  max-width: 34rem;
  margin: 0;
  font-size: clamp(0.98rem, 1.25vw, 1.12rem);
  line-height: 1.7;
  color: var(--color-fg);
}

.clave {
  font-weight: 700;
  color: var(--color-fg);
  transition: color 0.5s ease, text-shadow 0.5s ease;
  transition-delay: calc(var(--n) * 90ms + 0.4s);
}

.visible .clave {
  color: var(--color-accent);
  text-shadow: 0 0 16px color-mix(in srgb, var(--color-accent) 50%, transparent);
}

/* En celular el estado detalle muestra escenario y descripción apilados: la
   visibilidad la maneja la columna entera, así que acá siempre se ve. */
@media (max-width: 768px) {
  .descripcion {
    position: static;
    opacity: 1;
    transform: none;
    pointer-events: auto;
    margin-top: 1rem;
  }

  .clave {
    color: var(--color-accent);
    transition: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .descripcion {
    transform: none;
    transition-duration: 0.01s;
    transition-delay: 0s;
  }

  .clave {
    transition: none;
  }
}
```

- [ ] **Step 7: Verificar que compila**

Run: `cd apps/web && npm run build`
Expected: build sin errores.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/SobreMi/EncabezadoHito.* apps/web/src/components/SobreMi/EscenarioHito.* apps/web/src/components/SobreMi/DescripcionHito.*
git commit -m "feat(web): encabezado, escenario provisorio y descripcion de hito

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: SobreMi (orquestador) y conexión en la página

**Files:**
- Create: `apps/web/src/components/SobreMi/SobreMi.jsx`
- Create: `apps/web/src/components/SobreMi/SobreMi.module.css`
- Modify: `apps/web/src/app/page.jsx`

**Interfaces:**
- Consumes: todo lo anterior (`FondoHito`, `LineaTiempo`, `EncabezadoHito`, `EscenarioHito`, `DescripcionHito`, `useConsulta`, `indiceDeHito`, `progresoDeHito`, `hitos.json`).
- Produces: `<SobreMi />` (default export): renderiza `<section id="sobre-mi">`.

- [ ] **Step 1: Crear `SobreMi.jsx`**

```jsx
'use client';

import { useCallback, useRef, useState } from 'react';
import { useMotionValueEvent, useScroll } from 'framer-motion';
import hitos from '@/data/hitos.json';
import useConsulta from '@/hooks/useConsulta.js';
import { indiceDeHito, progresoDeHito } from '@/lib/hitoActivo.js';
import FondoHito from './FondoHito.jsx';
import LineaTiempo from './LineaTiempo.jsx';
import EncabezadoHito from './EncabezadoHito.jsx';
import EscenarioHito from './EscenarioHito.jsx';
import DescripcionHito from './DescripcionHito.jsx';
import styles from './SobreMi.module.css';

function SobreMiContenido() {
  const refContenedor = useRef(null);
  const [activo, setActivo] = useState(0);
  // Un solo estado para los dos mundos: en escritorio lo mueven el hover y el
  // foco; en celular, los toques sobre un punto, el hilo y la "×".
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const sinHover = !useConsulta('(hover: hover) and (pointer: fine)');

  const { scrollYProgress } = useScroll({
    target: refContenedor,
    offset: ['start start', 'end end'],
  });
  useMotionValueEvent(scrollYProgress, 'change', (progreso) => {
    setActivo(indiceDeHito(progreso, hitos.length));
  });

  const irAlHito = useCallback((indice) => {
    const contenedor = refContenedor.current;
    if (!contenedor) return;
    const recorrido = contenedor.offsetHeight - window.innerHeight;
    const arriba = contenedor.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top: arriba + progresoDeHito(indice, hitos.length) * recorrido,
      behavior: 'smooth',
    });
  }, []);

  function alSeleccionar(indice) {
    irAlHito(indice);
    if (sinHover) setDetalleAbierto(true);
  }

  // En dispositivos táctiles el foco y el hover no deben abrir ni cerrar nada:
  // tocar la descripción desenfoca el botón y cerraría el detalle sin querer.
  function alApuntar(abierto) {
    if (!sinHover) setDetalleAbierto(abierto);
  }

  const hito = hitos[activo];

  return (
    <section id="sobre-mi" ref={refContenedor} className={styles.contenedor} style={{ '--hitos': hitos.length }}>
      <div className={styles.panel} data-detalle={detalleAbierto}>
        <FondoHito hitos={hitos} activo={activo} />
        <h2 className={styles.etiqueta}>Sobre mí</h2>

        <div
          className={styles.columna}
          onPointerEnter={(evento) => {
            if (evento.pointerType === 'mouse') alApuntar(true);
          }}
          onPointerLeave={(evento) => {
            if (evento.pointerType === 'mouse') alApuntar(false);
          }}
        >
          <EncabezadoHito hito={hito} />
          <div className={styles.zona}>
            <EscenarioHito hito={hito} desarmado={detalleAbierto} />
            <DescripcionHito hito={hito} visible={detalleAbierto} />
          </div>
        </div>

        <LineaTiempo
          hitos={hitos}
          activo={activo}
          onSeleccionar={alSeleccionar}
          onApuntarActivo={alApuntar}
          onToqueHilo={() => setDetalleAbierto(false)}
        />

        <button
          type="button"
          className={styles.cerrar}
          aria-label="Cerrar detalle"
          onClick={() => setDetalleAbierto(false)}
        >
          ×
        </button>
      </div>
    </section>
  );
}

export default function SobreMi() {
  return hitos.length > 0 ? <SobreMiContenido /> : null;
}
```

- [ ] **Step 2: Crear `SobreMi.module.css`**

```css
/* Sale del ancho de <main> (960px) sin tocarlo, y es alto: el panel sticky
   queda fijo mientras se recorre ese alto, y ese recorrido es el avance de
   la línea de tiempo. */
.contenedor {
  position: relative;
  width: 100vw;
  margin-left: calc(50% - 50vw);
  height: calc(100svh + var(--hitos) * 70svh);
}

.panel {
  position: sticky;
  top: 0;
  display: flex;
  align-items: center;
  height: 100svh;
  overflow: hidden;
  padding: 5.5rem clamp(1.25rem, 5vw, 4rem) 3rem;
}

.etiqueta {
  position: absolute;
  top: 5.5rem;
  left: clamp(1.25rem, 5vw, 4rem);
  z-index: 2;
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--color-muted);
}

.columna {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: min(42%, 34rem);
}

.zona {
  position: relative;
  min-height: 18rem;
}

.cerrar {
  display: none;
}

@media (max-width: 768px) {
  .contenedor {
    height: calc(100svh + var(--hitos) * 60svh);
  }

  .panel {
    align-items: flex-start;
    padding: 5rem 1rem 2rem;
  }

  .etiqueta {
    left: 1rem;
    top: 5rem;
  }

  /* Estado inicial: sólo se ven la imagen y la cinta centrada. */
  .columna {
    width: calc(100% - 4.5rem);
    margin-top: 2rem;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.4s ease 0.1s;
  }

  .panel[data-detalle='true'] .columna {
    opacity: 1;
    pointer-events: auto;
  }

  .zona {
    min-height: 0;
  }

  .cerrar {
    position: absolute;
    top: 4.4rem;
    right: 0.75rem;
    z-index: 4;
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border: 1px solid var(--color-border);
    border-radius: 50%;
    background: var(--color-chip-bg);
    color: var(--color-fg);
    font: inherit;
    font-size: 1.2rem;
    line-height: 1;
    cursor: pointer;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
  }

  .panel[data-detalle='true'] .cerrar {
    opacity: 1;
    pointer-events: auto;
  }
}
```

- [ ] **Step 3: Conectar en `page.jsx`**

Reemplazar el contenido de `apps/web/src/app/page.jsx` por:

```jsx
import SobreMi from '@/components/SobreMi/SobreMi.jsx';
import styles from './page.module.css';

const SECCIONES = [
  { id: 'sobre-mi', titulo: 'Sobre mí' },
  { id: 'proyectos', titulo: 'Proyectos' },
  { id: 'experiencia', titulo: 'Experiencia' },
  { id: 'habilidades', titulo: 'Habilidades' },
  { id: 'contacto', titulo: 'Contacto' },
];

export default function HomePage() {
  return (
    <>
      <section id="inicio" className={styles.seccionHero} />
      {SECCIONES.map((seccion) =>
        seccion.id === 'sobre-mi' ? (
          <SobreMi key={seccion.id} />
        ) : (
          <section key={seccion.id} id={seccion.id} className={styles.seccion}>
            <h2>{seccion.titulo}</h2>
          </section>
        )
      )}
    </>
  );
}
```

- [ ] **Step 4: Verificar que compila**

Run: `cd apps/web && npm run build`
Expected: build sin errores ni warnings de ESLint nuevos.

- [ ] **Step 5: Comprobación manual en escritorio**

Run: `npm run dev:web` (desde la raíz) y abrir `http://localhost:3000`, en ventana ≥ 1100 px.

Verificar, marcando cada punto:
- Al scrollear desde el hero, la sección "Sobre mí" ocupa toda la pantalla y **se queda fija** mientras la rueda avanza la cinta; no hay scroll horizontal.
- El hito activo está centrado en la cinta; al scrollear cambia el año y el título (se descifran) y el bloque ASCII.
- Con el cursor sobre la columna izquierda o sobre el punto activo: el bloque se desarma y aparece la descripción con las palabras clave encendiéndose en azul. Al sacar el cursor, vuelve.
- Clic en un punto lejano: scrollea suavemente hasta ese hito.
- Tab llega a los puntos; el foco en el activo abre la descripción.
- Hasta el último hito y un poco más: el scroll sigue hacia "Proyectos" sin trabarse. Volviendo hacia arriba, hacia el hero, también.
- El fondo (sin imágenes) es el color del tema, sin íconos de imagen rota. Cambiar el tema (botón de tema) no deja nada ilegible.
- Ventana de ≈ 800 px de ancho: el título más largo ("Inglés y adelanto de materias") no pisa la cinta ni se corta.

- [ ] **Step 6: Comprobación manual en celular**

En las DevTools, modo dispositivo (≈ 390 px, táctil):
- Estado inicial: cinta **centrada**, sin columna izquierda ni descripción; al scrollear cambia el hito activo.
- Tocar un punto: la cinta se desliza a la derecha (mostrando sólo el año), aparecen a la izquierda el año/título, el bloque y **debajo** la descripción.
- Con el detalle abierto, seguir scrolleando cambia al hito siguiente sin volver al estado inicial.
- Tocar el hilo fuera de un punto, o la "×": vuelve al estado inicial.
- Girar a horizontal y volver con el detalle abierto: el panel se recompone sin quedar a medias.

- [ ] **Step 7: Comprobación con movimiento reducido**

En las DevTools: Rendering → "Emulate CSS prefers-reduced-motion: reduce". Verificar que no hay zoom ni desarme, y que la descripción aparece y desaparece sin animación larga.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/SobreMi/SobreMi.jsx apps/web/src/components/SobreMi/SobreMi.module.css apps/web/src/app/page.jsx
git commit -m "feat(web): seccion sobre mi con scroll fijado y linea de tiempo

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Ajuste fino y cierre

**Files:**
- Modify: los archivos de `apps/web/src/components/SobreMi/` que haga falta, según lo que se vea en el navegador.

- [ ] **Step 1: Ajustar a ojo**

Con `npm run dev:web` abierto, revisar y ajustar si hace falta (los valores del plan son puntos de partida): `--paso` en `LineaTiempo.module.css` (separación entre puntos), la altura `70svh` por hito en `SobreMi.module.css` (qué tan "largo" se siente el scroll), los porcentajes de las máscaras en `FondoHito.module.css`, y los tamaños de fuente del encabezado. Con imágenes de prueba en `apps/web/public/hitos/hito-0.jpg` … `hito-6.jpg` (cualquier JPG), verificar el crossfade, el zoom lento y los tres difuminados, en tema claro y oscuro. Esas imágenes de prueba **no se commitean**: borrarlas o dejarlas fuera del `git add`.

- [ ] **Step 2: Build final**

Run: `cd apps/web && npm run build`
Expected: build sin errores.

- [ ] **Step 3: Tests de las funciones puras**

Run: `node --test apps/web/src/lib/sobreMi.test.js`
Expected: PASS, 8 tests, 0 fail.

- [ ] **Step 4: Commit y subir la rama**

```bash
git add apps/web/src/components/SobreMi
git commit -m "style(web): ajuste fino de la seccion sobre mi

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push -u origin feature/sobre-mi
```

(Si el Step 1 no cambió nada, omitir el commit.) El merge a `main` queda para decidir con `superpowers:finishing-a-development-branch`.
