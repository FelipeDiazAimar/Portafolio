// Hito 0 — Origen: "todo lo que hacía beep". Un banco de electrónica de chico: una radio
// desarmada, un protoboard con un zumbador que suena, un tester, un soldador que humea.
import { D, L, a, ac, aro, bola, cable, caja, camino, caraX, caraY, cil, costura, en, escena, isla, k, mesa, plano, porFondo, proyeccion, puntosIsla, rejaY, renglones, sombra, torno, tornillos, tramo } from '../taller.mjs';

const BANCO = plano(-56, -40, 106, 50, 1.4);
const T = 32; // altura de la tapa

function sobreElBanco() {
  const P = proyeccion();
  const e = escena();

  // radio de madera, con el frente hacia la izquierda (+y): parlante, dial y perillas
  const R = plano(-48, -32, 28, 15, 1.6);
  const RY = R.y + R.d;
  e.poner(
    [R.x + R.w / 2, R.y + R.d / 2, T],
    sombra(R, T, 3) +
      ac('madera', caja(R.x, R.y, R.w, R.d, T, 17, { r: 1.6, tono: 'hi', bisel: 0.6, dentro: costura(R, T + 2, 3) })) +
      L(caraY(RY, R.x + 2.4, R.x + 15, T + 3.4, T + 14.4), { tone: 'lo' }) +
      rejaY(RY, R.x + 4, T + 5, 6, 5, 1.9) +
      L(k.sideRing([R.x + 21, RY, T + 10.4], 3.6, 'y', P), { tone: 'hi' }) +
      // la aguja del dial busca una emisora
      ac('led', a.amSwing('<path class="iso-line" data-tone="lit" data-free="end" d="M0 0L0 -3.3"/>', a.planeMatrix([R.x + 21, RY, T + 10.4], [1, 0, 0], [0, 0, -1], P), { from: -62, to: 48, period: 4400 })) +
      D([en([R.x + 21, RY, T + 10.4])], { size: 0.9, tone: 'hi' }) +
      D([en([R.x + 18.4, RY, T + 4.2]), en([R.x + 23.6, RY, T + 4.2])], { size: 1.2, tone: 'mid' }) +
      caja(R.x + 6, R.y + 6, 16, 2.4, T + 17, 1.6, { r: 0.8, tono: 'mid', pasos: 2, bisel: 0 }) +
      cil(R.x + 3.4, R.y + 3.4, 0.9, T + 17, 1.4, { tono: 'mid', pasos: 12 }) +
      cil(R.x + 3.4, R.y + 3.4, 0.4, T + 18.4, 8, { tono: 'hi', pasos: 8 }) +
      D([en([R.x + 3.4, R.y + 3.4, T + 26.4])], { size: 1, tone: 'hi' })
  );

  // protoboard: grilla de agujeros, un integrado, resistencias, un LED y el zumbador
  const B = plano(-12, -30, 30, 17, 0.8);
  const Z = T + 1.4;
  const partes = [];
  partes.push(ac('papel', caja(B.x, B.y, B.w, B.d, T, 1.4, { r: 0.8, tono: 'mid', bisel: 0.3 })));
  partes.push(ac('tinta', D(k.dotGrid(B.x + 2, B.y + 2, 14, 3, 2, Z, P), { size: 0.32, tone: 'mid' }) + D(k.dotGrid(B.x + 2, B.y + 10.6, 14, 3, 2, Z, P), { size: 0.32, tone: 'mid' })));
  partes.push(L(k.lineOnTop([B.x, B.y + 8.5], [B.x + B.w, B.y + 8.5], Z, P), { tone: 'faint' }));
  const comp = [
    { en: [B.x + 6, B.y + 7, Z], svg: ac('ebano', caja(B.x + 3, B.y + 6.4, 7, 4.2, Z, 1.5, { r: 0.3, tono: 'hi', pasos: 2, bisel: 0.2 })) + D([en([B.x + 4.2, B.y + 7.4, Z + 1.5])], { size: 0.4, tone: 'lo' }) },
    { en: [B.x + 14, B.y + 4, Z], svg: caja(B.x + 12, B.y + 3.3, 4.4, 1.4, Z + 0.6, 1.4, { r: 0.6, tono: 'mid', pasos: 2, bisel: 0 }) },
    { en: [B.x + 14, B.y + 12.6, Z], svg: caja(B.x + 12, B.y + 12, 4.4, 1.4, Z + 0.6, 1.4, { r: 0.6, tono: 'mid', pasos: 2, bisel: 0 }) },
    { en: [B.x + 20, B.y + 12.6, Z], svg: ac('celda', cil(B.x + 20, B.y + 12.6, 1.5, Z, 4.2, { tono: 'hi', pasos: 14, bisel: 0.2 })) },
    // el LED: titila con cada beep
    {
      en: [B.x + 20, B.y + 4.6, Z],
      svg: cil(B.x + 20, B.y + 4.6, 1, Z, 1.6, { tono: 'mid', pasos: 12 }) + ac('hito', bola([B.x + 20, B.y + 4.6, Z + 2.5], 1.25)) + a.amBlink(ac('led', D([en([B.x + 20, B.y + 4.6, Z + 2.9])], { size: 1.5, tone: 'lit' })), { period: 2200, min: 0.1 }),
    },
    // el zumbador: lo que hace beep
    {
      en: [B.x + 26, B.y + 8.6, Z],
      svg: ac('ebano', cil(B.x + 26, B.y + 8.6, 2.6, Z, 3.4, { tono: 'hi', pasos: 20, bisel: 0.3 })) + aro(B.x + 26, B.y + 8.6, 1.5, Z + 3.4, 'mid', 14) + D([en([B.x + 26, B.y + 8.6, Z + 3.4])], { size: 0.7, tone: 'hi' }),
    },
  ];
  partes.push(porFondo(comp, (c) => c.en).map((c) => c.svg).join(''));
  // puentes: arcos de alambre entre agujeros
  partes.push(
    ac('led', cable([B.x + 8, B.y + 3, Z], [B.x + 12, B.y + 4, Z + 1.3], { caida: -1.4, tono: 'lit', n: 8 })) +
      cable([B.x + 16.4, B.y + 4, Z + 1.3], [B.x + 20, B.y + 4.6, Z + 1], { caida: -1, tono: 'hi', n: 8 }) +
      cable([B.x + 10, B.y + 12.6, Z], [B.x + 12, B.y + 12.6, Z + 1.3], { caida: -0.8, tono: 'hi', n: 6 }) +
      cable([B.x + 21.4, B.y + 12.6, Z + 3], [B.x + 26, B.y + 10.6, Z + 3.2], { caida: -1.6, tono: 'hi', n: 8 })
  );
  // ondas del beep: tres anillos que laten, uno detrás del otro
  partes.push([4.6, 7.4, 10.4].map((r, i) => a.amPulse(ac('led', L(k.ring(B.x + 26, B.y + 8.6, r, Z + 5 + i * 2.2, P, 28), { tone: 'lit' })), { period: 2200, delay: 2200 - i * 240, min: 0.04 })).join(''));
  e.poner([B.x + B.w / 2, B.y + B.d / 2, T], partes.join(''), 2);

  // pila de 9 V, cableada al protoboard
  e.poner(
    [-18, -12, T],
    ac('ebano', caja(-22, -15, 9, 5.4, T, 4, { r: 0.7, tono: 'hi', bisel: 0.3, dentro: costura(plano(-22, -15, 9, 5.4, 0.7), T + 2.8, 3, 'mid') })) +
      cil(-14.6, -13.6, 0.8, T + 1.2, 1.4, { tono: 'mid', pasos: 10 }) +
      cable([-13, -12.3, T + 2], [B.x + 2, B.y + 12.6, Z], { caida: 1.2, tono: 'hi' })
  );

  // tester: cuerpo del color del hito, display, perilla y puntas
  const M = plano(27, -31, 14, 24, 2.2);
  e.poner(
    [M.x + 7, M.y + 12, T],
    sombra(M, T, 2.5) +
      ac('hito', caja(M.x, M.y, M.w, M.d, T, 4.6, { r: 2.2, tono: 'hi', pasos: 5, bisel: 0.6, dentro: costura(M, T + 1.6, 5, 'mid') })) +
      ac('celda', caja(M.x + 2.4, M.y + 2.6, 9.2, 6.6, T + 4.6, 0.5, { r: 0.6, tono: 'hi', pasos: 2, bisel: 0 })) +
      ac('led', renglones([[[M.x + 9.4, M.y + 4.2, T + 5.1], [M.x + 9.4, M.y + 7.6, T + 5.1]], [[M.x + 6.6, M.y + 4.2, T + 5.1], [M.x + 6.6, M.y + 6.2, T + 5.1]]], 'lit')) +
      cil(M.x + 7, M.y + 14.6, 3.7, T + 4.6, 1.5, { tono: 'hi', pasos: 28, bisel: 0.3 }) +
      L(tramo([M.x + 7, M.y + 14.6, T + 6.1], [M.x + 9.6, M.y + 12.6, T + 6.1]), { tone: 'hi' }) +
      D([en([M.x + 7, M.y + 14.6, T + 6.1])], { size: 0.8, tone: 'hi' }) +
      aro(M.x + 4, M.y + 21, 0.9, T + 4.6) +
      aro(M.x + 10, M.y + 21, 0.9, T + 4.6) +
      cable([M.x + 4, M.y + 21, T + 4.6], [14, 2, T + 0.6], { caida: -1.4, tono: 'hi', n: 14 }) +
      ac('led', cable([M.x + 10, M.y + 21, T + 4.6], [22, 6, T + 0.6], { caida: -2.4, tono: 'lit', n: 14 }))
  );
  e.poner([13, 4, T], torno([[0, 0.25], [3, 0.5], [3, 1], [11, 1]], [14, 2, T + 0.9], [-0.86, 0.5, 0], { tone: 'mid' }), -1);
  e.poner([21, 9, T], ac('hito', torno([[0, 0.25], [3, 0.5], [3, 1], [11, 1]], [22, 6, T + 0.9], [-0.86, 0.5, 0])), -1);

  // soldador acostado, con la punta sobre su apoyo; el humo se dibuja solo
  e.poner(
    [-34, 4, T],
    caja(-38, -8, 8, 5, T, 2.4, { r: 0.8, tono: 'mid', bisel: 0.3 }) +
      torno([[0, 0.35], [4.6, 0.7], [4.6, 1.7], [7, 1.7], [7, 1.3], [19, 1.5]], [-34, -6.4, T + 3.4], [0, 1, -0.04], { tone: 'hi' }) +
      ac('hito', torno([[9, 1.9], [17.6, 2.1]], [-34, -6.4, T + 3.4], [0, 1, -0.04])) +
      cable([-34, 12.6, T + 2.7], [-27, 10, T], { caida: 0.6, tono: 'lo', n: 8 }) +
      a.amDraw(camino(Array.from({ length: 15 }, (_, i) => [-34 + Math.sin(i * 0.95) * (0.5 + i * 0.12), -6.4, T + 4.2 + i * 1.15])), { tone: 'mid', period: 5200, free: true })
  );

  // rollo de estaño y destornillador
  e.poner(
    [2, 4, T],
    cil(2, 4, 3.4, T, 0.8, { tono: 'mid', pasos: 20 }) +
      cil(2, 4, 2.5, T + 0.8, 3.2, { tono: 'hi', pasos: 18, dentro: L(k.sideArc(2, 4, 2.5, T + 1.9, P, 14) + k.sideArc(2, 4, 2.5, T + 2.9, P, 14), { tone: 'faint' }) }) +
      cil(2, 4, 3.4, T + 4, 0.8, { tono: 'mid', pasos: 20, bisel: 0.2 }) +
      aro(2, 4, 1.1, T + 4.8)
  );
  e.poner([-12, 6, T], torno([[0, 0.2], [9, 0.4], [9, 1.5], [15, 1.7]], [-18, 8.6, T + 1.7], [0.94, -0.34, 0], { tone: 'mid' }) + ac('hito', torno([[10, 1.9], [14.4, 2]], [-18, 8.6, T + 1.7], [0.94, -0.34, 0])));
  return e.armar();
}

