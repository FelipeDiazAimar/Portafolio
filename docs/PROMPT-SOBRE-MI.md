# MISIÓN: reemplazar por completo la sección "Sobre mí" por un reel 3D curvo de HITOS DE VIDA, con ilustraciones isométricas hechas con `anatomy-asset`

Sos el mejor ingeniero front-end creativo del mundo. Esta es la sección que más define el portafolio de Felipe Diaz Aimar (desarrollador full stack, San Francisco, Córdoba). Tiene que dejar a quien la vea sin palabras: cinemática, pulida hasta el último píxel, rápida, accesible y que se sienta carísima. **No escatimes en nada: tiempo, detalle, iteraciones ni verificación.** Si algo se ve "bien", todavía no está. Iterá hasta que se vea inevitable.

---

## 0. AUTORIZACIÓN (leé esto primero, evita preguntas innecesarias)

El usuario YA aprobó explícitamente, con este mensaje, el objetivo, el alcance y el reemplazo:

- **Objetivo:** la sección `#sobre-mi` actual (recorrido 3D con columna vertebral, escenas 3D por hito, minimapa, autoplay, primera persona) se **reemplaza completa** por la nueva experiencia descripta acá.
- **No pidas confirmación** de dónde integrarlo ni de si usar imágenes propias. Ya está decidido: va en `#sobre-mi`, con el contenido real de `apps/web/src/data/hitos.json`.
- Sólo frená a preguntar si algo es genuinamente imposible o hay una decisión irreversible fuera de este alcance (por ejemplo borrar archivos de `public/` que se usen en otra parte).
- **No hagas commit ni push.** Dejá los cambios en el working tree. Hay archivos sin trackear del usuario (`apps/web/.gitignore`, `public/CV-Felipe-Diaz-Aimar.pdf`, `scripts/captura-*.mjs`, `scripts/comparar-regresion.mjs`): no los toques.

---

## 1. PASO CERO OBLIGATORIO: CARGAR SKILLS Y LEER EL PROYECTO

### 1.1 Skills (cargalas ANTES de escribir una línea; si no están instaladas, instalalas o decímelo)
Listá las skills disponibles y cargá, en este orden de relevancia:

1. **`anatomy-asset`** (autor Teddarific). Instalación si falta:
   `npx skills add https://github.com/Teddarific/skills --skill anatomy-asset`
   Es una variante de la skill `anatomy` orientada a **arte estático**: genera **SVG isométricos** de objetos sólidos (no wireframes), sombreado de 4 tonos, orden del pintor, piezas pequeñas y precisas, cada línea termina en algo. Salida principal: un `.svg` standalone que funciona como `<img>`, inline o en herramientas de diseño, más una página de preview con chequeo de zona segura. Movimiento solo con CSS (helpers tipo `amRotor`, `amLoop`, `amSwing`, `amPress`, `amDraw`, `amFlip`, `amFloat`, `amSlide`, `amPulse`, `amBlink`, `amSpin`), máximo 2 o 3 cosas moviéndose, lentas, y quietas con `prefers-reduced-motion`. Verificá en el repo de la skill si el `kit/` (iso-kit, asset, lathe, tube…) viene con la instalación; si no, clonalo del repo antes de usarlo.
2. **Skills de GSAP** (core, ScrollTrigger, timelines, performance, plugins; `gsap` ya está en `package.json`). Son la base del scroll y de toda la coreografía.
3. **`make-interfaces-feel-better`** (micro-detalles: concentric radius, optical alignment, sombras en vez de bordes, tabular-nums, text-wrap balance/pretty, `-webkit-font-smoothing`, hit areas de 40x40 mínimo, transiciones interrumpibles, escalas al presionar, animaciones de entrada escalonadas y sutiles, etc.).
4. **Skill de transiciones impecables** (la de "impeccable / transitions" que tengas disponible): easing con curvas custom (nunca `ease` por defecto), duraciones por jerarquía, entradas/salidas asimétricas, interrupciones sin saltos.
5. **`frontend-design`**: dirección de arte distintiva, tipografía con carácter, composición con intención, cero estética genérica de "plantilla de IA".

Aplicá las cinco **de verdad**, no de nombre. Al final, en tu reporte, listá qué regla concreta de cada skill aplicaste y dónde.

