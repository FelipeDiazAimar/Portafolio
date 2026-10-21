// Tests de la sección Contacto: cadencia de escritura, enlaces, ruta del avión
// y física de la gelatina del footer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pesosAcumulados, indiceDeProgreso } from './contacto/cadencia.js';
import { urlWhatsApp, urlCorreo, estadoPorHora } from './contacto/enlaces.js';
import { crearRutaAvion, crearRutaPorLetras, fraccionRecorrida } from './contacto/rutaAvion.js';
import { Gelatina, subdividirCurva } from '../components/Gelatina/fisicaGelatina.js';
import { PUNTOS_CURVA } from '../components/Gelatina/shaderGelatina.js';
import { crearCredencial, pasoCredencial, soltar, estiramiento } from '../components/Contacto/fisicaCredencial.js';

function credencialDePrueba() {
  // medidas reales de la sección: ancla visible cerca de arriba, cinta ≈ 90 px y tarjeta de 564 px
  return crearCredencial({ ancla: { x: 250, y: 96 }, largoCinta: 90, largoTarjeta: 564 });
}

// Lleva el punto agarrado hacia `destino` durante `cuadros` cuadros. Devuelve dónde quedó ese punto.
function arrastrar(f, destino, cuadros, t = 0.5) {
  for (let i = 0; i < cuadros; i++) {
    f.agarre = { x: destino.x, y: destino.y, t };
    pasoCredencial(f, 1 / 60);
  }
  return { x: f.P.x + (f.C.x - f.P.x) * t, y: f.P.y + (f.C.y - f.P.y) * t };
}
const distancia = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

test('credencial: arranca en reposo y se queda quieta (no rebota sola)', () => {
  const f = credencialDePrueba();
  const inicio = { x: f.C.x, y: f.C.y };
  let maximo = 0;
  for (let i = 0; i < 300; i++) {
    pasoCredencial(f, 1 / 60);
    maximo = Math.max(maximo, distancia(f.C, inicio));
  }
  assert.ok(maximo < 0.5, `se movió ${maximo.toFixed(2)} px sin que nadie la toque`);
});

test('credencial: la cinta es elástica (se estira con el peso) y cuelga recta', () => {
  const f = credencialDePrueba();
  const e = estiramiento(f);
  assert.ok(e > 1.03 && e < 1.3, `estiramiento en reposo ${e.toFixed(3)}`);
  assert.ok(Math.abs(f.C.x - f.P.x) < 2, 'cuelga recta');
});

test('credencial: se puede agarrar y estirar la cinta todo lo que se quiera', () => {
  const f = credencialDePrueba();
  const destino = { x: 1200, y: 1400 }; // ≈ 1700 px del ancla: casi 20 veces el largo de la cinta
  const agarrado = arrastrar(f, destino, 120);
  assert.ok(distancia(agarrado, destino) < 8, `el punto agarrado queda a ${distancia(agarrado, destino).toFixed(1)} px del puntero`);
  assert.ok(estiramiento(f) > 8, `la cinta se estiró ${estiramiento(f).toFixed(1)}×`);
  assert.ok([f.P, f.C, ...f.cuerda].every((q) => Number.isFinite(q.x) && Number.isFinite(q.y)), 'sin NaN');
});

test('credencial: al soltarla vuelve a su lugar como un péndulo amortiguado (pocas oscilaciones, sin rebote vertical)', () => {
  const f = credencialDePrueba();
  const reposo = { x: f.P.x, y: f.P.y };
  arrastrar(f, { x: 900, y: 1000 }, 90);
  soltar(f);
  let minimoY = Infinity;
  let cruces = 0;
  let ladoAnterior = Math.sign(f.C.x - reposo.x);
  const cuadros = 480;
  for (let i = 0; i < cuadros; i++) {
    pasoCredencial(f, 1 / 60);
    minimoY = Math.min(minimoY, f.P.y);
    // sólo cuentan las oscilaciones visibles (más de 4 px); el temblor final no
    const desvio = f.C.x - reposo.x;
    const lado = Math.abs(desvio) > 4 ? Math.sign(desvio) : 0;
    if (lado !== 0 && lado !== ladoAnterior) cruces += 1;
    if (lado !== 0) ladoAnterior = lado;
  }
  assert.ok(minimoY > reposo.y - 20, `no pasa por encima de su lugar (sube ${(reposo.y - minimoY).toFixed(0)} px de más)`);
  assert.ok(cruces <= 3, `no se balancea indefinidamente (${cruces} cruces)`);
  assert.ok(distancia(f.P, reposo) < 6, `termina en su lugar (a ${distancia(f.P, reposo).toFixed(1)} px)`);
  assert.ok(estiramiento(f) < 1.3, 'la cinta recupera su largo');
});

