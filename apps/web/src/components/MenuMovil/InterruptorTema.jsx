'use client';

import { useRef, useState } from 'react';
import styles from './InterruptorTema.module.css';

// Recorrido de la perilla (px) = ancho de pista - ancho de perilla - 2 * margen.
const RECORRIDO_PX = 120 - 34 - 6;
const UMBRAL_ARRASTRE_PX = 5;

function IconoLuna() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function IconoSol() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3.6" fill="currentColor" stroke="none" />
      <path d="M12 2.6v2.4M12 19v2.4M2.6 12H5M19 12h2.4M5.35 5.35l1.7 1.7M16.95 16.95l1.7 1.7M5.35 18.65l1.7-1.7M16.95 7.05l1.7-1.7" />
    </svg>
  );
}

// Interruptor de tema del menú lateral: una pastilla con la palabra del modo
// actual y una perilla que va DENTRO de ella. Sólo mientras se toca o se
// arrastra la perilla se agranda y sobresale. Se puede tocar (alterna) o
// arrastrar (queda en el lado donde se suelta). Muestra el modo ACTUAL.
export default function InterruptorTema({ tema, alAlternar }) {
  const oscuro = tema === 'dark';
  const [presionado, setPresionado] = useState(false);
  // Desplazamiento del dedo mientras se arrastra, ya acotado al recorrido.
  const [arrastre, setArrastre] = useState(null);
  const refInicio = useRef(null);

  // Posición de reposo de la perilla: derecha en oscuro, izquierda en claro.
  const base = oscuro ? RECORRIDO_PX : 0;
  const x = arrastre === null ? base : arrastre;

  function alBajar(evento) {
    refInicio.current = { x: evento.clientX, base, movido: false };
    setPresionado(true);
    evento.currentTarget.setPointerCapture(evento.pointerId);
  }

  function alMover(evento) {
    const inicio = refInicio.current;
    if (!inicio) return;
    const dx = evento.clientX - inicio.x;
    if (!inicio.movido && Math.abs(dx) < UMBRAL_ARRASTRE_PX) return;
    inicio.movido = true;
    setArrastre(Math.min(RECORRIDO_PX, Math.max(0, inicio.base + dx)));
  }

  function terminar(evento, cancelado = false) {
    const inicio = refInicio.current;
    refInicio.current = null;
    setPresionado(false);
    setArrastre(null);
    if (!inicio || cancelado) return;
    if (inicio.movido) {
      // Se arrastró: queda donde se soltó.
      const dx = evento.clientX - inicio.x;
      const final = Math.min(RECORRIDO_PX, Math.max(0, inicio.base + dx));
      const quedaOscuro = final > RECORRIDO_PX / 2;
      if (quedaOscuro !== oscuro) alAlternar();
    } else {
      alAlternar();
    }
  }

  function alPresionarTecla(evento) {
    if (evento.key === ' ' || evento.key === 'Enter') {
      evento.preventDefault();
      alAlternar();
    }
  }

  return (
    <div
      role="switch"
      aria-checked={oscuro}
      aria-label="Modo oscuro"
      tabIndex={0}
      className={`${styles.pista} ${oscuro ? styles.oscuro : styles.claro} ${
        presionado ? styles.presionado : ''
      } ${arrastre !== null ? styles.arrastrando : ''}`}
      onPointerDown={alBajar}
      onPointerMove={alMover}
      onPointerUp={(evento) => terminar(evento)}
      onPointerCancel={(evento) => terminar(evento, true)}
      onKeyDown={alPresionarTecla}
    >
      <span className={`${styles.etiqueta} ${styles.etiquetaOscuro}`} aria-hidden="true">
        Oscuro
      </span>
      <span className={`${styles.etiqueta} ${styles.etiquetaClaro}`} aria-hidden="true">
        Claro
      </span>

      <span className={styles.perilla} style={{ '--x': `${x}px` }} aria-hidden="true">
        <span className={`${styles.icono} ${oscuro ? styles.iconoVisible : ''}`}>
          <IconoLuna />
        </span>
        <span className={`${styles.icono} ${oscuro ? '' : styles.iconoVisible}`}>
          <IconoSol />
        </span>
      </span>
    </div>
  );
}
