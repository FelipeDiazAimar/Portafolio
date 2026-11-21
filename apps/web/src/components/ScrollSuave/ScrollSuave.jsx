'use client';

// Scroll suave en todo el sitio (Lenis), sólo con rueda / trackpad: el dedo en celular sigue
// siendo nativo, y con movimiento reducido no se monta.
//
// El sitio ya maneja el scroll en varios lugares (imán de secciones, embudo, menú que
// teletransporta, la puerta a Proyectos que traba la página). Para convivir con eso:
// - Un gesto que otro ya frenó (preventDefault, p. ej. trabarScroll o la marquesina 3D) no
//   lo toma Lenis.
// - Si alguien mueve la página por su cuenta (window.scrollTo / scrollBy), Lenis suelta la
//   animación en curso y se sincroniza, en vez de pelear por la posición. Los pedidos
//   'smooth' los hace Lenis mismo, así todos los desplazamientos tienen la misma curva.
// - Los paneles con scroll propio (overflow: auto) siguen scrolleando adentro.
import { useEffect } from 'react';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import 'lenis/dist/lenis.css';

export default function ScrollSuave() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const lenis = new Lenis({
      autoRaf: false,
      lerp: 0.1,
      wheelMultiplier: 1,
      smoothWheel: true,
      syncTouch: false,
      allowNestedScroll: true,
      virtualScroll: ({ event }) => !event.defaultPrevented,
    });
    window.__lenis = lenis;

    // lo que mueve Lenis no se intercepta; lo de los demás, sí
    let propio = false;
    const setScroll = lenis.setScroll.bind(lenis);
    lenis.setScroll = (valor) => {
      propio = true;
      try {
        setScroll(valor);
      } finally {
        propio = false;
      }
    };
    const scrollTo = window.scrollTo;
    const scrollBy = window.scrollBy;
    const destino = (args, base) => {
      if (typeof args[0] === 'object' && args[0] !== null) return { top: args[0].top, suave: args[0].behavior === 'smooth' };
      return { top: args[1], suave: false, base };
    };
    window.scrollTo = function (...args) {
      if (propio) return scrollTo.apply(this, args);
      const { top, suave } = destino(args);
      if (suave && Number.isFinite(top)) {
        lenis.scrollTo(top, { duration: 1, easing: (t) => 1 - Math.pow(1 - t, 3) });
        return undefined;
      }
      lenis.reset();
      return scrollTo.apply(this, args);
    };
    window.scrollBy = function (...args) {
      if (propio) return scrollBy.apply(this, args);
      const { top, suave } = destino(args);
      if (suave && Number.isFinite(top)) {
        lenis.scrollTo(window.scrollY + top, { duration: 1, easing: (t) => 1 - Math.pow(1 - t, 3) });
        return undefined;
      }
      lenis.reset();
      return scrollBy.apply(this, args);
    };

    // un solo reloj: el de GSAP, así ScrollTrigger lee la posición del mismo cuadro
    lenis.on('scroll', ScrollTrigger.update);
    const tic = (tiempo) => lenis.raf(tiempo * 1000);
    gsap.ticker.add(tic);

    return () => {
      gsap.ticker.remove(tic);
      window.scrollTo = scrollTo;
      window.scrollBy = scrollBy;
      lenis.destroy();
      delete window.__lenis;
    };
  }, []);
  return null;
}
