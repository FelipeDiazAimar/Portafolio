# Retrato en ASCII al hover — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar a la derecha de la capa `inicio` una foto grande que, al cargar la página, se escribe primero como ASCII carácter por carácter y recién después aparece como foto; de ahí en más, pasarle el mouse la convierte a ASCII con un barrido circular que nace donde entró el cursor, y al salir vuelve a la foto con un barrido que nace donde salió.

**Architecture:** Dos capas superpuestas dentro de un marco: la foto (`next/image`) abajo y un `<canvas>` con el ASCII arriba. El canvas se pinta **una sola vez** (y otra vez si cambia el tema); ninguna animación lo repinta. La intro se anima con un `clip-path` en forma de L y el barrido con una máscara `radial-gradient` — las dos son propiedades CSS animadas desde `requestAnimationFrame`, no redibujos.

**Tech Stack:** React 19 / Next.js 15 (App Router), JSX (sin TypeScript), CSS Modules, Canvas 2D. Sin dependencias nuevas.

## Global Constraints

- Sin TypeScript — `.jsx` / `.js` plano. CSS Modules únicamente.
- **No se instala Tailwind, PostCSS ni shadcn.** El componente de Aceternity que motivó esto no expone ninguna prop de hover ni de revelado desde un punto (se verificó su API: `animationStyle` sólo acepta `fade`, `typewriter`, `matrix`, `none`), así que el barrido hay que escribirlo a mano igual.
- Identificadores y comentarios en español: `RetratoAscii`, `convertirAAscii`, `medirRatioMonoespaciado`, `luminanciaDeColor`, `leerColoresDelTema`, `pintarAscii`, `recorteDeEscritura`, `refMarco`, `refLienzo`, `refUltimoInterior`, `origenBarrido`, `radioMaximo`.
- **El repo no tiene suite de tests.** La verificación de cada tarea es `cd apps/web && npm run build` (0 errores) más la comprobación manual en el navegador que indica cada tarea. La Task 1 crea un módulo que todavía no es alcanzable desde la UI: ahí la única verificación posible es que compile. No agregar test runner, framework de tests ni scripts de npm.
- La imagen es `apps/web/public/Yo.png`, PNG RGBA de 433×577 con el alfa realmente en uso (54,6 % de píxeles casi transparentes: viene recortada). Se referencia por ruta pública `'/Yo.png'`, nunca con import estático desde `public/`.
- `DEMORA_INICIO_MS` vale 3300 en `RetratoAscii`, el mismo valor que en `NombreAscii`: es lo que hace que las dos intros arranquen juntas.
- El canvas se dimensiona con `devicePixelRatio` (`lienzo.width = ancho * dpr`, `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`).
- Todo lo nuevo es decorativo: el hero entero ya está `aria-hidden="true"`, la foto va con `alt=""` y el canvas con `aria-hidden`.
- Los dos gates NO cubren lo mismo: `(hover: hover) and (pointer: fine)` gatea sólo el barrido (un dispositivo sin mouse igual ve la intro); `prefers-reduced-motion: reduce` gatea todo (la foto se muestra directamente y el canvas nunca se pinta).
- Los valores numéricos son puntos de partida, a ajustar a ojo en el navegador.
- Refinamiento sobre la spec: la spec fijaba el marco en `70vh` y lo ocultaba bajo 768 px. Se corrige a una altura con `clamp` y breakpoint de 1024 px, porque a 769 px el nombre (`min(90vw, 42rem)`) más el retrato más los paddings no entran en el ancho disponible.

---

### Task 1: Conversión de imagen a ASCII

**Files:**
- Create: `apps/web/src/components/RetratoAscii/conversionAscii.js`

**Interfaces:**
- Consumes: nada (JS puro sobre APIs del navegador).
- Produces:
  - `RAMPA` (string, 10 caracteres de menos a más tinta) y `UMBRAL_ALFA` (number)
  - `medirRatioMonoespaciado()` → number
  - `convertirAAscii(imagen, { columnas, invertida })` → `{ columnas, filas, celdas }`, con `celdas` un array plano de largo `columnas * filas` indexado como `celdas[fila * columnas + columna]`
  - `luminanciaDeColor(css)` → number 0..1
  - `leerColoresDelTema()` → `{ colorTexto, colorFondo, invertida }`
  - `pintarAscii(ctx, ascii, ancho, alto, colorTexto, colorFondo)` → void

