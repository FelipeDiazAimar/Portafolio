# Header con píldora de navegación (GlassSurface) — Diseño

## Objetivo

Reconstruir `<Header/>` para `apps/web`: logo a la izquierda (sin glass), una píldora `GlassSurface` centrada exactamente en el header con 5 links de navegación, glassmorphism premium/sutil consistente con `ThemeToggle`, y sin menú hamburguesa en mobile (se oculta la píldora).

## Alcance

- `apps/web/src/components/Header/Header.jsx` (reescritura completa)
- `apps/web/src/components/Header/Header.module.css` (reescritura completa)

Fuera de alcance: páginas `/experiencia` y `/habilidades` (no existen todavía — los links apuntan ahí igual, como placeholders a rutas futuras, mismo criterio que `/proyectos` y `/sobre-mi` cuando se crearon); menú hamburguesa / navegación mobile alternativa (la píldora simplemente se oculta bajo cierto ancho); tests automatizados (componente visual/de navegación, sin lógica de negocio).

## Dependencias ya resueltas por specs anteriores

- `GlassSurface` ya existe en `packages/ui`, exportado como `import { GlassSurface } from '@portafolio/ui';` (ver [2026-07-18-theme-system-design.md](2026-07-18-theme-system-design.md)).
- El sistema de theming (tokens `--color-bg`, `--color-fg`, `--color-accent`, `--color-border`, y `color-scheme`) ya está andando — el Header y la píldora heredan luz/oscuridad automáticamente sin lógica propia.
- `ThemeToggle` ya ocupa `position: fixed; top: 1.5rem; right: 2rem; z-index: 1000;` — el Header no debe competir por ese espacio (su grid no reserva nada a la derecha para el toggle; conviven en la misma franja superior sin overlap porque el toggle no forma parte del flujo del Header).

## Estructura del componente

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

No necesita `'use client'`: `Header` en sí no usa hooks; `GlassSurface` ya trae su propio `'use client'`, así que su subárbol se ejecuta en cliente sin obligar al padre.

## Layout

- `<header>` usa **CSS Grid** de tres columnas: `grid-template-columns: 1fr auto 1fr;`. El logo cae en la primera columna (se auto-ubica ahí por ser el primer hijo), la píldora en la segunda (columna `auto`, centrada por estar en medio de dos `1fr` simétricos), y la tercera columna queda vacía — no hace falta un `div` extra, es el resultado natural de auto-placement de grid con dos hijos y tres columnas. Esto asegura que la píldora quede en el centro *exacto* del header incluso si el logo tiene un ancho distinto en otro idioma o breakpoint (con `flex` + `justify-content: space-between` la píldora se corre hacia el lado del elemento más chico, no queda centrada real).
- `position: sticky; top: 0; z-index: 900;` — por debajo de `Bienvenida` (`9999`) y `ThemeToggle` (`1000`), por arriba del contenido normal. Se eligió `sticky` sobre `fixed`: al no sacarse del flujo del documento, no requiere compensar con padding en `main` (que sí haría falta con `fixed`, porque el header dejaría un hueco donde estaba).
- Padding del `<header>`: `1.5rem 2rem` (mismo valor que ya usaba el Header anterior).
- El header en sí no tiene fondo ni blur propio — solo la píldora tiene glass. El logo flota directamente sobre el contenido de la página, con un `text-shadow` sutil para legibilidad cuando el contenido de abajo cambie de tono al scrollear.

## Logo

```css
.logo {
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: -0.01em;
  color: var(--color-fg);
  text-decoration: none;
  text-shadow: 0 1px 12px rgba(0, 0, 0, 0.25);
}
```

Enlaza a `/`.

## Píldora de navegación

- `GlassSurface` con `width="auto"` (se ajusta al contenido — `GlassSurface` mide su propio `getBoundingClientRect()` en runtime, así que `"auto"` funciona sin necesidad de un ancho numérico), `height={56}`, `borderRadius={100}` (pill perfecta).
- Props de glassmorphism: los mismos valores ya afinados para `ThemeToggle` (`opacity=0.9, brightness=45, blur=14, backgroundOpacity=0.12, saturation=1.4, distortionScale=-140, redOffset=0, greenOffset=6, blueOffset=14, displace=0.2`) — mismo lenguaje visual glass en las dos superficies del sitio, en vez de inventar una paleta de distorsión nueva.
- Adentro, `<nav><ul>` con los 5 links. La lista usa `display: flex; gap: var(--space-3);` para separación equitativa entre links (no `justify-content: space-between`, que solo tiene sentido con contenedor de ancho fijo — acá el contenedor es `width: auto`), más `padding: 0 1.75rem` propio (sumado al `padding: 0.5rem` que `GlassSurface` ya aplica internamente a su contenido) para el "padding horizontal cómodo" pedido.
- Links: `color: var(--color-fg); opacity: 0.85;` en reposo, `opacity: 1; color: var(--color-accent);` en hover, transición `0.25s ease`. `white-space: nowrap` para que ningún label parta línea dentro de la píldora.

## Mobile

```css
@media (max-width: 768px) {
  .pill {
    display: none;
  }
}
```

Debajo de 768px la píldora entera desaparece; el header queda con el logo solo, a la izquierda. Sin menú hamburguesa (fuera de alcance, según lo acordado).

## Rutas

| Link | href | Página existente hoy |
|---|---|---|
| Sobre mi | `/sobre-mi` | Sí |
| Proyectos | `/proyectos` | Sí |
| Experiencia | `/experiencia` | No — 404 hasta que se cree |
| Habilidades | `/habilidades` | No — 404 hasta que se cree |
| Contáctame | `/contacto` | Sí |

## Criterios de aceptación

- El header ocupa el 100% del ancho, queda pegado arriba al scrollear (`sticky`), y no tapa ni es tapado por `Bienvenida` o `ThemeToggle`.
- El logo "Felipe Diaz Aimar" se ve a la izquierda, sin efecto glass, legible sobre cualquier contenido de fondo.
- La píldora queda centrada exactamente en el header (no desplazada por el ancho del logo), con forma de píldora perfecta y efecto glassmorphism visible.
- Los 5 links están separados equitativamente, tienen hover sutil, y navegan a sus rutas (incluyendo los dos placeholders que hoy dan 404).
- En una ventana angosta (< 768px) la píldora desaparece y solo queda el logo, sin romper el layout.
- La píldora se ve correctamente en ambos temas (claro/oscuro), heredando el sistema de theming ya implementado.
- `next build` compila sin errores.
