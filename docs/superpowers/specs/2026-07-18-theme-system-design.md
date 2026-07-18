# Sistema de theming claro/oscuro + GlassSurface + ThemeToggle — Diseño

## Objetivo

Agregar soporte real de tema claro/oscuro a `apps/web`, automático (sigue `prefers-color-scheme`) y con override manual persistente vía un switch estilo iPhone con glassmorphism, visible solo en la parte superior de la página. De paso, se incorpora `GlassSurface` (componente de React Bits provisto por el usuario) como primitivo compartido en `packages/ui`, porque tanto el `ThemeToggle` como el futuro `<Header/>` (spec separado) lo necesitan.

## Alcance

- `packages/config/tokens/tokens.css` — paleta clara + tokens nuevos (`--color-border`, `--color-chip-bg`) + `color-scheme`.
- `apps/web/src/styles/globals.css` — transición suave de color en `body`.
- `apps/web/src/app/layout.jsx` — script anti-flash inline, `suppressHydrationWarning`, montaje de `<ThemeToggle />`.
- `packages/ui/src/GlassSurface/GlassSurface.jsx` + `GlassSurface.module.css` (nuevo) — primitivo glassmorphism, exportado desde `packages/ui/src/index.js`.
- `apps/web/src/components/ThemeToggle/ThemeToggle.jsx` + `ThemeToggle.module.css` (nuevo) — switch iPhone-style con auto-hide por scroll.
- Fixes de tokens hardcodeados en `Header.module.css`, `Card.module.css` (`packages/ui`), `ProjectCard.module.css`.

Fuera de alcance: el `<Header/>` completo con la píldora de navegación (spec separado, ya planificado a continuación de este); secciones reales en la home (el umbral de scroll se basa en `window.innerHeight`, no en marcado de secciones que todavía no existe); tests automatizados (todo el trabajo es visual/interactivo, sin lógica de negocio testeable con unit tests).

## Stack y convenciones

- React 19 / Next.js 15, JSX sin TypeScript, CSS Modules — mismo patrón que el resto del repo.
- Sin dependencias nuevas de npm. Los íconos (luna/sol) son SVG inline minimalistas, mismo estilo que los de `Bienvenida` (stroke `currentColor`, viewBox `24 24`, tamaño ~20-22px).
- `GlassSurface` se adapta del código provisto por el usuario con el mínimo diff posible: mismo JS, mismas reglas CSS, solo cambia el mecanismo de import de estilos (CSS Modules en vez de CSS global) y se agrega `'use client'`.

## 1. Tokens y arranque sin flash

### Paleta

| Token | Oscuro (default) | Claro |
|---|---|---|
| `--color-bg` | `#0b0d12` | `#f5f6f8` |
| `--color-fg` | `#f4f5f7` | `#14161a` |
| `--color-muted` | `#9aa1ac` | `#6b7280` |
| `--color-accent` | `#5b8cff` | `#5b8cff` (sin cambio) |
| `--color-border` | `rgba(255, 255, 255, 0.1)` | `rgba(15, 17, 23, 0.12)` |
| `--color-chip-bg` | `rgba(255, 255, 255, 0.08)` | `rgba(15, 17, 23, 0.06)` |

### Estructura de `tokens.css`

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

Prioridad de resolución: `[data-theme]` explícito (elección manual) > `prefers-color-scheme` (sin elección) > default oscuro.

`globals.css` agrega a `body`:

```css
body {
  /* ...reglas existentes... */
  transition: background-color 0.3s ease, color 0.3s ease;
}
```

### Script anti-flash

En `apps/web/src/app/layout.jsx`, dentro de un `<head>` explícito, antes de `<body>`:

```jsx
const THEME_INIT_SCRIPT = `(function() {
  try {
    var stored = window.localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') {
      document.documentElement.setAttribute('data-theme', stored);
    }
  } catch (e) {}
})();`;
```

```jsx
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
```

`suppressHydrationWarning` en `<html>` es necesario porque el script puede setear `data-theme` en el cliente antes de que React hidrate, lo cual no coincide con el HTML generado en el servidor (que no conoce el `localStorage` del visitante).

## 2. `GlassSurface` en `packages/ui`

- Nuevo: `packages/ui/src/GlassSurface/GlassSurface.jsx`, `packages/ui/src/GlassSurface/GlassSurface.module.css`.
- `packages/ui/src/index.js` suma: `export { default as GlassSurface } from './GlassSurface/GlassSurface.jsx';`.
- El componente arranca con `'use client'` (usa `useState`, `useEffect`, `useRef`, `useId`).
- El JS es el provisto por el usuario, sin cambios de lógica. El único cambio mecánico: `import styles from './GlassSurface.module.css'` en vez de `import './GlassSurface.css'`, y cada `className` literal pasa a `styles['glass-surface']`, `styles['glass-surface__filter']`, `styles['glass-surface__content']`, `styles['glass-surface--svg']`, `styles['glass-surface--fallback']` (notación de corchetes porque los nombres tienen guiones — se preserva el CSS tal cual para no arriesgar la lógica de filtros SVG). Las custom properties (`--glass-frost`, `--glass-saturation`, `--filter-id`) no cambian: CSS Modules no las escopea.
- **Único cambio real sobre el CSS provisto:** el bloque `@media (prefers-color-scheme: dark) { .glass-surface--fallback {...} }` (ruta de Safari/Firefox, sin soporte de filtro SVG) sigue el tema crudo del SO. Se agregan selectores adicionales para que el override manual también aplique ahí:

