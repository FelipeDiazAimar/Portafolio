'use client';

// Slide de vidrio que escribe el mensaje. La manija es una tecla de vidrio:
// - WhatsApp: el logo pasa a "escribiendo…" mientras se arrastra y a ✓✓ al final.
// - Email: una hoja que se pliega en avioncito al ritmo del arrastre.
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { SiWhatsapp } from 'react-icons/si';
import styles from './SlideDestino.module.css';

const COMPLETA_EN = 0.98;
const MANIJA = 56;
const MARGEN = 5;

// Hoja (tres triángulos que cubren el rectángulo) → avión (las mismas tres caras).
const HOJA = [
  [[24, 18], [76, 18], [24, 60]],
  [[24, 60], [76, 18], [76, 82]],
  [[24, 60], [76, 82], [24, 82]],
];
export const AVION = [
  [[6, 22], [96, 50], [36, 58]],
  [[36, 58], [96, 50], [30, 86]],
  [[36, 58], [30, 86], [26, 64]],
];
const TONOS = [
  ['#ffffff', '#ffffff'],
  ['#eef2fb', '#c9d3e6'],
  ['#e4eaf6', '#7d889c'],
];
const curvaSuave = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const mezclar = (a, b, t) => a + (b - a) * t;
function mezclarColor(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const c = (k) => Math.round(mezclar((pa >> k) & 255, (pb >> k) & 255, t));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}

