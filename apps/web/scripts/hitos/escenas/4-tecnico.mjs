// Hito 4 — 2025, técnico y docente: a la izquierda el taller (gabinete con el ventilador
// girando, impresora, un teléfono abierto); a la derecha el aula del ingreso, con el pizarrón y
// los bancos; y en una esquina, la coctelera de los fines de semana.
import { D, L, a, ac, aro, caja, camino, caraX, cil, costura, en, escena, isla, k, mesa, pizarra, plano, porFondo, proyeccion, puntosIsla, rejaY, renglones, sombra, texto, torno, tornillos, tramo } from '../taller.mjs';

const BANCO = plano(-60, -46, 56, 30, 1.2);
const T = 27;

function taller() {
  const P = proyeccion();
  const e = escena();
  // gabinete con el frente en +x: bahías, botón y el ventilador que gira
  const G = plano(-56, -43, 20, 10, 0.8);
  const X = G.x + G.w;
  const [fy, fz] = [G.y + 5, T + 7.4];
  e.poner(
    [G.x + 10, G.y + 5, T],
    sombra(G, T, 3) +
      caja(G.x, G.y, G.w, G.d, T, 22, { r: 0.8, tono: 'hi', bisel: 0.4, dentro: costura(G, T + 20.4, 3) }) +
      L(caraX(X, G.y + 1.4, G.y + 8.6, T + 16.6, T + 19) + caraX(X, G.y + 1.4, G.y + 8.6, T + 13.4, T + 15.8), { tone: 'lo' }) +
      ac('led', D([en([X, G.y + 2.6, T + 20.4])], { size: 1, tone: 'lit' })) +
      ac('celda', torno([[0, 4], [0.3, 4]], [X, fy, fz], [1, 0, 0])) +
      L(k.sideRing([X + 0.3, fy, fz], 4, 'x', P), { tone: 'hi' }) +
      ac('led', a.amRotor([X + 0.5, fy, fz], [0, -1, 0], [0, 0, -1], P, { count: 7, r0: 0.9, r1: 3.5, chord: 1.7, tip: 1.1, period: 820, thickness: 0 })) +
      D([en([X + 0.5, fy, fz])], { size: 1.2, tone: 'hi' })
  );
  // impresora: bandeja de entrada, tapa y una hoja saliendo
  const I = plano(-32, -44, 22, 20, 1.6);
  e.poner(
    [I.x + 11, I.y + 10, T],
    sombra(I, T, 3) +
      ac('papel', caja(I.x + 3, I.y - 0.6, 16, 1, T + 6, 9, { r: 0.4, tono: 'hi', pasos: 2, bisel: 0 })) +
      caja(I.x, I.y, I.w, I.d, T, 8, { r: 1.6, tono: 'hi', pasos: 4, bisel: 0.5, dentro: costura(I, T + 5.6, 4) }) +
      ac('celda', caja(I.x + 2, I.y + I.d, 18, 0.4, T + 2, 1.6, { r: 0.3, tono: 'hi', pasos: 2, bisel: 0 })) +
      ac('papel', caja(I.x + 4, I.y + I.d, 14, 7, T + 2.2, 0.5, { r: 0.4, tono: 'hi', pasos: 2, bisel: 0 })) +
      ac('tinta', renglones([[[I.x + 6, I.y + I.d + 2.4, T + 2.7], [I.x + 16, I.y + I.d + 2.4, T + 2.7]], [[I.x + 6, I.y + I.d + 4.4, T + 2.7], [I.x + 13, I.y + I.d + 4.4, T + 2.7]]], 'mid')) +
      L(k.planOutline(plano(I.x + 3, I.y + 3, 10, 9, 0.6), T + 8, P, 2), { tone: 'faint' }) +
      ac('led', D([en([I.x + 18, I.y + 16, T + 8])], { size: 1, tone: 'lit' })) +
      D([en([I.x + 15, I.y + 16, T + 8])], { size: 0.8, tone: 'mid' })
  );
  // teléfono abierto sobre la alfombrilla del color del hito
  const A = plano(-56, -30, 20, 12, 1);
  e.poner(
    [A.x + 10, A.y + 6, T],
    ac('hito', caja(A.x, A.y, A.w, A.d, T, 0.6, { r: 1, tono: 'hi', bisel: 0.2 })) +
      ac('ebano', caja(A.x + 2.4, A.y + 2.6, 11, 5.6, T + 0.6, 0.8, { r: 0.9, tono: 'hi', pasos: 3, bisel: 0.2 })) +
      ac('celda', caja(A.x + 9.4, A.y + 3.4, 3.2, 4, T + 1.4, 0.3, { r: 0.3, tono: 'hi', pasos: 2, bisel: 0 })) +
      L(k.planOutline(plano(A.x + 3.4, A.y + 3.4, 5, 4, 0.4), T + 1.4, P, 2), { tone: 'mid' }) +
      D([[A.x + 15.4, A.y + 3], [A.x + 17, A.y + 4.4], [A.x + 15.8, A.y + 6]].map(([x, y]) => en([x, y, T + 0.6])), { size: 0.5, tone: 'hi' }) +
      torno([[0, 0.2], [6, 0.35], [6, 1.1], [10.4, 1.2]], [A.x + 6, A.y + 10.4, T + 1.8], [0.99, 0.12, 0], { tone: 'mid' })
  );
  return e.armar();
}