### 1.2 Inspección del proyecto (hacela antes de editar)
Monorepo npm workspaces. App: `apps/web` (Next.js 15 App Router, React 19, Tailwind 4, `three@0.186`, `@react-three/fiber`, `gsap@3.15`, `framer-motion@12`, `motion`). Leé como mínimo:

- `apps/web/src/app/page.jsx` (orden de secciones: inicio, sobre-mi, proyectos, experiencia, titulos, habilidades, contacto) y `app/sobre-mi/page.jsx` (ruta existente: decidí con criterio si redirige a `/#sobre-mi` como se hizo con `/contacto`).
- **Todo** `apps/web/src/components/SobreMi/` (SobreMi.jsx tiene 681 líneas: entendé qué hace antes de matarlo: scroll por pantallas, imán a cada hito, autoplay, minimapa, teletransporte, embudo, tiempos por modelo, fallback `SobreMiPlano` sin WebGL), `lib/columna/`, `lib/teletransporte.js`, `lib/uniones.js`, `lib/tiempoModelo.js`, `lib/fondoHito.js`, `lib/seccionActual.js`, `hooks/useUnionSeccion.js`, `hooks/useEmbudo.js`, `hooks/useTema.js`, `hooks/useConsulta.js`.
- `components/Header/Header.jsx` (nav "Sobre mi", cómo detecta la sección actual), `components/UrlPorScroll/UrlPorScroll.jsx` (la URL sigue al scroll por secciones: **tiene que seguir funcionando**), `components/Proyectos/Proyectos.jsx` (para ver el patrón de montar WebGL sólo cerca del viewport en celular, `useEmbudo`, `data-en-proyectos`), `styles/globals.css` (tokens, tema claro/oscuro con `data-theme`, fuentes), `lib/sobreMi.test.js` y los demás tests `*.test.js` (el repo testea la lógica pura con `node --test`).
- `docs/DEV-LOCAL.md` (cómo correr el proyecto en Windows; el dev server ya suele estar en `http://localhost:3000`) y `docs/superpowers/specs/`.
- Qué otros archivos importan cosas de `SobreMi/` (hay referencias desde `Habilidades.jsx`, `Problematica.jsx`, `RayosX/FondoRayosX.jsx`, `RayosX/RevelarEsqueleto.jsx`, `Header.jsx`, `lib/seccionActual.js`). **Antes de borrar algo, grepeá quién lo usa** y mové lo que sea compartido a un lugar neutro.

Si hay `.codegraph/` en la raíz, usá CodeGraph antes de grep.

---

## 2. LA IDEA

**Un reel de portadas de hitos.** Una única experiencia inmersiva a pantalla completa donde el recorrido de vida de Felipe se muestra como una cinta curva de 7 "portadas web" suspendidas en 3D. Cada portada es la portada de **un hito** (una etapa de su vida), no de un proyecto. El protagonista visual de cada portada es una **ilustración isométrica hecha con `anatomy-asset`** (diorama sólido, limpio, con luz) en lugar de los modelos 3D de antes. Referencias del estilo (las imágenes que adjuntó el usuario): hero claro "Halden" con aerogenerador sobre isla de césped y tierra, tarjetas de 3 pasos con dioramas redondos, un diorama alargado tipo "campo → tablero eléctrico" con tira de métricas debajo, y hero oscuro "Aether" con avión sobre helipuerto en wireframe + sólidos grises + acento celeste, y una línea de ensamblaje oscura con líneas finas. Es decir: **dioramas isométricos sobre una base (losa/isla) con volumen real, material mate, un acento de color por pieza y sombras suaves.** Tomá el acabado, **nunca copies un objeto de esas referencias.**

La sensación a lograr: "esto no es un portafolio, es una pieza de diseño". Sobrio, cinematográfico, con aire, con detalle microscópico.

---

## 3. CONTENIDO (fuente única de verdad)

Todo el contenido sale de `apps/web/src/data/hitos.json` (7 hitos, ids 0 a 6). **No inventes datos ni reescribas su texto.** Se permite agregar campos nuevos al JSON (por ejemplo `escena`, `acento`, `etiquetaNav`) pero no cambiar lo existente. Una sola estructura de datos editable alimenta portada, texto y navegación.

Cada hito tiene `anio`, `titulo`, `resumen`, `descripcion` (con **negritas** en markdown: hay un helper `lib/resaltado.js` para partirlas), a veces `imagen` (`/hito1.jpg`, `/hito2.jpeg`, `/hito3.jpeg`, `/hito4.jpeg`, `/hito5.jpeg`, `/hito7.jpeg`), `foco`, `video` y `credito`.

