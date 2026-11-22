'use client';

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ANCHO } from '@/lib/pasillo.js';
import styles from './Experiencia.module.css';

const TAM = 168; // px del radar (cuadrado)
const RADIO = 66; // radio del mapa
const ESCALA = 7.5; // px por metro

const hexARgb = (hex) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};

// Radar de juego: la planta cercana gira con la mirada (adelante siempre arriba). Paredes de cada
// pasillo en su color, objetos con tooltip como puntos que laten, la cámara en el centro con su cono
// de visión y, alrededor, un anillo con el avance de todo el recorrido partido por pasillo (tocar un
// tramo lleva a ese pasillo). Se dibuja en 2D cada cuadro con `ref.current.actualizar({ s, camara })`.
const MapaRadar = forwardRef(function MapaRadar({ recorrido, trabajos, actual, alElegir }, ref) {
  const refLienzo = useRef(null);
  const [sobre, setSobre] = useState(null);

  // geometría fija: rectángulos de pasillos y cruces, puntos de objetos y arcos del anillo
  const geo = useMemo(() => {
    const pisos = [];
    recorrido.pasillos.forEach((p, i) => {
      // pasillo: de inicio a fin, ancho ANCHO
      const a = ANCHO / 2;
      const [ix, iz] = p.inicio;
      const [fx, fz] = p.fin;
      pisos.push({
        pasillo: i,
        puntos: [
          [ix + p.der[0] * a, iz + p.der[1] * a],
          [fx + p.der[0] * a, fz + p.der[1] * a],
          [fx - p.der[0] * a, fz - p.der[1] * a],
          [ix - p.der[0] * a, iz - p.der[1] * a],
        ],
      });
      if (p.cruce) {
        const [cx, cz] = p.cruce;
        pisos.push({
          pasillo: i,
          puntos: [
            [cx + (p.der[0] + p.dir[0]) * a, cz + (p.der[1] + p.dir[1]) * a],
            [cx + (p.der[0] - p.dir[0]) * a, cz + (p.der[1] - p.dir[1]) * a],
            [cx + (-p.der[0] - p.dir[0]) * a, cz + (-p.der[1] - p.dir[1]) * a],
            [cx + (-p.der[0] + p.dir[0]) * a, cz + (-p.der[1] + p.dir[1]) * a],
          ],
        });
      }
    });
    const objetos = recorrido.pasillos.flatMap((p, i) =>
      p.objetos.map((o) => ({ pasillo: i, x: o.x - p.der[0] * o.lado * 0.5, z: o.z - p.der[1] * o.lado * 0.5 })),
    );
    // anillo: un arco por pasillo, proporcional a su largo en el camino
    const hueco = 0.05;
    const arcos = recorrido.pasillos.map((_, i) => {
      const desde = recorrido.comienzos[i] / recorrido.largo;
      const hasta = (recorrido.comienzos[i + 1] ?? recorrido.largo) / recorrido.largo;
      return { i, a0: -Math.PI / 2 + desde * Math.PI * 2 + hueco / 2, a1: -Math.PI / 2 + hasta * Math.PI * 2 - hueco / 2, desde, hasta };
    });
    return { pisos, objetos, arcos };
  }, [recorrido]);

  const estado = useRef({ s: 0, camara: null });
  useImperativeHandle(ref, () => ({
    actualizar({ s, camara }) {
      estado.current.s = s;
      if (camara) estado.current.camara = camara;
    },
  }));

  useEffect(() => {
    const lienzo = refLienzo.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    lienzo.width = TAM * dpr;
    lienzo.height = TAM * dpr;
    const ctx = lienzo.getContext('2d');
    const colores = trabajos.map((t) => hexARgb(t.acento));
    let cuadro = 0;
    const dibujar = (ahora) => {
      cuadro = requestAnimationFrame(dibujar);
      const { s, camara } = estado.current;
      const t = ahora / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, TAM, TAM);
      const c = TAM / 2;
      // fondo: disco de vidrio oscuro con retícula
      ctx.save();
      ctx.beginPath();
      ctx.arc(c, c, RADIO, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(10,12,17,0.62)';
      ctx.fill();
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      for (const r of [RADIO * 0.33, RADIO * 0.66]) {
        ctx.beginPath();
        ctx.arc(c, c, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (camara) {
        const rumbo = Math.atan2(camara.dx, -camara.dz);
        ctx.save();
        ctx.translate(c, c);
        ctx.rotate(-rumbo);
        ctx.scale(ESCALA, ESCALA);
        ctx.translate(-camara.x, -camara.z);
        // pisos de los pasillos
        for (const piso of geo.pisos) {
          const rgb = colores[piso.pasillo];
          ctx.beginPath();
          piso.puntos.forEach(([x, z], k) => (k ? ctx.lineTo(x, z) : ctx.moveTo(x, z)));
          ctx.closePath();
          ctx.fillStyle = `rgba(${rgb},${piso.pasillo === actual ? 0.2 : 0.09})`;
          ctx.fill();
          ctx.strokeStyle = `rgba(${rgb},${piso.pasillo === actual ? 0.95 : 0.45})`;
          ctx.lineWidth = 1.4 / ESCALA;
          ctx.stroke();
        }
        // objetos con tooltip
        for (const o of geo.objetos) {
          const rgb = colores[o.pasillo];
          const pulso = 0.5 + 0.5 * Math.sin(t * 3 + o.x);
          ctx.beginPath();
          ctx.arc(o.x, o.z, (2.2 + pulso * 1.6) / ESCALA, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${rgb},${0.25 * pulso})`;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(o.x, o.z, 1.8 / ESCALA, 0, Math.PI * 2);
          ctx.fillStyle = `rgb(${rgb})`;
          ctx.fill();
        }
        ctx.restore();
      }
      // barrido de radar
      const barrido = (t * 0.9) % (Math.PI * 2);
      const grad = ctx.createConicGradient ? ctx.createConicGradient(barrido - Math.PI / 2, c, c) : null;
      if (grad) {
        grad.addColorStop(0, 'rgba(255,255,255,0.10)');
        grad.addColorStop(0.12, 'rgba(255,255,255,0)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, TAM, TAM);
      }
      // la cámara: cono de visión y flecha (adelante = arriba)
      const cono = ctx.createRadialGradient(c, c, 0, c, c, RADIO * 0.7);
      cono.addColorStop(0, 'rgba(255,255,255,0.32)');
      cono.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = cono;
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.arc(c, c, RADIO * 0.7, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(c, c - 7);
      ctx.lineTo(c + 5, c + 5);
      ctx.lineTo(c, c + 2.5);
      ctx.lineTo(c - 5, c + 5);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 4;
      ctx.fill();
      ctx.shadowBlur = 0;
      // anillo de avance por pasillo
      const u = s / recorrido.largo;
      for (const arco of geo.arcos) {
        const rgb = colores[arco.i];
        ctx.lineCap = 'round';
        ctx.lineWidth = arco.i === sobre ? 6 : 4;
        ctx.strokeStyle = `rgba(${rgb},0.22)`;
        ctx.beginPath();
        ctx.arc(c, c, RADIO + 9, arco.a0, arco.a1);
        ctx.stroke();
        const lleno = Math.min(1, Math.max(0, (u - arco.desde) / (arco.hasta - arco.desde)));
        if (lleno > 0) {
          ctx.strokeStyle = `rgb(${rgb})`;
          ctx.beginPath();
          ctx.arc(c, c, RADIO + 9, arco.a0, arco.a0 + (arco.a1 - arco.a0) * lleno);
          ctx.stroke();
        }
      }
      // marca del punto actual en el anillo
      const a = -Math.PI / 2 + u * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(c + Math.cos(a) * (RADIO + 9), c + Math.sin(a) * (RADIO + 9), 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    };
    cuadro = requestAnimationFrame(dibujar);
    return () => cancelAnimationFrame(cuadro);
  }, [geo, recorrido, trabajos, actual, sobre]);

  // tocar el anillo: el pasillo de ese arco
  const arcoEn = (e) => {
    const r = refLienzo.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * TAM - TAM / 2;
    const y = ((e.clientY - r.top) / r.height) * TAM - TAM / 2;
    const d = Math.hypot(x, y);
    if (d < RADIO + 2 || d > RADIO + 17) return null;
    let a = Math.atan2(y, x);
    if (a < -Math.PI / 2) a += Math.PI * 2;
    return geo.arcos.find((arco) => a >= arco.a0 - 0.03 && a <= arco.a1 + 0.03)?.i ?? null;
  };

  const mostrado = trabajos[sobre ?? actual];
  return (
    <nav className={styles.radar} aria-label="Mapa del recorrido" style={{ '--acento': mostrado.acento }}>
      <canvas
        ref={refLienzo}
        className={styles.radarLienzo}
        style={{ width: TAM, height: TAM, cursor: sobre !== null ? 'pointer' : 'default' }}
        onPointerMove={(e) => setSobre(arcoEn(e))}
        onPointerLeave={() => setSobre(null)}
        onClick={(e) => {
          const i = arcoEn(e);
          if (i !== null) alElegir(i);
        }}
        role="img"
        aria-label="Radar del recorrido; tocá un tramo del anillo para ir a ese pasillo"
      />
      <div className={styles.radarTexto} aria-live="polite">
        <span className={styles.radarNumero}>
          {String((sobre ?? actual) + 1).padStart(2, '0')}
          <small>/{String(trabajos.length).padStart(2, '0')}</small>
        </span>
        <span className={styles.radarPeriodo}>{mostrado.periodo}</span>
        <span className={styles.radarPuesto}>{mostrado.puesto}</span>
      </div>
      <ol className={styles.soloLectoresLista}>
        {trabajos.map((t, i) => (
          <li key={t.id}>
            <button type="button" onClick={() => alElegir(i)}>
              {t.periodo} · {t.puesto}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
});

export default MapaRadar;
