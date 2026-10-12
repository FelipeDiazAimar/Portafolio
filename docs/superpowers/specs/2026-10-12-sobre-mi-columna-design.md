# Sobre mí: la columna vertebral 3D — diseño

Fecha: 2026-10-12 · Rama: `feature/sobre-mi-columna` (sale de `main` = 52f80e8)

## Objetivo

Reemplazar la línea de tiempo horizontal de "Sobre mí" por un **recorrido cinematográfico
por scroll**: la línea de tiempo es una **columna vertebral 3D con curva en S**, brillante,
con estela, y los 7 hitos están **alrededor** de ella en espiral. Al scrollear se viaja
por la columna en primera persona mientras se llena de luz; al llegar a un hito **la
columna gira sobre sí misma** hasta traerlo al frente, aparece su modelo 3D y después su
biografía.

**Decisiones del usuario** (no se discuten en la implementación):

- La línea de tiempo es lo único protagonista (no pista de circuito impreso).
- Columna 3D con brillos y estela, curva en S, hitos alrededor en distintos ángulos.
- Los modelos 3D viven **en el mismo mundo** que la columna (opción A), con un único canvas.
- Fondos: **mixto** — espacio oscuro durante el viaje; al llegar, la foto/video del hito
  aparece en fundido detrás.

**Éxito**: se siente cinematográfico y fluido (≥50 fps en una notebook con GPU integrada),
no marea, todo el contenido actual (7 escenas, títulos, bios, fotos, videos, créditos)
sigue presente, y funciona en celular, con movimiento reducido y sin WebGL.

**Fuera de alcance**: cambiar el contenido de `hitos.json`, rehacer escenas 3D, la
sección Proyectos (rama aparte, en curso).

## Parte 1 — El mundo y la "estación"

### La columna se mueve, la cámara llega siempre al mismo lugar

Todo el mundo cuelga de un grupo `Mundo`. Cuando el usuario está en un hito, `Mundo` está
trasladado y rotado de forma que **el modelo de ese hito queda en el origen, mirando a +z**,
y la cámara está en la **pose canónica** que ya usan las escenas actuales:
posición `(0, d·0.116, d·0.993)` mirando a `(0,0,0)`, con `d` = `vistaParaAltura(alto).distancia`
(`vista.js`, sin cambios). Así las escenas (OrbitControls, bandera, grafo con su picking en
pantalla) siguen funcionando sin conocer la columna.

Transformación de `Mundo` para un "estado" `s ∈ [0, N-1]` continuo (índice de hito
fraccionario):

```
Mundo = T(0, 0, -R) · Ry(-θ(s)) · T(-c(s))
```

Comprobación: `ancla(i) = c(i) + R·(sin θ, 0, cos θ)`; `T(-c)` lo deja en `R·(sin θ, 0, cos θ)`,
`Ry(-θ)` lo lleva a `(0, 0, R)` y `T(0,0,-R)` al origen. El +z local del modelo (hacia
afuera de la columna) queda apuntando a +z del mundo, hacia la cámara.

Implementado con dos grupos anidados: `pivote` (posición `(0,0,-R)` y `rotation.y = -θ(s)`)
y `contenido` (posición `-c(s)`), donde `c(s)` es el punto del eje de la columna a la altura
del hito (interpolado) y `θ(s)` el ángulo del hito (interpolado). En `s` entero `i`, el
ancla del modelo `i` queda exactamente en el origen mirando a +z.

### Geometría (módulo puro `lib/columna/geometria.js`)

Constantes exportadas (todas en unidades de escena):

| Constante | Valor | Qué es |
|---|---|---|
| `SEPARACION` | 9 | altura entre vértebras consecutivas |
| `RADIO_ANCLA` (R) | 3.5 | distancia del eje de la columna al centro del modelo |
| `PASO_ANGULO` | 140° (en radianes) | giro entre un hito y el siguiente |
| `AMPLITUD_S` | 1.4 | desplazamiento lateral máximo de la S |
| `RADIO_TUBO` | 0.06 | grosor del núcleo de la columna |
| `RADIO_HALO` | 0.2 | grosor del halo aditivo |

