'use client';

import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useMotionValue, useSpring, useTransform } from 'framer-motion';
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

function ItemDock({ mouseX, id, nombre, detalle, icono, texto, elegido, alElegir, alApuntar, i, activo }) {
  const ref = useRef(null);
  const [sobre, setSobre] = useState(false);
  // distancia del mouse al centro del ítem: cuanto más cerca, más grande (la lupa del dock)
  const distancia = useTransform(mouseX, (x) => {
    const caja = ref.current?.getBoundingClientRect();
    return caja ? x - caja.x - caja.width / 2 : 9999;
  });
  const tam = useSpring(useTransform(distancia, [-140, 0, 140], [BASE, MAXIMO, BASE]), { mass: 0.1, stiffness: 190, damping: 13 });

  return (
    <motion.button
      ref={ref}
      type="button"
      className={estilos.item}
      aria-pressed={elegido}
      aria-label={nombre}
      style={{ width: tam, height: tam }}
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
    <motion.div ref={ref} className={estilos.dock} onMouseMove={(e) => mouseX.set(e.clientX)} onMouseLeave={() => mouseX.set(Infinity)} role="group" aria-label="Filtrar por categoría">
      {items.map((item, i) => (
        <ItemDock
          key={item.id ?? 'todas'}
          mouseX={mouseX}
          i={i}
          activo={activo}
          {...item}
          elegido={categoria === item.id}
          alElegir={() => alCategoria(item.id === null || categoria === item.id ? null : item.id)}
          alApuntar={item.id === null ? undefined : alPrevia}
        />
      ))}
    </motion.div>
  );
}