function aula() {
  const P = proyeccion();
  const out = [];
  // pizarrón con Python: dos renglones escritos y uno que se va escribiendo
  const Y = -46.8;
  out.push(pizarra(4, 62, -48, 15, 47, 'pizarron'));
  out.push(ac('tiza', texto([8, Y, 39.6], 'y', 'for alumno in ingreso:', { tam: 3, tono: 'mid', ancla: 'start' })));
  out.push(ac('tiza', texto([13, Y, 34.2], 'y', 'ensenar(alumno)', { tam: 3, tono: 'mid', ancla: 'start' })));
  out.push(ac('led', a.amDraw(camino([[8, Y, 27.6], [30, Y, 27.6]]), { tone: 'lit', period: 4800, free: true }) + a.amDraw(camino([[13, Y, 23], [40, Y, 23]]), { tone: 'lit', period: 4800, delay: 4000, free: true })));
  out.push(D([en([58, Y, 43])], { size: 0.8, tone: 'mid' }));
  // bancos: dos filas de tres, cada uno con su banqueta
  const bancos = [];
  for (const y of [-30, -10]) for (const x of [10, 28, 46]) bancos.push([x, y]);
  for (const [x, y] of porFondo(bancos)) {
    out.push(
      sombra(plano(x, y, 12, 9, 1), 0, 3) +
        caja(x + 0.6, y + 0.6, 1.2, 7.8, 0, 11, { r: 0.3, tono: 'lo', pasos: 2, bisel: 0 }) +
        caja(x + 10.2, y + 0.6, 1.2, 7.8, 0, 11, { r: 0.3, tono: 'lo', pasos: 2, bisel: 0 }) +
        ac('madera', caja(x, y, 12, 9, 11, 1.2, { r: 0.6, tono: 'mid', pasos: 2, bisel: 0.3 })) +
        ac('papel', caja(x + 3, y + 2.4, 5.4, 4, 12.2, 0.3, { r: 0.2, tono: 'hi', pasos: 2, bisel: 0 })) +
        cil(x + 6, y + 13.4, 0.8, 0, 7, { tono: 'lo', pasos: 10 }) +
        cil(x + 6, y + 13.4, 2.8, 7, 1.2, { tono: 'mid', pasos: 18, bisel: 0.3 })
    );
  }
  return out.join('');
}

function barra() {
  const P = proyeccion();
  const [x, y] = [-34, 30];
  const Z = 17.4;
  return (
    sombra(plano(x - 11, y - 11, 22, 22, 11), 0, 5) +
    cil(x, y, 6, 0, 1.2, { tono: 'lo', pasos: 26, bisel: 0.3 }) +
    cil(x, y, 1.2, 1.2, 14.6, { tono: 'lo', pasos: 12 }) +
    ac('madera', cil(x, y, 11, 15.8, 1.6, { tono: 'mid', pasos: 44, bisel: 0.6 })) +
    aro(x, y, 9, Z, 'faint', 36) +
    // copa
    cil(x + 4.4, y - 3.6, 2, Z, 0.4, { tono: 'mid', pasos: 16 }) +
    cil(x + 4.4, y - 3.6, 0.4, Z + 0.4, 3.4, { tono: 'hi', pasos: 8 }) +
    torno([[0, 0.5], [2.4, 2.9], [2.9, 3]], [x + 4.4, y - 3.6, Z + 3.8], [0, 0, 1], { tone: 'hi' }) +
    ac('hito', cil(x + 4.4, y - 3.6, 2.4, Z + 6.4, 0.3, { tono: 'hi', pasos: 18 })) +
    // coctelera de tres piezas: cada tanto, dos sacudidas
    a.amPress(
      a.amPress(
        cil(x - 3, y + 1.6, 3, Z, 7.6, { tono: 'hi', pasos: 24, dentro: L(k.sideArc(x - 3, y + 1.6, 3, Z + 6.4, P, 18), { tone: 'faint' }) }) +
          torno([[0, 3.1], [2.6, 2], [3.4, 2]], [x - 3, y + 1.6, Z + 7.6], [0, 0, 1], { tone: 'hi' }) +
          cil(x - 3, y + 1.6, 1.5, Z + 11, 2, { tono: 'mid', pasos: 14, bisel: 0.3 }),
        [0, 0, 2.4],
        P,
        { period: 3000 }
      ),
      [0, 0, 2.4],
      P,
      { period: 3000, delay: 2400 }
    ) +
    // lima
    ac('cesped', cil(x + 1.6, y + 5.6, 1.8, Z, 0.9, { tono: 'hi', pasos: 16, bisel: 0.2 }))
  );
}