- `ejeEn(y)` → `{x, y, z}`: la curva en S. `x = AMPLITUD_S · sin(2π · y / (SEPARACION·(N-1)))`,
  `z = AMPLITUD_S · 0.5 · sin(π · y / (SEPARACION·(N-1)))`. Es una S suave en el espacio,
  no plana. `y` va de `-SEPARACION` (cola, antes del primer hito) a `SEPARACION·(N-1) + SEPARACION`
  (punta, después de Hoy).
- `vertebra(i)` → `{centro, angulo}`: `centro = ejeEn(i·SEPARACION)`, `angulo = i·PASO_ANGULO`.
- `ancla(i)` → posición del modelo: `centro + R·(sin(angulo), 0, cos(angulo))`, con el
  modelo rotado `angulo` en y (su +z local apunta hacia afuera de la columna).
- `curvaColumna(N)` → `THREE.CatmullRomCurve3` con 64 puntos de `ejeEn` (este sí importa
  three; vive en `components/SobreMi/Columna3D/curva.js`, no en `lib`).
- `longitudHasta(i)` → fracción `[0,1]` del largo de la curva a la altura de la vértebra
  `i` (para el llenado del shader).

### Archivos

Nuevos:

- `apps/web/src/lib/columna/geometria.js` — constantes y funciones puras de arriba.
- `apps/web/src/lib/columna/recorrido.js` — scroll → tramo → pose (Parte 2).
- `apps/web/src/lib/columna/recorrido.test.js`, `geometria.test.js` — node:test.
- `apps/web/src/components/SobreMi/Columna3D/` — `MundoColumna.jsx` (el Canvas),
  `Columna.jsx` (tubo + halo + shader), `Vertebras.jsx`, `Estela.jsx`, `Polvo.jsx`,
  `Estacion.jsx` (monta la escena de un hito en su ancla), `Silueta.jsx` (marcador de los
  hitos lejanos), `CamaraRecorrido.jsx`, `Efectos.jsx` (bloom), `curva.js`,
  `shaderColumna.js`.
- `apps/web/src/components/SobreMi/Minimapa.jsx` + `.module.css`.
- `apps/web/src/components/SobreMi/AnioViaje.jsx` + `.module.css` (el año que cuenta durante el viaje).
- `apps/web/src/components/SobreMi/SobreMiPlano.jsx` (respaldo sin WebGL, Parte 5).

Se reemplazan / eliminan:

- `SobreMi.jsx` se reescribe (Parte 4). `SobreMi.module.css` se reescribe.
- `LineaTiempo.jsx` + `.module.css`: se eliminan (la columna y el minimapa los reemplazan).
- `Escena3D/EscenaCanvas.jsx` y `Escena3D/Escena3D.jsx`: se eliminan; `MundoColumna` es
  el único canvas. `EscalaResponsiva`, `DistanciaCamara`, `ControlGiro`, `LucesAzules`,
  `useDesarme`, `PiezaDesarmable`, `LimiteErrores`, `soporteWebGL`, `vista.js` y todas las
  escenas se **conservan**.
- `lib/hitoActivo.js`: se elimina; sus tests en `lib/sobreMi.test.js` se reemplazan por
  los de `recorrido.test.js`.

Dependencia nueva: `@react-three/postprocessing@3.0.4` (+ su peer `postprocessing`),
compatible con `@react-three/fiber@9`.

## Parte 2 — Scroll, viaje y cámara

### Línea de tiempo de scroll (módulo puro `lib/columna/recorrido.js`)

El progreso de scroll `p ∈ [0,1]` de la sección se reparte en **N estancias** (peso 1) y
**N-1 viajes** (peso 1.4) alternados: `E0 V0 E1 V1 … E6`. Total de pesos
`W = N + 1.4·(N-1)` (= 15.4 con N = 7). El contenedor mide
`calc(100svh + W · 55svh)` en escritorio y `calc(100svh + W · 45svh)` en celular.

Funciones exportadas:

