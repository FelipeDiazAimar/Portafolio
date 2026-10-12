'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useMotionValueEvent } from 'framer-motion';
import { PUNTOS_POR_TRAMO, puntosMinimapa } from '@/lib/columna/geometria.js';
import { estadoDe, tramoDe } from '@/lib/columna/recorrido.js';
import styles from './Minimapa.module.css';

const ANCHO = 28;
const ALTO = 220;

// La columna en miniatura: la S, el tramo recorrido y un botón por hito. Es la línea de
// tiempo accesible (teclado y lectores de pantalla) y sirve para saltar a cualquier hito.
// El avance se pinta tocando el DOM directo (sin renders de React por cada scroll).
export default function Minimapa({ hitos, progreso, activo, onIr }) {
  const n = hitos.length;
  const { camino, hitos: puntos } = useMemo(() => puntosMinimapa(n, { ancho: ANCHO, alto: ALTO }), [n]);
  const trazo = useMemo(
    () => camino.map((p, k) => `${k ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' '),
    [camino]
  );
  const acumulado = useMemo(() => {
    const largos = [0];
    for (let k = 1; k < camino.length; k += 1) {
      largos.push(largos[k - 1] + Math.hypot(camino[k].x - camino[k - 1].x, camino[k].y - camino[k - 1].y));
    }
    return largos;
  }, [camino]);
  const total = acumulado[acumulado.length - 1];
  const refRecorrido = useRef(null);
  const refMarcador = useRef(null);

  const pintar = useCallback(
    (p) => {
      const s = estadoDe(tramoDe(p, n));
      const k = Math.min(camino.length - 1, Math.max(0, s * PUNTOS_POR_TRAMO));
      const k0 = Math.floor(k);
      const k1 = Math.min(camino.length - 1, k0 + 1);
      const r = k - k0;
      const largo = acumulado[k0] + (acumulado[k1] - acumulado[k0]) * r;
      refRecorrido.current?.setAttribute('stroke-dasharray', `${largo} ${total}`);
      refMarcador.current?.setAttribute('cx', String(camino[k0].x + (camino[k1].x - camino[k0].x) * r));
      refMarcador.current?.setAttribute('cy', String(camino[k0].y + (camino[k1].y - camino[k0].y) * r));
    },
    [n, camino, acumulado, total]
  );

  useMotionValueEvent(progreso, 'change', pintar);
  useEffect(() => pintar(progreso.get()), [pintar, progreso]);

  return (
    <nav className={styles.minimapa} aria-label="Línea de tiempo">
      <svg className={styles.svg} width={ANCHO} height={ALTO} viewBox={`0 0 ${ANCHO} ${ALTO}`} aria-hidden="true">
        <path d={trazo} className={styles.base} />
        <path ref={refRecorrido} d={trazo} className={styles.recorrido} strokeDasharray={`0 ${total}`} />
        <circle ref={refMarcador} r="3" className={styles.marcador} cx={puntos[0].x} cy={puntos[0].y} />
      </svg>
      {hitos.map((hito, i) => (
        <button
          key={hito.id}
          type="button"
          className={styles.boton}
          style={{ left: `${puntos[i].x}px`, top: `${puntos[i].y}px` }}
          aria-label={`${hito.anio} — ${hito.titulo}`}
          aria-current={i === activo ? 'step' : undefined}
          onClick={() => onIr(i)}
        >
          <span className={styles.punto} aria-hidden="true" />
          <span className={styles.tooltip} aria-hidden="true">
            {hito.anio}
          </span>
        </button>
      ))}
    </nav>
  );
}
