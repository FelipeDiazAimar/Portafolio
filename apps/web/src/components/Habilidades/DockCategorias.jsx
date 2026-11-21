'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useReducedMotion } from 'framer-motion';
import { CATEGORIAS } from '@/data/categoriasTecnologias.js';
import { listarProyectos } from '@/lib/proyectos.js';
import { usoPorCategoria } from '@/lib/radar.js';
import { IconoTecnologia } from '@/components/Proyectos/iconosTecnologias.jsx';
import useTema from '@/hooks/useTema.js';
import { logoEnRelieve } from './diorama/relieve.js';
import estilos from './Dock.module.css';

// Logo que representa a cada categoría en el dock, con el color de su marca (null = el del texto).
const REPRESENTANTE = {
  lenguajes: { logo: 'typescript', color: '#3178C6' },
  frontend: { logo: 'react', color: '#61DAFB' },
  animacion: { logo: 'threejs', color: null },
  backend: { logo: 'node', color: '#5FA04E' },
  datos: { logo: 'postgresql', color: '#4169E1' },
  ia: { logo: 'gemini', color: '#8E75B2' },
  integraciones: { logo: 'mercadopago', color: '#00B1EA' },
  infra: { logo: 'docker', color: '#2496ED' },
  calidad: { logo: 'vitest', color: '#6E9F18' },
};
const USO = usoPorCategoria(CATEGORIAS, listarProyectos());

// La lupa del dock de macOS (adaptada del demo de GSAP, de Blake Bowen): cada ícono mide BASE
// (con su margen) y el que queda bajo el puntero llega a MAXIMO. Los vecinos crecen según el
// coseno de su distancia y se corren hacia afuera, así nunca se pisan.
const BASE = 48;
const MAXIMO = 104;
const ALCANCE = BASE * Math.PI;

