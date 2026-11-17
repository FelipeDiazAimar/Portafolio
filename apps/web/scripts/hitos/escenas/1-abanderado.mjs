// Hito 1 — 2022, abanderado e ingeniería: el mástil con la bandera que flamea (ISFA) y, al final
// del sendero, la facultad (UTN). Un birrete y un diploma en primer plano.
import { D, L, S, a, ac, arbusto, caja, camino, caraX, caraY, cil, costura, en, escena, isla, k, laja, plano, porFondo, proyeccion, puntosIsla, sombra, texto, torno, bola } from '../taller.mjs';

const MASTIL = [-36, 12];
// La bandera: tres franjas planas sobre un perfil ondulado. Cada franja es un solo trazo con la
// misma cantidad de puntos en todas las poses, así el navegador pasa de una pose a la siguiente
// de corrido (animación CSS de `d`) en vez de saltar entre cuadros como un pasacuadros.
const POSES = 12;
const FLAMEO_MS = 2600;
const FRANJAS = [
  [35, 40.2, 'hito'],
  [40.2, 45.4, 'papel'],
  [45.4, 50.6, 'hito'],
];
const lomoDe = (fase) =>
  Array.from({ length: 15 }, (_, i) => {
    const t = i / 14;
    return [MASTIL[0] + 0.8 + t * 24, MASTIL[1] + 1.7 * t * Math.sin(t * Math.PI * 2.1 - fase)];
  });
const faseDe = (pose) => (pose / POSES) * Math.PI * 2;
function franjaD(fase, z0, z1) {
  const lomo = lomoDe(fase);
  const puntos = [...lomo.map(([x, y]) => en([x, y, z1])), ...[...lomo].reverse().map(([x, y]) => en([x, y, z0]))];
  return `M${puntos.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z`;
}
function bandera() {
  const pasos = (valor) => Array.from({ length: POSES + 1 }, (_, n) => `${((n / POSES) * 100).toFixed(2)}%{${valor(faseDe(n % POSES))}}`).join('');
  const css = [];
  const trazos = FRANJAS.map(([z0, z1, material], i) => {
    css.push(`@keyframes flameo-${i}{${pasos((fase) => `d:path("${franjaD(fase, z0, z1)}")`)}}`);
    return ac(material, `<path class="flameo" style="animation-name:flameo-${i}" d="${franjaD(0, z0, z1)}"/>`);
  });
  // el sol viaja con la tela
  const centro = (fase) => {
    const [x, y] = lomoDe(fase)[7];
    return en([x, y, 42.8]);
  };
  const [sx, sy] = centro(0);
  css.push(`@keyframes flameo-sol{${pasos((fase) => `transform:translate(${(centro(fase)[0] - sx).toFixed(2)}px,${(centro(fase)[1] - sy).toFixed(2)}px)`)}}`);
  css.push(`.flameo{fill:var(--anatomy-top);stroke:var(--anatomy-hi);stroke-width:var(--anatomy-weight);stroke-linejoin:round;vector-effect:non-scaling-stroke;animation:flameo-0 ${FLAMEO_MS}ms linear infinite}`);
  css.push(`.flameo-sol{animation:flameo-sol ${FLAMEO_MS}ms linear infinite}`);
  css.push('@media (prefers-reduced-motion:reduce){.flameo,.flameo-sol{animation:none}}');
  const sol = `<g class="flameo-sol vivo-mueve">${ac('sol', D([[sx, sy]], { size: 1.7, tone: 'lit' }))}</g>`;
  // en su propia capa: al cambiar de forma se repinta sólo la bandera, no todo el diorama
  return `<style>${css.join('')}</style><g class="vivo-mueve">${trazos.join('')}</g>${sol}`;
}

