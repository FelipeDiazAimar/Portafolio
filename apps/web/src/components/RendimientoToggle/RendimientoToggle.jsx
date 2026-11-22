'use client';

import { useRef } from 'react';
import { GlassSurface } from '@portafolio/ui';
import useRendimiento from '@/hooks/useRendimiento.js';
import styles from './RendimientoToggle.module.css';

// Toggle de modo rendimiento: misma pastilla de vidrio que el de tema, a su izquierda, con su
// etiqueta. Encendido, las escenas 3D dejan los efectos caros (ver EscenaPasillo).
export default function RendimientoToggle() {
  const { activo, alternar } = useRendimiento();
  const refToggle = useRef(null);

  function manejarMovimientoRaton(evento) {
    const contenedor = refToggle.current;
    if (!contenedor) return;
    const rect = contenedor.getBoundingClientRect();
    contenedor.style.setProperty('--raton-x', `${evento.clientX - rect.left}px`);
    contenedor.style.setProperty('--raton-y', `${evento.clientY - rect.top}px`);
  }

  return (
    <div ref={refToggle} className={styles.wrapper} onMouseMove={manejarMovimientoRaton}>
      <GlassSurface
        width={176}
        height={40}
        borderRadius={100}
        className={styles.track}
        opacity={0.9}
        brightness={45}
        blur={14}
        backgroundOpacity={0.12}
        saturation={1.4}
        distortionScale={-140}
        redOffset={0}
        greenOffset={6}
        blueOffset={14}
        displace={0.2}
      >
        <button type="button" role="switch" aria-checked={activo} className={styles.button} onClick={alternar}>
          <span className={styles.etiqueta}>Modo rendimiento</span>
          <span className={styles.pista} data-activo={activo ? 'true' : 'false'} aria-hidden="true">
            <span className={styles.thumb} />
          </span>
        </button>
      </GlassSurface>
    </div>
  );
}