- [ ] **Step 1: Crear `conversionAscii.js`**

```js
// Rampa de menos a más "tinta". Sólo ASCII imprimible: los bloques Unicode
// caen en el rectángulo de carácter faltante en varias monoespaciadas, cosa
// que este proyecto ya se comió con el campo del nombre.
export const RAMPA = ' .:-=+*#%@';
// Por debajo de este alfa se considera fondo recortado y la celda queda vacía.
export const UMBRAL_ALFA = 96;

// Ancho de un carácter monoespaciado relativo a su alto. Hace falta para que
// la grilla no deforme la foto: la celda de muestreo tiene que tener la misma
// proporción que el carácter que después se dibuja.
export function medirRatioMonoespaciado() {
  const ctx = document.createElement('canvas').getContext('2d');
  const referencia = 100;
  ctx.font = `${referencia}px monospace`;
  return ctx.measureText('0').width / referencia;
}

export function luminanciaDeColor(css) {
  const componentes = css.match(/\d+(\.\d+)?/g);
  if (!componentes || componentes.length < 3) return 0;
  const [r, g, b] = componentes.map(Number);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// Con fondo oscuro y texto claro, un carácter denso emite MÁS luz, así que
// las zonas claras de la foto van a caracteres densos. En tema claro es al
// revés: si no se invierte la rampa, la foto se ve en negativo.
export function leerColoresDelTema() {
  const estilo = getComputedStyle(document.body);
  const colorTexto = estilo.color;
  const colorFondo = estilo.backgroundColor;
  return {
    colorTexto,
    colorFondo,
    invertida: luminanciaDeColor(colorTexto) < luminanciaDeColor(colorFondo),
  };
}

// `imagen` es un HTMLImageElement ya cargado.
export function convertirAAscii(imagen, { columnas, invertida }) {
  const ratio = medirRatioMonoespaciado();
  // Con celdas de muestreo de esta proporción, la grilla reproduce la imagen
  // sin estirarla al dibujarla con caracteres.
  const filas = Math.max(1, Math.round(columnas * (imagen.height / imagen.width) * ratio));

  const lienzo = document.createElement('canvas');
  lienzo.width = imagen.width;
  lienzo.height = imagen.height;
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(imagen, 0, 0);
  const { data } = ctx.getImageData(0, 0, imagen.width, imagen.height);

  const anchoCelda = imagen.width / columnas;
  const altoCelda = imagen.height / filas;
  const celdas = new Array(columnas * filas);

  for (let f = 0; f < filas; f += 1) {
    for (let c = 0; c < columnas; c += 1) {
      const desdeX = Math.floor(c * anchoCelda);
      const hastaX = Math.max(desdeX + 1, Math.floor((c + 1) * anchoCelda));
      const desdeY = Math.floor(f * altoCelda);
      const hastaY = Math.max(desdeY + 1, Math.floor((f + 1) * altoCelda));

      // Promedio del bloque, no muestreo de un punto: en una foto el punto
      // suelto engancha ruido y la grilla queda sucia.
      let sumaAlfa = 0;
      let sumaLuz = 0;
      let opacos = 0;
      for (let y = desdeY; y < hastaY; y += 1) {
        for (let x = desdeX; x < hastaX; x += 1) {
          const i = (y * imagen.width + x) * 4;
          const alfa = data[i + 3];
          sumaAlfa += alfa;
          if (alfa < UMBRAL_ALFA) continue;
          // Sólo los píxeles con sujeto aportan luminancia: promediar los
          // transparentes arrastraría el negro del RGB vacío.
          sumaLuz += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          opacos += 1;
        }
      }

      const total = (hastaX - desdeX) * (hastaY - desdeY);
      if (sumaAlfa / total < UMBRAL_ALFA || opacos === 0) {
        celdas[f * columnas + c] = ' ';
        continue;
      }

      const luz = sumaLuz / opacos / 255;
      const nivel = invertida ? 1 - luz : luz;
      const indice = Math.min(RAMPA.length - 1, Math.max(0, Math.round(nivel * (RAMPA.length - 1))));
      celdas[f * columnas + c] = RAMPA[indice];
    }
  }

  return { columnas, filas, celdas };
}

// El fondo opaco es necesario: sin él la foto se vería por detrás de los
// caracteres. Como es `--color-bg`, el mismo fondo de `.capa-inicio`, las
// zonas transparentes del recorte quedan invisibles.
export function pintarAscii(ctx, ascii, ancho, alto, colorTexto, colorFondo) {
  ctx.fillStyle = colorFondo;
  ctx.fillRect(0, 0, ancho, alto);

  const anchoCelda = ancho / ascii.columnas;
  const altoCelda = alto / ascii.filas;
  ctx.fillStyle = colorTexto;
  ctx.font = `${altoCelda}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let f = 0; f < ascii.filas; f += 1) {
    for (let c = 0; c < ascii.columnas; c += 1) {
      const caracter = ascii.celdas[f * ascii.columnas + c];
      if (caracter === ' ') continue;
      ctx.fillText(caracter, (c + 0.5) * anchoCelda, (f + 0.5) * altoCelda);
    }
  }
}
```

- [ ] **Step 2: Verificar que compila**

Run: `cd apps/web && npm run build`
Expected: `✓ Compiled successfully`, 0 errores. (Nadie lo importa todavía; esto sólo confirma sintaxis.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/RetratoAscii/conversionAscii.js
git commit -m "feat(web): conversion de la foto a grilla de caracteres ASCII"
```

