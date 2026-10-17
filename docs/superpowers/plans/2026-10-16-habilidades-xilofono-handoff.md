# Habilidades = xilófono de vidrio — handoff para Opus

> Cómo usarlo: el usuario cambia a Opus con `/model` y pega:
> **"Continuá con `docs/superpowers/plans/2026-10-16-habilidades-xilofono-handoff.md`."**
> Este documento es autosuficiente. Antes de escribir código, leé la sección "Reglas del proyecto" y
> hacele al usuario las preguntas de "Decisiones abiertas" (una sola ronda, breve).

## 1. Qué se quiere

Implementar en la sección **Habilidades** del portafolio una adaptación de
<https://github.com/Sujenphea/xylophone> ("The Endless Glass Xylophone", MIT, Codrops):
una hélice de barras de vidrio esmerilado que giran con el scroll y "suenan" al pasar el mouse.

Cambios pedidos respecto del original (palabras del usuario):

1. **Cada barrita del xilófono es una habilidad, con su logo.** Hoy las 64 barras son idénticas y sólo se distinguen por la nota.
2. **Paleta acotada, alineada con la web**, no el arcoíris del original (gradiente `#ff0033 → #00ffe1`
   en `buildGradientTexture()`). La web es oscura/clara con acento azul eléctrico.
3. Vive **dentro de la sección** `#habilidades`, no como canvas fijo a pantalla completa.

## 2. El sitio donde va

- Monorepo npm workspaces. App: `apps/web` (**Next 15 App Router**, React 19, **JavaScript, no TypeScript**, comentarios y nombres en español).
- Dependencias ya presentes: `three 0.186.1`, `postprocessing 6.39.5`, `@react-three/fiber 9.8.1`, `@react-three/drei 10.7.9`,
  `@react-three/postprocessing 3.1.1`, `framer-motion`, `gsap`, `react-icons ^5.7`. El original usa `three ^0.182` + `postprocessing ^6.39.3`: compatibles (misma API; revisar sólo cambios menores de three entre 0.182 y 0.186).
- Hoy `#habilidades` es un placeholder: `apps/web/src/app/page.jsx` renderiza `<section id="habilidades"><h2>Habilidades</h2></section>` (mismo caso que Experiencia y Contacto). `Sobre mí` y `Proyectos` son componentes propios que **rompen el `main` de 960px** con `width:100vw; margin-left: calc(50% - 50vw)`; copiar ese patrón.
- Referencias de cómo se hizo 3D acá: `apps/web/src/components/SobreMi/Columna3D/MundoColumna.jsx` (Canvas R3F, `frameloop` pausado fuera de pantalla con `IntersectionObserver`, `PerformanceMonitor` que baja calidad, `LimiteErrores`, `webglcontextlost`), `Escena3D/soporteWebGL.js` (`hayWebGL()`), `SobreMi.jsx` (`dynamic(() => import(...), { ssr:false })`).
- Tokens de color (`packages/config/tokens/tokens.css`): `--color-bg #0b0d12`, `--color-fg #f4f5f7`, `--color-muted #9aa1ac`, `--color-accent #5b8cff`, `--color-border`, `--color-chip-bg`; tema claro/oscuro por `data-theme` en `<html>` (hook `hooks/useTema.js`). El azul eléctrico vivo que se usa en el grafo/minimapa es `#1f6bff`/`#2f6bff`. **Gama sugerida**: del azul acento al azul eléctrico, más neutros (blanco/gris azulado) para el vidrio; nada de rojos/verdes/amarillos.
- Fuente de las habilidades: `apps/web/src/data/tecnologias.js` — `TECNOLOGIAS` (39 ítems: `id`, `nombre`, `icono` = nombre del componente de `react-icons/si` o `null`, `sigla`). `apps/web/src/components/Proyectos/iconosTecnologias.jsx` exporta `IconoTecnologia({ id })` (usa el ícono de `react-icons/si` o dibuja la `sigla`). Reusar estos datos y este componente para no duplicar logos.

## 3. El repo original, archivo por archivo (relevado por GitHub raw)

Stack: Three.js + `postprocessing`, TypeScript, Vite, Web Audio. Sin carpeta `public/`; assets en `src/assets`.

