# Experiencia: el pasillo 3D

Guía para tocar la sección **Experiencia** sin romperla. Explica cómo está armada, dónde se cambia
cada cosa y qué hay que revisar después. El código también tiene comentarios en cada archivo; esta
guía es el mapa.

> Escrita el 22/11/2026, con el estado del commit `0b92365` en `main`.

---

## 1. Qué es

Cada trabajo es un **pasillo en primera persona**. Se recorre con el scroll (la página "camina" por
un camino fijo) o en **modo libre** (WASD + mouse). Al final de cada pasillo hay un giro hacia el
siguiente trabajo; al final del último, una puerta que se abre a una luz blanca que funde con la
página.

Además:

- **Construcción en tiempo real** (estilo igloo.inc): lo que está adelante es un esqueleto 3D de
  líneas blancas que se vuelve sólido baldosa por baldosa; lo que queda atrás se desarma.
- **Paleta**: todo en negro, blanco y los dos colores del trabajo.
- **Objetos interactivos** en vitrina (luz, borde encendido, marcas de escaneo). Al tocarlos, la
  cámara va frente a ellos y se abre una tarjeta con el caso del proyecto.
- Alrededor de cada objeto interactivo hay **cosas relacionadas con él**; en el resto, cosas de la
  temática del pasillo.
- **Radar** como minimapa, **pósters** en los vestíbulos, **fondo aurora**, efecto **holograma +
  lente** en los bordes.
- **Modo rendimiento** (toggle del sitio) que apaga lo caro.

---

## 2. Mapa de archivos

Todo vive en `apps/web/`.

| Archivo | Qué hace |
| --- | --- |
| `src/data/experiencia.js` | **Los datos**: trabajos, objetos interactivos (título, texto, modelo, lado, proyecto), colores y proyectos de cada etapa. Es lo primero que se toca. |
| `src/data/pasilloAssets.js` | Modelos y texturas de **Poly Haven** por pasillo (roles: estante, piso, mueble, pared, techo). |
| `src/lib/pasillo.js` | **Geometría del recorrido**: largo de cada pasillo, giros, el camino de la cámara (rectas + curvas) y funciones para ir de "metros recorridos" (`s`) a posición. Tiene tests. |
| `src/components/Experiencia/Experiencia.jsx` | **Componente React**: sección sticky, scroll → `s`, puntos con tooltip, tarjeta, modo libre (pointer lock, teclas), radar, marcas de escaneo, chips de controles. |
| `src/components/Experiencia/EscenaPasillo.js` | **La escena three.js**: arma los pasillos, carga modelos, cámara, foco, luces, postprocesado, vitrinas, pósters, puerta final, modo rendimiento, precompilado. Expone una API (sección 4). |
| `src/components/Experiencia/relleno.js` | **Relleno procedural**: estanterías, muebles, objetos generados por temática, relación objeto ↔ entorno, dónde va cada modelo real. |
| `src/components/Experiencia/construccion.js` | **Construcción/desarme** en el shader de cada material (esqueleto, baldosas, ventana de obra por pasillo). |
| `src/components/Experiencia/paleta.js` | **Paleta** (negro/blanco + acentos) y borde encendido de los objetos interactivos, también en shader. |
| `src/components/Experiencia/efectosPasillo.js` | **Postprocesado propio**: un solo pase con barril, aberración cromática, holograma y grano. |
| `src/components/Experiencia/fondos.js` | **Fondo** (esfera con shader). Hoy fijo en `aurora`; hay otros modos guardados. |
| `src/components/Experiencia/objetosTooltip.js` | Objetos interactivos "realistas" armados a mano (placa, gabinete, celular, vidriera de Algo Bonito/Calida, asistente IA con holograma, auto a escala, notebook, impresora). |
| `src/components/Experiencia/modelos.js` | Resto de los objetos interactivos (pizarrón, diagrama, pupitres, monitor, balanza, cajas, tablero, rack, equipo) y el mapa `CONSTRUCTORES` nombre → función. |
| `src/components/Experiencia/recursos.js` | Carga de GLB y texturas PBR (con caché, corrección de escala y vidrio sin transmisión). |
| `src/components/Experiencia/atlas.js` | Atlas de etiquetas (las que llevan cajas, carpetas, etc.). |
| `src/components/Experiencia/DetalleObjeto.jsx` | **Tarjeta** de un objeto (problema, solución, métricas, stack, proyectos de la etapa, navegación ← →). |
| `src/components/Experiencia/MapaRadar.jsx` | **Radar** (canvas 2D). |
| `src/components/Experiencia/Joystick.jsx` | Joystick táctil del modo libre. |
| `src/components/Experiencia/ExperienciaPlana.jsx` | Versión sin 3D (sin WebGL, y lista para lectores de pantalla). |
| `src/components/Experiencia/Experiencia.module.css` | Todos los estilos de la sección. |
| `src/lib/rendimiento.js`, `src/hooks/useRendimiento.js`, `src/components/RendimientoToggle/` | **Modo rendimiento** del sitio. |
| `public/pasillo/` | Assets descargados: `m/*.glb`, `t/*.webp`, `indice.json` (medidas reales de cada modelo). |
| `scripts/assets-pasillo.mjs` | Baja y optimiza assets de Poly Haven. |
| `scripts/verificar-experiencia.mjs`, `scripts/perfilar-experiencia.mjs` | Capturas y mediciones con Chrome sin pantalla. |