- `tramoDe(p, N)` → `{ tipo: 'estancia'|'viaje', indice, t }`. En estancia `indice` es el
  hito; en viaje es el hito de **origen** y `t ∈ [0,1)` el avance. `p` fuera de rango o
  `NaN` se acota a `[0,1]` (rebote elástico, como `hitoActivo.js`).
- `estadoDe(tramo)` → `s` continuo: estancia `i` → `i`; viaje `i` con `t` → `i + giro(t)`,
  con `giro(t) = suavizado(clamp((t - 0.15)/0.75, 0, 1))` y `suavizado` = smootherstep
  (`6t⁵-15t⁴+10t³`). Así el desplazamiento por la columna y **el giro** se concentran en el
  medio y el final del viaje, y la llegada frena suave.
- `activoDe(tramo)` → hito "activo" para montar escenas, fondos y textos: estancia `i` →
  `i`; viaje → `t < 0.5 ? i : i+1`.
- `llenadoDe(tramo, N)` → fracción `[0,1]` de la columna encendida: avanza linealmente con
  `t` dentro del viaje entre `longitudHasta(i)` y `longitudHasta(i+1)`; en estancia
  `longitudHasta(i)`.
- `progresoDeEstancia(i, N)` → `p` del centro de la estancia `i` (para saltar y para el imán).
- `imanDe(p, N)` → `p` de la estancia más cercana (centro), para el frenado.
- `poseCamara(tramo, d, opciones)` → `{ posicion:[x,y,z], mira:[x,y,z], fov, giroZ }`
  en **coordenadas de pantalla canónicas** (el mundo ya está transformado por `s`):
  - estancia: pose canónica (`fov = 38`, `giroZ = 0`).
  - viaje, tres actos sobre `t`:
    1. **Despegue** `t ∈ [0, 0.2)`: la cámara se aleja y sube — distancia `d → d·1.6`,
       altura `+1.5`, mira al origen. Se ve la columna entera, el hito actual y el siguiente.
    2. **Primera persona** `t ∈ [0.2, 0.8)`: la cámara se pega a la columna — se ubica a
       `1.4` del eje de la columna, en el punto de la "cabeza" de luz, un poco por detrás y
       mirando hacia adelante por la tangente de la curva (hacia la vértebra siguiente).
       `fov` sube de 38 a 55 (sensación de velocidad) y `giroZ` (alabeo) sigue la curvatura
       de la S, acotado a **±12°** (`opciones.alabeoMax`).
    3. **Llegada** `t ∈ [0.8, 1)`: interpola de la primera persona a la pose canónica del
       hito siguiente con smootherstep; `fov → 38`, `giroZ → 0`.
  - Las uniones entre actos y entre viaje/estancia son **continuas** (sin saltos): se
    verifica en los tests.

### Suavizado y frenado

- El `scrollYProgress` de framer-motion pasa por un `useSpring` (`stiffness 120,
  damping 30, mass 0.6`) antes de `tramoDe`: la rueda del mouse a saltos no se nota.
- **Imán**: 160 ms después del último evento de scroll (y sin dedo apoyado), si el progreso
  no está en el centro de una estancia, `window.scrollTo({ top, behavior: 'smooth' })` al
  `imanDe(p)`. Si el usuario estaba en un viaje con `t ≥ 0.35` avanza al siguiente hito; con
  `t < 0.35` vuelve al anterior (así un scroll corto "lanza" al siguiente). Con movimiento
  reducido el salto es instantáneo.
- La cámara la escribe `CamaraRecorrido` en `useFrame` con `THREE.MathUtils.damp`
  (λ = 6) hacia `poseCamara`, aplicando la `distancia` de `vistaParaAltura`.

### Quién controla la cámara

- **Estancia** (y la cámara ya llegó: error < 0.01): `ControlGiro` (OrbitControls) habilitado
  con `target = (0,0,0)`, con los límites del hito activo (`limiteDeGiro`, `esEscenaFija`).
  `CamaraRecorrido` no toca la cámara.
