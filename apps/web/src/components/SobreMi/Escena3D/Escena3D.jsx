'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import EscenarioHito from '../EscenarioHito.jsx';
import LimiteErrores from './LimiteErrores.jsx';
import useConsulta from '@/hooks/useConsulta.js';
import useTema from '@/hooks/useTema.js';
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
  const refInteraccion = useRef(onInteraccion);
  refInteraccion.current = onInteraccion;
  // En celular la descripción va DEBAJO del modelo, no encima: el modelo se queda
  // armado y visible. Sólo en escritorio se desarma para dejar lugar al texto.
  const esMovil = useConsulta('(max-width: 768px)');
  const seDesarma = desarmado && !esMovil;
  // Algunas escenas tienen variante clara para el tema claro del sitio.
  const claro = useTema().tema === 'light';

  useEffect(() => {
    setWebgl(hayWebGL());
  }, []);

  // Las escenas avisan con el evento 'interaccion3d' cuando el usuario juega con
  // algo (por ejemplo, pasa el cursor sobre la tela de la bandera): no debe contar
  // como "mouse quieto" para el desarme por hover.
  useEffect(() => {
    const caja = refCaja.current;
    if (!caja) return undefined;
    const alInteractuar = () => refInteraccion.current?.();
    caja.addEventListener('interaccion3d', alInteractuar);
    return () => caja.removeEventListener('interaccion3d', alInteractuar);
  }, []);

  useEffect(() => {
    const caja = refCaja.current;
    if (!caja) return undefined;
    // Un observador con margen monta el canvas (y empieza a cargar el chunk) un
    // poco antes de verse; otro, sin margen, marca cuándo está realmente a la
    // vista: recién ahí arranca la animación (la tapa se abre a la vista) y se
    // activa el render.
    const precarga = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) setMontado(true);
      },
      { rootMargin: '300px' }
    );
    const enPantalla = new IntersectionObserver(([entrada]) => setVisible(entrada.isIntersecting));
    precarga.observe(caja);
    enPantalla.observe(caja);
    return () => {
      precarga.disconnect();
      enPantalla.disconnect();
    };
  }, []);

  const usar3D = webgl && idsConEscena.has(hito.id) && !fallo;

  return (
    <div
      ref={refCaja}
      className={styles.caja}
      data-desarmado={seDesarma}
      onPointerDown={(evento) => {
        // Sólo con mouse: en táctil, tocar el modelo es girarlo (o empezar a
        // scrollear la columna) y no debe cerrar el detalle.
        if (evento.pointerType === 'mouse' && evento.target.tagName === 'CANVAS') onInteraccion?.();
      }}
    >
      {usar3D ? (
        montado ? (
          <LimiteErrores onError={() => setFallo(true)}>
            <EscenaCanvas
              idHito={hito.id}
              desarmado={seDesarma}
              claro={claro}
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
