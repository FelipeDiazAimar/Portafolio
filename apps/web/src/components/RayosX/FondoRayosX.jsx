'use client';

import { useEffect, useRef, useState } from 'react';
import useTema from '@/hooks/useTema.js';
import useUnionSeccion from '@/hooks/useUnionSeccion.js';
import { esTactil, prefiereMovimientoReducido } from '@/lib/entrada.js';
import { hayWebGL } from '@/components/SobreMi/Escena3D/soporteWebGL.js';
import estilos from './RayosX.module.css';

// Cuánto se desenfoca el fondo cuando el hero ya casi salió de la pantalla.
const DESENFOQUE_MAX_PX = 16;

// Fondo del hero: la escena del demo original, de costado (cuerpos y esqueletos en grilla), con el
// mouse revelando los esqueletos y la cámara acompañándolo. Corre sólo con `activo`.
// `entrada`: dónde estaba el cráneo de la foto (px de la ventana), para que tu esqueleto arranque ahí.
export default function FondoRayosX({ activo, entrada }) {
  const refLienzo = useRef(null);
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
      setVisible(true);
      if (activo) motor.iniciar();
    })();

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

  return <canvas ref={refLienzo} className={estilos.fondo} data-visible={visible} data-rapido={Boolean(entrada)} aria-hidden="true" />;
}
