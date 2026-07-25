# Nombre ASCII Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Bienvenido" title in the `HeroInmersivo`'s `inicio` layer with the user's name ("Felipe" / "Diaz Aimar") that forms top-to-bottom as large ASCII (Figlet) text, framed by top/bottom gradient bars, then crossfades to clean typography once formed.

**Architecture:** A new `NombreAscii` client component wraps `react-ascii-text`'s `useAsciiText` hook (a new dependency), gated by two local timers: one delaying animation start until `Bienvenida`'s splash clears (3300ms, matching the existing pattern used by `TextoRodante`/`TextoDescifrado`), another estimating when the ASCII animation finishes (the library has no completion callback) to trigger the gradient-shrink + crossfade-to-plain-text transition. `HeroInmersivo` special-cases the `inicio` layer to render this component, left-aligned, instead of the generic centered title.

**Tech Stack:** React 19 / Next.js 15 (App Router), JSX (no TypeScript), CSS Modules, `react-ascii-text` (new dependency).

## Global Constraints

- No TypeScript — plain `.jsx`.
- CSS Modules only.
- Spanish identifiers: `NombreAscii`, `empezar`, `formado`, `refAscii`, `franjaSuperior`, `franjaInferior`, `textoLimpio`, `soloLectura`.
- Name text: two lines, exactly `'Felipe'` and `'Diaz Aimar'`.
- Animation must not start before `Bienvenida` clears — 3300ms delay from mount (`DEMORA_INICIO_MS`), same constant value already used elsewhere in the header/nav components.
- `react-ascii-text`'s `useAsciiText` hook must be called unconditionally every render (Rules of Hooks) — gate the actual animation via its `isPaused` prop, not conditional hook calls.
- After the animation completes (estimated via timer, no library callback exists), the top/bottom gradient bars shrink to `height: 0` and the ASCII `<pre>` crossfades out while plain styled text crossfades in — the plain text is the permanent resting state, no further animation.
- Gradient bar color: `linear-gradient` using `var(--color-bg)` fading to `transparent` (already theme-aware, no new tokens).
- A visually-hidden `<span>` always carries the literal text `"Felipe Diaz Aimar"` for accessibility; both the ASCII `<pre>` and the plain-text block are `aria-hidden="true"`.
- Numeric timing/sizing values in this plan (`DURACION_ANIMACION_MS`, font sizes, gradient bar height) are starting points — verify visually in the browser during implementation and adjust if something looks off.

---

### Task 1: Build NombreAscii

**Files:**
- Modify: `apps/web/package.json` (via `npm install`)
- Create: `apps/web/src/components/NombreAscii/NombreAscii.jsx`
- Create: `apps/web/src/components/NombreAscii/NombreAscii.module.css`

**Interfaces:**
- Consumes: `useAsciiText`, `standard` font export from `react-ascii-text`; `--color-fg`, `--color-bg`, `--font-sans` tokens (already defined).
- Produces: `export default function NombreAscii()`, zero-prop. Task 2 (`HeroInmersivo`) imports it as `import NombreAscii from '@/components/NombreAscii/NombreAscii.jsx';` and renders `<NombreAscii />` with no props.

- [ ] **Step 1: Install the dependency**

Run: `cd apps/web && npm install react-ascii-text`
Expected: exits 0, `apps/web/package.json` gains a `react-ascii-text` entry under `dependencies`.

- [ ] **Step 2: Create `NombreAscii.jsx`**

```jsx
'use client';

import { useEffect, useState } from 'react';
import { useAsciiText, standard } from 'react-ascii-text';
import styles from './NombreAscii.module.css';

const DEMORA_INICIO_MS = 3300;
const DURACION_ANIMACION_MS = 2600;
const CARACTERES_ANIMACION = '/*+#%@$&';

export default function NombreAscii() {
  const [empezar, setEmpezar] = useState(false);
  const [formado, setFormado] = useState(false);

  const refAscii = useAsciiText({
    font: standard,
    text: ['Felipe', 'Diaz Aimar'],
    animationDirection: 'down',
    animationCharacters: CARACTERES_ANIMACION,
    animationSpeed: 25,
    animationLoop: false,
    isPaused: !empezar,
  });

  useEffect(() => {
    const temporizadorInicio = setTimeout(() => setEmpezar(true), DEMORA_INICIO_MS);
    return () => clearTimeout(temporizadorInicio);
  }, []);

  useEffect(() => {
    if (!empezar) return;
    const temporizadorFin = setTimeout(() => setFormado(true), DURACION_ANIMACION_MS);
    return () => clearTimeout(temporizadorFin);
  }, [empezar]);

  return (
    <div className={styles.contenedor}>
      <span className={styles.soloLectura}>Felipe Diaz Aimar</span>

      <pre className={`${styles.ascii} ${formado ? styles.oculto : ''}`} ref={refAscii} aria-hidden="true" />

      <div className={`${styles.textoLimpio} ${formado ? styles.visible : ''}`} aria-hidden="true">
        <span>Felipe</span>
        <span>Diaz Aimar</span>
      </div>

      <div className={`${styles.franja} ${styles.franjaSuperior} ${formado ? styles.encogida : ''}`} />
      <div className={`${styles.franja} ${styles.franjaInferior} ${formado ? styles.encogida : ''}`} />
    </div>
  );
}
```

- [ ] **Step 3: Create `NombreAscii.module.css`**