Hitos y **concepto de diorama** propuesto (refinalo con criterio de arte; cada uno con acento de color propio pero dentro de una paleta coherente):

| # | Año | Título | Diorama isométrico (concepto) |
|---|-----|--------|-------------------------------|
| 0 | Origen | Quien repara y mejora | Banco de trabajo de electrónica: protoboard, multímetro, radio desarmada, soldador con humo, un LED que hace *beep* (parpadeo CSS). La "cosa que hacía beep". |
| 1 | 2022 | Abanderado e ingeniería | Mástil con bandera sobre una isla-pedestal de escuela, birrete, y un sendero que termina en un edificio universitario con escudo/placa "UTN". Un solo acento. |
| 2 | 2023 | Inglés y adelanto de materias | Pila de libros, certificado con sello (hay `public/cambridge-escudo.png` como referencia del sello), y una escalera de bloques-materia que sube salteando peldaños. |
| 3 | 2024 | Primeras experiencias | Mesa de laboratorio: motherboard AM4 abierta, pizarrón con diagrama de flujo, notebook con ventanas de freelance. Cuatro objetos pequeños que insinúen los 4 trabajos. |
| 4 | 2025 | Técnico y docente | Dos mitades en una sola base: taller técnico (PC abierta, impresora, celular en reparación) y aula con pizarrón; un detalle sutil de coctelera/bandeja por el bartender de fin de semana. |
| 5 | 2026 | Fullstack en MBRF | Línea de trazabilidad industrial: cinta con cajas y pallets, balanza, terminal data collector con pantalla, rack SAP, y cubos tipo nodos Kubernetes. Es el diorama "hero" más complejo (Scene, 120+ partes). |
| 6 | Hoy | Lo que viene | Sendero ascendente hacia un horizonte abierto: puerta o portal, brújula, mochila lista, plataforma que se extiende hacia afuera (inacabada a propósito). Mucho aire. |

**Tamaños según la skill:** Spot (25–50 piezas) o Asset (50–120) como regla; Scene (120+) sólo para el hito 5 y quizás el 3, justificando por qué. Cada SVG: presupuesto de peso razonable (apuntá a menos de 250 KB por hero, menos de 400 KB como máximo).

**Variantes de tema:** el sitio tiene modo claro y oscuro (`data-theme`). Construí **cada diorama en las dos versiones** (`node build.mjs` oscuro, `--light` claro, según la skill), diseñadas para el papel/tinta de cada tema, no un filtro de inversión.

**Las fotos reales** (`public/hito*.jpg|jpeg`): usalas como detalle editorial dentro de la portada (una foto pequeña, recortada con radio concéntrico, con el `foco` del JSON), no como fondo. Los videos `videohito4/5/6.mp4` ya no se usan en esta sección: no los borres de `public/`, avisame en el reporte. El crédito CC BY del modelo "motherboard am4" sólo sigue vigente si ese modelo se sigue mostrando; como ya no se usa, retiralo de la UI y mencionalo en el reporte.

---

## 4. ESPECIFICACIÓN DE LA ANIMACIÓN (contrato de movimiento: respetalo al pie de la letra)

Esta es la especificación base provista por el usuario, **adaptada**: donde dice "proyecto" leé "hito"; las portadas las generás vos (no uses las URLs de demo).

