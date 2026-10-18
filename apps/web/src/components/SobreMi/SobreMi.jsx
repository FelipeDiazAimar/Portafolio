'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useSpring } from 'framer-motion';
import hitos from '@/data/hitos.json';
import useConsulta from '@/hooks/useConsulta.js';
import useTema from '@/hooks/useTema.js';
import { PESO_VIAJE, activoDe, imanDe, pesoTotal, progresoDeEstado, progresoDeEstancia, tramoDe } from '@/lib/columna/recorrido.js';
import { tiempoModeloMs } from '@/lib/tiempoModelo.js';
import { bandasDeUnion } from '@/lib/uniones.js';
import { hayWebGL } from './Escena3D/soporteWebGL.js';
import { precargarEscenas } from './Escena3D/escenas/index.js';
import LimiteErrores from './Escena3D/LimiteErrores.jsx';
import FondoHito from './FondoHito.jsx';
import EncabezadoHito from './EncabezadoHito.jsx';
import DescripcionHito from './DescripcionHito.jsx';
import Minimapa from './Minimapa.jsx';
import AnioViaje from './AnioViaje.jsx';
import TextoTrazo from '@/components/TextoTrazo/TextoTrazo.jsx';
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
// El minimapa es navegación: el salto es rápido (con el ritmo de cine, ir de Origen a
// Hoy tardaba 25 s y cualquier giro de la rueda lo cortaba a mitad de camino).
// Es un salto de varios hitos y tiene que sentirse como una recorrida tranquila: lento,
// parejo y con arranque y frenada suaves (sin modelos ni primera persona de por medio).
const RITMO_MINIMAPA = { msPorViaje: 2100, maximo: 9000, suave: (t) => -(Math.cos(Math.PI * t) - 1) / 2 };