```css
.contenedor {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 10rem;
}

.soloLectura {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.ascii {
  margin: 0;
  font-family: monospace;
  font-size: clamp(0.45rem, 0.9vw, 0.7rem);
  line-height: 1.05;
  color: var(--color-fg);
  white-space: pre;
  opacity: 1;
  transition: opacity 0.6s ease;
}

.ascii.oculto {
  opacity: 0;
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.textoLimpio {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  font-family: var(--font-sans);
  font-weight: 800;
  letter-spacing: -0.02em;
  font-size: clamp(2rem, 5vw, 4rem);
  color: var(--color-fg);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.6s ease;
}

.textoLimpio.visible {
  opacity: 1;
}

.franja {
  position: absolute;
  left: 0;
  right: 0;
  height: 42%;
  z-index: 2;
  pointer-events: none;
  transition: height 1s cubic-bezier(0.16, 1, 0.3, 1);
}

.franjaSuperior {
  top: 0;
  background: linear-gradient(to bottom, var(--color-bg) 0%, transparent 100%);
}

.franjaInferior {
  bottom: 0;
  background: linear-gradient(to top, var(--color-bg) 0%, transparent 100%);
}

.franja.encogida {
  height: 0%;
}
```

- [ ] **Step 4: Verify the build**

Run: `cd apps/web && npm run build`
Expected: build completes with no errors. If `react-ascii-text` errors on React 19 (peer dependency conflict or runtime error), stop and report the exact error — do not silently downgrade React or force-install; that's a decision for the user.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/components/NombreAscii
git commit -m "feat(web): add NombreAscii ASCII name formation component"
```

(Run `git add`/`git commit` from `apps/web/`; also stage the repo-root `package-lock.json` if the workspace install touched it — check with `git status` from the repo root.)

---

### Task 2: Wire into HeroInmersivo and verify

**Files:**
- Modify: `apps/web/src/components/HeroInmersivo/HeroInmersivo.jsx`
- Modify: `apps/web/src/components/HeroInmersivo/HeroInmersivo.module.css`

**Interfaces:**
- Consumes: `NombreAscii` from Task 1.
- Produces: nothing consumed later — this is the integration point.

- [ ] **Step 1: Update `HeroInmersivo.jsx`**

Replace its full contents with:

```jsx
'use client';

import { usePortfolio } from '@/contexto/ProveedorPortfolio.jsx';
import NombreAscii from '@/components/NombreAscii/NombreAscii.jsx';
import styles from './HeroInmersivo.module.css';

const SECCIONES = [
  { id: 'inicio' },
  { id: 'sobre-mi', titulo: 'Sobre Mí' },
  { id: 'proyectos', titulo: 'Mis Proyectos' },
  { id: 'experiencia', titulo: 'Experiencia Laboral' },
  { id: 'habilidades', titulo: 'Mis Habilidades' },
  { id: 'contacto', titulo: 'Hablemos' },
];

export default function HeroInmersivo() {
  const { seccionActiva } = usePortfolio();

  return (
    <div className={styles.hero} aria-hidden="true">
      {SECCIONES.map((seccion) => (
        <div
          key={seccion.id}
          className={`${styles.capa} ${styles[`capa-${seccion.id}`]} ${
            seccion.id === seccionActiva ? styles.activa : ''
          }`}
        >
          {seccion.id === 'inicio' ? (
            <NombreAscii />
          ) : (
            <span className={styles.titulo}>{seccion.titulo}</span>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Update `HeroInmersivo.module.css`**

Find the `.capa-inicio` rule:

```css
.capa-inicio {
  background: linear-gradient(135deg, #1a1c22 0%, #2b2f3a 100%);
}
```

Replace it with:

```css
.capa-inicio {
  justify-content: flex-start;
  padding-left: clamp(2rem, 8vw, 6rem);
  background: linear-gradient(135deg, #1a1c22 0%, #2b2f3a 100%);
}
```

(The other `.capa-*` rules and the base `.capa`/`.titulo`/`.activa` rules are unchanged.)

- [ ] **Step 3: Verify the production build**

Run: `cd apps/web && npm run build`
Expected: build completes with no errors.

- [ ] **Step 4: Verify markup via SSR**

```bash
cd apps/web && npm run dev &
timeout 30 bash -c 'until curl -sf http://localhost:3000 >/dev/null || curl -sf http://localhost:3001 >/dev/null; do sleep 1; done'
curl -s http://localhost:3000/ | grep -oE 'Felipe Diaz Aimar|class="[^"]*ascii[^"]*"|class="[^"]*textoLimpio[^"]*"|class="[^"]*franja[^"]*"'
```

(Adjust the port if `next dev` logged a different one.)

Expected: the accessible `"Felipe Diaz Aimar"` string present, plus the `ascii`, `textoLimpio`, and `franja` (superior/inferior) classes all present in the markup. No `>Bienvenido<` text anywhere.

- [ ] **Step 5: Manually verify in a browser (things curl can't check)**

Wait for `Bienvenida` to clear (~3.2s), then on the `inicio` view:

1. **Formation:** the name assembles top-to-bottom in large ASCII block letters ("Felipe" then "Diaz Aimar"), framed by the top/bottom gradient bars.
2. **Settle:** once formed, the gradient bars shrink away and the ASCII crossfades into clean, normal-looking bold text — same two lines, left-aligned.
3. **No flash:** no visible flash of "Bienvenido" or unstyled content at any point.
4. **Console check:** no hydration warnings, no errors from `react-ascii-text` in DevTools console.
5. If the crossfade happens visibly too early/late relative to the ASCII animation actually finishing, note it precisely (e.g., "crossfade happens while ASCII is still mid-sweep on line 2") so `DURACION_ANIMACION_MS` can be retuned with a concrete target instead of guessing again.

Stop the dev server after verifying.

- [ ] **Step 6: Commit**

```bash
git add src/components/HeroInmersivo/HeroInmersivo.jsx src/components/HeroInmersivo/HeroInmersivo.module.css
git commit -m "feat(web): show NombreAscii in the Hero's inicio layer"
```
