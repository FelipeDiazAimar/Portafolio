// Hito 5 — 2026, fullstack en MBRF: una línea de trazabilidad. Las cajas salen del túnel, pasan
// por la balanza y entran a la etiquetadora; al lado, la terminal data collector, el pallet con
// las cajas ya etiquetadas, el rack de SAP y un nodo con sus pods.
import { D, G, L, S, a, ac, aro, caja, camino, caraX, caraY, cil, costura, en, escena, isla, k, pantallaX, plano, porFondo, proyeccion, puntosIsla, rejaX, renglones, sombra, texto, tornillos, tramo } from '../taller.mjs';

const CINTA = { x0: -60, x1: 34, y0: -34, y1: -20, z: 15 };
const PASO = 22; // separación entre cajas = lo que avanzan en un ciclo
const TUNEL = { x0: -62, x1: -44 };
const ETIQ = { x0: 14, x1: 34 };

function unaCaja(x, material = 'madera') {
  const { y0, z } = CINTA;
  const pl = plano(x, y0 + 2.4, 10, 9.2, 0.5);
  return (
    ac(material, caja(pl.x, pl.y, pl.w, pl.d, z, 7.4, { r: 0.5, tono: 'hi', pasos: 2, bisel: 0.3, dentro: costura(pl, z + 5.8, 2, 'mid') })) +
    L(k.lineOnTop([pl.x, pl.y + 4.6], [pl.x + 10, pl.y + 4.6], z + 7.4, proyeccion()), { tone: 'mid' })
  );
}