---

## 3. Cómo fluye todo

```
experiencia.js ──► armarRecorrido() (lib/pasillo.js) ──► recorrido { pasillos, tramos, largo, comienzos }
                                                              │
Experiencia.jsx ── scroll → s (metros) ──► escena.irA(s) ─────┤
                                                              ▼
                                   EscenaPasillo.js (por pasillo):
                                     estructura (piso, paredes, techo)
                                     objetos interactivos + vitrina
                                     rellenarPasillo() (relleno.js) → plan de modelos reales
                                     construccion.obra(i) + paleta
                                   cada cuadro: cámara, zonas visibles, luces,
                                   construcción, render, proyecciones → alCuadro()
                                                              │
Experiencia.jsx ◄── alCuadro({ proyecciones, s, camara, … }) ◄┘
  mueve puntos/tooltips, radar, marcas de escaneo, luz final
```

- **`s`** = metros recorridos sobre el camino de la cámara (0 … `recorrido.largo`). Todo se mide
  en `s`: el scroll, el radar, qué pasillo es el actual, la construcción.
- La sección mide `100svh + largo × SVH_POR_METRO` (`SVH_POR_METRO = 6`, en `Experiencia.jsx`).
  Más alto = el pasillo se recorre más lento con la rueda.
- **Zonas**: sólo se dibujan (y cargan) el pasillo actual y sus vecinos. Los modelos reales se
  cargan por pasillo con una cola que gasta ~4 ms por cuadro y se muestran recién con sus shaders
  compilados.

---

## 4. API de la escena (`crearEscenaPasillo`)

Se crea en `Experiencia.jsx` con `{ lienzo, trabajos, recorrido, tema, alCuadro, alPerder, alSoltar, alIrA }`.

| Método | Para qué |
| --- | --- |
| `irA(s, inmediato)` | Mueve la cámara al punto `s` (lo llama el scroll). |
| `enfocar(i)` / `soltar()` | Mira el objeto interactivo `i`: la cámara va al centro del pasillo frente a él (avisa con `alIrA(s)` para mover la página). |
| `objetoEn(x, y, radio)` | Objeto bajo el puntero (px del lienzo) o `-1`. |
| `entrarLibre()` / `salirLibre()` | Modo libre. |
| `caminar({ adelante, lado, correr })`, `girarMirada(dx, dy)`, `empujar(n)` | Movimiento en modo libre. |
| `resaltar(i)` | Contorno al pasar el mouse. |
| `objetoCentro()` | Objeto en la mira (modo libre). |
| `acercar(activo)` | Zoom con el botón derecho. |
| `mirar(x, y)` | La mirada sigue un poco al puntero en modo scroll. |
| `fijarTema(nombre)`, `fijarRendimiento(bool)`, `tamano(w, h)`, `arrancar()`, `frenar()`, `destruir()` | Lo de siempre. |

