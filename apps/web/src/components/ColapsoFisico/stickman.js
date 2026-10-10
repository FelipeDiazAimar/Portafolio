export const ALTO_STICKMAN = 96;

// Qué tan adelante del cuerpo queda la punta del palo al final del retorno, y
// cuánto más se adelanta en el empuje. Tiene que ser ADELANTE de las manos: un
// palo de piso se sostiene inclinado hacia el cuerpo, con la punta más lejos
// que el tope.
const ALCANCE_MINIMO = 36;
const AMPLITUD_BARRIDO = 22;
// Fracción del ciclo que dura el empuje. El resto es el retorno, que va más
// rápido porque el palo vuelve levantado y sin peso.
const PROPORCION_EMPUJE = 0.68;
// Medio ancho del cabezal. Coincide con el ancho del cuerpo físico del palo
// (16 px): lo que se ve empujando es lo que empuja.
const MEDIO_CABEZAL = 8;
const ALTO_CABEZAL = 9;
// El palo es RÍGIDO: su largo no cambia. Lo que se estira y se encoge son los
// brazos, que es lo que pasa de verdad al barrer.
const LARGO_PALO = 68;
// Cada brazo son dos huesos de este largo. Un brazo de palitos es
// proporcionalmente un poco más largo que uno real, para que alcance el palo.
const LARGO_HUESO_BRAZO = 19.5;
// Cuánto sale el cuerpo hacia adelante al empujar, en px.
const INCLINACION_RETORNO = 4;
const INCLINACION_EMPUJE = 10;
// Dónde agarra la mano de arriba, respecto del hombro (hacia adelante y abajo),
// y a qué fracción del camino punta -> mano de arriba agarra la de abajo.
const MANO_ALTA_X = 23;
const MANO_ALTA_Y = 12;
const FRACCION_MANO_BAJA = 0.34;
// Un paso de cada pie por ciclo: ±AMPLITUD_PASO px respecto de la cadera.
const AMPLITUD_PASO = 17;
const LEVANTE_PIE = 7;

// Posición dentro del ciclo de barrido, 0..1.
function faseDelCiclo(paso) {
  return paso - Math.floor(paso);
}

// True mientras la escoba está apoyada empujando. En el retorno se levanta:
// si arrastrara de vuelta desharía lo que acaba de juntar.
export function estaEmpujando(paso) {
  return faseDelCiclo(paso) < PROPORCION_EMPUJE;
}

// Un ciclo de barrido: empuje largo hacia adelante y retorno rápido, como
// alguien que arrastra el palo y lo vuelve a traer.
function curvaBarrido(paso) {
  const t = faseDelCiclo(paso);
  if (t < PROPORCION_EMPUJE) {
    // Empuje: arranca suave, acelera en el medio y frena al final del trazo.
    const p = t / PROPORCION_EMPUJE;
    return p * p * (3 - 2 * p);
  }
  // Retorno: lineal y más corto en tiempo.
  return 1 - (t - PROPORCION_EMPUJE) / (1 - PROPORCION_EMPUJE);
}

// Offset horizontal de la punta del palo respecto de la `x` del stickman. Lo
// usan el dibujo Y el cuerpo físico: si cada uno lo calculara por su cuenta,
// lo que se ve barriendo y lo que empuja se desincronizarían.
export function desplazamientoEscoba(paso, barriendo) {
  if (!barriendo) return ALCANCE_MINIMO;
  return ALCANCE_MINIMO + curvaBarrido(paso) * AMPLITUD_BARRIDO;
}

// Cinemática inversa de un brazo de dos huesos iguales. El codo cae siempre
// del lado de abajo de la línea hombro-mano (con la mano al frente, eso es
// "hacia abajo y atrás"). Si la mano queda fuera de alcance, el brazo se
// estira del todo y apunta hacia ella.
function resolverBrazo(hombro, objetivo) {
  const dx = objetivo.x - hombro.x;
  const dy = objetivo.y - hombro.y;
  const distancia = Math.hypot(dx, dy) || 1;
  const maximo = LARGO_HUESO_BRAZO * 2 - 0.01;
  const alcance = Math.min(distancia, maximo);
  const ux = dx / distancia;
  const uy = dy / distancia;

  const mitad = alcance / 2;
  const altura = Math.sqrt(Math.max(0, LARGO_HUESO_BRAZO ** 2 - mitad ** 2));
  let perpX = -uy;
  let perpY = ux;
  if (perpY < 0) {
    perpX = -perpX;
    perpY = -perpY;
  }

  return {
    codo: {
      x: hombro.x + ux * mitad + perpX * altura,
      y: hombro.y + uy * mitad + perpY * altura,
    },
    mano: { x: hombro.x + ux * alcance, y: hombro.y + uy * alcance },
  };
}

