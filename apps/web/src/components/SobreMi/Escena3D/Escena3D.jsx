'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import EscenarioHito from '../EscenarioHito.jsx';
import LimiteErrores from './LimiteErrores.jsx';
import useConsulta from '@/hooks/useConsulta.js';
import { hayWebGL } from './soporteWebGL.js';
import { idsConEscena } from './escenas/index.js';
import styles from './Escena3D.module.css';

// Todo `three` queda en este chunk, que sólo se pide cuando la sección se acerca
// a la pantalla.
const EscenaCanvas = dynamic(() => import('./EscenaCanvas.jsx'), { ssr: false, loading: () => null });

export default function Escena3D({ hito, desarmado, onInteraccion }) {
  const refCaja = useRef(null);
  const [webgl, setWebgl] = useState(false);
  const [montado, setMontado] = useState(false);
  const [visible, setVisible] = useState(false);
  const [fallo, setFallo] = useState(false);
  // En celular la descripción va DEBAJO del modelo, no encima: el modelo se queda
  // armado y visible. Sólo en escritorio se desarma para dejar lugar al texto.
  const esMovil = useConsulta('(max-width: 768px)');
  const seDesarma = desarmado && !esMovil;

  useEffect(() => {
    setWebgl(hayWebGL());
  }, []);

  useEffect(() => {
    const caja = refCaja.current;
    if (!caja) return undefined;
    // Margen: se monta (y se empieza a cargar el chunk) un poco antes de verse.
    const observador = new IntersectionObserver(
      ([entrada]) => {
        setVisible(entrada.isIntersecting);
        if (entrada.isIntersecting) setMontado(true);
      },
      { rootMargin: '300px' }
    );
    observador.observe(caja);
    return () => observador.disconnect();
  }, []);

  const usar3D = webgl && idsConEscena.has(hito.id) && !fallo;

  return (
    <div
      ref={refCaja}
      className={styles.caja}
      data-desarmado={seDesarma}
      onPointerDown={(evento) => {
        if (evento.target.tagName === 'CANVAS') onInteraccion?.();
      }}
    >
      {usar3D ? (
        montado ? (
          <LimiteErrores onError={() => setFallo(true)}>
            <EscenaCanvas
              idHito={hito.id}
              desarmado={seDesarma}
              visible={visible}
              onError={() => setFallo(true)}
            />
          </LimiteErrores>
        ) : null
      ) : (
        <EscenarioHito hito={hito} desarmado={desarmado} />
      )}
    </div>
  );
}
