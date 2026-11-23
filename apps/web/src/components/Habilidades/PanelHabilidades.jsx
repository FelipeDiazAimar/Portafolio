'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { alCuadro } from '@/lib/movimiento.js';
import { TECNOLOGIAS } from '@/data/tecnologias.js';
import TextoTrazo from '@/components/TextoTrazo/TextoTrazo.jsx';
import Buscador from './Buscador.jsx';
import estilos from './Panel.module.css';

const SALIDA = [0.16, 1, 0.3, 1];

// Número que cuenta desde 0 a medida que la sección entra (y descuenta al subir).
function Contador({ hasta }) {
  const ref = useRef(null);
  useEffect(() => {
    const nodo = ref.current;
    if (!nodo || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const seccion = nodo.closest('section') ?? nodo;
    let ultimo = -1;
    return alCuadro(() => {
      const r = seccion.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = Math.max(0, Math.min(1, (vh * 0.85 - r.top) / (vh * 0.6)));
      const v = Math.round(hasta * (1 - Math.pow(1 - p, 3)));
      if (v !== ultimo) {
        ultimo = v;
        nodo.textContent = String(v);
      }
    });
  }, [hasta]);
  return <span ref={ref}>{hasta}</span>;
}

// Texto letra por letra (cada una sube desde su máscara, con el scroll; ver Revelador).
function Letras({ texto, desde = 'top 85%', hasta = 'top 45%' }) {
  return (
    <span aria-label={texto} data-revelar="letras" data-revelar-en="seccion" data-revelar-desde={desde} data-revelar-hasta={hasta}>
      {Array.from(texto).map((letra, i) => (
        <span key={`${letra}-${i}`} aria-hidden="true" className={`rv-u ${estilos.letra}`}>
          <span className="rv-i">{letra === ' ' ? ' ' : letra}</span>
        </span>
      ))}
    </span>
  );
}

// Bajada palabra por palabra (con el scroll).
function Palabras({ texto, desde = 'top 78%', hasta = 'top 25%' }) {
  return (
    <span data-revelar="palabras" data-revelar-en="seccion" data-revelar-desde={desde} data-revelar-hasta={hasta}>
      {texto.split(' ').map((palabra, i) => (
        <span key={`${palabra}-${i}`} className={`rv-u ${estilos.palabra}`}>
          <span className="rv-i">{palabra} </span>
        </span>
      ))}
    </span>
  );
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
  // celular: título plano (ver más abajo); se decide antes de pintar para que no parpadee el otro
  const [movil, setMovil] = useState(false);
  useLayoutEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const leer = () => setMovil(mq.matches);
    leer();
    mq.addEventListener('change', leer);
    return () => mq.removeEventListener('change', leer);
  }, []);
  const reducido = useReducedMotion();
  const [disparo, setDisparo] = useState(0); // chispas de la estrellita
  // glow-up: la entrada ya no corre por tiempo: cada parte se arma con el scroll (Revelador) y se
  // desarma al subir.

  return (
    <div ref={ref} className={estilos.panel}>
      <div className={estilos.contenido}>
        <p className={estilos.antetitulo}>
          <span className={estilos.punto} aria-hidden="true" />
          <Letras texto="STACK" />
          <span aria-hidden="true">·</span>
          <span>
            <Contador hasta={TECNOLOGIAS.length} /> tecnologías
          </span>
        </p>

        <h2 className={estilos.titulo}>
          {/* Celular: texto plano. El trazo animado en SVG con interletrado negativo se amontonaba y
              vibraba en Safari del iPhone. */}
          {movil ? <span className={estilos.tituloPlano}>Habilidades</span> : <TextoTrazo texto="Habilidades" claseTexto={estilos.tituloTrazo} duracion={2.2} grosor={2.2} alVer alScroll />}
        </h2>

        <p className={estilos.bajada}>
          <Palabras texto="Lo que uso para construir mis proyectos, de la base de datos a la última animación." />
          <span className={estilos.pista} data-revelar="subir" data-revelar-en="seccion" data-revelar-desde="top 62%" data-revelar-hasta="top 12%">
            {modo === 'arbol' ? (
              <>Tocá una esfera o una categoría. La estrella vuelve a la hélice.</>
            ) : (
              <>
                <span className={estilos.conMouse}>Agarrá el modelo: de costado lo gira, arriba y abajo lo recorre. Tocá una barra: explota.</span>
                <span className={estilos.tactil}>Deslizá el modelo para girarlo. Tocá una barra: explota.</span> La estrella abre el árbol.
              </>
            )}
          </span>
        </p>

        <div className={estilos.fila} data-revelar="subir" data-revelar-en="seccion" data-revelar-desde="top 58%" data-revelar-hasta="top 5%">
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
        </div>
      </div>
    </div>
  );
}