| Archivo | Qué hace |
|---|---|
| `src/js/main.ts` | `App`: `WebGLRenderer` (alpha:false, antialias, sRGB, NoToneMapping), canvas `position:fixed` + `pointer-events:none` prependeado al `body`, cámara FOV 45 en z=5, loop con `delta` acotado a 1/20 s, `resize()` mide `#sizer`, `webglcontextlost` con `preventDefault`. Orden de pasadas: `frostBackdrop → render → glassBuffer → ssao → aa` (SMAA ULTRA / MEDIUM en mobile). `pagehide` → `destroy()`. |
| `components/xylophone/Xylophone.ts` | Una sola `InstancedMesh` con atributos por instancia `aPos`, `aRot`, `aStrikeTime`, `ShaderMaterial` (`xylophoneVert/Frag`, `DoubleSide`). Geometría = **primer hijo** de `assets/models/xylophone-09.glb`. `update()`: `updateScroll` (acumula `Input.deltaScrollY * scroll.sensitivity`, `MathUtils.damp` hacia la fase) y `updateStrike` (raycast desde `Input.mouseXY`, si cambia la barra → `aStrikeTime[i]=time` y `audio.playNote(i)`). API: `group`, `uniforms`, `setFluid`, `setMuted`, `load`, `update`, `dispose`. Color: textura-gradiente 256×1 `u_tGradient` + `u_tintStrength/Glow/Wrap`. |
| `components/xylophone/helix.ts` | `buildInstancedGeometry` y `writeHelixTransforms`: posa las N barras en una hélice (`thetaStep`, `thetaOffset`, `radius`, `tiltFalloff`) y la hace circular con la fase del scroll (cinta infinita con conteo fijo). |
| `components/xylophone/picking.ts` | Picking en CPU sin allocations: reconstruye la matriz de cada instancia y prueba **una AABB por barra** (`hitBarIndex`). |
| `components/xylophone/XylophoneAudio.ts` | `AudioContext`; un sample (`assets/audio/do.wav`) re-tonado por escala pentatónica mayor (`AUDIO.baseFreq 523.25`, `octaveSpan 3`), una voz por golpe con tope de voces. |
| `components/FluidSim.ts` + `shaders/fluid/*` | Fluido GPU de baja resolución (`simRes 128`; adaptado de WebGL-Fluid-Simulation, MIT) cuya velocidad tiñe las barras (estela del mouse); se duerme sin movimiento. |
| `passes/FrostBackdropPass.ts`, `passes/GlassBufferPass.ts` | Fondo desenfocado (`FROST.strength 0.9`, `maxBlurPx 48`) que cada barra refracta; buffer de normales de vista para SSAO. |
| `shaders/xylophone/{xylophoneVert,xylophoneFrag,glassNormalFrag}.glsl` | Vidrio falso: refracción del backdrop, fresnel, iridiscencia de película delgada, swing por golpe (`u_swingScale`), giro (`u_spinSpeed`). |
| `configs/XylophoneConfig.ts` | `QUALITY` (isMobile = `(pointer: coarse)` y lado corto < 900px), `XYLOPHONE` (`count 64`, `radius 1`, `thetaStep 0.175`, `spinSpeed 0.3`, `tintWrap 10`, `group {scale .5, rotX 25°, rotZ 30°}`, `scroll {sensitivity .005, lerp 5}`), `AUDIO`, `FLUID`, `FROST`, `SSAO`. |
| `ui/SoundToggle.ts`, `utils/input.ts`, `utils/normalizeWheel.ts`, `utils/properties.ts` | Botón de sonido, entrada de mouse/rueda (acá el original **captura la rueda** para girar la hélice), propiedades globales (`dpr`, `reduceMotion`, `time`). |

Cómo leerlo sin clonar: `https://raw.githubusercontent.com/Sujenphea/xylophone/main/<ruta>` (p. ej. `src/js/main.ts`) o `git clone` **fuera** de `apps/web` (por ejemplo en una carpeta temporal) y no versionarlo. Los assets (`xylophone-09.glb` 27 KB, `do.wav` 85 KB) se bajan por raw y se copian a `apps/web/public/habilidades/` si se usan.

## 4. Plan técnico sugerido