```css
:global(:root[data-theme='dark']) .glass-surface--fallback {
  /* mismas reglas que el bloque @media existente */
}
:global(:root[data-theme='light']) .glass-surface--fallback {
  /* mismas reglas que el bloque --fallback base (claro) */
}
```

  (Se agregan **después** del bloque `@media` existente en el archivo, sin removerlo — el orden importa: ambos selectores tienen especificidad equivalente, así que gana el que aparece último en cascada cuando coinciden. La media query sigue cubriendo el caso "sin elección manual".)

## 3. `ThemeToggle`

**Archivos:** `apps/web/src/components/ThemeToggle/ThemeToggle.jsx`, `ThemeToggle.module.css`.

### Comportamiento

- Client component (`'use client'`).
- Estado `theme` (`'light' | 'dark'`), inicializado en `'dark'` (coincide con el default de `tokens.css`, evita mismatch de hidratación).
- Estado `visible` (boolean), inicializado en `true`.
- `useEffect` #1 (mount): lee `localStorage.getItem('theme')`. Si es `'light'` o `'dark'`, usa ese valor. Si no, usa `window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'`. Se suscribe a `change` en ese `matchMedia`; si dispara y no hay valor en `localStorage` (el visitante no eligió manualmente), actualiza `theme`. Cleanup con `removeEventListener`.
- `useEffect` #2 (mount): listener de `scroll` en `window` (con `requestAnimationFrame` para throttle — un flag `ticking` evita encolar múltiples RAF por el mismo frame). Compara `window.scrollY > window.innerHeight`; si es mayor, `visible = false`, si no, `true`. Cleanup remueve el listener.
- `handleToggle()`: `next = theme === 'dark' ? 'light' : 'dark'`; `setTheme(next)`; `document.documentElement.setAttribute('data-theme', next)`; `localStorage.setItem('theme', next)`.

### Estructura visual (estilo iPhone)

```jsx
<div className={styles.wrapper} data-visible={visible}>
  <GlassSurface
    width={64}
    height={32}
    borderRadius={100}
    className={styles.track}
    /* props premium, sutiles: */
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
    <button type="button" className={styles.button} onClick={handleToggle} aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}>
      <span className={styles.iconMoon}><IconMoon /></span>
      <span className={styles.iconSun}><IconSun /></span>
      <span className={`${styles.thumb} ${theme === 'light' ? styles.thumbLight : ''}`} />
    </button>
  </GlassSurface>
</div>
```

- `IconMoon` (izquierda) e `IconSun` (derecha) SVG inline, siempre presentes; opacidad `0.4` en el lado inactivo, `1` en el lado activo (vía `[data-theme]`-like clase condicional en el propio componente, o simplemente comparando `theme` en JS para las clases — se resuelve en JS, no en CSS puro, porque el estado ya vive en React).
- `.thumb`: círculo ~26px, `position: absolute`, `transform: translateX(0)` en oscuro → `translateX(28px)` en claro (o valor equivalente para recorrer el track menos su propio diámetro y padding), `transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)`.
- Los props numéricos de `GlassSurface` (opacity/brightness/blur/etc.) son un punto de partida — se afinan a ojo contra el navegador durante la implementación, no son un valor final cerrado por escrito.

### Posición y auto-hide

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
```

`z-index: 1000` queda por debajo del `9999` de `Bienvenida` (para que el splash tape todo mientras está activo) y por encima del contenido normal de la página.

## 4. Fixes de tokens en componentes existentes

Reemplazo mecánico de valores hardcodeados por los tokens nuevos, sin tocar estructura ni layout:

- `apps/web/src/components/Header/Header.module.css`: `.header { border-bottom: 1px solid rgba(255, 255, 255, 0.1); }` → `border-bottom: 1px solid var(--color-border);`.
- `packages/ui/src/Card/Card.module.css`: `.card { border: 1px solid rgba(255, 255, 255, 0.1); }` → `border: 1px solid var(--color-border);`.
- `apps/web/src/components/ProjectCard/ProjectCard.module.css`: `.stack li { background: rgba(255, 255, 255, 0.08); }` → `background: var(--color-chip-bg);`.

## Accesibilidad

- El `<button>` del toggle tiene `aria-label` dinámico describiendo la acción (a qué tema cambia, no el tema actual).
- El toggle sigue siendo alcanzable por teclado (`<button>` nativo); cuando `visible: false` y `pointer-events: none`, el foco por teclado (Tab) todavía podría llegar a un elemento invisible — aceptado como limitación menor dado que es un control secundario fuera del flujo principal de navegación (no bloquea ninguna funcionalidad, y visualmente coincide con "no estás arriba de la página").

## Criterios de aceptación

- Con el SO en modo claro y sin elección previa en `localStorage`, el sitio arranca en claro sin flash oscuro inicial (verificable inspeccionando el HTML servido con distintos valores simulados, ya que `prefers-color-scheme` no se puede forzar por header HTTP — se verifica con `prefers-color-scheme` emulado en devtools).
- Tocar el toggle cambia el tema al instante, persiste tras recargar la página (`localStorage`), y ese valor manda incluso si después cambia el tema del SO.
- El toggle (píldora + thumb) es visible arriba de todo (`scrollY <= innerHeight`) y se oculta con fade + pointer-events:none al superar ese umbral.
- `Header`, `Card` y `ProjectCard` se ven correctos (bordes/chips visibles, sin "lavado") en ambos temas.
- `next build` compila sin errores ni warnings de hidratación en consola al correr `next dev`.
