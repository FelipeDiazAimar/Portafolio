// Tests de la sección Contacto: cadencia de escritura, enlaces, ruta del avión
// y física de la gelatina del footer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pesosAcumulados, indiceDeProgreso } from './contacto/cadencia.js';
import { urlWhatsApp, urlCorreo, estadoPorHora } from './contacto/enlaces.js';
import { crearRutaAvion, fraccionRecorrida } from './contacto/rutaAvion.js';
import { Gelatina, suavizarCurva } from '../components/Gelatina/fisicaGelatina.js';
import { crearCredencial, pasoCredencial, soltar, estiramiento, alcanceArrastre } from '../components/Contacto/fisicaCredencial.js';

function credencialDePrueba() {
  // medidas reales de la sección: la cinta mide alto × 0,12 (≈ 110–140 px) y la tarjeta 564 px
  return crearCredencial({ ancla: { x: 250, y: -30 }, largoCinta: 120, largoTarjeta: 564 });
}

test('credencial: la cinta es elástica (se estira con el peso) y se asienta colgando', () => {
  const f = credencialDePrueba();
  for (let i = 0; i < 900; i++) pasoCredencial(f, 1 / 60);
  const e = estiramiento(f);
  assert.ok(e > 1.03 && e < 1.3, `estiramiento en reposo ${e.toFixed(3)}`);
  assert.ok(Math.abs(f.C.x - f.P.x) < 2, 'cuelga recta');
  assert.ok(Math.abs(Math.sin(f.giro * 2)) < 0.05, 'queda de frente o de espaldas');
});

function arrastrar(f, destino, cuadros, t = 0.5) {
  let maximo = 0;
  for (let i = 0; i < cuadros; i++) {
    const dx = destino.x - f.ancla.x;
    const dy = destino.y - f.ancla.y;
    const d = Math.hypot(dx, dy);
    const k = Math.min(1, alcanceArrastre(f, t) / d);
    f.agarre = { x: f.ancla.x + dx * k, y: f.ancla.y + dy * k, t };
    pasoCredencial(f, 1 / 60);
    maximo = Math.max(maximo, estiramiento(f));
  }
  return maximo;
}

test('credencial: la cinta se estira mucho al arrastrarla (casi el triple de su largo)', () => {
  const f = credencialDePrueba();
  for (let i = 0; i < 300; i++) pasoCredencial(f, 1 / 60);
  const enReposo = estiramiento(f);
  const estirada = arrastrar(f, { x: 470, y: 900 }, 90);
  assert.ok(estirada > 2.4, `se estiró ${estirada.toFixed(2)}× (en reposo ${enReposo.toFixed(2)}×)`);
  assert.ok(estirada < 3.6, 'pero no se corta ni se va al infinito');
});

test('credencial: al soltarla estirada rebota un poco, se asienta y no sale disparada', () => {
  const f = credencialDePrueba();
  for (let i = 0; i < 120; i++) pasoCredencial(f, 1 / 60);
  arrastrar(f, { x: 470, y: 900 }, 90);
  soltar(f);
  let minimoY = Infinity;
  for (let i = 0; i < 1200; i++) {
    pasoCredencial(f, 1 / 60);
    minimoY = Math.min(minimoY, f.P.y);
  }
  const puntos = [f.P, f.C, ...f.cuerda];
  assert.ok(puntos.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y)), 'sin NaN');
  assert.ok(minimoY > f.ancla.y - 120, `no sube más de 90 px por encima del ancla (mínimo ${minimoY.toFixed(0)})`);
  assert.ok(estiramiento(f) < 1.3, 'vuelve a su largo de reposo');
  assert.ok(Math.abs(f.C.x - f.P.x) < 4, 'vuelve a colgar recta');
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

test('gelatina: el suavizado duplica los tramos y conserva los extremos', () => {
  const puntos = [[0, 0], [1, 0], [2, 1], [3, 0]];
  const suave = suavizarCurva(puntos, 0);
  assert.equal(suave.length, puntos.length * 2 - 1);
  assert.deepEqual(suave[0], [0, 0]);
  assert.deepEqual(suave.at(-1), [3, 0]);
});