function linea() {
  const P = proyeccion();
  const { x0, x1, y0, y1, z } = CINTA;
  const out = [sombra(plano(x0, y0 - 2, x1 - x0, y1 - y0 + 4, 2), 0, 6)];
  // patas, de a pares
  for (const [x, y] of porFondo([-40, -18, 4].flatMap((x) => [[x, y0 + 0.6], [x, y1 - 2.4]]))) out.push(caja(x, y, 1.8, 1.8, 0, z - 3, { r: 0.3, tono: 'lo', pasos: 2, bisel: 0 }));
  // bastidor y banda
  out.push(caja(x0, y0, x1 - x0, y1 - y0, z - 3, 2.2, { r: 0.6, tono: 'mid', pasos: 2, bisel: 0 }));
  out.push(ac('ebano', caja(x0, y0 + 1.4, x1 - x0, y1 - y0 - 2.8, z - 0.8, 0.8, { r: 0.4, tono: 'hi', pasos: 2, bisel: 0 })));
  // rodillos: marcas a lo ancho de la banda, entre los dos bordes
  out.push(L(Array.from({ length: 13 }, (_, i) => k.lineOnTop([TUNEL.x1 + 3 + i * 4.4, y0 + 1.4], [TUNEL.x1 + 3 + i * 4.4, y1 - 1.4], z, P)).join(''), { tone: 'faint' }));

  // balanza: un tramo de banda sobre celdas de carga, con su indicador
  const BX = [-24, -6];
  out.push(ac('hito', caja(BX[0], y0 + 1, BX[1] - BX[0], y1 - y0 - 2, z, 0.5, { r: 0.4, tono: 'hi', pasos: 2, bisel: 0 })));
  out.push(D([[BX[0] + 1.6, y1 - 2.4], [BX[1] - 1.6, y1 - 2.4]].map(([x, y]) => en([x, y, z + 0.5])), { size: 0.6, tone: 'hi' }));

  // túnel de entrada, del otro lado de la banda: se dibuja antes que las cajas, que salen por
  // su boca. Las cajas van recortadas al volumen que recorren fuera del túnel, así la que
  // todavía está adentro no se ve.
  out.push(caja(TUNEL.x0, y0 - 3, TUNEL.x1 - TUNEL.x0, y1 - y0 + 6, 0, 31, { r: 1.2, tono: 'mid', bisel: 0.6, dentro: costura(plano(TUNEL.x0, y0 - 3, TUNEL.x1 - TUNEL.x0, y1 - y0 + 6, 1.2), 26, 3) }));
  out.push(ac('celda', caja(TUNEL.x1, y0 + 1.4, 0.3, y1 - y0 - 2.8, z, 10, { r: 0.3, tono: 'hi', pasos: 2, bisel: 0 })));
  out.push(L([0, 1, 2, 3, 4].map((i) => tramo([TUNEL.x1 + 0.3, y0 + 3 + i * 2, z + 10], [TUNEL.x1 + 0.3, y0 + 3 + i * 2, z + 3.4])).join(''), { tone: 'mid', free: 'end' }));
  out.push(ac('led', D([en([TUNEL.x1, y1 + 1, 27])], { size: 1.2, tone: 'lit' })));

  const recorrido = G.hullOf([TUNEL.x1 + 0.3, ETIQ.x1].flatMap((x) => [y0 + 2, y1 - 2].flatMap((y) => [z, z + 8.4].map((h) => en([x, y, h])))));
  const cajas = [0, 1, 2, 3].map((i) => unaCaja(TUNEL.x1 - 12 + i * PASO, i === 1 ? 'hito' : 'madera')).join('');
  out.push(`<clipPath id="recorrido-cajas"><path d="${k.pathOf(recorrido, true)}"/></clipPath><g clip-path="url(#recorrido-cajas)">${a.amLoop(cajas, [PASO, 0, 0], P, { period: 3600 })}</g>`);

  // indicador de la balanza, del lado de acá de la banda
  out.push(cil(-15, y1 + 0.6, 0.8, z - 0.8, 6, { tono: 'lo', pasos: 10 }));
  out.push(caja(-20, y1 + 0.2, 10, 1.4, z + 5, 5.6, { r: 0.5, tono: 'hi', pasos: 2, bisel: 0 }));
  out.push(ac('celda', caja(-19, y1 + 1.6, 8, 0.3, z + 6, 3.6, { r: 0.3, tono: 'hi', pasos: 2, bisel: 0 })));
  out.push(ac('led', texto([-15, y1 + 1.9, z + 6.9], 'y', '18.4', { tam: 2.6, tono: 'hi' })));

  // etiquetadora: arco sobre la banda, se dibuja después de las cajas y las tapa al entrar
  const EY = [y0 - 3, y1 + 3];
  out.push(caja(ETIQ.x0, EY[0], ETIQ.x1 - ETIQ.x0, EY[1] - EY[0], 0, 30, { r: 1.2, tono: 'hi', bisel: 0.6, dentro: costura(plano(ETIQ.x0, EY[0], ETIQ.x1 - ETIQ.x0, EY[1] - EY[0], 1.2), 25, 3) }));
  out.push(pantallaX(ETIQ.x1, EY[0] + 3, EY[0] + 13, 16, 26, { margen: 0.8, lineas: 3, acento: 'led' }));
  // la etiqueta que sale, con su QR
  out.push(ac('papel', caja(ETIQ.x1, EY[1] - 9, 0.4, 6, 17, 7.4, { r: 0.3, tono: 'hi', pasos: 2, bisel: 0 })));
  out.push(ac('tinta', rejaX(ETIQ.x1 + 0.4, EY[1] - 7.8, 20, 4, 4, 0.9, { size: 0.34, tone: 'mid' }) + renglones([[[ETIQ.x1 + 0.4, EY[1] - 4, 18.4], [ETIQ.x1 + 0.4, EY[1] - 7.8, 18.4]]], 'mid')));
  out.push(a.amBlink(ac('led', D([en([ETIQ.x1, EY[1] - 1.6, 27])], { size: 1.3, tone: 'lit' })), { period: 3600, delay: 1800 }));
  out.push(tornillos(k.corners(plano(ETIQ.x0, EY[0], ETIQ.x1 - ETIQ.x0, EY[1] - EY[0], 1), 2.4), 30, 0.8));
  return out.join('');
}

function rack() {
  const P = proyeccion();
  const R = plano(42, -48, 16, 18, 1);
  const X = R.x + R.w;
  const out = [sombra(R, 0, 5), caja(R.x - 0.6, R.y - 0.6, R.w + 1.2, R.d + 1.2, 0, 1.6, { r: 1, tono: 'lo', pasos: 3, bisel: 0 })];
  out.push(caja(R.x, R.y, R.w, R.d, 1.6, 44, { r: 1, tono: 'hi', bisel: 0.5, dentro: costura(R, 42, 3) }));
  // seis equipos, cada uno con su fila de luces
  for (let i = 0; i < 6; i++) {
    const z = 4 + i * 6;
    out.push(L(caraX(X, R.y + 1.6, R.y + R.d - 1.6, z, z + 4.6), { tone: 'lo' }));
    out.push(D([0, 1, 2].map((j) => en([X, R.y + R.d - 3.4 - j * 1.6, z + 2.3])), { size: 0.5, tone: 'mid' }));
    out.push(L(tramo([X, R.y + 3, z + 2.3], [X, R.y + 9, z + 2.3]), { tone: 'faint', free: true }));
    out.push(a.amBlink(ac('led', D([en([X, R.y + R.d - 8.6, z + 2.3])], { size: 0.9, tone: 'lit' })), { period: 2600, delay: 2600 - i * 380, min: 0.12 }));
  }
  out.push(texto([X, R.y + R.d / 2, 40.6], 'x', 'SAP', { tam: 3.4, tono: 'hi' }));
  out.push(L(k.planOutline(plano(R.x + 3, R.y + 3, R.w - 6, R.d - 6, 0.6), 45.6, P, 2), { tone: 'faint' }));
  return out.join('');
}

