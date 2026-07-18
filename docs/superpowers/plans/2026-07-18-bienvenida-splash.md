# Bienvenida Splash Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-contained, self-dismissing splash screen component (`Bienvenida`) for `apps/web` and mount it in the root layout.

**Architecture:** A single client component (`Bienvenida.jsx`) renders a fixed-position fullscreen overlay whose child elements reveal themselves via pure-CSS keyframe animations (masked `translateY` + `opacity`, staggered by `animation-delay`). A `useEffect` with two `setTimeout`s flips local state to trigger a CSS fade-out and then unmount the component (`return null`). No test framework is used — this is a purely visual component; verification is manual (`next dev` + browser).

**Tech Stack:** React 19 / Next.js 15 (App Router), JSX (no TypeScript), CSS Modules, no external icon library (inline SVG).

## Global Constraints

- No TypeScript — plain `.jsx` files only, matching `Header.jsx`.
- CSS Modules only (`*.module.css`), no CSS-in-JS, no Tailwind.
- No `lucide-react` or any new npm dependency — `apps/web/package.json` does not list it; icons are hand-written inline SVG.
- Colors/fonts must come from `packages/config/tokens/tokens.css` custom properties (`--color-bg`, `--color-fg`, `--color-muted`, `--font-sans`) — never hardcode hex values that duplicate a token.
- Spanish copy exactly: line 1 `"Bienvenido a mi"`, line 2 `"Portfolio Web"`, link text `"github.com/FelipeDiazAimar"` linking to `https://github.com/FelipeDiazAimar`.
- Animation easing: `cubic-bezier(0.16, 1, 0.3, 1)` for every animated element.
- Component must start with `'use client'` (first line of the file).
- Auto-dismiss timing: exit begins at 2600ms after mount, unmount completes at 3200ms after mount.

---

### Task 1: Build the `Bienvenida` component and its styles

**Files:**
- Create: `apps/web/src/components/Bienvenida/Bienvenida.jsx`
- Create: `apps/web/src/components/Bienvenida/Bienvenida.module.css`

**Interfaces:**
- Consumes: nothing (no props, no external state).
- Produces: `export default function Bienvenida()` — a zero-prop component that renders `null` once its internal lifecycle finishes. Later tasks (Task 2) import it as `import Bienvenida from '@/components/Bienvenida/Bienvenida.jsx';` and render `<Bienvenida />` with no props.

- [ ] **Step 1: Create the component file**

