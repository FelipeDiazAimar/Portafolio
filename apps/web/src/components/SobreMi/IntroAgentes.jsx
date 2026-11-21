'use client';

// Intro de "Sobre mí": antes de que la sección entre, un equipo de agentes de IA (cada uno de un
// proveedor distinto, con su color) arma el plano de la pantalla en tiempo real. Cada cursor
// llega, arrastra la caja de una capa (renglones del titular, portadas, ficha, regla) y la firma;
// abajo, una píldora cuenta agentes y capas. Al 100% el plano se funde y debajo aparece lo real
// con su entrada de siempre. Se ve una vez por visita; con movimiento reducido no existe.
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

const CLAVE = 'portafolio:intro-agentes';
export function introPendiente() {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  // ?intro en la URL la fuerza (para volver a verla sin abrir otra pestaña)
  if (new URLSearchParams(window.location.search).has('intro')) return true;
  try {
    return sessionStorage.getItem(CLAVE) !== '1';
  } catch {
    return false;
  }
}
function marcarVista() {
  try {
    sessionStorage.setItem(CLAVE, '1');
  } catch {
    /* sin almacenamiento: se vuelve a ver, nada más */
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
export default function IntroAgentes({ capas, ancho, alto, alFundir, alTerminar }) {
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

  const agentes = useMemo(() => AGENTES.slice(0, Math.max(1, Math.min(AGENTES.length, capas.length))), [capas.length]);
  // Reparto: en orden de armado, una capa para cada agente que se suma (en ronda).
  const dueno = useMemo(() => capas.map((_, i) => i % agentes.length), [capas, agentes.length]);

  useEffect(() => {
    const raiz = refRaiz.current;
    if (!raiz || capas.length === 0) {
      refFundir.current?.();
      refTerminar.current?.();
      return undefined;
    }
    marcarVista();
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

    const tl = gsap.timeline({ onComplete: () => refTerminar.current?.() });
    tl.fromTo(raiz, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power1.out' }, 0);
    tl.fromTo(`.${styles.grilla}`, { opacity: 0 }, { opacity: 1, duration: 0.8, ease: 'power1.out' }, 0);
    tl.fromTo(`.${styles.pildora}`, { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.5, ease: 'expo.out' }, 0.15);

    let fin = 0;
    agentes.forEach((agente, a) => {
      const cursor = refCursores.current[a];
      if (!cursor) return;
      // entra desde un borde, a una altura distinta cada uno
      const desdeIzq = a % 2 === 0;
      let pos = [desdeIzq ? -40 : ancho + 40, alto * (0.15 + ((a * 0.37) % 0.7))];
      gsap.set(cursor, { x: pos[0], y: pos[1], opacity: 0 });
      const t0 = 0.4 + a * 0.13;
      let t = t0;
      tl.to(cursor, { opacity: 1, duration: 0.2 }, t0);
      tl.call(
        () => {
          unidos += 1;
          refAvatares.current[a]?.setAttribute('data-unido', 'true');
          contar();
        },
        null,
        t0
      );
      capas.forEach((capa, i) => {
        if (dueno[i] !== a) return;
        const q = capa.puntos;
        const forma = refFormas.current[i];
        const chip = refChips.current[i];
        const medida = refMedidas.current[i];
        // ir a la esquina donde empieza la caja
        const d = Math.hypot(q[0][0] - pos[0], q[0][1] - pos[1]);
        const ir = Math.min(0.62, Math.max(0.26, d / 1500));
        tl.to(cursor, { x: q[0][0], y: q[0][1], duration: ir, ease: 'power2.inOut' }, t);
        t += ir;
        // arrastrar hasta la esquina opuesta: la caja crece detrás del cursor
        const arrastre = { t: 0 };
        const dur = 0.42 + Math.min(0.25, Math.hypot(q[2][0] - q[0][0], q[2][1] - q[0][1]) / 3000);
        tl.set(forma, { opacity: 1 }, t);
        tl.to(
          arrastre,
          {
            t: 1,
            duration: dur,
            ease: 'power1.inOut',
            onUpdate: () => forma?.setAttribute('points', aPuntos(formaEn(q, arrastre.t))),
          },
          t
        );
        tl.to(cursor, { x: q[2][0], y: q[2][1], duration: dur, ease: 'power1.inOut' }, t);
        t += dur;
        // la firma: quién la hizo y cuánto mide
        tl.fromTo([chip, medida], { opacity: 0, scale: 0.86 }, { opacity: 1, scale: 1, duration: 0.22, ease: 'back.out(2)' }, t);
        tl.call(
          () => {
            hechas += 1;
            contar();
          },
          null,
          t
        );
        t += 0.12;
        pos = q[2];
      });
      // terminado su trabajo, se corre un poco y espera
      tl.to(cursor, { x: `+=${desdeIzq ? -18 : 18}`, y: '+=14', duration: 0.5, ease: 'sine.inOut' }, t);
      fin = Math.max(fin, t);
    });

    // 100%: los cursores se van, el plano se funde y por debajo entra lo real
    fin += 0.3;
    tl.call(() => refEstado.current?.setAttribute('data-listo', 'true'), null, fin);
    tl.call(() => refFundir.current?.(), null, fin + 0.25);
    tl.to(refCursores.current.filter(Boolean), { opacity: 0, scale: 0.6, duration: 0.3, stagger: 0.02, ease: 'power2.in' }, fin);
    tl.to(raiz, { opacity: 0, duration: 0.85, ease: 'power2.inOut' }, fin + 0.35);

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
  }, [capas, agentes, dueno, ancho, alto]);

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
            <i key={agente.nombre} ref={(el) => (refAvatares.current[a] = el)} style={{ '--f': agente.fondo ?? agente.color }} data-unido="false" />
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
