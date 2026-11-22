'use client';

// Intro de "Sobre mí": antes de que la sección entre, un equipo de agentes de IA (cada uno de un
// proveedor distinto, con su color) arma el plano de la pantalla en tiempo real. Cada cursor
// llega, arrastra la caja de una capa (renglones del titular, portadas, ficha, regla) y la firma;
// abajo, una píldora cuenta agentes y capas. Al 100% el plano se funde y debajo aparece lo real
// con su entrada de siempre. Corre en los dos sentidos: al bajar desde el hero se arma, y al
// volver a subir se desarma (la misma línea de tiempo, al revés: el plano vuelve sobre lo real,
// lo real se esconde, los cursores borran las cajas y se van). Con movimiento reducido no existe.
//
// Las capas llegan medidas desde el reel (px del panel): cuatro esquinas por capa, así las
// portadas curvas en perspectiva se dibujan con su forma exacta y no con una caja aproximada.
import { useEffect, useMemo, useRef } from 'react';
import { gsap } from 'gsap';
import styles from './IntroAgentes.module.css';

// Colores de marca de cada proveedor. `color` va en el trazo y el cursor; `fondo` (si hay) en
// las etiquetas, para los que usan degradé; `texto` es el color legible sobre la etiqueta.
export const AGENTES = [
  { nombre: 'Claude', color: '#D97757', texto: '#fff' },
  { nombre: 'ChatGPT', color: '#10A37F', texto: '#fff' },
  { nombre: 'Gemini', color: '#4285F4', fondo: 'linear-gradient(90deg, #4285F4, #9B72CB 55%, #D96570)', texto: '#fff' },
  { nombre: 'Grok', color: 'var(--color-fg)', texto: 'var(--color-bg)' },
  { nombre: 'DeepSeek', color: '#4D6BFE', texto: '#fff' },
  { nombre: 'Mistral', color: '#FA520F', fondo: 'linear-gradient(90deg, #FFAF00, #FA520F 60%, #E10500)', texto: '#fff' },
  { nombre: 'Copilot', color: '#2A7DE1', fondo: 'linear-gradient(90deg, #2A7DE1, #6E5BD8 50%, #E36B9C)', texto: '#fff' },
  { nombre: 'Perplexity', color: '#20808D', texto: '#fff' },
  { nombre: 'Qwen', color: '#615CED', texto: '#fff' },
  { nombre: 'Meta AI', color: '#0866FF', fondo: 'linear-gradient(90deg, #0866FF, #A33BF8)', texto: '#fff' },
  { nombre: 'Hugging Face', color: '#E8A600', fondo: '#FFD21E', texto: '#1a1a1a' },
  { nombre: 'Llama', color: '#7B61FF', fondo: 'linear-gradient(90deg, #7B61FF, #1D9BF0)', texto: '#fff' },
];

// `sessionStorage['portafolio:sin-intro'] = '1'` la apaga (lo usan las pruebas automáticas).
const CLAVE = 'portafolio:sin-intro';
export function introPendiente() {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  try {
    return sessionStorage.getItem(CLAVE) !== '1';
  } catch {
    return true;
  }
}

const lerp = (a, b, t) => a + (b - a) * t;
const formaEn = (q, t) => q.map(([x, y]) => [lerp(q[0][0], x, t), lerp(q[0][1], y, t)]);
const aPuntos = (q) => q.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
const caja = (q) => {
  const xs = q.map((p) => p[0]);
  const ys = q.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
};

