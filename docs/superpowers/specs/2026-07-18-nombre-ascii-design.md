# Nombre en ASCII (formación + degradados) — Diseño

## Objetivo

En la capa `inicio` del `HeroInmersivo`, reemplazar el título centrado "Bienvenido" por el nombre del usuario ("Felipe" / "Diaz Aimar") alineado a la izquierda, que se forma letra por letra en ASCII grande (estilo Figlet) animando de arriba hacia abajo, enmarcado por dos franjas con degradado (arriba y abajo, color según el tema). Al terminar la animación, las franjas se encogen y el ASCII hace un cross-fade hacia tipografía limpia normal — ese es el estado de reposo final. (El colapso físico al hacer hover queda para una spec siguiente, que va a modificar este mismo componente.)

## Alcance

- `apps/web/package.json` — nueva dependencia: `react-ascii-text`.
- `apps/web/src/components/NombreAscii/NombreAscii.jsx` + `.module.css` (nuevo).
- `apps/web/src/components/HeroInmersivo/HeroInmersivo.jsx` + `.module.css` (modificado: la capa `inicio` renderiza `<NombreAscii/>` en vez de `<span className={styles.titulo}>Bienvenido</span>`, alineada a la izquierda en vez de centrada).

Fuera de alcance: colapso físico con Matter.js al hacer hover (spec siguiente); el resto de las capas del Hero (sin cambios); tests automatizados.

## Nomenclatura

Español: `NombreAscii`, `empezar`, `formado`, `refAscii`, `franjaSuperior`, `franjaInferior`, `textoLimpio`.

## Dependencia nueva

`react-ascii-text` (`npm install react-ascii-text` en `apps/web`) — hook `useAsciiText` que renderiza texto en ASCII grande usando fuentes Figlet, con soporte de animación direccional (`animationDirection: 'down'`) y un set de caracteres que "barren" antes de asentarse en la letra final (`animationCharacters`). **Riesgo a verificar en la implementación:** la librería documenta soporte "React 17+, Next.js App Router" pero no confirma React 19 explícitamente (el proyecto usa React 19) — se valida con `npm run build` al instalar; si hay incompatibilidad real se vuelve a evaluar.

**Sin callback de finalización:** la librería no expone `onComplete`. La duración de la animación se estima con un temporizador propio (`DURACION_ANIMACION_MS`, valor de partida a ajustar a ojo en el navegador) en vez de detectar el fin real.

## Componente `NombreAscii`

```jsx
'use client';

import { useEffect, useState } from 'react';
import { useAsciiText, standard } from 'react-ascii-text';
import styles from './NombreAscii.module.css';

const DEMORA_INICIO_MS = 3300; // coincide con UNMOUNT_DELAY_MS de Bienvenida
const DURACION_ANIMACION_MS = 2600; // estimado, se afina a ojo
const CARACTERES_ANIMACION = '/*+#%@$&';

export default function NombreAscii() {
  const [empezar, setEmpezar] = useState(false);
  const [formado, setFormado] = useState(false);

  const refAscii = useAsciiText({
    font: standard,
    text: ['Felipe', 'Diaz Aimar'],
    animationDirection: 'down',
    animationCharacters: CARACTERES_ANIMACION,
    animationSpeed: 25,
    animationLoop: false,
    isPaused: !empezar,
  });

  useEffect(() => {
    const temporizadorInicio = setTimeout(() => setEmpezar(true), DEMORA_INICIO_MS);
    return () => clearTimeout(temporizadorInicio);
  }, []);

  useEffect(() => {
    if (!empezar) return;
    const temporizadorFin = setTimeout(() => setFormado(true), DURACION_ANIMACION_MS);
    return () => clearTimeout(temporizadorFin);
  }, [empezar]);

  return (
    <div className={styles.contenedor}>
      <span className={styles.soloLectura}>Felipe Diaz Aimar</span>

      <pre className={`${styles.ascii} ${formado ? styles.oculto : ''}`} ref={refAscii} aria-hidden="true" />

      <div className={`${styles.textoLimpio} ${formado ? styles.visible : ''}`} aria-hidden="true">
        <span>Felipe</span>
        <span>Diaz Aimar</span>
      </div>

      <div className={`${styles.franja} ${styles.franjaSuperior} ${formado ? styles.encogida : ''}`} />
      <div className={`${styles.franja} ${styles.franjaInferior} ${formado ? styles.encogida : ''}`} />
    </div>
  );
}
```