function facultad() {
  const P = proyeccion();
  const B = plano(4, -44, 50, 26, 0.6);
  const frente = B.y + B.d; // y = -18
  const out = [];
  out.push(sombra(plano(0, -46, 58, 40, 2), 0, 6));
  // basamento y escalinata
  out.push(caja(0, -46, 58, 40, 0, 2.6, { r: 1, tono: 'mid', bisel: 0.5 }));
  out.push(caja(14, -6, 30, 4, 0, 1.3, { r: 0.6, tono: 'mid', bisel: 0.3 }));
  // cuerpo, con puerta del color del hito y ventanas
  out.push(caja(B.x, B.y, B.w, B.d, 2.6, 27.4, { r: 0.6, tono: 'mid', bisel: 0, dentro: costura(B, 6, 3) }));
  out.push(ac('hito', caja(23, frente, 12, 0.8, 2.6, 17, { r: 0.4, tono: 'hi', pasos: 2, bisel: 0 })));
  out.push(a.amPulse(ac('led', L(caraY(frente + 0.85, 23, 35, 2.6, 19.6), { tone: 'lit' })), { period: 3800, min: 0.08 }));
  out.push(L(k.segment([29, frente + 0.8, 2.6], [29, frente + 0.8, 19.6], P), { tone: 'lo' }) + D([en([27.6, frente + 0.8, 10]), en([30.4, frente + 0.8, 10])], { size: 0.6, tone: 'hi' }));
  out.push([8, 39].map((x) => ac('celda', caja(x, frente, 9, 0.4, 11, 11, { r: 0.3, tono: 'hi', pasos: 2, bisel: 0 })) + L(k.segment([x + 4.5, frente + 0.4, 11], [x + 4.5, frente + 0.4, 22], P), { tone: 'lo' })).join(''));
  out.push([-40, -32, -24].map((y) => ac('celda', caja(B.x + B.w, y, 0.4, 5.4, 10, 12, { r: 0.3, tono: 'hi', pasos: 2, bisel: 0 }))).join(''));
  // columnas del pórtico
  const columnas = porFondo([9, 20, 38, 49].map((x) => [x, -11]));
  for (const [x, y] of columnas) {
    out.push(caja(x - 2.6, y - 2.6, 5.2, 5.2, 2.6, 1.4, { r: 0.4, tono: 'mid', pasos: 2, bisel: 0 }));
    out.push(cil(x, y, 1.9, 4, 23.4, { tono: 'hi', pasos: 18, dentro: L(k.knurl(x, y, 1.9, 4, 27.4, 10, P, 0), { tone: 'faint' }) }));
    out.push(caja(x - 2.6, y - 2.6, 5.2, 5.2, 27.4, 1.6, { r: 0.4, tono: 'mid', pasos: 2, bisel: 0 }));
  }
  // cornisa y ático con la placa
  out.push(caja(1.5, -45.5, 55, 39, 29, 3, { r: 0.8, tono: 'hi', bisel: 0.6, dentro: costura(plano(1.5, -45.5, 55, 39, 0.8), 30.2, 3) }));
  out.push(caja(12, -38, 34, 22, 32, 8, { r: 0.6, tono: 'mid', bisel: 0.5 }));
  out.push(texto([29, -16, 33.6], 'y', 'UTN', { tam: 5.2, tono: 'hi' }));
  return out.join('');
}

