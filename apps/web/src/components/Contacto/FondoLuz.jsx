'use client';

// Velo de luz del fondo del contacto: un canvas de baja resolución calculado
// píxel a píxel y escalado con desenfoque. La estela del avión lo arremolina
// como tinta en agua (agitar) y deja un trazo visible (estela).
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import styles from './Contacto.module.css';

const ANCHO_BAJA = 150;
const BASE = [247, 248, 250];
const MANCHAS = [
  { color: [238, 243, 252], fuerza: 0.45 },
  { color: [222, 235, 255], fuerza: 0.4 },
  { color: [242, 244, 248], fuerza: 0.3 },
  { color: [226, 239, 255], fuerza: 0.3 }, // sigue al cursor
];

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
      if (Math.random() < 0.5) remolinos.current.push({ x: (x - r.left) / r.width, y: (y - r.top) / r.height, edad: 0, f: 0.5 });
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

    function medir() {
      const r = luz.getBoundingClientRect();
      alto = Math.max(60, Math.round((ANCHO_BAJA * r.height) / Math.max(1, r.width)));
      luz.width = ANCHO_BAJA;
      luz.height = alto;
      imagen = ctx.createImageData(ANCHO_BAJA, alto);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      estela.width = window.innerWidth * dpr;
      estela.height = window.innerHeight * dpr;
      ectx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function pintarLuz(t) {
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
      for (let y = 0; y < alto; y++) {
        for (let x = 0; x < ANCHO_BAJA; x++) {
          let u = x / ANCHO_BAJA;
          let v = y / ANCHO_BAJA;
          for (let i = 0; i < rr.length; i++) {
            const q = rr[i];
            const dx = u - q.x;
            const dy = v - q.y * asp;
            const f = q.f * (1 - q.edad) * Math.exp(-(dx * dx + dy * dy) / 0.006);
            u += -dy * f * 2.4 + dx * f * 0.5;
            v += dx * f * 2.4 + dy * f * 0.5;
          }
          let r = BASE[0];
          let g = BASE[1];
          let b = BASE[2];
          for (let i = 0; i < MANCHAS.length; i++) {
            const c = centros[i];
            const dx = u - c[0];
            const dy = v - c[1];
            const a = MANCHAS[i].fuerza * Math.exp(-(dx * dx + dy * dy) / (c[2] * c[2]));
            const col = MANCHAS[i].color;
            r += (col[0] - r) * a;
            g += (col[1] - g) * a;
            b += (col[2] - b) * a;
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
        rr[i].edad += 0.011;
        if (rr[i].edad >= 1) rr.splice(i, 1);
      }
    }

    function pintarEstela() {
      const puntos = trazo.current;
      ectx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (let i = puntos.length - 1; i >= 0; i--) {
        puntos[i].e += 0.016;
        if (puntos[i].e >= 1) puntos.splice(i, 1);
      }
      ectx.lineCap = 'round';
      for (let i = 1; i < puntos.length; i++) {
        const vida = 1 - puntos[i].e;
        ectx.strokeStyle = `rgba(31, 107, 255, ${vida * 0.45})`;
        ectx.lineWidth = 0.8 + vida * 2;
        ectx.beginPath();
        ectx.moveTo(puntos[i - 1].x, puntos[i - 1].y);
        ectx.lineTo(puntos[i].x, puntos[i].y);
        ectx.stroke();
      }
    }

    let cuadro = 0;
    function bucle(t) {
      if (visible) pintarLuz(t);
      if (trazo.current.length || visible) pintarEstela();
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
    medir();
    window.addEventListener('resize', medir);
    window.addEventListener('pointermove', alMover, { passive: true });
    cuadro = requestAnimationFrame(bucle);
    return () => {
      cancelAnimationFrame(cuadro);
      observador.disconnect();
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
