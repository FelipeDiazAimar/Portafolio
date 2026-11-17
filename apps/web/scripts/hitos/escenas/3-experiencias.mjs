// Hito 3 — 2024, primeras experiencias: el banco del laboratorio con una placa madre abierta y
// su cooler girando, la pizarra del ingreso con un diagrama de flujo que se dibuja solo, y los
// cuatro trabajos freelance como cuatro ventanas en cascada junto a la notebook.
import { D, L, a, ac, aro, banqueta, caja, camino, caraY, cil, costura, en, escena, isla, k, mesa, notebook, pizarra, plano, porFondo, proyeccion, puntosIsla, sombra, torno, torrePC, tornillos, tramo, ventana } from '../taller.mjs';

const BANCO = plano(-58, -44, 62, 36, 1.2);
const T = 29;

function sobreElBanco() {
  const P = proyeccion();
  const e = escena();
  // placa madre: el PCB es del color del hito
  const M = plano(-52, -40, 34, 28, 0.8);
  const Z = T + 1;
  const piezas = [];
  const pieza = (clave, svg) => piezas.push({ clave, svg });
  // zócalo del procesador, con su palanca
  pieza([M.x + 12, M.y + 9, Z], caja(M.x + 7, M.y + 4, 10, 10, Z, 1, { r: 0.5, tono: 'hi', pasos: 2, bisel: 0.2 }) + L(k.planOutline(plano(M.x + 8.6, M.y + 5.6, 6.8, 6.8, 0.3), Z + 1, P, 2), { tone: 'lo' }) + D(k.dotGrid(M.x + 9.8, M.y + 6.8, 4, 4, 1.5, Z + 1, P), { size: 0.3, tone: 'mid' }));
  // memorias: dos puestas y dos ranuras vacías
  [0, 1, 2, 3].forEach((i) => {
    const x = M.x + 20.6 + i * 2.4;
    pieza([x, M.y + 10, Z], i < 2 ? ac('ebano', caja(x, M.y + 3, 1, 15, Z, 3.6, { r: 0.2, tono: 'hi', pasos: 2, bisel: 0 })) + ac('papel', caja(x + 1, M.y + 6, 0.2, 6, Z + 1, 1.8, { r: 0.1, tono: 'hi', pasos: 2, bisel: 0 })) : ac('celda', caja(x, M.y + 3, 1, 15, Z, 0.8, { r: 0.2, tono: 'hi', pasos: 2, bisel: 0 })));
  });
  // ranuras de expansión
  [0, 1].forEach((i) => pieza([M.x + 12, M.y + 19 + i * 3.6, Z], ac('celda', caja(M.x + 4, M.y + 18.4 + i * 3.6, 17, 1.2, Z, 0.9, { r: 0.2, tono: 'hi', pasos: 2, bisel: 0 }))));
  // capacitores, pila y conector de alimentación
  [[4, 7], [4, 11], [30.6, 21], [30.6, 24.4]].forEach(([dx, dy]) => pieza([M.x + dx, M.y + dy, Z], cil(M.x + dx, M.y + dy, 1, Z, 2.4, { tono: 'hi', pasos: 12, bisel: 0.2 })));
  pieza([M.x + 25, M.y + 22.6, Z], cil(M.x + 25, M.y + 22.6, 1.8, Z, 0.6, { tono: 'hi', pasos: 18 }) + aro(M.x + 25, M.y + 22.6, 1.1, Z + 0.6, 'lo', 12));
  pieza([M.x + 31.4, M.y + 9, Z], caja(M.x + 30.4, M.y + 3, 2, 12, Z, 1.8, { r: 0.3, tono: 'mid', pasos: 2, bisel: 0 }));
  // panel trasero
  pieza([M.x + 1.6, M.y + 14, Z], caja(M.x + 0.4, M.y + 15, 3.4, 10, Z, 4, { r: 0.4, tono: 'mid', pasos: 2, bisel: 0.2 }));
  e.poner(
    [M.x + 17, M.y + 14, T],
    sombra(M, T, 2.5) +
      ac('hito', caja(M.x, M.y, M.w, M.d, T, 1, { r: 0.8, tono: 'hi', bisel: 0.3 })) +
      ac('hito', L(camino([[M.x + 16, M.y + 9, Z], [M.x + 21, M.y + 9, Z]]) + camino([[M.x + 12, M.y + 14, Z], [M.x + 12, M.y + 18.4, Z]]) + camino([[M.x + 4, M.y + 12, Z], [M.x + 4, M.y + 16, Z], [M.x + 7, M.y + 18.4, Z]]) + camino([[M.x + 25.9, M.y + 17.4, Z], [M.x + 25.9, M.y + 19.6, Z], [M.x + 25, M.y + 21, Z]]), { tone: 'mid' })) +
      tornillos(k.corners(M, 1.8), Z, 0.9) +
      porFondo(piezas, (p) => p.clave).map((p) => p.svg).join('')
  );

  // cooler recién sacado: disipador de aletas con el ventilador girando encima
  const [cx, cy] = [-8, -32];
  const aletas = Array.from({ length: 7 }, (_, i) => caja(cx - 6 + i * 1.8, cy - 6, 1, 12, T + 1.2, 6, { r: 0.2, tono: 'mid', pasos: 2, bisel: 0 })).join('');
  e.poner(
    [cx, cy, T],
    sombra(plano(cx - 7, cy - 7, 14, 14, 1), T, 2.5) +
      caja(cx - 6.6, cy - 6.6, 13.2, 13.2, T, 1.2, { r: 0.6, tono: 'mid', pasos: 2, bisel: 0.2 }) +
      aletas +
      caja(cx - 6.6, cy - 6.6, 13.2, 13.2, T + 7.2, 2.6, { r: 1.2, tono: 'hi', pasos: 3, bisel: 0.3 }) +
      ac('celda', cil(cx, cy, 5.6, T + 9.8, 0.3, { tono: 'hi', pasos: 30 })) +
      ac('led', a.amRotor([cx, cy, T + 10.5], [1, 0, 0], [0, 1, 0], P, { count: 7, r0: 1.3, r1: 5, chord: 2.2, tip: 1.4, period: 760, thickness: 0.3 })) +
      cil(cx, cy, 1.5, T + 10.1, 0.9, { tono: 'hi', pasos: 14, bisel: 0.2 }) +
      tornillos(k.corners(plano(cx - 6.6, cy - 6.6, 13.2, 13.2, 1), 1.4), T + 9.8, 0.7)
  );

  // bandejita de tornillos, destornillador y pasta térmica
  e.poner([-12, -14, T], cil(-12, -14, 4, T, 1.2, { tono: 'mid', pasos: 24, bisel: 0.3 }) + aro(-12, -14, 3, T + 1.2, 'faint', 20) + D([[-13, -15], [-11, -13.4], [-12.6, -12.6], [-10.6, -15.2]].map(([x, y]) => en([x, y, T + 1.2])), { size: 0.55, tone: 'hi' }));
  e.poner([-30, -11, T], torno([[0, 0.2], [9, 0.4], [9, 1.5], [15, 1.7]], [-38, -10.6, T + 1.7], [0.98, -0.18, 0], { tone: 'mid' }) + ac('hito', torno([[10, 1.9], [14.4, 2]], [-38, -10.6, T + 1.7], [0.98, -0.18, 0])));
  e.poner([-46, -11, T], ac('papel', torno([[0, 0.5], [1.4, 1.2], [7, 1.2]], [-52, -10.6, T + 1.2], [1, 0.1, 0])) + torno([[7, 1.35], [8.6, 1.35]], [-52, -10.6, T + 1.2], [1, 0.1, 0], { tone: 'mid' }));
  return e.armar();
}