- **Viaje**: `controls.enabled = false`; `CamaraRecorrido` manda. Al salir de una estancia,
  si el usuario había girado el modelo, la cámara parte de donde estaba (el damp la lleva al
  despegue; no hay salto).
- El grafo de Hoy (`Grafo.jsx`) toma los controles con `tomarControles`. **Cambio requerido**:
  cuando su `activa` pasa a `false`, llama a `soltarControles()` (hoy sólo lo hace al
  desmontarse/soltar). `CamaraRecorrido` no empieza el viaje mientras `controls.giroLibre`
  sea `true` en el mismo frame (espera al siguiente).

## Parte 3 — Lo visual: columna, brillo, estela, fondos

### Columna (`Columna.jsx` + `shaderColumna.js`)

- Núcleo: `TubeGeometry(curva, 400, RADIO_TUBO, 12)` con `ShaderMaterial` propio,
  `toneMapped: false`. Uniforms: `uLlenado` (0–1), `uTiempo`, `uColor` (acento del tema,
  `--color-accent` leído del DOM), `uColorApagado`.
  - Tramo encendido (`vUv.x < uLlenado`): color acento × 2.2 (supera el umbral del bloom) +
    "pulsos de energía" que suben: `0.35 · pow(0.5+0.5·sin(40·vUv.x - 6·uTiempo), 8)`.
  - **Cabeza**: en `vUv.x ≈ uLlenado` un destello blanco (`exp(-pow((vUv.x-uLlenado)/0.004, 2))`)
    × 4.
  - Tramo apagado: `uColorApagado` con alfa 0.18 (translúcido).
- Halo: segundo tubo `RADIO_HALO`, `AdditiveBlending`, `depthWrite: false`, mismo shader
  con intensidad 0.25 (da el "resplandor" incluso sin bloom).

### Vértebras (`Vertebras.jsx`)

Por hito: un `torus` (radio 0.42, tubo 0.035) perpendicular a la tangente de la curva,
más una "costilla": línea fina (`Line` de drei, ancho 1.5 px) del centro de la vértebra al
ancla del modelo. Estados: apagada (alfa 0.25), **encendida** cuando `uLlenado` la pasa
(acento × 2, se enciende con un flash de 300 ms) y **activa** (pulso de escala 1→1.08 y
brillo, período 2.4 s).

### Estela (`Estela.jsx`)

- Un punto de luz (esfera 0.09, blanca × 4) que sigue la cabeza del llenado sobre la curva.
- `Trail` de drei sobre ese punto (`width 0.6, length 6, decay 1.2, attenuation t²`, color
  acento): la estela que deja la cabeza al moverse.
- Chispas: `Points` con un pool de 240 partículas (aditivas, tamaño 0.05 atenuado) que
  nacen en la cabeza con velocidad radial aleatoria (0.2–0.6) y viven 1.2 s. Sólo se emiten
  mientras la cabeza se mueve (velocidad > umbral).

### Ambiente (`Polvo.jsx`, `MundoColumna.jsx`)

- 1 200 partículas de polvo en un cilindro alrededor de la columna (radio 2–12), parpadeo
  lento, aditivas, alfa 0.35. Con parallax natural por estar en el mundo.
- `fog` exponencial (`FogExp2`, densidad 0.035) del color de fondo: los hitos lejanos se
  pierden en la oscuridad.
- Fondo del canvas transparente (`alpha: true`); detrás, la capa de fondos (abajo).

### Bloom (`Efectos.jsx`)

`EffectComposer` + `Bloom` (`mipmapBlur`, `luminanceThreshold 0.9`, `luminanceSmoothing
0.2`, `intensity 1.1`, `radius 0.7`). Tema claro: `intensity 0.45` y el color apagado de la
columna pasa a gris medio. Se apaga por rendimiento (Parte 5).

### Fondos (mixto)

