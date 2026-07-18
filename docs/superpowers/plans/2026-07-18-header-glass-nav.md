# Header Glass Nav Pill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `<Header/>` with a left-aligned logo and a centered `GlassSurface` navigation pill (5 links), reusing the theming system and `GlassSurface` primitive already built.

**Architecture:** `Header.jsx` stays a Server Component (no hooks of its own). It renders a 3-column CSS Grid (`1fr auto 1fr`) with the logo in column 1 and a `GlassSurface`-wrapped `<nav>` in column 2, leaving column 3 empty so the pill sits at the true visual center regardless of logo width. The header is `position: sticky; top: 0;`.

**Tech Stack:** React 19 / Next.js 15 (App Router), JSX (no TypeScript), CSS Modules, `GlassSurface` from `@portafolio/ui` (already built).

## Global Constraints

- No TypeScript — plain `.jsx`.
- CSS Modules only.
- No new npm dependencies.
- Nav links (exact labels and hrefs, in this order): `Sobre mi` → `/sobre-mi`, `Proyectos` → `/proyectos`, `Experiencia` → `/experiencia`, `Habilidades` → `/habilidades`, `Contáctame` → `/contacto`. `/experiencia` and `/habilidades` have no page yet — that's expected (404 until created later), not a bug to fix here.
- Logo text: `Felipe Diaz Aimar`, links to `/`, no glass effect on it.
- `GlassSurface` props for the pill reuse the exact values already tuned for `ThemeToggle`: `opacity=0.9, brightness=45, blur=14, backgroundOpacity=0.12, saturation=1.4, distortionScale=-140, redOffset=0, greenOffset=6, blueOffset=14, displace=0.2`.
- Header `z-index: 900` (below `Bienvenida`'s `9999` and `ThemeToggle`'s `1000`).
- Pill hides entirely (`display: none`) below `768px` — no hamburger menu.
- `position: sticky`, not `fixed` (avoids needing to compensate `main`'s padding).

---

### Task 1: Rewrite Header.jsx and Header.module.css

**Files:**
- Modify: `apps/web/src/components/Header/Header.jsx`
- Modify: `apps/web/src/components/Header/Header.module.css`

**Interfaces:**
- Consumes: `GlassSurface` from `@portafolio/ui` (already exported); `--color-fg`, `--color-accent`, `--space-3` tokens (already defined).
- Produces: `export default function Header()`, zero-prop, consumed by `apps/web/src/app/layout.jsx` exactly as today (`<Header />`, no prop changes needed there).

- [ ] **Step 1: Replace `apps/web/src/components/Header/Header.jsx`**

```jsx
import Link from 'next/link';
import { GlassSurface } from '@portafolio/ui';
import styles from './Header.module.css';

const LINKS = [
  { href: '/sobre-mi', label: 'Sobre mi' },
  { href: '/proyectos', label: 'Proyectos' },
  { href: '/experiencia', label: 'Experiencia' },
  { href: '/habilidades', label: 'Habilidades' },
  { href: '/contacto', label: 'Contáctame' },
];

export default function Header() {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.logo}>Felipe Diaz Aimar</Link>
      <GlassSurface
        width="auto"
        height={56}
        borderRadius={100}
        className={styles.pill}
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
        <nav className={styles.nav}>
          <ul className={styles.list}>
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={styles.link}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </GlassSurface>
    </header>
  );
}
```

- [ ] **Step 2: Replace `apps/web/src/components/Header/Header.module.css`**

```css
.header {
  position: sticky;
  top: 0;
  z-index: 900;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  width: 100%;
  padding: 1.5rem 2rem;
}

.logo {
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: -0.01em;
  color: var(--color-fg);
  text-decoration: none;
  text-shadow: 0 1px 12px rgba(0, 0, 0, 0.25);
}

.nav {
  height: 100%;
}

.list {
  display: flex;
  align-items: center;
  height: 100%;
  gap: var(--space-3);
  list-style: none;
  margin: 0;
  padding: 0 1.75rem;
}

.link {
  color: var(--color-fg);
  text-decoration: none;
  font-weight: 500;
  font-size: 0.95rem;
  opacity: 0.85;
  white-space: nowrap;
  transition: opacity 0.25s ease, color 0.25s ease;
}

.link:hover {
  opacity: 1;
  color: var(--color-accent);
}

@media (max-width: 768px) {
  .pill {
    display: none;
  }
}
```

- [ ] **Step 3: Verify the production build**

Run: `cd apps/web && npm run build`
Expected: build completes with no errors.

- [ ] **Step 4: Verify markup via SSR**

```bash
cd apps/web && npm run dev &
timeout 30 bash -c 'until curl -sf http://localhost:3000 >/dev/null || curl -sf http://localhost:3001 >/dev/null; do sleep 1; done'
curl -s http://localhost:3000/ | grep -oE '>Felipe Diaz Aimar<|>Sobre mi<|>Proyectos<|>Experiencia<|>Habilidades<|>Contáctame<'
```

(If port 3000 is taken, repeat against whichever port `next dev` logged.)

Expected: all 6 strings present (logo text + 5 link labels), each exactly once.

- [ ] **Step 5: Manually verify in a browser (things curl can't check)**

1. **Centering:** the pill sits at the true horizontal center of the viewport, not shifted toward the logo's side.
2. **Glassmorphism:** the pill shows a visible frosted/blurred glass effect (not a flat solid rectangle) in both light and dark theme (toggle it via `ThemeToggle` while checking).
3. **Hover:** each link dims/brightens smoothly on hover, no layout shift.
4. **Sticky behavior:** scroll the page — the header stays pinned at the very top, no gap or overlap with content.
5. **Mobile:** resize the browser below 768px width — the pill disappears entirely, only the logo remains, no broken layout or horizontal scrollbar.
6. **Links:** click each of the 5 links — `Sobre mi`, `Proyectos`, `Contáctame` navigate to real pages; `Experiencia` and `Habilidades` 404 (expected, not a bug).
7. **Console check:** no hydration warnings or errors in DevTools console.

Stop the dev server after verifying (find the listening PID for the port `next dev` used and stop it).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/Header/Header.jsx apps/web/src/components/Header/Header.module.css
git commit -m "feat(web): rebuild Header with centered GlassSurface nav pill"
```
