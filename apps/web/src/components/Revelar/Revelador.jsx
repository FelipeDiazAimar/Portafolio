'use client';

// Apariciones atadas al scroll en todo el sitio. Nada corre por tiempo: cada elemento marcado con
// `data-revelar` se construye mientras entra en pantalla y se deconstruye al volver (scrub), y si
// lleva `data-revelar-salida` también se desarma al irse por arriba.
//
// Modos (`data-revelar`):
//   letras | palabras  sube cada unidad de un <TextoPartido> desde su máscara, escalonadas
//   subir              sube, aparece y se enfoca
//   tarjeta            se abre con un recorte redondeado y crece un poco
//   media              recorte de abajo hacia arriba + la imagen/video de adentro se desinfla
//   linea              se traza de izquierda a derecha (divisores, reglas)
//   grupo              sus hijos (o los `[data-revelar-hijo]`) suben escalonados
// Opciones:
//   data-revelar-en="seccion"  el disparador es la <section> que lo contiene (contenido sticky)
//   data-revelar-desde / -hasta  inicio y fin del tramo (sintaxis de ScrollTrigger)
//   data-revelar-salida        se desarma al salir por arriba (sube y se desvanece)
//   data-parallax="0.12"       desplazamiento vertical mientras cruza la pantalla (fracción)
//
// Además escribe `--ola` (−1..1) en <html> con la velocidad del scroll: `[data-ola]` se inclina y
// estira un poco en un scroll rápido (el "wave" de las imágenes de Lusion).
import { useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { alCuadro, movimientoReducido } from '@/lib/movimiento.js';

gsap.registerPlugin(ScrollTrigger);

const SCRUB = 0.7;

function disparador(el) {
  if (el.dataset.revelarEn === 'seccion') return el.closest('section') ?? el;
  return el;
}

function rango(el, enSeccion) {
  return {
    start: el.dataset.revelarDesde || (enSeccion ? 'top 80%' : 'top 94%'),
    end: el.dataset.revelarHasta || (enSeccion ? 'top 10%' : 'top 58%'),
  };
}

function armar(el) {
  const modo = el.dataset.revelar;
  const enSeccion = el.dataset.revelarEn === 'seccion';
  const trigger = disparador(el);
  const { start, end } = rango(el, enSeccion);
  const st = { trigger, start, end, scrub: SCRUB, invalidateOnRefresh: true };
  const animaciones = [];

  if (modo === 'letras' || modo === 'palabras') {
    const unidades = el.querySelectorAll('.rv-i');
    if (unidades.length) {
      animaciones.push(
        gsap.fromTo(
          unidades,
          { yPercent: 118, rotate: modo === 'letras' ? 9 : 4, opacity: 0.001 },
          {
            yPercent: 0,
            rotate: 0,
            opacity: 1,
            ease: 'power3.out',
            stagger: { amount: modo === 'letras' ? 0.55 : 0.4 },
            scrollTrigger: st,
          }
        )
      );
    }
  } else if (modo === 'subir') {
    animaciones.push(
      gsap.fromTo(el, { y: 56, opacity: 0, filter: 'blur(10px)' }, { y: 0, opacity: 1, filter: 'blur(0px)', ease: 'power2.out', scrollTrigger: st })
    );
  } else if (modo === 'tarjeta') {
    animaciones.push(
      gsap.fromTo(
        el,
        { clipPath: 'inset(22% 12% 22% 12% round 36px)', scale: 0.9, y: 70, opacity: 0.2 },
        { clipPath: 'inset(0% 0% 0% 0% round 0px)', scale: 1, y: 0, opacity: 1, ease: 'power3.out', scrollTrigger: st, clearProps: 'clipPath' }
      )
    );
  } else if (modo === 'media') {
    const interior = el.querySelector('img, video, canvas, [data-revelar-interior]');
    animaciones.push(gsap.fromTo(el, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'power3.inOut', scrollTrigger: st }));
    if (interior) {
      animaciones.push(gsap.fromTo(interior, { scale: 1.35 }, { scale: 1, ease: 'power3.out', scrollTrigger: { ...st } }));
    }
  } else if (modo === 'linea') {
    animaciones.push(gsap.fromTo(el, { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, ease: 'power2.inOut', scrollTrigger: st }));
  } else if (modo === 'grupo') {
    const marcados = el.querySelectorAll('[data-revelar-hijo]');
    const hijos = marcados.length ? marcados : el.children;
    if (hijos.length) {
      animaciones.push(
        gsap.fromTo(
          hijos,
          { y: 44, opacity: 0, filter: 'blur(6px)' },
          { y: 0, opacity: 1, filter: 'blur(0px)', ease: 'power2.out', stagger: { amount: 0.45 }, scrollTrigger: st }
        )
      );
    }
  }

  if (el.dataset.revelarSalida !== undefined) {
    // Se desarma al irse: sube, se achica y (si la entrada no maneja su opacidad) se desvanece.
    // Va en `--rv-s` (CSS: translate/scale sueltos, ver globals.css) para no pisar el transform de
    // la entrada.
    const seccion = el.closest('section') ?? el;
    const propia = modo === 'subir' || modo === 'tarjeta';
    el.classList.add('rv-salida');
    animaciones.push(
      gsap.fromTo(
        el,
        { '--rv-s': 0, ...(propia ? {} : { opacity: 1 }) },
        {
          '--rv-s': 1,
          ...(propia ? {} : { opacity: 0 }),
          ease: 'power1.in',
          immediateRender: false,
          scrollTrigger: { trigger: seccion, start: 'bottom 70%', end: 'bottom 12%', scrub: SCRUB, invalidateOnRefresh: true },
        }
      )
    );
  }

  if (el.dataset.parallax) {
    const k = parseFloat(el.dataset.parallax) || 0.1;
    const objetivo = el.querySelector('img, video, [data-revelar-interior]') ?? el;
    animaciones.push(
      gsap.fromTo(
        objetivo,
        { yPercent: -k * 100 },
        { yPercent: k * 100, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } }
      )
    );
  }

  return animaciones;
}