---

### Task 2: Componente con la intro, montado en el hero

**Files:**
- Create: `apps/web/src/components/RetratoAscii/RetratoAscii.module.css`
- Create: `apps/web/src/components/RetratoAscii/RetratoAscii.jsx`
- Modify: `apps/web/src/components/HeroInmersivo/HeroInmersivo.jsx`
- Modify: `apps/web/src/components/HeroInmersivo/HeroInmersivo.module.css`

**Interfaces:**
- Consumes: `conversionAscii.js` (Task 1); `next/image`.
- Produces: `export default function RetratoAscii()`, sin props. La Task 3 le agrega el barrido y la Task 4 el repintado por tema, ambas dentro de este mismo archivo.

- [ ] **Step 1: Crear `RetratoAscii.module.css`**

```css
.marco {
  position: relative;
  flex-shrink: 0;
  /* La spec decía 70vh fijo; con clamp no se come el ancho del nombre en
     pantallas intermedias. `--duracion-revelado` tiene que coincidir con
     DURACION_REVELADO_FOTO_MS del componente. */
  height: clamp(20rem, 62vh, 34rem);
  aspect-ratio: 433 / 577;
  --duracion-revelado: 700ms;
}

.foto,
.ascii {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* Arranca oculta: durante la escritura el clip-path recorta el canvas de
   verdad, así que si la foto fuera visible asomaría por lo no escrito. */
.foto {
  object-fit: contain;
  opacity: 0;
  transition: opacity var(--duracion-revelado) ease;
}

.foto.revelada {
  opacity: 1;
}

.ascii {
  --origen-x: 50%;
  --origen-y: 50%;
  --radio: 0px;
  --borde: 48px;
}

/* El canvas se desvanece en el cruce hacia la foto, y vuelve a opacity 1
   —ya tapado por la máscara— cuando el estado pasa a `foto`. */
.ascii.desvaneciendo {
  opacity: 0;
  transition: opacity var(--duracion-revelado) ease;
}

/* La máscara sólo entra en juego cuando termina la intro: mientras se
   escribe, quien recorta es el clip-path.
   Entrando: opaco adentro del círculo, transparente afuera. El ASCII
   "crece" desde el punto por donde entró el cursor. */
.ascii.enmascarado {
  -webkit-mask-image: radial-gradient(
    circle at var(--origen-x) var(--origen-y),
    #000 calc(var(--radio) - var(--borde)),
    transparent var(--radio)
  );
  mask-image: radial-gradient(
    circle at var(--origen-x) var(--origen-y),
    #000 calc(var(--radio) - var(--borde)),
    transparent var(--radio)
  );
}

/* Saliendo: la misma máscara con las paradas invertidas. El ASCII se borra
   desde el punto por donde salió el cursor hacia afuera. */
.ascii.enmascarado.saliendo {
  -webkit-mask-image: radial-gradient(
    circle at var(--origen-x) var(--origen-y),
    transparent calc(var(--radio) - var(--borde)),
    #000 var(--radio)
  );
  mask-image: radial-gradient(
    circle at var(--origen-x) var(--origen-y),
    transparent calc(var(--radio) - var(--borde)),
    #000 var(--radio)
  );
}

/* Por debajo de este ancho el nombre y el retrato no entran juntos. */
@media (max-width: 1024px) {
  .marco {
    display: none;
  }
}
```