test('credencial: al soltarla estirada no tarda una eternidad en volver', () => {
  const f = credencialDePrueba();
  const reposo = { x: f.P.x, y: f.P.y };
  arrastrar(f, { x: 900, y: 1000 }, 90);
  soltar(f);
  for (let i = 0; i < 150; i++) pasoCredencial(f, 1 / 60); // 2,5 s
  assert.ok(distancia(f.P, reposo) < 60, `a los 2,5 s sigue a ${distancia(f.P, reposo).toFixed(0)} px de su lugar`);
});

test('cadencia: la coma y el punto pesan más que una letra', () => {
  const acum = pesosAcumulados('ab, c.');
  const pasos = acum.map((v, i) => v - (acum[i - 1] ?? 0));
  assert.equal(pasos[0], 1);
  assert.ok(pasos[2] > pasos[0], 'la coma demora más');
  assert.ok(pasos[5] > pasos[2], 'el punto demora más que la coma');
});

test('cadencia: progreso 0 no muestra nada y 1 muestra todo', () => {
  const acum = pesosAcumulados('Hola Felipe');
  assert.equal(indiceDeProgreso(acum, 0), 0);
  assert.equal(indiceDeProgreso(acum, 1), 'Hola Felipe'.length);
  assert.ok(indiceDeProgreso(acum, 0.5) > 0 && indiceDeProgreso(acum, 0.5) < 11);
});

test('enlaces: WhatsApp y correo quedan codificados', () => {
  assert.equal(urlWhatsApp('5493564690844', 'Hola, ¿todo bien?'), 'https://wa.me/5493564690844?text=Hola%2C%20%C2%BFtodo%20bien%3F');
  assert.equal(urlCorreo('a@b.com', 'Hola', 'x y'), 'mailto:a@b.com?subject=Hola&body=x%20y');
});

test('estado por hora: de noche duerme, de día responde', () => {
  assert.equal(estadoPorHora(3).durmiendo, true);
  assert.equal(estadoPorHora(14).durmiendo, false);
  assert.equal(estadoPorHora(23).durmiendo, true);
});

const rutaDeEscritorio = () => crearRutaAvion({ inicio: { x: 900, y: 660 }, ancho: 1440, alto: 900, vueltas: 1 });

function muestrear(ruta, paso = 1) {
  const puntos = [];
  for (let s = 0; s <= ruta.total; s += paso) puntos.push(ruta.enRuta(s));
  return puntos;
}

test('ruta del avión: nace exacto en la manija y arranca hacia arriba', () => {
  const ruta = rutaDeEscritorio();
  const q = ruta.enRuta(0);
  assert.ok(Math.hypot(q.x - 900, q.y - 660) < 1e-6, 'empieza en el ícono de la manija');
  assert.ok(Math.abs(q.angulo - -Math.PI / 2) < 1e-6, 'sale apuntando hacia arriba');
  assert.ok(Math.abs(q.curvatura) < 1e-6, 'sin giro brusco al despegar');
});

test('ruta del avión: es continua (sin saltos de posición)', () => {
  const ruta = rutaDeEscritorio();
  const puntos = muestrear(ruta, 1);
  let saltoMax = 0;
  for (let i = 1; i < puntos.length; i++) saltoMax = Math.max(saltoMax, Math.hypot(puntos[i].x - puntos[i - 1].x, puntos[i].y - puntos[i - 1].y));
  assert.ok(saltoMax < 1.02, `salto máximo ${saltoMax.toFixed(3)} px por px recorrido`);
  assert.ok(ruta.enRuta(ruta.total).y < 0, 'termina fuera de la pantalla');
});

test('ruta del avión: la curvatura cambia de forma continua (sin tirones al entrar y salir del rizo)', () => {
  const puntos = muestrear(rutaDeEscritorio(), 1);
  let saltoCurvatura = 0;
  let giroPorPixel = 0;
  for (let i = 1; i < puntos.length; i++) {
    saltoCurvatura = Math.max(saltoCurvatura, Math.abs(puntos[i].curvatura - puntos[i - 1].curvatura));
    giroPorPixel = Math.max(giroPorPixel, Math.abs(puntos[i].angulo - puntos[i - 1].angulo));
  }
  assert.ok(saltoCurvatura < 0.012, `la curvatura normalizada salta como mucho ${saltoCurvatura.toFixed(4)} por px`);
  assert.ok(giroPorPixel < 0.02, `gira como mucho ${giroPorPixel.toFixed(4)} rad por px (radio mínimo ≈ 50 px)`);
});

