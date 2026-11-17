# Dioramas de los hitos ("Sobre mí")

Los siete dioramas isométricos de la sección "Sobre mí" se generan con este script. Cada uno
sale en dos temas y queda en `public/hitos/diorama-<id>-oscuro.svg` y `-claro.svg`.

```bash
node apps/web/scripts/hitos/build.mjs            # los siete, en los dos temas
node apps/web/scripts/hitos/build.mjs --solo 3   # sólo el hito 3
```

## Cómo está armado

- `build.mjs`: un encuadre único para los siete (misma cámara, misma escala), los acentos de
  color y la escritura de los SVG. También deja una vista previa por archivo y una hoja de
  contactos por tema en `scripts/.regresion/hitos/` (carpeta ignorada por git).
- `taller.mjs`: lo compartido. La isla, la cámara y el vocabulario de piezas (mesa, pizarra,
  notebook, gabinete, banqueta, cables, pantallas).
- `escenas/N-nombre.mjs`: un archivo por hito. Exporta `cuerpo()` (el dibujo), `etiqueta` (el
  texto accesible) y, si hace falta, acentos propios.
- `kit/`: copia del kit de dibujo de la skill `anatomy-asset` (licencia MIT, ver `kit/LICENSE`).
  Sólo los tres módulos que se usan: `iso-kit`, `asset` y `lathe`.

El color de cada hito sale de `src/data/hitos.json` (campo `acento`).

## Reglas que conviene respetar al tocar una escena

- Todo color es un acento (`ac('nombre', …)`), nunca un hex en un relleno.
- Se pinta de atrás hacia adelante y de abajo hacia arriba: `escena().poner(clave, svg)` ordena
  los objetos por el punto del piso que se le pasa.
- Cada línea termina en algo (una cara, otra línea o un punto). Las que hacen de texto impreso
  van con `renglones(…)`, que las marca como libres.
- Lo alto va al medio de la isla (`ZONA_ALTA` en `taller.mjs`): el encuadre sólo reserva altura
  ahí. Tope: 54 unidades.
- El papel de cada tema (`PAPEL` en `build.mjs`) tiene que ser el mismo que usa la portada
  (`TEMAS` en `src/components/SobreMi/portadas/componerPortada.js`).
- El movimiento es sólo CSS (`a.amBlink`, `a.amLoop`, `a.amRotor`, `a.amDraw`, `a.amFlip`…) para
  que siga andando dentro de un `<img>`, y se detiene con "reducir movimiento".
- Dónde se ve ese movimiento: en el reel, la portada lleva el diorama como textura (quieto) y,
  cuando la cinta se asienta, `ReelHitos.jsx` le apoya encima el mismo SVG como `<img>`, que es
  el que se mueve. En la versión sin WebGL son `<img>` directamente.

## Comprobaciones

Con la skill instalada en `~/.claude/skills/anatomy-asset`:

```bash
S=~/.claude/skills/anatomy-asset/scripts
node $S/lines.mjs apps/web/scripts/.regresion/hitos/diorama-0-claro.html    # debe dar "line ends: 0"
node $S/capture.mjs apps/web/scripts/.regresion/hitos/diorama-0-claro.html --out d0.png
```

La sección entera (reel, teclado, arrastre, movimiento reducido, sin WebGL, celular) se verifica
con `node apps/web/scripts/verificar-reel.mjs`, con el servidor de desarrollo levantado.
