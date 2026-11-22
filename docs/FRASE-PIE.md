# «Gracias por pasar.» del pie (sección `#contacto`)

Cierre del footer: una frase grande que, en escritorio, se dibuja en WebGL como letras planas (2D) con
un contorno por el que corre un brillo y una burbuja que se abre bajo el cursor. Está inspirada en el
pie de getlayers.ai (su `FooterWordmark3D`); la tipografía es la de ellos, **General Sans SemiBold**.

## Archivos

| Archivo | Qué hace |
| --- | --- |
| `apps/web/src/components/PiePagina/CierreFooter.jsx` | Frase en texto CSS (letra por letra al entrar) + mapa. Envuelve la frase y le monta encima `FraseVidrio`. Expone `data-modo="css" \| "3d"`. |
| `apps/web/src/components/PiePagina/FraseVidrio.jsx` | Decide si activa el efecto, baja three bajo demanda, maneja puntero, aparición por letra y el ciclo de cuadros. |
| `apps/web/src/components/PiePagina/EscenaFrase.js` | La escena three (cámara ortográfica, sin luces). Clase `EscenaFrase`. |
| `apps/web/src/data/fraseGlifos.js` | Contornos SVG de cada letra (1000 unidades/em, y hacia arriba), ya acomodados. **Generado**, no editar a mano. |
| `apps/web/scripts/verificar-frase.mjs` | Captura reposo y hover en Chrome headless (`TEMA=light` para el claro). Deja imágenes en `scripts/.regresion/frase/`. |

## Cuándo se activa

Sólo con **mouse o trackpad** (`hover: fine`), pantalla de **≥ 1024 px** y sin `prefers-reduced-motion`.
Funciona en tema claro y oscuro. Si no se cumple, o si WebGL falla / se pierde el contexto, queda el
texto CSS de siempre (`data-modo="css"`). Three se importa recién cuando la frase está a 600 px de
entrar en pantalla.

## Qué se ve

- **Caras:** gris oscuro con degradé vertical (más claro arriba). La segunda línea es algo más tenue.
- **Contorno:** línea fina siempre visible. Un brillo cálido-celeste avanza por el contorno de cada
  letra dejando una cola que se apaga, como si lo fuera rellenando (`PERIODO_BRILLO`, 5.5 s por vuelta;
  cada letra arranca desfasada).
- **Burbuja de hover:** hueco redondo con borde ondulado bajo el cursor. Recorta las caras, deja ver el
  contorno y lleva un aro luminoso en el borde.
- **Aparición:** las letras suben una a una (resorte, 35 ms entre letras) al llegar al 25 % de visibilidad.
- No hay luces, inclinación ni balanceo: nada se desliza por las caras.

## Ajustes rápidos (en `EscenaFrase.js`)

- `ANCHO_BORDE`: grosor del contorno (media anchura, unidades de 1000/em).
- `PERIODO_BRILLO`: velocidad del brillo.
- Colores de cara y contorno: constantes dentro de `CARA_FRAGMENTO` y `BORDE_FRAGMENTO`.
- Radio y aro de la burbuja: en `posar()` (`0.46 * fontPx` y `0.06 * fontPx`).

## Regenerar los glifos (otra tipografía o ancho)

`fraseGlifos.js` se produjo con opentype.js a partir de General Sans SemiBold (TTF), ensanchada ×1.14
en horizontal, tracking −0.045 em, interlínea 0.93 em y separación de palabra 0.22 em. La fuente se
bajó del sitio de getlayers (woff2) y se convirtió a TTF con fontTools porque opentype.js no lee woff2.
Para cambiar el ancho basta con volver a generar con otro factor horizontal. El script generador no
está en el repo.

## Cómo verificar

Con el dev server levantado: `node apps/web/scripts/verificar-frase.mjs` (env `BASE_URL`, `TEMA`,
`GPU=0` para WebGL por software). Termina con código 1 si falta el lienzo o hay errores de consola.
Notas de la máquina: justo después de editar, el dev server recompila y la corrida puede dar páginas
en blanco o `ChunkLoadError`; se repite. La captura no muestra movimiento: el brillo del contorno y
la burbuja hay que mirarlos en la página.

## Historia (por qué es 2D)

La primera versión portaba la escena 3D de getlayers (letras extruidas con bisel, metal con reflejos
de estudio, luz que seguía al cursor). Se descartó porque las tiras de luz reflejadas y la inclinación
hacia el cursor producían un barrido de brillo sobre las caras que no se quería. La versión actual
conserva sólo lo pedido: letras planas, brillo recorriendo el borde y burbuja con aro.
