// Hito 2 — 2023, inglés y adelanto de materias: una escalera de materias que se sube salteando
// escalones, una pila de libros con un globo terráqueo y el certificado con su sello.
import { D, L, a, ac, aro, bola, caja, camino, caraX, cil, costura, en, escena, isla, k, plano, porFondo, proyeccion, puntosIsla, renglones, sombra, texto, torno, tramo } from '../taller.mjs';

const ESCALONES = 5;
const escalon = (i) => ({ x: -50 + i * 14, y: -44, w: 14, d: 22, alto: 35 - i * 7 });

function escalera() {
  const P = proyeccion();
  const out = [sombra(plano(-50, -44, 70, 22, 2), 0, 6)];
  // de atrás (el más alto) hacia adelante
  for (let i = 0; i < ESCALONES; i++) {
    const s = escalon(i);
    const pl = plano(s.x, s.y, s.w, s.d, 0.8);
    out.push(caja(s.x, s.y, s.w, s.d, 0, s.alto, { r: 0.8, tono: i === 0 ? 'hi' : 'mid', bisel: 0.5, dentro: costura(pl, s.alto - 1.6, 3) }));
    // cada contrahuella lleva su tilde: materia aprobada
    const X = s.x + s.w;
    const z = s.alto - 3.6;
    out.push(ac('led', L(camino([[X, s.y + 15, z + 0.2], [X, s.y + 13.2, z - 1.6], [X, s.y + 9.6, z + 2]]), { tone: 'lit', free: true })));
    out.push(L(k.planOutline(plano(s.x + 2.4, s.y + 3, s.w - 4.8, s.d - 6, 0.6), s.alto, P, 2), { tone: 'faint' }));
  }
  // el peón sube de a dos escalones: salta del 3 al 1 por encima del 2, se queda y vuelve a empezar
  const s = escalon(1);
  const [px, py, pz] = [s.x + 7, s.y + 11, s.alto];
  const peon = ac('hito', cil(px, py, 3, pz, 1.2, { tono: 'hi', pasos: 22, bisel: 0.3 }) + cil(px, py, 1.8, pz + 1.2, 5, { tono: 'hi', pasos: 18 }) + cil(px, py, 2.4, pz + 6.2, 0.9, { tono: 'hi', pasos: 18 }) + bola([px, py, pz + 9.4], 2.6));
  // el salto que se viene: del escalón 3 al 1, por encima del 2
  const desde = escalon(3);
  const arco = Array.from({ length: 17 }, (_, i) => {
    const t = i / 16;
    return [desde.x + 7 + (px - desde.x - 7) * t, py, desde.alto + 1 + (pz + 13 - desde.alto - 1) * t + 15 * 4 * t * (1 - t) * 0.5];
  });
  out.push(ac('led', L(camino(arco), { tone: 'lit', dashed: true, free: true })) + D([en(arco[0])], { size: 1, tone: 'mid' }));
  // el peón está dibujado en su llegada; la animación lo corre al punto de partida y lo trae
  const llegada = en([px, py, pz]);
  const corrido = (p3) => {
    const [x, y] = en(p3);
    return `translate(${(x - llegada[0]).toFixed(2)}px,${(y - llegada[1]).toFixed(2)}px)`;
  };
  const partida = corrido([desde.x + 7, py, desde.alto]);
  const cima = corrido([(desde.x + 7 + px) / 2, py, pz + 9]);
  out.push(
    `<style>@keyframes salto-peon{0%,16%{transform:${partida};opacity:1}29%{transform:${cima};opacity:1}42%,80%{transform:translate(0,0);opacity:1}87%{transform:translate(0,0);opacity:0}93%{transform:${partida};opacity:0}100%{transform:${partida};opacity:1}}.salto-peon{animation:salto-peon 5200ms cubic-bezier(.45,0,.55,1) infinite}@media (prefers-reduced-motion:reduce){.salto-peon{animation:none}}</style>` +
      `<g class="salto-peon vivo-mueve">${peon}</g>`
  );
  return out.join('');
}