En desarrollo, la escena queda en `window.__escenaPasillo` y el renderer en `window.__rendererPasillo`.

---

## 5. Recetas: cambios comunes

### 5.1 Cambiar un texto, un título o el proyecto de un objeto

`src/data/experiencia.js`. Cada objeto:

```js
{
  modelo: 'auto',          // pieza 3D (ver 5.4)
  lado: 'der',             // pared: 'izq' o 'der'
  titulo: 'Neifert Automotores',
  texto: '…',
  proyecto: 'neifert',     // slug de data/proyectos.json (opcional)
  stack: ['kubernetes'],   // ids de data/tecnologias.js (sólo si no hay proyecto)
  puntos: ['…'],           // hitos sueltos (opcional)
}
```

- Si hay `proyecto`, la tarjeta toma de `proyectos.json`: portada, logo, problema, solución,
  contexto, métricas, funcionalidades, stack y enlaces.
- **Regla del proyecto**: sólo datos reales. Nada de relleno inventado.

### 5.2 Agregar o quitar un objeto interactivo

1. Agregarlo (o borrarlo) en `objetos` del trabajo, en `experiencia.js`.
2. El largo del pasillo se recalcula solo: `MARGEN_INICIO + (n − 1) × SEPARACION + MARGEN_FINAL`
   (en `lib/pasillo.js`).
3. Si el `modelo` es nuevo, ver 5.4.
4. Correr los tests (`node --test src/lib/*.test.js`) y mirar el pasillo (sección 8).

### 5.3 Agregar o quitar un trabajo (pasillo entero)

1. Agregar el trabajo en `TRABAJOS` (`experiencia.js`): `id`, `periodo`, `puesto`, `lugar`,
   `resumen`, `acento`, `paleta: [acento, segundo]`, `proyectos: [...]`, `objetos`.
2. El `id` tiene que existir en:
   - `AMBIENTES` de `pasilloAssets.js` (texturas y modelos de Poly Haven);
   - `TEMAS` y `RELACION` de `relleno.js` (objetos generados y relación con los interactivos);
   - `LUZ` de `EscenaPasillo.js` (color e intensidad de las luces);
   - `POSTERS` de `EscenaPasillo.js` (opcional);
   - `ANCHO_PISO` de `relleno.js` (lo que se pone en el piso).
3. Bajar los assets (5.6).
4. El último trabajo de la lista es el que tiene la puerta final.

### 5.4 Crear la pieza 3D de un objeto interactivo

- Las piezas están en `objetosTooltip.js` (las "realistas") y `modelos.js`. Se registran en
  `CONSTRUCTORES` (`modelos.js`) con el nombre que se usa en `modelo`.
- Una pieza devuelve `{ grupo, ancla, animar?, reales? }`:
  - `grupo`: el objeto, apoyado en el piso y con el frente hacia **+z** (la pared queda detrás, en z ≈ 0);
  - `ancla`: punto (local) donde va el tooltip;
  - `animar(t)`: opcional, se llama cada cuadro (holograma, ventiladores…);
  - `reales`: modelos de Poly Haven que la pieza usa (se reservan para que no se repitan en el relleno).
- Recibe el color del pasillo (`acento`) como parámetro.
- En `relleno.js`, `HUECOS[modelo] = [ancho, desde, hasta]` reserva el lugar en la pared (sin
  estantes ahí). Igual se mide la pieza: si es más grande, manda la medida real.
- Agregar una entrada en `RELACION` (5.5) para que tenga cosas relacionadas alrededor.

### 5.5 Cambiar qué cosas hay alrededor de cada objeto

`RELACION` en `relleno.js`:

