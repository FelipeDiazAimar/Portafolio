'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMotionValueEvent, useScroll } from 'framer-motion';
import hitos from '@/data/hitos.json';
import useConsulta from '@/hooks/useConsulta.js';
import { indiceDeHito, progresoDeHito } from '@/lib/hitoActivo.js';
import FondoHito from './FondoHito.jsx';
import LineaTiempo from './LineaTiempo.jsx';
import EncabezadoHito from './EncabezadoHito.jsx';
import Escena3D from './Escena3D/Escena3D.jsx';
import DescripcionHito from './DescripcionHito.jsx';
import styles from './SobreMi.module.css';

// Para arrastrar el modelo (o agarrar la tela de la bandera) hay que estar con
// el cursor encima, así que abrir el detalle en cuanto entra el mouse lo abriría
// a mitad de cada gesto. Hay que dejar el mouse QUIETO este tiempo: cada
// movimiento reinicia la espera, y un `pointerdown` sobre el canvas la cancela.
const ESPERA_HOVER_MODELO_MS = 900;

function SobreMiContenido() {
  const refContenedor = useRef(null);
  const [activo, setActivo] = useState(0);
  // Un solo estado para los dos mundos: en escritorio lo mueven el hover y el
  // foco; en celular, los toques sobre un punto, el hilo y la "×".
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const sinHover = !useConsulta('(hover: hover) and (pointer: fine)');
  const refEspera = useRef(0);
  const refAbierto = useRef(false);
  refAbierto.current = detalleAbierto;
  const refBloqueo = useRef(false);
  const refActivo = useRef(0);
  refActivo.current = activo;
  // Si el mouse está sobre la columna (la espera de 0,9 s sólo corre en ese caso).
  const refDentro = useRef(false);
  // Última posición del mouse. Al terminar un scroll el navegador dispara un
  // movimiento "falso" en el mismo lugar: sólo cuenta un desplazamiento real, si no
  // un mouse que descansa sobre la columna abría el detalle y desarmaba el modelo.
  const refUltimaPosicion = useRef(null);
  const hayMovimientoReal = (evento) => {
    const anterior = refUltimaPosicion.current;
    refUltimaPosicion.current = { x: evento.clientX, y: evento.clientY };
    return anterior !== null && Math.hypot(evento.clientX - anterior.x, evento.clientY - anterior.y) >= 2;
  };
  useEffect(() => () => clearTimeout(refEspera.current), []);
  // Empieza la cuenta de 0,9 s con el mouse quieto; si algo del modelo lo está
  // reteniendo (`refBloqueo`), no se abre el detalle.
  const armarEspera = () => {
    clearTimeout(refEspera.current);
    refEspera.current = setTimeout(() => {
      // Un hito con grafo para explorar (textoFijo) no se desarma por hover.
      if (!refBloqueo.current && !hitos[refActivo.current].textoFijo) setDetalleAbierto(true);
    }, ESPERA_HOVER_MODELO_MS);
  };

  const { scrollYProgress } = useScroll({
    target: refContenedor,
    offset: ['start start', 'end end'],
  });
  // Al cambiar de hito (o llegar a la sección) se descarta la posición del mouse y la
  // espera pendiente: lo que siga a un scroll no es el usuario explorando.
  useEffect(() => {
    refUltimaPosicion.current = null;
    clearTimeout(refEspera.current);
  }, [activo]);

  useMotionValueEvent(scrollYProgress, 'change', (progreso) => {
    setActivo(indiceDeHito(progreso, hitos.length));
  });

  const irAlHito = useCallback((indice) => {
    const contenedor = refContenedor.current;
    if (!contenedor) return;
    const recorrido = contenedor.offsetHeight - window.innerHeight;
    const arriba = contenedor.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top: arriba + progresoDeHito(indice, hitos.length) * recorrido,
      behavior: 'smooth',
    });
  }, []);

  function alSeleccionar(indice) {
    irAlHito(indice);
    if (sinHover) setDetalleAbierto(true);
  }

  // En dispositivos táctiles el foco y el hover no deben abrir ni cerrar nada:
  // tocar la descripción desenfoca el botón y cerraría el detalle sin querer.
  function alApuntar(abierto) {
    if (!sinHover) setDetalleAbierto(abierto);
  }

  const hito = hitos[activo];

  return (
    <section id="sobre-mi" ref={refContenedor} className={styles.contenedor} style={{ '--hitos': hitos.length }}>
      <div className={styles.panel} data-detalle={detalleAbierto}>
        <FondoHito hitos={hitos} activo={activo} />
        <h2 className={styles.etiqueta}>Sobre mí</h2>

        <div
          className={styles.columna}
          onPointerEnter={(evento) => {
            // `buttons !== 0`: si entra con un botón apretado es un arrastre
            // (girar el modelo) que salió de la columna y volvió.
            if (evento.pointerType !== 'mouse') return;
            refDentro.current = true;
            refUltimaPosicion.current = { x: evento.clientX, y: evento.clientY };
          }}
          onPointerMove={(evento) => {
            // Mover el mouse reinicia la espera (no se desarma mientras se juega
            // con el modelo). Con el detalle ya abierto no hace falta nada.
            if (evento.pointerType !== 'mouse' || evento.buttons !== 0 || refAbierto.current) return;
            if (hayMovimientoReal(evento)) armarEspera();
          }}
          onPointerLeave={(evento) => {
            if (evento.pointerType !== 'mouse') return;
            refDentro.current = false;
            clearTimeout(refEspera.current);
            setDetalleAbierto(false);
          }}
        >
          <EncabezadoHito hito={hito} />
          {/* Un hito con grafo para explorar no se desarma por hover: su texto queda a la vista. */}
          {hito.textoFijo ? <DescripcionHito key={hito.id} hito={hito} fijo /> : null}
          <div className={styles.zona}>
            <Escena3D
              hito={hito}
              desarmado={detalleAbierto}
              onBloqueo={(bloqueado) => {
                // El mouse está sobre algo interactivo del modelo (un nodo del grafo):
                // no se desarma mientras tanto, y al salir se reinicia la espera.
                refBloqueo.current = bloqueado;
                if (bloqueado) clearTimeout(refEspera.current);
                else if (refDentro.current && !refAbierto.current) armarEspera();
              }}
              onInteraccion={() => {
                clearTimeout(refEspera.current);
                setDetalleAbierto(false);
              }}
            />
            {hito.textoFijo ? null : <DescripcionHito hito={hito} visible={detalleAbierto} />}
          </div>
        </div>

        <LineaTiempo
          hitos={hitos}
          activo={activo}
          onSeleccionar={alSeleccionar}
          onApuntarActivo={alApuntar}
          onToqueHilo={() => setDetalleAbierto(false)}
        />

        {/* Se decide por "sin hover" y no por ancho: una tablet o un celular en
            horizontal usan el layout de escritorio pero igual necesitan una
            forma de cerrar el detalle. Montada sólo cuando hace falta. */}
        {sinHover && detalleAbierto ? (
          <button
            type="button"
            className={styles.cerrar}
            aria-label="Cerrar detalle"
            onClick={() => setDetalleAbierto(false)}
          >
            ×
          </button>
        ) : null}
      </div>
    </section>
  );
}

export default function SobreMi() {
  return hitos.length > 0 ? <SobreMiContenido /> : null;
}
