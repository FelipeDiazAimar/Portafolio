'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useMotionValue, useMotionValueEvent, useSpring, useTransform } from 'framer-motion';
import { CATEGORIAS } from '@/data/categoriasTecnologias.js';
import { TECNOLOGIAS } from '@/data/tecnologias.js';
import { listarProyectos } from '@/lib/proyectos.js';
import { usoPorCategoria } from '@/lib/radar.js';
import { IconoTecnologia } from '@/components/Proyectos/iconosTecnologias.jsx';
import estilos from './Dock.module.css';

// Logo que representa a cada categoría en el dock.
const REPRESENTANTE = {
  lenguajes: 'typescript',
  frontend: 'react',
  animacion: 'threejs',
  backend: 'node',
  datos: 'postgresql',
  ia: 'gemini',
  integraciones: 'mercadopago',
  infra: 'docker',
  calidad: 'vitest',
};
const USO = usoPorCategoria(CATEGORIAS, listarProyectos());
const BASE = 42;
const MAXIMO = 76;

// En pantallas chicas los íconos son chicos (entran los 10 en una fila): la lupa no cambia el ancho
// —no hay lugar— sino la escala, desde el borde de abajo, hasta ESCALA_TACTIL veces.
const ESCALA_TACTIL = 2.1;

function ItemDock({ mouseX, id, nombre, detalle, icono, texto, elegido, alElegir, alApuntar, i, activo, chico, tocando }) {
  const ref = useRef(null);
  const [sobre, setSobre] = useState(false);
  const refSobre = useRef(false);
  // distancia del mouse al centro del ítem: cuanto más cerca, más grande (la lupa del dock)
  const distancia = useTransform(mouseX, (x) => {
    const caja = ref.current?.getBoundingClientRect();
    return caja ? x - caja.x - caja.width / 2 : 9999;
  });
  const tam = useSpring(useTransform(distancia, [-140, 0, 140], [BASE, MAXIMO, BASE]), { mass: 0.1, stiffness: 190, damping: 13 });
  // la lupa con el dedo: la escala crece más ancha de rango (el dedo tapa el ícono: se ve el vecino)
  const escala = useSpring(useTransform(distancia, [-84, 0, 84], [1, ESCALA_TACTIL, 1]), { mass: 0.1, stiffness: 190, damping: 13 });
  const escalaInversa = useTransform(escala, (v) => 1 / v);
  // con el dedo no hay "hover": el ícono que queda bajo el dedo hace de hover (cartel y vista previa)
  useMotionValueEvent(distancia, 'change', (d) => {
    if (!tocando) return;
    const ancho = ref.current?.getBoundingClientRect().width || 1;
    const dentro = Math.abs(d) < ancho * 0.6 * (chico ? 1 : 1);
    if (dentro === refSobre.current) return;
    refSobre.current = dentro;
    setSobre(dentro);
    alApuntar?.(dentro ? id : null);
  });
  return (
    <motion.button
      ref={ref}
      type="button"
      className={estilos.item}
      aria-pressed={elegido}
      aria-label={nombre}
      style={chico ? { scale: escala, originX: 0.5, originY: 1 } : { width: tam, height: tam }}
      initial={{ opacity: 0, y: 24, scale: 0.6 }}
      animate={activo ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 24, scale: 0.6 }}
      transition={{ delay: activo ? 0.2 + i * 0.05 : 0, type: 'spring', stiffness: 400, damping: 20 }}
      whileTap={{ scale: 0.9 }}
      onClick={alElegir}
      onMouseEnter={() => {
        setSobre(true);
        alApuntar?.(id);
      }}
      onMouseLeave={() => {
        setSobre(false);
        alApuntar?.(null);
      }}
      onFocus={() => {
        setSobre(true);
        alApuntar?.(id);
      }}
      onBlur={() => {
        setSobre(false);
        alApuntar?.(null);
      }}
    >
      {elegido && <span className={estilos.brillo} aria-hidden="true" />}
      {icono ? <IconoTecnologia id={icono} className={estilos.icono} /> : <span className={estilos.texto}>{texto}</span>}
      <AnimatePresence>
        {sobre && (
          <motion.span
            className={estilos.tip}
            style={chico ? { scale: escalaInversa, originX: 0.5, originY: 1 } : undefined}
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.9 }}
            transition={{ duration: 0.15 }}
          >
            <strong>{nombre}</strong>
            <span>{detalle}</span>
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// Dock de categorías: una fila de íconos, sin contenedor, que se agranda con la lupa al acercar el
// mouse (como el dock de macOS). Tocar uno filtra el modelo; pasar el mouse lo previsualiza.
export default function DockCategorias({ categoria, alCategoria, alPrevia }) {
  const mouseX = useMotionValue(Infinity);
  const ref = useRef(null);
  // pantalla chica (ver Dock.module.css): íconos que entran en una fila y lupa por escala
  const [chico, setChico] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const leer = () => setChico(mq.matches);
    leer();
    mq.addEventListener('change', leer);
    return () => mq.removeEventListener('change', leer);
  }, []);
  // dedo apoyado en el dock: la lupa lo sigue (mientras se mantiene y se desliza)
  const [tocando, setTocando] = useState(false);
  const refInicio = useRef(null);
  const alTocar = (e) => {
    if (e.pointerType === 'mouse') return;
    refInicio.current = { x: e.clientX, y: e.clientY, movido: false };
    setTocando(true);
    mouseX.set(e.clientX);
  };
  const alDeslizar = (e) => {
    if (e.pointerType === 'mouse' || !refInicio.current) return;
    if (Math.hypot(e.clientX - refInicio.current.x, e.clientY - refInicio.current.y) > 8) refInicio.current.movido = true;
    mouseX.set(e.clientX);
  };
  const alSoltar = (e) => {
    if (e.pointerType === 'mouse' || !refInicio.current) return;
    const { movido } = refInicio.current;
    refInicio.current = null;
    mouseX.set(Infinity);
    setTocando(false);
    // si se deslizó, el clic no llega al ícono elegido: se elige el que quedó bajo el dedo
    if (movido && e.type === 'pointerup') {
      const bajoElDedo = document.elementFromPoint(e.clientX, e.clientY)?.closest('button');
      if (bajoElDedo && ref.current?.contains(bajoElDedo)) bajoElDedo.click();
    }
    alPrevia?.(null);
  };
  // los íconos vuelven a entrar cada vez que se llega a la sección
  const activo = useInView(ref, { amount: 0.1 });
  const items = useMemo(
    () => [
      { id: null, nombre: 'Todas', detalle: `${TECNOLOGIAS.length} tecnologías`, texto: String(TECNOLOGIAS.length) },
      ...USO.map((u) => ({ id: u.id, nombre: u.nombre, detalle: `${u.tecnologias} tecnologías · ${u.proyectos}/${u.total} proyectos`, icono: REPRESENTANTE[u.id] })),
    ],
    []
  );

  return (
    <motion.div
      ref={ref}
      className={estilos.dock}
      onMouseMove={(e) => mouseX.set(e.clientX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      onPointerDown={alTocar}
      onPointerMove={alDeslizar}
      onPointerUp={alSoltar}
      onPointerCancel={alSoltar}
      role="group"
      aria-label="Filtrar por categoría"
    >
      {items.map((item, i) => (
        <ItemDock
          key={item.id ?? 'todas'}
          mouseX={mouseX}
          i={i}
          activo={activo}
          chico={chico}
          tocando={tocando}
          {...item}
          elegido={categoria === item.id}
          alElegir={() => alCategoria(item.id === null || categoria === item.id ? null : item.id)}
          alApuntar={item.id === null ? undefined : alPrevia}
        />
      ))}
    </motion.div>
  );
}