```js
freelance: {
  auto: { reales: [], items: [FREE.autitos, FREE.llaves, FREE.tarjetero, FREE.telefono], piso: ['old_tyre'] },
  …
}
```

- **Cerca** de un objeto interactivo (en su pared hasta 1,9 m del borde de su hueco, o enfrente
  hasta 1 m: `focoDe()`), estantes, muebles y piso usan sus `reales` e `items`.
- **Lejos** se usa la temática: `TEMAS[id].items` y los modelos de `pasilloAssets` que no están en
  ninguna `RELACION`.
- Los `reales` tienen que estar también en `pasilloAssets.js`, porque si no, no se bajan.
- Los objetos generados (`items`) son funciones `(S, u, y, p, hmax, ctx) => anchoUsado`, dentro de
  `LAB`, `DOC`, `FREE`, `TEC` y `MB`. `S` es un "pintor" que dibuja cajas, cilindros, esferas,
  toros y etiquetas sobre una pared. Si devuelven `0`, no entran. `MAXIMO` limita cuántas veces
  se repite cada uno en un pasillo.

### 5.6 Agregar modelos o texturas de Poly Haven

1. Buscar el id en https://polyhaven.com (licencia CC0).
2. Agregarlo en `AMBIENTES` de `pasilloAssets.js`, en el rol que corresponda. **Regla**: ningún
   modelo se repite entre pasillos.
3. Bajarlo:

   ```bash
   cd apps/web
   node scripts/assets-pasillo.mjs id_1 id_2
   ```

   Lo optimiza (meshopt + WebP), lo deja en `public/pasillo/m/` y anota sus medidas reales en
   `public/pasillo/indice.json`.
4. Revisar las medidas en `indice.json`. Los muy grandes (más de ~1,2 m de ancho o de fondo para el
   piso) no entran en el pasillo. Algunos vienen en otra escala (ej. `steel_frame_shelves_01` ×10):
   `recursos.js` lo corrige con esas medidas.
5. Si se saca un modelo de la lista, borrar su `.glb` para no subir peso de más.

### 5.7 Cambiar colores

- **Color de un trabajo**: `acento` (tarjeta, radar, carteles, vitrinas) y `paleta: [principal, segundo]`
  (objetos) en `experiencia.js`.
- **Cómo se aplica la paleta**: `paleta.js`.
  - Lo neutro pasa a la escala de grises.
  - Lo de color vivo toma el acento más parecido en tono.
  - La estructura queda neutra con un tinte leve.
  - Los objetos interactivos toman más acento y tienen un borde encendido.
- **Color de las luces** por pasillo: `LUZ` en `EscenaPasillo.js`.

### 5.8 Ajustar la construcción / desarme

En `construccion.js`:

| Constante | Hoy | Qué cambia |
| --- | --- | --- |
| `ADELANTE` | 10 m | Cuánto se arma por delante de la cámara. |
| `ALCANCE` | 3 m | Cuánto esqueleto se ve más allá de cada frente. Más grande = se anticipa lo lejano, como la pared del fondo. |
| `BALDOSA` | 2,5 / m | Tamaño de las baldosas que se materializan (40 cm). |
| `RETICULA` | 5 / m | Densidad de las líneas del esqueleto (20 cm). |

- Velocidad del frente: `acercar()` dentro de `cuadro()`.
- **Desarme hacia atrás**:
  - con scroll es instantáneo (`desde = avance − 4.5`, siempre fuera de cuadro);
  - en modo libre es animado y sigue la mirada.
- Cada material de un pasillo se prepara con `construccion.aplicar(objeto, i, demora, { destacado })`.
  La estructura usa `demora` 0 y se arma primero; el resto usa 1,2.
- **Ojo**: un material compartido entre pasillos se clona. Algo que no deba construirse lleva
  `userData.sinConstruccion = true` (ej. la esfera de luz final).

### 5.9 Cambiar el recorrido (largos, giros, espacios)

En `lib/pasillo.js`:

| Constante | Hoy | Qué es |
| --- | --- | --- |
| `ANCHO`, `ALTO` | 4,4 / 3,2 m | Sección del pasillo. |
| `MARGEN_INICIO`, `SEPARACION`, `MARGEN_FINAL` | 3,2 / 2,4 / 4,6 m | Antes del primer objeto, entre objetos, después del último. |
| `VESTIBULO` | 2,6 m | Tramo libre después de cada giro (con pósters). |
| `ANTESALA` | 2,4 m | Tramo libre antes de la puerta final. |

Después de cambiarlas, correr los tests: `node --test src/lib/*.test.js`.

### 5.10 Pósters

`POSTERS` en `EscenaPasillo.js`, dos por pasillo:

- **Uno por pared del vestíbulo.** En el primer pasillo, en la pared de atrás.
- **Tipos**:
  - `imagen`: captura de un proyecto, apaisada dentro de una ventana de navegador (`url` es lo que muestra la barra);
  - `lamina`: `'pc'`, `'pasos'`, `'codigo'` o `'flujo'`.
- Debajo de cada póster del vestíbulo hay un mueble bajo (`rellenarPasillo` en `relleno.js`).

### 5.11 Tarjeta, radar, chips y tooltip

- **Tarjeta**: `DetalleObjeto.jsx`, con los estilos `.detalle*` del CSS.
- **Radar**: `MapaRadar.jsx` (`TAM`, `RADIO`, `ESCALA`).
- **Chips del modo libre** (`Experiencia.jsx`):
  - "H Ver controles" (estado `verControles`, estilo `.ayudaLibre`);
  - la tecla E bajo la mira (`.avisoMira[data-tecla]`).
- **Marcas de escaneo**: `dibujarEscaneo()` en `Experiencia.jsx` y `puntosDeEscaneo()` en la escena.

### 5.12 Efectos de pantalla y fondo

- **Lente y holograma**: `efectosPasillo.js`, uniforms `curva`, `aberracion` y `rapidez`. Es un solo
  pase. El resto del postprocesado (oclusión ambiental N8AO, bloom, contorno, tonos, viñeta, SMAA)
  está en `EscenaPasillo.js`, sección "postprocesado".
- **Fondo**: `fondos.js`. Se cambia en `cielo.fijar('aurora')` dentro de `EscenaPasillo.js`. Opciones:
  `ninguno`, `vacio`, `noche`, `plano`, `aurora`, `atardecer`.

---

## 6. Rendimiento

- **Modo rendimiento** (toggle arriba a la derecha):
  - lo guarda `localStorage['portafolio:rendimiento']`;
  - el `<script>` de `app/layout.jsx` pone `html[data-rendimiento]` antes de que arranque nada;
  - el evento `portafolio:rendimiento` lo aplica en vivo.
- **Qué apaga**:
  - **En el pasillo**: postprocesado y sombras, y la resolución queda en 1× como máximo.
  - **En todo el sitio**: los lienzos 3D quedan a 1× (`densidadPixeles()` de `lib/rendimiento.js`). Los desenfoques de vidrio se quitan (CSS en `styles/globals.css`).
  - **Escena nueva**: tiene que usar `densidadPixeles(max)` en su `setPixelRatio`.
- **Resolución adaptativa**: si los cuadros pasan de ~21 ms, baja la densidad de píxeles hasta
  ~55 %; si sobra margen un rato, la sube (`ajustarResolucion`).
- **Sombras**: se recalculan sólo cuando la cámara se mueve, y cada 8 cuadros.
- **Precompilado**: los shaders del pasillo de más adelante se compilan de a uno, en momentos libres
  del navegador y con la cámara quieta (`precompilar`).
- **Vidrio**: sin transmisión (costaba un render extra por cuadro). Es transparente común.
- **Referencias medidas** con GPU real: scroll completo con mediana ~9 ms y p99 ~15 ms; en reposo,
  90–140 fps. Varía bastante con la carga de la máquina: medir varias veces.

