# Sobre mí: línea de tiempo con scroll fijado — Diseño

## Objetivo

Reemplazar el placeholder de la sección `sobre-mi` (hoy un `<h2>` en `app/page.jsx`) por una pieza a pantalla completa que queda **fija** mientras el usuario scrollea. Ese scroll no desplaza la página: avanza una línea de tiempo con 7 hitos de la vida profesional de Felipe. Cada hito cambia la imagen de fondo y, al hacer hover, revela una descripción ampliada con palabras clave resaltadas.

Es el sub-proyecto **1 de 3** de la sección:

1. **Estructura (este documento):** sección fija, scroll falso, hilo, hitos, fondos y descripción.
2. **Escenas 3D (futuro):** un modelo WebGL por hito, hecho en código (partículas, wireframe), luces azules, que se desarma al hacer hover. Aquí queda un marcador de posición.
3. **Intro (futuro):** el retrato ASCII se desarma con física (`ColapsoFisico`) y sus caracteres arman la minibio antes de que arranque el hilo.

Éxito: se siente una pieza cinematográfica y fluida, coherente con el resto del sitio (ASCII, vidrio, texto descifrado), usable en celular y con `prefers-reduced-motion`.

## Alcance

- `apps/web/src/components/SobreMi/SobreMi.jsx` + `.module.css` (nuevo): contenedor alto, panel sticky, progreso y estado del hito activo.
- `apps/web/src/components/SobreMi/LineaTiempo.jsx` + `.module.css` (nuevo): el hilo y sus puntos.
- `apps/web/src/components/SobreMi/FondoHito.jsx` + `.module.css` (nuevo): imagen de la derecha con difuminado y crossfade.
- `apps/web/src/components/SobreMi/DescripcionHito.jsx` + `.module.css` (nuevo): panel de descripción con palabras resaltadas.
- `apps/web/src/components/SobreMi/EscenarioHito.jsx` (nuevo): hueco del modelo 3D; hoy un marcador de posición.
- `apps/web/src/data/hitos.json` (nuevo): contenido de los hitos.
- `apps/web/src/lib/resaltado.js` (nuevo): convierte `**palabra**` en fragmentos de texto. Sin React.
- `apps/web/src/app/page.jsx` (modificado): la sección `sobre-mi` renderiza `SobreMi`.
- `apps/web/public/hitos/` (nuevo): imágenes de fondo, `hito-0.jpg` … `hito-6.jpg`.

Fuera de alcance: el modelo 3D, la intro del retrato, las secciones restantes.

## Nomenclatura

Español: `SobreMi`, `LineaTiempo`, `FondoHito`, `DescripcionHito`, `EscenarioHito`, `hitoActivo`, `progreso`, `dividirResaltado`.

## Estructura y scroll

`SobreMi` renderiza un contenedor con altura `calc(100svh + N * 70svh)` (N = cantidad de hitos). Adentro hay un panel `position: sticky; top: 0; height: 100svh` que contiene todo lo visual. El progreso del scroll del contenedor (`useScroll` de framer-motion, `offset: ['start start', 'end end']`) se traduce a `hitoActivo = min(N - 1, floor(progreso * N))`.

Se usa scroll nativo, no secuestro de rueda: la rueda, el táctil, el teclado y `BarraScroll` funcionan sin código extra, y al terminar el contenedor el scroll sigue hacia Proyectos.

**Salida del ancho de `<main>`.** `main` tiene `max-width: 960px`. El contenedor se centra con `width: 100vw; margin-left: calc(50% - 50vw)`, sin tocar el `<main>` del resto del sitio. `html` ya tiene `overflow-x: hidden`, así que `100vw` no genera barra horizontal.

## Layout (escritorio)

```
┌──────────────────────┬─────────────┬───────────────────────┐
│  EscenarioHito       │ difuminado  │  FondoHito            │
│  (hueco del 3D)      │ imagen → bg │  con LineaTiempo      │
│  año + título        │             │  encima               │
│  hover: descripción  │             │                       │
└──────────────────────┴─────────────┴───────────────────────┘
```

- Izquierda (~45 %): `EscenarioHito`, con el año grande y el título descifrados con `TextoDescifrado`.
- Derecha (~55 %): `FondoHito`; la imagen se difumina hacia `var(--color-bg)` en **tres bordes**: a la izquierda (hacia el escenario), arriba y abajo. Se logra con dos `mask-image` combinados con `mask-composite: intersect` (uno horizontal y uno vertical: `linear-gradient(to bottom, transparent, #000 18%, #000 82%, transparent)`), así funciona en tema claro y oscuro sin duplicar estilos y la imagen se funde con el resto de la página al entrar y salir de la sección.
- `LineaTiempo` va sobre la imagen, a la derecha.

## LineaTiempo

Una cinta vertical con los N puntos. La cinta se traslada para que el punto activo quede centrado; los vecinos se ven atenuados y los lejanos desaparecen. Cada punto muestra año y título. El activo brilla en azul y el tramo recorrido del hilo se ilumina. Los puntos son `<button>`: clic → scroll suave a su tramo; foco por teclado → abre la descripción igual que el hover.

