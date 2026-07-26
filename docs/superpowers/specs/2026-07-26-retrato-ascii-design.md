# Retrato en ASCII al hover — Diseño

## Objetivo

Completar la capa `inicio` del `HeroInmersivo`: hoy tiene el nombre a la izquierda y el resto vacío. Va una foto grande del usuario a la derecha, con dos momentos distintos.

**Al cargar la página**, la foto no aparece: primero se *escribe* su versión ASCII, carácter por carácter en orden de lectura —de izquierda a derecha y bajando— como si alguien la fuera tipeando. Cuando termina, ese ASCII se desvanece y en su lugar aparece la foto. Esto corre en paralelo con la intro del nombre, así la capa se completa de una sola vez.

**De ahí en adelante**, pasarle el mouse por encima convierte la foto en ASCII con un barrido circular que nace en el punto por donde entró el cursor; al salir, la foto vuelve con un barrido que nace en el punto por donde salió.

## Alcance

- `apps/web/public/Yo.png` — commitear (hoy está sin trackear; `public/playground/` sí está ignorado, es build output).
- `apps/web/src/components/RetratoAscii/RetratoAscii.jsx` + `.module.css` (nuevo) — las dos capas, la máscara y la máquina de estados.
- `apps/web/src/components/RetratoAscii/conversionAscii.js` (nuevo) — muestreo de la imagen a grilla de caracteres. Sin React.
- `apps/web/src/components/HeroInmersivo/HeroInmersivo.jsx` + `.module.css` (modificado) — la capa `inicio` reparte nombre y retrato.

Fuera de alcance: que el retrato ASCII se pueda romper con el mouse como el nombre; color por carácter (queda monocromo); el resto de las capas del hero.

## Decisiones tomadas antes de diseñar

**No se instala Tailwind ni shadcn.** El componente de Aceternity que motivó esto (`ui.aceternity.com/components/ascii-art`) se instala vía shadcn y depende de Tailwind, y este proyecto es CSS Modules puro sin PostCSS. Se verificó su API: sus `animationStyle` son `fade`, `typewriter`, `matrix` y `none` — todas animaciones de carga. **No expone ninguna prop de hover, de posición del cursor ni de revelado desde un punto**, así que el barrido hay que escribirlo a mano en cualquier caso. Lo único que aportaría es la conversión imagen→ASCII, que son unas cincuenta líneas y que este proyecto ya resuelve para el nombre (`calcarTextoLimpio` dibuja en un canvas y muestrea píxeles). Instalar Tailwind sólo por eso metería su preflight —un reset global de estilos base— en un sitio que ya tiene su propio sistema de temas y tokens.

## Nomenclatura

Español: `RetratoAscii`, `convertirAAscii`, `medirRatioMonoespaciado`, `luminanciaDeColor`, `pintarAscii`, `estadoBarrido`, `origenBarrido`, `progresoBarrido`, `radioMaximo`.

## La imagen de origen

`Yo.png`, 433×577, PNG RGBA de 8 bits. **El alfa está realmente en uso**: el 54,6 % de los píxeles son casi transparentes — la foto viene recortada, con la silueta limpia. Eso evita tener que umbralizar un fondo blanco: el alfa dice directamente dónde hay sujeto, igual que `esGlifo` usa el alfa del canvas de texto para saber dónde hay glifo.

## `conversionAscii.js`

Convierte la imagen a una grilla de caracteres. Se ejecuta **una sola vez** (y otra vez si cambia el tema); nada de esto corre por cuadro.

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

// `imagen` es un HTMLImageElement ya cargado. `invertida` da vuelta la rampa
// para el tema claro (ver "Tema" más abajo).
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
```

## `RetratoAscii` — las dos capas

```jsx
<div className={styles.marco} ref={refMarco}>
  <Image src={RUTA_RETRATO} alt="" width={433} height={577} className={styles.foto} priority />
  <canvas ref={refLienzo} className={styles.ascii} aria-hidden="true" />
