'use client';

// Contenedor con scroll cinematográfico de la sección Proyectos:
// un muro que se disuelve y un presentador que entra, ambos guiados
// por el progreso de scroll del contenedor (0 a 1).
import { useRef } from 'react';
import {
  motion,
  useScroll,
  useTransform,
  useMotionTemplate,
  useReducedMotion,
} from 'framer-motion';
import TextoDescifrado from '../TextoDescifrado/TextoDescifrado.jsx';
import { resumenCifras } from '../../lib/proyectos.js';
import MuroProyectos from './MuroProyectos.jsx';
import PresentadorProyectos from './PresentadorProyectos.jsx';
import styles from './Proyectos.module.css';

export default function Proyectos() {
  // Referencia al contenedor alto (260svh): el avance del scroll por ese
  // alto es el progreso que anima muro y presentador.
  const refContenedor = useRef(null);
  // Respeta el ajuste de movimiento reducido del sistema operativo.
  const movimientoReducido = useReducedMotion();

  // Cifras de cabecera desde el catálogo local ("13 proyectos · ...").
  const cifras = resumenCifras();
  const textoCifras = `${cifras.total} proyectos · ${cifras.clientes} clientes · ${cifras.laborales} sistemas en planta`;

  // Progreso de 0 a 1 mientras el contenedor cruza la ventana.
  const { scrollYProgress: progreso } = useScroll({
    target: refContenedor,
    offset: ['start start', 'end end'],
  });

  // Muro: visible al inicio, se disuelve con zoom y desenfoque.
  const opacidadMuro = useTransform(progreso, [0.3, 0.55], [1, 0]);
  const escalaMuro = useTransform(progreso, [0.3, 0.55], [1, 1.12]);
  const desenfoqueMuro = useTransform(progreso, [0.3, 0.55], [0, 8]);
  const filtroMuro = useMotionTemplate`blur(${desenfoqueMuro}px)`;

  // Presentador: entra desvanecido desde abajo con leve zoom.
  const opacidadPresentador = useTransform(progreso, [0.38, 0.6], [0, 1]);
  const escalaPresentador = useTransform(progreso, [0.38, 0.6], [0.94, 1]);
  const desplazamientoPresentador = useTransform(progreso, [0.38, 0.6], [40, 0]);
  // Sin clics fantasma: sin eventos de puntero hasta ser medio visible.
  const eventosPunteroPresentador = useTransform(opacidadPresentador, (valor) =>
    valor < 0.5 ? 'none' : 'auto',
  );

  // Movimiento reducido: sin sticky ni transiciones, muro y presentador
  // apilados como contenido estático.
  if (movimientoReducido) {
    return (
      <section
        id="proyectos"
        className={`${styles.contenedor} ${styles.contenedorEstatico}`}
        aria-labelledby="titulo-proyectos"
      >
        <div className={`${styles.panel} ${styles.panelEstatico}`}>
          <div className={styles.cabeceraEstatica}>
            <h2 id="titulo-proyectos" className={styles.titulo}>
              <TextoDescifrado
                texto="Proyectos"
                activarCon="view"
                secuencial
                velocidad={40}
              />
            </h2>
            <p className={styles.lineaCifras}>{textoCifras}</p>
          </div>
          <div className={styles.capaEstatica}>
            <MuroProyectos />
          </div>
          <div className={styles.capaEstatica}>
            <PresentadorProyectos />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="proyectos"
      ref={refContenedor}
      className={styles.contenedor}
      aria-labelledby="titulo-proyectos"
    >
      <div className={styles.panel}>
        {/* Muro + título: comparten opacidad para desaparecer juntos. */}
        <motion.div
          className={styles.capaMuro}
          style={{
            opacity: opacidadMuro,
            scale: escalaMuro,
            filter: filtroMuro,
          }}
        >
          <MuroProyectos />
          <div className={styles.cabecera}>
            <h2 id="titulo-proyectos" className={styles.titulo}>
              <TextoDescifrado
                texto="Proyectos"
                activarCon="view"
                secuencial
                velocidad={40}
              />
            </h2>
            <p className={styles.lineaCifras}>{textoCifras}</p>
          </div>
        </motion.div>

        {/* Presentador: entra cuando el muro ya se está disolviendo. */}
        <motion.div
          className={styles.capaPresentador}
          style={{
            opacity: opacidadPresentador,
            scale: escalaPresentador,
            y: desplazamientoPresentador,
            pointerEvents: eventosPunteroPresentador,
          }}
        >
          <PresentadorProyectos />
        </motion.div>
      </div>
    </section>
  );
}
