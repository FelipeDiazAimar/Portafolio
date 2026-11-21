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
import { marcaDe } from '@/data/marcas.js';
import { hayWebGL } from '@/lib/soporteWebGL.js';
import { cuandoInactivo, esEscritorio } from '@/lib/precarga.js';
import VistaProyecto from './VistaProyecto.jsx';
import styles from './Proyectos.module.css';
import useEmbudo from '@/hooks/useEmbudo.js';
import { gsap } from 'gsap';

// Marquesina: la grilla inclinada deja huecos en las esquinas si sólo están los 13 proyectos,
// así que se repiten los necesarios (más cuanto más grande la pantalla) hasta cubrirla, sin
// agrandar las tarjetas. Medidas de la grilla original (en px de su caja, que escala sola):
// 4 columnas en 1720 px con 32 de separación → tarjeta de 406 × 293.
const ANCHO_TARJETA = 406;
const ALTO_TARJETA = 293;
const SEPARACION_TARJETAS = 32;
const limitar = (x, min, max) => Math.min(max, Math.max(min, x));
// Teléfono: pantalla angosta, o táctil y baja (acostado)
const CONSULTA_TACTIL_BAJO = '(pointer: coarse) and (max-height: 520px)';
const CONSULTA_MOVIL = `(max-width: 768px), ${CONSULTA_TACTIL_BAJO}`;

