// Hito 6 — Hoy, lo que viene: una escalinata hasta una puerta que brilla por los bordes y, del otro lado,
// escalones que todavía flotan sin terminar. Mucho aire: una mochila lista, una brújula y un
// cartel que señala hacia afuera.
import { D, L, a, ac, arbusto, aro, caja, camino, caraX, cil, costura, en, escena, isla, k, laja, plano, porFondo, proyeccion, puntosIsla, sombra, tornillos, tramo } from '../taller.mjs';

const RELLANO = { x: -40, y: -17, w: 22, d: 34, alto: 15 };

function escalinata() {
  const P = proyeccion();
  const out = [sombra(plano(RELLANO.x, RELLANO.y, 62, RELLANO.d, 2), 0, 6)];
  // rellano, y cinco escalones que bajan hacia quien mira
  out.push(caja(RELLANO.x, RELLANO.y, RELLANO.w, RELLANO.d, 0, RELLANO.alto, { r: 0.8, tono: 'mid', bisel: 0.5, dentro: costura(plano(RELLANO.x, RELLANO.y, RELLANO.w, RELLANO.d, 0.8), RELLANO.alto - 1.8, 3) }));
  for (let i = 0; i < 5; i++) {
    const x = RELLANO.x + RELLANO.w + i * 8;
    const alto = 12.5 - i * 2.5;
    out.push(caja(x, RELLANO.y + 3, 8, RELLANO.d - 6, 0, alto, { r: 0.6, tono: 'mid', pasos: 2, bisel: 0.4 }));
  }
  // la alfombra del color del hito baja por el medio
  for (let i = 0; i < 5; i++) {
    const x = RELLANO.x + RELLANO.w + i * 8;
    out.push(ac('hito', caja(x, -5, 8, 10, 12.5 - i * 2.5, 0.3, { r: 0.2, tono: 'hi', pasos: 2, bisel: 0 })));
  }
  out.push(ac('hito', caja(RELLANO.x + 8, -5, RELLANO.w - 8, 10, RELLANO.alto, 0.3, { r: 0.2, tono: 'hi', pasos: 2, bisel: 0 })));

  // el marco de la puerta, con la hoja cerrada: la luz de lo que viene se cuela por los bordes.
  // La hoja se abre recién al pasar a Proyectos (la abre ReelHitos.jsx, apoyando una hoja igual
  // sobre el vano), así que acá va cerrada y al ras del vano.
  const X = RELLANO.x + 5;
  const Z = RELLANO.alto;
  const poste = (y) => caja(X, y, 3, 3, Z, 31, { r: 0.5, tono: 'hi', pasos: 2, bisel: 0.3 });
  out.push(poste(-12.5));
  const cuarteron = (z0, z1) => caraX(X + 1.5, -6.9, 6.9, z0, z1);
  out.push(ac('hito', caja(X + 0.3, -9.5, 1.2, 19, Z + 0.3, 30.7, { r: 0, tono: 'hi', pasos: 2, bisel: 0, dentro: L(cuarteron(Z + 3.2, Z + 13) + cuarteron(Z + 16, Z + 28.2), { tone: 'mid' }) })));
  // el picaporte, del lado que abre
  out.push(D([en([X + 1.5, -7.6, Z + 14.5])], { size: 1, tone: 'hi' }));
  // el umbral encendido: un contorno que late, y la luz que cae sobre el rellano
  out.push(a.amPulse(ac('led', L(caraX(X + 1.5, -9.5, 9.5, Z + 0.3, Z + 31), { tone: 'lit' }) + L(k.planOutline(plano(X + 3, -8, 12, 16, 1), Z + 0.3, P, 3), { tone: 'lit' })), { period: 4200, min: 0.25 }));
  out.push(poste(9.5));
  out.push(caja(X - 0.4, -13.5, 3.8, 27, Z + 31, 3, { r: 0.5, tono: 'hi', pasos: 2, bisel: 0.4 }));
  return out.join('');
}

// Lo que viene: escalones que siguen subiendo después de la puerta, cada vez menos terminados.
function porvenir() {
  const P = proyeccion();
  const pasos = [
    { x: -50, z: 19, alfa: 1 },
    { x: -58, z: 24, alfa: 0.7 },
  ];
  const out = pasos.map(({ x, z, alfa }, i) => {
    const pl = plano(x, -9, 7, 18, 0.6);
    const paso = caja(pl.x, pl.y, pl.w, pl.d, z, 2, { r: 0.6, tono: 'mid', pasos: 2, bisel: 0.3 });
    return `<g opacity="${alfa}">${a.amFloat(paso, P, { rise: 3, period: 4600, delay: i * 1500, halo: '' })}</g>`;
  });
  // el siguiente todavía es un trazo
  out.push(a.amPulse(ac('led', L(k.planOutline(plano(-65, -9, 6, 18, 0.6), 29, P, 2), { tone: 'lit', dashed: true })), { period: 2800, min: 0.15 }));
  return out.join('');
}