export default function Revelador() {
  useEffect(() => {
    if (movimientoReducido()) {
      document.documentElement.classList.add('rv-quieto');
      return () => document.documentElement.classList.remove('rv-quieto');
    }
    const vivos = new Map(); // elemento → animaciones
    let espera = 0;

    const escanear = () => {
      espera = 0;
      let cambios = false;
      vivos.forEach((anims, el) => {
        if (!el.isConnected) {
          anims.forEach((a) => {
            a.scrollTrigger?.kill();
            a.kill();
          });
          vivos.delete(el);
          cambios = true;
        }
      });
      document.querySelectorAll('[data-revelar], [data-parallax]').forEach((el) => {
        if (vivos.has(el)) return;
        vivos.set(el, armar(el));
        cambios = true;
      });
      if (cambios) ScrollTrigger.refresh();
    };
    const pedir = () => {
      if (!espera) espera = window.setTimeout(escanear, 120);
    };
    escanear();
    const mo = new MutationObserver(pedir);
    mo.observe(document.body, { childList: true, subtree: true });

    // "wave" por velocidad
    const raiz = document.documentElement;
    let ultimo = 0;
    const quitar = alCuadro((_dt, s) => {
      const ola = Math.max(-1, Math.min(1, s.vel / 60));
      const redondeado = Math.round(ola * 200) / 200;
      if (redondeado !== ultimo) {
        ultimo = redondeado;
        raiz.style.setProperty('--ola', String(redondeado));
      }
    });

    return () => {
      clearTimeout(espera);
      mo.disconnect();
      quitar();
      vivos.forEach((anims) =>
        anims.forEach((a) => {
          a.scrollTrigger?.kill();
          a.kill();
        })
      );
      raiz.style.removeProperty('--ola');
    };
  }, []);
  return null;
}