// Cuántas columnas y copias hacen falta para el tamaño del panel, y dónde poner la grilla
// para que el centro de lo que ocupa caiga en el centro de la sección. Un vector (u, v) de
// la grilla se ve en pantalla como (0,707·(u+v), 0,406·(v−u)) por la inclinación.
export function configurarMarquesina(ancho, alto, total, tactilBajo = false) {
  const escala = ancho >= 1024 ? 1 : ancho >= 640 ? 0.75 : 0.5;
  const k = Math.max(ancho / 1917, alto / 910) / escala;
  // Celular: también con el teléfono acostado (ancho de PC pero táctil y bajo): ahí la grilla de PC, con
  // más de 100 tarjetas, hacía que el iPhone cerrara la página al girarlo
  const chico = ancho < 768 || tactilBajo;
  // Hasta 13 columnas: más que proyectos obligaría a repetir uno en la misma fila.
  // Celular: menos tarjetas (cada una es una capa 3D; el iPhone se queda sin memoria con 54)
  // Celular: la misma grilla diagonal, más angosta y con menos filas (unas 24 tarjetas por tanda)
  const columnas = chico ? 5 : limitar(Math.ceil(8 * k), 6, 13);
  const lado = chico ? 2 : limitar(Math.ceil(5 * k), 4, 9);
  const filas = Math.ceil(total / columnas) + 2 * lado;
  // Celular: la grilla se dibuja ya al tamaño con que se ve (sin scale de por medio): todas las medidas
  // en px se multiplican por `f`. En PC f = 1 y nada cambia.
  const f = chico ? (ancho < 640 ? 0.5 : ancho < 1024 ? 0.75 : 1) : 1;
  const anchoCaja = columnas * ANCHO_TARJETA + (columnas - 1) * SEPARACION_TARJETAS;
  const altoFilas = filas * (ALTO_TARJETA + SEPARACION_TARJETAS);
  return {
    columnas,
    filas,
    f,
    anchoCaja: anchoCaja * f,
    posicion: {
      right: `${Math.round((-anchoCaja / 2 + (0.707 * (anchoCaja + altoFilas)) / 2) * f)}px`,
      top: `${Math.round((860 - (0.406 * (altoFilas - anchoCaja)) / 2) * f)}px`,
    },
  };
}
// Cuánto se ve el título antes de irse y dejar solo la marquesina.
const TITULO_VISIBLE_MS = 4000;
// Entrada con piezas 3D: cuánto flotan antes de volverse tarjetas, y cuánto queda después el título.
const PIEZAS_FLOTAN_MS = 2600;
// ... y cuánto flotan ya como tarjetas 3D antes de ir cada una a su lugar.
const TARJETAS_FLOTAN_MS = 1500;
const TITULO_TRAS_PIEZAS_MS = 1300;
// Cómo se ve en pantalla un lado de la grilla inclinada (rotateX 55° · rotateZ −45°).
const INCLINA_X = 0.7071;
const INCLINA_Y = 0.4056;
// Mezcla de dos colores #rrggbb (cuánto del primero).
const mezclar = (a, b, cuanto) => {
  const canal = (hex, i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => Math.round(canal(a, i) * cuanto + canal(b, i) * (1 - cuanto)).toString(16).padStart(2, '0')).join('')}`;
};
const ESCALA_TITULO = 0.2;
// Celular: el título instalado va centrado en el header y un poco más grande (~21 px)
const ESCALA_TITULO_MOVIL = 0.43;
// Distancia del borde derecho al título ya instalado: 2rem de margen + 64 px del toggle de tema + 1rem
// de aire. Tiene que coincidir con `.tituloHeader { right }` del CSS: así viaja directo a su lugar
// final, sin pasar antes por debajo del toggle.
const MARGEN_TITULO = 112;
const ALTO_HEADER = 72;

export default function Proyectos() {
  const proyectos = useMemo(() => listarProyectos(), []);
  const reducido = Boolean(useReducedMotion());
  const cifras = resumenCifras();
  const textoCifras = `${cifras.total} proyectos · ${cifras.clientes} clientes · ${cifras.laborales} sistemas en planta`;

  const refPanel = useRef(null);
  const [tamano, setTamano] = useState({ ancho: 0, alto: 0 });
  // Celular: la marquesina (decenas de tarjetas en capas 3D) sólo existe con la sección cerca de la pantalla;
  // el resto del tiempo no ocupa memoria (el iPhone cierra la página por memoria). En PC siempre montada.
  const [marquesinaCerca, setMarquesinaCerca] = useState(true);
  useLayoutEffect(() => {
    const panel = refPanel.current;
    const mq = window.matchMedia(CONSULTA_MOVIL);
    if (!panel) return undefined;
    const lejos = () => {
      const r = panel.getBoundingClientRect();
      return r.top > window.innerHeight * 2 || r.bottom < -window.innerHeight;
    };
    const evaluar = () => setMarquesinaCerca(!mq.matches || !lejos());
    evaluar();
    const o = new IntersectionObserver(([e]) => setMarquesinaCerca(!mq.matches || e.isIntersecting), { rootMargin: '100% 0px' });
    o.observe(panel);
    mq.addEventListener('change', evaluar);
    return () => {
      o.disconnect();
      mq.removeEventListener('change', evaluar);
    };
  }, []);
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
  // Celular: de qué lado entra el proyecto nuevo (+1 = viene de la derecha, -1 = de la izquierda, 0 = sin
  // deslizar). Sólo lo fijan las flechas y el gesto de deslizar.
  const [direccion, setDireccion] = useState(0);
  const elegir = useCallback((slug, dir) => {
    if (slug === refActivo.current) return;
    const anterior = refActivo.current;
    setDireccion(dir === 1 || dir === -1 ? dir : 0);
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
    // Con el recorrido infinito hay dos tandas: se usa la tarjeta (original o copia) más cercana al centro
    // del panel, que es la que se está viendo.
    const base0 = panel?.getBoundingClientRect();
    let tarjeta = null;
    let mejor = Infinity;
    panel?.querySelectorAll(`[data-clave="${slug}"], [data-copia="${slug}"]`).forEach((n) => {
      const r = n.getBoundingClientRect();
      const d = Math.hypot(r.left + r.width / 2 - (base0.left + base0.width / 2), r.top + r.height / 2 - (base0.top + base0.height / 2));
      if (d < mejor) {
        mejor = d;
        tarjeta = n;
      }
    });
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
  // Cada vez que la sección vuelve a la vista el título se dibuja de nuevo (cambia la key del trazo).
  const [vecesVista, setVecesVista] = useState(0);
  useEffect(() => {
    if (visible) setVecesVista((n) => n + 1);
  }, [visible]);
  // El título terminó de viajar al header y ahí queda como texto con hover.
  const [enHeader, setEnHeader] = useState(false);
  // entrada con piezas 3D en curso (ver más abajo)
  const [introActiva, setIntroActiva] = useState(false);
  const refTrasIntro = useRef(false);
  // La franja de arriba de la lista es blanca lisa; sólo con la lista scrolleada se le suma el blur.
  const [listaScrolleada, setListaScrolleada] = useState(false);
  // Adónde viaja el título: la esquina de arriba a la derecha, centrado en la fila del header.
  const refTitulo = useRef(null);
  const refTituloHeader = useRef(null);
  const [destinoTitulo, setDestinoTitulo] = useState({ x: 0, y: 0 });
  // Celular: el título va al centro del header (y sin tu nombre al lado: ver data-en-proyectos).
  const [movil, setMovil] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const leer = () => setMovil(mq.matches);
    leer();
    mq.addEventListener('change', leer);
    return () => mq.removeEventListener('change', leer);
  }, []);
  const escalaTitulo = movil ? ESCALA_TITULO_MOVIL : ESCALA_TITULO;
  useLayoutEffect(() => {
    if (!tituloVisto || !refTitulo.current || !tamano.ancho) return undefined;
    const titulo = refTitulo.current.querySelector('h2');
    const ancho = (titulo?.offsetWidth ?? refTitulo.current.offsetWidth) * escalaTitulo;
    const calcular = () => {
      // Celular: el destino es el título del header, que va fijo en la fila del header (con el notch).
      // Se mide en pantalla contra el centro de la cabecera (que no se anima), así viaja justo hasta ahí
      // aunque la sección no esté pegada al borde de arriba, y se corrige si la página se mueve mientras
      // viaja (antes se pasaba de largo).
      const cajaHeader = refTituloHeader.current?.getBoundingClientRect();
      const cajaBase = refTitulo.current?.parentElement?.getBoundingClientRect();
      const bloque = refTitulo.current;
      const desfaseTitulo = titulo ? titulo.offsetTop + titulo.offsetHeight / 2 - bloque.offsetHeight / 2 : 0;
      const medida = movil && cajaHeader && cajaBase && cajaBase.height > 0;
      setDestinoTitulo({
        // el título ya nace centrado en el panel: en celular se queda en x = 0
        x: movil ? 0 : tamano.ancho / 2 - MARGEN_TITULO - ancho / 2,
        // Centro de la fila del header (72 px de alto) respecto del centro del panel.
        y: medida
          ? // el título (no el bloque entero, que incluye las cifras) es lo que tiene que quedar en la fila
            cajaHeader.top + cajaHeader.height / 2 - (cajaBase.top + cajaBase.height / 2) - desfaseTitulo * escalaTitulo
          : ALTO_HEADER / 2 - tamano.alto / 2,
      });
    };
    calcular();
    if (!movil) return undefined;
    window.addEventListener('scroll', calcular, { passive: true });
    window.addEventListener('resize', calcular);
    return () => {
      window.removeEventListener('scroll', calcular);
      window.removeEventListener('resize', calcular);
    };
  }, [tituloVisto, tamano.ancho, tamano.alto, movil, escalaTitulo]);
  // Mientras la sección está a la vista, el header (en celular) no muestra tu nombre.
  useEffect(() => {
    document.documentElement.toggleAttribute('data-en-proyectos', visible);
    return () => document.documentElement.removeAttribute('data-en-proyectos');
  }, [visible]);
  useEffect(() => {
    if (!visible) {
      setTituloVisto(false);
      setEnHeader(false);
      return undefined;
    }
    // con las piezas 3D en pantalla el título se queda; después, un rato corto y se va
    if (introActiva) return undefined;
    const espera = refTrasIntro.current ? TITULO_TRAS_PIEZAS_MS : TITULO_VISIBLE_MS;
    refTrasIntro.current = false;
    const id = setTimeout(() => setTituloVisto(true), espera);
    return () => clearTimeout(id);
  }, [visible, introActiva]);
  // Sin animaciones (reduced-motion) el título no viaja: pasa directo al header, sin onAnimationComplete.
  useEffect(() => {
    if (tituloVisto && reducido) setEnHeader(true);
  }, [tituloVisto, reducido]);
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

  // Entrada de la sección: del otro lado de la puerta de "Sobre mí" (o la primera vez que la
  // sección entra en pantalla por otro camino) no están las tarjetas sino un montón de conectores
  // 3D en cruz que flotan y se chocan alrededor del título; el cursor los empuja. Al rato, o al
  // primer gesto, cada conector se vuelve una tarjeta 3D con la cara de su proyecto; después cada
  // tarjeta vuela a su lugar y se aplana: ahí se muestran las de verdad y la escena se retira. Sin WebGL, en celular o con movimiento
  // reducido no hay entrada: las tarjetas están desde el principio.
  const refFondo = useRef(null);
  const refDestello = useRef(null);
  const refCifras = useRef(null);
  const refLienzoIntro = useRef(null);
  // En la PC, los shaders de la entrada (piezas 3D) se compilan en un momento libre después de
  // cargar (en un lienzo aparte que se descarta: el navegador guarda lo compilado). Si no, la
  // primera llegada a la sección esperaba la compilación casi un segundo.
  useEffect(() => {
    if (!esEscritorio() || !hayWebGL()) return undefined;
    return cuandoInactivo(() => {
      import('./piezas/EscenaPiezas.js')
        .then(({ precalentarPiezas }) => precalentarPiezas())
        .catch(() => {});
    }, 5000);
  }, []);
  const refCajaIntro = useRef(null);
  const refIntro = useRef(null);
  const refIntroHecha = useRef(false);
  const refVisible = useRef(false);
  refVisible.current = visible;
  // Dónde está cada tarjeta a la vista, en px del panel (sin la escala que le pone el pasaje por
  // la puerta): su centro y sus dos lados tal como se ven en pantalla.
  const objetivos = useCallback(() => {
    const panel = refPanel.current;
    const caja = panel?.querySelector('[data-escala-marquee]');
    if (!panel || !caja) return [];
    const cp = panel.getBoundingClientRect();
    const s = cp.width / Math.max(1, panel.offsetWidth);
    const k = caja.getBoundingClientRect().width / Math.max(1, caja.offsetWidth) / s;
    const W = panel.offsetWidth;
    const H = panel.offsetHeight;
    const lista = [];
    panel.querySelectorAll('[data-mq-item] > div.overflow-hidden').forEach((el, id) => {
      const r = el.getBoundingClientRect();
      const x = (r.left + r.width / 2 - cp.left) / s;
      const y = (r.top + r.height / 2 - cp.top) / s;
      if (x < -W * 0.14 || x > W * 1.14 || y < -H * 0.2 || y > H * 1.2) return;
      const item = el.parentElement;
      const ancho = el.offsetWidth;
      const alto = el.offsetHeight;
      lista.push({ id, clave: item.dataset.clave ?? item.dataset.copia ?? '', x, y, ancho, alto, u: [ancho * k * INCLINA_X, -ancho * k * INCLINA_Y], v: [alto * k * INCLINA_X, alto * k * INCLINA_Y] });
    });
    return lista;
  }, []);
  const terminarIntro = useCallback(() => {
    const intro = refIntro.current;
    if (!intro) return;
    refIntro.current = null;
    intro.cancelada = true;
    intro.escena?.destruir();
    gsap.killTweensOf([refFondo.current, refLienzoIntro.current, refCajaIntro.current]);
    if (refCajaIntro.current) refCajaIntro.current.style.opacity = '';
    if (refLienzoIntro.current) refLienzoIntro.current.style.clipPath = '';
    if (refFondo.current) {
      refFondo.current.style.opacity = '';
      refFondo.current.style.pointerEvents = '';
    }
    if (refLienzoIntro.current) refLienzoIntro.current.style.opacity = '0';
    refTrasIntro.current = true;
    setIntroActiva(false);
  }, []);
  // Lo que necesita la escena de las piezas: dónde dibuja, dónde está cada tarjeta y qué lleva.
  const opcionesEscena = useCallback(() => {
    const caja = refCajaIntro.current;
    // lo que lleva la cara de cada tarjeta 3D: lo mismo que la tarjeta de verdad (ver TarjetaMarca)
    const info = new Map(
      proyectos.map((p) => {
        const marca = marcaDe(p.slug);
        return [p.slug, { color: p.color, tarjeta: marca.fondo ?? mezclar(p.color, '#07090f', 0.3), logo: marca.logo ?? null, nombre: marca.nombre ?? (marca.logo ? null : p.titulo), bajada: marca.bajada ?? null, claro: Boolean(marca.claro) }];
      })
    );
    return {
      lienzo: refLienzoIntro.current,
      panel: refPanel.current,
      objetivos,
      infoDe: (clave) => info.get(clave),
      claro: document.documentElement.dataset.theme === 'light',
      // el recuadro donde viven los conectores, en px del panel
      recuadro: () => ({ x: caja.offsetLeft, y: caja.offsetTop, w: caja.offsetWidth, h: caja.offsetHeight }),
      alFallar: terminarIntro,
    };
  }, [proyectos, objetivos, terminarIntro]);
  const empezarIntro = useCallback(() => {
    const panel = refPanel.current;
    const lienzo = refLienzoIntro.current;
    const caja = refCajaIntro.current;
    const fondo = refFondo.current;
    if (!panel || !lienzo || !caja || !fondo || refIntro.current || refActivo.current) return;
    if (reducido || window.matchMedia(CONSULTA_MOVIL).matches || !hayWebGL()) return;
    refIntroHecha.current = true;
    const intro = { escena: null, cancelada: false };
    refIntro.current = intro;
    setIntroActiva(true);
    // las tarjetas esperan escondidas (y sin recibir el mouse) hasta que las piezas lleguen
    fondo.style.opacity = '0';
    fondo.style.pointerEvents = 'none';
    lienzo.style.opacity = '1';
    caja.style.opacity = '1';
    import('./piezas/EscenaPiezas.js')
      .then(({ crearEscenaPiezas }) => {
        if (intro.cancelada) return;
        intro.escena = crearEscenaPiezas(opcionesEscena());
      })
      .catch(terminarIntro);
  }, [reducido, opcionesEscena, terminarIntro]);
  // La salida hacia "Sobre mí" es la entrada al revés: las tarjetas de la marquesina se levantan
  // y flotan en 3D, se vuelven conectores dentro del recuadro, y recién ahí se sale por la puerta
  // (ReelHitos espera el aviso `listo`). Los conectores quedan flotando mientras uno se aleja.
  const salirIntro = useCallback(
    (evento) => {
      const pedido = evento.detail;
      const panel = refPanel.current;
      const lienzo = refLienzoIntro.current;
      const caja = refCajaIntro.current;
      const fondo = refFondo.current;
      if (!pedido || !panel || !lienzo || !caja || !fondo || refIntro.current || refActivo.current) return;
      if (reducido || window.matchMedia(CONSULTA_MOVIL).matches || !hayWebGL()) return;
      pedido.tomado = true;
      const intro = { escena: null, cancelada: false, inversa: true };
      refIntro.current = intro;
      setIntroActiva(true);
      // el título vuelve del header al centro
      setTituloVisto(false);
      setEnHeader(false);
      const espera = (ms) => new Promise((resolver) => setTimeout(resolver, ms));
      const completo = 'inset(0px 0px 0px 0px round 0px)';
      lienzo.style.clipPath = completo;
      import('./piezas/EscenaPiezas.js')
        .then(async ({ crearEscenaPiezas }) => {
          if (intro.cancelada) return;
          intro.escena = crearEscenaPiezas({ ...opcionesEscena(), inversa: true });
          // dos cuadros: la escena ya dibujó sus tarjetas calcadas sobre las de verdad
          await new Promise((resolver) => requestAnimationFrame(() => requestAnimationFrame(resolver)));
          if (intro.cancelada) return;
          lienzo.style.opacity = '1';
          fondo.style.opacity = '0';
          fondo.style.pointerEvents = 'none';
          // el recuadro vuelve a cerrarse alrededor de las piezas
          const radio = getComputedStyle(caja).borderTopLeftRadius;
          const recorte = `inset(${caja.offsetTop}px ${panel.offsetWidth - caja.offsetLeft - caja.offsetWidth}px ${panel.offsetHeight - caja.offsetTop - caja.offsetHeight}px ${caja.offsetLeft}px round ${radio})`;
          gsap.fromTo(lienzo, { clipPath: completo }, { clipPath: recorte, duration: 0.8, ease: 'power3.inOut', delay: 0.7 });
          gsap.to(caja, { opacity: 1, duration: 0.7, ease: 'power2.out', delay: 0.7 });
          await intro.escena.desarmar();
          await espera(450);
          if (intro.cancelada) return;
          await intro.escena.desmutar();
          await espera(650);
        })
        .catch(() => terminarIntro())
        .finally(() => pedido.listo());
    },
    [reducido, opcionesEscena, terminarIntro]
  );
  useEffect(() => {
    window.addEventListener('portafolio:salida-proyectos', salirIntro);
    return () => window.removeEventListener('portafolio:salida-proyectos', salirIntro);
  }, [salirIntro]);
  // Los tres tiempos: conectores → tarjetas 3D → tarjetas planas. Corren con la sección ya en
  // pantalla (y el pasaje por la puerta terminado); cada uno dura un rato, o lo adelanta el primer
  // gesto. Si la sección se va de pantalla, se termina sin más.
  useEffect(() => {
    if (!introActiva) return undefined;
    let raf = 0;
    let desde = 0; // cuándo empezó a contar el tiempo de la etapa en curso
    let fuera = 0;
    // (la salida al revés la lleva salirIntro: acá sólo se la termina cuando ya se está afuera)
    const lista = () => Boolean(refIntro.current?.escena) && !refIntro.current.inversa && refVisible.current && !document.documentElement.dataset.portal;
    const avanzar = (ahora) => {
      const intro = refIntro.current;
      const escena = intro?.escena;
      if (!escena) return;
      const etapa = escena.etapa();
      if (etapa === 'conectores') {
        desde = 0;
        escena.mutar().then(() => {
          desde = performance.now();
        });
      } else if (etapa === 'tarjetas') {
        desde = ahora;
        // el recuadro se abre a toda la sección: las tarjetas salen de él hacia su lugar
        const lienzo = refLienzoIntro.current;
        const caja = refCajaIntro.current;
        const panel = refPanel.current;
        if (lienzo && caja && panel) {
          const radio = getComputedStyle(caja).borderTopLeftRadius;
          const recorte = `inset(${caja.offsetTop}px ${panel.offsetWidth - caja.offsetLeft - caja.offsetWidth}px ${panel.offsetHeight - caja.offsetTop - caja.offsetHeight}px ${caja.offsetLeft}px round ${radio})`;
          gsap.fromTo(lienzo, { clipPath: recorte }, { clipPath: 'inset(0px 0px 0px 0px round 0px)', duration: 0.7, ease: 'power3.inOut' });
          gsap.to(caja, { opacity: 0, duration: 0.6, ease: 'power2.out' });
        }
        escena.convertir().then(() => {
          if (intro.cancelada) return;
          // cada tarjeta quedó sobre la suya: aparecen las de verdad y la escena se funde
          gsap.to(refFondo.current, { opacity: 1, duration: 0.45, ease: 'power2.out' });
          gsap.to(refLienzoIntro.current, { opacity: 0, duration: 0.45, ease: 'power2.inOut', onComplete: terminarIntro });
        });
      }
    };
    const vigilar = (ahora) => {
      raf = requestAnimationFrame(vigilar);
      if (lista()) {
        fuera = 0;
        desde ||= ahora;
        const etapa = refIntro.current.escena.etapa();
        if ((etapa === 'conectores' && ahora - desde > PIEZAS_FLOTAN_MS) || (etapa === 'tarjetas' && ahora - desde > TARJETAS_FLOTAN_MS)) avanzar(ahora);
      } else if (!refVisible.current && !document.documentElement.dataset.portal) {
        // se fue de la sección: no queda una escena corriendo fuera de pantalla
        fuera ||= ahora;
        if (ahora - fuera > 700) terminarIntro();
      }
    };
    raf = requestAnimationFrame(vigilar);
    const alGesto = (evento) => {
      if (evento.type === 'keydown' && !['Enter', ' ', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp'].includes(evento.key)) return;
      const ahora = performance.now();
      if (lista() && desde && ahora - desde > 450) avanzar(ahora);
    };
    window.addEventListener('wheel', alGesto, { passive: true });
    window.addEventListener('keydown', alGesto);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('wheel', alGesto);
      window.removeEventListener('keydown', alGesto);
    };
  }, [introActiva, terminarIntro]);
  useEffect(() => terminarIntro, [terminarIntro]);
  // Por la puerta de "Sobre mí": las piezas ya están flotando cuando la hoja se abre.
  useEffect(() => {
    window.addEventListener('portafolio:entrada-proyectos', empezarIntro);
    return () => window.removeEventListener('portafolio:entrada-proyectos', empezarIntro);
  }, [empezarIntro]);
  // Por cualquier otro camino, la primera vez que la sección entra en pantalla.
  useEffect(() => {
    if (visible && !refIntroHecha.current && !document.documentElement.dataset.portal) empezarIntro();
  }, [visible, empezarIntro]);

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
  const [tactilBajo, setTactilBajo] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(CONSULTA_TACTIL_BAJO);
    const leer = () => setTactilBajo(mq.matches);
    leer();
    mq.addEventListener('change', leer);
    return () => mq.removeEventListener('change', leer);
  }, []);
  const marquesina = useMemo(
    () => configurarMarquesina(tamano.ancho || 1917, tamano.alto || 910, proyectos.length, tactilBajo),
    [tamano.ancho, tamano.alto, proyectos.length, tactilBajo]
  );

  // El header se acomoda a la vista de un proyecto (navegación a la derecha, junto a la cruz).
  useEffect(() => {
    if (!proyecto) {
      setListaScrolleada(false);
      return undefined;
    }
    document.documentElement.dataset.proyectoAbierto = 'true';
    // Celular: la vista del proyecto es siempre oscura; el color del navegador (notch y barra de estado)
    // acompaña para que no quede una franja de otro tono arriba
    const meta = document.querySelector('meta[name="theme-color"]');
    const previo = meta?.getAttribute('content');
    if (meta) meta.setAttribute('content', '#05070c');
    return () => {
      delete document.documentElement.dataset.proyectoAbierto;
      if (meta && previo) meta.setAttribute('content', previo);
    };
  }, [proyecto]);
  // Pasa al proyecto siguiente (+1) o anterior (-1), circular, con el deslizamiento de la vista.
  const navegar = useCallback(
    (dir) => {
      const i = proyectos.findIndex((p) => p.slug === refActivo.current);
      if (i < 0) return;
      elegir(proyectos[(i + dir + proyectos.length) % proyectos.length].slug, dir);
    },
    [proyectos, elegir]
  );
  // Celular: con un proyecto abierto se pasa al anterior o al siguiente deslizando el dedo de lado
  // (la lista de proyectos sólo existe en pantallas grandes). Es circular. Se ignora el gesto si
  // empieza en el carrusel de tecnologías o si es más vertical que horizontal.
  useEffect(() => {
    const panel = refPanel.current;
    if (!panel || !activo) return undefined;
    let inicio = null;
    const alEmpezar = (e) => {
      const t = e.touches[0];
      inicio = e.touches.length === 1 && !e.target.closest('[class*="carrusel"], [data-no-deslizar]') ? { x: t.clientX, y: t.clientY } : null;
    };
    const alTerminar = (e) => {
      if (!inicio || !window.matchMedia('(max-width: 768px)').matches) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - inicio.x;
      const dy = t.clientY - inicio.y;
      inicio = null;
      if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      navegar(dx < 0 ? 1 : -1);
    };
    panel.addEventListener('touchstart', alEmpezar, { passive: true });
    panel.addEventListener('touchend', alTerminar, { passive: true });
    return () => {
      panel.removeEventListener('touchstart', alEmpezar);
      panel.removeEventListener('touchend', alTerminar);
    };
  }, [activo, navegar]);
  const ocultas = useMemo(() => [activo, ...saliendo].filter(Boolean), [activo, saliendo]);

  return (
    <section id="proyectos" className={styles.contenedor} aria-labelledby="titulo-proyectos">
      <div ref={refPanel} className={styles.panel} data-activo={proyecto ? 'true' : 'false'} data-titulo-visto={tituloVisto ? 'true' : 'false'} data-intro={introActiva ? 'true' : 'false'}>
        <div ref={refFondo} className={styles.fondo}>
          {marquesinaCerca ? (
          <ThreeDMarquee
            images={tarjetas}
            className={styles.marquesina}
            alApuntar={elegir}
            claveActiva={ocultas}
            posicionGrilla={marquesina.posicion}
            filas={marquesina.filas}
            columnas={marquesina.columnas}
            anchoCaja={marquesina.anchoCaja}
            escalaDiseno={marquesina.f}
          />
          ) : null}
          <div className={styles.velo} aria-hidden="true" />
        </div>
        <div ref={refDestello} className={styles.destello} aria-hidden="true" />
        {/* Entrada: las piezas 3D que se vuelven tarjetas (ver empezarIntro) */}
        <div ref={refCajaIntro} className={styles.introCaja} aria-hidden="true" />
        <canvas ref={refLienzoIntro} className={styles.intro} aria-hidden="true" />

        {/* Celular: mientras se arrastra una fila de la marquesina la página no se mueve; estas dos bandas
            (arriba y abajo) son las que dejan scrollear con el dedo */}
        <div className={`${styles.bandaScroll} ${styles.bandaArriba}`} aria-hidden="true" />
        <div className={`${styles.bandaScroll} ${styles.bandaAbajo}`} aria-hidden="true" />
        {/* Celular: baja a la sección siguiente */}
        <button
          type="button"
          className={styles.bajar}
          aria-label="Ir a la sección siguiente"
          onClick={() => document.getElementById('experiencia')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 9l7 7 7-7" />
          </svg>
        </button>

        <div className={styles.cabecera}>
          {/* Tras unos segundos el título viaja, achicándose, a la esquina de arriba a la derecha
              (a la altura del header) y las cifras se van. */}
          <motion.div
            ref={refTitulo}
            className={styles.tituloBloque}
            animate={tituloVisto && !reducido ? { x: destinoTitulo.x, y: destinoTitulo.y, scale: escalaTitulo } : { x: 0, y: 0, scale: 1 }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
            onAnimationComplete={() => {
              if (tituloVisto && !reducido) setEnHeader(true);
            }}
            style={{ visibility: enHeader ? 'hidden' : 'visible' }}
          >
            <h2 id="titulo-proyectos" className={styles.titulo}>
              {movil ? (
                // celular: texto común (el trazo SVG medía mal la fuente y dejaba las letras pegadas)
                <span className={styles.tituloPlano}>Proyectos</span>
              ) : (
                <TextoTrazo key={vecesVista} texto="Proyectos" claseTexto={styles.tituloTrazo} duracion={2.6} grosor={2.5} alVer />
              )}
            </h2>
            <p ref={refCifras} className={styles.cifras}>{textoCifras}</p>
          </motion.div>
        </div>

        {/* Ya en el header: el mismo texto, con el efecto de hover descifrado que tiene el nombre. */}
        <div ref={refTituloHeader} className={styles.tituloHeader} data-visible={enHeader && !proyecto ? 'true' : 'false'}>
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
          <AnimatePresence custom={{ directo: instantaneo, dir: direccion }} onExitComplete={() => setSaliendo([])}>
            {proyecto ? (
              <VistaProyecto
                key={proyecto.slug}
                proyecto={proyecto}
                medir={medir}
                tamano={tamano}
                reducido={reducido}
                instantaneo={instantaneo}
                direccion={direccion}
                alNavegar={navegar}
                alCerrar={cerrar}
                indice={proyectos.findIndex((p) => p.slug === proyecto.slug)}
                total={proyectos.length}
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