function cuerpo() {
  const P = proyeccion();
  const e = escena();
  e.poner([29, -26, 0], facultad());

  // mástil sobre su pedestal escalonado, con la bandera flameando
  const [mx, my] = MASTIL;
  e.poner(
    [mx, my, 0],
    sombra(plano(mx - 11, my - 11, 22, 22, 11), 0, 5) +
      cil(mx, my, 10, 0, 2.4, { tono: 'mid', pasos: 40, bisel: 0.6 }) +
      cil(mx, my, 6.6, 2.4, 2.4, { tono: 'mid', pasos: 32, bisel: 0.5 }) +
      cil(mx, my, 1.6, 4.8, 2.6, { tono: 'hi', pasos: 16 }) +
      cil(mx, my, 0.8, 7.4, 44.4, { tono: 'hi', pasos: 12 }) +
      bola([mx, my, 52.8], 1.5) +
      L(camino([[mx + 0.8, my, 50.6], [mx + 0.8, my, 35]]), { tone: 'lo' }) +
      bandera()
  );

  // cartel de la escuela
  e.poner(
    [-54, 30, 0],
    cil(-54, 24, 0.8, 0, 8, { tono: 'lo', pasos: 10 }) +
      cil(-54, 38, 0.8, 0, 8, { tono: 'lo', pasos: 10 }) +
      caja(-54.6, 21, 1.2, 20, 7, 8.4, { r: 0.5, tono: 'hi', pasos: 2, bisel: 0 }) +
      texto([-53.4, 31, 9.4], 'x', 'ISFA', { tam: 4, tono: 'hi' })
  );

  // sendero de lajas, del mástil a la escalinata
  for (const [x, y, r] of [[-22, 10, 3.6], [-13, 7, 3.2], [-4, 5.4, 3.6], [5, 3, 3.2], [14, 1.6, 3.6]]) e.poner([x, y, 0], laja(x, y, r));

  // birrete sobre un pedestal, con la borla del color del hito
  const [bx, by] = [12, 30];
  e.poner(
    [bx, by, 0],
    sombra(plano(bx - 8, by - 8, 16, 16, 2), 0, 4) +
      caja(bx - 7, by - 7, 14, 14, 0, 1.4, { r: 1, tono: 'lo', bisel: 0.3 }) +
      caja(bx - 5.6, by - 5.6, 11.2, 11.2, 1.4, 8, { r: 0.8, tono: 'mid', bisel: 0.5, dentro: costura(plano(bx - 5.6, by - 5.6, 11.2, 11.2, 0.8), 3, 3) }) +
      ac('ebano', cil(bx, by, 4.2, 9.4, 3.2, { tono: 'hi', pasos: 24 })) +
      ac('ebano', caja(bx - 7, by - 7, 14, 14, 12.6, 0.9, { r: 0.5, tono: 'hi', pasos: 2, bisel: 0.3 })) +
      D([en([bx, by, 13.5])], { size: 1, tone: 'hi' }) +
      ac('led', L(camino([[bx, by, 13.5], [bx + 7, by + 3, 13.5], [bx + 7, by + 3, 8.6]]), { tone: 'lit' }) + D([en([bx + 7, by + 3, 8.6])], { size: 1.2, tone: 'lit' }))
  );

  // diploma enrollado, con su cinta
  e.poner([36, 34, 0], ac('papel', torno([[0, 2], [17, 2]], [28, 38, 2], [0.96, -0.28, 0])) + ac('hito', torno([[7, 2.25], [10, 2.25]], [28, 38, 2], [0.96, -0.28, 0])));

  // verde
  for (const [x, y, r] of [[-54, -38, 5.4], [-44, -44, 4], [-16, -40, 6], [56, 22, 4.4], [-8, 44, 3.6], [50, 40, 3.2]]) e.poner([x, y, 0], arbusto(x, y, r));

  return isla({ material: 'cesped' }) + e.armar();
}

export default {
  etiqueta: 'Un mástil con la bandera argentina flameando sobre un pedestal, un sendero de lajas hasta un edificio universitario con columnas y la placa UTN, y un birrete y un diploma en primer plano.',
  cuerpo,
  puntos: () => puntosIsla(54),
  // puntos de interés (zoom de la portada): dónde están, en el mundo del diorama, y qué cuentan
  detalle: [
    { en: [-24, 12, 43], titulo: 'Abanderado del ISFA', texto: 'Terminé el secundario como abanderado del Instituto San Francisco de Asís, en San Francisco, Córdoba.' },
    { en: [29, -12, 18], titulo: 'Ingeniería en Sistemas', texto: 'Ese mismo año, 2022, empecé Ingeniería en Sistemas de Información en la UTN San Francisco. Hoy curso el 4.º año.' },
  ],

  acentos: (oscuro) => ({ sol: { hex: '#f2b23c', mode: 'ink' }, papel: oscuro ? '#d5d8de' : '#ffffff' }),
};