test('ruta del avión: da un rizo completo y sale a 45° hacia arriba', () => {
  const ruta = rutaDeEscritorio();
  const fin = ruta.enRuta(ruta.total);
  const giro = fin.angulo - ruta.enRuta(0).angulo;
  assert.ok(Math.abs(giro - (2 * Math.PI + Math.PI / 4)) < 1e-6, `giro total ${(giro / Math.PI).toFixed(3)}π`);
  assert.ok(Math.abs(Math.cos(fin.angulo) - Math.SQRT1_2) < 1e-6, 'sale hacia la derecha');
  assert.ok(Math.abs(Math.sin(fin.angulo) + Math.SQRT1_2) < 1e-6, 'y hacia arriba (y crece hacia abajo en pantalla)');
});

test('ruta del avión: el doble rizo da dos vueltas completas', () => {
  const ruta = crearRutaAvion({ inicio: { x: 900, y: 660 }, ancho: 1440, alto: 900, vueltas: 2 });
  const giro = ruta.enRuta(ruta.total).angulo - ruta.enRuta(0).angulo;
  assert.ok(Math.abs(giro - (4 * Math.PI + Math.PI / 4)) < 1e-6);
});

test('ruta del avión: con la manija pegada a la derecha (escritorio real) el rizo se espeja y sigue en pantalla', () => {
  const ruta = crearRutaAvion({ inicio: { x: 1275, y: 658 }, ancho: 1440, alto: 900, vueltas: 1 });
  assert.equal(ruta.sentido, -1, 'a la derecha no entra un rizo horario');
  const rizo = muestrear(ruta, 2).filter((q) => q.curvatura !== 0);
  for (const q of rizo) assert.ok(q.x > 0 && q.x < 1440 && q.y > 0, `se sale en (${q.x.toFixed(0)}, ${q.y.toFixed(0)})`);
});

test('ruta del avión: en pantallas angostas el rizo gira hacia adentro y no se sale', () => {
  const ruta = crearRutaAvion({ inicio: { x: 330, y: 700 }, ancho: 390, alto: 844, vueltas: 1 });
  const rizo = muestrear(ruta, 2).filter((q) => q.curvatura !== 0);
  assert.ok(rizo.length > 100);
  for (const q of rizo) assert.ok(q.x > 0 && q.x < 390 && q.y > 0, `se sale en (${q.x.toFixed(0)}, ${q.y.toFixed(0)})`);
  assert.ok(ruta.enRuta(ruta.total).x < 330, 'sale hacia el lado contrario (izquierda) porque el rizo es antihorario');
});

// Medidas de la sección en escritorio (1440 × 900): la "o" y la "b" de "Hablemos." y la manija del email.
const LETRAS_ESCRITORIO = [
  { x: 1075, y: 258, radio: 17 }, // o
  { x: 720, y: 258, radio: 17 }, // b
];
const rutaPorLetras = (extra = {}) =>
  crearRutaPorLetras({ inicio: { x: 1275, y: 658 }, ancho: 1440, alto: 900, letras: LETRAS_ESCRITORIO, ...extra });

function distanciaMinima(ruta, punto) {
  let minimo = Infinity;
  for (let s = 0; s <= ruta.total; s += 0.5) {
    const q = ruta.enRuta(s);
    minimo = Math.min(minimo, Math.hypot(q.x - punto.x, q.y - punto.y));
  }
  return minimo;
}

test('ruta por letras: el avión pasa por el centro de la "o" y de la "b"', () => {
  const ruta = rutaPorLetras();
  assert.ok(ruta, 'hay ruta para este diseño');
  for (const letra of LETRAS_ESCRITORIO) {
    const d = distanciaMinima(ruta, letra);
    assert.ok(d < 3, `pasa a ${d.toFixed(1)} px del centro de la letra en (${letra.x}, ${letra.y})`);
  }
});

