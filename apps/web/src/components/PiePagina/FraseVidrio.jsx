'use client';

// Pone "Gracias por pasar." en 3D de metal pulido (ver EscenaFrase.js). Sólo se activa donde rinde y
// luce: mouse o trackpad, pantalla ancha, sin reducir movimiento (tema claro u oscuro). En cualquier
// otro caso no hace nada y queda el texto CSS de siempre. Three se baja recién cuando la frase
// está cerca de entrar en pantalla.
import { useEffect, useRef } from 'react';
import { prefiereMovimientoReducido, tieneHoverFino } from '@/lib/entrada.js';
import styles from './CierreFooter.module.css';

const MARGEN_EM = 0.32; // aire alrededor de la tinta para la inclinación, el bisel y la lente
const MOVIMIENTO = { masa: 1.4, tension: 120, friccion: 26 };
const APARICION = { masa: 1, tension: 280, friccion: 28 };
// Cuánto se reveló la frase del cierre (0..1), según el scroll: empieza cuando asoma por abajo y
// termina con la frase entera a la vista (al final de la página). Lo comparten el texto CSS y el 3D.
export function avanceCierre(el) {
  if (!el) return 1;
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight;
  return Math.max(0, Math.min(1, ((vh - r.top) / Math.max(1, r.height)) * 0.92));
}

// Resorte amortiguado de un valor; integración semi-implícita con paso acotado.
class Resorte {
  constructor(valor = 0) {
    this.valor = valor;
    this.meta = valor;
    this.vel = 0;
  }

  paso(dt, { masa, tension, friccion }) {
    let resto = dt;
    while (resto > 0) {
      const h = Math.min(resto, 1 / 120);
      const fuerza = -tension * (this.valor - this.meta) - friccion * this.vel;
      this.vel += (fuerza / masa) * h;
      this.valor += this.vel * h;
      resto -= h;
    }
  }
}