### 4.1 Composición
- Escenario a **viewport completo**, "papel cálido pálido" en tema claro y "tinta profunda" en oscuro, con **grano de puntos finísimos de 6 px** e iluminación suavemente variable (viñeta/degradé radial muy sutil, nunca banding). Respetá los fondos y colores existentes del sitio en cada tema.
- **Titular enorme, negro (claro) o hueso (oscuro), de dos líneas, tracking muy apretado, centrado DETRÁS de las tarjetas** y parcialmente tapado por ellas cuando se mueven. Texto sugerido, editable en un solo lugar: **"Así llegué / hasta acá."** (podés proponer una alternativa mejor en el reporte, pero entregá esta). Tipografía con carácter (mirá cómo están resueltos los títulos de las otras secciones del sitio y mantené la familia; si hace falta una serif/itálica de acento como en la referencia Halden, justificalo y cargala bien).
- Sobre el escenario sólo: el titular, las tarjetas y un hint inferior centrado "Scrolleá o arrastrá para recorrer" (en celular "Deslizá para recorrer"). Nada de logos, contadores grandes, flechas, botones de pausa ni modales.
- **Excepción justificada al "sin captions" de la referencia:** el contenido real del hito (año, título, descripción con negritas) tiene que poder leerse, porque en un portafolio el contenido manda. Resolvelo con **un bloque editorial discreto** (año + título + descripción corta) anclado en una esquina libre que cambia con crossfade/máscara por hito cuando la fase se asienta. Que se sienta parte del diseño, nunca un cartel pegado. Más una **regla de años muy fina y clickeable** (Origen · 2022 · 2023 · 2024 · 2025 · 2026 · Hoy) como navegación accesible; sin contador "3/7", sin flechas.
- **Tres tarjetas visibles a la vez en escritorio:** una grande al frente y de cara, otra más alta a la derecha, y una más angosta girando a la izquierda. Preservá el vacío y la profundidad cinematográfica. **Fase 0 de arranque: una tarjeta centrada** (Origen).
- La cinta es predominantemente horizontal: paso vertical (pitch) de **0.52 × la escala de la malla** y radio de pista horizontal generoso.

### 4.2 Portadas (texturas)
Cada textura es una **portada web completa de un hito**: tira de navegación mínima (año, "Sobre mí"), jerarquía tipográfica fuerte (año gigante o título), el **diorama isométrico** como héroe, la foto real como detalle editorial cuando exista, y un pie sobrio. Todo el texto de la portada es parte del arte. **Generación:** componé cada portada como SVG/HTML → rasterizá a canvas → `CanvasTexture` (esperá `document.fonts.ready` antes de rasterizar; cuidá aspecto 2.38:1.5771 sin deformar). Regenerá la textura al cambiar de tema. **Memoria:** ya hubo cierres de página en iPhone por exceso de capas 3D en este proyecto. Escritorio: texturas de hasta ~2048 de ancho; celular: ~1280 y un solo canvas, `devicePixelRatio` con tope. Montá el WebGL sólo con la sección cerca del viewport (IntersectionObserver con margen, como en `Proyectos.jsx`) y soltá todo al alejarse en celular.

### 4.3 Geometría 3D y movimiento (valores exactos)
- Three.js, **un solo canvas WebGL transparente** sobre el fondo. Cámara en perspectiva: **fov 65.7°, z = 8.1, near 0.1, far 40**.
- Cada plano de portada: **ancho 2.38, alto 1.5771, 48 segmentos horizontales y 24 verticales**.
- Curvado cilíndrico por vértice: `halfWidth = 1.19; angle = (x / halfWidth) * bend; radius = halfWidth / bend; x = sin(angle) * radius; z += (cos(angle) - 1) * radius`. **Bend base 0.30**, subiendo hasta **0.42** con input rápido. Sumá apenas **0.006 de ondulación vertical** lenta. Máscara de esquinas redondeadas por UV con **SDF antialiaseado** y sombreado sutil por curvatura. Texturas legibles y con aspecto correcto.
- `phase` = índice flotante amortiguado. Índice relativo envuelto a `[-N/2, N/2)`, `theta = relative * 0.73`. Posición: `x = sin(theta) * trackRadius`, `y = relative * pitch`, `z = cos(theta) * trackDepth - 0.28`. Orientación tangente: `rotationY = atan2(trackDepth * sin(theta), trackRadius * cos(theta))`, `rotateX = relative * -0.01`, más una inclinación contenida por velocidad. Ocultá las caras que miran hacia atrás. Orden de profundidad y transparencia de bordes correctos. Adaptá radio y profundidad al viewport: tarjeta central ≈ **37 % del ancho en escritorio y 77 % en celular**; en pantallas angostas **mantené el pitch vertical bajo** y dejá que las vecinas se recorten a los costados en vez de apilarse.
- Suavizado: `phase += (target - phase) * (1 - exp(-13 * dt))`, **dt limitado a 0.05 s**, impulso de rueda limitado para evitar saltos. Al soltar, **asentar al índice más cercano**.
- **Integración con el scroll de la página (decisión de arquitectura, importante):** el sitio ya hace scroll vertical entre secciones y sigue la URL con `UrlPorScroll`. No secuestres la rueda ni atrapes al usuario. Usá **GSAP ScrollTrigger con `pin` + `scrub`**: la sección queda fijada y el progreso del scroll mapea a la `phase` (mapeo de progreso conservado, sin autoplay arbitrario), con `snap` a cada hito. El primer y el último hito sueltan el scroll hacia las secciones vecinas de forma natural. Además: arrastre horizontal (izquierda avanza) o vertical hacia abajo en escritorio, swipe en táctil, flechas del teclado (un hito completo), `Home` vuelve al primero, `End` al último; todo se traduce a posición de scroll para que haya **una sola fuente de verdad**. Liberá `pointer capture` al cancelar. **Un click en una tarjeta no abre nada.**
- Actualizá la descripción accesible del canvas (`aria-label` / región `aria-live="polite"` visualmente oculta) con el hito actual.
- Verificá que `useEmbudo` (la sección se centra sola si el scroll se detiene cerca), `UrlPorScroll` y el estado activo del `Header` sigan coherentes. Si `useEmbudo` pelea con el pin, resolvelo (no lo desactives para las demás secciones).