function mochila() {
  const P = proyeccion();
  const M = plano(-6, 22, 13, 17, 3);
  return (
    sombra(M, 0, 5) +
    caja(M.x, M.y, M.w, M.d, 0, 19, { r: 3, tono: 'hi', pasos: 6, bisel: 0.6, dentro: costura(M, 14, 6) }) +
    // bolsillo del frente, del color del hito, con su cierre
    ac('hito', caja(M.x + M.w, M.y + 2.4, 2.4, 12.2, 2, 9.4, { r: 1.1, tono: 'hi', pasos: 3, bisel: 0.3 })) +
    L(tramo([M.x + M.w + 2.4, M.y + 4, 9.4], [M.x + M.w + 2.4, M.y + 13, 9.4]), { tone: 'mid', free: true }) +
    D([en([M.x + M.w + 2.4, M.y + 13, 9.4])], { size: 0.7, tone: 'hi' }) +
    // tapa y manija
    caja(M.x - 0.4, M.y - 0.4, M.w + 0.8, M.d + 0.8, 19, 2.4, { r: 3.2, tono: 'mid', pasos: 6, bisel: 0.6 }) +
    caja(M.x + 3, M.y + 6, 3, 5, 21.4, 2.2, { r: 1, tono: 'lo', pasos: 3, bisel: 0 }) +
    // correas a los lados
    caja(M.x + 2, M.y + M.d, 2.4, 0.8, 3, 15, { r: 0.4, tono: 'lo', pasos: 2, bisel: 0 }) +
    caja(M.x + 8, M.y + M.d, 2.4, 0.8, 3, 15, { r: 0.4, tono: 'lo', pasos: 2, bisel: 0 })
  );
}

function brujula() {
  const P = proyeccion();
  const [x, y] = [26, 34];
  const aguja = `<path d="M0 -5.2 L1.3 0 L-1.3 0Z" style="fill:var(--anatomy-lit);stroke:none"/><path d="M0 5.2 L1.3 0 L-1.3 0Z" style="fill:var(--anatomy-mid);stroke:none"/>`;
  return (
    sombra(plano(x - 9, y - 9, 18, 18, 9), 0, 4) +
    cil(x, y, 8.6, 0, 2.6, { tono: 'hi', pasos: 44, bisel: 0.6, dentro: L(k.sideArc(x, y, 8.6, 1.2, P, 30), { tone: 'faint' }) }) +
    ac('celda', cil(x, y, 7, 2.6, 0.3, { tono: 'hi', pasos: 40 })) +
    L(k.radialTicks(x, y, 6.6, 16, 4, 2.9, [0.8, 1.6], P).minor, { tone: 'lo' }) +
    L(k.radialTicks(x, y, 6.6, 16, 4, 2.9, [0.8, 1.6], P).major, { tone: 'hi' }) +
    ac('led', a.amSwing(aguja, a.topPlane([x, y, 3], P), { from: -34, to: -8, period: 4600 })) +
    D([en([x, y, 3])], { size: 1, tone: 'hi' }) +
    cil(x - 8.6, y, 1.4, 0.6, 1.4, { tono: 'mid', pasos: 12 })
  );
}

function cartel() {
  const [x, y] = [44, -34];
  return (
    sombra(plano(x - 3, y - 3, 6, 6, 3), 0, 4) +
    cil(x, y, 2.6, 0, 1.2, { tono: 'lo', pasos: 18, bisel: 0.3 }) +
    cil(x, y, 0.9, 1.2, 36, { tono: 'mid', pasos: 12 }) +
    // dos flechas: una hacia la puerta, otra hacia afuera
    ac('madera', caja(x - 17, y - 0.6, 16, 1.2, 28, 6, { r: 0.4, tono: 'hi', pasos: 2, bisel: 0 })) +
    ac('hito', caja(x - 0.6, y + 1, 1.2, 16, 19, 6, { r: 0.4, tono: 'hi', pasos: 2, bisel: 0 })) +
    D([en([x, y, 37.2])], { size: 1, tone: 'hi' })
  );
}

function cuerpo() {
  const P = proyeccion();
  const e = escena();
  e.poner([-52, 0, 0], porvenir(), -40);
  e.poner([-10, 0, 0], escalinata());
  e.poner([0, 30, 0], mochila());
  e.poner([26, 34, 0], brujula());
  e.poner([44, -34, 0], cartel());
  // lajas que llegan a la escalinata
  for (const [x, y, r] of [[30, 0, 3.6], [39, 3, 3.2], [47, 8, 3.6], [53, 16, 3]]) e.poner([x, y, 0], laja(x, y, r));
  for (const [x, y, r] of [[-52, 36, 4.6], [-44, 42, 3.4], [56, -8, 3.6]]) e.poner([x, y, 0], arbusto(x, y, r));
  return isla() + e.armar();
}

export default {
  etiqueta: 'Una escalinata con una alfombra naranja sube hasta una puerta cerrada que brilla por los bordes; del otro lado flotan escalones sin terminar. Al pie, una mochila lista, una brújula con la aguja oscilando y un cartel con dos flechas.',
  cuerpo,
  puntos: () => puntosIsla(54),
  // puntos de interés (zoom de la portada): dónde están, en el mundo del diorama, y qué cuentan
  detalle: [
    { en: [-33.5, 0, 32], titulo: 'Lo que viene', texto: 'Busco una nueva oportunidad para crecer y seguir adelante en mi vida profesional.' },
    { en: [1, 30, 20], titulo: 'Listo para lo próximo', texto: 'Quiero seguir desarrollándome en lo que tanto me apasiona.' },
  ],
  // el vano de la puerta (sus cuatro esquinas): por ahí se pasa a Proyectos
  puerta: [
    [-33.5, -9.5, 46],
    [-33.5, 9.5, 46],
    [-33.5, 9.5, 15.3],
    [-33.5, -9.5, 15.3],
  ],

};
