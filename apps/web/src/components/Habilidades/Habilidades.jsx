'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { TECNOLOGIAS } from '@/data/tecnologias.js';
import { CATEGORIAS } from '@/data/categoriasTecnologias.js';
import useTema from '@/hooks/useTema.js';
import { IconoTecnologia } from '@/components/Proyectos/iconosTecnologias.jsx';
import { hayWebGL } from '@/components/SobreMi/Escena3D/soporteWebGL.js';
import estilos from './Habilidades.module.css';

// Habilidades: un xilófono de vidrio con una barra por tecnología (adaptado de
// https://github.com/Sujenphea/xylophone, MIT). La cinta de barras avanza sola y con el scroll de
// la página; cada barra se enciende (con su nombre) al pasar por el foco, y pasar el mouse por
// una barra la golpea, la resalta y frena la cinta. Los chips filtran por categoría.
// Sin WebGL queda la lista de tecnologías como píldoras (y los chips también la filtran).

// Índice de cada tecnología en el catálogo (= su barra).
const INDICE = new Map(TECNOLOGIAS.map((t, i) => [t.id, i]));
export default function Habilidades() {
  const refSeccion = useRef(null);
  const refLienzo = useRef(null);
  const refLogos = useRef(null);
  const refMotor = useRef(null);
  const [conWebGL, setConWebGL] = useState(true);
  const [listo, setListo] = useState(false);
  const [categoria, setCategoria] = useState(null);
  const { tema } = useTema();
  const reducido = useReducedMotion();
  const refTema = useRef(tema);
  refTema.current = tema;

  useEffect(() => {
    if (!hayWebGL()) {
      setConWebGL(false);
      return undefined;
    }
    let cancelado = false;
    let motor = null;
    let observadorTamano = null;
    let observadorVista = null;
    const lienzo = refLienzo.current;
    const seccion = refSeccion.current;

    (async () => {
      const [{ Xilofono }, { crearAtlas, crearAtlasNombres }] = await Promise.all([import('./xilofono/Xilofono.js'), import('./xilofono/atlas.js')]);
      if (cancelado) return;
      const nodos = Array.from(refLogos.current.querySelectorAll('[data-logo]'));
      const atlas = crearAtlas(nodos);
      try {
        motor = new Xilofono(lienzo, {
          atlas: atlas.textura,
          nombres: crearAtlasNombres(TECNOLOGIAS.map((t) => t.nombre)),
          tema: refTema.current,
          reducido,
        });
      } catch (error) {
        console.error('[Habilidades] sin xilófono', error);
        setConWebGL(false);
        return;
      }
      refMotor.current = motor;
      const medir = () => {
        const caja = lienzo.getBoundingClientRect();
        motor.redimensionar(Math.max(1, Math.round(caja.width)), Math.max(1, Math.round(caja.height)));
      };
      medir();
      observadorTamano = new ResizeObserver(medir);
      observadorTamano.observe(lienzo);
      // el ciclo sólo corre con la sección a la vista
      observadorVista = new IntersectionObserver(([entrada]) => (entrada.isIntersecting ? motor.iniciar() : motor.pausar()), { rootMargin: '120px 0px' });
      observadorVista.observe(seccion);
      const [cargado] = await Promise.all([motor.listo, atlas.listo]);
      if (!cancelado && cargado) setListo(true);
      if (!cancelado && !cargado) setConWebGL(false);
    })();

    return () => {
      cancelado = true;
      observadorTamano?.disconnect();
      observadorVista?.disconnect();
      motor?.liberar();
      refMotor.current = null;
    };
  }, [reducido]);

  useEffect(() => {
    refMotor.current?.aplicarTema(tema);
  }, [tema]);

  const categoriaActual = CATEGORIAS.find((c) => c.id === categoria) ?? null;
  useEffect(() => {
    refMotor.current?.filtrar(categoriaActual ? categoriaActual.tecnologias.map((id) => INDICE.get(id)) : null);
  }, [categoriaActual, listo]);

  function alMover(evento) {
    const caja = evento.currentTarget.getBoundingClientRect();
    refMotor.current?.moverPuntero(evento.clientX - caja.left, evento.clientY - caja.top);
  }

  function alSalir() {
    refMotor.current?.soltarPuntero();
  }

  return (
    <section id="habilidades" ref={refSeccion} className={estilos.seccion} data-webgl={conWebGL} data-listo={listo}>
      <header className={estilos.encabezado}>
        <h2 className={estilos.titulo}>Habilidades</h2>
        <p className={estilos.bajada}>
          {TECNOLOGIAS.length} tecnologías con las que construí mis proyectos.{' '}
          <span className={estilos.conMouse}>Pasá el mouse por las barras.</span>
          <span className={estilos.tactil}>Tocá las barras.</span>
        </p>
        <div className={estilos.chips} role="group" aria-label="Filtrar por categoría">
          <button type="button" className={estilos.chip} aria-pressed={categoria === null} onClick={() => setCategoria(null)}>
            Todas <span className={estilos.cuenta}>{TECNOLOGIAS.length}</span>
          </button>
          {CATEGORIAS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={estilos.chip}
              aria-pressed={categoria === c.id}
              onClick={() => setCategoria((actual) => (actual === c.id ? null : c.id))}
            >
              {c.nombre} <span className={estilos.cuenta}>{c.tecnologias.length}</span>
            </button>
          ))}
        </div>
      </header>

      {conWebGL && (
        <div className={estilos.escenario}>
          <canvas
            ref={refLienzo}
            className={estilos.lienzo}
            aria-hidden="true"
            onPointerMove={alMover}
            onPointerDown={alMover}
            onPointerLeave={alSalir}
          />
        </div>
      )}

      {/* Lista real de tecnologías: sin WebGL se ve como píldoras; con WebGL queda para lectores
          de pantalla, y sus logos (los mismos de Proyectos) alimentan el atlas de las barras. */}
      <ul ref={refLogos} className={estilos.lista}>
        {TECNOLOGIAS.map((t) => (
          <li key={t.id} className={estilos.item} data-fuera={Boolean(categoriaActual && !categoriaActual.tecnologias.includes(t.id))}>
            <span data-logo className={estilos.logo}>
              <IconoTecnologia id={t.id} />
            </span>
            {t.nombre}
          </li>
        ))}
      </ul>
    </section>
  );
}
