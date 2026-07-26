# Nombre en ASCII — Colapso físico al hover (fase 2) — Diseño

## Objetivo

Cerrar el pedido original que quedó fuera de la spec de formación: cuando el mouse pasa por encima del nombre ya asentado en tipografía limpia, el texto vuelve a convertirse en caracteres ASCII y la pila se derrumba con gravedad real, chocando contra el cursor. Los caracteres caen hasta el pie de la sección `inicio` y siguen siendo empujables por el mouse aun estando asentados. Cuando la mayoría se estabiliza, entra un stickman desde la izquierda barriendo con una escoba, que amontona todo contra el borde derecho, deja de barrer, sigue caminando y sale de pantalla. Ahí arranca el rebobinado: se reproduce en reversa —cuadro a cuadro— todo lo que pasó, incluido el stickman caminando hacia atrás desbarriendo, hasta que los caracteres vuelven a formar el nombre y reaparece la tipografía limpia.

## Alcance

- `apps/web/package.json` — nueva dependencia: `matter-js`.
- `apps/web/src/components/NombreAscii/NombreAscii.jsx` — modificado: detecta el hover, expone la grilla y monta `<ColapsoFisico/>`.
- `apps/web/src/components/ColapsoFisico/ColapsoFisico.jsx` + `.module.css` (nuevo) — overlay con el `<canvas>`, orquestación de sub-fases y bucle de render.
- `apps/web/src/components/ColapsoFisico/mundoFisico.js` (nuevo) — armado del mundo Matter.js (cuerpos, paredes, cursor, escoba). Sin React.
- `apps/web/src/components/ColapsoFisico/stickman.js` (nuevo) — dibujo del stickman en canvas 2D y su ciclo de caminata/barrido.
- `apps/web/src/components/ColapsoFisico/grabadora.js` (nuevo) — grabación de cuadros y reproducción inversa.

Fuera de alcance: el resto de las capas del `HeroInmersivo`; las fases 1-3 de `NombreAscii` (formación), que no cambian salvo lo justo para exponer datos; tests automatizados (el repo no tiene suite).

## Nomenclatura

Español, como el resto del proyecto: `ColapsoFisico`, `mundoFisico`, `crearMundo`, `cuerposDeCaracteres`, `cuerpoCursor`, `cuerpoEscoba`, `Grabadora`, `grabarCuadro`, `reproducirInverso`, `Stickman`, `dibujarStickman`, `faseColapso`, `estaSobreNombre`, `piezasQuietas`.

## Dependencia nueva

`matter-js` (`npm install matter-js` en `apps/web`) — motor de física 2D. Se usa `Engine`, `Bodies`, `Composite`, `Body` y `Engine.update` manual (no `Runner`, porque el bucle lo maneja el mismo `requestAnimationFrame` que dibuja). **No** se usa `Matter.Render` ni `Matter.MouseConstraint`: el render es propio sobre `<canvas>` (hay que dibujar caracteres, no rectángulos) y el cursor se modela como cuerpo estático teleportado a mano, que es lo que hace falta para "empujar" en vez de "agarrar".

## Flujo de sub-fases

`ColapsoFisico` corre su propia máquina de estados, independiente de la de `NombreAscii`:

| Sub-fase | Qué pasa | Cómo termina |
| --- | --- | --- |
| `derrumbe` | Todos los cuerpos pasan a dinámicos de golpe. Caen, chocan entre sí y contra el cursor. Se graba cada cuadro. | Cuando la fracción de cuerpos con velocidad baja supera `UMBRAL_QUIETUD` (y pasó un mínimo de tiempo). |
| `barrido` | El stickman entra desde la izquierda caminando y barriendo; la escoba es un cuerpo que empuja los caracteres hacia la derecha. Se sigue grabando. | Cuando el stickman llega cerca del borde derecho. |
| `salida` | El stickman deja de barrer y sigue caminando a la derecha. Los caracteres quedan apilados. Se sigue grabando. | Cuando el stickman sale del ancho de la sección. |
| `rebobinado` | Se detiene el motor. Se reproducen los cuadros grabados en orden inverso (caracteres y stickman). El mouse ya no interactúa: es reproducción determinística, no simulación. | Al llegar al cuadro 0. |

Al terminar `rebobinado` se destruye el mundo, se libera la grabación y el componente se desmonta: vuelve a verse `textoLimpio`. El efecto se puede volver a disparar con un nuevo `mouseenter` (hay que salir del área y volver a entrar; quedarse adentro no lo re-dispara).

## Constantes de ajuste

Puntos de partida, a afinar a ojo contra el navegador como el resto de los efectos del proyecto:

```js
const UMBRAL_QUIETUD = 0.85;        // fracción de piezas quietas que dispara al stickman
const MINIMO_DERRUMBE_MS = 1200;    // piso de tiempo antes de dejar entrar al stickman
const VELOCIDAD_STICKMAN_PX = 2.2;  // avance horizontal por cuadro
const MARGEN_FIN_BARRIDO_PX = 120;  // a qué distancia del borde derecho deja de barrer
```

`MINIMO_DERRUMBE_MS` existe porque `piezasQuietas` puede dar alto en el primer cuadro, antes de que la gravedad llegue a acelerar nada: sin ese piso, el stickman entraría antes de que se vea caer la pila.

## Detección del hover

`.capa` de `HeroInmersivo` tiene `pointer-events: none`, el hero está en `z-index: -1` y `.seccionHero` también anula punteros. Cualquier enfoque basado en `onMouseEnter` sobre el nodo del nombre choca con esa cascada — es exactamente lo que rompió el botón temporal de prueba durante la fase 1.

Por eso la detección **no** usa eventos del DOM del nombre: se escucha `mousemove` en `window` y se compara la posición contra el rect del nombre, que `NombreAscii` ya conoce porque lo mide en `calcarTextoLimpio`.

```jsx
// NombreAscii.jsx — nuevo efecto, sólo activo en la fase de reposo
useEffect(() => {
  if (fase !== 'desvanecido' || colapsando) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  function alMoverse(evento) {
    const nodo = refLimpio.current;
    if (!nodo) return;
    const rect = nodo.getBoundingClientRect();
    const adentro =
      evento.clientX >= rect.left && evento.clientX <= rect.right &&
      evento.clientY >= rect.top && evento.clientY <= rect.bottom;
    if (adentro) setColapsando(true);
  }

  window.addEventListener('mousemove', alMoverse, { passive: true });
  return () => window.removeEventListener('mousemove', alMoverse);
}, [fase, colapsando]);
```

Se descarta en dispositivos sin hover real (táctiles) y con `prefers-reduced-motion`, coherente con el `@media` que ya tiene `NombreAscii.module.css`.

## Datos que `NombreAscii` le pasa a `ColapsoFisico`

`generarCampo` ya marca con `esNombre: true` exactamente las celdas que forman los glifos. Falta poder ubicarlas en píxeles sin medir cientos de rects (eso serían cientos de reflows forzados en el peor momento). Se calculan analíticamente, para lo cual `generarCampo` pasa a devolver también el paso horizontal:

```js
// generarCampo(): el objeto devuelto suma `paso`
return {
  columnas,
  tamanoCelda: celdaAlto,
  separacion,
  paso, // ancho de carácter + separación: distancia entre columnas
  izquierda,
  arriba: arriba - FILAS_LLUVIA * celdaAlto,
};
```

Con eso, la celda `(c, i)` está en `izquierda + c * paso`, `arriba + i * tamanoCelda`, relativo a `.contenedor`. `ColapsoFisico` suma el rect de `.contenedor` para pasarlo a coordenadas del overlay.

```jsx
{colapsando && (
  <ColapsoFisico
    campo={campo}
    refContenedor={refContenedor}
    alTerminar={() => setColapsando(false)}
  />
)}
```

Mientras `colapsando` es `true`, `textoLimpio` se oculta (`opacity: 0`) — las letras "reales" ceden su lugar a la pila ASCII.

## El overlay

El `<canvas>` se monta por portal en `document.body`, no dentro del hero: así escapa del `pointer-events: none` heredado y del `z-index: -1` que dejaría el efecto detrás del contenido. Se posiciona en absoluto sobre los primeros 100vh del documento, que es exactamente lo que ocupa el hero, así scrollea junto con él.

```css
/* ColapsoFisico.module.css */
.overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
  z-index: 1;
  pointer-events: none; /* decorativo: la detección es por mousemove en window */
}

.lienzo {
  display: block;
  width: 100%;
  height: 100%;
}
```

El canvas se dimensiona con `devicePixelRatio` (`canvas.width = ancho * dpr`, `ctx.scale(dpr, dpr)`) para que los caracteres no salgan borrosos.

## `mundoFisico.js`

