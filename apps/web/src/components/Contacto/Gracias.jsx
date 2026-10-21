'use client';

// Vista intermedia que aparece tras enviar un mensaje: agradece, y recién cuando la persona vuelve
// a la página (o pasa un rato) pregunta si quiere enviar otro y la devuelve a la vista de contacto.
// Todo es luz: un anillo que se dibuja, un tilde trazado, ondas, chispas en forma de estelas y el
// "Gracias." que aparece letra por letra.
import { useEffect, useRef } from 'react';
import styles from './Gracias.module.css';

const LETRAS = [...'Gracias'];
const COLORES = [
  [255, 255, 255],
  [56, 198, 255],
  [77, 141, 255],
];

// Chispas: salen del tilde en todas direcciones, frenan y se desvanecen subiendo un poco.
function iniciarChispas(lienzo) {
  const ctx = lienzo.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  let ancho = 0;
  let alto = 0;
  function medir() {
    const r = lienzo.getBoundingClientRect();
    ancho = r.width;
    alto = r.height;
    lienzo.width = Math.round(ancho * dpr);
    lienzo.height = Math.round(alto * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  medir();
  const cx = ancho * 0.5;
  const cy = Math.min(alto * 0.36, 230);
  const chispas = Array.from({ length: 70 }, (_, i) => {
    const angulo = Math.random() * Math.PI * 2;
    const velocidad = 120 + Math.random() * 520;
    return {
      x: cx,
      y: cy,
      vx: Math.cos(angulo) * velocidad,
      vy: Math.sin(angulo) * velocidad,
      vida: 0,
      duracion: 1.4 + Math.random() * 1.8,
      retraso: 0.75 + (i / 70) * 0.35,
      color: COLORES[i % COLORES.length],
      ancho: 1 + Math.random() * 1.6,
    };
  });
  let anterior = performance.now();
  const inicio = anterior;
  let cuadro = 0;
  function bucle(ahora) {
    const dt = Math.min(0.05, (ahora - anterior) / 1000);
    anterior = ahora;
    const t = (ahora - inicio) / 1000;
    ctx.clearRect(0, 0, ancho, alto);
    ctx.lineCap = 'round';
    let vivas = 0;
    for (const c of chispas) {
      if (t < c.retraso) {
        vivas += 1;
        continue;
      }
      c.vida += dt / c.duracion;
      if (c.vida >= 1) continue;
      vivas += 1;
      const freno = Math.exp(-dt * 2.6);
      c.vx *= freno;
      c.vy = c.vy * freno - dt * 26;
      const x0 = c.x;
      const y0 = c.y;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      const alfa = (1 - c.vida) ** 1.6;
      // estela corta en la dirección del movimiento (sin puntos sueltos)
      ctx.strokeStyle = `rgba(${c.color[0]}, ${c.color[1]}, ${c.color[2]}, ${alfa})`;
      ctx.lineWidth = c.ancho * (0.5 + alfa);
      ctx.beginPath();
      ctx.moveTo(x0 - c.vx * 0.05, y0 - c.vy * 0.05);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
    }
    if (vivas > 0) cuadro = requestAnimationFrame(bucle);
  }
  cuadro = requestAnimationFrame(bucle);
  return () => cancelAnimationFrame(cuadro);
}

export default function Gracias({ canal, hora, estado, pregunta, alOtro }) {
  const refChispas = useRef(null);
  const refDialogo = useRef(null);

  useEffect(() => {
    refDialogo.current?.focus({ preventScroll: true });
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !refChispas.current) return undefined;
    return iniciarChispas(refChispas.current);
  }, []);

  useEffect(() => {
    function alTeclear(evento) {
      if (evento.key === 'Escape' && pregunta) alOtro();
    }
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [pregunta, alOtro]);

  const porWhatsApp = canal === 'wa';
  return (
    <div
      ref={refDialogo}
      className={`${styles.gracias} ${pregunta ? styles.pregunta : ''}`}
      role="dialog"
      aria-label="Mensaje enviado"
      tabIndex={-1}
    >
      <canvas ref={refChispas} className={styles.chispas} aria-hidden="true" />

      <div className={styles.sello} aria-hidden="true">
        <span className={styles.onda} />
        <span className={`${styles.onda} ${styles.onda2}`} />
        <span className={`${styles.onda} ${styles.onda3}`} />
        <svg viewBox="0 0 120 120" className={styles.icono}>
          <circle className={styles.halo} cx="60" cy="60" r="54" />
          {/* largos explícitos (en vez de pathLength): los navegadores del celular lo resuelven mejor */}
          <circle className={styles.anillo} cx="60" cy="60" r="54" style={{ '--largo': 341 }} />
          {porWhatsApp ? (
            <>
              <path className={styles.tilde} d="M34 62l15 15L74 44" style={{ '--largo': 64 }} />
              <path className={`${styles.tilde} ${styles.tilde2}`} d="M58 72l6 6L90 44" style={{ '--largo': 53 }} />
            </>
          ) : (
            <path className={styles.tilde} d="M36 62l17 17L86 42" style={{ '--largo': 75 }} />
          )}
        </svg>
      </div>

      <h3 className={styles.titulo} aria-label="Gracias.">
        {LETRAS.map((letra, i) => (
          <span key={i} className={styles.letra} style={{ '--i': i }} aria-hidden="true">
            {letra}
          </span>
        ))}
        <span className={`${styles.letra} ${styles.punto}`} style={{ '--i': LETRAS.length }} aria-hidden="true">
          .
        </span>
      </h3>

      <p className={styles.detalle}>
        Tu mensaje ya está en camino {porWhatsApp ? 'por WhatsApp' : 'a mi correo'}.
        {estado ? ` ${estado}.` : ''}
      </p>
      <p className={styles.ticket}>
        <span>{porWhatsApp ? 'WHATSAPP' : 'EMAIL'}</span>
        <span aria-hidden="true">·</span>
        <span>ENVIADO {hora}</span>
        <span aria-hidden="true">·</span>
        <span>GRACIAS POR ESCRIBIR</span>
      </p>

      <div className={styles.cambio} aria-live="polite">
        <p className={styles.espera}>
          Cuando termines de escribirme, volvé acá
          <i aria-hidden="true" />
          <i aria-hidden="true" />
          <i aria-hidden="true" />
        </p>
        <div className={styles.otro}>
          <p>¡Volviste! ¿Querés enviarme otro mensaje?</p>
          <button type="button" className={styles.boton} onClick={alOtro} tabIndex={pregunta ? 0 : -1}>
            Sí, enviar otro
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