function terminal() {
  const [x, y] = [-14, -4];
  return (
    sombra(plano(x - 4, y - 4, 10, 16, 2), 0, 4) +
    caja(x - 3, y - 2, 8, 12, 0, 1.4, { r: 1, tono: 'lo', pasos: 3, bisel: 0.3 }) +
    caja(x, y + 2.4, 2, 3.2, 1.4, 20, { r: 0.4, tono: 'mid', pasos: 2, bisel: 0 }) +
    caja(x - 0.4, y - 4, 2.2, 16, 19, 12, { r: 0.8, tono: 'hi', pasos: 3, bisel: 0.3 }) +
    pantallaX(x + 1.8, y - 4, y + 12, 19, 31, { margen: 1, lineas: 4, acento: 'led' }) +
    // lector de mano en su soporte
    caja(x + 1.8, y + 6, 1.6, 3, 13, 1, { r: 0.3, tono: 'lo', pasos: 2, bisel: 0 }) +
    ac('hito', caja(x + 2, y + 6.2, 2.4, 2.6, 14, 4.6, { r: 0.7, tono: 'hi', pasos: 3, bisel: 0.3 })) +
    ac('celda', caja(x + 4.4, y + 6.6, 0.3, 1.8, 16.4, 1.6, { r: 0.2, tono: 'hi', pasos: 2, bisel: 0 }))
  );
}

function pallet() {
  const P = proyeccion();
  const B = plano(-56, 10, 30, 30, 0.6);
  const out = [sombra(B, 0, 5)];
  for (const y of [B.y, B.y + 13.4, B.y + 26.8]) out.push(ac('madera', caja(B.x, y, B.w, 3.2, 0, 2.6, { r: 0.3, tono: 'lo', pasos: 2, bisel: 0 })));
  for (const x of [B.x, B.x + 6.4, B.x + 12.8, B.x + 19.2, B.x + 25.6]) out.push(ac('madera', caja(x, B.y, 4.4, B.d, 2.6, 1.2, { r: 0.3, tono: 'mid', pasos: 2, bisel: 0 })));
  // dos capas de cajas; arriba falta una y la última es del color del hito
  const capas = [
    [[0, 0], [15, 0], [0, 15], [15, 15]],
    [[0, 0], [0, 15], [15, 15]],
  ];
  capas.forEach((capa, n) => {
    const z = 3.8 + n * 10.4;
    for (const [dx, dy] of porFondo(capa)) {
      const pl = plano(B.x + dx + 0.6, B.y + dy + 0.6, 13.8, 13.8, 0.6);
      const ultima = n === 1 && dx === 0 && dy === 15;
      out.push(ac(ultima ? 'hito' : 'madera', caja(pl.x, pl.y, pl.w, pl.d, z, 10, { r: 0.6, tono: 'hi', pasos: 2, bisel: 0.3, dentro: costura(pl, z + 8.2, 2, 'mid') })));
      out.push(L(k.lineOnTop([pl.x, pl.y + 6.9], [pl.x + pl.w, pl.y + 6.9], z + 10, P), { tone: 'mid' }));
      // etiqueta con QR en el frente
      const X = pl.x + pl.w;
      out.push(ac('papel', caja(X, pl.y + 2, 0.3, 6, z + 2.4, 5, { r: 0.2, tono: 'hi', pasos: 2, bisel: 0 })));
      out.push(ac('tinta', rejaX(X + 0.3, pl.y + 2.9, z + 4.6, 3, 3, 0.9, { size: 0.32, tone: 'mid' }) + renglones([[[X + 0.3, pl.y + 6.4, z + 3.4], [X + 0.3, pl.y + 3, z + 3.4]]], 'mid')));
    }
  });
  return out.join('');
}