test('ruta por letras: cada letra se atraviesa en un giro (el rizo la toca por arriba)', () => {
  const ruta = rutaPorLetras();
  for (const letra of LETRAS_ESCRITORIO) {
    // el punto de la ruta más cercano a la letra tiene que estar girando (curvatura ≈ el rizo), no en recta
    let mejor = null;
    for (let s = 0; s <= ruta.total; s += 0.5) {
      const q = ruta.enRuta(s);
      const d = Math.hypot(q.x - letra.x, q.y - letra.y);
      if (!mejor || d < mejor.d) mejor = { d, curvatura: q.curvatura };
    }
    assert.ok(Math.abs(mejor.curvatura) > 0.7, `al pasar por la letra gira (curvatura normalizada ${mejor.curvatura.toFixed(2)})`);
  }
});

test('ruta por letras: nace exacto en la manija, sale hacia arriba y termina fuera de pantalla', () => {
  const ruta = rutaPorLetras();
  const q = ruta.enRuta(0);
  assert.ok(Math.hypot(q.x - 1275, q.y - 658) < 1e-6, 'empieza en el ícono de la manija');
  assert.ok(Math.abs(q.angulo - -Math.PI / 2) < 1e-3, 'sale apuntando hacia arriba');
  const fin = ruta.enRuta(ruta.total);
  assert.ok(fin.y < -50, `termina por arriba de la pantalla (y = ${fin.y.toFixed(0)})`);
});

test('ruta por letras: es continua y sin tirones', () => {
  const ruta = rutaPorLetras();
  let salto = 0;
  let giro = 0;
  let curvatura = 0;
  let anterior = ruta.enRuta(0);
  for (let s = 1; s <= ruta.total; s += 1) {
    const q = ruta.enRuta(s);
    salto = Math.max(salto, Math.hypot(q.x - anterior.x, q.y - anterior.y));
    giro = Math.max(giro, Math.abs(q.angulo - anterior.angulo));
    curvatura = Math.max(curvatura, Math.abs(q.curvatura - anterior.curvatura));
    anterior = q;
  }
  assert.ok(salto < 1.05, `salta ${salto.toFixed(3)} px por px recorrido`);
  assert.ok(giro < 0.05, `gira ${giro.toFixed(4)} rad por px como mucho`);
  assert.ok(curvatura < 0.02, `la curvatura normalizada cambia ${curvatura.toFixed(4)} por px como mucho`);
});

test('ruta por letras: el rizo y las vueltas se quedan dentro de la pantalla', () => {
  const ruta = rutaPorLetras();
  let enVuelo = true;
  for (let s = 0; s <= ruta.total && enVuelo; s += 2) {
    const q = ruta.enRuta(s);
    if (q.y < 0) enVuelo = false; // ya salió por arriba
    else assert.ok(q.x > 0 && q.x < 1440 && q.y < 900, `se sale en (${q.x.toFixed(0)}, ${q.y.toFixed(0)})`);
  }
});

test('ruta por letras: la cercanía marca cuándo el avión está por entrar en el hueco de una letra', () => {
  const ruta = rutaPorLetras();
  let maximo = 0;
  let lejos = 1;
  for (let s = 0; s <= ruta.total; s += 1) {
    const q = ruta.enRuta(s);
    maximo = Math.max(maximo, q.cercania);
    lejos = Math.min(lejos, q.cercania);
  }
  assert.ok(maximo > 0.95, `en el hueco la cercanía llega a ${maximo.toFixed(2)}`);
  assert.equal(lejos, 0, 'lejos de las letras vale 0');
  assert.equal(ruta.enRuta(0).cercania, 0, 'al despegar todavía no está cerca');
});

test('ruta por letras: si el diseño no da lugar, devuelve null para usar la ruta de siempre', () => {
  // letras fuera de la pantalla (título scrolleado hacia arriba)
  assert.equal(rutaPorLetras({ letras: [{ x: 1075, y: -40, radio: 17 }, { x: 720, y: -40, radio: 17 }] }), null);
  // la manija está por encima de donde tendrían que ir los rizos
  assert.equal(rutaPorLetras({ inicio: { x: 1275, y: 300 } }), null);
  // la manija está entre las dos letras: no hay por dónde entrar a la primera
  assert.equal(rutaPorLetras({ inicio: { x: 900, y: 700 } }), null);
  // a la izquierda de las letras sí hay ruta: se arma espejada
  assert.ok(rutaPorLetras({ inicio: { x: 500, y: 700 } }));
  // sin letras
  assert.equal(rutaPorLetras({ letras: [] }), null);
});