- [ ] **Step 2: Crear `RetratoAscii.jsx`**

```jsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { convertirAAscii, leerColoresDelTema, pintarAscii } from './conversionAscii.js';
import styles from './RetratoAscii.module.css';

const RUTA_RETRATO = '/Yo.png';
const ANCHO_RETRATO = 433;
const ALTO_RETRATO = 577;

const COLUMNAS_ASCII = 110;
// Mismo valor que en NombreAscii: es lo que hace que las dos intros arranquen
// juntas apenas se va el splash de Bienvenida.
const DEMORA_INICIO_MS = 3300;
const DURACION_ESCRITURA_MS = 3200;
// Tiene que coincidir con --duracion-revelado del CSS.
const DURACION_REVELADO_FOTO_MS = 700;

// Recorte en L: las filas ya terminadas más el trozo escrito de la fila en
// curso. Es lo que hace que el ASCII se "escriba" sin repintar el canvas.
function recorteDeEscritura(progreso, columnas, filas) {
  if (progreso >= 1) return 'none';

  const reveladas = progreso * columnas * filas;
  const fila = Math.floor(reveladas / columnas);
  const columna = reveladas - fila * columnas;

  const yCompleto = (100 * fila) / filas;
  const ySiguiente = (100 * (fila + 1)) / filas;
  const xParcial = (100 * columna) / columnas;

  return `polygon(0% 0%, 100% 0%, 100% ${yCompleto}%, ${xParcial}% ${yCompleto}%, ${xParcial}% ${ySiguiente}%, 0% ${ySiguiente}%)`;
}

export default function RetratoAscii() {
  const refMarco = useRef(null);
  const refLienzo = useRef(null);
  const refImagen = useRef(null);
  const refAscii = useRef(null);

  // 'esperando' -> 'escribiendo' -> 'revelando' -> 'foto'
  const [fase, setFase] = useState('esperando');
  const [esperaCumplida, setEsperaCumplida] = useState(false);
  const [listo, setListo] = useState(false);
  const [reducido, setReducido] = useState(false);

  useEffect(() => {
    setReducido(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  // Convierte y pinta. Se llama una vez al cargar la imagen; la Task 4 la
  // vuelve a llamar cuando cambia el tema.
  const repintar = useCallback(() => {
    const lienzo = refLienzo.current;
    const marco = refMarco.current;
    const imagen = refImagen.current;
    if (!lienzo || !marco || !imagen) return;

    const { colorTexto, colorFondo, invertida } = leerColoresDelTema();
    const ascii = convertirAAscii(imagen, { columnas: COLUMNAS_ASCII, invertida });
    refAscii.current = ascii;

    const { width: ancho, height: alto } = marco.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    lienzo.width = ancho * dpr;
    lienzo.height = alto * dpr;
    const ctx = lienzo.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    pintarAscii(ctx, ascii, ancho, alto, colorTexto, colorFondo);
  }, []);

  // Carga de la imagen y primer pintado. Con reduced-motion no se pinta nunca.
  useEffect(() => {
    if (reducido) return undefined;
    let cancelado = false;
    const imagen = new window.Image();
    imagen.onload = () => {
      if (cancelado) return;
      refImagen.current = imagen;
      repintar();
      setListo(true);
    };
    // Sin esto, un fallo de carga dejaría `listo` en false para siempre: la
    // intro nunca arrancaría y, como la foto sólo se revela al salir de
    // 'escribiendo', el marco quedaría vacío. Se salta directo a la foto.
    imagen.onerror = () => {
      if (cancelado) return;
      setFase('foto');
    };
    imagen.src = RUTA_RETRATO;
    return () => {
      cancelado = true;
    };
  }, [reducido, repintar]);

  useEffect(() => {
    const temporizador = setTimeout(() => setEsperaCumplida(true), DEMORA_INICIO_MS);
    return () => clearTimeout(temporizador);
  }, []);

  // Con reduced-motion se salta la intro entera: la foto ya visible.
  useEffect(() => {
    if (reducido) setFase('foto');
  }, [reducido]);

  // La escritura no puede arrancar antes de que el canvas esté pintado: si no,
  // el clip-path destaparía un lienzo vacío.
  useEffect(() => {
    if (fase !== 'esperando' || !esperaCumplida || !listo) return;
    setFase('escribiendo');
  }, [fase, esperaCumplida, listo]);

  // Escritura: avance LINEAL, sin easing. Una máquina de escribir tiene
  // cadencia constante; con ease-out las últimas filas se arrastran.
  useEffect(() => {
    if (fase !== 'escribiendo') return undefined;
    const lienzo = refLienzo.current;
    const ascii = refAscii.current;
    if (!lienzo || !ascii) return undefined;

    const inicio = performance.now();
    let bucle = 0;

    function cuadro(ahora) {
      const progreso = Math.min(1, (ahora - inicio) / DURACION_ESCRITURA_MS);
      lienzo.style.clipPath = recorteDeEscritura(progreso, ascii.columnas, ascii.filas);
      if (progreso >= 1) {
        setFase('revelando');
        return;
      }
      bucle = requestAnimationFrame(cuadro);
    }

    bucle = requestAnimationFrame(cuadro);
    return () => cancelAnimationFrame(bucle);
  }, [fase]);

  // Cruce ASCII -> foto. Al terminar, el canvas recupera opacity 1 ya tapado
  // por la máscara (--radio arranca en 0), así que el cambio no se ve.
  useEffect(() => {
    if (fase !== 'revelando') return undefined;
    const temporizador = setTimeout(() => setFase('foto'), DURACION_REVELADO_FOTO_MS);
    return () => clearTimeout(temporizador);
  }, [fase]);

  const fotoRevelada = fase !== 'esperando' && fase !== 'escribiendo';

  return (
    <div className={styles.marco} ref={refMarco}>
      <Image
        src={RUTA_RETRATO}
        alt=""
        width={ANCHO_RETRATO}
        height={ALTO_RETRATO}
        priority
        className={`${styles.foto} ${fotoRevelada ? styles.revelada : ''}`}
      />
      <canvas
        ref={refLienzo}
        aria-hidden="true"
        className={`${styles.ascii} ${fase === 'revelando' ? styles.desvaneciendo : ''} ${
          fase === 'foto' ? styles.enmascarado : ''
        }`}
      />
    </div>
  );
}
```