function libros() {
  const P = proyeccion();
  const pila = [
    { w: 30, d: 21, h: 4.6, dx: 0, dy: 0, m: 'hito' },
    { w: 27, d: 20, h: 3.6, dx: 1.6, dy: 0.8, m: null },
    { w: 28, d: 19, h: 5, dx: 0.4, dy: 1.6, m: 'celda' },
    { w: 24, d: 18, h: 3.4, dx: 2.6, dy: 1, m: 'madera' },
    { w: 25, d: 17, h: 4.2, dx: 1.2, dy: 2.2, m: 'hito' },
  ];
  const [x0, y0] = [-52, 12];
  const out = [sombra(plano(x0, y0, 30, 21, 2), 0, 5)];
  let z = 0;
  for (const b of pila) {
    const [x, y] = [x0 + b.dx, y0 + b.dy];
    const pl = plano(x, y, b.w, b.d, 0.7);
    const tapa = caja(x, y, b.w, b.d, z, b.h, { r: 0.7, tono: 'hi', bisel: 0.3, dentro: costura(pl, z + 0.8, 3, 'mid') + costura(pl, z + b.h - 0.8, 3, 'mid') });
    out.push(b.m ? ac(b.m, tapa) : tapa);
    // título en el lomo
    out.push(renglones([[[x + b.w, y + 3, z + b.h / 2], [x + b.w, y + 3 + b.d * 0.45, z + b.h / 2]]], 'hi'));
    z += b.h;
  }
  // globo terráqueo encima
  const [gx, gy] = [x0 + 13, y0 + 11];
  out.push(
    cil(gx, gy, 4.4, z, 1, { tono: 'mid', pasos: 24, bisel: 0.3 }) +
      cil(gx, gy, 0.8, z + 1, 2.6, { tono: 'mid', pasos: 10 }) +
      bola([gx, gy, z + 10.4], 7) +
      L(k.sideArc(gx, gy, 7, z + 10.4, P, 30) + k.sideArc(gx, gy, 6.1, z + 13.8, P, 26) + k.sideArc(gx, gy, 6.1, z + 7, P, 26), { tone: 'lo' }) +
      ac('led', D([en([gx + 4.6, gy + 3, z + 12.6])], { size: 1.3, tone: 'lit' }))
  );
  return out.join('');
}

function certificado() {
  const P = proyeccion();
  const [x, y0, y1] = [34, -8, 26];
  const X = x + 1.4;
  return (
    sombra(plano(x - 4, y0, 10, y1 - y0, 2), 0, 5) +
    // caballete
    caja(x - 5, y0 + 3, 12, 2.4, 0, 1.2, { r: 0.6, tono: 'lo', pasos: 2, bisel: 0 }) +
    caja(x - 5, y1 - 5.4, 12, 2.4, 0, 1.2, { r: 0.6, tono: 'lo', pasos: 2, bisel: 0 }) +
    cil(x + 0.7, y0 + 4.2, 0.9, 1.2, 8.8, { tono: 'lo', pasos: 10 }) +
    cil(x + 0.7, y1 - 4.2, 0.9, 1.2, 8.8, { tono: 'lo', pasos: 10 }) +
    // marco y hoja
    ac('madera', caja(x, y0, 1.4, y1 - y0, 10, 27, { r: 0.6, tono: 'hi', pasos: 2, bisel: 0 })) +
    ac('papel', caja(X, y0 + 2.2, 0.4, y1 - y0 - 4.4, 12.2, 22.6, { r: 0.3, tono: 'hi', pasos: 2, bisel: 0 })) +
    ac('tinta', texto([X + 0.4, (y0 + y1) / 2, 29], 'x', 'FIRST', { tam: 4.4, tono: 'mid' }) +
    renglones(
      [
        [[X + 0.4, y1 - 6, 26], [X + 0.4, y0 + 6, 26]],
        [[X + 0.4, y1 - 9, 23], [X + 0.4, y0 + 9, 23]],
        [[X + 0.4, y1 - 7, 20.4], [X + 0.4, y0 + 15, 20.4]],
      ],
      'mid'
    )) +
    // sello con cintas, del color del hito; un aro que late alrededor
    ac('hito', caja(X + 0.4, y0 + 5.6, 0.4, 1.6, 13.4, 4.6, { r: 0.2, tono: 'hi', pasos: 2, bisel: 0 }) + caja(X + 0.4, y0 + 8, 0.4, 1.6, 13.4, 4.6, { r: 0.2, tono: 'hi', pasos: 2, bisel: 0 }) + torno([[0, 3.3], [0.9, 3.3]], [X + 0.4, y0 + 7.6, 18.6], [1, 0, 0])) +
    L(k.sideRing([X + 1.3, y0 + 7.6, 18.6], 2.1, 'x', P), { tone: 'hi' }) +
    a.amPulse(ac('led', L(k.sideRing([X + 0.5, y0 + 7.6, 18.6], 4.6, 'x', P), { tone: 'lit' })), { period: 3400, min: 0.08 })
  );
}

