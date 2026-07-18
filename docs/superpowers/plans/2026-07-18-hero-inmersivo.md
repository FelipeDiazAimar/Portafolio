# Hero Inmersivo Interactivo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A full-screen hero behind the header whose background + centered title crossfades to a section when the visitor hovers that section's nav link (pre-scroll), sharing state through a lightweight client context; post-scroll the nav becomes smooth-scroll anchors to placeholder one-page sections.

**Architecture:** A client `ProveedorPortfolio` context holds `seccionActiva` (default `'inicio'`) and wraps `Bienvenida`/`ThemeToggle`/`Header`/`HeroInmersivo`/`{children}` from the server `layout.jsx` (server components pass as children, keeping SSR). `HeroInmersivo` renders every section layer always-mounted and toggles an `.activa` class for a flicker-free crossfade. The big pill's `<li>`s set the section on `onMouseEnter`; the `<ul>` resets to `'inicio'` on `onMouseLeave`. Nav links become in-page anchors.

**Tech Stack:** React 19 / Next.js 15 (App Router), JSX (no TypeScript), CSS Modules, `framer-motion` (already present), `GlassSurface` from `@portafolio/ui` (already present).

## Global Constraints

- No TypeScript — plain `.jsx`.
- CSS Modules only (except framer-motion `motion.*` animation props already in `Header`).
- No new npm dependencies.
- Spanish identifiers: `ProveedorPortfolio`, `usePortfolio`, `seccionActiva`, `setSeccionActiva`, `HeroInmersivo`, `SECCIONES`, `ENLACES`, `seccion`.
- Section ids and nav mapping (order matters): `sobre-mi` / `proyectos` / `experiencia` / `habilidades` / `contacto`, plus `inicio` as the default hero layer (the logo's anchor, not a nav link).
- Nav link hrefs are in-page anchors: `#sobre-mi`, `#proyectos`, `#experiencia`, `#habilidades`, `#contacto`; logo → `#inicio`.
- Default `seccionActiva` is `'inicio'`; `onMouseLeave` on the whole big pill resets to `'inicio'`; `onMouseEnter` per link sets that link's `seccion`.
- Hero crossfade: all layers mounted permanently, only opacity/scale change, `opacity 0.8s + transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)`, inactive layers `opacity: 0; transform: scale(1.05); pointer-events: none`.
- `HeroInmersivo` is `position: absolute; top: 0; left: 0; width: 100vw; height: 100vh; z-index: -1` — full-bleed, scrolls away after the first viewport, sits behind in-flow content but above the body background.
- Section backgrounds per hero layer are CSS gradients (placeholders for future photos); starting values in Task 2 are tunable by eye.

---

### Task 1: ProveedorPortfolio context

**Files:**
- Create: `apps/web/src/contexto/ProveedorPortfolio.jsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `export function ProveedorPortfolio({ children })` and `export function usePortfolio()` returning `{ seccionActiva: string, setSeccionActiva: (s: string) => void }`. Consumed by Task 2 (`HeroInmersivo`), Task 3 (`layout.jsx` wrapping), Task 4 (`Header`).

- [ ] **Step 1: Create the context file**

```jsx
// apps/web/src/contexto/ProveedorPortfolio.jsx
'use client';

import { createContext, useContext, useState } from 'react';

const ContextoPortfolio = createContext(null);

export function ProveedorPortfolio({ children }) {
  const [seccionActiva, setSeccionActiva] = useState('inicio');
  return (
    <ContextoPortfolio.Provider value={{ seccionActiva, setSeccionActiva }}>
      {children}
    </ContextoPortfolio.Provider>
  );
}

export function usePortfolio() {
  const ctx = useContext(ContextoPortfolio);
  if (!ctx) {
    throw new Error('usePortfolio debe usarse dentro de <ProveedorPortfolio>');
  }
  return ctx;
}
```

- [ ] **Step 2: Verify the build**

Run: `cd apps/web && npm run build`
Expected: build completes with no errors (file is unused so far — just confirms it compiles).

- [ ] **Step 3: Commit**

```bash
git add src/contexto/ProveedorPortfolio.jsx
git commit -m "feat(web): add ProveedorPortfolio context for shared section state"
```

(Run git from `apps/web/`.)

---

### Task 2: HeroInmersivo component

**Files:**
- Create: `apps/web/src/components/HeroInmersivo/HeroInmersivo.jsx`
- Create: `apps/web/src/components/HeroInmersivo/HeroInmersivo.module.css`

**Interfaces:**
- Consumes: `usePortfolio` from Task 1.
- Produces: `export default function HeroInmersivo()`, zero-prop. Mounted by Task 3 in `layout.jsx`.

- [ ] **Step 1: Create `HeroInmersivo.jsx`**

```jsx
'use client';

import { usePortfolio } from '@/contexto/ProveedorPortfolio.jsx';
import styles from './HeroInmersivo.module.css';

const SECCIONES = [
  { id: 'inicio', titulo: 'Bienvenido' },
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
          <span className={styles.titulo}>{seccion.titulo}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `HeroInmersivo.module.css`**

```css
.hero {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: -1;
  overflow: hidden;
}

.capa {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transform: scale(1.05);
  transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: none;
}

.activa {
  opacity: 1;
  transform: scale(1);
}

.titulo {
  font-family: var(--font-sans);
  font-weight: 800;
  font-size: clamp(2.5rem, 8vw, 6rem);
  letter-spacing: -0.03em;
  color: #fff;
  text-shadow: 0 2px 40px rgba(0, 0, 0, 0.35);
}

.capa-inicio {
  background: linear-gradient(135deg, #1a1c22 0%, #2b2f3a 100%);
}

.capa-sobre-mi {
  background: linear-gradient(135deg, #2a2438 0%, #4a3f66 100%);
}

.capa-proyectos {
  background: linear-gradient(135deg, #10263b 0%, #1f4d73 100%);
}

.capa-experiencia {
  background: linear-gradient(135deg, #3b2a10 0%, #73561f 100%);
}

.capa-habilidades {
  background: linear-gradient(135deg, #10322b 0%, #1f7357 100%);
}

.capa-contacto {
  background: linear-gradient(135deg, #3b1020 0%, #731f45 100%);
}
```

- [ ] **Step 3: Verify the build**

Run: `cd apps/web && npm run build`
Expected: build completes with no errors. Not mounted yet (Task 3 does that).

- [ ] **Step 4: Commit**

```bash
git add src/components/HeroInmersivo
git commit -m "feat(web): add HeroInmersivo crossfading full-screen background"
```

---

### Task 3: Wire provider + hero into layout, add smooth scroll

**Files:**
- Modify: `apps/web/src/app/layout.jsx`
- Modify: `apps/web/src/styles/globals.css`

**Interfaces:**
- Consumes: `ProveedorPortfolio` (Task 1), `HeroInmersivo` (Task 2).
- Produces: the runtime context tree that Task 4's `Header` relies on.

- [ ] **Step 1: Replace `apps/web/src/app/layout.jsx`**

```jsx
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import Bienvenida from '@/components/Bienvenida/Bienvenida.jsx';
import Header from '@/components/Header/Header.jsx';
import ThemeToggle from '@/components/ThemeToggle/ThemeToggle.jsx';
import HeroInmersivo from '@/components/HeroInmersivo/HeroInmersivo.jsx';
import { ProveedorPortfolio } from '@/contexto/ProveedorPortfolio.jsx';
import '../styles/globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata = {
  title: 'Felipe Diaz Aimar — Portfolio',
  description: 'Portfolio profesional de desarrollo fullstack.',
};

const THEME_INIT_SCRIPT = `(function() {
  try {
    var stored = window.localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') {
      document.documentElement.setAttribute('data-theme', stored);
    }
  } catch (e) {}
})();`;

function resolveLocale(acceptLanguageHeader) {
  const firstTag = acceptLanguageHeader?.split(',')[0]?.trim().toLowerCase();
  return firstTag?.startsWith('en') ? 'en' : 'es';
}

export default async function RootLayout({ children }) {
  const headerList = await headers();
  const locale = resolveLocale(headerList.get('accept-language'));

  return (
    <html lang={locale} suppressHydrationWarning className={inter.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ProveedorPortfolio>
          <Bienvenida locale={locale} />
          <ThemeToggle />
          <Header />
          <HeroInmersivo />
          <main>{children}</main>
        </ProveedorPortfolio>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Add smooth scroll to `globals.css`**

Add this block to `apps/web/src/styles/globals.css` (after the `* { box-sizing }` rule):

```css
html {
  scroll-behavior: smooth;
}
```

- [ ] **Step 3: Verify the build**

Run: `cd apps/web && npm run build`
Expected: build completes with no errors.

- [ ] **Step 4: Verify the hero renders behind content via SSR**

```bash
cd apps/web && npm run dev &
timeout 30 bash -c 'until curl -sf http://localhost:3000 >/dev/null || curl -sf http://localhost:3001 >/dev/null; do sleep 1; done'
curl -s http://localhost:3000/ | grep -oE '>Bienvenido<|>Mis Proyectos<|>Experiencia Laboral<|>Hablemos<'
```

(If port 3000 is taken, repeat against the port `next dev` logged.)

Expected: all four hero titles present in the SSR HTML (all layers are always rendered). Stop the dev server afterward (find the listening PID on the used port and stop it).

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.jsx src/styles/globals.css
git commit -m "feat(web): mount HeroInmersivo + ProveedorPortfolio, enable smooth scroll"
```

---

### Task 4: Header anchors + hover, ElementoNavegacion anchor link

**Files:**
- Modify: `apps/web/src/components/Header/Header.jsx`
- Modify: `apps/web/src/components/ElementoNavegacion/ElementoNavegacion.jsx`

**Interfaces:**
- Consumes: `usePortfolio` (Task 1).
- Produces: nothing consumed later — this is the interaction wiring.

- [ ] **Step 1: Replace `apps/web/src/components/Header/Header.jsx`**

```jsx
'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { GlassSurface } from '@portafolio/ui';
import ElementoNavegacion from '@/components/ElementoNavegacion/ElementoNavegacion.jsx';
import useScrollPasadoViewport from '@/hooks/useScrollPasadoViewport.js';
import { usePortfolio } from '@/contexto/ProveedorPortfolio.jsx';
import styles from './Header.module.css';

function IconoPersona() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </svg>
  );
}

function IconoGrid() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </svg>
  );
}

function IconoMaletin() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M3 13h18" />
    </svg>
  );
}

function IconoEstrella() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.6l-5.9 3 1.3-6.6-4.9-4.6 6.6-.8z" />
    </svg>
  );
}

function IconoSobre() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

const ENLACES = [
  { href: '#sobre-mi', seccion: 'sobre-mi', label: 'Sobre mi', icono: <IconoPersona /> },
  { href: '#proyectos', seccion: 'proyectos', label: 'Proyectos', icono: <IconoGrid /> },
  { href: '#experiencia', seccion: 'experiencia', label: 'Experiencia', icono: <IconoMaletin /> },
  { href: '#habilidades', seccion: 'habilidades', label: 'Habilidades', icono: <IconoEstrella /> },
  { href: '#contacto', seccion: 'contacto', label: 'Contáctame', icono: <IconoSobre /> },
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
  const { setSeccionActiva } = usePortfolio();

  return (
    <header className={styles.header}>
      <a href="#inicio" className={styles.logo}>Felipe Diaz Aimar</a>

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
            <GlassSurface width="auto" height={40} borderRadius={100} {...PROPS_GLASS}>
              <nav className={styles.navGrande}>
                <ul
                  className={styles.listaGrande}
                  onMouseLeave={() => setSeccionActiva('inicio')}
                >
                  {ENLACES.map((enlace) => (
                    <li key={enlace.href} onMouseEnter={() => setSeccionActiva(enlace.seccion)}>
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
                <GlassSurface width="100%" height={40} borderRadius={100} {...PROPS_GLASS}>
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

(Changes vs current: imports `usePortfolio`; drops the unused `next/link` import; logo is now `<a href="#inicio">`; `ENLACES` hrefs are anchors + a new `seccion` field; the `<ul>` gets `onMouseLeave` reset and each `<li>` gets `onMouseEnter`. The mini branch is unchanged — no hover wiring there.)

- [ ] **Step 2: Update `ElementoNavegacion.jsx` to use an anchor**

Replace the `import Link from 'next/link';` line and the `<Link>` usage. Full file:

```jsx
'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import TextoBrillante from '@/components/TextoBrillante/TextoBrillante.jsx';
import TextoRodante from '@/components/TextoRodante/TextoRodante.jsx';
import styles from './ElementoNavegacion.module.css';

// Coincide con UNMOUNT_DELAY_MS de Bienvenida: el rodillo arranca recién
// cuando el splash termina de desaparecer, si no se juega sin que se vea.
const DEMORA_RODANTE_MS = 3300;

// Módulo-scope a propósito: la píldora grande se desmonta y remonta cada
// vez que el visitante scrollea arriba/abajo del umbral, y solo la
// PRIMERA aparición de verdad (justo después de Bienvenida) debe esperar
// los 3.3s. Los remontajes siguientes deben animar de una.
let yaSeMostroLaPildoraGrande = false;

export default function ElementoNavegacion({ enlace, icono, variante }) {
  const esPrimeraVez = useRef(variante === 'grande' && !yaSeMostroLaPildoraGrande).current;

  useEffect(() => {
    if (variante === 'grande') {
      yaSeMostroLaPildoraGrande = true;
    }
  }, [variante]);

  return (
    <motion.div layout layoutId={`nav-${enlace.href}`} className={styles[variante]}>
      <a href={enlace.href} className={styles.enlace}>
        <span className={styles.icono}>{icono}</span>
        <span className={styles.texto}>
          {variante === 'grande' ? (
            <TextoRodante texto={enlace.label} demoraInicial={esPrimeraVez ? DEMORA_RODANTE_MS : 0} />
          ) : (
            <TextoBrillante texto={enlace.label} activo />
          )}
        </span>
      </a>
    </motion.div>
  );
}
```

(Only change: `next/link` `<Link href>` → native `<a href>`, since the targets are same-page hash anchors handled by `scroll-behavior: smooth`.)

- [ ] **Step 3: Verify the build**

Run: `cd apps/web && npm run build`
Expected: build completes with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/Header/Header.jsx src/components/ElementoNavegacion/ElementoNavegacion.jsx
git commit -m "feat(web): drive HeroInmersivo from nav hover, switch nav to in-page anchors"
```

---

### Task 5: One-page anchored sections + end-to-end verification

**Files:**
- Modify: `apps/web/src/app/page.jsx`
- Modify: `apps/web/src/app/page.module.css`

**Interfaces:**
- Consumes: nothing (the anchors match the `id`s created here).
- Produces: the scroll targets for the nav anchors.

- [ ] **Step 1: Replace `apps/web/src/app/page.jsx`**

```jsx
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
      {SECCIONES.map((seccion) => (
        <section key={seccion.id} id={seccion.id} className={styles.seccion}>
          <h2>{seccion.titulo}</h2>
        </section>
      ))}
    </>
  );
}
```

- [ ] **Step 2: Replace `apps/web/src/app/page.module.css`**

```css
.seccionHero {
  height: 100vh;
}

.seccion {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  scroll-margin-top: 5rem;
}

.seccion h2 {
  font-family: var(--font-sans);
  font-weight: 800;
  font-size: clamp(2rem, 6vw, 4rem);
  color: var(--color-fg);
}
```

(The old `.link` and `.espaciador` rules are removed — nothing references them anymore.)

- [ ] **Step 3: Verify the production build**

Run: `cd apps/web && npm run build`
Expected: build completes with no errors.

- [ ] **Step 4: Verify markup via SSR**

```bash
cd apps/web && npm run dev &
timeout 30 bash -c 'until curl -sf http://localhost:3000 >/dev/null || curl -sf http://localhost:3001 >/dev/null; do sleep 1; done'
curl -s http://localhost:3000/ | grep -oE 'id="inicio"|id="sobre-mi"|id="proyectos"|id="experiencia"|id="habilidades"|id="contacto"'
```

(Adjust the port if `next dev` logged a different one.)

Expected: all six section ids present.

- [ ] **Step 5: Manually verify in a browser (things curl can't check)**

Wait for the `Bienvenida` splash to clear (~3.2s), then:

1. **Hero on load:** the `inicio` layer ("Bienvenido") shows full-screen behind the header.
2. **Hover crossfade:** hover each big-pill link — the hero background + centered title should crossfade (with a slight scale) to that section ("Mis Proyectos", "Experiencia Laboral", etc.), no flicker, no hard cut.
3. **Move between links:** sliding from one link to the next changes the section directly, without flashing back to "Bienvenido" in between.
4. **Leave the pill:** moving the mouse off the whole pill returns the hero to "Bienvenido".
5. **Anchor scroll:** scroll down (mini-pills appear); click a mini-pill — the page smooth-scrolls to that section's `id`. No immersive hover effect in this state.
6. **No console errors:** no hydration warnings, no context errors, no framer-motion warnings.

Stop the dev server after verifying.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.jsx src/app/page.module.css
git commit -m "feat(web): scaffold one-page anchored sections for smooth-scroll nav"
```