`FondoHito` se conserva y queda **debajo** del canvas, con una prop nueva `presente`
(boolean). Su contenedor tiene `opacity: presente ? 1 : 0` con transición de 900 ms
(entrada) / 400 ms (salida), más un degradé oscuro encima (`radial-gradient` del color de
fondo, 55 % de opacidad en el centro) para que el mundo 3D se lea.
`presente = tramo.tipo === 'estancia' && llegó hace ≥ 400 ms`. El video del hito se pausa
cuando `presente` es `false` y sólo se monta para el hito activo, como hoy.
Durante el viaje se ve el espacio oscuro: `--color-bg` en escritorio oscuro, y en tema
claro un gris azulado muy claro (`color-mix(in oklab, var(--color-bg) 92%, var(--color-accent))`).

## Parte 4 — Escenas en el mundo, textos y navegación

### Estaciones (`Estacion.jsx`)

Un grupo por hito en `ancla(i)` con `rotation.y = angulo(i)`. Adentro va, según la
distancia al activo `a = activoDe(tramo)`:

- `|i - a| ≤ 1` → la escena real (`lazy(cargadorEscena(id))` con `Suspense`), envuelta en
  su propio `ProveedorDesarme` y `EscalaResponsiva`. Prop `activa = (i === a && tramo.tipo
  === 'estancia')`: los vecinos se ven pero quietos (las escenas ya respetan `activa`).
- `|i - a| > 1` → `Silueta`: un icosaedro alámbrico (radio 0.9) con el color acento, alfa
  0.35, que gira despacio, y el año como `Text` de drei debajo. Se ve de lejos al viajar.
- Al entrar en un viaje se precarga la escena del hito de destino y del siguiente
  (`cargadorEscena(id)()` y `useGLTF.preload` de sus modelos) para que al llegar ya esté.
- `EscalaResponsiva`: en escritorio el modelo ocupa su mitad de pantalla, por eso recibe
  `ancho = 4.2` medido contra `viewport.width / 2`; en celular contra `viewport.width`.
  (Se agrega la prop `fraccion` = 0.5 | 1 a `EscalaResponsiva`.)
- El desarme (`PiezaDesarmable`) se usa sólo para la **salida**: al empezar un viaje la
  escena de origen se "dispersa" (desarmado = true) mientras la cámara despega, igual que el
  `MS_SALIDA` actual. Ya **no** se desarma para mostrar la bio: el modelo y el texto están
  en mitades distintas de la pantalla y no se tapan.

### Lados alternados

- Hito par → **modelo a la izquierda, texto a la derecha**; impar → al revés.
- Se logra con `camera.setViewOffset(ancho, alto, desplazamiento, 0, ancho, alto)` con
  `desplazamiento = ±0.22·ancho` (signo según el lado), interpolado con damp (λ = 4) para que
  al viajar el encuadre se deslice al otro lado. Se recalcula al cambiar el tamaño. Como el
  desplazamiento es de proyección, el picking del grafo (`project()`) sigue siendo correcto.
- Celular (≤ 768 px): sin lados; `setViewOffset` vertical para que el modelo quede en el
  55 % de arriba y el texto debajo.

### Textos (DOM sobre el canvas)

Una capa `.textos` en la mitad opuesta al modelo (o abajo en celular):

- `EncabezadoHito` (sin cambios) aparece al **llegar** (estancia, 400 ms después), con
  fundido y desplazamiento de 24 px desde el lado de la columna.