function cuerpo() {
  const P = proyeccion();
  const e = escena();
  e.poner([-15, -33, 0], escalera());
  e.poner([-37, 22, 0], libros());
  e.poner([35, 9, 0], certificado());

  // calendario de escritorio
  e.poner(
    [0, 34, 0],
    sombra(plano(-8, 28, 16, 9, 1), 0, 3) +
      caja(-8, 28, 16, 8, 0, 1.2, { r: 0.6, tono: 'lo', pasos: 2, bisel: 0 }) +
      ac('papel', caja(-7, 31, 14, 4, 1.2, 10, { r: 0.5, tono: 'hi', pasos: 2, bisel: 0 })) +
      ac('hito', caja(-7.2, 30.8, 14.4, 4.4, 11.2, 1.6, { r: 0.5, tono: 'hi', pasos: 2, bisel: 0 })) +
      ac('tinta', texto([0, 35, 3.6], 'y', '2023', { tam: 4.6, tono: 'mid' }))
  );

  // lapicero con tres lápices
  const [lx, ly] = [22, 40];
  e.poner(
    [lx, ly, 0],
    sombra(plano(lx - 4, ly - 4, 8, 8, 4), 0, 3) +
      cil(lx, ly, 3.6, 0, 8, { tono: 'mid', pasos: 22, bisel: 0.3, dentro: L(k.sideArc(lx, ly, 3.6, 6.4, P, 16), { tone: 'faint' }) }) +
      porFondo([[lx - 1.4, ly - 0.8, 14], [lx + 1.2, ly - 1, 16.4], [lx + 0.2, ly + 1.4, 12.6]]).map(([x, y, h], i) => {
        const lapiz = cil(x, y, 0.7, 8, h - 8, { tono: 'hi', pasos: 8 });
        return (i === 1 ? ac('hito', lapiz) : ac('madera', lapiz)) + D([en([x, y, h])], { size: 0.5, tone: 'hi' });
      }).join('')
  );

  // alfombra redonda, apenas un relieve
  const alfombra = cil(8, 6, 21, 0, 0.5, { tono: 'lo', pasos: 56 }) + aro(8, 6, 17.5, 0.5, 'faint', 48) + aro(8, 6, 14, 0.5, 'faint', 40);
  return isla() + alfombra + e.armar();
}

export default {
  etiqueta: 'Una escalera de cinco bloques con una tilde en cada escalón y un peón que sube salteando uno, una pila de libros con un globo terráqueo encima y un certificado enmarcado con un sello rojo.',
  cuerpo,
  puntos: () => puntosIsla(54),
  // puntos de interés (zoom de la portada): dónde están, en el mundo del diorama, y qué cuentan
  detalle: [
    { en: [36, 9, 22], titulo: 'First de Cambridge', texto: 'A mediados de 2023 terminé de cursar inglés en el EPI y obtuve la certificación First de Cambridge.' },
    { en: [-15, -33, 22], titulo: 'Materias adelantadas', texto: 'Adelanté materias de la carrera, y eso me dejó más libre para empezar todas las cosas que quería hacer.' },
  ],

};