- [ ] **Step 3: Montar el componente en el hero**

En `apps/web/src/components/HeroInmersivo/HeroInmersivo.jsx`, agregar el import junto a los existentes:

```jsx
import RetratoAscii from '@/components/RetratoAscii/RetratoAscii.jsx';
```

y reemplazar el ternario de la capa:

```jsx
          {seccion.id === 'inicio' ? (
            <NombreAscii />
          ) : (
            <span className={styles.titulo}>{seccion.titulo}</span>
          )}
```

por:

```jsx
          {seccion.id === 'inicio' ? (
            <>
              <NombreAscii />
              <RetratoAscii />
            </>
          ) : (
            <span className={styles.titulo}>{seccion.titulo}</span>
          )}
```

- [ ] **Step 4: Repartir la capa entre nombre y retrato**

En `apps/web/src/components/HeroInmersivo/HeroInmersivo.module.css`, reemplazar:

```css
.capa-inicio {
  justify-content: flex-start;
  padding-left: clamp(2rem, 8vw, 6rem);
  background: var(--color-bg);
}
```

por:

```css
.capa-inicio {
  justify-content: space-between;
  gap: clamp(1.5rem, 4vw, 4rem);
  padding-left: clamp(2rem, 8vw, 6rem);
  padding-right: clamp(2rem, 8vw, 6rem);
  background: var(--color-bg);
}
```

- [ ] **Step 5: Verificar que compila**

Run: `cd apps/web && npm run build`
Expected: `✓ Compiled successfully`, 0 errores.

