# Theme System + GlassSurface + ThemeToggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add automatic + manual light/dark theming to `apps/web`, port `GlassSurface` (React Bits) into `packages/ui` as a shared primitive, and build an iPhone-style `ThemeToggle` switch (glassmorphism, auto-hides on scroll) that lets visitors override the detected theme.

**Architecture:** CSS custom properties in `packages/config/tokens/tokens.css` resolve in three layers (`[data-theme]` explicit override > `prefers-color-scheme` > dark default). An inline anti-flash script in `layout.jsx`'s `<head>` applies any persisted `data-theme` before first paint. `GlassSurface` is ported into `packages/ui` with minimal changes (CSS Modules instead of global CSS, plus one additive fix so its Safari/Firefox fallback path also respects manual overrides). `ThemeToggle` is a client component that reads/writes `localStorage`, listens to `prefers-color-scheme` changes, and hides itself via a scroll listener.

**Tech Stack:** React 19 / Next.js 15 (App Router), JSX (no TypeScript), CSS Modules, no external dependencies (inline SVG icons).

## Global Constraints

- No TypeScript — plain `.jsx` files only.
- CSS Modules only (`*.module.css`), no CSS-in-JS, no Tailwind.
- No new npm dependencies. Icons are hand-written inline SVG, same visual style as `Bienvenida`'s icons (`stroke="currentColor"`, `viewBox="0 0 24 24"`, `strokeWidth="2"`, `strokeLinecap="round"`, `strokeLinejoin="round"`).
- `GlassSurface`'s JS and CSS rules are ported with minimum diff from the vendor code — same hooks/refs/SVG-filter logic, same CSS declarations. The only changes: CSS Modules import/class references, adding `'use client'`, and two additive CSS blocks (see Task 2) so the Safari/Firefox fallback path also respects `data-theme`.
- Theme resolution priority (highest wins): `:root[data-theme='light'|'dark']` (explicit, from `localStorage`) > `@media (prefers-color-scheme: light)` (only when no `data-theme` is set) > dark (default).
- A manual toggle choice persists in `localStorage` under the key `'theme'` and always wins over subsequent OS theme changes, until the visitor toggles again.
- The anti-flash script must run before first paint: inline `<script>` in `layout.jsx`'s `<head>`, with `suppressHydrationWarning` on `<html>`.
- All theme-related transitions (toggle thumb, toggle visibility, `body` background/color) use `cubic-bezier(0.16, 1, 0.3, 1)` — same motion language as `Bienvenida`.
- `ThemeToggle`'s wrapper `z-index` is `1000` (below `Bienvenida`'s `9999`, above normal page content).
- Numeric visual-tuning values given in this plan (GlassSurface props, exact px offsets) are a starting point — verify visually in the browser during implementation and adjust by eye if something looks off; that's expected, not a deviation from the plan.

---

### Task 1: Theme tokens and body transition

**Files:**
- Modify: `packages/config/tokens/tokens.css`
- Modify: `apps/web/src/styles/globals.css`

**Interfaces:**
- Consumes: nothing.
- Produces: CSS custom properties `--color-bg`, `--color-fg`, `--color-muted`, `--color-accent` (existing, now theme-aware), `--color-border` (new), `--color-chip-bg` (new), and the `color-scheme` property on `:root`. All later tasks (2–5) consume these by name.

- [ ] **Step 1: Replace the contents of `tokens.css`**

```css
:root {
  --color-bg: #0b0d12;
  --color-fg: #f4f5f7;
  --color-muted: #9aa1ac;
  --color-accent: #5b8cff;
  --color-border: rgba(255, 255, 255, 0.1);
  --color-chip-bg: rgba(255, 255, 255, 0.08);
  --font-sans: system-ui, -apple-system, "Segoe UI", sans-serif;
  --space-1: 0.5rem;
  --space-2: 1rem;
  --space-3: 1.5rem;
  --space-4: 2.5rem;
  --radius: 8px;
  color-scheme: dark;
}

@media (prefers-color-scheme: light) {
  :root:not([data-theme]) {
    --color-bg: #f5f6f8;
    --color-fg: #14161a;
    --color-muted: #6b7280;
    --color-border: rgba(15, 17, 23, 0.12);
    --color-chip-bg: rgba(15, 17, 23, 0.06);
    color-scheme: light;
  }
}

:root[data-theme='light'] {
  --color-bg: #f5f6f8;
  --color-fg: #14161a;
  --color-muted: #6b7280;
  --color-border: rgba(15, 17, 23, 0.12);
  --color-chip-bg: rgba(15, 17, 23, 0.06);
  color-scheme: light;
}

:root[data-theme='dark'] {
  --color-bg: #0b0d12;
  --color-fg: #f4f5f7;
  --color-muted: #9aa1ac;
  --color-border: rgba(255, 255, 255, 0.1);
  --color-chip-bg: rgba(255, 255, 255, 0.08);
  color-scheme: dark;
}
```

