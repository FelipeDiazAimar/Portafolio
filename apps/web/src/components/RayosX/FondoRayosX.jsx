'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import useTema from '@/hooks/useTema.js';
import useUnionSeccion from '@/hooks/useUnionSeccion.js';
import { esTactil, prefiereMovimientoReducido } from '@/lib/entrada.js';
import { hayWebGL } from '@/lib/soporteWebGL.js';
import estilos from './RayosX.module.css';

// Cuánto se desenfoca el fondo cuando el hero ya casi salió de la pantalla.
const DESENFOQUE_MAX_PX = 16;

// Fondo del hero: la escena del demo original, de costado (cuerpos y esqueletos en grilla), con el
// mouse revelando los esqueletos y la cámara acompañándolo. Corre sólo con `activo`.
// `entrada`: dónde estaba el cráneo de la foto (px de la ventana), para que tu esqueleto arranque ahí.
// Al estar listo, aparece con una onda de rayos X que nace en ese cráneo y barre la pantalla: los
// esqueletos se revelan según su distancia, y el borde de la onda brilla. `alListo` avisa cuando
// arranca (recién ahí la foto se funde: antes, mientras cargaban los modelos, quedaba un vacío).
export default function FondoRayosX({ activo, entrada, alListo }) {
  const refLienzo = useRef(null);
  const refOnda = useRef(null);
  const refAlListo = useRef(alListo);
  refAlListo.current = alListo;
  const refMotor = useRef(null);
  // el borde de abajo del fondo se funde con la página (y con Sobre mí) a medida que se hace scroll,
  // y además se desenfoca (ver más abajo): la unión no tiene que notarse
  useUnionSeccion(refLienzo, { arriba: false, fraccion: 0.9 });
  const [visible, setVisible] = useState(false);
  const { tema } = useTema();
  const refTema = useRef(tema);
  refTema.current = tema;

  useEffect(() => {
    if (!hayWebGL()) return undefined;
    const lienzo = refLienzo.current;
    let cancelado = false;
    let motor = null;
    let observador = null;
    const alMover = (e) => motor?.moverPuntero(e.clientX / window.innerWidth, e.clientY / window.innerHeight, true);

    (async () => {
      const { EscenaRayosX } = await import('./EscenaRayosX.js');
      if (cancelado) return;
      try {
        const caja = lienzo.getBoundingClientRect();
        motor = new EscenaRayosX(lienzo, 'fondo', {
          tema: refTema.current,
          reducido: prefiereMovimientoReducido(),
          tactil: esTactil(),
          entrada: entrada ? { x: entrada.x - caja.left, y: entrada.y - caja.top, alto: entrada.alto } : null,
        });
      } catch (error) {
        console.error('[RayosX] sin fondo', error);
        return;
      }
      refMotor.current = motor;
      const medir = () => {
        const caja = lienzo.getBoundingClientRect();
        motor.redimensionar(Math.max(1, Math.round(caja.width)), Math.max(1, Math.round(caja.height)));
      };
      medir();
      observador = new ResizeObserver(medir);
      observador.observe(lienzo);
      await motor.listo;
      if (cancelado) return;
      if (activo) motor.iniciar();
      // un cuadro dibujado antes de mostrarlo: la onda revela la escena ya armada
      await new Promise((resolver) => requestAnimationFrame(() => requestAnimationFrame(resolver)));
      if (cancelado) return;
      revelar();
      setVisible(true);
      refAlListo.current?.();
    })();

    // La onda: un círculo que crece desde el cráneo con el borde difuso (máscara del lienzo) y un
    // anillo de luz encima. Con movimiento reducido, sólo el fundido.
    let ola = null;
    function revelar() {
      const onda = refOnda.current;
      if (prefiereMovimientoReducido() || !onda) return;
      const caja = lienzo.getBoundingClientRect();
      const ox = entrada?.alto ? entrada.x - caja.left : caja.width / 2;
      const oy = entrada?.alto ? entrada.y - caja.top : caja.height * 0.45;
      const radio = Math.hypot(Math.max(ox, caja.width - ox), Math.max(oy, caja.height - oy)) + 220;
      onda.style.setProperty('--ola-x', `${ox.toFixed(0)}px`);
      onda.style.setProperty('--ola-y', `${oy.toFixed(0)}px`);
      onda.dataset.ola = 'true';
      // el lienzo ya lleva en línea la máscara de la unión con Sobre mí (useUnionSeccion): durante
      // la onda van las dos juntas (se intersectan) y al terminar queda sólo la de la unión
      const union = lienzo.style.maskImage;
      const estado = { r: 0 };
      const pintar = () => {
        const r = `${estado.r.toFixed(1)}px`;
        onda.style.setProperty('--ola-r', r);
        const circulo = `radial-gradient(circle at ${ox.toFixed(0)}px ${oy.toFixed(0)}px, #000 ${Math.max(0, estado.r - 180).toFixed(1)}px, transparent ${r})`;
        const mascara = union ? `${circulo}, ${union}` : circulo;
        lienzo.style.webkitMaskImage = mascara;
        lienzo.style.maskImage = mascara;
        lienzo.style.webkitMaskComposite = 'source-in';
        lienzo.style.maskComposite = 'intersect';
      };
      const terminar = () => {
        lienzo.style.webkitMaskImage = union;
        lienzo.style.maskImage = union;
        lienzo.style.webkitMaskComposite = '';
        lienzo.style.maskComposite = '';
      };
      pintar();
      ola = gsap
        .timeline({
          onComplete: () => {
            terminar();
            delete onda.dataset.ola;
          },
        })
        // arranca despacio (tu esqueleto se asoma primero) y se acelera hacia los bordes
        .to(estado, { r: radio, duration: 2.1, ease: 'power2.in', onUpdate: pintar }, 0)
        .to(onda, { opacity: 0, duration: 0.5, ease: 'power1.out' }, 1.75);
    }

    // desenfoque que crece con el scroll: en reposo es 0 (no se toca el canvas), y al irse el hero
    // los esqueletos se vuelven manchas que se funden con Sobre mí
    let cuadroBlur = 0;
    const ponerBlur = () => {
      cuadroBlur = 0;
      const avance = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 0.85)));
      lienzo.style.setProperty('--desenfoque', `${(avance ** 1.4 * DESENFOQUE_MAX_PX).toFixed(1)}px`);
    };
    const alScroll = () => {
      if (!cuadroBlur) cuadroBlur = requestAnimationFrame(ponerBlur);
    };
    ponerBlur();
    window.addEventListener('scroll', alScroll, { passive: true });

    window.addEventListener('pointermove', alMover, { passive: true });
    return () => {
      cancelado = true;
      ola?.kill();
      cancelAnimationFrame(cuadroBlur);
      window.removeEventListener('scroll', alScroll);
      window.removeEventListener('pointermove', alMover);
      observador?.disconnect();
      motor?.liberar();
      refMotor.current = null;
    };
    // el motor se arma una vez; `activo` sólo lo pausa o lo reanuda (efecto de abajo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const motor = refMotor.current;
    if (!motor) return;
    if (activo) motor.iniciar();
    else motor.pausar();
  }, [activo, visible]);

  useEffect(() => {
    refMotor.current?.aplicarTema(tema);
  }, [tema]);

  return (
    <>
      <canvas ref={refLienzo} className={estilos.fondo} data-visible={visible} data-rapido={Boolean(entrada)} aria-hidden="true" />
      <div ref={refOnda} className={estilos.onda} aria-hidden="true" />
    </>
  );
}
