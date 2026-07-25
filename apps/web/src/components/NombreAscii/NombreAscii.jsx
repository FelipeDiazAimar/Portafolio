'use client';

import { useEffect, useState } from 'react';
import { useAsciiText, ansiShadow } from 'react-ascii-text';
import styles from './NombreAscii.module.css';

const DEMORA_INICIO_MS = 3300;
const DURACION_ANIMACION_MS = 2600;
const CARACTERES_ANIMACION = '/*+#%@$&';

// Componente separado a propósito: react-ascii-text arranca su loop de
// animación apenas se monta (isPaused solo pausa/reanuda un loop que ya
// está corriendo, no evita que arranque) — así que la única forma real
// de retrasar el inicio es no montar este componente hasta después de
// los 3.3s de Bienvenida.
function AsciiAnimado({ formado, onFormado }) {
  const refAscii = useAsciiText({
    font: ansiShadow,
    text: ['Felipe', 'Diaz Aimar'],
    animationDirection: 'down',
    animationCharacters: CARACTERES_ANIMACION,
    animationSpeed: 25,
    animationLoop: false,
  });

  useEffect(() => {
    const temporizadorFin = setTimeout(onFormado, DURACION_ANIMACION_MS);
    return () => clearTimeout(temporizadorFin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <pre className={`${styles.ascii} ${formado ? styles.oculto : ''}`} ref={refAscii} aria-hidden="true" />;
}

export default function NombreAscii() {
  const [empezar, setEmpezar] = useState(false);
  const [formado, setFormado] = useState(false);

  useEffect(() => {
    const temporizadorInicio = setTimeout(() => setEmpezar(true), DEMORA_INICIO_MS);
    return () => clearTimeout(temporizadorInicio);
  }, []);

  return (
    <div className={styles.contenedor}>
      <span className={styles.soloLectura}>Felipe Diaz Aimar</span>

      {empezar && <AsciiAnimado formado={formado} onFormado={() => setFormado(true)} />}

      <div className={`${styles.textoLimpio} ${formado ? styles.visible : ''}`} aria-hidden="true">
        <span>Felipe</span>
        <span>Diaz Aimar</span>
      </div>

      <div className={`${styles.franja} ${styles.franjaSuperior} ${formado ? styles.encogida : ''}`} />
      <div className={`${styles.franja} ${styles.franjaInferior} ${formado ? styles.encogida : ''}`} />
    </div>
  );
}
