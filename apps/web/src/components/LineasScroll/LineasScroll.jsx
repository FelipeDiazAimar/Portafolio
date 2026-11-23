'use client';

// Lienzo fijo de las líneas entre secciones (ver EscenaLineas.js). Un tramo por unión, con los
// presets de lusion.co repartidos. Mide dónde empieza cada sección y rearma las curvas cuando la
// página cambia de alto. Sin WebGL o con movimiento reducido no se monta.
import { useEffect, useRef } from 'react';
import { alCuadro, movimientoReducido, scroll } from '@/lib/movimiento.js';
import { hayWebGL } from '@/lib/soporteWebGL.js';
import { EVENTO_RENDIMIENTO } from '@/lib/rendimiento.js';
import styles from './LineasScroll.module.css';

// [selector de la sección que entra, preset]. La línea cruza la unión con la sección anterior.
const UNIONES = [
  ['#sobre-mi', 'reel'],
  // (Sobre mí → Proyectos no lleva línea: ahí la transición es el puente de las piezas)
  ['#experiencia', 'goal'],
  ['#titulos', 'capability'],
  ['#habilidades', 'reel'],
  ['#contacto', 'goal'],
  ['footer', 'office'],
];

function tema() {
  const t = document.documentElement.getAttribute('data-theme');
  if (t === 'light' || t === 'dark') return t;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function medir() {
  // sólo en la página principal
  if (!document.getElementById('inicio')) return [];
  const y = window.scrollY;
  return UNIONES.map(([sel, preset]) => {
    const nodo = document.querySelector(sel);
    if (!nodo) return null;
    return { preset, J: nodo.getBoundingClientRect().top + y };
  }).filter(Boolean);
}

export default function LineasScroll() {
  const refLienzo = useRef(null);

  useEffect(() => {
    const lienzo = refLienzo.current;
    if (!lienzo || movimientoReducido() || !hayWebGL()) return undefined;
    let escena = null;
    let vivo = true;
    let firma = '';
    let espera = 0;
    let quitarCuadro = null;

    const rearmar = (forzar = false) => {
      if (!escena) return;
      const m = medir();
      const nueva = `${window.innerWidth}x${window.innerHeight}|${tema()}|${m.map((u) => Math.round(u.J)).join(',')}`;
      if (!forzar && nueva === firma) return;
      firma = nueva;
      escena.redimensionar(m);
      escena.cuadro(0, scroll.y || window.scrollY, 0, true);
    };
    const pedir = () => {
      clearTimeout(espera);
      espera = setTimeout(() => rearmar(), 180);
    };

    import('./EscenaLineas.js').then(({ crearEscenaLineas }) => {
      if (!vivo) return;
      escena = crearEscenaLineas({ lienzo, obtenerTema: tema });
      rearmar(true);
      quitarCuadro = alCuadro((dt, s) => escena.cuadro(dt, s.y, s.fuerza));
    });

    const ro = new ResizeObserver(pedir);
    ro.observe(document.body);
    window.addEventListener('resize', pedir);
    window.addEventListener(EVENTO_RENDIMIENTO, pedir);
    const mo = new MutationObserver(() => rearmar(true));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    // las secciones cambian de alto al cargar sus escenas: un repaso tardío
    const tarde = setTimeout(() => rearmar(), 2500);

    return () => {
      vivo = false;
      clearTimeout(espera);
      clearTimeout(tarde);
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener('resize', pedir);
      window.removeEventListener(EVENTO_RENDIMIENTO, pedir);
      quitarCuadro?.();
      escena?.destruir();
    };
  }, []);

  return <canvas ref={refLienzo} className={styles.lienzo} aria-hidden="true" />;
}
