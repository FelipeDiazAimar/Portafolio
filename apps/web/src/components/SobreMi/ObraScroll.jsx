'use client';

// Obra de los agentes sobre una portada del reel: la construyen (la card, sus partes y las líneas
// de su ficha) o la desarman. Todo es función del avance `p` (0 = nada, 1 = terminada), que el
// reel hace correr a su ritmo hacia un lado o hacia el otro. Cada capa trae su `tramo` (cuándo
// la dibuja su agente, en unidades): lo que no se pisa va en paralelo.
//
// Las cajas van pegadas a la portada, que se mueve mientras se construye: en cada cuadro el reel
// manda dónde está cada capa en pantalla (`quads`) y acá se recalcula todo. Cada capa tiene su
// tramo del avance: su agente sale de su pelotita en la píldora, dibuja la caja desde la esquina,
// la firma, y vuelve a sumergirse; la caja se desvanece (queda lo real, que el reel recorta a ella).
import { forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { AGENTES } from './IntroAgentes.jsx';
import styles from './IntroAgentes.module.css';

const INICIO = 0.04; // antes, nada
const FINAL = 0.95; // para entonces todos los agentes volvieron (después se apaga)
const VUELTA = 0.7; // lo que tarda un agente en volver a su pelotita (en unidades)
const VIAJE = 0.32; // de cada tramo: la llegada a la esquina (el resto es el trazo)

const lerp = (a, b, t) => a + (b - a) * t;
const limitar = (v) => Math.min(1, Math.max(0, v));
const suave = (v) => {
  const t = limitar(v);
  return t * t * (3 - 2 * t);
};
const formaLineal = (q, t) => q.map(([x, y]) => [lerp(q[0][0], x, t), lerp(q[0][1], y, t)]);
const aPuntos = (q) => q.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

function Flecha({ color }) {
  return (
    <svg className={styles.flecha} width="18" height="20" viewBox="0 0 18 20" aria-hidden="true">
      <path d="M1.5 1.5 L16 9.2 L9.4 10.9 L6.3 17.6 Z" fill={color} stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

// `capas`: [{ nombre }]. El reel llama a `actualizar(p, quads, alCapa)` en cada cuadro: `quads[j]`
// es dónde está la capa j ahora (4 puntos, px del panel; o una función t → forma) o null; `alCapa(j, t, forma)` recibe
// cuánto creció la caja de la capa j (0..1) y su forma, para recortar lo real a ella.
// Cuánto creció la caja de la capa j (0..1) con el avance p de la obra (lo usa el reel para
// descubrir lo real de las obras que siguen en segundo plano, sin sus agentes a la vista).
export function crecimientoCapa(capas, j, p) {
  const tramos = capas.map((capa, k) => capa.tramo ?? [k, k + 1]);
  const total = Math.max(1, ...tramos.map((t) => t[1]));
  const ritmo = (FINAL - INICIO) / (total + VUELTA);
  const s0 = INICIO + tramos[j][0] * ritmo;
  const largo = (tramos[j][1] - tramos[j][0]) * ritmo;
  const sDibujo = s0 + largo * VIAJE;
  return Math.min(1, Math.max(0, (p - sDibujo) / (largo * (1 - VIAJE))));
}

const ObraScroll = forwardRef(function ObraScroll({ capas, ancho, alto, conPildora = true, debajoDeLaFicha = false }, ref) {
  const refRaiz = useRef(null);
  const refFormas = useRef([]);
  const refChips = useRef([]);
  const refMedidas = useRef([]);
  const refCursores = useRef([]);
  const refAvatares = useRef([]);
  const refAgentes = useRef(null);
  const refCapas = useRef(null);
  const refBarra = useRef(null);
  const refPct = useRef(null);
  const refCasas = useRef([]);
  // cada capa trae su agente (el reel elige uno libre en su tramo)
  const indiceAgente = (j) => capas[j]?.agente ?? j % AGENTES.length;
  const agenteDe = (j) => AGENTES[indiceAgente(j)];

  const medirCasas = useCallback(() => {
    const raiz = refRaiz.current;
    if (!raiz) return;
    const caja = raiz.getBoundingClientRect();
    refCasas.current = capas.map((_, j) => {
      const r = refAvatares.current[indiceAgente(j)]?.getBoundingClientRect();
      return r ? [r.left + r.width / 2 - caja.left, r.top + r.height / 2 - caja.top] : [40, alto - 30];
    });
  }, [capas, alto]);
  useLayoutEffect(() => {
    medirCasas();
  }, [medirCasas]);

  useImperativeHandle(
    ref,
    () => ({
      actualizar(p, quads, alCapa) {
        const raiz = refRaiz.current;
        if (!raiz) return;
        const n = capas.length;
        const tramos = capas.map((capa, j) => capa.tramo ?? [j, j + 1]);
        const total = Math.max(1, ...tramos.map((t) => t[1]));
        const ritmo = (FINAL - INICIO) / (total + VUELTA); // avance por unidad
        raiz.style.opacity = (suave(p / INICIO) * (1 - suave((p - 0.955) / 0.04))).toFixed(3);
        let hechas = 0;
        const fuera = new Set();
        capas.forEach((_, j) => {
          // cada capa llega como su forma entera (4 puntos) o como una función t → forma (la caja a
          // medio crecer exacta, en perspectiva, como la descubre el shader)
          const fuente = quads[j] ?? null;
          const q = typeof fuente === 'function' ? fuente(1) : fuente;
          const formaEn = (_q, t) => (typeof fuente === 'function' ? fuente(t) ?? formaLineal(q, t) : formaLineal(q, t));
          const forma = refFormas.current[j];
          const chip = refChips.current[j];
          const medida = refMedidas.current[j];
          const cursor = refCursores.current[j];
          const s0 = INICIO + tramos[j][0] * ritmo;
          const sFin = INICIO + tramos[j][1] * ritmo;
          const largo = sFin - s0;
          const sDibujo = s0 + largo * VIAJE;
          const t = limitar((p - sDibujo) / (largo * (1 - VIAJE)));
          if (t >= 1) hechas += 1;
          alCapa?.(j, t, q ? formaEn(q, t) : null);
          // la caja: crece con el trazo, se firma al terminar y se desvanece en el tramo siguiente
          const desvanece = 1 - limitar((p - sFin) / (largo * 0.8));
          const opacidad = t > 0 && q ? desvanece : 0;
          if (forma) {
            forma.style.opacity = opacidad.toFixed(3);
            if (q && t > 0) forma.setAttribute('points', aPuntos(formaEn(q, t)));
          }
          const firmada = t >= 1 && q ? opacidad : 0;
          if (chip) {
            chip.style.opacity = firmada.toFixed(3);
            if (q) chip.style.transform = `translate(${q[0][0].toFixed(1)}px, ${q[0][1].toFixed(1)}px)`;
          }
          if (medida) {
            medida.style.opacity = firmada.toFixed(3);
            if (q) {
              const xs = q.map((v) => v[0]);
              const ys = q.map((v) => v[1]);
              medida.textContent = `${Math.round(Math.max(...xs) - Math.min(...xs))} × ${Math.round(Math.max(...ys) - Math.min(...ys))}`;
              medida.style.transform = `translate(${((q[2][0] + q[3][0]) / 2).toFixed(1)}px, ${Math.max(q[2][1], q[3][1]).toFixed(1)}px)`;
            }
          }
          // el agente: sale de su pelotita, va a la esquina, arrastra, y vuelve a sumergirse
          if (!cursor) return;
          const casa = refCasas.current[j] ?? [40, alto - 30];
          const sVuelta = sFin + VUELTA * ritmo;
          if (!q || p <= s0 || p >= sVuelta) {
            cursor.style.opacity = '0';
            return;
          }
          let x;
          let y;
          let escala = 1;
          if (p < sDibujo) {
            const u = suave((p - s0) / (largo * VIAJE));
            x = lerp(casa[0], q[0][0], u);
            y = lerp(casa[1], q[0][1], u);
            escala = 0.4 + 0.6 * limitar(u * 3);
          } else if (p < sFin) {
            [x, y] = formaEn(q, t)[2];
          } else {
            const u = suave((p - sFin) / (sVuelta - sFin));
            x = lerp(q[2][0], casa[0], u);
            y = lerp(q[2][1], casa[1], u);
            escala = 1 - 0.8 * limitar((u - 0.7) / 0.3);
          }
          fuera.add(indiceAgente(j));
          cursor.style.opacity = '1';
          cursor.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${escala.toFixed(3)})`;
        });
        // la píldora: cuántos agentes andan afuera, cuántas capas van y la barra
        refAvatares.current.forEach((el, a) => el?.setAttribute('data-fuera', fuera.has(a) ? 'true' : 'false'));
        if (refAgentes.current) refAgentes.current.textContent = `${fuera.size} ${fuera.size === 1 ? 'agente' : 'agentes'}`;
        if (refCapas.current) refCapas.current.textContent = `${hechas} / ${n} capas`;
        if (refBarra.current) refBarra.current.style.transform = `scaleX(${(hechas / Math.max(1, n)).toFixed(3)})`;
        if (refPct.current) refPct.current.textContent = `${Math.round((hechas / Math.max(1, n)) * 100)}%`;
      },
      medir: medirCasas,
      capas,
    }),
    [capas, alto, medirCasas]
  );

  return (
    <div ref={refRaiz} className={styles.intro} style={{ opacity: 0, ...(debajoDeLaFicha ? { zIndex: 2 } : null) }} aria-hidden="true">
      <svg className={styles.plano} width={ancho} height={alto}>
        {capas.map((capa, j) => (
          <polygon key={capa.nombre + j} ref={(el) => (refFormas.current[j] = el)} className={styles.forma} style={{ '--c': agenteDe(j).color, opacity: 0 }} />
        ))}
      </svg>
      {capas.map((capa, j) => {
        const ag = agenteDe(j);
        const estilo = { '--c': ag.color, '--f': ag.fondo ?? ag.color, '--t': ag.texto, left: 0, top: 0, opacity: 0 };
        return (
          <span key={capa.nombre + j}>
            <span ref={(el) => (refChips.current[j] = el)} className={styles.chip} style={estilo}>
              <b>{ag.nombre}</b> · {capa.nombre}
            </span>
            <span ref={(el) => (refMedidas.current[j] = el)} className={styles.medida} style={estilo} />
          </span>
        );
      })}
      {capas.map((capa, j) => {
        const ag = agenteDe(j);
        return (
          <div key={capa.nombre + j} ref={(el) => (refCursores.current[j] = el)} className={styles.cursor} style={{ opacity: 0 }}>
            <Flecha color={ag.color} />
            <span className={styles.etiqueta} style={{ '--f': ag.fondo ?? ag.color, '--t': ag.texto }}>
              {ag.nombre}
            </span>
          </div>
        );
      })}
      <div className={styles.pildora} style={{ opacity: conPildora ? 1 : 0 }}>
        <span className={styles.avatares}>
          {AGENTES.map((ag, a) => (
            <i key={ag.nombre} ref={(el) => (refAvatares.current[a] = el)} style={{ '--f': ag.fondo ?? ag.color }} data-fuera="false" />
          ))}
        </span>
        <span ref={refAgentes} className={styles.cuenta}>
          0 agentes
        </span>
        <span ref={refCapas} className={styles.capas}>
          0 / {capas.length} capas
        </span>
        <span className={styles.barra}>
          <span ref={refBarra} />
        </span>
        <span ref={refPct} className={styles.pct}>
          0%
        </span>
      </div>
    </div>
  );
});

export default ObraScroll;
