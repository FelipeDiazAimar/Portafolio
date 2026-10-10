'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './ListaLineas.module.css';

// Adaptado de LineSidebar (React Bits). Lista de enlaces con líneas guía: al
// acercar el cursor o el dedo a un ítem, se desplaza, se tiñe de acento y su
// línea crece. Cada ítem es un enlace real (teclado y lectores de pantalla), a
// diferencia del original, que eran <li> con onClick.

const CURVAS = {
  linear: (p) => p,
  smooth: (p) => p * p * (3 - 2 * p),
  sharp: (p) => p * p * p,
};

// items: [{ label, href }]
export default function ListaLineas({
  items,
  colorAcento = '#A855F7',
  colorTexto = '#c4c4c4',
  colorMarcador = '#6c6c6c',
  mostrarIndice = true,
  mostrarMarcador = true,
  radioProximidad = 100,
  desplazamientoMaximo = 30,
  curva = 'smooth',
  largoMarcador = 60,
  separacionMarcador = 0,
  escalaTick = 0.5,
  escalarTick = true,
  separacionItems = 20,
  tamanoFuente = 1.1,
  suavizado = 100,
  activoInicial = null,
  alElegir,
  className = '',
}) {
  const refLista = useRef(null);
  const refItems = useRef([]);
  const refObjetivos = useRef([]);
  const refActuales = useRef([]);
  const refCuadro = useRef(null);
  const refUltimo = useRef(0);
  const refActivo = useRef(activoInicial);
  const refSuavizado = useRef(suavizado);
  const [indiceActivo, setIndiceActivo] = useState(activoInicial);

  refActivo.current = indiceActivo;
  refSuavizado.current = suavizado;

  // Un único bucle de rAF acerca el --efecto de cada ítem a su objetivo con
  // suavizado exponencial independiente de la tasa de cuadros: color,
  // desplazamiento y escala se mueven juntos, sin transiciones CSS escalonadas.
  const correrCuadro = useCallback((ahora) => {
    const dt = Math.min((ahora - refUltimo.current) / 1000, 0.05);
    refUltimo.current = ahora;
    const tau = Math.max(refSuavizado.current, 1) / 1000;
    const k = 1 - Math.exp(-dt / tau);

    let enMovimiento = false;
    const nodos = refItems.current;
    for (let i = 0; i < nodos.length; i += 1) {
      const nodo = nodos[i];
      if (!nodo) continue;
      const objetivo = Math.max(refObjetivos.current[i] || 0, refActivo.current === i ? 1 : 0);
      const actual = refActuales.current[i] || 0;
      const siguiente = actual + (objetivo - actual) * k;
      const asentado = Math.abs(objetivo - siguiente) < 0.0015;
      const valor = asentado ? objetivo : siguiente;
      refActuales.current[i] = valor;
      nodo.style.setProperty('--efecto', valor.toFixed(4));
      if (!asentado) enMovimiento = true;
    }

    refCuadro.current = enMovimiento ? requestAnimationFrame(correrCuadro) : null;
  }, []);

  const arrancarBucle = useCallback(() => {
    if (refCuadro.current != null) cancelAnimationFrame(refCuadro.current);
    refUltimo.current = performance.now();
    refCuadro.current = requestAnimationFrame(correrCuadro);
  }, [correrCuadro]);

  const alMoverPuntero = useCallback(
    (evento) => {
      const lista = refLista.current;
      if (!lista) return;
      const rect = lista.getBoundingClientRect();
      const punteroY = evento.clientY - rect.top;
      const suavizar = CURVAS[curva] ?? CURVAS.linear;
      const nodos = refItems.current;
      for (let i = 0; i < nodos.length; i += 1) {
        const nodo = nodos[i];
        if (!nodo) continue;
        const centro = nodo.offsetTop + nodo.offsetHeight / 2;
        const distancia = Math.abs(punteroY - centro);
        refObjetivos.current[i] = suavizar(Math.max(0, 1 - distancia / radioProximidad));
      }
      arrancarBucle();
    },
    [curva, radioProximidad, arrancarBucle]
  );

  const alSalirPuntero = useCallback(() => {
    refObjetivos.current = refObjetivos.current.map(() => 0);
    arrancarBucle();
  }, [arrancarBucle]);

  const alHacerClic = useCallback(
    (evento, indice) => {
      setIndiceActivo(indice);
      alElegir?.(indice, items[indice], evento);
    },
    [alElegir, items]
  );

  useEffect(() => {
    arrancarBucle();
  }, [indiceActivo, arrancarBucle]);

  useEffect(
    () => () => {
      if (refCuadro.current != null) cancelAnimationFrame(refCuadro.current);
      refCuadro.current = null;
    },
    []
  );

  const clases = [
    styles.lateral,
    mostrarMarcador ? styles.conMarcadores : '',
    escalarTick ? styles.escalaTick : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <nav
      className={clases}
      aria-label="Secciones"
      style={{
        '--color-acento': colorAcento,
        '--color-texto': colorTexto,
        '--color-marcador': colorMarcador,
        '--largo-marcador': `${largoMarcador}px`,
        '--separacion-marcador': `${separacionMarcador}px`,
        '--escala-tick': escalaTick,
        '--desplazamiento-max': `${desplazamientoMaximo}px`,
        '--separacion-items': `${separacionItems}px`,
        '--tamano-fuente': `${tamanoFuente}rem`,
        '--suavizado': `${suavizado}ms`,
      }}
    >
      <ul
        ref={refLista}
        className={styles.lista}
        onPointerMove={alMoverPuntero}
        onPointerLeave={alSalirPuntero}
        onPointerUp={alSalirPuntero}
      >
        {items.map((item, indice) => (
          <li
            key={item.href}
            ref={(nodo) => {
              refItems.current[indice] = nodo;
            }}
            className={styles.item}
          >
            {mostrarMarcador && <span className={styles.marcador} aria-hidden="true" />}
            <a
              href={item.href}
              className={styles.enlace}
              aria-current={indiceActivo === indice ? 'true' : undefined}
              onClick={(evento) => alHacerClic(evento, indice)}
            >
              <span className={styles.etiqueta}>
                {mostrarIndice && (
                  <span className={styles.indice}>{String(indice + 1).padStart(2, '0')}</span>
                )}
                <span className={styles.texto}>{item.label}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