### 4.4 Ciclo de vida y accesibilidad
- **Un solo `requestAnimationFrame`.** Frenar con `document.hidden`, con la sección fuera de pantalla (IntersectionObserver) y reanudar **sin acumular tiempo transcurrido**.
- `prefers-reduced-motion`: sin movimiento autónomo ni lean/flex; la navegación explícita funciona pero instantánea (sin amortiguado ni ondulación); los SVG animados quedan quietos. Recordá que el hook `useReducedMotion` difiere entre servidor y cliente: **usá el patrón con `montado` (ver `Buscador.jsx`) para no romper la hidratación**.
- **Sin WebGL o con error:** fallback accesible estático: una grilla/lista editorial de los 7 hitos con sus dioramas SVG y textos (reutilizá la idea de `SobreMiPlano` pero rediseñada, hermosa y usable). Debe ser real, no un placeholder.
- Liberá en el cleanup: geometrías, materiales, texturas, observers, listeners, ScrollTriggers y renderer. Sin fugas al navegar o cambiar de tema.
- SSR/hidratación limpios: **cero warnings de hydration** (el proyecto tuvo uno por `Math.random`/`matchMedia`; no repitas el error). `'use client'` donde corresponda y `three` en un chunk dinámico (`dynamic(..., { ssr: false })`) como ya se hace.
- Teclado, foco visible (sin inventar una tarjeta resaltada permanente), áreas táctiles ≥ 40×40, contraste AA, `lang`, textos con `text-wrap: balance/pretty`.

---

## 5. COREOGRAFÍA Y SENSACIÓN (acá se gana o se pierde)

- **Entrada de la sección** (GSAP timeline, una sola vez por visita, interrumpible): el titular se revela por líneas con máscara, el fondo de puntos respira, las tarjetas entran desde abajo con rotación y escalonado corto; el hint aparece al final. Duraciones por jerarquía (elemento grande más lento), curvas custom tipo `cubic-bezier(0.22, 1, 0.36, 1)`; **prohibido `ease` por defecto o `linear` salvo en movimientos continuos**.
- **Cambio de hito:** el bloque de texto sale con una máscara hacia arriba y entra el nuevo con stagger por línea; el diorama activo cobra vida con **una** micro-animación CSS propia (LED que parpadea, rotor, humo, escalera que se arma). Las demás portadas quedan quietas (máx. 2–3 cosas moviéndose en total).
- **Paralaje sutil** entre titular, tarjetas y grano en respuesta al puntero (muy contenido; apagado en táctil y reduced-motion).
- **Micro-detalles (`make-interfaces-feel-better`):** radios concéntricos, sombras en capas en lugar de bordes, `tabular-nums` en los años, alineación óptica, escala 0.97 al presionar la regla de años, transiciones interrumpibles (si el usuario scrollea a mitad de una animación nunca debe haber un salto), `will-change` sólo donde corresponde, nada que parpadee.
- Dentro de las portadas: un **destello de luz muy leve** que cruza la superficie curva según la fase (specular/curvatura) para vender el volumen. Sin exagerar.
- Rendimiento: 60 fps en un equipo medio, `Performance` sin long tasks al hacer scroll, sin layout thrash (leé y escribí el DOM por separado, usá `gsap.quickTo`/`quickSetter` para lo continuo).

---

## 6. IMPLEMENTACIÓN: reglas de oro

