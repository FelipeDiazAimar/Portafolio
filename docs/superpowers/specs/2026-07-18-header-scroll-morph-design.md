# Header con morph scroll (píldora ↔ mini-píldoras) + TextoBrillante — Diseño

## Objetivo

Evolucionar `<Header/>` para que, al pasar `window.scrollY >= window.innerHeight`, la píldora de navegación única se transforme (morph real, vía Framer Motion) en 5 mini-píldoras circulares independientes que se expanden al hacer hover revelando su label. Los textos de los links usan un nuevo componente `<TextoBrillante/>` con efecto de brillo animado, adaptado de `ShinyPill` (Originkit).

## Alcance

- `apps/web/src/components/TextoBrillante/TextoBrillante.jsx` + `.module.css` (nuevo)
- `apps/web/src/components/ElementoNavegacion/ElementoNavegacion.jsx` + `.module.css` (nuevo)
- `apps/web/src/hooks/useScrollPasadoViewport.js` (nuevo — hook compartido)
- `apps/web/src/components/Header/Header.jsx` + `.module.css` (reescritura)
- `apps/web/src/components/ThemeToggle/ThemeToggle.jsx` (refactor menor — consume el hook nuevo en vez de su lógica de scroll duplicada)
- `apps/web/package.json` — nueva dependencia: `framer-motion`

Fuera de alcance: soporte de `prefers-reduced-motion` para el sweep de `TextoBrillante` o el morph (el resto del sitio tampoco lo tiene hoy); navegación táctil/mobile para las mini-píldoras (la píldora entera sigue oculta bajo 768px, sin cambios ahí); tests automatizados (todo el trabajo es visual/interactivo).

## Nomenclatura

Todo el código nuevo usa nombres en español, según se pidió: `TextoBrillante`, `ElementoNavegacion`, `useScrollPasadoViewport`, `estaScrolleado`, `ENLACES`, `variante`, etc. Los archivos ya existentes que se tocan (`Header.jsx`, `ThemeToggle.jsx`) también migran sus identificadores internos a español donde se reescriben, sin tocar los nombres de archivo/componente ya establecidos (`Header`, `ThemeToggle`, `GlassSurface` se mantienen).

## 1. Nueva dependencia: framer-motion

Se agrega `framer-motion` a `apps/web/package.json` (`npm install framer-motion` desde `apps/web`). Es la única forma práctica de lograr un morph FLIP real (5 items volando de su posición dentro de la píldora grande a su círculo individual) sin escribir a mano el cálculo de `getBoundingClientRect()` + inversión de transform para cada elemento — Framer Motion resuelve esto automáticamente vía `layout` + `layoutId` compartido entre renders.

## 2. `TextoBrillante`

Adaptado de `ShinyPill` (Originkit, código provisto por el usuario), sin TypeScript, sin los props/metadata específicos de Framer (`font`, comentarios `@framerIntrinsicWidth`), con el `@keyframes` movido a CSS Modules en vez de inyectado por JS (el original usa `dangerouslySetInnerHTML` con un `id` fijo — si se instancia más de una vez, como acá con 5 links simultáneos, duplicaría nodos `<style>` con el mismo `id`, inválido en HTML).

**Colores:** en vez de los hex fijos que pidió originalmente el usuario (`#FFFFFF`/`#000000`), reutiliza los tokens ya existentes — decisión tomada junto al usuario para consistencia con el resto de la tipografía del sitio:
- Capa base: `color: var(--color-fg)` (casi-blanco en oscuro, casi-negro en claro — ya invierte solo por tema).
- Capa brillo: `color: var(--color-bg)` (casi-negro en oscuro, casi-blanco en claro).

```jsx
// apps/web/src/components/TextoBrillante/TextoBrillante.jsx
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

```css
/* TextoBrillante.module.css */
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

No necesita `'use client'` estrictamente (no usa hooks), pero se marca igual porque siempre se renderiza dentro de `ElementoNavegacion`, que sí es cliente (usa Framer Motion) — mantiene el límite explícito y evita ambigüedad.

## 3. Hook compartido `useScrollPasadoViewport`

Extrae la lógica de scroll que hoy vive duplicada en `ThemeToggle` (listener con `requestAnimationFrame`, umbral `window.innerHeight`). La usan tanto `ThemeToggle` (para ocultarse) como `Header` (para decidir píldora grande vs mini-píldoras) — mismo umbral, misma razón ("saliste del hero"), un solo lugar si cambia.

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

`ThemeToggle.jsx` reemplaza su `useEffect` de scroll por `const visible = !useScrollPasadoViewport();` (nota el signo invertido: el toggle se oculta cuando *pasado* es `true`, es decir `visible = !pasado`). El resto de `ThemeToggle` no cambia.

`Header.jsx` usa `const estaScrolleado = useScrollPasadoViewport();` directamente.

## 4. `ElementoNavegacion`

Un solo componente para los dos estados visuales, distinguidos por la prop `variante` (`'grande' | 'mini'`), con el mismo `layoutId` en ambos casos — es lo que le permite a Framer Motion animar la transición de posición/tamaño entre uno y otro en vez de tratarlos como elementos no relacionados.

```jsx
// apps/web/src/components/ElementoNavegacion/ElementoNavegacion.jsx
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

```css
/* ElementoNavegacion.module.css */
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

En variante `grande`, `.texto` siempre es visible (no hay nada que lo esconda). En variante `mini`, es el **wrapper circular de afuera** (en `Header.module.css`, no acá) el que lo clippea con `overflow: hidden` cuando está en reposo — `ElementoNavegacion` no necesita saber si está clippeado o no, solo renderiza igual en los dos casos.