</div>
```

Abajo la foto, arriba el canvas con el ASCII completo. El canvas se pinta **una vez**, al cargar: la animación no lo vuelve a tocar.

La imagen se referencia por su ruta pública (`const RUTA_RETRATO = '/Yo.png'`) y no con un import estático: importar desde `public/` funciona pero deja el archivo servido dos veces, por su ruta y por `/_next/static/media/`. A cambio hay que declarar las medidas a mano — son las del archivo, 433×577, las mismas que usa el `aspect-ratio` del marco.

`next/image` se usa por la optimización (WebP y `srcset`), que en un PNG de 232 KB mostrado grande se nota. Para la conversión se carga aparte un `new window.Image()` apuntando a `RUTA_RETRATO`, porque el muestreo necesita el archivo original y no la variante que sirva el optimizador.

El canvas pinta `--color-bg` de fondo y los caracteres en `--color-fg`. El fondo opaco es necesario: sin él la foto se vería por detrás de los caracteres en la zona ya convertida. Como `--color-bg` es el mismo fondo que usa `.capa-inicio`, las zonas transparentes del recorte quedan invisibles.

```js
function pintarAscii(ctx, ascii, ancho, alto, colorTexto, colorFondo) {
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

El canvas se dimensiona con `devicePixelRatio` (`lienzo.width = ancho * dpr`, `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`), como el overlay del colapso.

## La intro: el ASCII se escribe

Al cargar, la foto arranca en `opacity: 0` y lo único visible es el canvas del ASCII, que se va destapando carácter por carácter en orden de lectura. El canvas **tampoco se repinta acá**: lo que se anima es un `clip-path` con forma de L —todas las filas ya completas, más el pedazo de la fila en curso—, así que sigue valiendo que el ASCII se pinta una sola vez.

```js
// progreso 0..1 sobre el total de celdas, en orden de lectura.
function recorteDeEscritura(progreso, columnas, filas) {
  if (progreso >= 1) return 'none';

  const reveladas = progreso * columnas * filas;
  const fila = Math.floor(reveladas / columnas);
  const columna = reveladas - fila * columnas;

  const yCompleto = (100 * fila) / filas;
  const ySiguiente = (100 * (fila + 1)) / filas;
  const xParcial = (100 * columna) / columnas;

  // Rectángulo de las filas terminadas + el trozo escrito de la fila actual.
  return `polygon(0% 0%, 100% 0%, 100% ${yCompleto}%, ${xParcial}% ${yCompleto}%, ${xParcial}% ${ySiguiente}%, 0% ${ySiguiente}%)`;
}
```

El avance es **lineal**, sin easing: una máquina de escribir tiene cadencia constante, y cualquier ease-out haría que las últimas filas se arrastren.

La foto tiene que estar en `opacity: 0` durante toda la escritura. El `clip-path` recorta el canvas de verdad —no lo pinta transparente—, así que en la zona todavía no escrita se vería la foto por debajo.

Cuando la escritura termina viene el cambio: el ASCII se desvanece y la foto entra, con un cross-fade de `DURACION_REVELADO_FOTO_MS`. Al terminarlo, y en el mismo cuadro, se le devuelve al canvas su `opacity: 1` y se le aplica la máscara del barrido con radio 0. Como la máscara lo tapa por completo, ese cambio de opacidad no se ve; es lo que deja al componente listo para el hover.

Durante toda la intro el hover se ignora: el estado `foto` es el que habilita la interacción.

## El barrido: una máscara, no un repintado

El ASCII no se redibuja mientras barre. Lo que se anima es una máscara CSS sobre el canvas:

```css
.ascii {
  position: absolute;
  inset: 0;
  --origen-x: 50%;
  --origen-y: 50%;
  --radio: 0px;
  --borde: 48px;
}

/* La máscara sólo entra en juego cuando termina la intro: mientras se
   escribe, quien recorta es el clip-path. */
/* Entrando: opaco adentro del círculo, transparente afuera. El ASCII
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
   desde el punto por donde salió el cursor hacia afuera, y aparece la foto. */
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
```

`--borde` (48 px) hace que el frente del barrido sea un degradado y no un círculo de borde duro. `--radio` lo anima `requestAnimationFrame` escribiendo la variable con `style.setProperty`, igual que el resto de los efectos del proyecto.

`radioMaximo` es la distancia del origen a la esquina más lejana del marco, más `--borde`: por debajo de eso quedaría una esquina sin cubrir.

## Máquina de estados

Dos estados de intro, que corren una sola vez: `escribiendo` (el ASCII se tipea, foto en `opacity: 0`) y `revelando` (cross-fade del ASCII a la foto). Después, los cuatro del hover: `foto` (asentado, ASCII oculto), `aAscii` (barriendo hacia ASCII), `ascii` (asentado, cubierto), `aFoto` (barriendo de vuelta).

| Situación | Qué pasa |
| --- | --- |
| Pasan `DEMORA_INICIO_MS` desde el montaje | `escribiendo` |
| La escritura llega al final | `revelando` |
| Termina el cross-fade | `foto`: se restaura `opacity: 1` del canvas y se aplica `.enmascarado` con radio 0 |
| El cursor se mueve durante `escribiendo` o `revelando` | se ignora: el hover recién se arma en `foto` |
| El cursor entra estando en `foto` | `origenBarrido` = punto de entrada, polaridad normal, `aAscii` |
| El barrido llega al final | `ascii` |
| El cursor sale estando en `ascii` | `origenBarrido` = última posición conocida dentro del marco, polaridad invertida (`.saliendo`), `aFoto` |
| El barrido llega al final | `foto` |
| El cursor entra estando en `aFoto` | **se invierte la animación en curso**: mismo origen y misma polaridad, el progreso vuelve hacia 0 y termina en `ascii` |
| El cursor sale estando en `aAscii` | ídem al revés: el progreso vuelve hacia 0 y termina en `foto` |

La regla que importa: **el origen y la polaridad sólo se eligen al salir de un estado asentado**. Si se adoptara un centro nuevo a mitad de un barrido, la máscara saltaría de golpe de un punto a otro. Interrumpir una transición la reproduce hacia atrás, que además es lo que se espera visualmente.

Se anima un `progresoBarrido` de 0 a 1 con `easeOutCubic`, y `--radio = eased(progreso) * radioMaximo`. Invertir es cambiar el signo del avance; el progreso actual se conserva, así que no hay salto.

El punto de salida es **la última posición registrada dentro del marco**, no la primera de afuera: así el centro del círculo cae siempre sobre la imagen.

## Detección del hover

Igual que en el nombre, y por el mismo motivo: `.capa` tiene `pointer-events: none`, el hero está en `z-index: -1` y `.seccionHero` también anula punteros, así que los eventos de hover del DOM sobre el retrato nunca se disparan. Se escucha `mousemove` en `window` y se compara la posición contra el rect del marco.

```js
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
    // Coordenadas relativas al marco: es lo que consume la máscara.
    refUltimoInterior.current = {
      x: evento.clientX - rect.left,
      y: evento.clientY - rect.top,
    };
  }
  actualizarEstado(adentro);
}
```

Se agrega también un listener de `mouseleave` en `document` que fuerza la salida: si el cursor abandona la ventana no llegan más `mousemove` y el retrato quedaría en ASCII para siempre.

Los dos gates que usa el nombre siguen valiendo, pero **no cubren lo mismo**, porque acá hay una parte que no es interactiva:

- `(hover: hover) and (pointer: fine)` gatea **sólo el barrido**. Un dispositivo sin mouse igual ve la intro escribirse y quedarse en la foto; simplemente nunca dispara el hover.
- `prefers-reduced-motion: reduce` gatea **todo**: no hay escritura ni barrido, la foto se muestra directamente en `opacity: 1` desde el arranque y el canvas nunca se pinta.

## Tema

El canvas se pinta una sola vez, así que un cambio de tema lo dejaría con los colores viejos: caracteres claros sobre fondo claro, o al revés. Un `MutationObserver` sobre el atributo `data-theme` de `<html>` —que es lo que cambia `ThemeToggle`— vuelve a pintar.

Y no alcanza con repintar con los colores nuevos: **la rampa también se da vuelta**. Con fondo oscuro y texto claro, un carácter denso emite más luz, así que las zonas claras de la foto van a caracteres densos. En tema claro es al revés. Se decide comparando las luminancias:

```js
function luminanciaDeColor(css) {
  const [r, g, b] = css.match(/\d+(\.\d+)?/g).map(Number);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

const estilo = getComputedStyle(document.body);
const colorTexto = estilo.color;
const colorFondo = estilo.backgroundColor;
// Tema claro (texto más oscuro que el fondo): las zonas claras de la foto
// tienen que ir a caracteres ralos, no densos.
const invertida = luminanciaDeColor(colorTexto) < luminanciaDeColor(colorFondo);
```

Al invertirse la rampa cambia la grilla, así que el cambio de tema rehace la conversión completa, no sólo el pintado.

## Layout en `.capa-inicio`

La capa pasa a repartir el ancho entre el nombre y el retrato:

```css
.capa-inicio {
  justify-content: space-between;
  align-items: center;
  padding-left: clamp(2rem, 8vw, 6rem);
  padding-right: clamp(2rem, 8vw, 6rem);
  background: var(--color-bg);
}
```

`RetratoAscii` se renderiza dentro de la capa `inicio`, después de `<NombreAscii/>`. El marco toma la altura del hero:

```css
.marco {
  position: relative;
  height: 70vh;
  max-height: 80vh;
  aspect-ratio: 433 / 577;
  flex-shrink: 0;
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

/* El canvas se desvanece en el mismo cruce, y vuelve a opacity 1 —ya tapado
   por la máscara— cuando el estado pasa a `foto`. */
.ascii.desvaneciendo {
  opacity: 0;
  transition: opacity var(--duracion-revelado) ease;
}

@media (max-width: 768px) {
  .marco {
    display: none;
  }
}
```

Debajo de 768 px el retrato desaparece —mismo breakpoint con el que el header ya oculta la navegación— y el nombre recupera el ancho completo.

## Accesibilidad

El hero entero está marcado `aria-hidden="true"` en `HeroInmersivo`, así que el retrato no agrega superficie accesible: la foto va con `alt=""` y el canvas con `aria-hidden`. No hay nada nuevo que anunciar.

## Constantes de ajuste

Puntos de partida, a afinar a ojo en el navegador como el resto de los efectos:

```js
const COLUMNAS_ASCII = 110;         // columnas de la grilla; con 433×577 da ~88 filas
const DEMORA_INICIO_MS = 3300;      // espera a que se vaya el splash; mismo valor que NombreAscii
const DURACION_ESCRITURA_MS = 3200; // lo que tarda en tipearse el ASCII entero
const DURACION_REVELADO_FOTO_MS = 700; // cross-fade del ASCII a la foto
const DURACION_BARRIDO_MS = 700;    // lo que tarda el círculo en cubrir el marco
const BORDE_MASCARA_PX = 48;        // ancho del degradado en el frente del barrido
```

`DEMORA_INICIO_MS` tiene que seguir valiendo lo mismo que en `NombreAscii`: es lo que hace que las dos intros arranquen juntas.

Sobre `DURACION_ESCRITURA_MS`: con 110 columnas y ~88 filas, 3200 ms dan unos 36 ms por fila, así que el barrido horizontal dentro de cada fila es muy rápido y lo que se percibe es sobre todo el frente bajando con el borde dentado. Si el gesto de máquina de escribir no se llega a leer, la palanca es alargar esta duración (o bajar `COLUMNAS_ASCII`, que acorta las filas).

## Criterios de aceptación

- La capa `inicio` muestra el nombre a la izquierda y la foto grande a la derecha.
- Al cargar la página no se ve la foto: se ve el ASCII escribiéndose de izquierda a derecha y de arriba a abajo, arrancando junto con la intro del nombre.
- Terminada la escritura, el ASCII se desvanece y aparece la foto, sin parpadeos ni saltos en el pasaje.
- Mover el mouse sobre el retrato durante la intro no dispara nada; el hover recién responde con la foto ya asentada.
- Al entrar con el mouse en la foto, la versión ASCII aparece con un barrido circular que nace **en el punto por donde entró el cursor** y termina cubriendo toda la imagen.
- Al salir, la foto vuelve con un barrido que nace **en el punto por donde salió el cursor**.
- Entrar o salir a mitad de un barrido invierte el que está corriendo, sin saltos ni cambios de centro.
- El ASCII es monocromo, respeta el recorte de la foto (el fondo transparente queda vacío) y no deja ver la foto por detrás en la zona ya convertida.
- Cambiar el tema con el retrato a la vista actualiza colores y rampa: la foto nunca queda en negativo ni invisible.
- No se dispara en dispositivos sin hover fino ni con `prefers-reduced-motion: reduce`.
- No se instala Tailwind, PostCSS ni shadcn; el proyecto sigue en CSS Modules.
- `npm run build` compila sin errores.