function nodo() {
  const P = proyeccion();
  const N = plano(26, 12, 32, 24, 1.4);
  const out = [sombra(N, 0, 5), caja(N.x, N.y, N.w, N.d, 0, 3, { r: 1.4, tono: 'mid', pasos: 4, bisel: 0.5, dentro: costura(N, 1.2, 4) })];
  out.push(L(k.planOutline(k.insetPlan(N, 2), 3, P, 4), { tone: 'faint' }));
  out.push(texto([N.x + N.w, N.y + N.d / 2, 0.6], 'x', 'k8s', { tam: 1.9, tono: 'lo' }));
  // seis pods; uno recién agendado baja flotando a su lugar
  const pods = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) pods.push([N.x + 3 + i * 9.4, N.y + 3 + j * 9.6, i, j]);
  for (const [x, y, i, j] of porFondo(pods)) {
    const pl = plano(x, y, 7.4, 7.4, 0.9);
    const vivo = (i === 0 && j === 1) || (i === 2 && j === 0);
    const cubo = caja(x, y, 7.4, 7.4, 3, 7.4, { r: 0.9, tono: 'hi', pasos: 3, bisel: 0.4, dentro: costura(pl, 8.6, 3, 'mid') }) + aro(x + 3.7, y + 3.7, 1.7, 10.4, 'mid', 14);
    if (i === 1 && j === 0) {
      out.push(L(k.planOutline(pl, 3, P, 3), { tone: 'lo', dashed: true }));
      out.push(a.amFloat(`<g transform="${k.translateAlong(P, [0, 0, 5])}">${ac('hito', cubo)}</g>`, P, { rise: 3.4, period: 4200, halo: sombra(pl, 3, 2) }));
    } else {
      out.push(vivo ? ac('hito', cubo) : cubo);
    }
  }
  return out.join('');
}

function cuerpo() {
  const P = proyeccion();
  const e = escena();
  e.poner([-14, -27, 0], linea());
  e.poner([50, -39, 0], rack());
  e.poner([-13, 2, 0], terminal());
  e.poner([-41, 25, 0], pallet());
  e.poner([42, 24, 0], nodo());

  // zona de seguridad del pallet y el cable de datos por el piso, de la terminal al rack
  const piso =
    ac('led', L(k.planOutline(plano(-60, 6, 38, 38, 3), 0, P, 4), { tone: 'lit', dashed: true })) +
    L(camino([[-9, 2, 0], [8, 2, 0], [8, -8, 0], [38, -8, 0], [38, -36, 0], [42, -36, 0]]), { tone: 'lo' }) +
    ac('led', a.amDraw(camino([[-9, 2, 0], [8, 2, 0], [8, -8, 0], [38, -8, 0], [38, -36, 0], [42, -36, 0]]), { tone: 'lit', period: 3600 })) +
    D([en([-9, 2, 0]), en([42, -36, 0])], { size: 0.9, tone: 'mid' });
  return isla({ losetas: 20.5 }) + piso + e.armar();
}

export default {
  etiqueta: 'Una línea de trazabilidad industrial: cajas que avanzan por una cinta, pasan por una balanza azul y entran a una etiquetadora; una terminal con lector, un pallet con cajas etiquetadas con QR, un rack de servidores SAP con luces y un nodo de Kubernetes con sus pods.',
  cuerpo,
  puntos: () => puntosIsla(54),
  // puntos de interés (zoom de la portada): dónde están, en el mundo del diorama, y qué cuentan
  detalle: [
    { en: [-15, -27, 16], titulo: 'Trazabilidad en planta', texto: 'En MBRF, en San Jorge, desarrollo la captura en estación: balanzas, escaneo y etiquetas que llegan a SAP en tiempo real, para las plantas del frigorífico y los centros de distribución.' },
    { en: [58, -39, 30], titulo: 'SAP', texto: 'Tableros de planeamiento, calidad y stock de cuatro plantas, sincronizados contra SAP HANA.' },
    { en: [42, 24, 12], titulo: 'Kubernetes y equipo', texto: 'Acá aprendí Kubernetes y a coordinar equipos.' },
    { en: [-12.2, 4, 26], titulo: 'En paralelo', texto: 'Sigo como freelance con Neifert Automotores y Darío Martínez Computación, sumando a compañeros de la facultad para que también ganen experiencia.' },
  ],

};