// Punta de flecha del cursor (como la de un editor multijugador).
function Flecha({ color }) {
  return (
    <svg className={styles.flecha} width="18" height="20" viewBox="0 0 18 20" aria-hidden="true">
      <path d="M1.5 1.5 L16 9.2 L9.4 10.9 L6.3 17.6 Z" fill={color} stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

// capas: [{ nombre, puntos: [[x,y] × 4] }] (arribaIzq, arribaDer, abajoDer, abajoIzq).
// ancho/alto: tamaño del panel. alFundir: el plano empieza a irse (que entre lo real).
// alTerminar: ya no se ve.
// `sentido`: 'armar' (al bajar) o 'desarmar' (al subir). `alOcultar`: al desarmar, el momento en
// que lo real tiene que esconderse (el plano ya lo cubre).
// `alCapa(revela, t, puntos)`: mientras una caja crece (o se achica, al desarmar), cuánto creció
// (0..1) y su forma en ese momento: lo real que le toca se ve recortado a ella.
export default function IntroAgentes({ capas, ancho, alto, alFundir, alTerminar, alOcultar, alCapa, sentido = 'armar' }) {
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
  const refEstado = useRef(null);
  const refFundir = useRef(alFundir);
  const refTerminar = useRef(alTerminar);
  refFundir.current = alFundir;
  refTerminar.current = alTerminar;
  const refOcultar = useRef(alOcultar);
  refOcultar.current = alOcultar;
  const refCapa = useRef(alCapa);
  refCapa.current = alCapa;

  const agentes = useMemo(() => AGENTES.slice(0, Math.max(1, Math.min(AGENTES.length, capas.length))), [capas.length]);
  // Reparto: en orden de armado, una capa para cada agente que se suma (en ronda).
  // de quién es cada caja: lo decide la línea de tiempo (el que quede libre antes); de entrada, en
  // ronda (sólo para pintar cada caja del color de su agente antes de que corra)
  const dueno = useMemo(() => capas.map((_, i) => i % agentes.length), [capas, agentes.length]);

  useEffect(() => {
    const raiz = refRaiz.current;
    if (!raiz || capas.length === 0) {
      if (sentido === 'desarmar') refOcultar.current?.();
      else refFundir.current?.();
      refTerminar.current?.();
      return undefined;
    }
    const desarmar = sentido === 'desarmar';
    // al desarmar, la línea de tiempo se lleva primero al final (todo armado) y desde ahí corre al
    // revés: mientras se la lleva, sus avisos no tienen que disparar nada
    let preparando = desarmar;
    const total = capas.length;
    let unidos = 0;
    let hechas = 0;
    const contar = () => {
      if (refAgentes.current) refAgentes.current.textContent = `${unidos} ${unidos === 1 ? 'agente' : 'agentes'}`;
      if (refCapas.current) refCapas.current.textContent = `${hechas} / ${total} capas`;
      const p = hechas / total;
      if (refBarra.current) refBarra.current.style.transform = `scaleX(${p.toFixed(3)})`;
      if (refPct.current) refPct.current.textContent = `${Math.round(p * 100)}%`;
    };
    contar();

    const terminar = () => {
      if (!preparando) refTerminar.current?.();
    };
    const tl = gsap.timeline({ paused: desarmar, onComplete: desarmar ? undefined : terminar, onReverseComplete: desarmar ? terminar : undefined });
    tl.fromTo(raiz, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power1.out' }, 0);
    tl.fromTo(refRaiz.current.querySelector(`.${styles.grilla}`), { opacity: 0 }, { opacity: 1, duration: 0.8, ease: 'power1.out' }, 0);
    tl.fromTo(`.${styles.pildora}`, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, ease: 'expo.out' }, 0.15);

    // Los agentes salen de su pelotita de color en la píldora de abajo, recién cuando les toca su
    // primera caja. Las cajas se dibujan de a una (cada una empieza cuando termina la anterior: no se
    // pisan) y cada caja nueva la toma el agente que quede libre antes. Mientras una caja crece
    // desde su esquina, lo real que le toca se ve recortado a ella (alCapa recibe cuánto creció,
    // 0..1). Firmada, la caja se desvanece (queda lo real). El agente que ya no tiene trabajo vuelve
    // a su pelotita y se sumerge en ella. Al desarmar, todo esto mismo corre al revés.
    const caja = refRaiz.current.getBoundingClientRect();
    const casa = agentes.map((_, a) => {
      const r = refAvatares.current[a]?.getBoundingClientRect();
      return r ? [r.left + r.width / 2 - caja.left, r.top + r.height / 2 - caja.top] : [ancho / 2, alto - 30];
    });
    agentes.forEach((_, a) => {
      const cursor = refCursores.current[a];
      if (cursor) gsap.set(cursor, { x: casa[a][0], y: casa[a][1], opacity: 0, scale: 0.4 });
    });
    const pos = casa.map((p) => [...p]);
    const libre = agentes.map(() => null); // null = todavía no salió
    const ultima = agentes.map(() => 0); // cuándo termina su última caja
    const trabajos = agentes.map(() => 0);
    let previo = -1;
    let finDibujo = 0.6; // cuándo termina la caja anterior (la siguiente no empieza antes)
    capas.forEach((capa, i) => {
      const q = capa.puntos;
      // el agente que pueda empezar antes (a igualdad, el que menos trabajó y no el de recién)
      let a = -1;
      let mejor = Infinity;
      agentes.forEach((_, k) => {
        if (!refCursores.current[k]) return;
        const ir = Math.min(0.62, Math.max(0.26, Math.hypot(q[0][0] - pos[k][0], q[0][1] - pos[k][1]) / 1500));
        const desde = libre[k] === null ? 0.3 : libre[k];
        const empieza = Math.max(finDibujo, desde + ir) + trabajos[k] * 0.02 + (k === previo ? 0.05 : 0);
        if (empieza < mejor) {
          mejor = empieza;
          a = k;
        }
      });
      if (a < 0) return;
      dueno[i] = a;
      previo = a;
      // la caja, su firma y su medida, del color de quien la dibuja
      const ag = agentes[a];
      refFormas.current[i]?.style.setProperty('--c', ag.color);
      for (const el of [refChips.current[i], refMedidas.current[i]]) {
        el?.style.setProperty('--c', ag.color);
        el?.style.setProperty('--f', ag.fondo ?? ag.color);
        el?.style.setProperty('--t', ag.texto);
      }
      const nombreChip = refChips.current[i]?.querySelector('b');
      if (nombreChip) nombreChip.textContent = ag.nombre;
      const cursor = refCursores.current[a];
      const forma = refFormas.current[i];
      const chip = refChips.current[i];
      const medida = refMedidas.current[i];
      const ir = Math.min(0.62, Math.max(0.26, Math.hypot(q[0][0] - pos[a][0], q[0][1] - pos[a][1]) / 1500));
      const desde = libre[a] === null ? 0.3 : libre[a];
      const inicio = Math.max(finDibujo, desde + ir);
      if (libre[a] === null) {
        // sale de su pelotita
        const sale = inicio - ir - 0.12;
        tl.to(cursor, { opacity: 1, scale: 1, duration: 0.18, ease: 'back.out(2)' }, sale);
        tl.call(
          () => {
            const atras = tl.reversed();
            unidos += atras ? -1 : 1;
            refAvatares.current[a]?.setAttribute('data-fuera', atras ? 'false' : 'true');
            contar();
          },
          null,
          sale
        );
      }
      // ir a la esquina donde empieza la caja (llega justo cuando le toca dibujar)
      tl.to(cursor, { x: q[0][0], y: q[0][1], duration: ir, ease: 'power2.inOut' }, inicio - ir);
      // arrastrar hasta la esquina opuesta: la caja crece detrás del cursor, y lo real con ella
      const arrastre = { t: 0 };
      const dur = 0.3 + Math.min(0.28, Math.hypot(q[2][0] - q[0][0], q[2][1] - q[0][1]) / 2600);
      tl.set(forma, { opacity: 1 }, inicio);
      tl.to(
        arrastre,
        {
          t: 1,
          duration: dur,
          ease: 'power1.inOut',
          onUpdate: () => {
            const puntos = formaEn(q, arrastre.t);
            forma?.setAttribute('points', aPuntos(puntos));
            if (!preparando) refCapa.current?.(capa.revela, arrastre.t, puntos);
          },
        },
        inicio
      );
      tl.to(cursor, { x: q[2][0], y: q[2][1], duration: dur, ease: 'power1.inOut' }, inicio);
      // la firma: quién la hizo y cuánto mide; un momento después, la caja se va (queda lo real)
      tl.fromTo([chip, medida], { opacity: 0, scale: 0.86 }, { opacity: 1, scale: 1, duration: 0.22, ease: 'back.out(2)' }, inicio + dur);
      tl.to([forma, chip, medida], { opacity: 0, duration: 0.35, ease: 'power1.in' }, inicio + dur + 0.45);
      tl.call(
        () => {
          hechas += tl.reversed() ? -1 : 1;
          contar();
        },
        null,
        inicio + dur
      );
      finDibujo = inicio + dur + 0.03;
      libre[a] = inicio + dur + 0.12;
      ultima[a] = inicio + dur;
      trabajos[a] += 1;
      pos[a] = q[2];
    });
    // sin más trabajo, cada agente vuelve a su pelotita y se sumerge en ella
    let fin = finDibujo;
    agentes.forEach((_, a) => {
      const cursor = refCursores.current[a];
      if (!cursor || libre[a] === null) return;
      const vuelve = libre[a];
      const viaje = Math.min(0.7, Math.max(0.35, Math.hypot(casa[a][0] - pos[a][0], casa[a][1] - pos[a][1]) / 1400));
      tl.to(cursor, { x: casa[a][0], y: casa[a][1], duration: viaje, ease: 'power2.in' }, vuelve);
      tl.to(cursor, { opacity: 0, scale: 0.2, duration: 0.18, ease: 'power2.in' }, vuelve + viaje - 0.06);
      const avatar = refAvatares.current[a];
      if (avatar) tl.fromTo(avatar, { scale: 1 }, { scale: 1.55, duration: 0.14, ease: 'power2.out', yoyo: true, repeat: 1 }, vuelve + viaje - 0.04);
      tl.call(
        () => {
          const atras = tl.reversed();
          unidos += atras ? 1 : -1;
          refAvatares.current[a]?.setAttribute('data-fuera', atras ? 'true' : 'false');
          contar();
        },
        null,
        vuelve + viaje
      );
      fin = Math.max(fin, vuelve + viaje + 0.2);
    });

    // 100%: los cursores se van, el plano se funde y por debajo entra lo real
    fin += 0.3;
    tl.call(() => refEstado.current?.setAttribute('data-listo', tl.reversed() ? 'false' : 'true'), null, fin);
    // armando, aquí entra lo real; desarmando (al revés), aquí se esconde, ya con el plano encima
    tl.call(
      () => {
        if (tl.reversed()) refOcultar.current?.();
        else if (!preparando) refFundir.current?.();
      },
      null,
      fin + 0.25
    );
    tl.to(refCursores.current.filter(Boolean), { opacity: 0, scale: 0.6, duration: 0.3, stagger: 0.02, ease: 'power2.in' }, fin);
    tl.to(raiz, { opacity: 0, duration: 0.85, ease: 'power2.inOut' }, fin + 0.35);

    if (desarmar) {
      tl.progress(1);
      preparando = false;
      // de vuelta, un poco más rápido: es una salida
      tl.timeScale(1.35).reverse().paused(false);
    }

    // Mientras dura, la página queda quieta (la traba el reel): la rueda no la saltea, así se
    // ve. Un clic, un toque o una tecla la apuran hasta el final.
    const acelerar = () => {
      if (tl.timeScale() < 4) gsap.to(tl, { timeScale: 6, duration: 0.2, ease: 'power1.in' });
    };
    const opciones = { passive: true };
    window.addEventListener('keydown', acelerar);
    window.addEventListener('pointerdown', acelerar, opciones);
    return () => {
      window.removeEventListener('keydown', acelerar);
      window.removeEventListener('pointerdown', acelerar, opciones);
      tl.kill();
    };
  }, [capas, agentes, dueno, ancho, alto, sentido]);

  return (
    <div ref={refRaiz} className={styles.intro} aria-hidden="true">
      <div className={styles.grilla} />
      <svg className={styles.plano} width={ancho} height={alto}>
        {capas.map((capa, i) => {
          const agente = agentes[dueno[i]];
          return (
            <polygon
              key={capa.nombre + i}
              ref={(el) => (refFormas.current[i] = el)}
              className={styles.forma}
              points={aPuntos(formaEn(capa.puntos, 0))}
              style={{ '--c': agente.color }}
            />
          );
        })}
      </svg>
      {capas.map((capa, i) => {
        const agente = agentes[dueno[i]];
        const q = capa.puntos;
        const b = caja(q);
        const estilo = { '--c': agente.color, '--f': agente.fondo ?? agente.color, '--t': agente.texto };
        return (
          <span key={capa.nombre + i}>
            <span ref={(el) => (refChips.current[i] = el)} className={styles.chip} style={{ ...estilo, left: q[0][0], top: q[0][1] }}>
              <b>{agente.nombre}</b> · {capa.nombre}
            </span>
            <span
              ref={(el) => (refMedidas.current[i] = el)}
              className={styles.medida}
              style={{ ...estilo, left: (q[2][0] + q[3][0]) / 2, top: Math.max(q[2][1], q[3][1]) }}
            >
              {Math.round(b.x1 - b.x0)} × {Math.round(b.y1 - b.y0)}
            </span>
          </span>
        );
      })}
      {agentes.map((agente, a) => (
        <div key={agente.nombre} ref={(el) => (refCursores.current[a] = el)} className={styles.cursor}>
          <Flecha color={agente.color} />
          <span className={styles.etiqueta} style={{ '--f': agente.fondo ?? agente.color, '--t': agente.texto }}>
            {agente.nombre}
          </span>
        </div>
      ))}
      <div ref={refEstado} className={styles.pildora} data-listo="false">
        <span className={styles.avatares}>
          {agentes.map((agente, a) => (
            <i key={agente.nombre} ref={(el) => (refAvatares.current[a] = el)} style={{ '--f': agente.fondo ?? agente.color }} data-fuera="false" />
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
}
