# Hero inmersivo interactivo (hover en nav cambia el fondo) — Diseño

## Objetivo

Un hero a pantalla completa detrás de la cabecera que cambia su fondo y título con un crossfade suave cuando el visitante hace hover sobre los enlaces de la píldora de navegación (estado pre-scroll). Post-scroll, el efecto inmersivo se desactiva y la navegación se comporta como un one-page portfolio: las mini-píldoras son anclas que hacen scroll suave a secciones más abajo.

## Alcance

- `apps/web/src/contexto/ProveedorPortfolio.jsx` (nuevo) — Context de cliente para compartir `seccionActiva`.
- `apps/web/src/components/HeroInmersivo/HeroInmersivo.jsx` + `.module.css` (nuevo) — el fondo con capas crossfade.
- `apps/web/src/app/layout.jsx` (modif) — envolver en el provider, montar el hero.
- `apps/web/src/components/Header/Header.jsx` (modif) — enlaces a anclas, disparar hover pre-scroll.
- `apps/web/src/components/ElementoNavegacion/ElementoNavegacion.jsx` (modif) — usar `<a>` de ancla en vez de `next/link`.
- `apps/web/src/app/page.jsx` + `page.module.css` (modif) — scaffold de secciones ancladas reemplazando el espaciador.
- `apps/web/src/styles/globals.css` (modif) — `scroll-behavior: smooth`.

Fuera de alcance: contenido real de las secciones (son placeholders con `id` para que el scroll suave funcione); imágenes reales de fondo (se usan gradientes CSS premium, reemplazables luego por una variable/`background`); reescritura de las páginas `/proyectos`, `/sobre-mi`, `/contacto` que ya existen (quedan intactas pero salen de la nav principal); tests automatizados (feature puramente visual/interactiva).

## Nomenclatura

Español, JSX sin TypeScript, CSS Modules: `ProveedorPortfolio`, `usePortfolio`, `seccionActiva`, `setSeccionActiva`, `HeroInmersivo`, `SECCIONES`, `ENLACES`, `seccion`.

## 1. Estado compartido: `ProveedorPortfolio`

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

- Estado único: `seccionActiva` (string), default `'inicio'`.
- El provider es client component pero recibe los server/client components (`Bienvenida`, `ThemeToggle`, `Header`, `HeroInmersivo`, `{children}`) como `children` desde el layout server — nada pierde su render en el servidor.

## 2. `HeroInmersivo`

Consume `seccionActiva`. Renderiza **todas** las capas siempre montadas (nunca unmount/remount → sin parpadeo); solo cambia cuál está activa vía clase condicional.

```jsx
// apps/web/src/components/HeroInmersivo/HeroInmersivo.jsx
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

```css
/* HeroInmersivo.module.css (esquema) */
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