function cuerpo() {
  const P = proyeccion();
  const e = escena();
  // panel perforado detrás del banco, con herramientas colgadas
  e.poner(
    [-32, -50, 0],
    caja(-60, -49.4, 56, 1.2, T, 23, { r: 0.5, tono: 'mid', pasos: 2, bisel: 0 }) +
      rejaY(-48.2, -57, T + 5, 18, 5, 3, { size: 0.35, tone: 'lo' }) +
      ac('hito', caja(-50, -48.2, 2, 1, T + 9, 9, { r: 0.4, tono: 'hi', pasos: 2, bisel: 0 })) +
      caja(-44, -48.2, 1.4, 0.8, T + 7, 11, { r: 0.3, tono: 'hi', pasos: 2, bisel: 0 }) +
      caja(-38, -48.2, 6, 0.8, T + 13, 5, { r: 0.5, tono: 'hi', pasos: 2, bisel: 0 }) +
      caja(-16, -48.2, 8, 1.6, T + 8, 1, { r: 0.3, tono: 'lo', pasos: 2, bisel: 0 }) +
      ac('ebano', caja(-15, -48.2, 2.4, 1.4, T + 9, 4.4, { r: 0.4, tono: 'hi', pasos: 2, bisel: 0 })) +
      ac('hito', caja(-11.6, -48.2, 2.4, 1.4, T + 9, 3.4, { r: 0.4, tono: 'hi', pasos: 2, bisel: 0 }))
  );
  e.poner([-32, -31, 0], mesa(BANCO, T, { grosor: 3 }) + taller());
  e.poner([33, -30, 0], aula());
  e.poner([-34, 30, 0], barra());

  // una notebook en reparación, en el piso sobre su caja
  e.poner(
    [-4, 34, 0],
    sombra(plano(-12, 26, 18, 16, 1), 0, 4) +
      ac('madera', caja(-12, 26, 18, 16, 0, 7, { r: 0.6, tono: 'mid', bisel: 0.3, dentro: costura(plano(-12, 26, 18, 16, 0.6), 5.4, 3) })) +
      L(camino([[-12, 34, 7], [6, 34, 7]]), { tone: 'lo' }) +
      caja(-10, 28, 13, 11, 7, 1, { r: 0.9, tono: 'hi', pasos: 3, bisel: 0.3 }) +
      tornillos([[-8, 30], [1, 30], [-8, 37], [1, 37]], 8, 0.6)
  );

  // línea que separa el taller del aula: va de la ranura a la ranura
  const division = L(k.lineOnTop([-1, -47.5], [-1, 47.5], 0, P), { tone: 'faint' });
  return isla({ losetas: 20.5 }) + division + e.armar();
}

export default {
  etiqueta: 'Un taller con un gabinete cuyo ventilador gira, una impresora y un teléfono abierto, junto a un aula con un pizarrón con código y seis bancos, y una mesa redonda con una coctelera y una copa.',
  cuerpo,
  puntos: () => puntosIsla(54),
  // puntos de interés (zoom de la portada): dónde están, en el mundo del diorama, y qué cuentan
  detalle: [
    { en: [33, -46.8, 32], titulo: 'Más de 90 alumnos', texto: 'Volví a dar el ingreso de Programación, esta vez con más de 90 alumnos.' },
    { en: [-36, -38, 38], titulo: 'Técnico informático', texto: 'En Darío Martínez Computación reparé PCs, notebooks, impresoras y teléfonos, hardware y software. Y les hice el sitio, con un panel de stock y ventas en tiempo real.' },
    { en: [-37, 31.6, 27], titulo: 'Bartender y mozo', texto: 'Los fines de semana trabajé de bartender y mozo en boliches y eventos.' },
  ],

  acentos: (oscuro) => ({ pizarron: oscuro ? '#16302a' : '#2f4f47' }),
};
