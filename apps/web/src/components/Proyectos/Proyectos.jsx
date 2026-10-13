'use client';

// Sección Proyectos: una sola vista. La marquesina 3D con la tarjeta de cada proyecto
// ocupa todo el fondo y la lista va a la izquierda (hover tabs). Al apuntar un proyecto
// —en la lista o en la marquesina— su tarjeta viaja desde la marquesina al primer plano
// y se abre a pantalla completa; al elegir otro, la anterior vuelve a su lugar mientras
// la nueva sale de la suya. Sin nada elegido, se ve la marquesina con la lista.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, useReducedMotion } from 'framer-motion';
import { ThreeDMarquee } from '@/components/ui/3d-marquee.jsx';
import TextoDescifrado from '../TextoDescifrado/TextoDescifrado.jsx';
import { listarProyectos, resumenCifras } from '@/lib/proyectos.js';
import { indicePorTecla } from '@/lib/navegacionProyectos.js';
import NavegacionMixta from './NavegacionMixta.jsx';
import TarjetaMarca from './TarjetaMarca.jsx';
import VistaProyecto from './VistaProyecto.jsx';
import styles from './Proyectos.module.css';

// Intención de hover sobre la marquesina: cruzarla con el mouse no abre nada.
const DEMORA_MARQUESINA_MS = 160;
// Con 13 tarjetas la grilla del marquee quedaba arriba a la izquierda, fuera de la
// vista: se la corre (en píxeles de su caja, que escala sola) hacia el centro del espacio
// que deja la lista.
const POSICION_GRILLA = { top: '971px', right: '-108px' };

export default function Proyectos() {
  const proyectos = useMemo(() => listarProyectos(), []);
  const reducido = Boolean(useReducedMotion());
  const cifras = resumenCifras();
  const textoCifras = `${cifras.total} proyectos · ${cifras.clientes} clientes · ${cifras.laborales} sistemas en planta`;

  const refPanel = useRef(null);
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
  const elegir = useCallback((slug) => {
    if (slug === refActivo.current) return;
    const anterior = refActivo.current;
    if (anterior) setSaliendo((lista) => (lista.includes(anterior) ? lista : [...lista, anterior]));
    setSaliendo((lista) => lista.filter((s) => s !== slug));
    refActivo.current = slug;
    setActivo(slug);
  }, []);
  const cerrar = useCallback(() => elegir(null), [elegir]);

  // Hover sobre una tarjeta de la marquesina, con intención.
  const refDemora = useRef(0);
  const apuntarMarquesina = useCallback(
    (slug) => {
      clearTimeout(refDemora.current);
      refDemora.current = setTimeout(() => elegir(slug), DEMORA_MARQUESINA_MS);
    },
    [elegir]
  );
  const salirMarquesina = useCallback(() => clearTimeout(refDemora.current), []);
  useEffect(() => () => clearTimeout(refDemora.current), []);

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
  const ocultas = useMemo(() => [activo, ...saliendo].filter(Boolean), [activo, saliendo]);

  return (
    <section id="proyectos" className={styles.contenedor} aria-labelledby="titulo-proyectos">
      <div ref={refPanel} className={styles.panel} data-activo={proyecto ? 'true' : 'false'}>
        <div className={styles.fondo}>
          <ThreeDMarquee
            images={tarjetas}
            className={styles.marquesina}
            alApuntar={apuntarMarquesina}
            alSalir={salirMarquesina}
            claveActiva={ocultas}
            posicionGrilla={POSICION_GRILLA}
          />
          <div className={styles.velo} aria-hidden="true" />
        </div>

        <div className={styles.cabecera}>
          <h2 id="titulo-proyectos" className={styles.titulo}>
            <TextoDescifrado texto="Proyectos" activarCon="view" secuencial velocidad={40} />
          </h2>
          <p className={styles.cifras}>{textoCifras}</p>
        </div>

        {tamano.ancho > 0 ? (
          <AnimatePresence onExitComplete={() => setSaliendo([])}>
            {proyecto ? (
              <VistaProyecto
                key={proyecto.slug}
                proyecto={proyecto}
                medir={medir}
                tamano={tamano}
                reducido={reducido}
                alCerrar={cerrar}
              />
            ) : null}
          </AnimatePresence>
        ) : null}

        <div className={styles.columnaNav}>
          <NavegacionMixta proyectos={proyectos} activoSlug={activo} alElegir={elegir} alSalir={() => {}} />
        </div>
      </div>
    </section>
  );
}
