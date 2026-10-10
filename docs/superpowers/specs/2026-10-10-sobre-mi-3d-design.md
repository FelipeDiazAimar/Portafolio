# Sobre mí: escenas 3D por hito — Diseño

## Objetivo

Reemplazar el bloque ASCII provisorio de `EscenarioHito` por **un modelo 3D por hito**, hecho en código con WebGL: grande, girable con el mouse o el dedo, con luces azules, y que **se desarma** al hacer hover (o al tocar, en celular) para dejar lugar a la descripción. Es el sub-proyecto **2 de 3** de la sección "Sobre mí" (ver `2026-10-10-sobre-mi-linea-tiempo-design.md`).

Éxito: los 7 modelos se leen como una serie con la misma firma visual (azul luminoso), giran con fluidez, no pesan en la carga inicial de la página y, si WebGL no está disponible, el visitante sigue viendo algo correcto (el bloque ASCII actual).

## Decisiones tomadas

- **`three` + `@react-three/fiber` + `drei`.** Los modelos son componentes React declarativos, encajan con el resto del código y `drei` ya trae controles y luces. Se descartaron: `three` puro (hay que escribir a mano toda la conexión con el estado de React) y video o animación pregrabada (no se puede girar).
- **Un solo `<Canvas>` para toda la sección**, que renderiza **sólo la escena del hito activo**. Al cambiar de hito, la saliente se dispersa y la entrante se arma.
- **Carga diferida.** Todo el código de `three` vive en un chunk aparte (`next/dynamic`, `ssr: false`) que sólo se pide cuando la sección se acerca al viewport. No suma peso a la carga inicial.
- **Respaldo.** Si no hay WebGL, o el chunk o el canvas fallan, se muestra el `EscenarioHito` ASCII actual. Nunca queda un hueco.
- **Entrega incremental.** Una escena por vez. Los hitos que todavía no tengan escena siguen mostrando el ASCII.
- Sin Tailwind, sin TypeScript. CSS Modules, JSX plano, identificadores y comentarios en español.

## Alcance de este diseño

Cubre la infraestructura compartida y el catálogo de las 7 escenas. Se implementa por tandas (ver "Entrega"): la primera tanda es la infraestructura más la escena del origen. Cada escena posterior tiene su propio plan corto.

Fuera de alcance: la intro del retrato que se desarma (sub-proyecto 3), sonido, postprocesado pesado (bloom) y modelos descargados (`.glb`).

## Estructura de archivos

Todo bajo `apps/web/src/components/SobreMi/Escena3D/`:

- `Escena3D.jsx` — punto de entrada (client). Decide si hay WebGL, observa si la sección está cerca del viewport, carga el canvas de forma diferida y renderiza el respaldo ASCII cuando corresponde. Props: `hito`, `desarmado`.
- `EscenaCanvas.jsx` — el `<Canvas>`, las luces, los controles y la escena activa. Es lo único que importa `three`.
- `LucesAzules.jsx` — rig de luces compartido (luz ambiente tenue, luz clave azul, luz de contorno cian).
- `ControlGiro.jsx` — giro con arrastre; sin zoom ni desplazamiento; giro automático lento cuando nadie lo toca.
- `PiezaDesarmable.jsx` — envuelve una pieza con su posición armada y su posición dispersa; interpola según `desarme` (0 = armada, 1 = dispersa).
- `useDesarme.js` — hook que lleva `desarmado` (booleano) a un valor continuo `desarme` con resorte.
- `materiales.js` — materiales compartidos (cuerpo oscuro, emisivo azul, vidrio) para que todo se vea como una serie.
- `pantallaCanvas.js` — crea un `CanvasTexture` a partir de un `<canvas>` 2D para dibujar pantallas (notebook, pizarrón, etc.).
- `soporteWebGL.js` — detección de WebGL (función pura sobre un contexto inyectable).
- `escenas/index.js` — registro `{ [idDeHito]: () => import('./EscenaN.jsx') }`. Un hito sin entrada usa el respaldo.
- `escenas/EscenaPrueba.jsx` — escena mínima (un cubo desarmable) para validar la infraestructura antes de la primera escena real.
- `escenas/Escena0Notebook.jsx`, `Escena1Bandera.jsx`, `Escena2Materias.jsx`, `Escena3PC.jsx`, `Escena4Banco.jsx`, `Escena5Planta.jsx`, `Escena6Constelacion.jsx` — una por hito.

Modificados: `SobreMi.jsx` y `SobreMi.module.css` (nuevo layout de la columna izquierda), `EscenarioHito.jsx` (pasa a ser sólo el respaldo).

## Contrato de una escena

Cada `EscenaN.jsx` es un componente con props `{ desarme, activa }` y se dibuja dentro del `<Canvas>` ya configurado:

- `desarme` (número de 0 a 1): cuán dispersa está la escena. Lo usan las `PiezaDesarmable`.
- `activa` (booleano): si el hito está activo. Permite pausar animaciones internas cuando no.

La escena no conoce hover, scroll ni layout. Esa responsabilidad es de `SobreMi` y `Escena3D`.

## Layout