1. **Componente** `apps/web/src/components/Habilidades/Habilidades.jsx` (cliente): carga perezosa del chunk three con `dynamic(..., { ssr:false })` cuando la sección se acerca (como `SobreMi`), y `hayWebGL()` para un respaldo plano (lista/rejilla de logos) si no hay WebGL.
2. **Portar a JS/ES modules** el núcleo (Xylophone, helix, picking, audio, shaders, passes) a `components/Habilidades/xilofono/` sin TypeScript. Mantener `three` crudo (como el original) dentro de un `useEffect`, o R3F si resulta más simple de integrar; lo que importa es **un solo draw call** instanciado. Canvas **dentro** de la sección (`position:absolute; inset:0`), no fijo; tamaño por `ResizeObserver` del contenedor (no `#sizer`).
3. **Una barra = una habilidad**: lista ordenada de `TECNOLOGIAS` (o el subconjunto que decida el usuario). Atlas de logos (canvas 2D: renderizar cada `react-icons/si` a SVG→`Image`→`drawImage`, o la `sigla` para los `icono:null`) como textura; atributo por instancia `aSkill` (índice en el atlas) y UV del logo en `xylophoneFrag.glsl`, **tintado con la paleta** (monocromo claro sobre el vidrio). Si hay menos habilidades que barras, o se baja `count` al número de habilidades o se repiten con la fase (la cinta infinita lo permite): decidirlo con el usuario.
4. **Picking → habilidad**: `hitBarIndex` ya devuelve el índice; mapearlo a la habilidad para mostrar nombre (tooltip HTML posicionado, o rótulo en el canvas) y disparar la nota de esa barra.
5. **Paleta**: reemplazar `buildGradientTexture()` por un gradiente en la gama azul del sitio (leer `--color-accent` / `getComputedStyle`), y el tinte del fluido igual. Respetar tema claro/oscuro (fondo desenfocado = el fondo de la sección, no negro).
6. **Scroll**: el original usa la rueda para girar la hélice y captura el scroll. Acá **no hay que secuestrar el scroll de la página**: girar con el movimiento del mouse/arrastre dentro de la sección y/o con el scroll de la página mientras la sección está a la vista (proponer y validar con el usuario); nunca `preventDefault` de la rueda sin Ctrl.
7. **Rendimiento y robustez**: pausar el loop fuera de pantalla (`IntersectionObserver`, como `MundoColumna` con `frameloop`), `dpr` acotado (`QUALITY.maxDpr`), escalones de calidad (sin SSAO / fluido más chico en mobile o si el FPS cae, como `PerformanceMonitor`), `webglcontextlost`, `dispose()` completo al desmontar, `prefers-reduced-motion` (sin giro ni swing, el hover igual funciona).
8. **Audio**: apagado por defecto, con botón de sonido (portar `SoundToggle`); `AudioContext` sólo tras un gesto del usuario.
9. **Accesibilidad**: la lista de habilidades también existe como texto/lista oculta para lectores de pantalla; el canvas es `aria-hidden`.
10. Reemplazar el placeholder en `app/page.jsx` por `<Habilidades key=... />` (patrón de `Proyectos`).

## 5. Decisiones abiertas (preguntarle al usuario antes de arrancar)

- ¿Cuáles habilidades y en qué orden/agrupación? (todas las 39 de `tecnologias.js`, o un subconjunto curado de ~16–24; ¿agrupar por frontend/backend/datos/infra?)
- Si hay menos habilidades que barras: ¿bajar la cantidad de barras o repetir?
- ¿Cómo gira la hélice: con el scroll de la página, con el mouse, o con arrastre?
- ¿Sonido: el sample original (`do.wav`) o uno propio? ¿Se quiere el botón de sonido visible?
- Tema claro: ¿vidrio oscuro sobre fondo claro o vidrio claro? (en Sobre mí las tarjetas de materias quedaron siempre oscuras por contraste).

## 6. Reglas del proyecto (obligatorias)

- Trabajar en el worktree **`C:\Users\Asus\Desktop\Trabajo\PORTAFOLIO-integracion`** (rama `integracion`). Hay trabajo **sin commitear** del usuario: **no commitear ni pushear sin que lo pida**; no revertir cambios ajenos.
- Código y comentarios **en español**, mismo estilo que el resto (JS, sin TypeScript; módulos CSS `*.module.css`; comentarios que explican el porqué).
- Tests con `node --test` (`cd apps/web && node --test $(find src -name "*.test.js")`; hoy 138 en verde). Meter en `lib/` la lógica pura (hélice, mapeo habilidad→barra, paleta) para poder testearla; lo visual se verifica con capturas.
- Correr local como en `docs/DEV-LOCAL.md`: `cd apps/web && npx next build && npx next start -p 3000` (servidor de producción en :3000; **no** mezclar `next dev` y `next build` en el mismo `.next`; matar el proceso del puerto antes de reconstruir). Si se pide ver cambios en vivo, `next dev -p 3000`.
- Verificación visual/rendimiento con Chrome headless por CDP (hay scripts de ejemplo en `apps/web/scripts/`: `cdp-ayuda.mjs`, `captura-*.mjs`): capturas a 1917×910 y 2560×1300, tema claro y oscuro, y medir cuadros largos (LoAF/longtask) y bloqueos de `getProgramParameter` durante el giro. **Lección de este proyecto**: three recompila todos los shaders si cambia la cantidad de luces visibles o el entorno; en Sobre mí eso causaba congelamientos de segundos. No agregar ni quitar luces/entorno durante la interacción, y precompilar (`compileAsync`) fuera de la vista.
- No cargar fuentes con licencia restrictiva (p. ej. SF Pro) ni assets de terceros sin revisar su licencia; el repo original es MIT (mantener `LICENSE`/crédito en un comentario del módulo).
- Al terminar: resumen honesto (qué se probó y qué no), sin afirmar nada que no se haya visto.
