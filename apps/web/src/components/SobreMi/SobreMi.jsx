'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useMotionValueEvent, useReducedMotion, useScroll, useSpring } from 'framer-motion';
import hitos from '@/data/hitos.json';
import useConsulta from '@/hooks/useConsulta.js';
import useTema from '@/hooks/useTema.js';
import { PESO_VIAJE, activoDe, imanDe, pesoTotal, progresoDeEstancia, tramoDe } from '@/lib/columna/recorrido.js';
import { tiempoModeloMs } from '@/lib/tiempoModelo.js';
import { hayWebGL } from './Escena3D/soporteWebGL.js';
import LimiteErrores from './Escena3D/LimiteErrores.jsx';
import FondoHito from './FondoHito.jsx';
import EncabezadoHito from './EncabezadoHito.jsx';
import DescripcionHito from './DescripcionHito.jsx';
import Minimapa from './Minimapa.jsx';
import AnioViaje from './AnioViaje.jsx';
import SobreMiPlano from './SobreMiPlano.jsx';
import styles from './SobreMi.module.css';

// Todo `three` queda en este chunk, que se pide cuando la sección se acerca.
const MundoColumna = dynamic(() => import('./Columna3D/MundoColumna.jsx'), { ssr: false, loading: () => null });

const N = hitos.length;
const ESPERA_LLEGADA_MS = 400;
const ESPERA_IMAN_MS = 260;
// Autoplay: arranque en el primer hito sin tocar nada, y retoma tras 2 min pausado.
const INICIO_AUTO_MS = 10000;
const PAUSA_AUTO_MS = 120000;
// Extra sobre el modelo para que cada escena+bio se vea antes de avanzar.
const EXTRA_BIO_MS = 3000;
// Los saltos programáticos (imán, autoplay, minimapa) recorren un viaje completo en
// este tiempo: con el scroll suave nativo, 9 pantallas pasaban en menos de un segundo
// y la primera persona no se llegaba a ver.
const MS_POR_VIAJE = 12000;
const MS_MAXIMO_SALTO = 25000;

