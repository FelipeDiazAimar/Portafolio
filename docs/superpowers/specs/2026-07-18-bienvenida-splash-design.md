# Bienvenida (SplashScreen) — Diseño

## Objetivo

Pantalla de bienvenida/loader para `apps/web` que se muestra al cargar la app: fondo oscuro a pantalla completa, texto "Bienvenido a mi / Portfolio Web" en español con animación de revelación desde abajo, iconos minimalistas y enlace a GitHub. Se auto-desmonta tras reproducirse.

## Alcance

- `apps/web/src/components/Bienvenida/Bienvenida.jsx`
- `apps/web/src/components/Bienvenida/Bienvenida.module.css`
- Integración en `apps/web/src/app/layout.jsx` (montado junto a `<Header />`)

Fuera de alcance: persistencia entre navegaciones (sessionStorage para no repetir el splash), configuración externa de textos/tiempos, tests automatizados (componente puramente visual).

## Stack y convenciones

- React 19 / Next.js 15, JSX sin TypeScript, CSS Modules — consistente con `Header.jsx`/`Header.module.css` existentes.
- Sin `lucide-react` (no está en `apps/web/package.json`): iconos como SVG inline minimalistas (code, database, rocket).
- Colores y fuente desde `packages/config/tokens/tokens.css` (`--color-bg`, `--color-fg`, `--color-muted`, `--font-sans`) para mantener coherencia con el resto del sitio.

## Estructura del componente

```
<div className={styles.splash} role="status" aria-label="Cargando">
  <div className={styles.icons}> {/* 3 SVG: code, database, rocket, stagger */}
  <div className={styles.textBlock}>
    <div className={styles.lineMask}><span className={styles.line}>Bienvenido a mi</span></div>
    <div className={styles.lineMask}><span className={styles.line}>Portfolio Web</span></div>
  </div>
  <div className={styles.linkMask}><a className={styles.link} href="https://github.com/FelipeDiazAimar">github.com/FelipeDiazAimar</a></div>
</div>
```

- Overlay: `position: fixed`, `inset: 0`, `width/height: 100vw/100vh`, `z-index` alto, `background: var(--color-bg)`, `display: flex` centrado (columna) vertical y horizontal.
- Cada línea de texto y el link usan el patrón máscara (`overflow: hidden` en el contenedor) + `span`/`a` interno animado con `translateY(100%|0)` + `opacity 0|1`.
- Tipografía: `var(--font-sans)`, `font-weight: 800`, tamaño `clamp()` para responsividad, color `var(--color-fg)`.
- Link GitHub: texto pequeño, `color: var(--color-muted)`.

## Animación

CSS puro vía `@keyframes reveal` (no JS por elemento), timing function `cubic-bezier(0.16, 1, 0.3, 1)`:

| Elemento | delay | duración |
|---|---|---|
| Icono 1 | 0.1s | 0.8s |
| Icono 2 | 0.2s | 0.8s |
| Icono 3 | 0.3s | 0.8s |
| Línea 1 | 0.35s | 0.9s |
| Línea 2 | 0.5s | 0.9s |
| Link GitHub | 0.75s | 0.8s |

## Ciclo de vida (auto-dismiss)

Componente cliente (`'use client'`) con `useState` (`visible`, `exiting`) y `useEffect`:

1. Al montar, programa `setTimeout` a **2600ms** → `setExiting(true)` (agrega clase `.exiting` al overlay: `opacity: 1 → 0`, transición 0.6s, misma curva bezier).
2. Segundo `setTimeout` a **3200ms** → `setVisible(false)` (el componente retorna `null`, desmontándose y revelando la página detrás, ya renderizada).
3. Cleanup: ambos timeouts se limpian en el `return` del `useEffect`.

No requiere props ni callbacks del padre — es autocontenido.

## Integración

En `apps/web/src/app/layout.jsx`, importar `Bienvenida` y montarlo dentro de `<body>`, antes de `<Header />`:

```jsx
<body>
  <Bienvenida />
  <Header />
  <main>{children}</main>
</body>
```

El overlay al ser `position: fixed` cubre el resto del contenido mientras está visible; no afecta el layout del documento.

## Accesibilidad

- `role="status"` + `aria-label` (localizado) en el overlay para lectores de pantalla.
- Enlace de GitHub con `target="_blank" rel="noopener noreferrer"`.

## Detección de idioma (i18n)

`Bienvenida` acepta una prop `locale` (`'es' | 'en'`, default `'es'`) que selecciona un diccionario interno (`COPY`) con `ariaLabel`, `line1`, `line2`. El link de GitHub no se traduce (es una URL).

El locale se resuelve **server-side**, no client-side, para evitar el flash de "español → cambia a inglés" que ocurriría si se leyera `navigator.language` en el cliente después de una hidratación que ya renderizó en español:

- `apps/web/src/app/layout.jsx` se vuelve `async` y usa `headers()` de `next/headers` para leer `Accept-Language`.
- `resolveLocale()` toma el primer tag del header (antes de la primera coma), y devuelve `'en'` si empieza con `en` (case-insensitive), sino `'es'` (incluye el caso sin header o idiomas no soportados).
- El `locale` resuelto también fija `<html lang={locale}>`.
- No hay UI para que el usuario cambie el idioma manualmente (fuera de alcance) ni persistencia (se recalcula en cada request).

**Trade-off aceptado:** al depender de `headers()`, Next.js marca todas las rutas bajo este layout como dinámicas (`ƒ`) en vez de estáticas (`○`) — se pierde el pre-render estático de `/`, `/proyectos`, `/sobre-mi`, `/contacto`. Es el costo de detectar el idioma sin flash ni pedirlo explícitamente.

## Criterios de aceptación

- El splash cubre el 100% del viewport con fondo oscuro y contenido centrado.
- Las dos líneas de texto y el link aparecen con efecto de revelación desde abajo (`translateY` + `opacity`), en cascada (iconos → línea 1 → línea 2 → link).
- El splash desaparece automáticamente (fade-out) sin interacción del usuario, ~3.2s después de montarse.
- No introduce errores de hidratación ni warnings en consola al correr `next dev`.
- Con `Accept-Language: en-US,en;q=0.9` el splash y `<html lang>` muestran inglés; con `es-AR`, sin header, o un idioma no soportado (ej. `fr-FR`), muestran español.