## FondoHito

Todas las imágenes están montadas; el crossfade (~700 ms) cambia la opacidad de la activa. Cada imagen tiene un zoom lento (Ken Burns, `transform: scale` de 1 a 1,06) mientras es la activa. Las imágenes se precargan para que el cambio no parpadee.

## DescripcionHito y hover

- Hover sobre el escenario, el año o el punto activo → el escenario se desarma y aparece la descripción larga. Al salir, la descripción se oculta y el escenario se rearma.
- Mientras el 3D no exista, el marcador de posición es un bloque de caracteres que se disuelve y reaparece.
- Las palabras clave se marcan en el JSON con `**palabra**`; `dividirResaltado` las separa del resto y se renderizan con el tratamiento de `TextoBrillante`.
- Celular: sin hover; ver la sección "Celular" para los dos estados.
- `prefers-reduced-motion`: sin zoom, sin desarme, sin crossfade largo; la descripción simplemente aparece y desaparece.

## Celular

Tiene dos estados, que se alternan por toque:

**Estado inicial.** La `LineaTiempo` está **centrada** y la imagen de fondo del hito activo ocupa toda la pantalla, difuminada arriba y abajo hacia el color del tema. No se ve el escenario ni la descripción.

**Estado detalle** (al tocar un hito). La `LineaTiempo` se desliza y se **alinea a la derecha**; la imagen desaparece. A la izquierda se ve el `EscenarioHito` (el modelo 3D, cuando exista) y **debajo la descripción** del hito, con las palabras resaltadas. La transición es una animación de ~400 ms.

**Volver al estado inicial.** Tocar la `LineaTiempo` (fuera de un punto) o una "×" chica en la esquina del panel. El gesto de la línea es el pedido original; la "×" existe porque ese gesto no es descubrible.

**Scroll en el estado detalle.** El scroll fijado sigue funcionando: al pasar al hito siguiente, el panel de detalle se actualiza con el nuevo hito, sin volver al estado inicial.

El estado detalle se guarda como `detalleAbierto` (booleano) en `SobreMi`. En escritorio ese estado no existe: se usa el hover descrito arriba.

## Datos: `hitos.json`

Cada hito: `{ id, anio, titulo, resumen, descripcion, imagen }`. `descripcion` admite `**resaltado**`. Contenido inicial (a corregir por el autor):

| id | anio | titulo | contenido |
|----|------|--------|-----------|
| 0 | Origen | Quien repara y mejora | El sueño de ser quien **soluciona**: reparar, mejorar y proyectar sistemas para que las cosas sean más fáciles. Pasión por **cada cosa que hacía beep**. |
| 1 | 2022 | Abanderado e ingeniería | **Abanderado** del Instituto San Francisco de Asís (ISFA, San Francisco, Córdoba). Ese mismo año empieza **Ing. en Sistemas de Información** en la **UTN San Francisco**. |
| 2 | 2023 | Inglés y adelanto | Certificación **First (Cambridge)**, en el EPI. **Adelanta materias**, lo que le deja tiempo libre para empezar todo lo que vino después. |
| 3 | 2024 | Experiencia | **Ayudante de laboratorio** en la UTN (reparación, instalación y desarme de equipos). **Profesor de ingreso** de Programación (Python, C, diagramas de flujo, lógica). Primeros trabajos **freelance**: JustPhones, Calidad Esencia, AlgoBonitoSV, AsistenteInteligente. |
| 4 | 2025 | Técnico y docente | **Técnico informático** en Darío Martínez Computación (PC, notebooks, impresoras, celulares). Profesor de ingreso con **más de 90 alumnos**. Web de Darío Martínez Computación. Fines de semana, **bartender y mozo** en boliches y eventos. |
| 5 | 2026 | Fullstack en MBRF | **Desarrollador fullstack** en **MBRF** (San Jorge): **sistemas de trazabilidad industrial** para plantas y centros de distribución del frigorífico, con **SAP**, **Kubernetes** y coordinación de equipos. Freelance con **Neifert Automotores** y Darío Martínez, sumando **compañeros de la facultad** para que ganen experiencia. **4.º año** de la carrera. |
| 6 | Hoy | Lo que viene | Busco una **nueva oportunidad** para crecer y seguir desarrollándome en lo que me apasiona. |

## Errores y casos borde

- Imagen que no carga: el fondo cae al color del tema; el texto sigue legible.
- `hitos.json` vacío: la sección no se renderiza.
- Redimensionar la ventana durante la animación: el cálculo del hito activo depende solo del progreso, así que se recompone sin estado extra.

## Pruebas

- `dividirResaltado` (función pura): casos con cero, uno y varios `**`, y `**` sin cerrar.
- Verificación visual en el navegador: escritorio y celular, ambos temas, `prefers-reduced-motion`, scroll de entrada y salida de la sección, hover/foco/toque.