- [ ] **Step 2: Add a color transition to `body` in `globals.css`**

Find this block in `apps/web/src/styles/globals.css`:

```css
body {
  margin: 0;
  font-family: var(--font-sans);
  background: var(--color-bg);
  color: var(--color-fg);
}
```

Replace it with:

```css
body {
  margin: 0;
  font-family: var(--font-sans);
  background: var(--color-bg);
  color: var(--color-fg);
  transition: background-color 0.3s ease, color 0.3s ease;
}
```

- [ ] **Step 3: Verify the build**

Run: `cd apps/web && npm run build`
Expected: build completes with no errors (same output shape as before — routes still listed, no new warnings).

- [ ] **Step 4: Commit**

```bash
git add packages/config/tokens/tokens.css apps/web/src/styles/globals.css
git commit -m "feat(web): add light theme tokens and data-theme override layer"
```

---

### Task 2: Port GlassSurface into packages/ui

**Files:**
- Create: `packages/ui/src/GlassSurface/GlassSurface.jsx`
- Create: `packages/ui/src/GlassSurface/GlassSurface.module.css`
- Modify: `packages/ui/src/index.js`

**Interfaces:**
- Consumes: `--color-*` tokens and `color-scheme` from Task 1 (used inside `GlassSurface.module.css` via `light-dark()`).
- Produces: `export { default as GlassSurface } from './GlassSurface/GlassSurface.jsx';` from `packages/ui/src/index.js`, importable as `import { GlassSurface } from '@portafolio/ui';`. Props: `{ children, width = 200, height = 80, borderRadius = 20, borderWidth = 0.07, brightness = 50, opacity = 0.93, blur = 11, displace = 0, backgroundOpacity = 0, saturation = 1, distortionScale = -180, redOffset = 0, greenOffset = 10, blueOffset = 20, xChannel = 'R', yChannel = 'G', mixBlendMode = 'difference', className = '', style = {} }`. Consumed by Task 4 (`ThemeToggle`).

- [ ] **Step 1: Create `packages/ui/src/GlassSurface/GlassSurface.jsx`**