// Arranca y frena despacio.
function suaveEntradaSalida(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function SobreMiRecorrido({ onFallo }) {
  const refContenedor = useRef(null);
  const refPanel = useRef(null);
  const reducido = Boolean(useReducedMotion());
  const esMovil = useConsulta('(max-width: 768px)');
  const claro = useTema().tema === 'light';

  const { scrollYProgress } = useScroll({ target: refContenedor, offset: ['start start', 'end end'] });
  // La rueda del mouse avanza a saltos: el resorte los suaviza. Con movimiento reducido
  // se usa el progreso crudo (no hay viaje que suavizar).
  const suave = useSpring(scrollYProgress, { stiffness: 120, damping: 38, mass: 0.6 });
  const progreso = reducido ? scrollYProgress : suave;

  // El tramo viaja por ref a los useFrame (sin renders por frame); React sólo se entera
  // cuando cambia el tipo de tramo, su índice o el hito activo.
  const refTramo = useRef(tramoDe(0, N));
  const [vista, setVista] = useState({ tipo: 'estancia', indice: 0, activo: 0 });
  const actualizar = useCallback((p) => {
    const tramo = tramoDe(p, N);
    refTramo.current = tramo;
    const activo = activoDe(tramo);
    setVista((previa) =>
      previa.tipo === tramo.tipo && previa.indice === tramo.indice && previa.activo === activo
        ? previa
        : { tipo: tramo.tipo, indice: tramo.indice, activo }
    );
  }, []);
  useMotionValueEvent(progreso, 'change', actualizar);
  // Estado inicial: al recargar con el scroll a mitad de la sección ya hay un progreso.
  useEffect(() => actualizar(progreso.get()), [actualizar, progreso]);

  // Origen de cada viaje (el hito del que se salió) y contador de visitas: el destino se
  // remonta al empezar el viaje para que su animación arranque de cero al llegar.
  const refUltimaEstancia = useRef(0);
  const [origen, setOrigen] = useState(0);
  const [visitas, setVisitas] = useState(() => hitos.map(() => 0));
  useEffect(() => {
    if (vista.tipo === 'estancia') {
      refUltimaEstancia.current = vista.indice;
      return;
    }
    const desde = refUltimaEstancia.current === vista.indice + 1 ? vista.indice + 1 : vista.indice;
    const destino = desde === vista.indice ? vista.indice + 1 : vista.indice;
    setOrigen(desde);
    setVisitas((previas) => previas.map((v, i) => (i === destino ? v + 1 : v)));
  }, [vista.tipo, vista.indice]);

  // Montaje diferido del canvas (cerca) y render sólo a la vista (enPantalla).
  const [cerca, setCerca] = useState(false);
  const [enPantalla, setEnPantalla] = useState(false);
  useEffect(() => {
    const contenedor = refContenedor.current;
    const panel = refPanel.current;
    if (!contenedor || !panel) return undefined;
    const precarga = new IntersectionObserver(([e]) => e.isIntersecting && setCerca(true), { rootMargin: '300px' });
    const aLaVista = new IntersectionObserver(([e]) => setEnPantalla(e.isIntersecting), { threshold: 0.5 });
    precarga.observe(contenedor);
    aLaVista.observe(panel);
    return () => {
      precarga.disconnect();
      aLaVista.disconnect();
    };
  }, []);

  // Llegada: el fondo y el encabezado aparecen a los 400 ms; la bio, cuando el modelo
  // cumplió su tiempo (primero el modelo, después la bio).
  const [presente, setPresente] = useState(false);
  const [bioVisible, setBioVisible] = useState(false);
  useEffect(() => {
    setPresente(false);
    setBioVisible(false);
    if (vista.tipo !== 'estancia' || !enPantalla) return undefined;
    const llegada = setTimeout(() => setPresente(true), reducido ? 0 : ESPERA_LLEGADA_MS);
    const bio = setTimeout(() => setBioVisible(true), reducido ? 0 : tiempoModeloMs(hitos[vista.indice].id));
    return () => {
      clearTimeout(llegada);
      clearTimeout(bio);
    };
  }, [vista.tipo, vista.indice, enPantalla, reducido]);

  // Último gesto real del usuario (ref, sin renders extra): se actualiza con
  // interacción en ventana. El scrollAProgreso programático del autoplay NO pasa
  // por estos listeners, así que no cuenta como gesto.
  const refUltimoGesto = useRef(null);
  // Animación de scroll en curso (ver scrollAProgreso): un gesto real la corta.
  const refAnimacion = useRef(0);
  useEffect(() => {
    const marcar = () => {
      refUltimoGesto.current = Date.now();
      cancelAnimationFrame(refAnimacion.current);
      refAnimacion.current = 0;
    };
    window.addEventListener('pointerdown', marcar, { passive: true });
    // La inercia del touchpad sigue mandando eventos de rueda chiquitos después de
    // un click en el minimapa: no deben cortar el salto. Sólo cuenta un giro real.
    const marcarRueda = (evento) => {
      if (Math.abs(evento.deltaY) > 6) marcar();
    };
    window.addEventListener('wheel', marcarRueda, { passive: true });
    window.addEventListener('touchstart', marcar, { passive: true });
    window.addEventListener('keydown', marcar);
    return () => {
      window.removeEventListener('pointerdown', marcar);
      window.removeEventListener('wheel', marcarRueda);
      window.removeEventListener('touchstart', marcar);
      window.removeEventListener('keydown', marcar);
    };
  }, []);

  // Destino de un salto programático (minimapa o imán): mientras el scroll suave
  // viaja hacia él, el imán no interviene para no desviarlo a un hito intermedio.
  const refDestino = useRef(null);
  const scrollAProgreso = useCallback(
    (p) => {
      const contenedor = refContenedor.current;
      if (!contenedor) return;
      const recorrido = contenedor.offsetHeight - window.innerHeight;
      const arriba = contenedor.getBoundingClientRect().top + window.scrollY;
      const desde = window.scrollY;
      const hasta = arriba + p * recorrido;
      cancelAnimationFrame(refAnimacion.current);
      refAnimacion.current = 0;
      if (reducido) {
        refDestino.current = null;
        window.scrollTo({ top: hasta, behavior: 'instant' });
        return;
      }
      // Duración según cuántos viajes hay que recorrer (un salto largo del minimapa
      // tiene tope). 'instant' en cada paso: el CSS del sitio puede pedir scroll suave.
      const largoViaje = (recorrido * PESO_VIAJE) / pesoTotal(N);
      const duracion = Math.min(MS_MAXIMO_SALTO, Math.max(600, (Math.abs(hasta - desde) / largoViaje) * MS_POR_VIAJE));
      refDestino.current = { p, expira: Date.now() + duracion + 1000 };
      const inicio = performance.now();
      const paso = (ahora) => {
        const t = Math.min(1, (ahora - inicio) / duracion);
        window.scrollTo({ top: desde + (hasta - desde) * suaveEntradaSalida(t), behavior: 'instant' });
        refAnimacion.current = t < 1 ? requestAnimationFrame(paso) : 0;
      };
      refAnimacion.current = requestAnimationFrame(paso);
    },
    [reducido]
  );
  useEffect(() => () => cancelAnimationFrame(refAnimacion.current), []);
  const irAlHito = useCallback(
    (i) => {
      // Click en el minimapa: el usuario tomó control, cuenta como gesto.
      refUltimoGesto.current = Date.now();
      scrollAProgreso(progresoDeEstancia(i, N));
    },
    [scrollAProgreso]
  );

  // Imán: si el usuario suelta el scroll a mitad de un viaje, lo termina (o lo deshace).
  useEffect(() => {
    let espera = 0;
    let dedos = 0;
    // Hacia dónde se venía scrolleando: el imán termina el viaje en ese sentido.
    let ultimaY = window.scrollY;
    let direccion = 0;
    const intentar = () => {
      const contenedor = refContenedor.current;
      if (dedos > 0 || !contenedor || document.documentElement.dataset.sinIman) return;
      // Salto programático en vuelo: se espera a llegar (o al tiempo límite).
      const destino = refDestino.current;
      if (destino) {
        const llego = Math.abs(scrollYProgress.get() - destino.p) < 0.002;
        if (!llego && Date.now() <= destino.expira) return;
        refDestino.current = null;
      }
      const caja = contenedor.getBoundingClientRect();
      // Sólo con el panel fijo en pantalla (no al entrar o salir de la sección).
      if (caja.top > 1 || caja.bottom < window.innerHeight - 1) return;
      const objetivo = imanDe(scrollYProgress.get(), N, direccion);
      if (objetivo != null) scrollAProgreso(objetivo);
    };
    const alScroll = () => {
      const y = window.scrollY;
      if (y !== ultimaY) direccion = Math.sign(y - ultimaY);
      ultimaY = y;
      clearTimeout(espera);
      espera = setTimeout(intentar, ESPERA_IMAN_MS);
    };
    const alTocar = (evento) => {
      dedos = evento.touches.length;
      if (!dedos) alScroll();
    };
    window.addEventListener('scroll', alScroll, { passive: true });
    window.addEventListener('touchstart', alTocar, { passive: true });
    window.addEventListener('touchend', alTocar, { passive: true });
    window.addEventListener('touchcancel', alTocar, { passive: true });
    return () => {
      clearTimeout(espera);
      window.removeEventListener('scroll', alScroll);
      window.removeEventListener('touchstart', alTocar);
      window.removeEventListener('touchend', alTocar);
      window.removeEventListener('touchcancel', alTocar);
    };
  }, [scrollYProgress, scrollAProgreso]);

  // Autoplay: si no se toca nada en el primer hito, la línea de tiempo se
  // reproduce sola entera; si el usuario la deja pausada más de 2 min, retoma.
  // Al llegar a cada estancia este efecto reprograma el siguiente avance, así
  // la cadena recorre todos los hitos sin más intervención.
  useEffect(() => {
    // Movimiento reducido: sin autoplay, por accesibilidad.
    if (reducido) return undefined;
    // Capturas: mismo interruptor que el imán (sólo para verificación).
    if (document.documentElement.dataset.sinIman) return undefined;
    // Sólo desde una estancia con siguiente; en el último hito no hace nada.
    if (vista.tipo !== 'estancia' || vista.indice >= N - 1) return undefined;
    // Fuera de pantalla no se programa nada (al volver, enPantalla re-ejecuta).
    if (!enPantalla) return undefined;
    const i = vista.indice;
    // Cada escena+bio se deja ver (tiempo del modelo + 3 s) antes de avanzar.
    const dwell = tiempoModeloMs(hitos[i].id) + EXTRA_BIO_MS;
    // Arranque: en la estancia 0 sin gestos previos se espera el inicio; si el
    // usuario ya tomó control, se respeta la pausa de 2 min desde su gesto.
    const tomado = refUltimoGesto.current != null;
    const haceCuanto = tomado ? Date.now() - refUltimoGesto.current : 0;
    const base = !tomado && i === 0 ? INICIO_AUTO_MS : dwell;
    const espera = tomado && haceCuanto < PAUSA_AUTO_MS ? PAUSA_AUTO_MS - haceCuanto : base;
    const programadoEn = Date.now();
    let id = 0;
    function reprogramar(ms) {
      clearTimeout(id);
      id = setTimeout(tick, ms);
    }
    function tick() {
      // Gesto durante la espera: el usuario tomó control, no se pelea; se
      // reprograma la pausa completa desde ese gesto.
      const ultimo = refUltimoGesto.current;
      if (ultimo != null && ultimo > programadoEn) {
        reprogramar(Math.max(0, PAUSA_AUTO_MS - (Date.now() - ultimo)));
        return;
      }
      // Pestaña oculta: no se avanza (al volver, la llegada reprograma).
      if (document.hidden) return;
      // Capturas: el interruptor puede aparecer después de programar.
      if (document.documentElement.dataset.sinIman) return;
      const contenedor = refContenedor.current;
      if (!contenedor) return;
      // Misma guarda que el imán: sólo con el panel fijo en pantalla.
      const caja = contenedor.getBoundingClientRect();
      if (caja.top > 1 || caja.bottom < window.innerHeight - 1) return;
      // scrollAProgreso setea refDestino (sólo lectura aquí): el imán no pelea.
      scrollAProgreso(progresoDeEstancia(i + 1, N));
    }
    id = setTimeout(tick, espera);
    return () => clearTimeout(id);
  }, [vista.tipo, vista.indice, enPantalla, reducido, scrollAProgreso]);

  const hito = hitos[vista.activo];
  const lado = esMovil ? 'arriba' : vista.activo % 2 === 0 ? 'izquierda' : 'derecha';
  const textosVisibles = vista.tipo === 'estancia' && presente;

  return (
    <section id="sobre-mi" ref={refContenedor} className={styles.contenedor} style={{ '--peso': pesoTotal(N) }}>
      <div ref={refPanel} className={styles.panel} data-lado={lado} data-tipo={vista.tipo}>
        <div className={styles.fondo} data-presente={textosVisibles}>
          <FondoHito hitos={hitos} activo={vista.activo} presente={textosVisibles} />
        </div>
        <div className={styles.mundo} data-fundido={reducido && vista.tipo === 'viaje'}>
          {cerca ? (
            <LimiteErrores onError={onFallo}>
              <MundoColumna
                hitos={hitos}
                refTramo={refTramo}
                activo={vista.activo}
                tipo={vista.tipo}
                origen={origen}
                visitas={visitas}
                lado={lado}
                esMovil={esMovil}
                reducido={reducido}
                claro={claro}
                visible={enPantalla}
                onError={onFallo}
              />
            </LimiteErrores>
          ) : null}
        </div>
        <AnioViaje hitos={hitos} progreso={progreso} oculto={reducido} />
        <h2 className={styles.etiqueta}>Sobre mí</h2>
        <div className={styles.textos} data-textos data-visible={textosVisibles} data-bio={bioVisible}>
          {/* Se monta al llegar: así el año y el título se "descifran" cada vez. */}
          {textosVisibles ? <EncabezadoHito hito={hito} /> : null}
          <DescripcionHito hito={hito} visible={bioVisible} />
        </div>
        <Minimapa hitos={hitos} progreso={progreso} activo={vista.activo} onIr={irAlHito} />
      </div>
    </section>
  );
}

export default function SobreMi() {
  // En el servidor y en el primer render se arma el recorrido; si no hay WebGL (o el
  // mundo 3D falla) se cambia a la lista plana.
  const [plano, setPlano] = useState(false);
  useEffect(() => {
    if (!hayWebGL()) setPlano(true);
  }, []);
  const alFallar = useCallback(() => setPlano(true), []);
  if (hitos.length === 0) return null;
  return plano ? <SobreMiPlano hitos={hitos} /> : <SobreMiRecorrido onFallo={alFallar} />;
}
