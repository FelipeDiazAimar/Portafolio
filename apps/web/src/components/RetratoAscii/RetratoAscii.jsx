'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { usePortfolio } from '@/contexto/ProveedorPortfolio.jsx';
import { prefiereMovimientoReducido } from '@/lib/entrada.js';
import RevelarEsqueleto from '@/components/RayosX/RevelarEsqueleto.jsx';
import styles from './RetratoAscii.module.css';

const RUTA_RETRATO = '/retrato.png';
// Medidas reales del archivo. Tienen que coincidir con el `aspect-ratio` de `.marco`: el revelado
// del esqueleto cubre la caja entera y se calibra en fracciones de ella.
const ANCHO_RETRATO = 1792;
const ALTO_RETRATO = 2390;
// Mismo valor que en NombreAscii: la foto aparece cuando se va el splash de Bienvenida.
const DEMORA_INICIO_MS = 3300;
// Cuántas alturas de pantalla de scroll tarda el retrato en apagarse del todo.
const ALTURAS_PARA_DESVANECER = 0.85;

// Retrato del hero. Aparece con un fundido al irse el splash; al pasar el mouse por encima se
// revela un esqueleto en rayos X (RevelarEsqueleto).
// `rayosX`: el hero pasó al fondo de esqueletos (la foto se funde). `alDispararRayosX`: lo pide el
// revelado tras unos segundos con el cursor sobre la foto.
export default function RetratoAscii({ rayosX = false, alDispararRayosX }) {
  const { seccionActiva } = usePortfolio();
  const refMarco = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const demora = prefiereMovimientoReducido() ? 0 : DEMORA_INICIO_MS;
    const temporizador = setTimeout(() => setVisible(true), demora);
    return () => clearTimeout(temporizador);
  }, []);

  // El retrato se difumina con el scroll. Se escribe una variable CSS directo en el nodo, sin
  // estado de React: cambia en cada cuadro de scroll.
  useEffect(() => {
    const marco = refMarco.current;
    if (!marco) return undefined;
    let cuadro = 0;
    function actualizar() {
      cuadro = 0;
      const progreso = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * ALTURAS_PARA_DESVANECER)));
      marco.style.setProperty('--desvanecido', progreso.toFixed(3));
    }
    function alScrollear() {
      if (!cuadro) cuadro = requestAnimationFrame(actualizar);
    }
    actualizar();
    window.addEventListener('scroll', alScrollear, { passive: true });
    return () => {
      window.removeEventListener('scroll', alScrollear);
      cancelAnimationFrame(cuadro);
    };
  }, []);

  return (
    <div className={`${styles.marco} ${rayosX ? styles.apagado : ''}`} ref={refMarco}>
      <Image
        src={RUTA_RETRATO}
        alt=""
        width={ANCHO_RETRATO}
        height={ALTO_RETRATO}
        priority
        className={`${styles.foto} ${visible ? styles.revelada : ''}`}
      />
      {/* Hover: debajo del cursor aparece el esqueleto (rayos X). */}
      {visible && <RevelarEsqueleto refMarco={refMarco} activo={!rayosX && seccionActiva === 'inicio'} alDisparar={alDispararRayosX} />}
    </div>
  );
}