- `DescripcionHito` (bio a trazo, sin cambios): se abre **sola** cuando el modelo cumplió
  su `tiempoModeloMs(id)` dentro de la estancia (se mantiene la regla "primero el modelo,
  después la bio"). Ya no depende del hover: no hay línea de tiempo DOM que apuntar y el
  modelo no se tapa.
- Al empezar un viaje, encabezado y bio se van (300 ms) y se resetean por hito (`key`).
- El texto real sigue en el DOM para lectores de pantalla (`BioDibujada` ya lo garantiza).
- Se eliminan: `detalleAbierto`, `alApuntar`, `refQuiereTexto`, `refModeloMostrado`, el
  botón "×" de celular (ya no hace falta cerrar nada).

### Año del viaje (`AnioViaje.jsx`)

Durante el viaje, centrado y enorme (`clamp(4rem, 14vw, 11rem)`, peso 800, contorno con el
acento, relleno 8 % de opacidad): el año **cuenta** del origen al destino según `t` (entre
`0.2` y `0.8`). Si alguno no es numérico ("Origen", "Hoy") muestra el de origen hasta
`t = 0.5` y el de destino después. Opacidad: 0 → 1 en `t ∈ [0.1, 0.25]`, 1 → 0 en
`[0.75, 0.9]`. `aria-hidden`.

### Minimapa (`Minimapa.jsx`)

- Fijo en el borde derecho de la sección (en celular, abajo a la derecha, más chico), un
  SVG vertical de 28 × 220 px con la S de la columna dibujada como `path` (de los mismos
  puntos de `ejeEn`, proyectados en 2D), el tramo recorrido en acento y el resto en
  `--color-border`.
- Un `button` por hito sobre su punto, con `aria-label="{anio} — {titulo}"` y
  `aria-current="step"` en el activo; al hacer click (o Enter) llama a `irAlHito(i)` =
  `window.scrollTo` a `progresoDeEstancia(i)`.
- Tooltip con el año al pasar el mouse o con foco.
- Un marcador (círculo 6 px con brillo) sigue el progreso continuo.
- Es un `nav` con `aria-label="Línea de tiempo"`: reemplaza a la línea de tiempo anterior
  para teclado y lectores de pantalla.

### Contenedor (`SobreMi.jsx` + `.module.css`)

Misma estructura de sticky que hoy: `section#sobre-mi.contenedor` alto (Parte 2) y un
`.panel` sticky de `100svh` con, de atrás hacia adelante: `FondoHito`, `MundoColumna`
(absoluto, `inset: 0`), `AnioViaje`, `.textos`, `Minimapa`, y la etiqueta "Sobre mí".
Un solo `useScroll` + `useSpring`; un `useMotionValueEvent` calcula `tramo` y sólo hace
`setState` cuando cambian `activoDe`, `tramo.tipo` o el índice (el resto viaja por refs a
los `useFrame`, sin renders de React por frame).

## Parte 5 — Celular, accesibilidad, rendimiento, errores y pruebas

### Celular (≤ 768 px o `pointer: coarse`)

- Mismo recorrido, con `alabeoMax = 0`, `fov` máximo 46 y la primera persona a 2.2 del eje
  (menos vértigo).
- Modelo arriba, texto abajo (`.textos` como hoja inferior con `max-height: 42svh` y
  scroll interno, `overscroll-behavior: contain`).
- OrbitControls conserva `touch-action: pan-y` (`ControlGiro`), así el gesto vertical
  sigue scrolleando la página.
- El imán espera a que no haya dedos apoyados (`touchend` + 160 ms).

### Movimiento reducido (`prefers-reduced-motion: reduce`)

- Sin viaje: `estadoDe` salta (escalón) al hito activo, la cámara queda en la pose
  canónica, sin alabeo, sin cambio de `fov`, sin chispas ni pulsos (el shader recibe
  `uTiempo` fijo).
- El cambio de hito es un fundido de 400 ms del canvas (opacidad 1 → 0 → 1) en vez del giro.
- `AnioViaje` no se muestra; las escenas reciben `reducido` como hoy.

### Sin WebGL o con error

- `hayWebGL()` falso o `LimiteErrores` atrapa un error (incluye pérdida de contexto real,
  con la misma lógica de `EscenaCanvas` para ignorar la pérdida forzada al desmontar) →
  se renderiza `SobreMiPlano`: lista vertical normal (sin sticky) de los 7 hitos, cada uno
  con foto, `EncabezadoHito`, `EscenarioHito` (respaldo ASCII existente) y la bio en texto
  plano. Mismo `id="sobre-mi"`.

### Rendimiento

- Canvas: `dpr={[1, 1.75]}`, `frameloop` `'always'` sólo mientras la sección está en
  pantalla (IntersectionObserver como hoy), `'never'` fuera.
- `PerformanceMonitor` de drei con escalones: 1) apaga el bloom (queda el halo aditivo);
  2) chispas 240 → 60 y polvo 1 200 → 400; 3) `dpr` 1. Nunca vuelve a subir en la sesión.