`isPaused: !empezar` retiene el hook siempre montado (necesario, no se puede llamar condicionalmente) pero sin animar hasta que pasan los 3.3s de `Bienvenida`. `soloLectura` es un `<span>` visualmente oculto (mismo patrón que `TextoDescifrado`) que lleva el nombre real para lectores de pantalla — tanto el `<pre>` ASCII como el bloque de texto limpio están marcados `aria-hidden`, son decorativos.

## CSS (`NombreAscii.module.css`)

```css
.contenedor {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 10rem;
}

.soloLectura {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.ascii {
  margin: 0;
  font-family: monospace;
  font-size: clamp(0.45rem, 0.9vw, 0.7rem);
  line-height: 1.05;
  color: var(--color-fg);
  white-space: pre;
  opacity: 1;
  transition: opacity 0.6s ease;
}

.ascii.oculto {
  opacity: 0;
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.textoLimpio {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  font-family: var(--font-sans);
  font-weight: 800;
  letter-spacing: -0.02em;
  font-size: clamp(2rem, 5vw, 4rem);
  color: var(--color-fg);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.6s ease;
}

.textoLimpio.visible {
  opacity: 1;
}

.franja {
  position: absolute;
  left: 0;
  right: 0;
  height: 42%;
  z-index: 2;
  pointer-events: none;
  transition: height 1s cubic-bezier(0.16, 1, 0.3, 1);
}

.franjaSuperior {
  top: 0;
  background: linear-gradient(to bottom, var(--color-bg) 0%, transparent 100%);
}

.franjaInferior {
  bottom: 0;
  background: linear-gradient(to top, var(--color-bg) 0%, transparent 100%);
}

.franja.encogida {
  height: 0%;
}
```

`var(--color-bg)` ya es el token que invierte oscuro/claro según el tema (ver sistema de theming existente), así que las franjas quedan theme-aware sin lógica extra. Los valores de tamaño de fuente ASCII, duración estimada y altura de franja son puntos de partida — se ajustan a ojo contra el navegador durante la implementación, como el resto de los efectos de este proyecto.

## `HeroInmersivo` — capa `inicio`

```jsx
// HeroInmersivo.jsx: la capa 'inicio' deja de usar el título genérico
{seccion.id === 'inicio' ? <NombreAscii /> : <span className={styles.titulo}>{seccion.titulo}</span>}
```

`SECCIONES` pierde la entrada `titulo: 'Bienvenido'` para `inicio` (ya no se usa).

```css
/* HeroInmersivo.module.css */
.capa-inicio {
  justify-content: flex-start;
  padding-left: clamp(2rem, 8vw, 6rem);
  background: linear-gradient(135deg, #1a1c22 0%, #2b2f3a 100%);
}
```

(El resto de las capas conservan `justify-content: center` heredado de `.capa`.)

## Criterios de aceptación

- Antes de los 3.3s (mientras `Bienvenida` cubre la pantalla), no hay animación corriendo — arranca recién después, igual que `TextoRodante`/`TextoDescifrado`.
- El nombre se arma en ASCII grande, dos líneas ("Felipe" / "Diaz Aimar"), animando de arriba hacia abajo, con las franjas de degradado visibles enmarcando la formación.
- Al completarse, las franjas se encogen y el ASCII cede lugar a texto limpio normal (mismo nombre, tipografía del sitio) — ese es el estado final, sin más animación.
- El nombre queda alineado a la izquierda de la capa `inicio`; el resto de las capas del Hero no cambian.
- Lectores de pantalla anuncian "Felipe Diaz Aimar" una sola vez (vía el `span` accesible), no el contenido fragmentado del ASCII.
- `next build` compila sin errores tras agregar `react-ascii-text`.