// Diagrama de flujo sobre la pizarra (plano y = Y): inicio, decisión y dos salidas.
function diagrama(Y) {
  const P = proyeccion();
  const rect = (x0, x1, z0, z1) => caraY(Y, x0, x1, z0, z1);
  const rombo = (x, z, rx, rz) => camino([[x, Y, z + rz], [x + rx, Y, z], [x, Y, z - rz], [x - rx, Y, z]], true);
  const formas = ac('tinta', L(rect(26, 38, 41, 45.4) + rombo(32, 33, 6.4, 4.2) + rect(26, 38, 20.6, 25) + rect(44, 56, 30.8, 35.2), { tone: 'mid' }));
  const flechas = [
    camino([[32, Y, 41], [32, Y, 37.2]]),
    camino([[32, Y, 28.8], [32, Y, 25]]),
    camino([[38.4, Y, 33], [44, Y, 33]]),
  ];
  return (
    formas +
    // la caja de "inicio" va rellena con renglones; la decisión lleva su signo
    ac('tinta', L(tramo([28.4, Y, 43.2], [35.6, Y, 43.2]) + tramo([28.4, Y, 22.8], [34, Y, 22.8]) + tramo([46.4, Y, 33], [53, Y, 33]), { tone: 'mid', free: true }) + D([en([32, Y, 33])], { size: 1, tone: 'mid' })) +
    flechas.map((d, i) => ac('led', a.amDraw(d, { tone: 'lit', period: 5400, delay: 5400 - i * 620 }))).join('') +
    ac('tinta', D([en([32, Y, 37.2]), en([32, Y, 25]), en([44, Y, 33])], { size: 0.8, tone: 'mid' }))
  );
}

