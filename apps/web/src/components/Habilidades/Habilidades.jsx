'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { TECNOLOGIAS } from '@/data/tecnologias.js';
import { CATEGORIAS } from '@/data/categoriasTecnologias.js';
import { ordenDeBarras } from '@/lib/xilofono.js';
import PanelHabilidades from './PanelHabilidades.jsx';
import DockCategorias from './DockCategorias.jsx';
import useTema from '@/hooks/useTema.js';
import useEmbudo from '@/hooks/useEmbudo.js';
import useUnionSeccion from '@/hooks/useUnionSeccion.js';
import { IconoTecnologia } from '@/components/Proyectos/iconosTecnologias.jsx';
import { hayWebGL } from '@/components/SobreMi/Escena3D/soporteWebGL.js';
import estilos from './Habilidades.module.css';

// Habilidades: un xilófono de vidrio con una barra por tecnología (adaptado de
// https://github.com/Sujenphea/xylophone, MIT). La cinta de barras avanza sola y con el scroll de
// la página; cada barra se enciende (con su nombre) al pasar por el foco, y pasar el mouse por
// una barra la golpea, la resalta y frena la cinta. A la izquierda: buscador, explosión de color
// y chips por categoría (PanelHabilidades).
// Sin WebGL queda la lista de tecnologías como píldoras (y los chips también la filtran).

