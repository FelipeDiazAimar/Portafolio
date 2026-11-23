'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { preload } from 'react-dom';
import FondoUnicorn, { puedeMostrarUnicorn, SDK_UNICORN, ESCENA_AURORA } from '@/components/FondoUnicorn/FondoUnicorn.jsx';
import { UBICACION_AURORA, ubicacionAurora } from '@/lib/aurora.js';
import { bienvenidaTerminada, terminarBienvenida } from '@/lib/bienvenida.js';
import { prefiereMovimientoReducido } from '@/lib/entrada.js';
import { EVENTO_RENDIMIENTO } from '@/lib/rendimiento.js';
import styles from './Bienvenida.module.css';

// Lo que tarda la portada en subir (igual que la transición de .saliendo en el CSS).
const SALIDA_MS = 1000;
const SALIDA_REDUCIDA_MS = 350;
// Con la aurora de fondo (src/lib/aurora.js): primero la aurora sola (AURORA_SOLA_MS) y después
// entra el texto. Si la escena no llega en AURORA_TOPE_MS, el texto entra igual.
const AURORA_SOLA_MS = 1400;
const AURORA_TOPE_MS = 4000;

const COPY = {
  es: {
    ariaLabel: 'Bienvenida',
    line1: 'Bienvenido a mi',
    line2: 'Portfolio Web',
    boton: 'Ver portfolio',
  },
  en: {
    ariaLabel: 'Welcome',
    line1: 'Welcome to my',
    line2: 'Portfolio Website',
    boton: 'View portfolio',
  },
};

function IconCode() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function IconDatabase() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
      <path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" />
    </svg>
  );
}

function IconRocket() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

function IconFlecha() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  );
}

// El gesto que hizo irse a la portada (sobre todo la inercia del trackpad) no tiene que seguir
// moviendo la página cuando ya se fue: se frenan las ruedas hasta una pausa de INERCIA_MS.
const INERCIA_MS = 250;
function tragarInercia() {
  let reloj = 0;
  const fin = () => window.removeEventListener('wheel', frenar, { capture: true });
  const frenar = (evento) => {
    if (evento.cancelable) evento.preventDefault();
    evento.stopPropagation();
    clearTimeout(reloj);
    reloj = setTimeout(fin, INERCIA_MS);
  };
  window.addEventListener('wheel', frenar, { capture: true, passive: false });
  reloj = setTimeout(fin, INERCIA_MS);
}

