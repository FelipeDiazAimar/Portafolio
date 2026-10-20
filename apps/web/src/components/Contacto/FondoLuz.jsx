'use client';

// Velo de luz del fondo del contacto: un canvas de baja resolución calculado
// píxel a píxel y escalado con desenfoque. La estela del avión lo arremolina
// como tinta en agua (agitar) y deja un trazo visible (estela). Sigue el tema:
// velo celeste sobre blanco en claro, azul profundo sobre casi negro en oscuro.
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { observarTema, temaActual } from '@/lib/contacto/tema.js';
import styles from './Contacto.module.css';

const ANCHO_BAJA = 150;
const MAX_REMOLINOS = 36;
// Más allá de este radio² un remolino ya no mueve nada (exp(-5) ≈ 0,7 %): se salta el cálculo.
const CORTE_REMOLINO = 0.03;

const PALETAS = {
  light: {
    base: [247, 248, 250],
    manchas: [
      { color: [238, 243, 252], fuerza: 0.45 },
      { color: [222, 235, 255], fuerza: 0.4 },
      { color: [242, 244, 248], fuerza: 0.3 },
      { color: [226, 239, 255], fuerza: 0.3 }, // sigue al cursor
    ],
    estela: '31, 107, 255',
  },
  dark: {
    base: [11, 13, 18],
    manchas: [
      { color: [26, 54, 120], fuerza: 0.42 },
      { color: [16, 70, 168], fuerza: 0.3 },
      { color: [14, 26, 60], fuerza: 0.4 },
      { color: [30, 64, 140], fuerza: 0.28 }, // sigue al cursor
    ],
    estela: '130, 185, 255',
  },
};