---

## 7. Accesibilidad y casos borde

- **Sin WebGL**: se muestra `ExperienciaPlana`. Los lectores de pantalla tienen la lista
  completa del recorrido.
- **`prefers-reduced-motion`**: el pasillo aparece construido de entrada, sin animación de obra.
- **Celular**: tarjeta como hoja inferior, joystick en modo libre, sin toggle de rendimiento (igual
  que el de tema).
- La sección tapa la anterior (`z-index: 8`) y se funde con ella (`useUnionSeccion`).

---

## 8. Verificar un cambio

### Tests

```bash
cd apps/web
node --test src/lib/*.test.js
```

### Capturas (Chrome sin pantalla, contra el dev server)

```bash
# desde la raíz; GPU=1 usa la placa de video real (sin eso es lentísimo)
GPU=1 BASE_URL=http://127.0.0.1:3001 PUNTOS=0.05,0.4,0.8 ESPERA=7000 SALIDA=./capturas \
  node apps/web/scripts/verificar-experiencia.mjs
```

Variables útiles:

| Variable | Qué hace |
| --- | --- |
| `PUNTOS` | Fracciones del recorrido a capturar (0 … 1). |
| `ESPERA` | ms de espera en cada punto. Con poco, se ve la construcción a medias. |
| `MOVIENDO=1` | Captura en movimiento. |
| `CLIC3D=px` | Toca un objeto en 3D (en vez de su punto) al final. |
| `FLECHAS=n` | Con la tarjeta abierta, pasa `n` objetos con →. |
| `LIBRE=1` | Prueba el modo libre. Chrome sin pantalla no deja tomar el mouse, así que no sirve para la mira ni la E. |
| `RENDIMIENTO=1` | Arranca con el modo rendimiento. |
| `BARRIDO=1` | Mide los cuadros de un scroll completo (mediana, p95, p99, cuadros lentos). |
| `INSPECCIONAR=1` | Lista las mallas más grandes (sirve para cazar modelos en mala escala). |
| `REDUCIDO=1` | Emula `prefers-reduced-motion`. |
| `TEMA=light` | Tema claro. |
| `movil` (argumento) | Viewport de celular. |

Para perfilar una zona (funciones, draw calls, programas de shader):

```bash
ASENTAR=8000 DURACION=4000 node apps/web/scripts/perfilar-experiencia.mjs 0.2
```

### Trampas conocidas

- **Errores falsos del dev server**: justo después de guardar un archivo, recompila. Las mediciones dan 0–5 fps falsos y a veces la página
  responde 500 o con `ChunkLoadError`. Esperar y repetir.
- **`next build` y `next dev`** comparten `.next`: frenar el dev server antes de buildear.
- **Warning `X4122` de shaders**: es de ANGLE/D3D y no es un error.
- **Avisos "trabajo lento … poblar/agregar"**: son de la cola de carga, que avisa cuando una
  tarea pasa de ~30 ms. No son errores, pero si crecen mucho conviene mirarlos.

---

## 9. Decisiones tomadas (para no volver atrás sin querer)

- **Datos reales**:
  - sólo información real de los trabajos y proyectos;
  - nada de objetos interactivos de relleno ("Material propio", "Taller"…);
  - nada de TV vieja para "Instalación de equipos".
- **Nada repetido entre pasillos**, y lo menos posible dentro de uno.
- **Nada encimado ni atravesado**: hay un ensayo de cada objeto antes de dibujarlo, reservas en el
  piso, medida real de los objetos interactivos y `HUECOS`.
- **Simetría**: los cruces son simétricos (listones a ambos lados) y el final del último pasillo es
  una antesala simétrica con puerta doble.
- **Sin vaivén de cámara con el scroll** (sólo en modo libre).
- **Fondo aurora y efecto holograma + lente**: elegidos por Felipe entre varias opciones.
- **"Profesor de ingreso" en verde** (`#8fd14f`), distinto del verde de laboratorio.