```js
import { Bodies, Body, Composite, Engine } from 'matter-js';

const GROSOR_PARED = 200;
const RADIO_CURSOR = 26;

// Un cuerpo por celda de glifo, en la posición exacta que ocupa hoy el
// carácter en pantalla. Nacen dinámicos: el pedido es que la pila entera
// se derrumbe al tocarla, no sólo la parte que roza el cursor.
export function crearMundo({ ancho, alto, celdas, tamanoCelda, anchoCaracter }) {
  const motor = Engine.create();
  motor.gravity.y = 1;

  const cuerposDeCaracteres = celdas.map((celda) =>
    Bodies.rectangle(celda.x, celda.y, anchoCaracter, tamanoCelda, {
      friction: 0.4,
      restitution: 0.15,
      // Las celdas son de pocos px: con el slop por defecto (0.05) se
      // encajan visiblemente unas dentro de otras al apilarse.
      slop: 0.02,
    })
  );

  // Piso al pie de la sección (no de la cajita del nombre) y paredes a los
  // costados, para que nada se escape del hero.
  const paredes = [
    Bodies.rectangle(ancho / 2, alto + GROSOR_PARED / 2, ancho * 3, GROSOR_PARED, { isStatic: true }),
    Bodies.rectangle(-GROSOR_PARED / 2, alto / 2, GROSOR_PARED, alto * 3, { isStatic: true }),
    Bodies.rectangle(ancho + GROSOR_PARED / 2, alto / 2, GROSOR_PARED, alto * 3, { isStatic: true }),
  ];

  // El cursor y la escoba son estáticos y se teleportan a mano: así empujan
  // en vez de ser empujados. (Un MouseConstraint agarraría piezas, que no es
  // lo pedido.)
  const cuerpoCursor = Bodies.circle(-9999, -9999, RADIO_CURSOR, { isStatic: true });
  const cuerpoEscoba = Bodies.rectangle(-9999, -9999, 14, 70, { isStatic: true });

  Composite.add(motor.world, [...cuerposDeCaracteres, ...paredes, cuerpoCursor, cuerpoEscoba]);
  return { motor, cuerposDeCaracteres, cuerpoCursor, cuerpoEscoba };
}

export function moverCuerpo(cuerpo, x, y) {
  Body.setPosition(cuerpo, { x, y });
}

// Fracción de piezas prácticamente quietas — dispara la entrada del stickman.
export function piezasQuietas(cuerpos, umbralVelocidad = 0.4) {
  const quietas = cuerpos.filter((c) => c.speed < umbralVelocidad).length;
  return quietas / cuerpos.length;
}
```

`Engine.update(motor, 1000 / 60)` se llama con delta fijo desde el bucle de render: con delta variable la simulación se vuelve inestable si cae un cuadro, y además un delta fijo hace que la grabación sea reproducible.

## `stickman.js`

Dibujo procedural con líneas sobre el mismo canvas — sin sprites ni assets. El estado es sólo `{ x, fase, paso }`, donde `paso` es la fase del ciclo de caminata (un ángulo que avanza cada cuadro) y de él salen las posiciones de piernas y brazos.

```js
const ALTO_STICKMAN = 90;

// Brazos que estiran y encogen sosteniendo la escoba: la amplitud del
// barrido sale del mismo `paso` que mueve las piernas, así el gesto queda
// sincronizado con la caminata.
export function offsetEscoba(paso) {
  return Math.sin(paso * 2) * 26;
}

export function dibujarStickman(ctx, { x, suelo, paso, barriendo }, color) {
  const cabeza = suelo - ALTO_STICKMAN;
  const balanceo = Math.sin(paso) * 12;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.arc(x, cabeza, 9, 0, Math.PI * 2);             // cabeza
  ctx.moveTo(x, cabeza + 9);
  ctx.lineTo(x, suelo - 34);                          // torso
  ctx.moveTo(x, suelo - 34);
  ctx.lineTo(x - balanceo, suelo);                    // pierna trasera
  ctx.moveTo(x, suelo - 34);
  ctx.lineTo(x + balanceo, suelo);                    // pierna delantera
  ctx.stroke();

  // Brazos + escoba
  const puntaX = x + (barriendo ? 30 + offsetEscoba(paso) : 22);
  ctx.beginPath();
  ctx.moveTo(x, cabeza + 24);
  ctx.lineTo(puntaX, suelo - 30);                     // brazos
  ctx.lineTo(puntaX + 8, suelo);                      // palo
  ctx.moveTo(puntaX - 6, suelo);
  ctx.lineTo(puntaX + 22, suelo);                     // cerdas
  ctx.stroke();
}
```

La escoba física (`cuerpoEscoba`) se teleporta cada cuadro a la punta calculada con `offsetEscoba`, así lo que se ve barriendo es lo mismo que empuja. Mientras `fase === 'salida'` la escoba se saca del área (se manda a `-9999`) y `barriendo` pasa a `false`: el stickman camina sin barrer hasta salir.

## `grabadora.js`