const FondoLuz = forwardRef(function FondoLuz(_, ref) {
  const refLuz = useRef(null);
  const refEstela = useRef(null);
  const remolinos = useRef([]);
  const trazo = useRef([]);

  useImperativeHandle(ref, () => ({
    // x, y en píxeles de la ventana
    agitar(x, y) {
      const luz = refLuz.current;
      if (!luz) return;
      const r = luz.getBoundingClientRect();
      trazo.current.push({ x, y, e: 0 });
      remolinos.current.push({ x: (x - r.left) / r.width, y: (y - r.top) / r.height, edad: 0, f: 0.55 });
      if (remolinos.current.length > MAX_REMOLINOS) remolinos.current.shift();
    },
  }));

  useEffect(() => {
    const luz = refLuz.current;
    const estela = refEstela.current;
    const ctx = luz.getContext('2d');
    const ectx = estela.getContext('2d');
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let alto = 90;
    let imagen;
    const raton = { x: 0.5, y: 0.5, sx: 0.5, sy: 0.5 };
    let visible = false;
    let objetivo = PALETAS[temaActual()];
    // La paleta actual se acerca de a poco a la del tema: el cambio no es un corte.
    const paleta = {
      base: [...objetivo.base],
      manchas: objetivo.manchas.map((m) => ({ color: [...m.color], fuerza: m.fuerza })),
    };

    function medir() {
      const r = luz.getBoundingClientRect();
      alto = Math.max(60, Math.round((ANCHO_BAJA * r.height) / Math.max(1, r.width)));
      luz.width = ANCHO_BAJA;
      luz.height = alto;
      imagen = ctx.createImageData(ANCHO_BAJA, alto);
      // la estela es una línea fina: no necesita resolución de pantalla retina
      estela.width = window.innerWidth;
      estela.height = window.innerHeight;
    }

    // El acercamiento depende del tiempo y no de los cuadros: en un equipo lento la
    // transición dura lo mismo (≈ 0,7 s) en vez de arrastrarse durante varios segundos.
    function acercarPaleta(dt) {
      const k = 1 - Math.exp(-dt * 6);
      for (let c = 0; c < 3; c++) paleta.base[c] += (objetivo.base[c] - paleta.base[c]) * k;
      paleta.manchas.forEach((m, i) => {
        for (let c = 0; c < 3; c++) m.color[c] += (objetivo.manchas[i].color[c] - m.color[c]) * k;
        m.fuerza += (objetivo.manchas[i].fuerza - m.fuerza) * k;
      });
    }

    let tAnterior = 0;
    function pintarLuz(t) {
      acercarPaleta(Math.min(0.5, (t - (tAnterior || t)) / 1000));
      tAnterior = t;
      raton.sx += (raton.x - raton.sx) * 0.04;
      raton.sy += (raton.y - raton.sy) * 0.04;
      const asp = alto / ANCHO_BAJA;
      const s = reducido ? 0 : t * 0.00012;
      const centros = [
        [0.66 + Math.sin(s * 3.1) * 0.07, -0.04 * asp + Math.cos(s * 2.3) * 0.05, 0.42],
        [0.9 + Math.cos(s * 2.6) * 0.06, asp * 1.02 + Math.sin(s * 3.4) * 0.05, 0.38],
        [0.06 + Math.sin(s * 1.9) * 0.05, asp * 0.96 + Math.cos(s * 2.2) * 0.04, 0.32],
        [raton.sx, raton.sy * asp, 0.17],
      ];
      const d = imagen.data;
      const rr = remolinos.current;
      const [b0, b1, b2] = paleta.base;
      for (let y = 0; y < alto; y++) {
        for (let x = 0; x < ANCHO_BAJA; x++) {
          let u = x / ANCHO_BAJA;
          let v = y / ANCHO_BAJA;
          for (let i = 0; i < rr.length; i++) {
            const q = rr[i];
            const dx = u - q.x;
            const dy = v - q.y * asp;
            const r2 = dx * dx + dy * dy;
            if (r2 > CORTE_REMOLINO) continue;
            const f = q.f * (1 - q.edad) * Math.exp(-r2 / 0.006);
            u += -dy * f * 2.4 + dx * f * 0.5;
            v += dx * f * 2.4 + dy * f * 0.5;
          }
          let r = b0;
          let g = b1;
          let b = b2;
          for (let i = 0; i < 4; i++) {
            const c = centros[i];
            const dx = u - c[0];
            const dy = v - c[1];
            const m = paleta.manchas[i];
            const a = m.fuerza * Math.exp(-(dx * dx + dy * dy) / (c[2] * c[2]));
            r += (m.color[0] - r) * a;
            g += (m.color[1] - g) * a;
            b += (m.color[2] - b) * a;
          }
          const p = (y * ANCHO_BAJA + x) * 4;
          d[p] = r;
          d[p + 1] = g;
          d[p + 2] = b;
          d[p + 3] = 255;
        }
      }
      ctx.putImageData(imagen, 0, 0);
      for (let i = rr.length - 1; i >= 0; i--) {
        rr[i].edad += 0.012;
        if (rr[i].edad >= 1) rr.splice(i, 1);
      }
    }

    function pintarEstela() {
      const puntos = trazo.current;
      ectx.clearRect(0, 0, estela.width, estela.height);
      for (let i = puntos.length - 1; i >= 0; i--) {
        puntos[i].e += 0.016;
        if (puntos[i].e >= 1) puntos.splice(i, 1);
      }
      ectx.lineCap = 'round';
      for (let i = 1; i < puntos.length; i++) {
        const vida = 1 - puntos[i].e;
        ectx.strokeStyle = `rgba(${objetivo.estela}, ${vida * 0.5})`;
        ectx.lineWidth = 0.8 + vida * 2.2;
        ectx.beginPath();
        ectx.moveTo(puntos[i - 1].x, puntos[i - 1].y);
        ectx.lineTo(puntos[i].x, puntos[i].y);
        ectx.stroke();
      }
    }

    let cuadro = 0;
    let n = 0;
    let habiaEstela = false;
    function bucle(t) {
      n += 1;
      // En reposo la luz casi no cambia: se redibuja a la mitad de frecuencia. Con un
      // vuelo en curso (remolinos) se redibuja siempre para que el arrastre sea fluido.
      if (visible && (remolinos.current.length || n % 2 === 0)) pintarLuz(t);
      if (trazo.current.length) {
        pintarEstela();
        habiaEstela = true;
      } else if (habiaEstela) {
        ectx.clearRect(0, 0, estela.width, estela.height);
        habiaEstela = false;
      }
      cuadro = requestAnimationFrame(bucle);
    }
    function alMover(e) {
      const r = luz.getBoundingClientRect();
      raton.x = (e.clientX - r.left) / r.width;
      raton.y = (e.clientY - r.top) / r.height;
    }
    const observador = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    observador.observe(luz);
    const dejarDeObservarTema = observarTema(() => {
      objetivo = PALETAS[temaActual()];
    });
    medir();
    window.addEventListener('resize', medir);
    window.addEventListener('pointermove', alMover, { passive: true });
    cuadro = requestAnimationFrame(bucle);
    return () => {
      cancelAnimationFrame(cuadro);
      observador.disconnect();
      dejarDeObservarTema();
      window.removeEventListener('resize', medir);
      window.removeEventListener('pointermove', alMover);
    };
  }, []);

  return (
    <>
      <canvas ref={refLuz} className={styles.luz} aria-hidden="true" />
      <canvas ref={refEstela} className={styles.estela} aria-hidden="true" />
    </>
  );
});

export default FondoLuz;