function cuerpo() {
  const P = proyeccion();
  const e = escena();
  // el banco, con una cajonera debajo y todo lo de arriba
  const C = plano(18, -32, 26, 38, 0.8);
  const cajonera =
    caja(C.x, C.y, C.w, C.d, 0, 25, { r: 0.8, tono: 'mid', bisel: 0, dentro: costura(C, 8.4, 3) + costura(C, 16.8, 3) }) +
    [0, 1, 2].map((i) => L(caraX(C.x + C.w, C.y + 2, C.y + C.d - 2, 1.6 + i * 8.4, 7.2 + i * 8.4), { tone: 'lo' }) + caja(C.x + C.w, C.y + C.d / 2 - 4, 1, 8, 4 + i * 8.4, 1.2, { r: 0.4, tono: 'hi', pasos: 2, bisel: 0 })).join('');
  e.poner([-2, -13, 0], mesa(BANCO, T, { grosor: 3.4 }) + cajonera + sobreElBanco());

  // caja de herramientas, con la manija y las trabas del color del hito
  const H = plano(26, 22, 30, 15, 1.6);
  e.poner(
    [41, 29, 0],
    sombra(H, 0, 4) +
      caja(H.x, H.y, H.w, H.d, 0, 9, { r: 1.6, tono: 'mid', bisel: 0, dentro: costura(H, 2, 3) }) +
      caja(H.x - 0.5, H.y - 0.5, H.w + 1, H.d + 1, 9, 3.4, { r: 1.9, tono: 'mid', bisel: 0.7 }) +
      ac('hito', caja(H.x + 8, H.y + 5.6, 14, 3.8, 12.4, 2, { r: 1, tono: 'hi', pasos: 3, bisel: 0.3 })) +
      ac('hito', caja(H.x + H.w, H.y + 2.4, 0.9, 2.8, 7.4, 3.2, { r: 0.3, tono: 'hi', pasos: 2, bisel: 0 }) + caja(H.x + H.w, H.y + 9.8, 0.9, 2.8, 7.4, 3.2, { r: 0.3, tono: 'hi', pasos: 2, bisel: 0 })) +
      tornillos([[H.x + 3, H.y + 3], [H.x + H.w - 3, H.y + H.d - 3]], 12.4, 1)
  );

  // banqueta de tres patas
  const [bx, by] = [-8, 36];
  e.poner(
    [bx, by, 0],
    sombra(plano(bx - 9, by - 9, 18, 18, 9), 0, 4) +
      porFondo([[bx - 5, by - 3], [bx + 5, by - 3], [bx, by + 5.6]]).map(([x, y]) => cil(x, y, 1, 0, 15, { tono: 'lo', pasos: 10 })).join('') +
      ac('madera', cil(bx, by, 9, 15, 2.6, { tono: 'mid', pasos: 36, bisel: 0.7 })) +
      aro(bx, by, 6.4, 17.6, 'faint', 30)
  );

  // carrete de cable
  const [cx, cy] = [-46, 30];
  e.poner(
    [cx, cy, 0],
    sombra(plano(cx - 8, cy - 8, 16, 16, 8), 0, 3) +
      cil(cx, cy, 7.6, 0, 1.2, { tono: 'mid', pasos: 30 }) +
      ac('hito', cil(cx, cy, 5.4, 1.2, 8, { tono: 'hi', pasos: 26, dentro: L([2.8, 4.4, 6, 7.6].map((z) => k.sideArc(cx, cy, 5.4, z, P, 20)).join(''), { tone: 'mid' }) })) +
      cil(cx, cy, 7.6, 9.2, 1.2, { tono: 'mid', pasos: 30, bisel: 0.4 }) +
      aro(cx, cy, 2, 10.4) +
      D([en([cx, cy, 10.4])], { size: 0.8 })
  );

  // una plaqueta suelta en el piso, con sus pistas
  e.poner(
    [10, 44, 0],
    ac('cesped', caja(4, 39, 15, 10, 0, 0.9, { r: 0.8, tono: 'hi', bisel: 0.3 })) +
      L(camino([[6, 41, 0.9], [11, 41, 0.9], [13, 43, 0.9], [17, 43, 0.9]]) + camino([[6, 44, 0.9], [9, 44, 0.9], [11, 46, 0.9], [17, 46, 0.9]]), { tone: 'lo' }) +
      D([[6, 41], [17, 43], [6, 44], [17, 46]].map(([x, y]) => en([x, y, 0.9])), { size: 0.7, tone: 'hi' }) +
      ac('ebano', caja(8, 46.4, 4, 2, 0.9, 1, { r: 0.2, tono: 'hi', pasos: 2, bisel: 0 }))
  );

  return isla({ losetas: 23.2 }) + e.armar();
}

export default {
  etiqueta: 'Un banco de electrónica en vista isométrica: una radio de madera, un protoboard con un zumbador que emite ondas, un tester naranja, un soldador que humea, una caja de herramientas y una banqueta.',
  cuerpo,
  puntos: () => puntosIsla(54),
  // puntos de interés (zoom de la portada): dónde están, en el mundo del diorama, y qué cuentan
  detalle: [
    { en: [14, -21.4, 37.4], titulo: 'El beep', texto: 'Siempre me fascinó todo lo que hacía beep. Esa curiosidad fue el principio de todo lo demás.' },
    { en: [34, -19, 37], titulo: 'Reparar y mejorar', texto: 'Mi sueño fue ser la persona que soluciona: la que repara, mejora y proyecta sistemas para que las cosas sean más fáciles.' },
    { en: [-34, -17, 42], titulo: 'Tecnología desde chico', texto: 'Desde el principio me gustó la tecnología: lo que hoy es mi trabajo empezó como una pasión.' },
  ],

};