```jsx
/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useEffect, useState, useRef, useId } from 'react';
import styles from './GlassSurface.module.css';

const GlassSurface = ({
  children,
  width = 200,
  height = 80,
  borderRadius = 20,
  borderWidth = 0.07,
  brightness = 50,
  opacity = 0.93,
  blur = 11,
  displace = 0,
  backgroundOpacity = 0,
  saturation = 1,
  distortionScale = -180,
  redOffset = 0,
  greenOffset = 10,
  blueOffset = 20,
  xChannel = 'R',
  yChannel = 'G',
  mixBlendMode = 'difference',
  className = '',
  style = {}
}) => {
  const uniqueId = useId().replace(/:/g, '-');
  const filterId = `glass-filter-${uniqueId}`;
  const redGradId = `red-grad-${uniqueId}`;
  const blueGradId = `blue-grad-${uniqueId}`;

  const [svgSupported, setSvgSupported] = useState(false);

  const containerRef = useRef(null);
  const feImageRef = useRef(null);
  const redChannelRef = useRef(null);
  const greenChannelRef = useRef(null);
  const blueChannelRef = useRef(null);
  const gaussianBlurRef = useRef(null);

  const generateDisplacementMap = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    const actualWidth = rect?.width || 400;
    const actualHeight = rect?.height || 200;
    const edgeSize = Math.min(actualWidth, actualHeight) * (borderWidth * 0.5);

    const svgContent = `
      <svg viewBox="0 0 ${actualWidth} ${actualHeight}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="${redGradId}" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stop-color="#0000"/>
            <stop offset="100%" stop-color="red"/>
          </linearGradient>
          <linearGradient id="${blueGradId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#0000"/>
            <stop offset="100%" stop-color="blue"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" fill="black"></rect>
        <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" rx="${borderRadius}" fill="url(#${redGradId})" />
        <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" rx="${borderRadius}" fill="url(#${blueGradId})" style="mix-blend-mode: ${mixBlendMode}" />
        <rect x="${edgeSize}" y="${edgeSize}" width="${actualWidth - edgeSize * 2}" height="${actualHeight - edgeSize * 2}" rx="${borderRadius}" fill="hsl(0 0% ${brightness}% / ${opacity})" style="filter:blur(${blur}px)" />
      </svg>
    `;

    return `data:image/svg+xml,${encodeURIComponent(svgContent)}`;
  };

  const updateDisplacementMap = () => {
    feImageRef.current?.setAttribute('href', generateDisplacementMap());
  };

  useEffect(() => {
    updateDisplacementMap();
    [
      { ref: redChannelRef, offset: redOffset },
      { ref: greenChannelRef, offset: greenOffset },
      { ref: blueChannelRef, offset: blueOffset }
    ].forEach(({ ref, offset }) => {
      if (ref.current) {
        ref.current.setAttribute('scale', (distortionScale + offset).toString());
        ref.current.setAttribute('xChannelSelector', xChannel);
        ref.current.setAttribute('yChannelSelector', yChannel);
      }
    });

    gaussianBlurRef.current?.setAttribute('stdDeviation', displace.toString());
  }, [
    width,
    height,
    borderRadius,
    borderWidth,
    brightness,
    opacity,
    blur,
    displace,
    distortionScale,
    redOffset,
    greenOffset,
    blueOffset,
    xChannel,
    yChannel,
    mixBlendMode
  ]);

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      setTimeout(updateDisplacementMap, 0);
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      setTimeout(updateDisplacementMap, 0);
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    setTimeout(updateDisplacementMap, 0);
  }, [width, height]);

  useEffect(() => {
    setSvgSupported(supportsSVGFilters());
  }, []);

  const supportsSVGFilters = () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return false;
    }

    const isWebkit = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    const isFirefox = /Firefox/.test(navigator.userAgent);

    if (isWebkit || isFirefox) {
      return false;
    }

    const div = document.createElement('div');
    div.style.backdropFilter = `url(#${filterId})`;

    return div.style.backdropFilter !== '';
  };

  const containerStyle = {
    ...style,
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    borderRadius: `${borderRadius}px`,
    '--glass-frost': backgroundOpacity,
    '--glass-saturation': saturation,
    '--filter-id': `url(#${filterId})`
  };

  return (
    <div
      ref={containerRef}
      className={`${styles['glass-surface']} ${svgSupported ? styles['glass-surface--svg'] : styles['glass-surface--fallback']} ${className}`}
      style={containerStyle}
    >
      <svg className={styles['glass-surface__filter']} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id={filterId} colorInterpolationFilters="sRGB" x="0%" y="0%" width="100%" height="100%">
            <feImage ref={feImageRef} x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map" />

            <feDisplacementMap ref={redChannelRef} in="SourceGraphic" in2="map" id="redchannel" result="dispRed" />
            <feColorMatrix
              in="dispRed"
              type="matrix"
              values="1 0 0 0 0
                      0 0 0 0 0
                      0 0 0 0 0
                      0 0 0 1 0"
              result="red"
            />

            <feDisplacementMap
              ref={greenChannelRef}
              in="SourceGraphic"
              in2="map"
              id="greenchannel"
              result="dispGreen"
            />
            <feColorMatrix
              in="dispGreen"
              type="matrix"
              values="0 0 0 0 0
                      0 1 0 0 0
                      0 0 0 0 0
                      0 0 0 1 0"
              result="green"
            />

            <feDisplacementMap ref={blueChannelRef} in="SourceGraphic" in2="map" id="bluechannel" result="dispBlue" />
            <feColorMatrix
              in="dispBlue"
              type="matrix"
              values="0 0 0 0 0
                      0 0 0 0 0
                      0 0 1 0 0
                      0 0 0 1 0"
              result="blue"
            />

            <feBlend in="red" in2="green" mode="screen" result="rg" />
            <feBlend in="rg" in2="blue" mode="screen" result="output" />
            <feGaussianBlur ref={gaussianBlurRef} in="output" stdDeviation="0.7" />
          </filter>
        </defs>
      </svg>

      <div className={styles['glass-surface__content']}>{children}</div>
    </div>
  );
};

export default GlassSurface;
```

- [ ] **Step 2: Create `packages/ui/src/GlassSurface/GlassSurface.module.css`**

```css
.glass-surface {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: opacity 0.26s ease-out;
}

.glass-surface__filter {
  width: 100%;
  height: 100%;
  pointer-events: none;
  position: absolute;
  inset: 0;
  opacity: 0;
  z-index: -1;
}

.glass-surface__content {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  border-radius: inherit;
  position: relative;
  z-index: 1;
}

.glass-surface--svg {
  background: light-dark(hsl(0 0% 100% / var(--glass-frost, 0)), hsl(0 0% 0% / var(--glass-frost, 0)));
  backdrop-filter: var(--filter-id, url(#glass-filter)) saturate(var(--glass-saturation, 1));
  box-shadow:
    0 0 2px 1px light-dark(color-mix(in oklch, black, transparent 85%), color-mix(in oklch, white, transparent 65%))
      inset,
    0 0 10px 4px light-dark(color-mix(in oklch, black, transparent 90%), color-mix(in oklch, white, transparent 85%))
      inset,
    0px 4px 16px rgba(17, 17, 26, 0.05),
    0px 8px 24px rgba(17, 17, 26, 0.05),
    0px 16px 56px rgba(17, 17, 26, 0.05),
    0px 4px 16px rgba(17, 17, 26, 0.05) inset,
    0px 8px 24px rgba(17, 17, 26, 0.05) inset,
    0px 16px 56px rgba(17, 17, 26, 0.05) inset;
}

.glass-surface--fallback {
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(12px) saturate(1.8) brightness(1.1);
  -webkit-backdrop-filter: blur(12px) saturate(1.8) brightness(1.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow:
    0 8px 32px 0 rgba(31, 38, 135, 0.2),
    0 2px 16px 0 rgba(31, 38, 135, 0.1),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.4),
    inset 0 -1px 0 0 rgba(255, 255, 255, 0.2);
}

@media (prefers-color-scheme: dark) {
  .glass-surface--fallback {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(12px) saturate(1.8) brightness(1.2);
    -webkit-backdrop-filter: blur(12px) saturate(1.8) brightness(1.2);
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow:
      inset 0 1px 0 0 rgba(255, 255, 255, 0.2),
      inset 0 -1px 0 0 rgba(255, 255, 255, 0.1);
  }
}

@supports not (backdrop-filter: blur(10px)) {
  .glass-surface--fallback {
    background: rgba(255, 255, 255, 0.4);
    box-shadow:
      inset 0 1px 0 0 rgba(255, 255, 255, 0.5),
      inset 0 -1px 0 0 rgba(255, 255, 255, 0.3);
  }

  .glass-surface--fallback::before {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(255, 255, 255, 0.15);
    border-radius: inherit;
    z-index: -1;
  }
}

@supports not (backdrop-filter: blur(10px)) {
  @media (prefers-color-scheme: dark) {
    .glass-surface--fallback {
      background: rgba(0, 0, 0, 0.4);
    }

    .glass-surface--fallback::before {
      background: rgba(255, 255, 255, 0.05);
    }
  }
}

.glass-surface:focus-visible {
  outline: 2px solid light-dark(#007aff, #0a84ff);
  outline-offset: 2px;
}

/* Manual data-theme override for the Safari/Firefox fallback path above,
   which otherwise only follows the raw OS prefers-color-scheme. */
:global(:root[data-theme='dark']) .glass-surface--fallback {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(12px) saturate(1.8) brightness(1.2);
  -webkit-backdrop-filter: blur(12px) saturate(1.8) brightness(1.2);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow:
    inset 0 1px 0 0 rgba(255, 255, 255, 0.2),
    inset 0 -1px 0 0 rgba(255, 255, 255, 0.1);
}

:global(:root[data-theme='light']) .glass-surface--fallback {
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(12px) saturate(1.8) brightness(1.1);
  -webkit-backdrop-filter: blur(12px) saturate(1.8) brightness(1.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow:
    0 8px 32px 0 rgba(31, 38, 135, 0.2),
    0 2px 16px 0 rgba(31, 38, 135, 0.1),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.4),
    inset 0 -1px 0 0 rgba(255, 255, 255, 0.2);
}
```

- [ ] **Step 3: Export it from `packages/ui/src/index.js`**

```js
export { default as Button } from './Button/Button.jsx';
export { default as Card } from './Card/Card.jsx';
export { default as GlassSurface } from './GlassSurface/GlassSurface.jsx';
```

- [ ] **Step 4: Verify the build**

Run: `cd apps/web && npm run build`
Expected: build completes with no errors. `GlassSurface` isn't imported anywhere yet, so this just confirms the new files don't break compilation.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/GlassSurface packages/ui/src/index.js
git commit -m "feat(ui): add GlassSurface glassmorphism primitive"
```

---

### Task 3: Replace hardcoded overlay colors with tokens

**Files:**
- Modify: `apps/web/src/components/Header/Header.module.css`
- Modify: `packages/ui/src/Card/Card.module.css`
- Modify: `apps/web/src/components/ProjectCard/ProjectCard.module.css`

**Interfaces:**
- Consumes: `--color-border`, `--color-chip-bg` from Task 1.
- Produces: nothing consumed by later tasks — purely visual cleanup, independently verifiable.

- [ ] **Step 1: Update `Header.module.css`**

Find:

```css
.header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding: var(--space-2) var(--space-3);
}
```

Replace with:

```css
.header {
  border-bottom: 1px solid var(--color-border);
  padding: var(--space-2) var(--space-3);
}
```

- [ ] **Step 2: Update `Card.module.css`**

Find:

```css
.card {
  background: var(--color-bg, #0b0d12);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius, 8px);
  padding: var(--space-3, 1.5rem);
}
```

Replace with:

```css
.card {
  background: var(--color-bg, #0b0d12);
  border: 1px solid var(--color-border, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius, 8px);
  padding: var(--space-3, 1.5rem);
}
```

- [ ] **Step 3: Update `ProjectCard.module.css`**

Find:

```css
.stack li {
  background: rgba(255, 255, 255, 0.08);
  border-radius: var(--radius);
  padding: 0.15rem 0.6rem;
  font-size: 0.85rem;
}
```

Replace with:

```css
.stack li {
  background: var(--color-chip-bg);
  border-radius: var(--radius);
  padding: 0.15rem 0.6rem;
  font-size: 0.85rem;
}
```

- [ ] **Step 4: Verify the build**

Run: `cd apps/web && npm run build`
Expected: build completes with no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/Header/Header.module.css packages/ui/src/Card/Card.module.css apps/web/src/components/ProjectCard/ProjectCard.module.css
git commit -m "fix(web): replace hardcoded overlay colors with theme tokens"
```

---

### Task 4: Build ThemeToggle

**Files:**
- Create: `apps/web/src/components/ThemeToggle/ThemeToggle.jsx`
- Create: `apps/web/src/components/ThemeToggle/ThemeToggle.module.css`

**Interfaces:**
- Consumes: `GlassSurface` from `@portafolio/ui` (Task 2); `--color-fg` token (Task 1).
- Produces: `export default function ThemeToggle()`, a zero-prop client component. Task 5 imports it as `import ThemeToggle from '@/components/ThemeToggle/ThemeToggle.jsx';` and renders `<ThemeToggle />` with no props.

- [ ] **Step 1: Create `apps/web/src/components/ThemeToggle/ThemeToggle.jsx`**

```jsx
'use client';

import { useEffect, useState } from 'react';
import { GlassSurface } from '@portafolio/ui';
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
  const [visible, setVisible] = useState(true);

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

  useEffect(() => {
    let ticking = false;

    function updateVisibility() {
      setVisible(window.scrollY <= window.innerHeight);
      ticking = false;
    }

    function handleScroll() {
      if (!ticking) {
        window.requestAnimationFrame(updateVisibility);
        ticking = true;
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
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
        width={64}
        height={32}
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

- [ ] **Step 2: Create `apps/web/src/components/ThemeToggle/ThemeToggle.module.css`**

```css
.wrapper {
  position: fixed;
  top: 1.5rem;
  right: 2rem;
  z-index: 1000;
  opacity: 1;
  transform: translateY(0);
  transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.wrapper[data-visible='false'] {
  opacity: 0;
  transform: translateY(-12px);
  pointer-events: none;
}

.track {
  cursor: pointer;
}

.button {
  position: relative;
  width: 100%;
  height: 100%;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0 7px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.icon {
  position: relative;
  z-index: 1;
  display: flex;
  color: var(--color-fg);
  opacity: 0.4;
  transition: opacity 0.3s ease;
}

.iconActive {
  opacity: 1;
}

.thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--color-fg);
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.thumbLight {
  transform: translateX(32px);
}
```

- [ ] **Step 3: Verify the build**

Run: `cd apps/web && npm run build`
Expected: build completes with no errors. `ThemeToggle` isn't mounted anywhere yet (Task 5 does that), so this only confirms compilation.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/ThemeToggle
git commit -m "feat(web): add ThemeToggle iPhone-style theme switch"
```

---

### Task 5: Wire into layout.jsx and verify end-to-end

**Files:**
- Modify: `apps/web/src/app/layout.jsx`

**Interfaces:**
- Consumes: `ThemeToggle` from Task 4.
- Produces: nothing — final integration point for this plan.

- [ ] **Step 1: Update `apps/web/src/app/layout.jsx`**

Replace its full contents with:

```jsx
import { headers } from 'next/headers';
import Bienvenida from '@/components/Bienvenida/Bienvenida.jsx';
import Header from '@/components/Header/Header.jsx';
import ThemeToggle from '@/components/ThemeToggle/ThemeToggle.jsx';
import '../styles/globals.css';

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
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <Bienvenida locale={locale} />
        <ThemeToggle />
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Verify the production build**

Run: `cd apps/web && npm run build`
Expected: build completes with no errors.

- [ ] **Step 3: Verify markup and default (dark) theme via SSR**

```bash
cd apps/web && npm run dev &
timeout 30 bash -c 'until curl -sf http://localhost:3000 >/dev/null || curl -sf http://localhost:3001 >/dev/null; do sleep 1; done'
curl -s http://localhost:3000/ | grep -oE '<html lang="[^"]*"|data-theme="[^"]*"|class="[^"]*wrapper[^"]*"' 
```

(If port 3000 is taken, `next dev` logs which port it actually used — repeat the `curl` against that port instead.)

Expected: `<html lang="es"` (no `data-theme` attribute in the raw SSR HTML — it's only added client-side by the anti-flash script or the toggle), and the `ThemeToggle` wrapper `div` present in the markup.

- [ ] **Step 4: Manually verify in a browser (things curl can't check)**

Open the dev server URL in a browser with devtools open:

1. **No flash on load:** DevTools → Rendering tab → "Emulate CSS media feature prefers-color-scheme" → set to `light`, then hard-reload. Page should render light immediately, no dark-then-light flash.
2. **Toggle works:** click the toggle pill top-right. Theme should switch instantly (`body` background/text color, `Header` border, `Card`/`ProjectCard` chip colors all follow). Thumb should slide smoothly with a slight ease-out (not linear).
3. **Persistence:** after toggling, reload the page. The manually chosen theme should still apply, even if you also flip the emulated `prefers-color-scheme` in DevTools to the opposite value.
4. **Auto-hide on scroll:** scroll down past roughly one screen height. The toggle should fade + slide up and disappear. Scroll back to the top — it reappears. While hidden, confirm you can't click through to it (e.g. click where it would be — nothing happens).
5. **Console check:** no hydration warnings or errors in the DevTools console during any of the above.

Stop the dev server after verifying (find the listening PID for the port `next dev` used and stop it, same as done in prior sessions for this repo).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/layout.jsx
git commit -m "feat(web): wire ThemeToggle and anti-flash script into root layout"
```