La reconstrucción tiene que ser el recorrido inverso exacto, no un tween de vuelta al origen. Se guarda una foto por cuadro; en el rebobinado se recorren al revés y se pintan tal cual.

```js
// 3 floats por cuerpo (x, y, ángulo) + 2 del stickman (x, paso).
const FLOATS_POR_CUERPO = 3;
const FLOATS_STICKMAN = 2;
// Techo de memoria: ~380 cuerpos ≈ 4.6 KB por cuadro, 900 cuadros ≈ 4 MB.
const MAX_CUADROS = 900;

export function crearGrabadora(cantidadCuerpos) {
  const cuadros = [];
  const largo = cantidadCuerpos * FLOATS_POR_CUERPO + FLOATS_STICKMAN;

  return {
    get cantidad() {
      return cuadros.length;
    },
    get lleno() {
      return cuadros.length >= MAX_CUADROS;
    },
    grabarCuadro(cuerpos, stickman) {
      if (cuadros.length >= MAX_CUADROS) return;
      const foto = new Float32Array(largo);
      cuerpos.forEach((cuerpo, i) => {
        foto[i * 3] = cuerpo.position.x;
        foto[i * 3 + 1] = cuerpo.position.y;
        foto[i * 3 + 2] = cuerpo.angle;
      });
      foto[largo - 2] = stickman.x;
      foto[largo - 1] = stickman.paso;
      cuadros.push(foto);
    },
    leerCuadro(indice) {
      return cuadros[indice];
    },
    liberar() {
      cuadros.length = 0;
    },
  };
}
```

`lleno` es la válvula de escape: si por lo que sea la simulación se estira más de lo previsto, se corta la grabación y se pasa directo al rebobinado en vez de comerse memoria sin techo.

## El bucle de `ColapsoFisico`

Un solo `requestAnimationFrame` hace todo: avanza la física (o el rebobinado), y dibuja. Nunca hay dos bucles compitiendo.

```jsx
function cuadro() {
  if (faseRef.current === 'rebobinado') {
    const foto = grabadora.leerCuadro(indiceRef.current);
    aplicarFoto(foto);              // posiciona caracteres y stickman
    indiceRef.current -= 1;
    if (indiceRef.current < 0) return terminar();
  } else {
    moverCuerpo(cuerpoCursor, ratonRef.current.x, ratonRef.current.y);
    actualizarStickman();
    Engine.update(motor, 1000 / 60);
    grabadora.grabarCuadro(cuerposDeCaracteres, stickmanRef.current);
    evaluarTransicionDeFase();
  }
  dibujar();
  bucleRef.current = requestAnimationFrame(cuadro);
}
```

`dibujar()` limpia el canvas, recorre las celdas y hace `ctx.save() / translate(x, y) / rotate(angle) / fillText(caracter, 0, 0) / restore()`, con la misma fuente monoespaciada y el color leído de `--color-fg` — así la pila derrumbada se ve igual que el campo ASCII de las fases previas. El stickman se dibuja al final, por encima.

Durante el rebobinado no se llama a `Engine.update` ni se mueve `cuerpoCursor`: las posiciones vienen de la grabación. Por eso el mouse no puede interferir mientras se rebobina.

## Criterios de aceptación

- Con el nombre en tipografía limpia (fase de reposo), pasar el mouse por encima lo convierte de nuevo en caracteres ASCII y la pila entera se derrumba.
- Los caracteres caen hasta el pie de la sección `inicio` (los 100vh del hero), no hasta el borde de la caja del nombre.
- Mientras dura el derrumbe, mover el cursor empuja los caracteres — también cuando ya están asentados en el piso.
- Cuando la mayoría se estabiliza, el stickman entra desde la izquierda ya barriendo, con brazos que estiran y encogen sosteniendo la escoba, y amontona los caracteres contra el borde derecho.
- Al llegar a la derecha deja de barrer, sigue caminando y sale de pantalla; recién ahí arranca el rebobinado.
- El rebobinado reproduce el recorrido inverso exacto: el stickman vuelve caminando hacia atrás desbarriendo y sale por la izquierda, y los caracteres deshacen su caída hasta reformar el nombre.
- Al terminar, reaparece la tipografía limpia y el efecto puede volver a dispararse saliendo del área y volviendo a entrar.
- No se dispara en dispositivos sin hover fino (táctiles) ni con `prefers-reduced-motion: reduce`.
- Lectores de pantalla siguen anunciando "Felipe Diaz Aimar" una sola vez: todo lo nuevo es decorativo y va con `aria-hidden`.
- `npm run build` compila sin errores tras agregar `matter-js`.