## 5. `Header.jsx` — las dos ramas

```jsx
// apps/web/src/components/Header/Header.jsx
'use client';

import { AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { GlassSurface } from '@portafolio/ui';
import ElementoNavegacion from '@/components/ElementoNavegacion/ElementoNavegacion.jsx';
import useScrollPasadoViewport from '@/hooks/useScrollPasadoViewport.js';
import styles from './Header.module.css';

function IconoPersona() { /* SVG minimalista, ver sección 6 */ }
function IconoGrid() { /* ... */ }
function IconoMaletin() { /* ... */ }
function IconoEstrella() { /* ... */ }
function IconoSobre() { /* ... */ }

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

export default function Header() {
  const estaScrolleado = useScrollPasadoViewport();

  return (
    <header className={styles.header}>
      <Link href="/" className={styles.logo}>Felipe Diaz Aimar</Link>

      <AnimatePresence mode="popLayout" initial={false}>
        {!estaScrolleado ? (
          <GlassSurface
            key="pildora-grande"
            width="auto"
            height={48}
            borderRadius={100}
            className={styles.pildoraGrande}
            {...PROPS_GLASS}
          >
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
        ) : (
          <nav key="mini-pildoras" className={styles.navMini}>
            {ENLACES.map((enlace) => (
              <div key={enlace.href} className={styles.miniWrapper}>
                <GlassSurface width="100%" height={48} borderRadius={100} {...PROPS_GLASS}>
                  <ElementoNavegacion enlace={enlace} icono={enlace.icono} variante="mini" />
                </GlassSurface>
              </div>
            ))}
          </nav>
        )}
      </AnimatePresence>
    </header>
  );
}
```

`AnimatePresence mode="popLayout"` permite que la rama saliente y la entrante convivan durante la transición sin empujarse por el flujo normal del grid, mientras Framer Motion resuelve el `layout`/`layoutId` compartido de cada `ElementoNavegacion` (mismo `href` = mismo `layoutId`) para animar su posición/tamaño real entre ambas ramas. Las superficies de vidrio en sí (`GlassSurface` grande vs los 5 círculos) no comparten `layoutId` — su aparición/desaparición es un fade simple que Framer Motion aplica por default a los hijos directos de `AnimatePresence` que no tienen `layout`.

```css
/* Header.module.css (fragmento relevante, agrega a lo ya existente) */
.pildoraGrande {
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
  .pildoraGrande,
  .navMini {
    display: none;
  }
}
```

El resto de `Header.module.css` (`.header`, `.logo`) no cambia respecto a lo ya implementado.

**Mecanismo del hover-expand:** `.miniWrapper` es un `<div>` normal (no `GlassSurface`) que controla su propio ancho vía CSS (`48px` → `160px` en hover/focus, con `overflow: hidden` para el efecto de "revelar"). Adentro, `<GlassSurface width="100%" height={48} .../>` sigue ese ancho automáticamente — su `ResizeObserver` interno ya recalcula el filtro de vidrio cuando su contenedor cambia de tamaño (es el comportamiento nativo del componente, no se lo modifica). **Trade-off aceptado:** esto dispara el recálculo del displacement map en cada frame de la transición de 0.45s — si al probarlo se siente con jank, la mitigación sería debounce/throttle sobre ese `ResizeObserver`, pero queda fuera de alcance de este spec salvo que se confirme el problema.

## 6. Íconos

Mismo estilo que `Bienvenida`/`ThemeToggle`: SVG inline, `stroke="currentColor"`, `viewBox="0 0 24 24"`, `strokeWidth="2"`, `strokeLinecap/Linejoin="round"`, sin librería externa. Uno por link, tamaño 18×18 (más grande que los 14px de `ThemeToggle` porque acá conviven con texto más grande dentro de una píldora de 48px, no con un thumb de 14px):

- `IconoPersona` (Sobre mi) — círculo (cabeza) + arco (hombros).
- `IconoGrid` (Proyectos) — 4 cuadrados en grilla 2×2.
- `IconoMaletin` (Experiencia) — rectángulo + asa arqueada arriba.
- `IconoEstrella` (Habilidades) — estrella de 5 puntas.
- `IconoSobre` (Contáctame) — rectángulo + solapa en V (sobre de carta).

## Criterios de aceptación

- Con `scrollY < innerHeight`: se ve una sola píldora grande centrada con los 5 links (ícono + `TextoBrillante`), igual que la implementación anterior pero con el nuevo texto brillante.
- Al cruzar `scrollY >= innerHeight`: la píldora grande se desvanece y aparecen 5 círculos individuales en su lugar, cada ícono/texto "volando" suavemente desde su posición en la píldora grande hacia su círculo — no un corte brusco ni un simple fade desconectado.
- Al volver a scrollear arriba, el proceso se revierte (mini-píldoras → píldora grande).
- Cada mini-píldora en reposo es un círculo mostrando solo el ícono; en hover/focus se expande horizontalmente revelando el label con `TextoBrillante`, con transición suave (`cubic-bezier(0.16, 1, 0.3, 1)`), sin saltos.
- El texto de cada link (en ambos estados) muestra el barrido de brillo continuo de `TextoBrillante`, con los colores correctos según el tema activo (invierte con `ThemeToggle`).
- `ThemeToggle` sigue ocultándose/mostrándose exactamente igual que antes (ahora vía el hook compartido).
- Mobile (`< 768px`): ninguna de las dos variantes de navegación se muestra, solo el logo — sin cambios respecto al comportamiento actual.
- `next build` compila sin errores tras agregar `framer-motion`.