const SlideDestino = forwardRef(function SlideDestino(
  { destino, etiqueta, apagada, bloqueada, alEmpezar, alProgreso, alCompletar, alVolver },
  ref
) {
  const refPista = useRef(null);
  const refManija = useRef(null);
  const refIcono = useRef(null);
  const refCaras = useRef([]);
  const refHoja = useRef(null);
  const estado = useRef({ p: 0, arrastrando: false, resorte: false, vResorte: 0, silencioso: false, vel: 0 });
  const refBloqueada = useRef(bloqueada);
  refBloqueada.current = bloqueada;
  const callbacks = useRef({});
  callbacks.current = { alEmpezar, alProgreso, alCompletar, alVolver };

  function pintar(p, vel = 0) {
    const pista = refPista.current;
    const manija = refManija.current;
    if (!pista || !manija) return;
    pista.style.setProperty('--p', p.toFixed(4));
    manija.setAttribute('aria-valuenow', String(Math.round(p * 100)));
    // se estira con la velocidad y se inclina hacia donde va
    const estirar = 1 + Math.min(0.22, Math.abs(vel) * 0.06);
    const inclinar = Math.max(-14, Math.min(14, vel * 4));
    manija.style.setProperty('--estirar', estirar.toFixed(3));
    manija.style.setProperty('--inclinar', `${inclinar.toFixed(1)}deg`);
    if (destino === 'mail') {
      refCaras.current.forEach((cara, i) => {
        if (!cara) return;
        const t = curvaSuave(Math.min(1, Math.max(0, (p - i * 0.12) / 0.76)));
        cara.setAttribute('points', HOJA[i].map((v, k) => `${mezclar(v[0], AVION[i][k][0], t)},${mezclar(v[1], AVION[i][k][1], t)}`).join(' '));
        cara.setAttribute('fill', mezclarColor(TONOS[i][0], TONOS[i][1], t));
      });
      refHoja.current?.setAttribute('opacity', Math.max(0, 1 - p * 2.6).toFixed(3));
    }
  }

  function fijar(p, vel = 0) {
    const e = estado.current;
    e.p = p;
    pintar(p, vel);
    if (!e.silencioso) callbacks.current.alProgreso?.(p);
  }

  useImperativeHandle(ref, () => ({
    // vuelve a 0 sin rebobinar el texto (al pedir "otro mensaje")
    reiniciar() {
      const e = estado.current;
      e.silencioso = true;
      e.resorte = e.p > 0;
      refPista.current?.setAttribute('data-estado', 'reposo');
      if (!e.resorte) e.silencioso = false;
    },
    rectIcono: () => refIcono.current?.getBoundingClientRect(),
    // en un slide completado, el ícono se va (el avión despega desde acá)
    ocultarIcono: (ocultar) => refPista.current?.setAttribute('data-icono', ocultar ? 'fuera' : 'dentro'),
    completarConTeclado: () => completar(0),
  }));

  function completar(vel) {
    const e = estado.current;
    e.arrastrando = false;
    fijar(1);
    refPista.current?.setAttribute('data-estado', 'listo');
    navigator.vibrate?.([10, 40, 18]);
    callbacks.current.alCompletar?.(vel);
  }

  useEffect(() => {
    const manija = refManija.current;
    const pista = refPista.current;
    let x0 = 0;
    let p0 = 0;
    let ultimoX = 0;
    let ultimoT = 0;
    const rango = () => pista.clientWidth - MANIJA - MARGEN * 2;

    function alBajar(evento) {
      if (refBloqueada.current) return;
      const e = estado.current;
      e.resorte = false;
      e.arrastrando = true;
      e.silencioso = false;
      manija.setPointerCapture(evento.pointerId);
      x0 = evento.clientX;
      p0 = e.p;
      ultimoX = evento.clientX;
      ultimoT = performance.now();
      e.vel = 0;
      pista.setAttribute('data-estado', 'escribiendo');
      callbacks.current.alEmpezar?.();
    }
    function alMover(evento) {
      const e = estado.current;
      if (!e.arrastrando || !manija.hasPointerCapture(evento.pointerId)) return;
      const ahora = performance.now();
      const dx = evento.clientX - ultimoX;
      e.vel = mezclar(e.vel, dx / Math.max(1, ahora - ultimoT), 0.5);
      ultimoX = evento.clientX;
      ultimoT = ahora;
      fijar(Math.min(1, Math.max(0, p0 + (evento.clientX - x0) / rango())), e.vel);
    }
    function alSoltar() {
      const e = estado.current;
      if (!e.arrastrando) return;
      e.arrastrando = false;
      if (e.p >= COMPLETA_EN) completar(e.vel);
      else {
        e.resorte = true;
        pista.setAttribute('data-estado', 'reposo');
        callbacks.current.alVolver?.();
      }
    }
    function alTeclear(evento) {
      if (refBloqueada.current) return;
      const e = estado.current;
      let p = e.p;
      if (evento.key === 'ArrowRight' || evento.key === 'ArrowUp') p += 0.04;
      else if (evento.key === 'ArrowLeft' || evento.key === 'ArrowDown') p -= 0.04;
      else if (evento.key === 'Home') p = 0;
      else if (evento.key === 'End' || evento.key === 'Enter' || evento.key === ' ') {
        evento.preventDefault();
        callbacks.current.alEmpezar?.();
        completar(0);
        return;
      } else return;
      evento.preventDefault();
      e.silencioso = false;
      callbacks.current.alEmpezar?.();
      fijar(Math.min(1, Math.max(0, p)));
    }

    // Resorte de retorno: el texto se rebobina solo porque deriva del progreso.
    let cuadro = 0;
    let anterior = performance.now();
    function bucle(ahora) {
      const dt = Math.min(0.033, (ahora - anterior) / 1000);
      anterior = ahora;
      const e = estado.current;
      if (e.resorte) {
        e.vResorte += (-170 * e.p - 20 * e.vResorte) * dt;
        let p = e.p + e.vResorte * dt;
        if (p < 0) {
          p = 0;
          e.vResorte *= -0.3;
        }
        fijar(p, e.vResorte * 0.05);
        if (p < 0.002 && Math.abs(e.vResorte) < 0.02) {
          e.resorte = false;
          e.vResorte = 0;
          fijar(0);
          e.silencioso = false;
        }
      } else if (!e.arrastrando) {
        // la tecla recupera su forma con suavidad
        e.vel *= 0.85;
        pintar(e.p, e.vel);
      }
      cuadro = requestAnimationFrame(bucle);
    }

    // el recorrido de la manija en CSS depende del ancho de la pista
    const observadorAncho = new ResizeObserver(() => pista.style.setProperty('--ancho', `${pista.clientWidth}px`));
    observadorAncho.observe(pista);
    manija.addEventListener('pointerdown', alBajar);
    manija.addEventListener('pointermove', alMover);
    manija.addEventListener('pointerup', alSoltar);
    manija.addEventListener('pointercancel', alSoltar);
    manija.addEventListener('keydown', alTeclear);
    pintar(0);
    cuadro = requestAnimationFrame(bucle);
    return () => {
      cancelAnimationFrame(cuadro);
      observadorAncho.disconnect();
      manija.removeEventListener('pointerdown', alBajar);
      manija.removeEventListener('pointermove', alMover);
      manija.removeEventListener('pointerup', alSoltar);
      manija.removeEventListener('pointercancel', alSoltar);
      manija.removeEventListener('keydown', alTeclear);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- los callbacks se leen por ref
  }, []);

  // Brillo especular del vidrio que sigue al cursor.
  useEffect(() => {
    const pista = refPista.current;
    function alMoverCursor(evento) {
      const r = pista.getBoundingClientRect();
      const dx = Math.max(r.left - evento.clientX, 0, evento.clientX - r.right);
      const dy = Math.max(r.top - evento.clientY, 0, evento.clientY - r.bottom);
      pista.style.setProperty('--sx', `${evento.clientX - r.left}px`);
      pista.style.setProperty('--sy', `${evento.clientY - r.top}px`);
      pista.style.setProperty('--si', Math.max(0, 1 - Math.hypot(dx, dy) / 260).toFixed(3));
    }
    window.addEventListener('pointermove', alMoverCursor, { passive: true });
    return () => window.removeEventListener('pointermove', alMoverCursor);
  }, []);

  return (
    <div
      ref={refPista}
      className={`${styles.pista} ${apagada ? styles.apagada : ''}`}
      data-destino={destino}
      data-estado="reposo"
      data-icono="dentro"
    >
      <div className={styles.relleno} aria-hidden="true" />
      <div className={styles.etiqueta} aria-hidden="true">
        Deslizá · {etiqueta}
      </div>
      <div
        ref={refManija}
        className={styles.manija}
        role="slider"
        tabIndex={0}
        aria-label={`Deslizá para escribir y enviar por ${etiqueta}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={0}
      >
        <span className={styles.anillo} aria-hidden="true" />
        <span className={styles.tecla} aria-hidden="true">
          {destino === 'wa' ? (
            <span ref={refIcono} className={styles.iconoWa}>
              <SiWhatsapp className={styles.logo} />
              <span className={styles.escribiendo}>
                <i />
                <i />
                <i />
              </span>
              <svg className={styles.ticks} viewBox="0 0 18 12" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 6.5l3 3L10 2" />
                <path d="M6.5 9.5L7.5 10.5 15 2" />
              </svg>
            </span>
          ) : (
            <svg ref={refIcono} className={styles.iconoMail} viewBox="0 0 100 100">
              {HOJA.map((cara, i) => (
                <polygon
                  key={i}
                  ref={(nodo) => {
                    refCaras.current[i] = nodo;
                  }}
                  points={cara.map((v) => v.join(',')).join(' ')}
                  fill={TONOS[i][0]}
                />
              ))}
              {/* contorno y renglones de la hoja: se desvanecen mientras se pliega */}
              <g ref={refHoja} fill="none" stroke="#1f6bff" strokeWidth="3" strokeLinecap="round">
                <rect x="24" y="18" width="52" height="64" rx="5" />
                <path d="M34 36h32M34 48h32M34 60h20" strokeWidth="3.5" opacity=".55" />
              </g>
            </svg>
          )}
        </span>
      </div>
    </div>
  );
});

export default SlideDestino;