// Posición del pie de una pierna: en apoyo, el pie queda quieto en el suelo
// mientras el cuerpo avanza (se desplaza hacia atrás respecto de la cadera);
// en vuelo, se adelanta levantado.
function posicionPie(paso, desfase) {
  const t = faseDelCiclo(paso + desfase);
  if (t < 0.5) {
    const p = t / 0.5;
    return { x: AMPLITUD_PASO - 2 * AMPLITUD_PASO * p, levante: 0 };
  }
  const p = (t - 0.5) / 0.5;
  return { x: -AMPLITUD_PASO + 2 * AMPLITUD_PASO * p, levante: Math.sin(p * Math.PI) * LEVANTE_PIE };
}

function trazarPierna(ctx, cadera, pie, suelo) {
  const piex = cadera.x + pie.x;
  const piey = suelo - pie.levante;
  // Rodilla a mitad de camino, empujada hacia adelante.
  const rodilla = {
    x: (cadera.x + piex) / 2 + 5,
    y: (cadera.y + piey) / 2,
  };
  ctx.moveTo(cadera.x, cadera.y);
  ctx.lineTo(rodilla.x, rodilla.y);
  ctx.lineTo(piex, piey);
}

// Stickman procedural: sólo líneas, sin sprites ni assets.
export function dibujarStickman(ctx, { x, suelo, paso, barriendo }, color) {
  const alcance = desplazamientoEscoba(paso, barriendo);
  const empujando = barriendo && estaEmpujando(paso);
  const extension = barriendo ? curvaBarrido(paso) : 0;
  const inclinacion = INCLINACION_RETORNO + (INCLINACION_EMPUJE - INCLINACION_RETORNO) * extension;

  // Tronco: la cadera queda sobre `x` y el cuerpo se inclina hacia adelante.
  const cadera = { x: x + extension * 5, y: suelo - ALTO_STICKMAN * 0.44 };
  const cuello = { x: cadera.x + inclinacion, y: suelo - ALTO_STICKMAN + 17 };
  const cabeza = { x: cuello.x + 2, y: suelo - ALTO_STICKMAN + 8.5 };
  const hombro = {
    x: cadera.x + (cuello.x - cadera.x) * 0.88,
    y: cadera.y + (cuello.y - cadera.y) * 0.88,
  };

  // Palo: pasa por la mano de arriba y apoya la punta en el piso. Se define
  // desde las manos (que van pegadas al cuerpo) y no al revés, así el palo
  // queda siempre por DELANTE del torso y los brazos siempre llegan.
  const punta = { x: x + alcance, y: suelo - (empujando ? ALTO_CABEZAL : ALTO_CABEZAL + 6) };
  const manoAlta = { x: hombro.x + MANO_ALTA_X, y: hombro.y + MANO_ALTA_Y };
  const largoDirecto = Math.hypot(manoAlta.x - punta.x, manoAlta.y - punta.y) || 1;
  const dirX = (manoAlta.x - punta.x) / largoDirecto;
  const dirY = (manoAlta.y - punta.y) / largoDirecto;
  const tope = { x: punta.x + dirX * LARGO_PALO, y: punta.y + dirY * LARGO_PALO };
  const manoBaja = {
    x: manoAlta.x + (punta.x - manoAlta.x) * FRACCION_MANO_BAJA,
    y: manoAlta.y + (punta.y - manoAlta.y) * FRACCION_MANO_BAJA,
  };

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Cabeza y torso.
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cabeza.x, cabeza.y, 8.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cuello.x, cuello.y);
  ctx.lineTo(cadera.x, cadera.y);
  ctx.stroke();

  // Piernas: un pie en apoyo mientras el otro se adelanta.
  ctx.beginPath();
  trazarPierna(ctx, cadera, posicionPie(paso, 0), suelo);
  trazarPierna(ctx, cadera, posicionPie(paso, 0.5), suelo);
  ctx.stroke();

  // Palo, del tope a la punta.
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(tope.x, tope.y);
  ctx.lineTo(punta.x, punta.y);
  ctx.stroke();

  // Cabezal: un bloque plano apoyado en el piso, visto de costado. La punta
  // del palo se engancha en el centro de su cara de arriba.
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.rect(punta.x - MEDIO_CABEZAL, punta.y, MEDIO_CABEZAL * 2, ALTO_CABEZAL);
  ctx.stroke();

  // Brazos, encima del palo: las manos agarran exactamente sobre él.
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  const brazoAlto = resolverBrazo(hombro, manoAlta);
  const brazoBajo = resolverBrazo({ x: hombro.x, y: hombro.y + 4 }, manoBaja);
  ctx.moveTo(hombro.x, hombro.y);
  ctx.lineTo(brazoAlto.codo.x, brazoAlto.codo.y);
  ctx.lineTo(brazoAlto.mano.x, brazoAlto.mano.y);
  ctx.moveTo(hombro.x, hombro.y + 4);
  ctx.lineTo(brazoBajo.codo.x, brazoBajo.codo.y);
  ctx.lineTo(brazoBajo.mano.x, brazoBajo.mano.y);
  ctx.stroke();

  // Manos.
  ctx.beginPath();
  ctx.arc(brazoAlto.mano.x, brazoAlto.mano.y, 2.2, 0, Math.PI * 2);
  ctx.arc(brazoBajo.mano.x, brazoBajo.mano.y, 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
