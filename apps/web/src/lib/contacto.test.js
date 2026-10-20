// Tests de la sección Contacto: cadencia de escritura, enlaces, ruta del avión
// y física de la gelatina del footer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pesosAcumulados, indiceDeProgreso } from './contacto/cadencia.js';
import { urlWhatsApp, urlCorreo, estadoPorHora } from './contacto/enlaces.js';
import { crearRutaAvion } from './contacto/rutaAvion.js';
import { Gelatina, suavizarCurva } from '../components/Gelatina/fisicaGelatina.js';
import { crearCredencial, pasoCredencial, soltar, estiramiento, alcanceArrastre } from '../components/Contacto/fisicaCredencial.js';

function credencialDePrueba() {
  return crearCredencial({ ancla: { x: 250, y: -30 }, largoCinta: 220, largoTarjeta: 564 });
}

test('credencial: la cinta es elástica (se estira con el peso) y se asienta colgando', () => {
  const f = credencialDePrueba();
  for (let i = 0; i < 900; i++) pasoCredencial(f, 1 / 60);
  const e = estiramiento(f);
  assert.ok(e > 1.03 && e < 1.3, `estiramiento en reposo ${e.toFixed(3)}`);
  assert.ok(Math.abs(f.C.x - f.P.x) < 2, 'cuelga recta');
  assert.ok(Math.abs(Math.sin(f.giro * 2)) < 0.05, 'queda de frente o de espaldas');
});

test('credencial: arrastrarla y soltarla no la hace explotar ni salir disparada', () => {
  const f = credencialDePrueba();
  for (let i = 0; i < 120; i++) pasoCredencial(f, 1 / 60);
  for (let i = 0; i < 60; i++) {
    const objetivo = { x: 250 + i * 6, y: 520 };
    const d = Math.hypot(objetivo.x - f.ancla.x, objetivo.y - f.ancla.y);
    const k = Math.min(1, alcanceArrastre(f, 0.5) / d);
    f.agarre = { x: f.ancla.x + (objetivo.x - f.ancla.x) * k, y: f.ancla.y + (objetivo.y - f.ancla.y) * k, t: 0.5 };
    pasoCredencial(f, 1 / 60);
  }
  soltar(f);
  let minimoY = Infinity;
  for (let i = 0; i < 900; i++) {
    pasoCredencial(f, 1 / 60);
    minimoY = Math.min(minimoY, f.P.y);
  }
  const puntos = [f.P, f.C, ...f.cuerda];
  assert.ok(puntos.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y)), 'sin NaN');
  assert.ok(minimoY > f.ancla.y - 40, `no sube por encima del ancla (mínimo ${minimoY.toFixed(0)})`);
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

test('ruta del avión: es continua (sin saltos entre cuadros)', () => {
  const ruta = crearRutaAvion({ inicio: { x: 1290, y: 700 }, ancho: 1440, alto: 900, vueltas: 1 });
  let anterior = ruta.enRuta(0);
  let saltoMax = 0;
  for (let i = 1; i <= 600; i++) {
    const q = ruta.enRuta((ruta.total * i) / 600);
    saltoMax = Math.max(saltoMax, Math.hypot(q.x - anterior.x, q.y - anterior.y));
    anterior = q;
  }
  assert.ok(saltoMax < (ruta.total / 600) * 1.01, `salto máximo ${saltoMax}`);
  assert.ok(ruta.enRuta(ruta.total).y < 0, 'termina fuera de la pantalla');
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
  assert.ok(gel.pos.at(-1)[1] - base > 0.03, 'la punta queda un poquito levantada');
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