// Portada del inicio: tapa el hero (que es una capa fija) hasta que el visitante baja con la
// rueda, el dedo, el teclado o el botón; ahí sube como una sección más y deja el hero a la vista.
// Al irse se desmonta y no vuelve en esta pestaña (src/lib/bienvenida.js).
export default function Bienvenida({ locale = 'es' }) {
  const [visible, setVisible] = useState(true);
  const [saliendo, setSaliendo] = useState(false);
  const refSaliendo = useRef(false);
  const [aurora, setAurora] = useState(false);
  const [auroraLista, setAuroraLista] = useState(false);
  // cuándo entra el texto: null (todavía no), 'aurora' (después de la escena) o 'normal'
  const [texto, setTexto] = useState(null);
  const t = COPY[locale] ?? COPY.es;

  // El SDK y la escena se piden desde el <head> del HTML, en paralelo con la hidratación (si no,
  // recién arrancan cuando se monta el splash y la aurora llega tarde).
  if (UBICACION_AURORA === 'bienvenida') {
    preload(SDK_UNICORN, { as: 'script' });
    preload(ESCENA_AURORA, { as: 'fetch', crossOrigin: 'anonymous' });
  }

  const salir = useCallback(() => {
    if (refSaliendo.current) return;
    refSaliendo.current = true;
    setSaliendo(true);
    terminarBienvenida();
    tragarInercia();
  }, []);

  useEffect(() => {
    // Ya se vio en esta pestaña, o no es el inicio: el <head> la ocultó antes de pintar.
    if (bienvenidaTerminada()) {
      setVisible(false);
      return;
    }
    // En una recarga el navegador restaura el scroll solo (Sobre mí retoma su hito); en la
    // primera visita se arranca arriba. La portada siempre deja ver el hero: arriba de todo.
    const recarga = performance.getEntriesByType('navigation')[0]?.type === 'reload';
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = recarga ? 'auto' : 'manual';
    }
    window.scrollTo(0, 0);

    const conAurora = ubicacionAurora() === 'bienvenida' && puedeMostrarUnicorn();
    setAurora(conAurora);
    if (!conAurora) setTexto('normal');
  }, []);

  // tope mientras la escena carga: si tarda demasiado, el texto entra sin esperarla (si llega
  // después, igual aparece detrás). Cuenta tiempo de cuadros dibujados, no de reloj: mientras la
  // página está trabada armando lo suyo (cada salto se corta a 100 ms), el tope no se gasta y la
  // aurora no pierde su turno de aparecer antes que el texto.
  useEffect(() => {
    if (!aurora || auroraLista || texto) return undefined;
    let acumulado = 0;
    let previo = performance.now();
    let cuadro = 0;
    const paso = (ahora) => {
      acumulado += Math.min(ahora - previo, 100);
      previo = ahora;
      if (acumulado >= AURORA_TOPE_MS) setTexto('normal');
      else cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [aurora, auroraLista, texto]);

  // la escena arrancó: se ve sola un momento y recién ahí entra el texto
  useEffect(() => {
    if (!auroraLista || texto) return undefined;
    const timer = setTimeout(() => setTexto('aurora'), AURORA_SOLA_MS);
    return () => clearTimeout(timer);
  }, [auroraLista, texto]);

  // Mientras está la portada, la página no se mueve: bajar (rueda, deslizar hacia arriba, flecha
  // abajo, AvPág, espacio) la hace subir; subir no hace nada. Se escucha en captura y se frena
  // ahí, así ni Lenis ni el scroll nativo llegan a mover lo de abajo.
  useEffect(() => {
    if (!visible) return undefined;
    const frenar = (evento) => {
      if (evento.cancelable) evento.preventDefault();
      evento.stopPropagation();
    };
    const rueda = (evento) => {
      frenar(evento);
      if (evento.deltaY > 8) salir();
    };
    let inicioY = null;
    const toqueInicio = (evento) => {
      inicioY = evento.touches[0]?.clientY ?? null;
    };
    const toqueMueve = (evento) => {
      frenar(evento);
      const y = evento.touches[0]?.clientY;
      if (inicioY !== null && y !== undefined && inicioY - y > 40) salir();
    };
    const tecla = (evento) => {
      // espacio / Enter sobre el botón o el link: que actúen ellos
      if (evento.target instanceof Element && evento.target.closest('a, button') && (evento.key === ' ' || evento.key === 'Enter')) return;
      if (['ArrowDown', 'PageDown', 'End', ' '].includes(evento.key)) {
        frenar(evento);
        salir();
      } else if (['ArrowUp', 'PageUp', 'Home'].includes(evento.key)) {
        frenar(evento);
      }
    };
    window.addEventListener('wheel', rueda, { capture: true, passive: false });
    window.addEventListener('touchstart', toqueInicio, { capture: true, passive: true });
    window.addEventListener('touchmove', toqueMueve, { capture: true, passive: false });
    window.addEventListener('keydown', tecla, { capture: true });
    return () => {
      window.removeEventListener('wheel', rueda, { capture: true });
      window.removeEventListener('touchstart', toqueInicio, { capture: true });
      window.removeEventListener('touchmove', toqueMueve, { capture: true });
      window.removeEventListener('keydown', tecla, { capture: true });
    };
  }, [visible, salir]);

  // sube como una sección y se desmonta: no hay forma de volver a ella
  useEffect(() => {
    if (!saliendo) return undefined;
    const timer = setTimeout(() => {
      // el header y los toggles, que estaban por encima de la portada, vuelven a su capa
      document.documentElement.setAttribute('data-portada-fuera', '');
      setVisible(false);
    }, prefiereMovimientoReducido() ? SALIDA_REDUCIDA_MS : SALIDA_MS);
    return () => clearTimeout(timer);
  }, [saliendo]);

  // el toggle de rendimiento queda a la vista sobre la portada: la aurora se prende o se apaga
  // en vivo con él
  useEffect(() => {
    if (!visible) return undefined;
    const alCambiar = () => {
      const conAurora = ubicacionAurora() === 'bienvenida' && puedeMostrarUnicorn();
      setAurora(conAurora);
      if (!conAurora) setAuroraLista(false);
      setTexto((actual) => actual ?? 'normal');
    };
    window.addEventListener(EVENTO_RENDIMIENTO, alCambiar);
    return () => window.removeEventListener(EVENTO_RENDIMIENTO, alCambiar);
  }, [visible]);

  // si la escena no carga (sin red al CDN, sin WebGL), la portada sigue sin ella
  function sinAurora() {
    setAurora(false);
    setTexto((actual) => actual ?? 'normal');
  }

  if (!visible) {
    return null;
  }

  // Con la aurora configurada, el texto arranca en pausa (ya desde el HTML del servidor) hasta
  // que se decide si hay escena; sin ella, la clase ni aparece y el texto entra enseguida.
  const esperaTexto = UBICACION_AURORA === 'bienvenida' && !texto;

  return (
    <section
      className={`${styles.splash} ${saliendo ? styles.saliendo : ''} ${auroraLista && aurora ? styles.conAurora : ''} ${esperaTexto ? styles.esperaTexto : ''}`}
      aria-label={t.ariaLabel}
      aria-hidden={saliendo || undefined}
    >
      {aurora && (
        <FondoUnicorn className={styles.aurora} alListo={() => setAuroraLista(true)} alFallar={sinAurora} />
      )}
      <div className={styles.icons}>
        <span className={`${styles.icon} ${styles.icon1}`}>
          <IconCode />
        </span>
        <span className={`${styles.icon} ${styles.icon2}`}>
          <IconDatabase />
        </span>
        <span className={`${styles.icon} ${styles.icon3}`}>
          <IconRocket />
        </span>
      </div>

      <div className={styles.textBlock}>
        <div className={styles.lineMask}>
          <span className={`${styles.line} ${styles.line1}`}>{t.line1}</span>
        </div>
        <div className={styles.lineMask}>
          <span className={`${styles.line} ${styles.line2}`}>{t.line2}</span>
        </div>
      </div>

      <div className={styles.linkMask}>
        <a
          className={styles.link}
          href="https://github.com/FelipeDiazAimar"
          target="_blank"
          rel="noopener noreferrer"
        >
          github.com/FelipeDiazAimar
        </a>
      </div>

      <button type="button" className={styles.boton} onClick={salir}>
        <span>{t.boton}</span>
        <IconFlecha />
      </button>
    </section>
  );
}