// Índice de cada tecnología en el catálogo (= su celda en los atlas de logos y nombres).
const INDICE = new Map(TECNOLOGIAS.map((t, i) => [t.id, i]));
// Qué tecnología va en cada barra: las de una misma categoría repartidas por toda la hélice.
const ORDEN = ordenDeBarras(CATEGORIAS, TECNOLOGIAS);
export default function Habilidades() {
  const refSeccion = useRef(null);
  const refEscenario = useRef(null);
  useUnionSeccion(refEscenario);
  const refLienzo = useRef(null);
  const refLogos = useRef(null);
  const refMotor = useRef(null);
  const [conWebGL, setConWebGL] = useState(true);
  const [listo, setListo] = useState(false);
  const [categoria, setCategoria] = useState(null);
  const [modo, setModo] = useState('helice'); // 'helice' | 'arbol'
  const { tema } = useTema();
  const reducido = useReducedMotion();
  const refTema = useRef(tema);
  refTema.current = tema;
  // Embudo: si el scroll se detiene cerca de la sección, la acomoda sola en pantalla.
  useEmbudo(refSeccion);

  useEffect(() => {
    if (!hayWebGL()) {
      setConWebGL(false);
      return undefined;
    }
    let cancelado = false;
    let motor = null;
    let observadorTamano = null;
    let observadorVista = null;
    let alRueda = null;
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
          orden: ORDEN,
          categorias: CATEGORIAS,
          tecnologias: TECNOLOGIAS,
          // tocar una categoría del árbol la elige (o la quita si ya estaba)
          alCategoria: (id) => setCategoria(id),
          tema: refTema.current,
          reducido,
          // cursor de agarre sólo sobre las barras (el modelo se agarra desde ahí)
          alCursor: (tipo) => {
            lienzo.style.cursor = tipo;
          },
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
      // Zoom con Ctrl + rueda (y el pellizco del trackpad, que llega así). La rueda sola sigue
      // scrolleando la página.
      alRueda = (evento) => {
        if (!evento.ctrlKey && !evento.metaKey) return;
        evento.preventDefault();
        const caja = lienzo.getBoundingClientRect();
        motor.zoomRelativo(Math.exp(-evento.deltaY * 0.0045), evento.clientX - caja.left, evento.clientY - caja.top);
      };
      lienzo.addEventListener('wheel', alRueda, { passive: false });
      const [cargado] = await Promise.all([motor.listo, atlas.listo]);
      if (!cancelado && cargado) setListo(true);
      if (!cancelado && !cargado) setConWebGL(false);
    })();

    return () => {
      cancelado = true;
      observadorTamano?.disconnect();
      observadorVista?.disconnect();
      if (alRueda) lienzo.removeEventListener('wheel', alRueda);
      motor?.liberar();
      refMotor.current = null;
    };
  }, [reducido]);

  useEffect(() => {
    refMotor.current?.aplicarTema(tema);
  }, [tema]);

  const categoriaActual = CATEGORIAS.find((c) => c.id === categoria) ?? null;
  const idsFiltro = categoriaActual ? categoriaActual.tecnologias : null;
  useEffect(() => {
    const motor = refMotor.current;
    if (!motor) return;
    const indices = idsFiltro ? idsFiltro.map((id) => INDICE.get(id)).filter((i) => i !== undefined) : null;
    motor.filtrar(indices, categoriaActual?.id ?? null);
  }, [categoriaActual, idsFiltro, listo]);

  useEffect(() => {
    refMotor.current?.usarArbol(modo === 'arbol');
  }, [modo, listo]);

  function posicion(evento) {
    const caja = evento.currentTarget.getBoundingClientRect();
    return [evento.clientX - caja.left, evento.clientY - caja.top];
  }

  function alBajar(evento) {
    const [x, y] = posicion(evento);
    refMotor.current?.moverPuntero(x, y);
    if (refMotor.current?.bajarPuntero(evento.pointerId, x, y)) evento.currentTarget.style.cursor = refMotor.current.arrastre?.modo === 'mover' ? 'move' : 'grabbing';
  }

  function alMover(evento) {
    const [x, y] = posicion(evento);
    const motor = refMotor.current;
    if (!motor) return;
    motor.moverPuntero(x, y);
    // al empezar a arrastrar se captura el puntero, así el giro sigue aunque salga del canvas
    if (motor.arrastrar(evento.pointerId, x, y) && !evento.currentTarget.hasPointerCapture(evento.pointerId)) {
      try {
        evento.currentTarget.setPointerCapture(evento.pointerId);
      } catch {
        /* puntero que ya no está activo: se sigue sin capturar */
      }
    }
  }

  function alSubir(evento) {
    const [x, y] = posicion(evento);
    const motor = refMotor.current;
    if (!motor) return;
    // un toque (sin arrastrar) sobre una barra la hace explotar en color
    motor.subirPuntero(evento.pointerId, evento.type === 'pointercancel' ? undefined : x, y);
    if (evento.currentTarget.style.cursor === 'grabbing') evento.currentTarget.style.cursor = motor.cursorActual;
  }

  function alSalir(evento) {
    if (!evento.currentTarget.hasPointerCapture(evento.pointerId)) refMotor.current?.soltarPuntero();
  }

  return (
    <section id="habilidades" ref={refSeccion} className={estilos.seccion} data-webgl={conWebGL} data-listo={listo}>
      <header className={estilos.encabezado}>
        <PanelHabilidades
          alBuscar={(id) => refMotor.current?.enfocar(INDICE.get(id))}
          alLimpiar={() => refMotor.current?.limpiarBusqueda()}
          modo={modo}
          alModo={setModo}
        />
      </header>

      {/* Dock de categorías: pegado abajo a la izquierda de la sección, sin contenedor. */}
      <div className={estilos.dock}>
        <DockCategorias
          categoria={categoria}
          alCategoria={setCategoria}
          alPrevia={(id) => refMotor.current?.previsualizar(id)}
        />
      </div>

      {conWebGL && (
        <div ref={refEscenario} className={estilos.escenario}>
          <canvas
            ref={refLienzo}
            className={estilos.lienzo}
            aria-hidden="true"
            onPointerMove={alMover}
            onPointerDown={alBajar}
            onPointerUp={alSubir}
            onPointerCancel={alSubir}
            onPointerLeave={alSalir}
            onDoubleClick={() => refMotor.current?.restablecerVista()}
          />
          {listo && (
            <div className={estilos.controles} role="group" aria-label="Vista del modelo">
              <button type="button" className={estilos.control} aria-label="Alejar" onClick={() => refMotor.current?.zoomRelativo(1 / 1.5)}>
                −
              </button>
              <button type="button" className={estilos.control} aria-label="Acercar" onClick={() => refMotor.current?.zoomRelativo(1.5)}>
                +
              </button>
              <button type="button" className={estilos.control} aria-label="Restablecer la vista" onClick={() => refMotor.current?.restablecerVista()}>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 12a9 9 0 1 0 3-6.7" />
                  <path d="M3 4v5h5" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Lista real de tecnologías: sin WebGL se ve como píldoras; con WebGL queda para lectores
          de pantalla, y sus logos (los mismos de Proyectos) alimentan el atlas de las barras. */}
      <ul ref={refLogos} className={estilos.lista}>
        {TECNOLOGIAS.map((t) => (
          <li key={t.id} className={estilos.item} data-fuera={Boolean(idsFiltro && !idsFiltro.includes(t.id))}>
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