.capa.activa {
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

/* Un gradiente premium distinto por sección (placeholder de foto). */
.capa-inicio { background: linear-gradient(135deg, #1a1c22 0%, #2b2f3a 100%); }
.capa-sobre-mi { background: linear-gradient(135deg, #2a2438 0%, #4a3f66 100%); }
.capa-proyectos { background: linear-gradient(135deg, #10263b 0%, #1f4d73 100%); }
.capa-experiencia { background: linear-gradient(135deg, #3b2a10 0%, #73561f 100%); }
.capa-habilidades { background: linear-gradient(135deg, #10322b 0%, #1f7357 100%); }
.capa-contacto { background: linear-gradient(135deg, #3b1020 0%, #731f45 100%); }
```

- Los valores exactos de gradiente son un punto de partida; se afinan a ojo en el navegador.
- Título siempre blanco con sombra (los gradientes son oscuros/saturados → contraste garantizado en ambos temas del sitio).

## 3. Cabecera + hover

`ENLACES` pasa a anclas y suma el campo `seccion`:

```js
const ENLACES = [
  { href: '#sobre-mi', seccion: 'sobre-mi', label: 'Sobre mi', icono: <IconoPersona /> },
  { href: '#proyectos', seccion: 'proyectos', label: 'Proyectos', icono: <IconoGrid /> },
  { href: '#experiencia', seccion: 'experiencia', label: 'Experiencia', icono: <IconoMaletin /> },
  { href: '#habilidades', seccion: 'habilidades', label: 'Habilidades', icono: <IconoEstrella /> },
  { href: '#contacto', seccion: 'contacto', label: 'Contáctame', icono: <IconoSobre /> },
];
```

- `Header` consume `const { setSeccionActiva } = usePortfolio();`.
- **Píldora grande (pre-scroll):** el `<ul>` recibe `onMouseLeave={() => setSeccionActiva('inicio')}`; cada `<li>` recibe `onMouseEnter={() => setSeccionActiva(enlace.seccion)}`. Efecto premium: moverse entre links cambia de sección sin volver a inicio; solo al salir de toda la píldora vuelve al default.
- **Mini-píldoras (post-scroll):** sin handlers de hover — son solo anclas de scroll suave. El efecto inmersivo queda desactivado por construcción (la píldora grande está desmontada, y el hero está cubierto por las secciones opacas a esa altura de scroll).
- El logo (`Felipe Diaz Aimar`) apunta a `#inicio`.
- `ElementoNavegacion` cambia `<Link href>` de `next/link` por un `<a href>` nativo (para scroll de ancla en la misma página con `scroll-behavior: smooth`). El resto (`layoutId`, íconos, `TextoRodante`/`TextoBrillante` según variante) no cambia.

## 4. Secciones one-page + capas de z-index

`page.jsx` reemplaza el espaciador por secciones ancladas:

```jsx
export default function HomePage() {
  return (
    <>
      <section id="inicio" className={styles.seccionHero} />
      <section id="sobre-mi" className={styles.seccion}><h2>Sobre mí</h2></section>
      <section id="proyectos" className={styles.seccion}><h2>Proyectos</h2></section>
      <section id="experiencia" className={styles.seccion}><h2>Experiencia</h2></section>
      <section id="habilidades" className={styles.seccion}><h2>Habilidades</h2></section>
      <section id="contacto" className={styles.seccion}><h2>Contacto</h2></section>
    </>
  );
}
```

```css
.seccionHero {
  height: 100vh;   /* transparente: se superpone al HeroInmersivo detrás */
}

.seccion {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  scroll-margin-top: 5rem;  /* para que el ancla no quede tapada por la cabecera */
}
```

**Capas de z-index (de atrás hacia adelante):**
- `HeroInmersivo`: `position: absolute; top: 0; z-index: -1` — vive directamente en el `<body>` (vía el provider), fuera de `main`, así que es full-bleed (100vw). Ocupa solo los primeros 100vh y **scrollea con la página** (absolute, no fixed): tras esa altura ya no existe, y las secciones siguientes se ven sobre el fondo normal del `body` sin necesidad de taparlo. `z-index: -1` lo deja por encima del background del `body` pero detrás del contenido en flujo (que no necesita z-index propio).
- `#inicio` (dentro de `main`): 100vh transparente, se superpone a la zona del hero y lo deja ver. Como es transparente, no importa que `main` esté limitado a 960px — el hero full-bleed se ve igual, incluso en los márgenes laterales.
- `Header`: `z-index: 900`. `ThemeToggle`: `1000`. `Bienvenida`: `9999`.

`globals.css` agrega `scroll-behavior: smooth;` en `html`.

## 5. layout.jsx

```jsx
<ProveedorPortfolio>
  <Bienvenida locale={locale} />
  <ThemeToggle />
  <Header />
  <HeroInmersivo />
  <main>{children}</main>
</ProveedorPortfolio>
```

`ProveedorPortfolio` (client) envuelve todo; los server components pasan como children sin perder SSR.

## Criterios de aceptación

- Al hacer hover sobre un enlace de la píldora grande (pre-scroll), el fondo del hero cruza (crossfade + leve scale) a la sección correspondiente y muestra su título centrado, sin parpadeo.
- Al salir de la píldora, el hero vuelve a `'inicio'`.
- Moverse entre enlaces cambia de sección directamente, sin flashear a inicio en el medio.
- Post-scroll (mini-píldoras): no hay efecto de hover; los enlaces hacen scroll suave a su sección con `id` correspondiente.
- Las capas del hero nunca desaparecen abruptamente ni parpadean (todas montadas, solo cambia opacidad/scale).
- El hero se ve full-screen detrás de la cabecera cuando `#inicio` está en viewport, y scrollea fuera de vista al pasar a las secciones siguientes.
- `next build` compila sin errores; sin warnings de hidratación en `next dev`.