```jsx
// apps/web/src/components/Bienvenida/Bienvenida.jsx
'use client';

import { useEffect, useState } from 'react';
import styles from './Bienvenida.module.css';

const EXIT_DELAY_MS = 2600;
const UNMOUNT_DELAY_MS = 3200;

function IconCode() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function IconDatabase() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
      <path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" />
    </svg>
  );
}

function IconRocket() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

export default function Bienvenida() {
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const exitTimer = setTimeout(() => setExiting(true), EXIT_DELAY_MS);
    const unmountTimer = setTimeout(() => setVisible(false), UNMOUNT_DELAY_MS);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(unmountTimer);
    };
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div
      className={`${styles.splash} ${exiting ? styles.exiting : ''}`}
      role="status"
      aria-label="Cargando"
    >
      <div className={styles.icons}>
        <span className={`${styles.icon} ${styles.icon1}`}>
          <IconCode />
        </span>
        <span className={`${styles.icon} ${styles.icon2}`}>
          <IconDatabase />
        </span>
        <span className={`${styles.icon} ${styles.icon3}`}>
          <IconRocket />
        </span>
      </div>

      <div className={styles.textBlock}>
        <div className={styles.lineMask}>
          <span className={`${styles.line} ${styles.line1}`}>Bienvenido a mi</span>
        </div>
        <div className={styles.lineMask}>
          <span className={`${styles.line} ${styles.line2}`}>Portfolio Web</span>
        </div>
      </div>

      <div className={styles.linkMask}>
        <a
          className={styles.link}
          href="https://github.com/FelipeDiazAimar"
          target="_blank"
          rel="noopener noreferrer"
        >
          github.com/FelipeDiazAimar
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the stylesheet**

```css
/* apps/web/src/components/Bienvenida/Bienvenida.module.css */
.splash {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  background: var(--color-bg);
  opacity: 1;
  transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

.splash.exiting {
  opacity: 0;
  pointer-events: none;
}

.icons {
  display: flex;
  gap: var(--space-2);
  color: var(--color-fg);
  margin-bottom: var(--space-2);
}

.icon {
  opacity: 0;
  transform: translateY(24px);
  animation: reveal 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.icon1 {
  animation-delay: 0.1s;
}

.icon2 {
  animation-delay: 0.2s;
}

.icon3 {
  animation-delay: 0.3s;
}

.textBlock {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.lineMask {
  overflow: hidden;
}

.line {
  display: block;
  font-family: var(--font-sans);
  font-weight: 800;
  font-size: clamp(2rem, 6vw, 4rem);
  line-height: 1.15;
  color: var(--color-fg);
  letter-spacing: -0.02em;
  opacity: 0;
  transform: translateY(100%);
  animation: reveal 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.line1 {
  animation-delay: 0.35s;
}

.line2 {
  animation-delay: 0.5s;
}

.linkMask {
  overflow: hidden;
  margin-top: var(--space-3);
}

.link {
  display: block;
  font-family: var(--font-sans);
  font-size: 0.85rem;
  color: var(--color-muted);
  text-decoration: none;
  opacity: 0;
  transform: translateY(100%);
  animation: reveal 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  animation-delay: 0.75s;
}

.link:hover {
  color: var(--color-accent);
}

@keyframes reveal {
  from {
    opacity: 0;
    transform: translateY(100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

- [ ] **Step 3: Verify no build/lint errors**

Run: `npm --prefix apps/web run build`
Expected: build completes without errors (warnings about unrelated existing code are acceptable, but nothing referencing `Bienvenida`).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/Bienvenida/Bienvenida.jsx apps/web/src/components/Bienvenida/Bienvenida.module.css
git commit -m "feat(web): add Bienvenida splash screen component"
```

---

### Task 2: Mount `Bienvenida` in the root layout and verify visually

**Files:**
- Modify: `apps/web/src/app/layout.jsx`

**Interfaces:**
- Consumes: `Bienvenida` default export from Task 1 (`apps/web/src/components/Bienvenida/Bienvenida.jsx`), zero props.
- Produces: nothing consumed by later tasks — this is the final integration point.

- [ ] **Step 1: Import and mount the component**

Edit `apps/web/src/app/layout.jsx` to add the import and render `<Bienvenida />` as the first child of `<body>`, before `<Header />`:

```jsx
import Bienvenida from '@/components/Bienvenida/Bienvenida.jsx';
import Header from '@/components/Header/Header.jsx';
import '../styles/globals.css';

export const metadata = {
  title: 'Felipe Diaz Aimar — Portfolio',
  description: 'Portfolio profesional de desarrollo fullstack.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <Bienvenida />
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Run the dev server and verify manually**

Run: `npm --prefix apps/web run dev`

Open `http://localhost:3000` in a browser and confirm:
- Fullscreen dark overlay covers the viewport on load.
- Three icons, then "Bienvenido a mi", then "Portfolio Web", then the GitHub link reveal in staggered sequence, sliding up from below with a fade.
- After ~2.6s the overlay fades out; by ~3.2s it is gone and the home page (`HomePage` from `apps/web/src/app/page.jsx`) is fully visible and interactive.
- No hydration warnings or errors in the browser console.

Stop the dev server after verifying (Ctrl+C).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/layout.jsx
git commit -m "feat(web): mount Bienvenida splash screen in root layout"
```