test('perfil de velocidad: arranca suave, nunca retrocede y llega al final', () => {
  assert.equal(fraccionRecorrida(0), 0);
  assert.ok(Math.abs(fraccionRecorrida(1) - 1) < 1e-9);
  let anterior = 0;
  let velocidadInicial = 0;
  for (let i = 1; i <= 1000; i++) {
    const f = fraccionRecorrida(i / 1000);
    assert.ok(f >= anterior, 'no retrocede');
    if (i === 5) velocidadInicial = (f - anterior) * 1000;
    anterior = f;
  }
  const velocidadMedia = 1;
  assert.ok(velocidadInicial < velocidadMedia * 0.2, `arranca despacio (${velocidadInicial.toFixed(3)} de la velocidad media)`);
});

function simular(x, cuadros = 300) {
  const gel = new Gelatina();
  for (let i = 0; i < cuadros; i++) {
    gel.setDragX(x);
    gel.update(1 / 60);
  }
  return gel;
}

test('gelatina: al 100 % queda lisa, salvo la puntita levantada', () => {
  const gel = simular(Gelatina.MAX_X);
  const base = gel.baseY + gel.yOffset;
  const cuerpo = gel.pos.slice(0, -3);
  assert.ok(cuerpo.every((p) => p[1] - base < 0.01), 'el cuerpo está apoyado');
  const levante = gel.pos.at(-1)[1] - base;
  assert.ok(levante > 0.025 && levante < 0.05, `la punta queda apenas levantada (${levante.toFixed(3)})`);
});

test('gelatina: con nota baja se arquea y nunca pasa de la punta', () => {
  const gel = simular(0.3);
  const base = gel.baseY + gel.yOffset;
  assert.ok(Math.max(...gel.pos.map((p) => p[1])) - base > 0.15, 'hay arco');
  assert.ok(gel.pos.every((p) => p[0] <= 0.3 + 1e-9), 'ningún punto pasa la punta');
});

test('gelatina: la curva se subdivide en 128 tramos lisos que pasan por los puntos de la física', () => {
  const gel = simular(0.3);
  const piso = gel.baseY + gel.yOffset;
  const curva = subdividirCurva(gel.pos, 8, piso);
  assert.equal(curva.length, PUNTOS_CURVA, 'el shader espera exactamente PUNTOS_CURVA puntos');
  assert.equal(PUNTOS_CURVA, (gel.n - 1) * 8 + 1);
  gel.pos.forEach((p, i) => {
    assert.ok(Math.abs(curva[i * 8][0] - p[0]) < 1e-9 && Math.abs(curva[i * 8][1] - Math.max(piso, p[1])) < 1e-9, `pasa por el punto ${i}`);
  });
  assert.ok(curva.every((p) => p[1] >= piso - 1e-12), 'nunca baja del piso');
});

test('gelatina: sin quiebres visibles (el ángulo entre tramos vecinos es mínimo)', () => {
  const gel = simular(0.2); // bien arqueada
  const curva = subdividirCurva(gel.pos, 8, gel.baseY + gel.yOffset);
  let mayor = 0;
  for (let i = 2; i < curva.length; i++) {
    const a1 = Math.atan2(curva[i - 1][1] - curva[i - 2][1], curva[i - 1][0] - curva[i - 2][0]);
    const a2 = Math.atan2(curva[i][1] - curva[i - 1][1], curva[i][0] - curva[i - 1][0]);
    let d = Math.abs(a2 - a1);
    if (d > Math.PI) d = 2 * Math.PI - d;
    mayor = Math.max(mayor, d);
  }
  // con 16 tramos físicos el quiebre máximo era de decenas de grados; con 128 queda por debajo de ~13°
  assert.ok(mayor < 0.23, `el mayor quiebre entre tramos es de ${((mayor * 180) / Math.PI).toFixed(1)}°`);
});

test('ruta por letras: el avión frena al cruzar el hueco de cada letra y llega a recorrer toda la ruta', () => {
  const ruta = rutaPorLetras();
  assert.ok(ruta.distanciaPara(0) < 1 && Math.abs(ruta.distanciaPara(1) - ruta.total) < 1.5, 'va de 0 a total');
  let anterior = -1;
  for (let k = 0; k <= 400; k++) {
    const d = ruta.distanciaPara(k / 400);
    assert.ok(d >= anterior, 'nunca retrocede');
    anterior = d;
  }
  // velocidad (px de ruta por unidad de fracción) cerca de un hueco vs. lejos de todos
  const velocidadEn = (f) => (ruta.distanciaPara(f + 0.002) - ruta.distanciaPara(f - 0.002)) / 0.004;
  let enHueco = Infinity;
  let lejos = 0;
  for (let k = 20; k < 380; k++) {
    const f = k / 400;
    const q = ruta.enRuta(ruta.distanciaPara(f));
    if (q.cercania > 0.95) enHueco = Math.min(enHueco, velocidadEn(f));
    if (q.cercania === 0) lejos = Math.max(lejos, velocidadEn(f));
  }
  assert.ok(enHueco < lejos * 0.6, `en el hueco va más lento (${enHueco.toFixed(0)} contra ${lejos.toFixed(0)})`);
  assert.ok(ruta.duracionRelativa > 1, 'tarda más que sin frenar');
});