// Dock de categorías: sólo los logos. Tocar uno filtra el modelo (tocarlo de nuevo lo quita);
// pasar el mouse lo previsualiza y muestra su nombre arriba.
export default function DockCategorias({ categoria, alCategoria, alPrevia }) {
  const refDock = useRef(null);
  const refItems = useRef([]);
  const refNombre = useRef(null);
  const [sobre, setSobre] = useState(-1);
  // cada logo en relieve (imagen con su color) y su silueta (para el barrido de luz)
  const [relieves, setRelieves] = useState(null);
  const reducido = useReducedMotion();
  const { tema } = useTema();
  const refTema = useRef(tema);
  refTema.current = tema;
  const items = useMemo(
    () =>
      USO.filter((u) => REPRESENTANTE[u.id]).map((u) => ({
        id: u.id,
        nombre: u.nombre,
        detalle: `${u.tecnologias} tecnologías · ${u.proyectos}/${u.total} proyectos`,
        ...REPRESENTANTE[u.id],
      })),
    []
  );

  // Cada logo en relieve 2D (ver diorama/relieve.js): un bisel suave con el color de su marca, y
  // cada tanto una banda de luz que lo cruza. Se arma a partir del SVG de cada uno (y otra vez si
  // cambia el tema, por los logos sin color propio, que van del color del texto).
  useEffect(() => {
    let cancelado = false;
    const colorTexto = tema === 'light' ? '#14161c' : '#f2f4f8';
    Promise.all(
      items.map((it, i) => {
        const svg = refItems.current[i]?.querySelector('svg')?.outerHTML;
        // a 512 px: con la lupa al máximo (×2,17) y en pantallas de alta densidad, 192 no alcanzaba
        return svg ? logoEnRelieve(svg, it.color ?? colorTexto, 512) : null;
      })
    ).then((lista) => {
      if (!cancelado) setRelieves(lista);
    });
    return () => {
      cancelado = true;
    };
  }, [items, tema]);

  // entrada: los íconos suben escalonados cada vez que se llega a la sección
  useEffect(() => {
    const dock = refDock.current;
    if (!dock) return undefined;
    const iconos = refItems.current.filter(Boolean);
    if (reducido) return undefined;
    gsap.set(iconos, { opacity: 0, y: 28 });
    const o = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) gsap.to(iconos, { opacity: 1, y: 0, duration: 0.7, ease: 'back.out(1.8)', stagger: 0.05, delay: 0.15, overwrite: 'auto' });
        else gsap.set(iconos, { opacity: 0, y: 28 });
      },
      { threshold: 0.1 }
    );
    o.observe(dock);
    return () => o.disconnect();
  }, [reducido]);

  // la lupa: `puntero` es la x dentro de la fila de íconos (null = afuera)
  const lupa = (mouse) => {
    const iconos = refItems.current;
    const calcular = (puntero) => {
      const destinos = [];
      for (let i = 0; i < iconos.length; i++) {
        let x = 0;
        let escala = 1;
        if (puntero !== null && !reducido) {
          const distancia = i * BASE + BASE / 2 - puntero;
          if (-ALCANCE < distancia && distancia < ALCANCE) {
            const rad = (distancia / BASE) * 0.5;
            escala = 1 + (MAXIMO / BASE - 1) * Math.cos(rad);
            x = 2 * (MAXIMO - BASE) * Math.sin(rad);
          } else {
            x = (distancia > 0 ? 2 : -2) * (MAXIMO - BASE);
          }
        }
        destinos.push({ x, escala });
      }
      // El demo va centrado y crece para los dos lados; este dock está pegado al borde izquierdo:
      // se corre todo para que el borde izquierdo del primer ícono quede quieto y crezca hacia la
      // derecha (si no, los primeros se salían de la pantalla).
      const primero = destinos[0];
      const corrimiento = primero && puntero !== null ? Math.max(0, (primero.escala - 1) * 20 - primero.x) : 0;
      return { destinos, corrimiento };
    };
    // Corrida la fila, la lupa quedaría a la derecha del mouse: se busca el puntero que, ya
    // corrido, cae justo debajo (converge en pocas vueltas).
    let puntero = mouse;
    let r = calcular(puntero);
    for (let k = 0; mouse !== null && k < 5; k++) {
      puntero = mouse - r.corrimiento;
      r = calcular(puntero);
    }
    const { destinos, corrimiento } = r;
    destinos.forEach(({ x, escala }, i) => {
      if (!iconos[i]) return;
      gsap.to(iconos[i], { duration: 0.3, x: x + corrimiento, scale: escala, overwrite: 'auto', ease: 'power2.out', onUpdate: i === sobreRef.current ? ubicarNombre : undefined });
    });
  };
  const sobreRef = useRef(-1);
  sobreRef.current = sobre;

  // el nombre va arriba del ícono agrandado (fuera de él, para no escalar con la lupa)
  const ubicarNombre = () => {
    const i = sobreRef.current;
    const icono = refItems.current[i];
    const nombre = refNombre.current;
    const dock = refDock.current;
    if (!icono || !nombre || !dock) return;
    const a = icono.getBoundingClientRect();
    const b = dock.getBoundingClientRect();
    nombre.style.transform = `translate(${(a.left + a.width / 2 - b.left).toFixed(1)}px, ${(a.top - b.top - 10).toFixed(1)}px) translate(-50%, -100%)`;
  };
  useEffect(() => {
    if (sobre >= 0) ubicarNombre();
  }, [sobre]);

  const xEnFila = (clientX) => {
    const dock = refDock.current;
    const primero = refItems.current[0];
    if (!dock || !primero) return null;
    return clientX - (dock.getBoundingClientRect().left + primero.offsetLeft - dock.scrollLeft);
  };

  return (
    <div
      ref={refDock}
      className={estilos.dock}
      data-dioramas={Boolean(relieves)}
      onMouseMove={(e) => lupa(xEnFila(e.clientX))}
      onMouseLeave={() => lupa(null)}
      // Táctil: la lupa sigue al dedo mientras está apoyado, también cuando desliza el carrusel.
      onTouchStart={(e) => lupa(xEnFila(e.touches[0].clientX))}
      onTouchMove={(e) => lupa(xEnFila(e.touches[0].clientX))}
      onTouchEnd={() => lupa(null)}
      onTouchCancel={() => lupa(null)}
      role="group"
      aria-label="Filtrar por categoría"
    >
      {items.map((item, i) => (
        <button
          key={item.id}
          ref={(el) => (refItems.current[i] = el)}
          type="button"
          className={estilos.item}
          style={item.color ? { '--marca': item.color } : undefined}
          aria-pressed={categoria === item.id}
          aria-label={`${item.nombre}: ${item.detalle}`}
          onClick={() => alCategoria(categoria === item.id ? null : item.id)}
          onMouseEnter={() => {
            setSobre(i);
            alPrevia?.(item.id);
          }}
          onMouseLeave={() => {
            setSobre(-1);
            alPrevia?.(null);
          }}
          onFocus={() => {
            setSobre(i);
            alPrevia?.(item.id);
          }}
          onBlur={() => {
            setSobre(-1);
            alPrevia?.(null);
          }}
        >
          <IconoTecnologia id={item.logo} className={estilos.icono} />
          {relieves?.[i] ? (
            <span
              className={estilos.relieve}
              style={{ backgroundImage: `url(${relieves[i].color})`, '--mascara': `url(${relieves[i].mascara})`, '--retraso': `${(i * 0.83) % 6}s` }}
              aria-hidden="true"
            >
              <span className={estilos.barrido} />
            </span>
          ) : null}
          <span className={estilos.punto} aria-hidden="true" />
        </button>
      ))}
      <span ref={refNombre} className={estilos.nombre} data-visible={sobre >= 0} aria-hidden="true">
        {sobre >= 0 ? (
          <>
            <strong>{items[sobre].nombre}</strong>
            <span>{items[sobre].detalle}</span>
          </>
        ) : null}
      </span>
    </div>
  );
}