function cuerpo() {
  const e = escena();
  e.poner([-27, -26, 0], mesa(BANCO, T, { grosor: 3 }) + sobreElBanco());

  // pizarra del ingreso, con marcadores en la bandeja
  e.poner(
    [41, -46, 0],
    pizarra(22, 60, -48, 16, 49, 'papel') +
      diagrama(-46.8) +
      ac('hito', caja(26, -46.6, 5, 1.2, 16.2, 1, { r: 0.4, tono: 'hi', pasos: 2, bisel: 0 })) +
      ac('ebano', caja(33, -46.6, 5, 1.2, 16.2, 1, { r: 0.4, tono: 'hi', pasos: 2, bisel: 0 }))
  );

  // escritorio freelance con la notebook
  const E = plano(30, -22, 30, 26, 1);
  e.poner([45, -9, 0], mesa(E, 23, { grosor: 2.4, pata: 2.4 }) + notebook(36, -19, 23, { acento: 'led', lineas: 5 }) + a.amBlink(ac('led', D([en([37.3, -4.6, 26.6])], { size: 1.1, tone: 'lit' })), { period: 1300, min: 0 }) + cil(54, 0, 2.2, 23, 4.4, { tono: 'mid', pasos: 16, bisel: 0.3 }) + aro(54, 0, 1.5, 27.4, 'lo', 12));

  // cuatro trabajos, cuatro ventanas en cascada; la del frente lleva el color del hito
  [[-4, 30], [8, 25], [20, 20], [32, 15]].forEach(([x, y], i) => e.poner([x, y + 8, 0], ventana(x, y, { acento: i === 3 ? 'led' : null, lineas: 4, alto: 13.4 }) + (i === 3 ? a.amBlink(ac('led', D([en([x + 1.4, y + 12.6, 5.6])], { size: 1.1, tone: 'lit' })), { period: 1300, delay: 600, min: 0 }) : ''), i * 0.01));

  // gabinete a medio desarmar, con su tapa apoyada, y una banqueta
  e.poner([-44, 18, 0], sombra(plano(-54, 12, 22, 11, 1), 0, 4) + torrePC(-54, 12, 0, { w: 20, d: 9.4, alto: 21 }));
  e.poner([-30, 26, 0], caja(-33, 25, 20, 1, 0, 18, { r: 0.5, tono: 'mid', pasos: 2, bisel: 0 }) + tornillos([[-31.6, 25.5], [-14.4, 25.5]], 18, 0.6));
  e.poner([-20, 2, 0], banqueta(-20, 2, { alto: 14, r: 6.4 }));

  return isla({ losetas: 20.5 }) + e.armar();
}

export default {
  etiqueta: 'Un banco de laboratorio con una placa madre verde abierta y un cooler con el ventilador girando, una pizarra con un diagrama de flujo, un escritorio con una notebook y cuatro ventanas de sitios web en cascada.',
  cuerpo,
  puntos: () => puntosIsla(54),
  // puntos de interés (zoom de la portada): dónde están, en el mundo del diorama, y qué cuentan
  detalle: [
    { en: [-35, -26, 31], titulo: 'Ayudante de laboratorio', texto: 'Sentí la necesidad de ganar experiencia y entré como ayudante de laboratorio en la UTN: reparación, instalación y desarme de equipos.' },
    { en: [41, -46.8, 33], titulo: 'Profesor de ingreso', texto: 'Di el ingreso de Programación: Python, C, diagramas de flujo y lógica de procesos.' },
    { en: [33.5, 23, 10], titulo: 'Cuatro trabajos freelance', texto: 'JustPhones, con pedidos por WhatsApp; Calida Esencia y Algo Bonito SV, con pago por Mercado Pago; y un asistente con IA para estudiar Atención Primaria.' },
  ],

};
