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
// carácter en pantalla. Nacen dinámicos: el pedido es que la pila entera se
// derrumbe al tocarla, no sólo la parte que roza el cursor.
export function crearMundo({ ancho, alto, celdas, anchoCaracter, altoCaracter }) {
  const motor = Engine.create();
  motor.gravity.y = 1;

  const cuerposDeCaracteres = celdas.map((celda) =>
    Bodies.rectangle(celda.x, celda.y, anchoCaracter, altoCaracter, {
      friction: 0.4,
      restitution: 0.15,
      // Las celdas son de pocos px: con el slop por defecto (0.05) se
      // encajan visiblemente unas dentro de otras al apilarse.
      slop: 0.02,
    })
  );

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

export function moverCuerpo(cuerpo, x, y) {
  Body.setPosition(cuerpo, { x, y });
}

export function sacarDeEscena(cuerpo) {
  Body.setPosition(cuerpo, { x: FUERA_DE_ESCENA, y: FUERA_DE_ESCENA });
}

// Fracción de piezas prácticamente quietas — dispara la entrada del stickman.
export function fraccionQuieta(cuerpos, umbralVelocidad = 0.4) {
  if (cuerpos.length === 0) return 1;
  let quietas = 0;
  for (const cuerpo of cuerpos) {
    if (cuerpo.speed < umbralVelocidad) quietas += 1;
  }
  return quietas / cuerpos.length;
}

export function destruirMundo(motor) {
  Composite.clear(motor.world, false);
  Engine.clear(motor);
}
