'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { TECNOLOGIAS } from '@/data/tecnologias.js';
import { CATEGORIAS } from '@/data/categoriasTecnologias.js';
import { listarProyectos } from '@/lib/proyectos.js';
import { buscarTecnologias } from '@/lib/buscador.js';
import { IconoTecnologia } from '@/components/Proyectos/iconosTecnologias.jsx';
import estilos from './Panel.module.css';

const DATOS = { tecnologias: TECNOLOGIAS, categorias: CATEGORIAS, proyectos: listarProyectos() };

// Sugerencias que se van tipeando solas en el campo vacío.
const SUGERENCIAS = ['base de datos', 'React', 'IA', 'pagos', 'tiempo real', 'mobile', 'Docker', 'animación 3D'];

// Escribe y borra las sugerencias, letra por letra, mientras el campo está vacío.
function useSugerenciaTipeada(activo) {
  const [texto, setTexto] = useState('');
  useEffect(() => {
    if (!activo) return undefined;
    let indice = 0;
    let letras = 0;
    let borrando = false;
    let espera = 0;
    const paso = () => {
      const palabra = SUGERENCIAS[indice % SUGERENCIAS.length];
      if (!borrando) {
        letras += 1;
        setTexto(palabra.slice(0, letras));
        if (letras >= palabra.length) {
          borrando = true;
          espera = setTimeout(paso, 1400);
          return;
        }
      } else {
        letras -= 1;
        setTexto(palabra.slice(0, letras));
        if (letras <= 0) {
          borrando = false;
          indice += 1;
        }
      }
      espera = setTimeout(paso, borrando ? 35 : 75);
    };
    espera = setTimeout(paso, 600);
    return () => clearTimeout(espera);
  }, [activo]);
  return texto;
}

// Buscador de tecnologías: tolera errores, entiende intención ("base de datos", "pagos") y dice
// en qué proyectos se usó cada una. Elegir un resultado trae su barra al foco y la hace explotar.
export default function Buscador({ alElegir, alLimpiar }) {
  const [consulta, setConsulta] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const [enfocado, setEnfocado] = useState(false);
  const refCampo = useRef(null);
  const idLista = useId();
  const reducido = useReducedMotion();
  const resultados = useMemo(() => buscarTecnologias(consulta, DATOS), [consulta]);
  const sugerencia = useSugerenciaTipeada(!consulta && !enfocado && !reducido);

  useEffect(() => setActivo(0), [consulta]);

  function elegir(resultado) {
    if (!resultado) return;
    alElegir(resultado.id);
    setConsulta(resultado.nombre);
    setAbierto(false);
    refCampo.current?.blur();
  }

  function alTeclear(evento) {
    if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      setAbierto(true);
      setActivo((a) => Math.min(a + 1, resultados.length - 1));
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      setActivo((a) => Math.max(a - 1, 0));
    } else if (evento.key === 'Enter') {
      evento.preventDefault();
      elegir(resultados[activo]);
    } else if (evento.key === 'Escape') {
      setAbierto(false);
      refCampo.current?.blur();
    }
  }

  const mostrar = abierto && consulta.trim() !== '';

  return (
    <div className={estilos.buscador}>
      <label className={estilos.campo} data-enfocado={enfocado}>
        <svg className={estilos.lupa} viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          ref={refCampo}
          type="search"
          value={consulta}
          onChange={(e) => {
            setConsulta(e.target.value);
            setAbierto(true);
            if (!e.target.value) alLimpiar?.();
          }}
          onFocus={() => {
            setEnfocado(true);
            setAbierto(true);
          }}
          onBlur={() => {
            setEnfocado(false);
            setTimeout(() => setAbierto(false), 150);
          }}
          onKeyDown={alTeclear}
          placeholder={enfocado || reducido ? 'Buscá una tecnología, un tema o un proyecto' : `Probá: ${sugerencia}`}
          aria-label="Buscar tecnologías"
          role="combobox"
          aria-expanded={mostrar}
          aria-controls={idLista}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
        />
        {consulta && (
          <button type="button" className={estilos.borrar} aria-label="Borrar búsqueda" onMouseDown={(e) => e.preventDefault()} onClick={() => {
              setConsulta('');
              alLimpiar?.();
            }}>
            ×
          </button>
        )}
      </label>

      <AnimatePresence>
        {mostrar && (
          <motion.ul
            id={idLista}
            role="listbox"
            className={estilos.resultados}
            initial={{ opacity: 0, y: -6, scale: 0.98, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -6, scale: 0.98, filter: 'blur(6px)' }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            {resultados.length === 0 && <li className={estilos.sinResultados}>Nada por acá. Probá con un tema: "pagos", "mapas", "IA"…</li>}
            {resultados.map((r, i) => (
              <motion.li
                key={r.id}
                role="option"
                aria-selected={i === activo}
                className={estilos.resultado}
                data-activo={i === activo}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03, duration: 0.25 }}
                onMouseEnter={() => setActivo(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(r)}
              >
                <span className={estilos.resultadoIcono}>
                  <IconoTecnologia id={r.id} />
                </span>
                <span className={estilos.resultadoTexto}>
                  <span className={estilos.resultadoNombre}>{r.nombre}</span>
                  <span className={estilos.resultadoMotivo}>
                    {r.motivo}
                    {r.proyectos.length > 0 && ` · en ${r.proyectos.length} ${r.proyectos.length === 1 ? 'proyecto' : 'proyectos'}`}
                  </span>
                </span>
                <span className={estilos.resultadoIr} aria-hidden="true">
                  ↵
                </span>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