// Celular (390 × 844): los slides van abajo y a la izquierda, o sea que la manija queda a la
// izquierda de las letras y el recorrido tiene que armarse espejado y sin rizos.
const LETRAS_CELULAR = [
  { x: 262, y: 296, radio: 7 }, // o
  { x: 148, y: 296, radio: 7 }, // b
];
const rutaCelular = (extra = {}) =>
  crearRutaPorLetras({ inicio: { x: 58, y: 690 }, ancho: 390, alto: 844, letras: LETRAS_CELULAR, rizos: false, ...extra });

test('ruta por letras en celular: sin rizos, espejada, pasa por el hueco de la "b" y de la "o" y es continua', () => {
  const ruta = rutaCelular();
  assert.ok(ruta, 'en el celular tiene que existir (antes caía al recorrido de círculos)');
  const q0 = ruta.enRuta(0);
  assert.ok(Math.hypot(q0.x - 58, q0.y - 690) < 1.5, 'sale de la manija');
  for (const letra of LETRAS_CELULAR) assert.ok(distanciaMinima(ruta, letra) < 3, `cruza el hueco en (${letra.x}, ${letra.y})`);
  // primero cruza la "b" (la más cercana a la manija, a la izquierda) y después la "o"
  const posicionDe = (letra) => {
    let mejor = 0;
    let mejorDist = Infinity;
    for (let s = 0; s <= ruta.total; s += 0.5) {
      const q = ruta.enRuta(s);
      const d = Math.hypot(q.x - letra.x, q.y - letra.y);
      if (d < mejorDist) { mejorDist = d; mejor = s; }
    }
    return mejor;
  };
  assert.ok(posicionDe(LETRAS_CELULAR[1]) < posicionDe(LETRAS_CELULAR[0]), 'la "b" antes que la "o"');
  // sin rizos: el avión nunca da una vuelta completa (el giro acumulado entre dos puntos cualesquiera < 1,6 π)
  let acumulado = 0;
  let giroMaximo = 0;
  let previo = ruta.enRuta(0).angulo;
  let minimo = previo;
  let maximo = previo;
  for (let s = 1; s <= ruta.total; s += 1) {
    const a = ruta.enRuta(s).angulo;
    assert.ok(Math.abs(a - previo) < 0.12, `ángulo continuo (salto de ${(Math.abs(a - previo) * 180 / Math.PI).toFixed(1)}° en s=${s})`);
    previo = a;
    minimo = Math.min(minimo, a);
    maximo = Math.max(maximo, a);
    acumulado += Math.abs(a);
  }
  giroMaximo = maximo - minimo;
  assert.ok(giroMaximo < 1.6 * Math.PI, `no da vueltas en círculos (rango de ángulos ${(giroMaximo / Math.PI).toFixed(2)} π)`);
  const fin = ruta.enRuta(ruta.total);
  assert.ok(fin.y < -100 || fin.x < -100 || fin.x > 390 + 100, 'se va de la pantalla');
});

test('ruta por letras: en escritorio sigue habiendo rizos y la versión sin rizos no los hace', () => {
  const conRizos = rutaPorLetras();
  const sinRizos = rutaPorLetras({ rizos: false });
  assert.ok(conRizos && sinRizos);
  const rango = (ruta) => {
    let min = Infinity;
    let max = -Infinity;
    for (let s = 0; s <= ruta.total; s += 1) {
      const a = ruta.enRuta(s).angulo;
      min = Math.min(min, a);
      max = Math.max(max, a);
    }
    return max - min;
  };
  assert.ok(rango(conRizos) > 4 * Math.PI, 'con rizos hace al menos dos vueltas completas');
  assert.ok(rango(sinRizos) < 1.6 * Math.PI, 'sin rizos no da vueltas');
});
