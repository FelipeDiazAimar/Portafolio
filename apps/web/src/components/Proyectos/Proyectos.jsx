'use client';

// Contenedor con scroll cinematográfico de la sección Proyectos en 3 fases:
// intro (muro que se disuelve + presentador que entra) y cierre (vista mixta),
// todo guiado por el progreso de scroll del contenedor (0 a 1).
// El alto del recorrido (~420svh) y el sticky los define el CSS.
import { useRef, useState } from 'react';
import {
  motion,
  useScroll,
  useTransform,
  useMotionTemplate,
  useReducedMotion,
} from 'framer-motion';
import TextoDescifrado from '../TextoDescifrado/TextoDescifrado.jsx';
import useConsulta from '@/hooks/useConsulta.js';
import { listarProyectos, resumenCifras } from '../../lib/proyectos.js';
import MuroProyectos from './MuroProyectos.jsx';
import PresentadorProyectos from './PresentadorProyectos.jsx';
import MixtoProyectos from './MixtoProyectos.jsx';
import styles from './Proyectos.module.css';

export default function Proyectos() {
  // Referencia al contenedor alto: el avance del scroll por ese alto
  // (definido en el CSS) es el progreso que anima las tres capas.
  const refContenedor = useRef(null);
  // Respeta el ajuste de movimiento reducido del sistema operativo.
  const movimientoReducido = useReducedMotion();
  // En celular el presentador es más alto que la pantalla: el panel fijo lo
  // recortaba. Ahí se usa la versión apilada, igual que con movimiento reducido.
  const esCelular = useConsulta('(max-width: 768px)');

  // Índice de la intro (fase muro + presentador), en modo controlado.
  const [introActivo, setIntroActivo] = useState(0);

  // Catálogo local para resolver el slug excluido del muro.
  const proyectos = listarProyectos();

  // Cifras de cabecera desde el catálogo local ("13 proyectos · ...").
  const cifras = resumenCifras();
  const textoCifras = `${cifras.total} proyectos · ${cifras.clientes} clientes · ${cifras.laborales} sistemas en planta`;

  // Progreso de 0 a 1 mientras el contenedor cruza la ventana.
  const { scrollYProgress } = useScroll({
    target: refContenedor,
    offset: ['start start', 'end end'],
  });
  // framer-motion acelera con la ScrollTimeline del navegador las transformaciones
  // por rangos de un scrollYProgress, y con este panel sticky calcula mal los rangos:
  // el muro volvía a aparecer y el cierre nunca llegaba a opacidad 1. Pasarlo por una
  // función corta esa aceleración y los valores se calculan en JS.
  const progreso = useTransform(scrollYProgress, (valor) => valor);

  // Muro: visible al inicio, se disuelve con zoom y desenfoque.
  const opacidadMuro = useTransform(progreso, [0.12, 0.28], [1, 0]);
  const escalaMuro = useTransform(progreso, [0.12, 0.28], [1, 1.12]);
  const desenfoqueMuro = useTransform(progreso, [0.12, 0.28], [0, 8]);
  const filtroMuro = useMotionTemplate`blur(${desenfoqueMuro}px)`;

  // Presentador: entra desvanecido desde abajo con leve zoom y luego sale.
  const opacidadPresentador = useTransform(
    progreso,
    [0.24, 0.38, 0.52, 0.64],
    [0, 1, 1, 0],
  );
  const escalaPresentador = useTransform(progreso, [0.24, 0.38], [0.94, 1]);
  const desplazamientoPresentador = useTransform(progreso, [0.24, 0.38], [40, 0]);
  // Sin clics fantasma: sin eventos de puntero hasta ser medio visible.
  const eventosPunteroPresentador = useTransform(opacidadPresentador, (valor) =>
    valor < 0.5 ? 'none' : 'auto',
  );

  // Mixto (cierre): entra desvanecido desde abajo con leve zoom.
  const opacidadMixto = useTransform(progreso, [0.6, 0.76], [0, 1]);
  const escalaMixto = useTransform(progreso, [0.6, 0.76], [0.94, 1]);
  const desplazamientoMixto = useTransform(progreso, [0.6, 0.76], [40, 0]);
  const eventosPunteroMixto = useTransform(opacidadMixto, (valor) =>
    valor < 0.5 ? 'none' : 'auto',
  );

  // Movimiento reducido: sin sticky ni transiciones, muro + presentador
  // + mixto apilados como contenido estático.
  if (movimientoReducido || esCelular) {
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
          <div className={`${styles.capaEstatica} ${styles.muroEstatico}`}>
            <MuroProyectos excluirSlug={proyectos[introActivo]?.slug} />
          </div>
          <div className={styles.capaEstatica}>
            <PresentadorProyectos activo={introActivo} alCambiar={setIntroActivo} />
          </div>
          {/* En celular el presentador ya lista todos los proyectos con su tarjeta: el
              cierre repetiría lo mismo en una tira. */}
          {esCelular ? null : (
            <div className={`${styles.capaEstatica} ${styles.mixtoEstatico}`}>
              <MixtoProyectos />
            </div>
          )}
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
          <MuroProyectos excluirSlug={proyectos[introActivo]?.slug} />
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

        {/* Presentador: entra cuando el muro ya se está disolviendo y sale
            antes del cierre. */}
        <motion.div
          className={styles.capaPresentador}
          style={{
            opacity: opacidadPresentador,
            scale: escalaPresentador,
            y: desplazamientoPresentador,
            pointerEvents: eventosPunteroPresentador,
          }}
        >
          <PresentadorProyectos activo={introActivo} alCambiar={setIntroActivo} />
        </motion.div>

        {/* Mixto (cierre): entra al final y queda como vista de cierre. */}
        <motion.div
          className={styles.capaMixto}
          style={{
            opacity: opacidadMixto,
            scale: escalaMixto,
            y: desplazamientoMixto,
            pointerEvents: eventosPunteroMixto,
          }}
        >
          <MixtoProyectos />
        </motion.div>
      </div>
    </section>
  );
}
