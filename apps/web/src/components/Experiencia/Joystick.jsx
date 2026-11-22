'use client';

import { useRef } from 'react';
import styles from './Experiencia.module.css';

const RADIO = 46;

// Joystick táctil del recorrido libre: arrastrar la perilla camina en esa dirección
// (cuanto más lejos del centro, más rápido; al borde, corre).
export default function Joystick({ alMover }) {
  const refBase = useRef(null);
  const refPerilla = useRef(null);
  const refToque = useRef(null);

  const mover = (e) => {
    const base = refBase.current.getBoundingClientRect();
    let dx = e.clientX - (base.left + base.width / 2);
    let dy = e.clientY - (base.top + base.height / 2);
    const n = Math.hypot(dx, dy);
    if (n > RADIO) {
      dx = (dx / n) * RADIO;
      dy = (dy / n) * RADIO;
    }
    refPerilla.current.style.transform = `translate(${dx}px, ${dy}px)`;
    alMover({ adelante: -dy / RADIO, lado: dx / RADIO, correr: n > RADIO * 1.15 });
  };
  const soltar = () => {
    refToque.current = null;
    refPerilla.current.style.transform = '';
    alMover({ adelante: 0, lado: 0 });
  };

  return (
    <div
      ref={refBase}
      className={styles.joystick}
      data-joystick
      aria-hidden="true"
      onPointerDown={(e) => {
        refToque.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        mover(e);
      }}
      onPointerMove={(e) => {
        if (refToque.current === e.pointerId) mover(e);
      }}
      onPointerUp={soltar}
      onPointerCancel={soltar}
    >
      <span ref={refPerilla} className={styles.joystickPerilla} />
    </div>
  );
}