- Sólo 3 escenas reales montadas a la vez (activo ± 1); los vecinos con `activa = false`.
- El video de fondo se pausa durante el viaje.
- `useGLTF.preload` de destino y siguiente al empezar cada viaje.

### Pruebas

`node:test` (como el resto, `npm test` en `apps/web`):

- `geometria.test.js`: `vertebra(i).angulo = i·PASO_ANGULO`; `ancla(i)` a distancia
  `RADIO_ANCLA` del eje en el plano xz; `ejeEn` continua y con `|x| ≤ AMPLITUD_S`;
  `longitudHasta` creciente, `0 < longitudHasta(0)` y `longitudHasta(N-1) < 1`.
- `recorrido.test.js`:
  - `tramoDe(0)` = estancia 0; `tramoDe(1)` = estancia N-1; `NaN`/negativos/ >1 acotados.
  - Los pesos suman `W`; `progresoDeEstancia(i)` cae en la estancia `i` con `t = 0.5`.
  - `estadoDe` es monótono no decreciente en `p` y vale entero en toda estancia.
  - **Continuidad**: para 2 000 `p` equiespaciados, `poseCamara` y `estadoDe` no saltan
    más que un umbral entre muestras vecinas (incluye las uniones de los tres actos).
  - Alabeo acotado a `alabeoMax`; con `alabeoMax = 0` siempre 0.
  - `imanDe`: viaje con `t ≥ 0.35` → estancia siguiente; `t < 0.35` → anterior.
  - `activoDe` cambia en `t = 0.5`.
  - `llenadoDe` monótono y igual a `longitudHasta(i)` en la estancia `i`.
- Se eliminan los tests de `hitoActivo.js`; los demás de `sobreMi.test.js` y
  `escena3d.test.js` deben seguir pasando.

Verificación visual (Chrome headless por CDP, `--use-angle=swiftshader`, como en la
iteración anterior): capturas en cada estancia (7) y en `t = 0.1, 0.5, 0.9` de dos viajes;
sin errores en consola; en cada estancia el modelo del hito está del lado correcto y la
bio aparece después de `tiempoModeloMs`; con `prefers-reduced-motion` emulado no hay
viaje; sin WebGL (`--disable-webgl`) se ve `SobreMiPlano`. `next build` sin errores.

## Riesgos y cómo se mitigan

- **Escenas que asumen "su" canvas**: la bandera calcula su borde superior con la altura
  del canvas (`vistaParaAltura(alto).mitadAlto`): sigue valiendo porque el canvas nuevo
  ocupa todo el alto del panel, como el actual. El grafo usa la cámara global: cubierto con
  el cambio de `activa` → `soltarControles`. Cualquier otra escena que lea `useThree().size`
  o `viewport` se revisa al migrarla.
- **Tres escenas montadas a la vez**: mayor uso de memoria; si una escena pesa demasiado
  se baja a "activo + destino" (2) — se mide en la verificación.
- **Mareo**: alabeo ±12°, fov ≤ 55, aceleración con smootherstep, frenado por imán.
- **Ramas**: la sección Proyectos está en curso en `feature/proyectos` con cambios sin
  commitear; esta rama sale de `main` y no toca esos archivos (`page.jsx` sólo si hace
  falta, y se mergea después de Proyectos).

## Orden de implementación (para el plan)

1. Módulos puros `geometria.js` y `recorrido.js` con sus tests (TDD).
2. `MundoColumna` con columna, vértebras, cámara y siluetas de prueba en todas las
   estaciones + minimapa + año del viaje + imán (sin escenas reales).
3. Brillo y estela: shader, halo, bloom, chispas, polvo, niebla, `PerformanceMonitor`.
4. Migrar escenas una a una a `Estacion` (0 → 6, el grafo último) con la carga activo ± 1.
5. Textos, lados alternados, fondos mixtos.
6. Celular, movimiento reducido, `SobreMiPlano`.
7. Eliminar `LineaTiempo`, `EscenaCanvas`, `Escena3D`, `hitoActivo.js`; verificación
   visual completa y build.
