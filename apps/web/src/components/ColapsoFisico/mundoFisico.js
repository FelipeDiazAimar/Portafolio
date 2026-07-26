import { Bodies, Body, Composite, Engine } from 'matter-js';

const GROSOR_PARED = 200;
const RADIO_CURSOR = 26;
const ANCHO_ESCOBA = 16;
export const ALTO_ESCOBA = 70;
// Las piezas que no participan (cursor y escoba mientras no barre) se
// mandan lejos en vez de sacarse del mundo: agregar/quitar cuerpos en
// caliente invalida los índices de la grabación.
const FUERA_DE_ESCENA = -9999;

// Un cuerpo por celda de glifo, en la posición exacta que ocupa hoy el
// carácter en pantalla. Nacen ESTÁTICOS: el nombre queda colgado y sólo se
// desprende lo que el mouse toca (`liberarCuerpo`); el resto sigue en su
// lugar. Como el cursor también es estático, pasar por encima de una celda
// todavía no liberada no produce ninguna colisión.
export function crearMundo({ ancho, alto, celdas, anchoCaracter, altoCaracter }) {
  const motor = Engine.create();

  const cuerposDeCaracteres = celdas.map((celda) => {
    const cuerpo = Bodies.rectangle(celda.x, celda.y, anchoCaracter, altoCaracter, {
      friction: 0.4,
      restitution: 0.15,
      // Las celdas son de pocos px: con el slop por defecto (0.05) se
      // encajan visiblemente unas dentro de otras al apilarse.
      slop: 0.02,
    });
    // OJO: no se puede pasar `isStatic: true` en las opciones. Body.create
    // hace Common.extend(defaults, options) —que ya deja isStatic en true—
    // ANTES de llamar a Body.setStatic, así que la guarda `if (!part.isStatic)`
    // de setStatic da falso y nunca guarda `_original`. Sin `_original`, el
    // setStatic(false) de `liberarCuerpo` no restaura la masa: queda en
    // Infinity con inverseMass 0, o sea aceleración cero, y el carácter no
    // cae nunca. Creándolo dinámico y congelándolo después, `_original` sí
    // se guarda con la masa real.
    Body.setStatic(cuerpo, true);
    return cuerpo;
  });

  // Piso al pie de la sección (no de la caja del nombre) y paredes a los
  // costados. Las paredes son gruesas a propósito: una pieza chica a
  // velocidad alta atraviesa una pared fina entre dos cuadros.
  const paredes = [
    Bodies.rectangle(ancho / 2, alto + GROSOR_PARED / 2, ancho * 3, GROSOR_PARED, {
      isStatic: true,
    }),
    Bodies.rectangle(-GROSOR_PARED / 2, alto / 2, GROSOR_PARED, alto * 3, { isStatic: true }),
    Bodies.rectangle(ancho + GROSOR_PARED / 2, alto / 2, GROSOR_PARED, alto * 3, {
      isStatic: true,
    }),
  ];

  // Cursor y escoba son estáticos y se teleportan a mano: así empujan en vez
  // de ser empujados.
  const cuerpoCursor = Bodies.circle(FUERA_DE_ESCENA, FUERA_DE_ESCENA, RADIO_CURSOR, {
    isStatic: true,
  });
  const cuerpoEscoba = Bodies.rectangle(
    FUERA_DE_ESCENA,
    FUERA_DE_ESCENA,
    ANCHO_ESCOBA,
    ALTO_ESCOBA,
    { isStatic: true }
  );

  Composite.add(motor.world, [
    ...cuerposDeCaracteres,
    ...paredes,
    cuerpoCursor,
    cuerpoEscoba,
  ]);

  return { motor, cuerposDeCaracteres, cuerpoCursor, cuerpoEscoba };
}

// El tercer argumento actualiza la velocidad del cuerpo a partir del salto.
// Sin él, cursor y escoba entran al solver con velocidad {0,0}: sólo sacan
// a los caracteres del solapamiento en vez de empujarlos, y como Bounds.update
// expande los límites según la velocidad, un movimiento rápido del mouse
// atraviesa la pila sin tocarla.
export function moverCuerpo(cuerpo, x, y) {
  Body.setPosition(cuerpo, { x, y }, true);
}

export function sacarDeEscena(cuerpo) {
  Body.setPosition(cuerpo, { x: FUERA_DE_ESCENA, y: FUERA_DE_ESCENA });
}

// Coloca un cuerpo sin generar velocidad. Hace falta al SACARLO del
// estacionamiento (-9999): con `moverCuerpo` ese salto entra al solver como
// ~14.000 px/paso y dispara los caracteres que toca a través de las paredes.
export function colocarSinImpulso(cuerpo, x, y) {
  Body.setPosition(cuerpo, { x, y });
}

// Desprende una celda: pasa de colgada a caer con gravedad. Sólo se llama
// para las que el mouse efectivamente tocó.
export function liberarCuerpo(cuerpo) {
  Body.setStatic(cuerpo, false);
}

export function destruirMundo(motor) {
  Composite.clear(motor.world, false);
  Engine.clear(motor);
}
