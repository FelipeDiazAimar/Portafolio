'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, animate, motion, useInView, useReducedMotion } from 'framer-motion';
import { TECNOLOGIAS } from '@/data/tecnologias.js';
import TextoTrazo from '@/components/TextoTrazo/TextoTrazo.jsx';
import Buscador from './Buscador.jsx';
import estilos from './Panel.module.css';

const SALIDA = [0.16, 1, 0.3, 1];

// Número que cuenta desde 0 cuando aparece.
function Contador({ hasta, activo }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!activo || !ref.current) return undefined;
    const control = animate(0, hasta, {
      duration: 1.6,
      ease: SALIDA,
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = String(Math.round(v));
      },
    });
    return () => control.stop();
  }, [activo, hasta]);
  return <span ref={ref}>{activo ? 0 : hasta}</span>;
}

// Texto letra por letra: cada una cae desde arriba, desenfocada, con un pequeño rebote.
function Letras({ texto, activo, retraso = 0 }) {
  return (
    <span aria-label={texto}>
      {Array.from(texto).map((letra, i) => (
        <motion.span
          key={`${letra}-${i}`}
          aria-hidden="true"
          className={estilos.letra}
          initial={{ opacity: 0, y: -14, filter: 'blur(6px)' }}
          animate={activo ? { opacity: 1, y: 0, filter: 'blur(0px)' } : undefined}
          transition={{ delay: retraso + i * 0.035, type: 'spring', stiffness: 380, damping: 18 }}
        >
          {letra === ' ' ? ' ' : letra}
        </motion.span>
      ))}
    </span>
  );
}

// Bajada palabra por palabra: cada una entra desenfocada y sube a su lugar.
function Palabras({ texto, activo, retraso = 0 }) {
  return texto.split(' ').map((palabra, i) => (
    <motion.span
      key={`${palabra}-${i}`}
      className={estilos.palabra}
      initial={{ opacity: 0, y: 12, filter: 'blur(9px)' }}
      animate={activo ? { opacity: 1, y: 0, filter: 'blur(0px)' } : undefined}
      transition={{ delay: retraso + i * 0.05, duration: 0.65, ease: SALIDA }}
    >
      {palabra}{' '}
    </motion.span>
  ));
}

// Chispas que salen disparadas al cambiar de vista.
function Chispas({ disparo }) {
  const [chispas, setChispas] = useState([]);
  useEffect(() => {
    if (!disparo) return undefined;
    const nuevas = Array.from({ length: 16 }, (_, i) => {
      const angulo = (i / 16) * Math.PI * 2 + Math.random() * 0.4;
      const distancia = 40 + Math.random() * 50;
      return { id: `${disparo}-${i}`, x: Math.cos(angulo) * distancia, y: Math.sin(angulo) * distancia, tono: i % 3 };
    });
    setChispas(nuevas);
    const fin = setTimeout(() => setChispas([]), 900);
    return () => clearTimeout(fin);
  }, [disparo]);
  return (
    <span className={estilos.chispas} aria-hidden="true">
      <AnimatePresence>
        {chispas.map((c) => (
          <motion.span
            key={c.id}
            className={estilos.chispa}
            data-tono={c.tono}
            initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
            animate={{ x: c.x, y: c.y, scale: 0, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: SALIDA }}
          />
        ))}
      </AnimatePresence>
    </span>
  );
}

// Columna izquierda de Habilidades: título que se dibuja, bajada que aparece palabra por palabra,
// buscador inteligente y la estrellita (alterna entre la hélice y el árbol de habilidades). Las animaciones de entrada se repiten cada vez que se entra a la sección.
export default function PanelHabilidades({ alBuscar, alLimpiar, modo, alModo }) {
  const ref = useRef(null);
  const dentro = useInView(ref, { amount: 0.3 });
  const reducido = useReducedMotion();
  const [vuelta, setVuelta] = useState(0);
  const antes = useRef(false);
  const [disparo, setDisparo] = useState(0); // chispas de la estrellita
  // cada entrada nueva a la sección vuelve a armar el contenido, y por eso se vuelve a animar
  useEffect(() => {
    if (dentro && !antes.current) setVuelta((v) => v + 1);
    antes.current = dentro;
  }, [dentro]);

  // La aparición es breve y no mueve la pantalla: se anima siempre (si no, con las animaciones del
  // sistema desactivadas la sección entraba sin ningún efecto).
  const activo = vuelta > 0;

  return (
    <div ref={ref} className={estilos.panel}>
      <div key={vuelta} className={estilos.contenido}>
        <p className={estilos.antetitulo}>
          <motion.span
            className={estilos.punto}
            aria-hidden="true"
            initial={{ scale: 0 }}
            animate={activo ? { scale: 1 } : undefined}
            transition={{ type: 'spring', stiffness: 500, damping: 14 }}
          />
          <Letras texto="STACK" activo={activo} />
          <span aria-hidden="true">·</span>
          <span>
            <Contador hasta={TECNOLOGIAS.length} activo={activo} /> tecnologías
          </span>
        </p>

        <h2 className={estilos.titulo}>
          <TextoTrazo texto="Habilidades" claseTexto={estilos.tituloTrazo} duracion={2.2} grosor={2.2} alVer />
        </h2>

        <p className={estilos.bajada}>
          <Palabras texto="Lo que uso para construir mis proyectos, de la base de datos a la última animación." activo={activo} retraso={0.55} />
          <motion.span
            className={estilos.pista}
            initial={{ opacity: 0, x: -10 }}
            animate={activo ? { opacity: 1, x: 0 } : undefined}
            transition={{ delay: 1.5, duration: 0.8, ease: SALIDA }}
          >
            {modo === 'arbol' ? (
              <>Tocá una esfera o una categoría. La estrella vuelve a la hélice.</>
            ) : (
              <>
                <span className={estilos.conMouse}>Agarrá el modelo: de costado lo gira, arriba y abajo lo recorre. Tocá una barra: explota.</span>
                <span className={estilos.tactil}>Deslizá el modelo para girarlo. Tocá una barra: explota.</span> La estrella abre el árbol.
              </>
            )}
          </motion.span>
        </p>

        <motion.div
          className={estilos.fila}
          initial={{ opacity: 0, y: 18, filter: 'blur(10px)' }}
          animate={activo ? { opacity: 1, y: 0, filter: 'blur(0px)' } : undefined}
          transition={{ delay: 0.85, duration: 0.75, ease: SALIDA }}
        >
          <Buscador alElegir={alBuscar} alLimpiar={alLimpiar} />
          <motion.button
            type="button"
            className={estilos.explosion}
            data-activo={modo === 'arbol'}
            aria-pressed={modo === 'arbol'}
            whileHover={reducido ? undefined : { scale: 1.06 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              setDisparo((d) => d + 1);
              alModo(modo === 'arbol' ? 'helice' : 'arbol');
            }}
            aria-label={modo === 'arbol' ? 'Volver a la hélice' : 'Ver como árbol de habilidades'}
            title={modo === 'arbol' ? 'Volver a la hélice' : 'Ver como árbol de habilidades'}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
              <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" />
              <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" opacity=".7" />
            </svg>
            <Chispas disparo={disparo} />
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
