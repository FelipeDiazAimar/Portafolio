# Header Scroll Morph + TextoBrillante Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve `<Header/>` so it morphs (via Framer Motion shared layout animation) from one big `GlassSurface` nav pill into 5 independent circular mini-pills once the visitor scrolls past `window.innerHeight`, each mini-pill expanding on hover to reveal its label, with all nav link text rendered through a new animated `<TextoBrillante/>` component.

**Architecture:** `framer-motion` is added as a new dependency. A shared `useScrollPasadoViewport` hook (extracted from `ThemeToggle`'s existing scroll logic) drives both `ThemeToggle`'s visibility and `Header`'s big-pill/mini-pills branch choice. `ElementoNavegacion` renders identically in both branches except for a `variante` class, sharing a `layoutId` per link so Framer Motion animates the position/size change between branches. `TextoBrillante` is a small two-layer (base + masked, animated "shine") text component using only CSS Modules keyframes — no JS-driven animation.

**Tech Stack:** React 19 / Next.js 15 (App Router), JSX (no TypeScript), CSS Modules, `framer-motion` (new dependency), `GlassSurface` from `@portafolio/ui` (already built).

## Global Constraints

- No TypeScript — plain `.jsx`.
- CSS Modules only, except Framer Motion's `motion.*` components (which take animation props, not classes, for `initial`/`animate`/`exit`/`layout`).
- New identifiers introduced in this plan use Spanish names: `TextoBrillante`, `ElementoNavegacion`, `useScrollPasadoViewport`, `estaScrolleado`, `ENLACES`, `variante`, `pasado`, `manejarScroll`. Existing identifiers in files only partially touched (`ThemeToggle`'s `theme`/`visible`/`handleToggle`/`IconMoon`/`IconSun`) are left as-is — only its scroll-tracking `useEffect` is replaced.
- `TextoBrillante` colors: base layer `color: var(--color-fg)`, shine layer `color: var(--color-bg)` — no hardcoded hex, no `prefers-color-scheme` media query (the existing token system already handles theme switching).
- Scroll threshold for both `ThemeToggle` and `Header`: `window.scrollY >= window.innerHeight` (shared via the new hook — exact same condition already used by `ThemeToggle` before this plan, just extracted).
- `GlassSurface` prop recipe (reused verbatim from `ThemeToggle`/current `Header`) for every glass surface introduced here: `opacity=0.9, brightness=45, blur=14, backgroundOpacity=0.12, saturation=1.4, distortionScale=-140, redOffset=0, greenOffset=6, blueOffset=14, displace=0.2`.
- Mini-pill rest size: 48×48px circle. Hover/focus-within expanded width: 160px. Transition: `width 0.45s cubic-bezier(0.16, 1, 0.3, 1)`.
- Icons: hand-written inline SVG, `viewBox="0 0 24 24"`, `width="18" height="18"`, `fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"` — no icon library.
- Mobile (`< 768px`): both the big pill and the mini-pills row stay hidden (`display: none`), unchanged from current behavior.

---

### Task 1: Install framer-motion and extract the shared scroll hook

**Files:**
- Modify: `apps/web/package.json` (via `npm install`)
- Create: `apps/web/src/hooks/useScrollPasadoViewport.js`
- Modify: `apps/web/src/components/ThemeToggle/ThemeToggle.jsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `export default function useScrollPasadoViewport()` returning a boolean (`true` once `window.scrollY >= window.innerHeight`, updates live on scroll). Task 4 (`Header`) consumes this as `import useScrollPasadoViewport from '@/hooks/useScrollPasadoViewport.js';`.

- [ ] **Step 1: Install the dependency**

Run: `cd apps/web && npm install framer-motion`
Expected: exits 0, `apps/web/package.json` gains a `framer-motion` entry under `dependencies`.

- [ ] **Step 2: Create the hook**

```js
// apps/web/src/hooks/useScrollPasadoViewport.js
'use client';

import { useEffect, useState } from 'react';

export default function useScrollPasadoViewport() {
  const [pasado, setPasado] = useState(false);

  useEffect(() => {
    let ticking = false;

    function actualizar() {
      setPasado(window.scrollY >= window.innerHeight);
      ticking = false;
    }

    function manejarScroll() {
      if (!ticking) {
        window.requestAnimationFrame(actualizar);
        ticking = true;
      }
    }

    window.addEventListener('scroll', manejarScroll, { passive: true });
    return () => window.removeEventListener('scroll', manejarScroll);
  }, []);

  return pasado;
}
```

- [ ] **Step 3: Refactor `ThemeToggle.jsx` to use the hook**

Replace the full contents of `apps/web/src/components/ThemeToggle/ThemeToggle.jsx` with:

```jsx
'use client';

import { useEffect, useState } from 'react';
import { GlassSurface } from '@portafolio/ui';
import useScrollPasadoViewport from '@/hooks/useScrollPasadoViewport.js';
import styles from './ThemeToggle.module.css';

function IconMoon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function IconSun() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function readStoredTheme() {
  try {
    return window.localStorage.getItem('theme');
  } catch {
    return null;
  }
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState('dark');
  const pasado = useScrollPasadoViewport();
  const visible = !pasado;

  useEffect(() => {
    const stored = readStoredTheme();
    const mql = window.matchMedia('(prefers-color-scheme: light)');

    setTheme(stored === 'light' || stored === 'dark' ? stored : mql.matches ? 'light' : 'dark');

    function handleSystemChange(event) {
      const current = readStoredTheme();
      if (current !== 'light' && current !== 'dark') {
        setTheme(event.matches ? 'light' : 'dark');
      }
    }

    mql.addEventListener('change', handleSystemChange);
    return () => mql.removeEventListener('change', handleSystemChange);
  }, []);

  function handleToggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      window.localStorage.setItem('theme', next);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className={styles.wrapper} data-visible={visible}>
      <GlassSurface
        width={80}
        height={48}
        borderRadius={100}
        className={styles.track}
        opacity={0.9}
        brightness={45}
        blur={14}
        backgroundOpacity={0.12}
        saturation={1.4}
        distortionScale={-140}
        redOffset={0}
        greenOffset={6}
        blueOffset={14}
        displace={0.2}
      >
        <button
          type="button"
          className={styles.button}
          onClick={handleToggle}
          aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
        >
          <span className={`${styles.icon} ${theme === 'dark' ? styles.iconActive : ''}`}>
            <IconMoon />
          </span>
          <span className={`${styles.icon} ${theme === 'light' ? styles.iconActive : ''}`}>
            <IconSun />
          </span>
          <span className={`${styles.thumb} ${theme === 'light' ? styles.thumbLight : ''}`} />
        </button>
      </GlassSurface>
    </div>
  );
}
```

(Only change from the previous version: the scroll `useEffect` and its `visible` state are gone, replaced by `const pasado = useScrollPasadoViewport(); const visible = !pasado;`. Everything else — theme state, system-preference listener, toggle handler, markup — is unchanged.)

- [ ] **Step 4: Verify the build**

Run: `cd apps/web && npm run build`
Expected: build completes with no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/hooks/useScrollPasadoViewport.js src/components/ThemeToggle/ThemeToggle.jsx
git commit -m "feat(web): add framer-motion and extract useScrollPasadoViewport hook"
```

(Run this `git add`/`git commit` from `apps/web/` — adjust paths if running from repo root. Also stage the repo-root `package-lock.json` if the workspace install touched it.)

---

### Task 2: Build TextoBrillante

**Files:**
- Create: `apps/web/src/components/TextoBrillante/TextoBrillante.jsx`
- Create: `apps/web/src/components/TextoBrillante/TextoBrillante.module.css`

**Interfaces:**
- Consumes: `--color-fg`, `--color-bg` tokens (already defined).
- Produces: `export default function TextoBrillante({ texto })`. Task 3 (`ElementoNavegacion`) imports it as `import TextoBrillante from '@/components/TextoBrillante/TextoBrillante.jsx';` and renders `<TextoBrillante texto={someString} />`.

- [ ] **Step 1: Create `TextoBrillante.jsx`**

```jsx
'use client';

import styles from './TextoBrillante.module.css';

export default function TextoBrillante({ texto }) {
  return (
    <span className={styles.contenedor}>
      <span className={styles.base}>{texto}</span>
      <span className={styles.brillo} aria-hidden="true">{texto}</span>
    </span>
  );
}
```

- [ ] **Step 2: Create `TextoBrillante.module.css`**

```css
.contenedor {
  position: relative;
  display: inline-flex;
  white-space: nowrap;
}

.base {
  color: var(--color-fg);
}

.brillo {
  position: absolute;
  inset: 0;
  color: var(--color-bg);
  pointer-events: none;
  -webkit-mask-image: linear-gradient(to right, transparent 30%, #000 50%, transparent 70%);
  mask-image: linear-gradient(to right, transparent 30%, #000 50%, transparent 70%);
  -webkit-mask-size: 150% auto;
  mask-size: 150% auto;
  animation: recorrido 2.2s ease-in-out infinite;
}

@keyframes recorrido {
  0% {
    -webkit-mask-position: 200%;
    mask-position: 200%;
  }
  100% {
    -webkit-mask-position: -100%;
    mask-position: -100%;
  }
}
```

- [ ] **Step 3: Verify the build**

Run: `cd apps/web && npm run build`
Expected: build completes with no errors. `TextoBrillante` isn't imported anywhere yet, so this only confirms compilation.

- [ ] **Step 4: Commit**

```bash
git add src/components/TextoBrillante
git commit -m "feat(web): add TextoBrillante animated shine text component"
```

---

### Task 3: Build ElementoNavegacion

**Files:**
- Create: `apps/web/src/components/ElementoNavegacion/ElementoNavegacion.jsx`
- Create: `apps/web/src/components/ElementoNavegacion/ElementoNavegacion.module.css`

**Interfaces:**
- Consumes: `TextoBrillante` from Task 2; `motion` from `framer-motion` (Task 1's install); `--color-fg` token.
- Produces: `export default function ElementoNavegacion({ enlace, icono, variante })` where `enlace` is `{ href: string, label: string }`, `icono` is a JSX node, `variante` is `'grande' | 'mini'`. Task 4 (`Header`) renders `<ElementoNavegacion enlace={enlace} icono={enlace.icono} variante="grande" />` (or `"mini"`), always inside a `key={enlace.href}` wrapper so Framer Motion can track `layoutId={`nav-${enlace.href}`}` across renders.

- [ ] **Step 1: Create `ElementoNavegacion.jsx`**

```jsx
'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import TextoBrillante from '@/components/TextoBrillante/TextoBrillante.jsx';
import styles from './ElementoNavegacion.module.css';

export default function ElementoNavegacion({ enlace, icono, variante }) {
  return (
    <motion.div layout layoutId={`nav-${enlace.href}`} className={styles[variante]}>
      <Link href={enlace.href} className={styles.enlace}>
        <span className={styles.icono}>{icono}</span>
        <span className={styles.texto}>
          <TextoBrillante texto={enlace.label} />
        </span>
      </Link>
    </motion.div>
  );
}
```

- [ ] **Step 2: Create `ElementoNavegacion.module.css`**

```css
.grande {
  display: flex;
  align-items: center;
}

.mini {
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;
}

.enlace {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: 100%;
  padding: 0 0.6rem;
  color: var(--color-fg);
  text-decoration: none;
  white-space: nowrap;
}

.icono {
  display: flex;
  flex-shrink: 0;
  color: var(--color-fg);
}

.texto {
  opacity: 0.85;
  transition: opacity 0.25s ease;
}

.enlace:hover .texto {
  opacity: 1;
}
```

- [ ] **Step 3: Verify the build**

Run: `cd apps/web && npm run build`
Expected: build completes with no errors. Not imported anywhere yet.

- [ ] **Step 4: Commit**

```bash
git add src/components/ElementoNavegacion
git commit -m "feat(web): add ElementoNavegacion shared nav item component"
```

---

### Task 4: Rewrite Header.jsx and Header.module.css

**Files:**
- Modify: `apps/web/src/components/Header/Header.jsx`
- Modify: `apps/web/src/components/Header/Header.module.css`

**Interfaces:**
- Consumes: `GlassSurface` from `@portafolio/ui`; `ElementoNavegacion` from Task 3; `useScrollPasadoViewport` from Task 1; `AnimatePresence`/`motion` from `framer-motion`.
- Produces: `export default function Header()`, zero-prop, consumed by `apps/web/src/app/layout.jsx` exactly as today (no change needed there).

- [ ] **Step 1: Replace `Header.jsx`**

```jsx
'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { GlassSurface } from '@portafolio/ui';
import ElementoNavegacion from '@/components/ElementoNavegacion/ElementoNavegacion.jsx';
import useScrollPasadoViewport from '@/hooks/useScrollPasadoViewport.js';
import styles from './Header.module.css';

function IconoPersona() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </svg>
  );
}

function IconoGrid() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </svg>
  );
}

function IconoMaletin() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M3 13h18" />
    </svg>
  );
}

function IconoEstrella() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.6l-5.9 3 1.3-6.6-4.9-4.6 6.6-.8z" />
    </svg>
  );
}

function IconoSobre() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

const ENLACES = [
  { href: '/sobre-mi', label: 'Sobre mi', icono: <IconoPersona /> },
  { href: '/proyectos', label: 'Proyectos', icono: <IconoGrid /> },
  { href: '/experiencia', label: 'Experiencia', icono: <IconoMaletin /> },
  { href: '/habilidades', label: 'Habilidades', icono: <IconoEstrella /> },
  { href: '/contacto', label: 'Contáctame', icono: <IconoSobre /> },
];

const PROPS_GLASS = {
  opacity: 0.9,
  brightness: 45,
  blur: 14,
  backgroundOpacity: 0.12,
  saturation: 1.4,
  distortionScale: -140,
  redOffset: 0,
  greenOffset: 6,
  blueOffset: 14,
  displace: 0.2,
};

const TRANSICION_FADE = { duration: 0.4, ease: [0.16, 1, 0.3, 1] };

export default function Header() {
  const estaScrolleado = useScrollPasadoViewport();

  return (
    <header className={styles.header}>
      <Link href="/" className={styles.logo}>Felipe Diaz Aimar</Link>

      <AnimatePresence mode="popLayout" initial={false}>
        {!estaScrolleado ? (
          <motion.div
            key="pildora-grande"
            className={styles.pildoraGrandeWrapper}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={TRANSICION_FADE}
          >
            <GlassSurface width="auto" height={48} borderRadius={100} {...PROPS_GLASS}>
              <nav className={styles.navGrande}>
                <ul className={styles.listaGrande}>
                  {ENLACES.map((enlace) => (
                    <li key={enlace.href}>
                      <ElementoNavegacion enlace={enlace} icono={enlace.icono} variante="grande" />
                    </li>
                  ))}
                </ul>
              </nav>
            </GlassSurface>
          </motion.div>
        ) : (
          <motion.nav
            key="mini-pildoras"
            className={styles.navMini}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={TRANSICION_FADE}
          >
            {ENLACES.map((enlace) => (
              <div key={enlace.href} className={styles.miniWrapper}>
                <GlassSurface width="100%" height={48} borderRadius={100} {...PROPS_GLASS}>
                  <ElementoNavegacion enlace={enlace} icono={enlace.icono} variante="mini" />
                </GlassSurface>
              </div>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
```

- [ ] **Step 2: Replace `Header.module.css`**

```css
.header {
  position: sticky;
  top: 0;
  z-index: 900;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  width: 100%;
  padding: 1rem 2rem;
}

.logo {
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 1rem;
  letter-spacing: -0.01em;
  color: var(--color-fg);
  text-decoration: none;
  text-shadow: 0 1px 12px rgba(0, 0, 0, 0.25);
}

.pildoraGrandeWrapper {
  justify-self: center;
}

.navGrande {
  height: 100%;
}

.listaGrande {
  display: flex;
  align-items: center;
  height: 100%;
  gap: var(--space-2);
  list-style: none;
  margin: 0;
  padding: 0 1.5rem;
}

.navMini {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  justify-self: center;
}

.miniWrapper {
  width: 48px;
  height: 48px;
  overflow: hidden;
  border-radius: 100px;
  transition: width 0.45s cubic-bezier(0.16, 1, 0.3, 1);
}

.miniWrapper:hover,
.miniWrapper:focus-within {
  width: 160px;
}

@media (max-width: 768px) {
  .pildoraGrandeWrapper,
  .navMini {
    display: none;
  }
}
```

- [ ] **Step 3: Verify the production build**

Run: `cd apps/web && npm run build`
Expected: build completes with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/Header/Header.jsx src/components/Header/Header.module.css
git commit -m "feat(web): morph Header nav pill into mini-pills on scroll via Framer Motion"
```

---

### Task 5: End-to-end verification

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Verify markup via SSR**

```bash
cd apps/web && npm run dev &
timeout 30 bash -c 'until curl -sf http://localhost:3000 >/dev/null || curl -sf http://localhost:3001 >/dev/null; do sleep 1; done'
curl -s http://localhost:3000/ | grep -oE '>Sobre mi<|>Proyectos<|>Experiencia<|>Habilidades<|>Contáctame<'
```

(If port 3000 is taken, repeat against whichever port `next dev` logged.)

Expected: all 5 labels present (each appears twice per link — once in `.base`, once in `.brillo` from `TextoBrillante` — that's correct, not a bug).

- [ ] **Step 2: Manually verify in a browser (things curl can't check)**

1. **Shine effect:** each nav label shows a continuous diagonal-ish sweep of brightness moving across the text, looping smoothly, in both light and dark theme (toggle via `ThemeToggle` — the shine color should invert with the theme).
2. **Scroll morph:** scroll down past ~1 viewport height. The big pill should fade while 5 small circles appear roughly where their corresponding link used to sit, with icon+text visibly animating (not just popping) into their new position/size. Scroll back up — it reverses.
3. **Mini-pill hover:** hover each circle — it should smoothly widen to reveal the label with `TextoBrillante`, no jump/flicker, then smoothly collapse back on mouse-out.
4. **Keyboard access:** Tab to a mini-pill link — it should expand via `:focus-within` the same way hover does.
5. **ThemeToggle still works:** it should still hide/show at the same scroll point as before this change (visually unaffected by the refactor to the shared hook).
6. **Mobile:** below 768px width, neither the big pill nor the mini-pills row should appear — only the logo.
7. **Console check:** no hydration warnings, no Framer Motion warnings, no errors in DevTools console.

Stop the dev server after verifying (find the listening PID for the port `next dev` used and stop it).

- [ ] **Step 3: Report any visual issues found**

If step 2 reveals jank, misalignment, or incorrect colors, note the specific symptom precisely (which state, which element, what it looks like vs. expected) — don't fix speculatively; diagnose against the actual rendered DOM/CSS first.
