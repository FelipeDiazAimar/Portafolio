'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './Esqueleto.module.css';

// Bloque de skeleton: <Esqueleto ancho="12rem" alto="1rem" radio="999px" />
export default function Esqueleto({ ancho, alto, radio, className = '', style }) {
  const medidas = {};
  if (ancho) medidas['--esq-ancho'] = ancho;
  if (alto) medidas['--esq-alto'] = alto;
  if (radio) medidas['--esq-radio'] = radio;
  return <span className={`${styles.bloque} ${className}`} style={{ ...medidas, ...style }} aria-hidden="true" />;
}

// Capa de skeleton para una escena 3D/canvas que todavía no llegó. Va dentro de un contenedor
// posicionado; no captura el mouse, aparece recién tras 350 ms y se va con un fade cuando `visible` pasa a false.
export function EsqueletoEscena({ visible, etiqueta = 'Cargando contenido' }) {
  return (
    <div className={`${styles.escena} ${visible ? '' : styles.escenaOculta}`} role="status" aria-label={etiqueta} aria-hidden={!visible || undefined}>
      <Esqueleto className={styles.escenaMarco} />
      <div className={styles.escenaLineas}>
        <Esqueleto ancho="60%" alto="0.9rem" radio="999px" />
        <Esqueleto ancho="38%" alto="0.9rem" radio="999px" />
      </div>
    </div>
  );
}

// <img> con skeleton hasta que carga. Sin envoltorio: es la misma <img> (conserva sus clases y su layout).
// Si falla, queda un bloque quieto en vez de la imagen rota.
export function ImagenCarga({ className = '', onLoad, onError, alt = '', anchoMinimo, alEsperar, style, ...resto }) {
  const ref = useRef(null);
  // En el HTML del servidor no hay skeleton (la imagen puede llegar antes de hidratar y sin React nadie lo quitaría):
  // arranca como 'lista' y, ya montado, pasa a 'cargando' sólo si la imagen todavía no llegó.
  const [estado, setEstado] = useState('lista');

  useEffect(() => {
    const img = ref.current;
    // ya cargó antes de hidratar (caché o SSR): no hay evento onLoad que esperar
    if (!img) return;
    if (img.complete) {
      const ok = img.naturalWidth > 0;
      setEstado(ok ? 'lista' : 'fallo');
      (ok ? onLoad : onError)?.();
    } else {
      setEstado('cargando');
      alEsperar?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sólo al montar
  }, []);

  const clase = estado === 'cargando' ? styles.cargando : estado === 'fallo' ? styles.fallo : '';
  return (
    // eslint-disable-next-line @next/next/no-img-element -- el SVG animado y los PNG propios van tal cual
    <img
      ref={ref}
      className={`${className} ${clase}`.trim()}
      style={estado === 'cargando' && anchoMinimo ? { minWidth: anchoMinimo, ...style } : style}
      alt={alt}
      onLoad={(e) => {
        setEstado('lista');
        onLoad?.(e);
      }}
      onError={(e) => {
        setEstado('fallo');
        onError?.(e);
      }}
      {...resto}
    />
  );
}
