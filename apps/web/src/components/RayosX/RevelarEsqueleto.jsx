'use client';

import { useEffect, useRef } from 'react';
import useTema from '@/hooks/useTema.js';
import { crearAcumulador } from '@/lib/rayosx.js';
import { hayWebGL } from '@/components/SobreMi/Escena3D/soporteWebGL.js';
import { DISPARO_FONDO_MS, RETRATO } from './config.js';
import estilos from './RayosX.module.css';

// Sobre la foto del hero: debajo de donde pasa el mouse aparece un esqueleto de frente, como en
// una radiografía. Lo revelado queda (y su borde se mueve). Con el cursor 4 s encima de la foto
// (acumulados), avisa con `alDisparar` para pasar todo el hero al fondo de esqueletos.
// El hero no recibe eventos (`pointer-events: none`), así que se escucha en `window` y se compara
// con el rect del marco, igual que hacía el hover del ASCII.
// `foto`: la imagen ya cargada (la de la intro) o su url. `alDisparar({ x, y, alto })` recibe dónde
// está el cráneo en la pantalla, para que el fondo arranque con tu esqueleto ahí.
export default function RevelarEsqueleto({ refMarco, foto, activo, alDisparar }) {
  const refLienzo = useRef(null);
  const refMotor = useRef(null);
  const refAlDisparar = useRef(alDisparar);
  refAlDisparar.current = alDisparar;
  const { tema } = useTema();
  const refTema = useRef(tema);
  refTema.current = tema;

  useEffect(() => {
    if (!activo || !hayWebGL()) return undefined;
    const lienzo = refLienzo.current;
    const marco = refMarco.current;
    if (!lienzo || !marco) return undefined;
    let cancelado = false;
    let motor = null;
    let observador = null;
    const acumulador = crearAcumulador(DISPARO_FONDO_MS);
    const estado = { adentro: false };

    function evaluar(x, y) {
      const rect = marco.getBoundingClientRect();
      const adentro = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      estado.adentro = adentro;
      motor?.moverPuntero((x - rect.left) / Math.max(1, rect.width), (y - rect.top) / Math.max(1, rect.height), adentro);
    }
    const alMover = (e) => evaluar(e.clientX, e.clientY);
    const alSalir = () => {
      estado.adentro = false;
      motor?.moverPuntero(0.5, 0.5, false);
    };

    (async () => {
      const { EscenaRayosX } = await import('./EscenaRayosX.js');
      if (cancelado) return;
      try {
        motor = new EscenaRayosX(lienzo, 'retrato', {
          tema: refTema.current,
          foto,
          alCuadro: (dtMs) => {
            if (acumulador.sumar(dtMs, estado.adentro)) {
              const r = marco.getBoundingClientRect();
              const c = RETRATO.calibracion;
              refAlDisparar.current?.({ x: r.left + c.centroX * r.width, y: r.top + c.centroY * r.height, alto: c.alto * r.height });
            }
          },
        });
      } catch (error) {
        console.error('[RayosX] sin revelado', error);
        return;
      }
      refMotor.current = motor;
      const medir = () => {
        const caja = marco.getBoundingClientRect();
        motor.redimensionar(Math.max(1, Math.round(caja.width)), Math.max(1, Math.round(caja.height)));
      };
      medir();
      observador = new ResizeObserver(medir);
      observador.observe(marco);
      await motor.listo;
      if (!cancelado) motor.iniciar();
    })();

    window.addEventListener('pointermove', alMover, { passive: true });
    window.addEventListener('pointerdown', alMover, { passive: true });
    document.addEventListener('mouseleave', alSalir);
    return () => {
      cancelado = true;
      window.removeEventListener('pointermove', alMover);
      window.removeEventListener('pointerdown', alMover);
      document.removeEventListener('mouseleave', alSalir);
      observador?.disconnect();
      motor?.liberar();
      refMotor.current = null;
    };
  }, [activo, refMarco, foto]);

  useEffect(() => {
    refMotor.current?.aplicarTema(tema);
  }, [tema]);

  return <canvas ref={refLienzo} className={estilos.retrato} aria-hidden="true" />;
}