- Respetá convenciones del repo: JSX (no TS), CSS Modules (`*.module.css`), nombres de carpetas y archivos **en español** como el resto, comentarios en español explicando el "por qué", tokens de color y tema existentes (`data-theme`), `useTema`, `useConsulta`, alias `@/`.
- Estructura sugerida: `components/SobreMi/` renovado con piezas pequeñas y testeables (por ejemplo `ReelHitos.jsx`, `escena/` con la parte Three, `portadas/` con la composición de cada portada, `ilustraciones/` con los SVG generados + script de build, `lib/reel/` con la **lógica pura** (mapeo progreso↔fase, envoltura de índice relativo, posición/orientación por `theta`, bend por velocidad, snap) y **tests con `node --test`** como el resto de `lib/`).
- Guardá los **scripts de build de los SVG** (los `build.mjs` de anatomy-asset) dentro del repo, documentados, para poder regenerar o ajustar un diorama después. Los `.svg` finales van en `public/` (o `src/` si conviene importarlos), validados con `xmllint --noout`.
- Quitá el código muerto del recorrido anterior (`Columna3D`, `Escena3D`, `lib/columna`, `lib/teletransporte`, etc.) **sólo cuando la nueva sección esté verificada** y después de confirmar con grep que nadie más lo usa; si algo es compartido (por ejemplo lo que usan `RayosX` o `Habilidades`), movelo en vez de romperlo. Limpiá los modelos `.glb` de `public/modelos` que queden huérfanos **sólo si ningún otro componente los usa** (los de `RayosX` y otros pueden seguir en uso); ante la duda, no los borres y reportalo.
- Sin dependencias nuevas salvo que sean imprescindibles. `gsap` y `three` ya están. Si agregás algo, justificalo.
- Preservá lo que no es de esta sección: Header, tema, resto de secciones, rutas, CV, footer, scroll de URL.

---

## 7. VERIFICACIÓN (no la saltees: es la mitad del trabajo)

Corré el proyecto (`npm run dev:web`, ver `docs/DEV-LOCAL.md`; no asumas de quién es un puerto ocupado: verificalo) y usá el navegador (Claude in Chrome, o los scripts `apps/web/scripts/captura-*.mjs` como referencia) para comprobar con **capturas reales**:

1. Escritorio 1920×1080 y 1536×730; tablet 820; **celular 390** (y 360). Claro y oscuro. Sin scroll horizontal en ningún ancho.
2. Fase 0 con una sola tarjeta centrada y las 3 visibles al avanzar; titular detrás y ocluido; hint inferior.
3. Rueda, drag, swipe táctil (emulado), teclado (flechas, Home, End), regla de años clickeable, snap al hito más cercano, entrada y salida de la sección hacia las vecinas sin trabarse.
4. `prefers-reduced-motion` activado (la sección usable e instantánea, sin warnings de hidratación).
5. Sección fuera de pantalla: el rAF se detiene (comprobalo con un contador/`performance`); pestaña oculta; reanudar sin salto.
6. WebGL bloqueado/ausente: aparece el fallback estático hermoso.
7. Consola limpia (sin errores ni warnings de hydration), `next build` pasa, `node --test` pasa para los tests nuevos y los existentes, `xmllint` silencioso en cada SVG, y las **comprobaciones de la skill** (`capture.mjs` en cada tema y a 390 px, `lines.mjs` con `line ends: 0`, `--audit` con tuberías o cables).
8. Cleanup: navegá fuera y volvé varias veces y cambiá de tema; la memoria no crece (sin texturas ni geometrías huérfanas, ScrollTriggers matados).
9. Mirá **cada hito de cerca** (zoom 2×–4×) buscando uniones feas, líneas que no terminan en nada, texto cortado o aspecto deformado. Corregí hasta que no quede nada.

---

## 8. QUÉ ENTREGAR AL TERMINAR

Un reporte corto y honesto (sin inflar) con: qué hiciste y qué archivos, qué skills aplicaste y cómo, decisiones que tomaste (titular final, concepto de cada diorama, cómo resolviste el scroll pin vs. `useEmbudo`/`UrlPorScroll`), qué quedó sin verificar y por qué, qué archivos de `public/` quedaron huérfanos, y capturas de escritorio/celular en claro y oscuro. **No commitees.** Si algo no se pudo verificar, decilo tal cual.

Prioridades en orden si hay que elegir: (1) funciona sin romper el resto del sitio, (2) se ve extraordinario, (3) rinde bien en celular, (4) accesible, (5) código mantenible y testeado.
