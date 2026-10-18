'use client';

// Sección Proyectos: una sola vista. La marquesina 3D con la tarjeta de cada proyecto
// ocupa todo el ancho. Al hacer click en una tarjeta su proyecto viaja desde la marquesina
// al primer plano y se abre a pantalla completa; recién entonces aparece la lista a la
// izquierda (hover tabs), con la que se cambia de proyecto: la anterior vuelve a su lugar
// mientras la nueva sale de la suya. Sin nada elegido, se ve solo la marquesina.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ThreeDMarquee } from '@/components/ui/3d-marquee.jsx';
import TextoDescifrado from '../TextoDescifrado/TextoDescifrado.jsx';
import TextoTrazo from '../TextoTrazo/TextoTrazo.jsx';
import { listarProyectos, resumenCifras } from '@/lib/proyectos.js';
import { indicePorTecla } from '@/lib/navegacionProyectos.js';
import NavegacionMixta from './NavegacionMixta.jsx';
import TarjetaMarca from './TarjetaMarca.jsx';
import VistaProyecto from './VistaProyecto.jsx';
import styles from './Proyectos.module.css';
import useEmbudo from '@/hooks/useEmbudo.js';
import useUnionSeccion from '@/hooks/useUnionSeccion.js';

// Marquesina: la grilla inclinada deja huecos en las esquinas si sólo están los 13 proyectos,
// así que se repiten los necesarios (más cuanto más grande la pantalla) hasta cubrirla, sin
// agrandar las tarjetas. Medidas de la grilla original (en px de su caja, que escala sola):
// 4 columnas en 1720 px con 32 de separación → tarjeta de 406 × 293.
const ANCHO_TARJETA = 406;
const ALTO_TARJETA = 293;
const SEPARACION_TARJETAS = 32;
const limitar = (x, min, max) => Math.min(max, Math.max(min, x));

// Cuántas columnas y copias hacen falta para el tamaño del panel, y dónde poner la grilla
// para que el centro de lo que ocupa caiga en el centro de la sección. Un vector (u, v) de
// la grilla se ve en pantalla como (0,707·(u+v), 0,406·(v−u)) por la inclinación.
export function configurarMarquesina(ancho, alto, total) {
  const escala = ancho >= 1024 ? 1 : ancho >= 640 ? 0.75 : 0.5;
  const k = Math.max(ancho / 1917, alto / 910) / escala;
  const chico = ancho < 768;
  // Hasta 13 columnas: más que proyectos obligaría a repetir uno en la misma fila.
  const columnas = chico ? 6 : limitar(Math.ceil(8 * k), 6, 13);
  const lado = chico ? 3 : limitar(Math.ceil(5 * k), 4, 9);
  const filas = Math.ceil(total / columnas) + 2 * lado;
  const anchoCaja = columnas * ANCHO_TARJETA + (columnas - 1) * SEPARACION_TARJETAS;
  const altoFilas = filas * (ALTO_TARJETA + SEPARACION_TARJETAS);
  return {
    columnas,
    anchoCaja,
    filas,
    posicion: {
      right: `${Math.round(-anchoCaja / 2 + (0.707 * (anchoCaja + altoFilas)) / 2)}px`,
      top: `${Math.round(860 - (0.406 * (altoFilas - anchoCaja)) / 2)}px`,
    },
  };
}
// Cuánto se ve el título antes de irse y dejar solo la marquesina.
const TITULO_VISIBLE_MS = 4000;
const ESCALA_TITULO = 0.2;
const MARGEN_TITULO = 32;
const ALTO_HEADER = 72;