- [ ] **Step 6: Verificar el comportamiento en el navegador**

Run: `cd apps/web && npm run dev`, abrir la home en una ventana de más de 1024 px de ancho.

Verificar:
1. Pasado el splash de Bienvenida, a la derecha empieza a **escribirse** el ASCII de la foto: el frente avanza de izquierda a derecha y va bajando fila por fila. Arranca a la vez que la animación del nombre.
2. Durante la escritura **no se ve la foto** por detrás de la parte todavía no escrita.
3. Al completarse, el ASCII se desvanece y aparece la foto, sin parpadeo ni salto.
4. El retrato queda a la derecha, el nombre a la izquierda, sin que se pisen ni desborde la pantalla.
5. Achicando la ventana por debajo de 1024 px el retrato desaparece y el nombre queda como antes.
6. La consola no muestra errores ni warnings nuevos.

Si la escritura se ve más como una persiana que como algo tipeado, alargar `DURACION_ESCRITURA_MS` o bajar `COLUMNAS_ASCII`.

Detener el servidor de dev al terminar.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/RetratoAscii apps/web/src/components/HeroInmersivo
git commit -m "feat(web): retrato que se escribe en ASCII antes de mostrar la foto"
```

---

### Task 3: El barrido por hover

**Files:**
- Modify: `apps/web/src/components/RetratoAscii/RetratoAscii.jsx`

**Interfaces:**
- Consumes: las clases `.enmascarado` y `.saliendo` y las variables `--origen-x`, `--origen-y`, `--radio` que la Task 2 ya dejó en el CSS.
- Produces: nada nuevo hacia afuera.

- [ ] **Step 1: Agregar las constantes del barrido**

Junto a las constantes existentes de `RetratoAscii.jsx`:

```jsx
const DURACION_BARRIDO_MS = 700;
const BORDE_MASCARA_PX = 48;

function suavizar(t) {
  return 1 - (1 - t) ** 3;
}
```

- [ ] **Step 2: Agregar el estado y las refs del barrido**

Debajo de las refs existentes:

```jsx
  const refUltimoInterior = useRef({ x: 0, y: 0 });
  const refOrigen = useRef({ x: 0, y: 0 });
  const refProgreso = useRef(0);
  const refDestino = useRef('foto');
  const refPolaridad = useRef(false);
  const refRadioMaximo = useRef(0);
```

y junto a los estados existentes:

```jsx
  const [saliendo, setSaliendo] = useState(false);
  const [interactivo, setInteractivo] = useState(false);
  const [listoParaHover, setListoParaHover] = useState(false);