// Arranca y frena despacio.
function suaveEntradaSalida(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function SobreMiRecorrido({ onFallo }) {
  const refContenedor = useRef(null);
  const refPanel = useRef(null);
  const reducido = Boolean(useReducedMotion());
  const esMovil = useConsulta('(max-width: 768px)');
  const refEsMovil = useRef(esMovil);
  refEsMovil.current = esMovil;
  const claro = useTema().tema === 'light';

  const { scrollYProgress } = useScroll({ target: refContenedor, offset: ['start start', 'end end'] });
  // La rueda del mouse avanza a saltos: el resorte los suaviza. Con movimiento reducido
  // se usa el progreso crudo (no hay viaje que suavizar).
  const suave = useSpring(scrollYProgress, { stiffness: 120, damping: 38, mass: 0.6 });
  // En un salto largo del minimapa la animación recorre los hitos sin pausas, y el resorte
  // las volvería a meter (la zona de reposo de cada hito se "come" tiempo del resorte): ahí se
  // usa el progreso crudo. Fuera de eso, el suavizado de siempre.
  const refSalto = useRef(null);
  const progresoMostrado = useMotionValue(scrollYProgress.get());
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    if (refSalto.current) progresoMostrado.set(v);
  });
  useMotionValueEvent(suave, 'change', (v) => {
    if (!refSalto.current) progresoMostrado.set(v);
  });
  const progreso = reducido ? scrollYProgress : progresoMostrado;

  // El tramo viaja por ref a los useFrame (sin renders por frame); React sólo se entera
  // cuando cambia el tipo de tramo, su índice o el hito activo.
  const refTramo = useRef(tramoDe(0, N));
  // Sentido del viaje en curso (+1 bajando, -1 subiendo): se decide al salir de un hito, según
  // por qué lado del tramo se entra, y NO cambia hasta llegar a otro hito. Así, si se retrocede
  // a mitad de camino, la cámara sigue mirando para el mismo lado. La cámara y el mundo lo leen
  // de `refTramo.current.sentido`.
  const refSentido = useRef(1);
  const refTipoPrevio = useRef('estancia');
  const [vista, setVista] = useState({ tipo: 'estancia', indice: 0, activo: 0 });
  const actualizar = useCallback((p) => {
    const tramo = tramoDe(p, N);
    if (tramo.tipo === 'viaje') {
      if (refTipoPrevio.current !== 'viaje') refSentido.current = tramo.t < 0.5 ? 1 : -1;
    } else {
      refSentido.current = 1;
    }
    refTipoPrevio.current = tramo.tipo;
    refTramo.current = tramo.tipo === 'viaje' ? { ...tramo, sentido: refSentido.current } : tramo;
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
  // remonta al empezar el viaje SÓLO si ya había estado activo (ahí su animación quedó
  // avanzada y hay que arrancarla de cero). La primera vez no hace falta —una escena que no
  // fue activa no avanza— y remontarla al despegar costaba un tirón justo al salir.
  const refUltimaEstancia = useRef(0);
  const refActivadas = useRef(new Set([0]));
  const [origen, setOrigen] = useState(0);
  const [visitas, setVisitas] = useState(() => hitos.map(() => 0));
  useEffect(() => {
    if (vista.tipo === 'estancia') {
      refUltimaEstancia.current = vista.indice;
      refActivadas.current.add(vista.indice);
      return;
    }
    const desde = refUltimaEstancia.current === vista.indice + 1 ? vista.indice + 1 : vista.indice;
    const destino = desde === vista.indice ? vista.indice + 1 : vista.indice;
    setOrigen(desde);
    if (refActivadas.current.has(destino)) {
      setVisitas((previas) => previas.map((v, i) => (i === destino ? v + 1 : v)));
    }
  }, [vista.tipo, vista.indice]);

  // Montaje diferido del canvas (cerca) y render sólo a la vista (enPantalla).
  const [cerca, setCerca] = useState(false);
  const [enPantalla, setEnPantalla] = useState(false);
  useEffect(() => {
    const contenedor = refContenedor.current;
    const panel = refPanel.current;
    if (!contenedor || !panel) return undefined;
    const precarga = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) {
          // en el celular el canvas se desmonta al alejarse (memoria de video); en la PC queda montado
          if (refEsMovil.current) setCerca(false);
          return;
        }
        setCerca(true);
        // Los chunks de todas las escenas se bajan ya: pedirlos en pleno viaje era otro tirón.
        precargarEscenas();
      },
      { rootMargin: '300px' }
    );
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
      // Un salto cortado a mitad de camino no se termina: si siguiera "en vuelo", el imán
      // esperaría hasta 26 s a que llegue y no actuaría (se quedaba parado entre hitos).
      refDestino.current = null;
      if (refSalto.current) terminarSalto();
    };
    // Un click (o un toque) durante el salto largo del minimapa NO lo frena: sólo cuenta
    // como gesto. Lo frenan el giro de la rueda y el teclado.
    const marcarClick = () => {
      refUltimoGesto.current = Date.now();
      if (!refSalto.current) marcar();
    };
    window.addEventListener('pointerdown', marcarClick, { passive: true });
    // La inercia del touchpad sigue mandando eventos de rueda chiquitos después de
    // un click en el minimapa: no deben cortar el salto. Sólo cuenta un giro real.
    const marcarRueda = (evento) => {
      if (Math.abs(evento.deltaY) > 6) marcar();
    };
    window.addEventListener('wheel', marcarRueda, { passive: true });
    window.addEventListener('touchstart', marcarClick, { passive: true });
    window.addEventListener('keydown', marcar);
    return () => {
      window.removeEventListener('pointerdown', marcarClick);
      window.removeEventListener('wheel', marcarRueda);
      window.removeEventListener('touchstart', marcarClick);
      window.removeEventListener('keydown', marcar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Destino de un salto programático (minimapa o imán): mientras el scroll suave
  // viaja hacia él, el imán no interviene para no desviarlo a un hito intermedio.
  const refDestino = useRef(null);
  const scrollAProgreso = useCallback(
    (p, { msPorViaje = MS_POR_VIAJE, maximo = MS_MAXIMO_SALTO, suave = suaveEntradaSalida, enEstado = null } = {}) => {
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
      // Salto largo: se anima el estado (índice de hito fraccionario) y no el scroll, y de ahí
      // se saca el scroll salteando las zonas de reposo de los hitos que se cruzan.
      if (enEstado) {
        const duracionSalto = Math.min(maximo, Math.max(900, Math.abs(enEstado.hasta - enEstado.desde) * msPorViaje));
        refDestino.current = { p, expira: Date.now() + duracionSalto + 1500 };
        const comienzo = performance.now();
        const pasoSalto = (ahora) => {
          const t = Math.min(1, (ahora - comienzo) / duracionSalto);
          const s = enEstado.desde + (enEstado.hasta - enEstado.desde) * suave(t);
          window.scrollTo({ top: arriba + progresoDeEstado(s, N) * recorrido, behavior: 'instant' });
          if (t < 1) {
            refAnimacion.current = requestAnimationFrame(pasoSalto);
          } else {
            refAnimacion.current = 0;
            window.scrollTo({ top: hasta, behavior: 'instant' });
          }
        };
        refAnimacion.current = requestAnimationFrame(pasoSalto);
        return;
      }
      // Duración según cuántos viajes hay que recorrer (un salto largo del minimapa
      // tiene tope). 'instant' en cada paso: el CSS del sitio puede pedir scroll suave.
      const largoViaje = (recorrido * PESO_VIAJE) / pesoTotal(N);
      const duracion = Math.min(maximo, Math.max(600, (Math.abs(hasta - desde) / largoViaje) * msPorViaje));
      refDestino.current = { p, expira: Date.now() + duracion + 1000 };
      const inicio = performance.now();
      const paso = (ahora) => {
        const t = Math.min(1, (ahora - inicio) / duracion);
        window.scrollTo({ top: desde + (hasta - desde) * suave(t), behavior: 'instant' });
        refAnimacion.current = t < 1 ? requestAnimationFrame(paso) : 0;
      };
      refAnimacion.current = requestAnimationFrame(paso);
    },
    [reducido]
  );
  useEffect(() => () => cancelAnimationFrame(refAnimacion.current), []);
  // Salto largo por el minimapa (a un hito que no es el siguiente ni el anterior): mientras
  // dura, los modelos 3D no se ven, para que el viaje sea rápido. Termina al llegar.
  const [saltoRapido, setSaltoRapido] = useState(false);
  const refActivo = useRef(0);
  refActivo.current = vista.activo;
  const refDestinoSalto = useRef(null);
  // `refSalto` (declarado arriba) = origen y destino del salto en curso; lo lee también el año
  // que cuenta durante el viaje.
  // Fin del salto (llegó, se cortó con la rueda o venció el tiempo): se vuelve al resorte
  // sin que el progreso mostrado pegue un salto.
  const terminarSalto = useCallback(() => {
    refDestinoSalto.current = null;
    refSalto.current = null;
    suave.jump(scrollYProgress.get());
    progresoMostrado.set(scrollYProgress.get());
    setSaltoRapido(false);
  }, [suave, scrollYProgress, progresoMostrado]);
  useEffect(() => {
    if (refDestinoSalto.current === null) return undefined;
    if (vista.tipo === 'estancia' && vista.indice === refDestinoSalto.current) terminarSalto();
    return undefined;
  }, [vista.tipo, vista.indice, terminarSalto]);
  // Por si el salto se corta a medias (un giro de la rueda) y no llega: nunca queda oculto.
  useEffect(() => {
    if (!saltoRapido) return undefined;
    const id = setTimeout(terminarSalto, RITMO_MINIMAPA.maximo + 2500);
    return () => clearTimeout(id);
  }, [saltoRapido, terminarSalto]);
  const irAlHito = useCallback(
    (i) => {
      // Click en el minimapa: el usuario tomó control, cuenta como gesto.
      refUltimoGesto.current = Date.now();
      const largo = !reducido && Math.abs(i - refActivo.current) > 1;
      if (largo) {
        refDestinoSalto.current = i;
        refSalto.current = { desde: refActivo.current, hasta: i };
        setSaltoRapido(true);
      }
      scrollAProgreso(
        progresoDeEstancia(i, N),
        largo ? { ...RITMO_MINIMAPA, enEstado: { desde: refActivo.current, hasta: i } } : RITMO_MINIMAPA
      );
    },
    [scrollAProgreso, reducido]
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

  // Uniones con el hero (arriba) y con Proyectos (abajo): dos capas del color de la página, pegadas
  // al borde y tan altas como lo que se ve de ese borde. Con el panel ocupando la pantalla miden 0 y
  // no tocan ningún hito. Se escribe el alto directo en el nodo, sin estado: cambia en cada scroll.
  const refUnionArriba = useRef(null);
  const refUnionAbajo = useRef(null);
  useEffect(() => {
    const contenedor = refContenedor.current;
    if (!contenedor) return undefined;
    let cuadro = 0;
    let ultimoArriba = -1;
    let ultimoAbajo = -1;
    function actualizar() {
      cuadro = 0;
      const caja = contenedor.getBoundingClientRect();
      const b = bandasDeUnion(caja.top, caja.bottom, window.innerHeight, 0.5);
      if (b.arriba !== ultimoArriba && refUnionArriba.current) {
        ultimoArriba = b.arriba;
        refUnionArriba.current.style.height = `${b.arriba}px`;
      }
      if (b.abajo !== ultimoAbajo && refUnionAbajo.current) {
        ultimoAbajo = b.abajo;
        refUnionAbajo.current.style.height = `${b.abajo}px`;
      }
    }
    function pedir() {
      if (!cuadro) cuadro = requestAnimationFrame(actualizar);
    }
    actualizar();
    window.addEventListener('scroll', pedir, { passive: true });
    window.addEventListener('resize', pedir);
    return () => {
      cancelAnimationFrame(cuadro);
      window.removeEventListener('scroll', pedir);
      window.removeEventListener('resize', pedir);
    };
  }, []);

  const hito = hitos[vista.activo];
  const lado = esMovil ? 'arriba' : vista.activo % 2 === 0 ? 'izquierda' : 'derecha';
  const textosVisibles = vista.tipo === 'estancia' && presente;

  return (
    <section id="sobre-mi" ref={refContenedor} className={styles.contenedor} style={{ '--peso': pesoTotal(N) }}>
      <div ref={refUnionArriba} className={styles.unionArriba} aria-hidden="true" />
      <div ref={refUnionAbajo} className={styles.unionAbajo} aria-hidden="true" />
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
                indiceViaje={vista.indice}
                ocultarModelos={saltoRapido}
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
        <AnioViaje hitos={hitos} progreso={progreso} oculto={reducido} refSalto={refSalto} />
        <h2 className={styles.etiqueta}>
          <TextoTrazo texto="Sobre mí" claseTexto={styles.etiquetaTrazo} duracion={2.2} grosor={0.8} alVer />
        </h2>
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