export default function FraseVidrio({ hostRef, fraseRef, onEstado }) {
  const lienzoRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    const frase = fraseRef.current;
    const contenedor = lienzoRef.current;
    if (!host || !frase || !contenedor) return undefined;
    if (prefiereMovimientoReducido() || !tieneHoverFino()) return undefined;
    if (!window.matchMedia('(min-width: 1024px)').matches) return undefined;

    let vivo = true;
    let escena = null;
    let canvas = null;
    let rafId = 0;
    let observador = null;
    let observadorTam = null;
    const limpiezas = [];

    const iniciar = async () => {
      let modulo;
      try {
        modulo = await import('./EscenaFrase.js');
      } catch {
        return;
      }
      if (!vivo) return;

      canvas = document.createElement('canvas');
      canvas.style.display = 'block';
      contenedor.appendChild(canvas);
      try {
        escena = new modulo.EscenaFrase(canvas, {
          crema: '#feeae1',
          azul: '#c0cef2',
          vacio: '#0d0d0d', // el estudio de reflejos es siempre oscuro, sea cual sea el tema de la página
        });
      } catch {
        canvas.remove();
        canvas = null;
        return;
      }

      const total = escena.letras.length;
      const inclX = new Resorte();
      const inclY = new Resorte();
      const hover = new Resorte();
      const punteroX = new Resorte();
      const punteroY = new Resorte();
      const aparicion = Array.from({ length: total }, () => new Resorte(0));
      let mascara = null; // {x, y} suavizado, en px del lienzo
      let objetivoMascara = null;
      let rectLienzo = null;
      let fontPx = 0;
      let enPantalla = false;
      let t0 = performance.now();
      let ultimo = t0;

      const medir = () => {
        fontPx = parseFloat(getComputedStyle(frase).fontSize);
        const { ancho, alto } = escena.medidaTinta(fontPx);
        const margen = MARGEN_EM * fontPx;
        const w = Math.ceil(ancho + margen * 2);
        const h = Math.ceil(alto + margen * 2);
        contenedor.style.width = `${w}px`;
        contenedor.style.height = `${h}px`;
        contenedor.style.left = `${-margen}px`;
        contenedor.style.top = `${(host.clientHeight - h) / 2}px`;
        escena.setLayout({ width: w, height: h, fontPx });
        rectLienzo = null;
        // dónde se dibuja el punto final (relativo a la caja del vidrio): ahí termina la línea del sitio
        const punto = escena.centroUltima(fontPx, w, h);
        if (punto) {
          host.dataset.puntoX = (punto[0] - margen).toFixed(1);
          host.dataset.puntoY = (punto[1] + (host.clientHeight - h) / 2).toFixed(1);
          window.dispatchEvent(new Event('portafolio:linea-editada'));
        }
      };

      const rect = () => (rectLienzo ??= contenedor.getBoundingClientRect());

      const alMover = (e) => {
        if (e.pointerType === 'touch') return;
        const r = rect();
        const dentro = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        if (!dentro) {
          hover.meta = 0;
          inclX.meta = 0;
          inclY.meta = 0;
          return;
        }
        const o = ((e.clientX - r.left) / r.width) * 2 - 1;
        const n = 1 - ((e.clientY - r.top) / r.height) * 2;
        inclX.meta = -0.2 * n;
        inclY.meta = 0.11 * o;
        hover.meta = 1;
        punteroX.meta = o;
        punteroY.meta = n;
        objetivoMascara = { x: e.clientX - r.left, y: e.clientY - r.top };
        mascara ??= { ...objetivoMascara };
      };
      const alSalir = () => {
        hover.meta = 0;
        inclX.meta = 0;
        inclY.meta = 0;
      };
      const invalidarRect = () => {
        rectLienzo = null;
      };
      window.addEventListener('pointermove', alMover, { passive: true });
      document.documentElement.addEventListener('pointerleave', alSalir);
      window.addEventListener('scroll', invalidarRect, { passive: true });
      limpiezas.push(() => {
        window.removeEventListener('pointermove', alMover);
        document.documentElement.removeEventListener('pointerleave', alSalir);
        window.removeEventListener('scroll', invalidarRect);
      });

      const cuadro = (ahora) => {
        rafId = requestAnimationFrame(cuadro);
        const dt = Math.min(0.05, (ahora - ultimo) / 1000);
        ultimo = ahora;

        for (const r of [inclX, inclY, hover, punteroX, punteroY]) r.paso(dt, MOVIMIENTO);
        // glow-up: cada letra aparece según el scroll (y se va al subir), no por tiempo
        const avance = avanceCierre(host);
        aparicion.forEach((r, i) => {
          r.meta = Math.max(0, Math.min(1, avance * (total + 3) - i));
          r.paso(dt, APARICION);
        });
        if (mascara && objetivoMascara) {
          mascara.x += (objetivoMascara.x - mascara.x) * 0.16;
          mascara.y += (objetivoMascara.y - mascara.y) * 0.16;
        }
        escena.render({
          reloj: ((ahora - t0) % modulo.CICLO_MS) / modulo.CICLO_MS,
          inclX: inclX.valor,
          inclY: inclY.valor,
          hover: Math.max(0, Math.min(1, hover.valor)),
          punteroX: punteroX.valor,
          punteroY: punteroY.valor,
          aparicion: aparicion.map((r) => Math.max(0, Math.min(1, r.valor))),
          mascaraX: mascara?.x,
          mascaraY: mascara?.y,
        });
      };

      const arrancar = () => {
        if (rafId) return;
        ultimo = performance.now();
        rafId = requestAnimationFrame(cuadro);
      };
      const parar = () => {
        cancelAnimationFrame(rafId);
        rafId = 0;
      };

      medir();
      escena.render({
        reloj: 0, inclX: 0, inclY: 0, hover: 0, punteroX: 0, punteroY: 0,
        aparicion: aparicion.map(() => 0),
      });

      const alPerderContexto = (e) => {
        e.preventDefault();
        parar();
        onEstado('css');
      };
      canvas.addEventListener('webglcontextlost', alPerderContexto);
      limpiezas.push(() => canvas?.removeEventListener('webglcontextlost', alPerderContexto));

      observadorTam = new ResizeObserver(() => {
        medir();
      });
      observadorTam.observe(host);
      document.fonts?.ready.then(() => vivo && medir());

      observador = new IntersectionObserver(
        ([entrada]) => {
          enPantalla = entrada.isIntersecting;
          if (enPantalla) {
            arrancar();
          } else {
            parar();
          }
        },
        { threshold: [0.05, 0.25] }
      );
      observador.observe(host);
      onEstado('3d');
    };

    // Se arma un poco antes de que aparezca para que no haya parpadeo de texto→3D.
    const cerca = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada.isIntersecting) return;
        cerca.disconnect();
        iniciar();
      },
      { rootMargin: '600px 0px' }
    );
    cerca.observe(host);

    return () => {
      vivo = false;
      cerca.disconnect();
      observador?.disconnect();
      observadorTam?.disconnect();
      cancelAnimationFrame(rafId);
      limpiezas.forEach((f) => f());
      escena?.dispose();
      canvas?.remove();
      onEstado('css');
    };
  }, [hostRef, fraseRef, onEstado]);

  return <div ref={lienzoRef} className={styles.lienzo} aria-hidden="true" />;
}
