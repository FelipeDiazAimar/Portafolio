'use client';

import { useEffect, useState } from 'react';
import Cargador from './Cargador.jsx';
import styles from './CargadorRecarga.module.css';

// Mismos tiempos que el loader de la portada (Bienvenida.jsx).
const MIN_MS = 1800;
const TOPE_MS = 7000;
const SALIDA_MS = 800;

// Loader de las recargas (F5, Ctrl+Shift+R) en las que no va la portada (la página estaba más
// abajo del hero, o no es el inicio). El script del <head> marca <html data-cargador-recarga>
// antes de pintar, así tapa desde el primer cuadro; se va cuando cargó la página y las fuentes,
// con un mínimo para que no parpadee y un tope por si algo no llega.
export default function CargadorRecarga() {
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const el = document.documentElement;
    if (!el.hasAttribute('data-cargador-recarga')) return undefined;
    let vivo = true;
    const cargada = new Promise((resolver) => {
      if (document.readyState === 'complete') resolver();
      else window.addEventListener('load', resolver, { once: true });
    });
    const fuentes = document.fonts?.ready ?? Promise.resolve();
    const minimo = new Promise((resolver) => setTimeout(resolver, MIN_MS));
    const tope = new Promise((resolver) => setTimeout(resolver, TOPE_MS));
    let reloj = 0;
    Promise.race([Promise.all([cargada, fuentes, minimo]), tope]).then(() => {
      if (!vivo) return;
      setCargando(false);
      reloj = setTimeout(() => el.removeAttribute('data-cargador-recarga'), SALIDA_MS);
    });
    return () => {
      vivo = false;
      clearTimeout(reloj);
    };
  }, []);

  return (
    <div className={styles.recarga} aria-hidden={!cargando || undefined}>
      <Cargador visible={cargando} />
    </div>
  );
}