```

Ampliar el efecto que ya lee `prefers-reduced-motion` para que lea también el gate del hover, que es un gate distinto y más chico (la intro sí corre sin mouse):

```jsx
  useEffect(() => {
    setReducido(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    setInteractivo(window.matchMedia('(hover: hover) and (pointer: fine)').matches);
  }, []);
```

- [ ] **Step 3: Ampliar la máquina de estados**

El comentario del estado pasa a:

```jsx
  // 'esperando' -> 'escribiendo' -> 'revelando' -> 'foto'
  // y de ahí en más: 'foto' <-> 'transicion' <-> 'ascii'
```

`fase === 'transicion'` es el barrido en curso. La polaridad y el origen se fijan al arrancarlo y NO cambian mientras corre: adoptar un centro nuevo a mitad de camino haría saltar la máscara de un punto a otro. Interrumpir sólo cambia el destino, o sea el sentido del avance.

Marcar que la intro terminó, para armar el hover una sola vez:

```jsx
  useEffect(() => {
    if (fase === 'foto' && !listoParaHover) setListoParaHover(true);
  }, [fase, listoParaHover]);
```

- [ ] **Step 4: Agregar la detección del hover**

```jsx
  // La detección NO usa eventos del DOM: `.capa` tiene pointer-events:none, el
  // hero está en z-index:-1 y `.seccionHero` también anula punteros, así que
  // un onMouseEnter sobre el retrato nunca se dispararía. Se compara la
  // posición del cursor contra el rect del marco.
  useEffect(() => {
    if (!listoParaHover || !interactivo || reducido) return undefined;

    function evaluar(adentro) {
      const deseado = adentro ? 'ascii' : 'foto';
      const actual = refFase.current;
      if (actual === deseado) return;

      if (actual === 'transicion') {
        // Ya hay un barrido corriendo: sólo se invierte el sentido.
        refDestino.current = deseado;
        return;
      }

      refOrigen.current = { ...refUltimoInterior.current };
      refPolaridad.current = deseado === 'foto';
      refProgreso.current = 0;
      refDestino.current = deseado;
      setSaliendo(refPolaridad.current);
      setFase('transicion');
    }

    function alMoverse(evento) {
      const marco = refMarco.current;
      if (!marco) return;
      const rect = marco.getBoundingClientRect();
      const adentro =
        evento.clientX >= rect.left &&
        evento.clientX <= rect.right &&
        evento.clientY >= rect.top &&
        evento.clientY <= rect.bottom;

      if (adentro) {
        // Relativas al marco, que es lo que consume la máscara. Se guarda la
        // última posición INTERIOR: al salir, el centro del círculo tiene que
        // caer sobre la imagen, no fuera de ella.
        refUltimoInterior.current = {
          x: evento.clientX - rect.left,
          y: evento.clientY - rect.top,
        };
      }
      evaluar(adentro);
    }

    // Si el cursor abandona la ventana no llegan más mousemove y el retrato
    // se quedaría en ASCII para siempre.
    function alSalirDelDocumento() {
      evaluar(false);
    }

    window.addEventListener('mousemove', alMoverse, { passive: true });
    document.addEventListener('mouseleave', alSalirDelDocumento);
    return () => {
      window.removeEventListener('mousemove', alMoverse);
      document.removeEventListener('mouseleave', alSalirDelDocumento);
    };
  }, [listoParaHover, interactivo, reducido]);
```

Agregar también el espejo de `fase` que usa ese listener, junto a las refs:

```jsx
  const refFase = useRef(fase);
  refFase.current = fase;
```

- [ ] **Step 5: Agregar el bucle del barrido**

```jsx
  useEffect(() => {
    if (fase !== 'transicion') return undefined;
    const lienzo = refLienzo.current;
    const marco = refMarco.current;
    if (!lienzo || !marco) return undefined;

    const { width: ancho, height: alto } = marco.getBoundingClientRect();
    const origen = refOrigen.current;
    // La esquina más lejana, más el borde: por debajo de eso quedaría una
    // esquina sin cubrir al final del barrido.
    refRadioMaximo.current =
      Math.max(
        Math.hypot(origen.x, origen.y),
        Math.hypot(ancho - origen.x, origen.y),
        Math.hypot(origen.x, alto - origen.y),
        Math.hypot(ancho - origen.x, alto - origen.y)
      ) + BORDE_MASCARA_PX;

    lienzo.style.setProperty('--origen-x', `${origen.x}px`);
    lienzo.style.setProperty('--origen-y', `${origen.y}px`);

    let anterior = performance.now();
    let bucle = 0;

    function cuadro(ahora) {
      const avance = (ahora - anterior) / DURACION_BARRIDO_MS;
      anterior = ahora;

      // Con polaridad normal el ASCII crece con el progreso; con la invertida
      // el progreso es cuánto se borró. El destino se lee cada cuadro porque
      // el mouse puede cambiarlo a mitad de camino.
      const objetivo = refPolaridad.current
        ? (refDestino.current === 'foto' ? 1 : 0)
        : (refDestino.current === 'ascii' ? 1 : 0);

      const paso = objetivo > refProgreso.current ? avance : -avance;
      refProgreso.current = Math.min(1, Math.max(0, refProgreso.current + paso));

      lienzo.style.setProperty(
        '--radio',
        `${suavizar(refProgreso.current) * refRadioMaximo.current}px`
      );

      if (refProgreso.current === objetivo) {
        setFase(refDestino.current);
        return;
      }
      bucle = requestAnimationFrame(cuadro);
    }

    bucle = requestAnimationFrame(cuadro);
    return () => cancelAnimationFrame(bucle);
  }, [fase]);
```

- [ ] **Step 6: Aplicar las clases del barrido al canvas**

Reemplazar el `className` del `<canvas>`:

```jsx
        className={`${styles.ascii} ${fase === 'revelando' ? styles.desvaneciendo : ''} ${
          fase === 'foto' ? styles.enmascarado : ''
        }`}
```

por:

```jsx
        className={`${styles.ascii} ${fase === 'revelando' ? styles.desvaneciendo : ''} ${
          listoParaHover ? styles.enmascarado : ''
        } ${saliendo ? styles.saliendo : ''}`}
```

`listoParaHover` en vez de `fase === 'foto'`: la máscara tiene que seguir aplicada durante `'transicion'` y `'ascii'`, no sólo en el estado asentado.

- [ ] **Step 7: Verificar que compila**

Run: `cd apps/web && npm run build`
Expected: `✓ Compiled successfully`, 0 errores.

- [ ] **Step 8: Verificar el comportamiento en el navegador**

Run: `cd apps/web && npm run dev`, esperar a que termine la intro.

Verificar:
1. Al entrar con el mouse en la foto, el ASCII aparece con un barrido circular que nace **en el punto por donde entró el cursor**.
2. Al salir, la foto vuelve con un barrido que nace **en el punto por donde salió**.
3. Entrar y salir rápido invierte el barrido en curso sin saltos: el círculo no cambia de centro a mitad de camino.
4. Sacando el mouse de la ventana del navegador con el retrato en ASCII, vuelve a la foto.
5. En la zona ya convertida no se ve la foto por detrás de los caracteres.
6. La consola no muestra errores nuevos.

Detener el servidor de dev al terminar.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/RetratoAscii/RetratoAscii.jsx
git commit -m "feat(web): barrido circular del retrato desde el punto del cursor"
```

---

### Task 4: Repintado al cambiar de tema y al redimensionar

**Files:**
- Modify: `apps/web/src/components/RetratoAscii/RetratoAscii.jsx`

**Interfaces:**
- Consumes: `repintar` (el `useCallback` que ya existe desde la Task 2).
- Produces: nada nuevo hacia afuera.

- [ ] **Step 1: Agregar el observador de tema y el de resize**

Después del efecto que carga la imagen:

```jsx
  // El canvas se pinta una sola vez, así que un cambio de tema lo dejaría con
  // los colores viejos: caracteres claros sobre fondo claro, o al revés. Y no
  // alcanza con repintar: `leerColoresDelTema` también da vuelta la rampa, así
  // que hay que rehacer la conversión entera, no sólo el pintado.
  useEffect(() => {
    if (reducido) return undefined;
    const observador = new MutationObserver(() => repintar());
    observador.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observador.disconnect();
  }, [reducido, repintar]);

  // El marco mide en vh, así que al redimensionar cambia de tamaño y el
  // bitmap quedaría estirado. Con debounce: repintar convierte la imagen
  // entera y no vale la pena hacerlo en cada evento del arrastre.
  useEffect(() => {
    if (reducido) return undefined;
    let temporizador;
    function alRedimensionar() {
      clearTimeout(temporizador);
      temporizador = setTimeout(repintar, 200);
    }
    window.addEventListener('resize', alRedimensionar);
    return () => {
      window.removeEventListener('resize', alRedimensionar);
      clearTimeout(temporizador);
    };
  }, [reducido, repintar]);
```

- [ ] **Step 2: Verificar que compila**

Run: `cd apps/web && npm run build`
Expected: `✓ Compiled successfully`, 0 errores.

- [ ] **Step 3: Verificar el comportamiento en el navegador**

Run: `cd apps/web && npm run dev`, esperar a que termine la intro.

Verificar:
1. Con el retrato en foto, tocar el `ThemeToggle` y después pasar el mouse: el ASCII se ve con los colores del tema nuevo.
2. El ASCII **no queda en negativo** al cambiar de tema: las zonas claras de la cara siguen leyéndose como claras y las oscuras como oscuras, en los dos temas.
3. Cambiar el tema mientras el retrato está en ASCII (con el mouse encima) lo actualiza sin romper el barrido.
4. Redimensionar la ventana (por encima de 1024 px) deja el ASCII nítido, no estirado.
5. La consola no muestra errores nuevos.

Detener el servidor de dev al terminar.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/RetratoAscii/RetratoAscii.jsx
git commit -m "feat(web): el retrato ASCII sigue al tema y al tamano de ventana"
```