Columna izquierda, de arriba hacia abajo: año, título y resumen (como hoy), y debajo el modelo, que ocupa **todo el alto restante** del panel. En escritorio el modelo es varias veces más grande que el bloque ASCII actual. La descripción se superpone al modelo y se muestra cuando el modelo se desarma (hover), igual que hoy.

En celular el modelo es más chico (alto limitado) y la descripción va debajo, como ya está definido para el estado detalle.

## Giro, scroll y táctil

- El canvas usa `touch-action: pan-y`: el scroll vertical de la página pasa de largo y sólo el arrastre horizontal gira el modelo. Esto hay que confirmarlo en un dispositivo real.
- En escritorio, el arrastre con el mouse gira el modelo. Mientras se arrastra, el hover sigue abierto (el cursor sigue sobre la columna).
- El giro automático lento se detiene mientras se arrastra y se retoma unos segundos después de soltar.

## Rendimiento y accesibilidad

- El render se pausa (`frameloop: 'never'`) cuando la sección no está visible, y funciona por demanda cuando no hay animación.
- Densidad de píxeles limitada a `[1, 2]`.
- Geometría simple, instancias para las piezas repetidas (teclas, personas, cajas), sin postprocesado.
- `prefers-reduced-motion: reduce`: sin giro automático, sin animación de arranque; las escenas muestran su estado final y el desarme es un cambio simple.
- El canvas es decorativo (`aria-hidden`); el contenido textual del hito ya está en el DOM.

## Catálogo de escenas

Estilo común: cuerpos oscuros con detalles emisivos azules (`#5b8cff`) y contorno cian, sobre fondo transparente (se ve el fondo de la sección). Cada escena tiene un estado "armado" y uno "disperso" por pieza.

0. **Origen — notebook.** Una notebook abierta. Las teclas se hunden mientras la pantalla (textura de canvas) recorre: apagada → arranque con un logo estilizado de cuatro paneles y un indicador de carga → escritorio con barra de tareas → una terminal que se abre → comandos que se escriben letra por letra, sincronizados con las teclas. Los comandos son `whoami` y una línea final alusiva al origen. Desarme: base, tapa y teclas se dispersan.
1. **2022 — bandera y portal.** Una bandera argentina flameando en su asta (ondulación de vértices), con una forma simplificada del sol. Al girar el modelo se revela un portal con el **símbolo de la UTN** extruido con volumen. El símbolo se reconstruye como forma vectorial a partir de la imagen entregada: dos arcos enfrentados, unidos por una barra vertical central y una barra horizontal.
2. **2023 — materias y Cambridge.** Una grilla de tarjetas con nombres de materias que se van tildando una a una. Al final quedan **las dos cosas a la vez**: las materias tildadas y el sello de Cambridge (First) brillando sobre ellas.
3. **2024 — PC desarmada.** CPU, RAM, disco y fuente flotando, que se arman y se desarman en bucle lento. Es el hito que mejor encaja con la mecánica de desarme. El diseño fino se define viéndolo.
4. **2025 — banco de trabajo.** Una notebook abierta, un destornillador, una placa madre con LEDs y herramientas alrededor. El diseño fino se define viéndolo.
5. **2026 — planta isométrica.** Una planta low-poly con cintas transportadoras; las cajas pasan bajo un escáner y se convierten en un código de trazabilidad que sube hacia un nodo SAP.
6. **Hoy — constelación.** Miniaturas de los modelos de los 6 hitos anteriores, orbitando y unidas por líneas de luz azul.

## Entrega

1. **Tanda 1 — infraestructura + escena del origen.** Dependencias, `Escena3D`, canvas diferido, luces, giro, desarme genérico, respaldo ASCII, nuevo layout, escena de prueba y `Escena0Notebook`.
2. **Tandas siguientes — una escena por tanda**, en este orden: 1 bandera y portal, 3 PC desarmada, 2 materias, 4 banco, 5 planta, 6 constelación.

Cada tanda se puede publicar sola: los hitos sin escena siguen con el ASCII.

## Dependencias

`three`, `@react-three/fiber` y `@react-three/drei`. Las versiones exactas se fijan en el plan después de verificar la compatibilidad con React 19 y Next 15. `SVGLoader` viene dentro de `three` (`three/examples/jsm/loaders/SVGLoader.js`).

## Errores y casos borde

- Sin WebGL o contexto perdido: respaldo ASCII. Si el contexto se pierde en caliente, se vuelve al respaldo.
- Falla la carga del chunk: respaldo ASCII, sin error visible.
- Cambio rápido de hito (scroll): sólo la última escena queda montada; la anterior se desmonta tras su animación de salida.
- Redimensionar o girar el celular: el canvas se ajusta a su contenedor (`ResizeObserver` de `fiber`).
- Pestaña oculta: el render se detiene.

## Pruebas

- Funciones puras con `node --test`: detección de WebGL con contexto inyectado, la máquina de estados de la pantalla de la notebook (qué se muestra en cada instante del arranque y qué texto lleva la terminal), la interpolación del desarme y el cálculo de posiciones dispersas.
- Verificación visual en el navegador: cada escena armada y desarmada, el giro con mouse, el respaldo (forzando la ausencia de WebGL), tema claro y oscuro, `prefers-reduced-motion` y celular.
- El repo no tiene test runner; no se agrega uno.