export default function Proyectos() {
  const proyectos = useMemo(() => listarProyectos(), []);
  const reducido = Boolean(useReducedMotion());
  const cifras = resumenCifras();
  const textoCifras = `${cifras.total} proyectos · ${cifras.clientes} clientes · ${cifras.laborales} sistemas en planta`;

  const refPanel = useRef(null);
  const refFondo = useRef(null);
  // los bordes de la marquesina se funden con la página sólo mientras se ven
  useUnionSeccion(refFondo);
  const [tamano, setTamano] = useState({ ancho: 0, alto: 0 });
  useLayoutEffect(() => {
    const panel = refPanel.current;
    if (!panel) return undefined;
    const medirPanel = () => setTamano({ ancho: panel.clientWidth, alto: panel.clientHeight });
    medirPanel();
    const observador = new ResizeObserver(medirPanel);
    observador.observe(panel);
    return () => observador.disconnect();
  }, []);

  // Activo = el que está en primer plano; saliendo = los que vuelven a la marquesina.
  // Mientras tanto, sus tarjetas se ocultan: en su lugar viaja la copia.
  const [activo, setActivo] = useState(null);
  const [saliendo, setSaliendo] = useState([]);
  const refActivo = useRef(null);
  // Pasar de un proyecto a otro desde la lista no viaja ni anima el fondo: uno desaparece y
  // aparece el otro. La animación de viaje queda para abrir desde la marquesina y para cerrar.
  const [instantaneo, setInstantaneo] = useState(false);
  const elegir = useCallback((slug) => {
    if (slug === refActivo.current) return;
    const anterior = refActivo.current;
    setInstantaneo(Boolean(anterior && slug));
    if (anterior) setSaliendo((lista) => (lista.includes(anterior) ? lista : [...lista, anterior]));
    setSaliendo((lista) => lista.filter((s) => s !== slug));
    refActivo.current = slug;
    setActivo(slug);
  }, []);
  const cerrar = useCallback(() => elegir(null), [elegir]);

  // Caja de la tarjeta de un proyecto en la marquesina, en coordenadas del panel: el
  // centro sale de su caja en pantalla y el tamaño, de su tamaño sin transformar por la
  // escala de la marquesina (la inclinación la pone la vista).
  const medir = useCallback((slug) => {
    const panel = refPanel.current;
    const tarjeta = panel?.querySelector(`[data-clave="${slug}"]`);
    if (!panel || !tarjeta) return null;
    const contenedor = tarjeta.closest('[data-escala-marquee]');
    const escala = contenedor ? contenedor.getBoundingClientRect().width / contenedor.offsetWidth : 1;
    const caja = tarjeta.getBoundingClientRect();
    const base = panel.getBoundingClientRect();
    const ancho = tarjeta.offsetWidth * escala;
    const alto = tarjeta.offsetHeight * escala;
    return {
      x: caja.left + caja.width / 2 - base.left - ancho / 2,
      y: caja.top + caja.height / 2 - base.top - alto / 2,
      ancho,
      alto,
    };
  }, []);

  // Al salir de la sección se vuelve a la marquesina.
  const [visible, setVisible] = useState(false);
  const [tituloVisto, setTituloVisto] = useState(false);
  // El título terminó de viajar al header y ahí queda como texto con hover.
  const [enHeader, setEnHeader] = useState(false);
  // La franja de arriba de la lista es blanca lisa; sólo con la lista scrolleada se le suma el blur.
  const [listaScrolleada, setListaScrolleada] = useState(false);
  // Adónde viaja el título: la esquina de arriba a la derecha, centrado en la fila del header.
  const refTitulo = useRef(null);
  const [destinoTitulo, setDestinoTitulo] = useState({ x: 0, y: 0 });
  useLayoutEffect(() => {
    if (!tituloVisto || !refTitulo.current || !tamano.ancho) return;
    const titulo = refTitulo.current.querySelector('h2');
    const ancho = (titulo?.offsetWidth ?? refTitulo.current.offsetWidth) * ESCALA_TITULO;
    setDestinoTitulo({
      x: tamano.ancho / 2 - MARGEN_TITULO - ancho / 2,
      // Centro de la fila del header (72 px de alto) respecto del centro del panel.
      y: ALTO_HEADER / 2 - tamano.alto / 2,
    });
  }, [tituloVisto, tamano.ancho, tamano.alto]);
  useEffect(() => {
    if (!visible) {
      setTituloVisto(false);
      setEnHeader(false);
      return undefined;
    }
    const id = setTimeout(() => setTituloVisto(true), TITULO_VISIBLE_MS);
    return () => clearTimeout(id);
  }, [visible]);
  useEffect(() => {
    const panel = refPanel.current;
    if (!panel) return undefined;
    const observador = new IntersectionObserver(([entrada]) => {
      setVisible(entrada.isIntersecting);
      if (!entrada.isIntersecting) elegir(null);
    }, { threshold: 0.35 });
    observador.observe(panel);
    return () => observador.disconnect();
  }, [elegir]);

  // Embudo: al pasar por la sección, si el scroll se detiene cerca, la centra sola en pantalla.
  useEmbudo(refPanel);

  // Teclado con la sección a la vista: flechas recorren, Escape vuelve a la marquesina.
  useEffect(() => {
    if (!visible) return undefined;
    const alTecla = (e) => {
      const objetivo = e.target;
      if (objetivo && (objetivo.tagName === 'INPUT' || objetivo.tagName === 'TEXTAREA' || objetivo.isContentEditable)) return;
      if (e.key === 'Escape') {
        if (refActivo.current) document.getElementById(`nav-${refActivo.current}`)?.focus();
        cerrar();
        return;
      }
      if (!['ArrowDown', 'ArrowUp'].includes(e.key) || !refActivo.current) return;
      const actual = proyectos.findIndex((p) => p.slug === refActivo.current);
      const siguiente = indicePorTecla(e.key, actual, proyectos.length);
      if (siguiente === null || !proyectos[siguiente]) return;
      e.preventDefault();
      elegir(proyectos[siguiente].slug);
      document.getElementById(`nav-${proyectos[siguiente].slug}`)?.scrollIntoView({ block: 'nearest' });
    };
    window.addEventListener('keydown', alTecla);
    return () => window.removeEventListener('keydown', alTecla);
  }, [visible, proyectos, elegir, cerrar]);

  // La lista (en celular, una tira horizontal) muestra siempre el proyecto abierto.
  useEffect(() => {
    if (activo) document.getElementById(`nav-${activo}`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activo]);

  const tarjetas = useMemo(
    () =>
      proyectos.map((p) => ({
        clave: p.slug,
        titulo: p.titulo,
        contenido: <TarjetaMarca proyecto={p} />,
      })),
    [proyectos]
  );
  const proyecto = proyectos.find((p) => p.slug === activo) ?? null;
  const marquesina = useMemo(
    () => configurarMarquesina(tamano.ancho || 1917, tamano.alto || 910, proyectos.length),
    [tamano.ancho, tamano.alto, proyectos.length]
  );

  // El header se acomoda a la vista de un proyecto (navegación a la derecha, junto a la cruz).
  useEffect(() => {
    if (!proyecto) {
      setListaScrolleada(false);
      return undefined;
    }
    document.documentElement.dataset.proyectoAbierto = 'true';
    return () => {
      delete document.documentElement.dataset.proyectoAbierto;
    };
  }, [proyecto]);
  const ocultas = useMemo(() => [activo, ...saliendo].filter(Boolean), [activo, saliendo]);

  return (
    <section id="proyectos" className={styles.contenedor} aria-labelledby="titulo-proyectos">
      <div ref={refPanel} className={styles.panel} data-activo={proyecto ? 'true' : 'false'} data-titulo-visto={tituloVisto ? 'true' : 'false'}>
        <div ref={refFondo} className={styles.fondo}>
          <ThreeDMarquee
            images={tarjetas}
            className={styles.marquesina}
            alApuntar={elegir}
            claveActiva={ocultas}
            posicionGrilla={marquesina.posicion}
            filas={marquesina.filas}
            columnas={marquesina.columnas}
            anchoCaja={marquesina.anchoCaja}
          />
          <div className={styles.velo} aria-hidden="true" />
        </div>

        <div className={styles.cabecera}>
          {/* Tras unos segundos el título viaja, achicándose, a la esquina de arriba a la derecha
              (a la altura del header) y las cifras se van. */}
          <motion.div
            ref={refTitulo}
            className={styles.tituloBloque}
            animate={tituloVisto && !reducido ? { x: destinoTitulo.x, y: destinoTitulo.y, scale: ESCALA_TITULO } : { x: 0, y: 0, scale: 1 }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
            onAnimationComplete={() => {
              if (tituloVisto && !reducido) setEnHeader(true);
            }}
            style={{ visibility: enHeader ? 'hidden' : 'visible' }}
          >
            <h2 id="titulo-proyectos" className={styles.titulo}>
              <TextoTrazo texto="Proyectos" claseTexto={styles.tituloTrazo} duracion={2.6} grosor={2.5} alVer />
            </h2>
            <p className={styles.cifras}>{textoCifras}</p>
          </motion.div>
        </div>

        {/* Ya en el header: el mismo texto, con el efecto de hover descifrado que tiene el nombre. */}
        <div className={styles.tituloHeader} data-visible={enHeader && !proyecto ? 'true' : 'false'}>
          <TextoDescifrado
            texto="Proyectos"
            activarCon="hover"
            secuencial
            direccionRevelado="start"
            caracteres="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=<>/\\|"
            velocidad={35}
            className={styles.tituloHeaderRevelado}
            encryptedClassName={styles.tituloHeaderEncriptado}
          />
        </div>

        {tamano.ancho > 0 ? (
          <AnimatePresence custom={instantaneo} onExitComplete={() => setSaliendo([])}>
            {proyecto ? (
              <VistaProyecto
                key={proyecto.slug}
                proyecto={proyecto}
                medir={medir}
                tamano={tamano}
                reducido={reducido}
                instantaneo={instantaneo}
                alCerrar={cerrar}
              />
            ) : null}
          </AnimatePresence>
        ) : null}

        <AnimatePresence>
          {proyecto ? (
            <motion.div
              key="nav"
              className={styles.columnaNav}
              data-scrolleada={listaScrolleada ? 'true' : 'false'}
              initial={reducido ? { opacity: 0 } : { opacity: 0, x: -48 }}
              animate={{ opacity: 1, x: 0, transition: { delay: reducido ? 0 : 0.3, duration: 0.45, ease: [0.22, 1, 0.36, 1] } }}
              exit={{ opacity: 0, x: reducido ? 0 : -48, transition: { duration: 0.2 } }}
            >
              <NavegacionMixta proyectos={proyectos} activoSlug={activo} alElegir={elegir} alSalir={() => {}} alScrollear={setListaScrolleada} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </section>
  );
}
