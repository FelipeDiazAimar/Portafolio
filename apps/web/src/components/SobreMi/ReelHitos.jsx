'use client';

// "Sobre mí" como un reel de portadas: los siete hitos van en una cinta curva suspendida en 3D
// y el scroll de la página es lo que la mueve (una sola fuente de verdad: arrastrar, las flechas
// y la regla de años se traducen todos a posición de scroll).
//
// El contenedor es alto y el panel va `sticky`: mientras se recorre ese alto, el panel queda fijo
// y el progreso se convierte en la fase del reel. No se usa el `pin` de ScrollTrigger porque mueve
// el nodo a un envoltorio propio, y aquí el resto del sitio (menú, URL por scroll, embudos) mide
// las secciones tal como están en el DOM.
import { useCallback, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useReducedMotion } from 'framer-motion';
import useConsulta from '@/hooks/useConsulta.js';
import useTema from '@/hooks/useTema.js';
import { alCambiarTeletransporte, estaCongelado } from '@/lib/teletransporte.js';
import { dividirResaltado } from '@/lib/resaltado.js';
import { dentroDeCuadrilatero, faseDeProgreso, hitoCercano, hitoDestino, hitosDeArrastre, limitar, progresoDeHito } from '@/lib/reel/geometria.js';
import { matrizCss } from '@/lib/reel/homografia.js';
import puntosHitos from '@/data/puntosHitos.json';
import { TITULAR } from './titular.js';
import IntroAgentes, { AGENTES, introPendiente } from './IntroAgentes.jsx';
import ObraScroll from './ObraScroll.jsx';
import { cuandoInactivo, esEscritorio } from '@/lib/precarga.js';
import styles from './ReelHitos.module.css';

const ESPERA_IMAN_MS = 170;
const SALIDA_FICHA_MS = 200;
const CONSULTA_MOVIL = '(max-width: 768px)';
// Diorama animado sobre la portada del frente (medidas de la portada, ver componerPortada.js).
const BASE = { ancho: 1600, alto: 1060 };
const ZONA_VIVA = { x: 770, y: 189, w: 826, h: 742 };
const DIORAMA = { x: 668, y: 188.75, w: 990, h: 742.5 };
// La portada es un tramo de cilindro y un elemento HTML es plano: la zona se parte en franjas
// verticales, cada una con su propia perspectiva. Con tres, el error en el medio de cada franja
// baja de unos 3 px a menos de medio.
const FRANJAS = [0, 1, 2];
const ANCHO_FRANJA = ZONA_VIVA.w / FRANJAS.length;
// Cada franja se pasa un poco sobre la siguiente (que va encima): sin eso, entre dos bordes
// suavizados quedaba una línea finísima.
const SOLAPE = 2;
const anchoDeFranja = (k) => ANCHO_FRANJA + (k < FRANJAS.length - 1 ? SOLAPE : 0);
const UV_FRANJAS = FRANJAS.map((k) => ({
  x0: (ZONA_VIVA.x + k * ANCHO_FRANJA) / BASE.ancho,
  x1: (ZONA_VIVA.x + (k + 1) * ANCHO_FRANJA) / BASE.ancho,
  y0: ZONA_VIVA.y / BASE.alto,
  y1: (ZONA_VIVA.y + ZONA_VIVA.h) / BASE.alto,
}));
const QUIETO_MS = 140;
// Un punto del diorama (fracciones del dibujo) llevado a fracciones de la portada.
const enPortada = (p) => [(DIORAMA.x + p.x * DIORAMA.w) / BASE.ancho, (DIORAMA.y + p.y * DIORAMA.h) / BASE.alto];
// El vano de la puerta del último diorama (cuatro esquinas, en fracciones de la portada): por
// ahí se pasa a Proyectos.
const VANO = (puntosHitos.puerta ?? [{ x: 0.45, y: 0.3 }, { x: 0.55, y: 0.3 }, { x: 0.55, y: 0.5 }, { x: 0.45, y: 0.5 }]).map(enPortada);
const CENTRO_VANO = [0, 1].map((k) => VANO.reduce((suma, v) => suma + v[k], 0) / 4);
const MITAD_ANCHO_VANO = (Math.max(...VANO.map((v) => v[0])) - Math.min(...VANO.map((v) => v[0]))) / 2;
// Cuánto del pasaje por la puerta se recorre con el scroll de la cola; el resto lo termina solo.
const SALIDA_AL_SCROLL = 0.14;
// La hoja de la puerta (HTML) que se apoya sobre el vano: mismas proporciones que la dibujada.
const HOJA = { w: 190, h: 307 };
// Qué tan atrás del vano queda Proyectos mientras uno se acerca: a más valor, más chico (más
// lejos) se lo ve por la puerta. Con 0 quedaría pegado al vano, como una calcomanía.
const FONDO_SALA = 0.13;
// Tamaño con que se ve Proyectos justo al cruzar el vano: el último tramo (hasta 1) es la llegada.
const ESCALA_CRUCE = 0.94;
const suave = (x) => {
  const v = limitar(x, 0, 1);
  return v * v * (3 - 2 * v);
};
// El visor de cámara que se dibuja sobre la foto o el video abierto: ocupa la portada menos un
// margen (en px de la portada) y se apoya con una matriz de perspectiva.
const VISOR_UV = { x0: 0.045, y0: 0.07, x1: 0.955, y1: 0.93 };
const VISOR = { w: (VISOR_UV.x1 - VISOR_UV.x0) * BASE.ancho, h: (VISOR_UV.y1 - VISOR_UV.y0) * BASE.alto };
const reloj = (s) => {
  const v = Number.isFinite(s) ? s : 0;
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(Math.floor(v % 60)).padStart(2, '0')}:${String(Math.floor((v % 1) * 30)).padStart(2, '0')}`;
};

// Mientras dura el pasaje por la puerta la página no se mueve: ni rueda, ni dedo, ni teclado, ni
// la barra de scroll (si algo la corre, vuelve a su lugar). `mover` es el único que la cambia.
const TECLAS_SCROLL = new Set([' ', 'PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'Home', 'End']);
function trabarScroll() {
  let fijo = window.scrollY;
  const frenar = (evento) => evento.preventDefault();
  const tecla = (evento) => {
    if (TECLAS_SCROLL.has(evento.key)) evento.preventDefault();
  };
  const sostener = () => {
    if (Math.abs(window.scrollY - fijo) > 0.5) window.scrollTo({ top: fijo, behavior: 'instant' });
  };
  window.addEventListener('wheel', frenar, { passive: false, capture: true });
  window.addEventListener('touchmove', frenar, { passive: false, capture: true });
  window.addEventListener('keydown', tecla, { capture: true });
  window.addEventListener('scroll', sostener, { passive: true });
  return {
    mover(y) {
      fijo = y;
      window.scrollTo({ top: y, behavior: 'instant' });
    },
    soltar() {
      window.removeEventListener('wheel', frenar, { capture: true });
      window.removeEventListener('touchmove', frenar, { capture: true });
      window.removeEventListener('keydown', tecla, { capture: true });
      window.removeEventListener('scroll', sostener);
    },
  };
}
// La foto del hito en la portada (ver componerPortada.js) y la portada entera, en fracciones.
const FOTO = { x: 76, y: 792, w: 236, h: 158, r: 20 };
const FOTO_UV = { x0: FOTO.x / BASE.ancho, y0: FOTO.y / BASE.alto, x1: (FOTO.x + FOTO.w) / BASE.ancho, y1: (FOTO.y + FOTO.h) / BASE.alto };
const ENTERA = { x0: 0, y0: 0, x1: 1, y1: 1 };
// Recorte del diorama que acompaña a cada nota (en px del dibujo, 800 × 600).
const RECORTE = { w: 264, h: 150 };
// Avisa a la sección Proyectos que se llega por la puerta: sus fichas ya están en su lugar (no
// hace su entrada).
const EVENTO_ENTRADA = 'portafolio:entrada-proyectos';

// El texto de cada SVG se pide una sola vez.
const textosSvg = new Map();
function pedirSvg(url) {
  if (!textosSvg.has(url)) {
    textosSvg.set(
      url,
      fetch(url).then((r) => (r.ok ? r.text() : Promise.reject(new Error(`sin ${url}`))))
    );
  }
  return textosSvg.get(url);
}

// El mismo SVG va tres veces (una por franja), cada copia en su propio shadow root: así sus
// estilos y sus ids (recortes, degradés) quedan encerrados ahí. Insertado directo en la página,
// cada cambio de hito obligaba al navegador a recalcular los estilos del sitio entero.
// Las piezas que se mueven o laten van en su propia capa: se animan sin repintar el resto.
const ESTILO_SOMBRA =
  '<style>svg{display:block;width:100%;height:100%}.am-float,.am-loop,.am-press,.am-spin,.am-swing,.vivo-mueve{will-change:transform}.am-pulse,.am-blink,.am-shadow,.am-draw{will-change:opacity}</style>';
const raizDe = (dibujo) => dibujo.shadowRoot ?? dibujo.attachShadow({ mode: 'open' });

function Descripcion({ texto }) {
  return dividirResaltado(texto).map((parte, i) => (parte.resaltado ? <strong key={i}>{parte.texto}</strong> : <span key={i}>{parte.texto}</span>));
}

export default function ReelHitos({ hitos, alFallar }) {
  const N = hitos.length;
  const refContenedor = useRef(null);
  const refPanel = useRef(null);
  const refLienzo = useRef(null);
  const refTitular = useRef(null);
  const refEscena = useRef(null);
  const refObjetivo = useRef(0);
  const refAnimacion = useRef(null);
  const refEntro = useRef(false);
  // diorama animado: el elemento, su fondo, los fondos ya compuestos y desde cuándo está quieta la cinta
  const refVivo = useRef(null);
  const refFondos = useRef([]);
  const refVivoListo = useRef(-1);
  const refQuietoDesde = useRef(0);
  // zoom de una portada: qué hito está acercado (null = ninguno) y qué punto del diorama se lee
  const [detalle, setDetalle] = useState(null);
  const [punto, setPunto] = useState(-1);
  const refDetalle = useRef(null);
  const refPunto = useRef(-1);
  refPunto.current = punto;
  const refPuntos = useRef(null);
  const refNota = useRef(null);
  // salida hacia Proyectos: la puerta (hoja y vano), cuánto se avanzó en la cola y si está en curso
  const refPortal = useRef(null);
  const refResplandor = useRef(null);
  const refRecorte = useRef(null);
  // controles del video que se abre sobre una portada
  const refHud = useRef(null);
  const refHudSegundo = useRef(-1);
  const refSalida = useRef(0);
  const refTransicion = useRef(false);
  // arrastre en curso (null si no hay): lo lee también el imán, que no actúa mientras dure
  const refArrastre = useRef(null);
  // último hito en que la cinta quedó (o está por quedar) asentada: de ahí se mide la intención
  const refAsentado = useRef(0);

  // useReducedMotion difiere entre el servidor y el primer render del cliente: hasta montar
  // se usa false, así la hidratación coincide.
  const reducidoCliente = useReducedMotion();
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  const reducido = montado && Boolean(reducidoCliente);
  const refReducido = useRef(false);
  refReducido.current = reducido;

  const movil = useConsulta(CONSULTA_MOVIL);
  const claro = useTema().tema === 'light';

  const [activo, setActivo] = useState(0);
  const [mostrado, setMostrado] = useState(0);
  const [estadoFicha, setEstadoFicha] = useState('visible');
  const [entro, setEntro] = useState(false);
  const [cerca, setCerca] = useState(false);
  const [enPantalla, setEnPantalla] = useState(false);
  // Número de la escena viva (negativo o 0 = no hay). Es un número y no un sí/no a propósito: si
  // la escena se destruye y se vuelve a crear en el mismo render, un booleano termina valiendo lo
  // mismo que antes y los efectos que dependen de ella (arrancar el bucle, subir las portadas) no
  // se enteran de que es otra.
  const [escenaN, setEscenaN] = useState(0);
  const escenaLista = escenaN > 0;
  const [arrastrando, setArrastrando] = useState(false);
  // cuántos fondos del diorama animado hay compuestos (avisa al efecto que los usa)
  const [fondosListos, setFondosListos] = useState(0);
  // Intro de agentes: 'esperando' (pedida, falta la escena), el plano medido (en curso) o null.
  const [intro, setIntro] = useState(null);
  const refConIntro = useRef(null);
  const refTrabaIntro = useRef(null);

  // ---- medidas del recorrido -------------------------------------------------------------
  const medir = useCallback(() => {
    const contenedor = refContenedor.current;
    if (!contenedor) return null;
    const caja = contenedor.getBoundingClientRect();
    // `largo` es lo que recorren los hitos; después viene la cola: un tramo en que "Hoy" sigue
    // fijo mientras Proyectos asoma desde abajo. `fin` es donde Proyectos queda arriba de todo.
    const cola = contenedor.querySelector('[data-cola]')?.offsetHeight ?? 0;
    const arriba = caja.top + window.scrollY;
    // `fin` cuenta el respiro (margen) que separa esta sección de Proyectos
    const respiro = parseFloat(getComputedStyle(contenedor).marginBottom) || 0;
    return { caja, arriba, cola, fin: arriba + contenedor.offsetHeight + respiro, largo: Math.max(1, contenedor.offsetHeight - window.innerHeight - cola) };
  }, []);

  const cortarAnimacion = useCallback(() => {
    refAnimacion.current?.kill();
    refAnimacion.current = null;
  }, []);

  // Lleva el scroll a una posición. 'instant' en cada paso: el CSS del sitio pide scroll suave
  // y dos suavizados encimados se pelean.
  const scrollA = useCallback(
    (destino) => {
      cortarAnimacion();
      const desde = window.scrollY;
      const distancia = Math.abs(destino - desde);
      if (distancia < 1) return;
      if (refReducido.current) {
        window.scrollTo({ top: destino, behavior: 'instant' });
        return;
      }
      const cursor = { y: desde };
      refAnimacion.current = gsap.to(cursor, {
        y: destino,
        duration: limitar(0.38 + distancia / 2600, 0.38, 1.15),
        ease: 'power3.out',
        onUpdate: () => window.scrollTo({ top: cursor.y, behavior: 'instant' }),
        onComplete: () => {
          refAnimacion.current = null;
        },
      });
    },
    [cortarAnimacion]
  );

  const irA = useCallback(
    (indice) => {
      const m = medir();
      if (!m) return;
      const destino = limitar(indice, 0, N - 1);
      refAsentado.current = destino;
      scrollA(m.arriba + progresoDeHito(destino, N) * m.largo);
    },
    [medir, scrollA, N]
  );

  // ---- cuándo existe y cuándo corre la escena --------------------------------------------
  useEffect(() => {
    const contenedor = refContenedor.current;
    const panel = refPanel.current;
    if (!contenedor || !panel) return undefined;
    const esChico = () => window.matchMedia(`${CONSULTA_MOVIL}, (pointer: coarse) and (max-height: 520px)`).matches;
    // En el celular el canvas se desmonta al alejarse (memoria de video); en la PC queda montado.
    const proximidad = new IntersectionObserver(([e]) => setCerca((antes) => (e.isIntersecting ? true : esChico() ? false : antes)), { rootMargin: '60% 0px' });
    const vista = new IntersectionObserver(([e]) => setEnPantalla(e.isIntersecting), { threshold: 0.01 });
    proximidad.observe(contenedor);
    vista.observe(panel);
    // En la PC la escena se arma de antemano, en un momento libre después de la bienvenida: llegar
    // a la sección (o teletransportarse) no la construye en ese instante. Una vez armada, queda.
    const precargar = esEscritorio() && !esChico() ? cuandoInactivo(() => setCerca(true), 4500) : () => {};
    return () => {
      proximidad.disconnect();
      vista.disconnect();
      precargar();
    };
  }, []);

  // Llegada desde el hero: mientras la sección sube, el panel es una hoja de puntas redondeadas
  // con su sombra; --llega (0–1) dice cuánto falta para que quede a pantalla completa.
  useEffect(() => {
    const contenedor = refContenedor.current;
    if (!contenedor) return undefined;
    let ultima = '';
    const medirLlegada = () => {
      const arriba = contenedor.getBoundingClientRect().top;
      const llega = limitar(1 - arriba / Math.max(1, window.innerHeight), 0, 1).toFixed(3);
      if (llega !== ultima) {
        ultima = llega;
        contenedor.style.setProperty('--llega', llega);
      }
    };
    medirLlegada();
    window.addEventListener('scroll', medirLlegada, { passive: true });
    window.addEventListener('resize', medirLlegada);
    return () => {
      window.removeEventListener('scroll', medirLlegada);
      window.removeEventListener('resize', medirLlegada);
    };
  }, []);

  // Lo que la escena avisa en cada cuadro: hito más cercano (estado) y fase (variable CSS).
  const refFaseEscrita = useRef(-1);
  const alCuadro = useCallback(
    (fase, velocidad = 0) => {
      if (Math.abs(fase - refFaseEscrita.current) > 0.0008) {
        refFaseEscrita.current = fase;
        refPanel.current?.style.setProperty('--fase', fase.toFixed(4));
      }
      const cercano = hitoCercano(fase, N);
      setActivo((antes) => (antes === cercano ? antes : cercano));

      // Diorama animado: sólo con la cinta asentada en un hito. Mientras se mueve se ve el de la
      // textura (quieto); al asentarse, el animado aparece encima, pegado a la portada curva.
      const vivo = refVivo.current;
      if (!vivo) return;
      const quieto = Math.abs(fase - cercano) < 0.012 && Math.abs(velocidad) < 0.03;
      const ahora = performance.now();
      if (!quieto) refQuietoDesde.current = 0;
      else if (!refQuietoDesde.current) refQuietoDesde.current = ahora;
      const escena = refEscena.current;
      const entrada = escena?.portadas[cercano]?.entrada.t ?? 0;
      if (refPaso.current) refPintarPuerta.current?.();
      // si la cinta se mueve, la foto abierta se cierra
      if (!quieto && escena && escena.medioAbierto() >= 0) escena.cerrarMedio();
      let apoyado = quieto && entrada > 0.999 && refVivoListo.current === cercano && refSalida.current < 0.01 && !refTransicion.current && escena.medioAbierto() < 0;
      let anchoEnPantalla = 0;
      if (apoyado) {
        for (const k of FRANJAS) {
          const esquinas = escena.esquinas(cercano, UV_FRANJAS[k]);
          const matriz = esquinas ? matrizCss(ANCHO_FRANJA, ZONA_VIVA.h, esquinas) : null;
          if (!matriz) {
            apoyado = false;
            break;
          }
          vivo.children[k].style.transform = matriz;
          if (k === 0) anchoEnPantalla = Math.hypot(esquinas[1][0] - esquinas[0][0], esquinas[1][1] - esquinas[0][1]);
        }
      }
      // El dibujo se ve mucho más chico que su tamaño de página: el trazo se engrosa en la misma
      // proporción, para que las líneas pesen lo mismo que en la textura (unos 0,6 px en pantalla).
      if (apoyado && anchoEnPantalla > 0) {
        const trazo = `${limitar(0.62 / (anchoEnPantalla / ANCHO_FRANJA), 0.75, 2.8).toFixed(2)}px`;
        if (vivo.dataset.trazo !== trazo) {
          vivo.dataset.trazo = trazo;
          for (const franja of vivo.children) franja.lastElementChild.shadowRoot?.querySelector('svg')?.style.setProperty('--anatomy-weight', trazo);
        }
      }
      if (conObras() && refEntro.current && !refIntroCorriendo.current && escena && !refTransicion.current) {
        escena.portadas.forEach((p, i) => {
          // la de la obra en curso la muestra su agente (dentro de su caja), no este fundido
          if (refConstruidas.current.has(i) || refObra.current?.hito === i) return;
          const objetivo = 0;
          if (Math.abs(p.entrada.t - objetivo) < 0.002) return;
          gsap.killTweensOf(p.entrada);
          p.entrada.t += (objetivo - p.entrada.t) * 0.14;
        });
      }
      if (conObras() && refEntro.current && !refIntroCorriendo.current && escena && !refTransicion.current) {
        refConstruirEnCuadro.current?.(fase);
      }
      const construida = !conObras() || refConstruidas.current.has(cercano);
      const visible = apoyado && construida && refEntro.current && ahora - refQuietoDesde.current > QUIETO_MS;
      if (vivo.dataset.visible !== String(visible)) vivo.dataset.visible = String(visible);

      // Foto o video abierto: el panel lo sabe (las marcas del zoom se apartan) y los controles
      // del video se apoyan abajo, sobre la portada.
      const abierta = escena ? escena.medioAbierto() : -1;
      const panel = refPanel.current;
      if (panel && panel.dataset.medio !== String(abierta >= 0)) panel.dataset.medio = String(abierta >= 0);
      const hud = refHud.current;
      if (hud) {
        const caja = abierta >= 0 ? escena.esquinas(abierta, VISOR_UV) : null;
        const matriz = caja ? matrizCss(VISOR.w, VISOR.h, caja) : null;
        const conHud = Boolean(matriz);
        if (hud.dataset.visible !== String(conHud)) hud.dataset.visible = String(conHud);
        if (conHud) {
          hud.style.transform = matriz;
          // el visor se ve más chico que su tamaño de página: líneas y letras se compensan
          const escalaVisor = Math.max(0.05, Math.hypot(caja[1][0] - caja[0][0], caja[1][1] - caja[0][1]) / VISOR.w);
          const k = (1 / escalaVisor).toFixed(2);
          if (hud.dataset.k !== k) {
            hud.dataset.k = k;
            hud.style.setProperty('--k', k);
          }
          const video = escena.medioVideo();
          if (hud.dataset.video !== String(Boolean(video))) hud.dataset.video = String(Boolean(video));
          if (video) {
            hud.style.setProperty('--avance', video.duration ? (video.currentTime / video.duration).toFixed(4) : '0');
            const cuadro = Math.floor(video.currentTime * 30);
            if (cuadro !== refHudSegundo.current) {
              refHudSegundo.current = cuadro;
              hud.querySelector('[data-tiempo]').textContent = reloj(video.currentTime);
            }
          }
        }
      }

      // Con una portada acercada, las marcas de sus puntos de interés siguen al diorama.
      const acercado = refDetalle.current;
      const marcas = refPuntos.current;
      if (acercado !== null && marcas && escena) {
        const lista = puntosHitos[hitos[acercado].id] ?? [];
        for (let n = 0; n < lista.length; n++) {
          const lugar = escena.puntoEn(acercado, ...enPortada(lista[n]));
          const marca = marcas.children[n];
          if (!lugar || !marca) continue;
          marca.style.transform = `translate(${lugar[0].toFixed(1)}px,${lugar[1].toFixed(1)}px)`;
        }
      }
    },
    [N, hitos]
  );

  useEffect(() => {
    if (!cerca) return undefined;
    const lienzo = refLienzo.current;
    const panel = refPanel.current;
    if (!lienzo || !panel) return undefined;
    let vivo = true;
    let escena = null;
    let observador = null;
    import('./escena/EscenaReel.js')
      .then(({ crearEscenaReel }) => {
        if (!vivo) return;
        escena = crearEscenaReel({ lienzo, total: N, reducido: refReducido.current, alCuadro, alFallar });
        refEscena.current = escena;
        const ajustar = () => escena.redimensionar(panel.clientWidth, panel.clientHeight, window.matchMedia(CONSULTA_MOVIL).matches);
        ajustar();
        observador = new ResizeObserver(ajustar);
        observador.observe(panel);
        escena.saltarA(refObjetivo.current);
        // Si la sección ya había hecho su entrada (el canvas se volvió a montar), sin repetirla.
        if (refEntro.current) escena.portadas.forEach((p) => (p.entrada.t = 1));
        setEscenaN((n) => Math.abs(n) + 1);
      })
      .catch(() => alFallar?.());
    return () => {
      vivo = false;
      observador?.disconnect();
      escena?.destruir();
      refEscena.current = null;
      setEscenaN((n) => -Math.abs(n));
    };
    // reducido: la escena se rearma si cambia la preferencia de movimiento
  }, [cerca, N, alCuadro, alFallar, reducido]);

  useEffect(() => {
    if (!escenaLista) return undefined;
    const actualizar = () => refEscena.current?.activar(enPantalla && !document.hidden);
    actualizar();
    document.addEventListener('visibilitychange', actualizar);
    return () => document.removeEventListener('visibilitychange', actualizar);
  }, [escenaN, escenaLista, enPantalla]);

  useEffect(() => {
    if (escenaLista) refEscena.current?.ponerTema(claro);
  }, [escenaN, escenaLista, claro]);

  // ---- portadas: se componen en canvas y se suben como texturas ---------------------------
  useEffect(() => {
    if (!escenaLista) return undefined;
    let vivo = true;
    (async () => {
      const { componerPortada, cargarImagen, esperarFuentes, leerFuentes, rutaDiorama } = await import('./portadas/componerPortada.js');
      const fuentes = leerFuentes();
      await esperarFuentes(fuentes);
      const ancho = movil ? 1024 : window.devicePixelRatio >= 1.5 || window.innerWidth >= 1700 ? 1792 : 1408;
      // primero la que se está viendo y después las vecinas, de cerca a lejos
      const orden = hitos.map((_, i) => i).sort((a, b) => Math.abs(a - refObjetivo.current) - Math.abs(b - refObjetivo.current));
      for (const i of orden) {
        const hito = hitos[i];
        const [diorama, foto] = await Promise.all([cargarImagen(rutaDiorama(hito.id, claro)), cargarImagen(hito.imagen)]);
        if (!vivo || !refEscena.current) return;
        const { portada, fondoVivo, zonas } = componerPortada({ hito, indice: i, hitos, claro, ancho, fuentes, diorama, foto });
        refZonas.current[i] = zonas;
        ponerZonas(i);
        refEscena.current.ponerTextura(i, portada);
        const foco = (hito.foco ?? '50% 50%').split(' ').map((v) => parseFloat(v) / 100);
        refEscena.current.ponerMedio(i, { foto, foco, rect: FOTO_UV, radio: FOTO.r / BASE.ancho });
        refFondos.current[i] = fondoVivo;
        setFondosListos((n) => n + 1);
      }
    })();
    return () => {
      vivo = false;
      refFondos.current = [];
      refVivoListo.current = -1;
    };
  }, [escenaN, escenaLista, claro, movil, hitos]);

  // Diorama animado del hito activo: su fondo (el mismo recorte que lleva la textura) y el SVG
  // insertado en la página. Insertado (y no como <img>) el navegador anima sólo las piezas que se
  // mueven; como imagen redibujaba el dibujo entero, unos 600 trazos, en cada cuadro, y se veía a
  // los saltos. No se muestra hasta que está todo; con movimiento reducido no existe.
  const refVivoActual = useRef({ clave: null, fondo: null });
  useEffect(
    () => () => {
      refVivoActual.current = { clave: null, fondo: null };
    },
    []
  );
  useEffect(() => {
    const fondo = refFondos.current[activo];
    const franjas = refVivo.current ? [...refVivo.current.children] : [];
    const src = `/hitos/diorama-${hitos[activo].id}-${claro ? 'claro' : 'oscuro'}.svg`;
    const clave = !reducido && enPantalla && fondo && franjas.length === FRANJAS.length ? `${activo}|${src}` : null;
    // Este efecto corre de nuevo cada vez que termina de componerse una portada (siete veces al
    // cargar o al cambiar de tema). Si lo que hay que mostrar es lo mismo que ya está puesto (o en
    // camino), no se toca: rehacerlo cada vez lo hacía parpadear.
    if (clave && refVivoActual.current.clave === clave && refVivoActual.current.fondo === fondo) return;
    refVivoActual.current = { clave, fondo: fondo ?? null };
    refVivoListo.current = -1;
    if (refVivo.current) refVivo.current.dataset.visible = 'false';
    const vaciar = () =>
      franjas.forEach((franja) => {
        const dibujo = franja.lastElementChild;
        if (dibujo.dataset.src) {
          raizDe(dibujo).replaceChildren();
          delete dibujo.dataset.src;
        }
      });
    // fuera de pantalla no queda ningún SVG animándose de fondo
    if (!enPantalla) vaciar();
    if (!clave) return;
    // vigente = sigue siendo esto lo que hay que mostrar (no depende de que el efecto vuelva a correr)
    const vigente = () => refVivoActual.current.clave === clave;
    const tajada = fondo.width / FRANJAS.length;
    franjas.forEach((franja, k) => {
      // cada franja lleva su tajada del fondo
      const lienzoFondo = franja.querySelector('canvas');
      const corte = (tajada * anchoDeFranja(k)) / ANCHO_FRANJA;
      lienzoFondo.width = Math.ceil(corte);
      lienzoFondo.height = fondo.height;
      lienzoFondo.getContext('2d').drawImage(fondo, k * tajada, 0, corte, fondo.height, 0, 0, lienzoFondo.width, fondo.height);
    });
    // si el SVG no se pudo traer, no se muestra (queda el de la textura)
    pedirSvg(src).then(
      (texto) => {
        if (!vigente()) return;
        franjas.forEach((franja) => {
          const dibujo = franja.lastElementChild;
          if (dibujo.dataset.src === src) return;
          raizDe(dibujo).innerHTML = ESTILO_SOMBRA + texto;
          dibujo.dataset.src = src;
          // el grosor del trazo se vuelve a poner en el próximo cuadro (ver alCuadro)
          delete refVivo.current.dataset.trazo;
        });
        // un cuadro para que el navegador lo arme antes de mostrarlo
        requestAnimationFrame(() => {
          if (vigente()) refVivoListo.current = activo;
        });
      },
      () => {}
    );
  }, [activo, claro, reducido, enPantalla, fondosListos, hitos]);

  // ---- scroll → fase (ScrollTrigger) y entrada de la sección ------------------------------
  useEffect(() => {
    const contenedor = refContenedor.current;
    if (!contenedor) return undefined;
    gsap.registerPlugin(ScrollTrigger);
    const contexto = gsap.context(() => {
      const aplicar = (yo, salto) => {
        refObjetivo.current = faseDeProgreso(yo.progress, N);
        // sin escena todavía (se carga al acercarse): la ficha y la regla siguen al scroll igual
        if (!refEscena.current) alCuadro(refObjetivo.current);
        else if (salto) refEscena.current.saltarA(refObjetivo.current);
        else refEscena.current.ponerObjetivo(refObjetivo.current);
      };
      ScrollTrigger.create({
        trigger: contenedor,
        start: 'top top',
        // hasta el último hito: la cola del final ya no mueve la cinta
        end: () => `+=${medir()?.largo ?? 1}`,
        onUpdate: (yo) => aplicar(yo, false),
        // al medir de nuevo (carga con el scroll a mitad de la sección, cambio de tamaño) no se viaja
        onRefresh: (yo) => aplicar(yo, true),
      });
      // La entrada la precede la intro de agentes, cada vez que se baja desde el hero: arranca
      // más adentro, con el panel casi entero en pantalla, para que se vea el plano armarse. Y al
      // volver a subir hacia el hero, el plano se desarma (ver desarmarIntro).
      // se decide una sola vez por montaje (si el efecto se rearma, no vuelve a preguntar)
      if (refConIntro.current === null) refConIntro.current = introPendiente();
      const conIntro = refConIntro.current;
      ScrollTrigger.create({
        trigger: contenedor,
        start: conIntro ? 'top 30%' : 'top 62%',
        once: !conIntro,
        onEnter: () => {
          if (refEntro.current) return;
          // se pasó de largo (menú del header hacia más abajo) o es la vista previa del menú:
          // directo a lo real, sin intro (trabaría el salto de ida y vuelta)
          const pasado = contenedor.getBoundingClientRect().bottom < window.innerHeight * 0.5;
          if (conIntro && !pasado && !estaCongelado() && !refTransicion.current) setIntro('esperando');
          else setEntro(true);
        },
      });
      if (conIntro) {
        ScrollTrigger.create({
          trigger: contenedor,
          // un poco más abajo del borde: la intro deja el scroll justo en el borde (progreso 0, que
          // para ScrollTrigger es no haber entrado) y al subir no se disparaba la salida
          start: 'top 5%',
          onLeaveBack: () => refDesarmar.current?.(),
        });
      }
      // La cola: "Hoy" sigue fijo y la portada empieza a crecer desde su puerta, al ritmo del
      // scroll. Pasado un punto, el portal termina solo (ver pasarAProyectos).
      const enCola = (yo, alScrollear) => {
        if (refTransicion.current) return;
        if (refPuertaCerrada.current()) {
          // "Hoy" en obra: la portada no crece desde su puerta
          refSalida.current = 0;
          refEscena.current?.ponerSalida(0);
          refPanel.current?.style.setProperty('--salida', '0');
          return;
        }
        refSalida.current = yo.progress;
        refEscena.current?.ponerSalida(yo.progress * SALIDA_AL_SCROLL);
        refPanel.current?.style.setProperty('--salida', yo.progress.toFixed(3));
        if (alScrollear && yo.progress > 0.42 && yo.progress < 1 && yo.direction > 0) refPasar.current?.();
      };
      ScrollTrigger.create({
        trigger: contenedor,
        start: () => `top+=${medir()?.largo ?? 1} top`,
        end: () => `+=${Math.max(1, medir()?.cola ?? 1)}`,
        onUpdate: (yo) => enCola(yo, true),
        onRefresh: (yo) => enCola(yo, false),
      });
    }, contenedor);
    return () => contexto.revert();
  }, [N, alCuadro, medir]);

  // ---- pasaje a Proyectos: se entra por la puerta de "Hoy", en primera persona. La cámara se
  // acerca, la hoja se abre hacia adentro y se cruza el vano. El vano es un hueco de verdad en el
  // panel; detrás está la sección Proyectos, ya armada (con sus fichas en su lugar), que se ve
  // lejos y chica al principio y crece a medida que uno se acerca, como una sala del otro lado.
  // Del otro lado hay luz (oscuridad, en el tema oscuro): de lejos tapa lo que hay detrás, al
  // cruzar envuelve la pantalla y se disipa ya en Proyectos. La vuelta es lo mismo al revés: se
  // sale de espaldas por la puerta, que se cierra, hasta quedar de nuevo frente a "Hoy".
  const refPasar = useRef(null);
  const refVolver = useRef(null);
  // pasaje en curso (null si no hay): cuánto abrió la hoja, cuánto avanzó y la sección de destino
  const refPaso = useRef(null);
  const refPintarPuerta = useRef(null);
  // La luz y el tamaño de Proyectos: lo que no depende de dónde está la puerta en pantalla.
  const ambientar = useCallback(() => {
    const paso = refPaso.current;
    const portal = refPortal.current;
    const resplandor = refResplandor.current;
    if (!paso || !portal || !resplandor) return;
    const escala = paso.cruzado ? ESCALA_CRUCE + (1 - ESCALA_CRUCE) * paso.llegada : paso.s;
    paso.proyectos.style.transform = `translateY(${paso.ty.toFixed(1)}px) scale(${escala.toFixed(4)})`;
    // ya del otro lado, la luz se disipa
    const queda = paso.cruzado ? 1 - paso.llegada : 1;
    if (portal.dataset.cruzado !== String(paso.cruzado)) portal.dataset.cruzado = String(paso.cruzado);
    portal.style.setProperty('--lejos', paso.lejos.toFixed(3));
    portal.style.setProperty('--bruma', (Math.min(1, 0.2 + paso.lejos * 1.2) * queda).toFixed(3));
    resplandor.style.setProperty('--fuerza', (paso.abre * (0.14 + 0.78 * suave((paso.t - 0.38) / 0.62)) * queda).toFixed(3));
  }, []);
  const pintarPuerta = useCallback(() => {
    const panel = refPanel.current;
    const portal = refPortal.current;
    const resplandor = refResplandor.current;
    const escena = refEscena.current;
    const paso = refPaso.current;
    if (!panel || !portal || !resplandor || !escena || !paso || paso.cruzado) return;
    const q = VANO.map(([fx, fy]) => escena.puntoEn(N - 1, fx, fy));
    // el vano va [arribaDer, arribaIzq, abajoIzq, abajoDer]; la hoja lo quiere desde arriba a la izquierda
    const matriz = q.some((v) => !v) ? null : matrizCss(HOJA.w, HOJA.h, [q[1], q[0], q[3], q[2]]);
    if (!matriz) return; // un cuadro sin medida: queda lo del anterior
    const W = panel.clientWidth;
    const H = panel.clientHeight;
    const pts = q.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`);
    panel.style.clipPath = `polygon(evenodd, 0px 0px, ${W}px 0px, ${W}px ${H}px, 0px ${H}px, 0px 0px, ${pts.join(', ')}, ${pts[0]})`;
    portal.firstElementChild.style.transform = matriz;
    portal.style.setProperty('--abre', paso.abre.toFixed(4));
    // Profundidad: la puerta está a una distancia d y Proyectos un tramo más atrás, así que crece
    // más despacio que la puerta. d sale del ancho del vano en pantalla (a más ancho, más cerca).
    const ancho = Math.max(1, Math.abs(q[0][0] - q[1][0]));
    const fondo = 1 / (1 + FONDO_SALA * Math.max(0, W / ancho - 0.8));
    paso.lejos = 1 - fondo;
    // al cruzar el vano llega justo al tamaño de cruce (la llegada hace el resto)
    paso.s = ESCALA_CRUCE * (fondo + (1 - fondo) * suave((paso.t - 0.8) / 0.2));
    const cx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4;
    const cy = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4;
    // crece desde el centro del vano: es el punto hacia donde se camina
    paso.proyectos.style.transformOrigin = `${cx.toFixed(1)}px ${cy.toFixed(1)}px`;
    // la luz sale del vano y crece con él
    const altoVano = Math.abs(q[2][1] - q[1][1]);
    resplandor.style.setProperty('--px', `${cx.toFixed(1)}px`);
    resplandor.style.setProperty('--py', `${cy.toFixed(1)}px`);
    resplandor.style.setProperty('--r', `${(altoVano * 0.95).toFixed(1)}px`);
    ambientar();
  }, [N, ambientar]);
  refPintarPuerta.current = pintarPuerta;

  // Lo que comparten la ida y la vuelta: quién participa, las trabas y cómo se deja todo al final.
  const prepararPasaje = useCallback(() => {
    const escena = refEscena.current;
    const panel = refPanel.current;
    const portal = refPortal.current;
    const resplandor = refResplandor.current;
    const contenedor = refContenedor.current;
    const proyectos = document.getElementById('proyectos');
    if (!escena || !panel || !portal || !resplandor || !contenedor || !proyectos) return null;
    refTransicion.current = true;
    cortarAnimacion();
    setDetalle(null);
    escena.cerrarMedio();
    const raiz = document.documentElement;
    // mientras dura, nadie más acomoda el scroll (embudos, URL por sección) ni la página se mueve
    raiz.dataset.sinIman = 'true';
    raiz.dataset.portal = 'true';
    const traba = trabarScroll();
    contenedor.style.zIndex = '8';
    proyectos.style.willChange = 'transform';
    portal.dataset.activo = 'true';
    const pintar = () => {
      const paso = refPaso.current;
      if (!paso) return;
      escena.ponerSalida(paso.t);
      panel.style.setProperty('--salida', paso.ui.toFixed(3));
      // sin el bucle de la escena corriendo (recién se llega a la sección), se dibuja a mano
      if (!escena.activa()) {
        escena.dibujar();
        pintarPuerta();
      }
    };
    const terminar = () => {
      refPaso.current = null;
      proyectos.style.transform = '';
      proyectos.style.transformOrigin = '';
      proyectos.style.willChange = '';
      contenedor.style.zIndex = '';
      panel.style.clipPath = '';
      portal.dataset.activo = 'false';
      resplandor.style.setProperty('--fuerza', '0');
      traba.soltar();
      delete raiz.dataset.sinIman;
      delete raiz.dataset.portal;
      refTransicion.current = false;
    };
    return { escena, panel, portal, resplandor, proyectos, traba, pintar, terminar };
  }, [cortarAnimacion, pintarPuerta]);

  const pasarAProyectos = useCallback(() => {
    const m = medir();
    if (!m || refTransicion.current || refPuertaCerrada.current()) return;
    if (refReducido.current || !refEscena.current || !m.cola) {
      scrollA(m.fin);
      return;
    }
    const p = prepararPasaje();
    if (!p) {
      scrollA(m.fin);
      return;
    }
    // Proyectos ya está armada detrás de la puerta: no hace su entrada
    window.dispatchEvent(new CustomEvent(EVENTO_ENTRADA));
    // Proyectos se acomoda detrás del panel, exactamente donde va a quedar al terminar
    const paso = { abre: 0, t: SALIDA_AL_SCROLL * refSalida.current, ui: refSalida.current, llegada: 0, cruzado: false, s: ESCALA_CRUCE, lejos: 1, ty: -p.proyectos.getBoundingClientRect().top, proyectos: p.proyectos };
    refPaso.current = paso;
    pintarPuerta();
    const cruzar = () => {
      // ya se cruzó: la página salta a donde se la está viendo (no cambia nada en pantalla)
      p.traba.mover(medir()?.fin ?? m.fin);
      paso.cruzado = true;
      paso.ty = 0;
      p.panel.style.clipPath = '';
      p.proyectos.style.transformOrigin = `${window.innerWidth / 2}px ${window.innerHeight / 2}px`;
      ambientar();
    };
    gsap
      .timeline({ onComplete: p.terminar })
      // el acercamiento: arranca y llega suave, sin tirones
      .to(paso, { t: 1, duration: 2.5, ease: 'sine.inOut', onUpdate: p.pintar }, 0)
      .to(paso, { ui: 1, duration: 0.45, ease: 'power2.out' }, 0)
      // la hoja cede apenas y después se abre del todo, hacia adentro
      .to(paso, { abre: 0.07, duration: 0.35, ease: 'power2.out' }, 0.2)
      .to(paso, { abre: 1, duration: 1.05, ease: 'power3.inOut' }, 0.55)
      .add(cruzar, 2.5)
      // del otro lado: la luz se disipa y Proyectos termina de llegar
      .to(paso, { llegada: 1, duration: 0.95, ease: 'power2.out', onUpdate: ambientar }, 2.5);
  }, [medir, scrollA, prepararPasaje, pintarPuerta, ambientar]);

  // La vuelta: desde Proyectos, al subir, se sale de espaldas por la misma puerta.
  const volverDeProyectos = useCallback(
    (previo, y) => {
      if (refTransicion.current || refReducido.current || document.documentElement.dataset.sinIman) return;
      const m = medir();
      const alto = window.innerHeight;
      // sólo si se viene subiendo desde Proyectos (no un salto del menú, ni de más abajo de corrido)
      if (!m || !m.cola || !refEscena.current || !(y < m.fin - 12 && y > m.fin - alto * 0.5 && previo > m.fin - alto * 0.25 && previo - y < alto * 0.5)) return;
      // con un proyecto abierto, la sección se queda como está
      if (document.querySelector('#proyectos [data-activo="true"]')) return;
      const p = prepararPasaje();
      if (!p) return;
      const W = window.innerWidth;
      const paso = { abre: 1, t: 1, ui: 1, llegada: 1, cruzado: true, s: ESCALA_CRUCE, lejos: 0, ty: 0, proyectos: p.proyectos };
      refPaso.current = paso;
      p.traba.mover(m.fin);
      // la luz vuelve a envolver la pantalla, desde el centro
      p.proyectos.style.transformOrigin = `${W / 2}px ${alto / 2}px`;
      p.portal.firstElementChild.style.transform = matrizCss(HOJA.w, HOJA.h, [[-W, -alto], [2 * W, -alto], [2 * W, 2 * alto], [-W, 2 * alto]]);
      p.portal.style.setProperty('--abre', '1');
      p.resplandor.style.setProperty('--px', '50%');
      p.resplandor.style.setProperty('--py', '50%');
      p.resplandor.style.setProperty('--r', `${alto * 3}px`);
      ambientar();
      const descruzar = () => {
        // se vuelve a estar de este lado del vano, con la página ya en "Hoy"
        p.traba.mover(m.arriba + m.largo);
        p.proyectos.style.transform = '';
        paso.ty = -p.proyectos.getBoundingClientRect().top;
        paso.cruzado = false;
        refObjetivo.current = N - 1;
        refAsentado.current = N - 1;
        // si la sección todavía no había hecho su entrada, las portadas ya están
        refEntro.current = true;
        setEntro(true);
        p.escena.portadas.forEach((portada) => {
          gsap.killTweensOf(portada.entrada);
          portada.entrada.t = 1;
        });
        p.escena.ponerSalida(1);
        p.panel.style.setProperty('--salida', '1');
        p.escena.saltarA(N - 1);
        pintarPuerta();
      };
      const T = 0.5;
      const seguir = () =>
        gsap
        .timeline({
          onComplete: () => {
            refSalida.current = 0;
            p.escena.ponerSalida(0);
            p.panel.style.setProperty('--salida', '0');
            p.terminar();
          },
        })
        .to(paso, { llegada: 0, duration: T, ease: 'power2.in', onUpdate: ambientar }, 0)
        .add(descruzar, T)
        .to(paso, { t: 0, duration: 2.4, ease: 'sine.inOut', onUpdate: p.pintar }, T)
        // la hoja se cierra cuando ya se está afuera, y encaja al final
        .to(paso, { abre: 0.07, duration: 1, ease: 'power3.inOut' }, T + 0.75)
        .to(paso, { abre: 0, duration: 0.3, ease: 'power2.in' }, T + 1.75)
        .to(paso, { ui: 0, duration: 0.5, ease: 'power2.out' }, T + 1.9);
      // Antes de salir, Proyectos deshace su entrada (marquesina → tarjetas 3D → conectores) y
      // avisa. Si nadie toma el pedido (celular, sin WebGL), se sale directo.
      const pedido = { tomado: false, listo: seguir };
      window.dispatchEvent(new CustomEvent('portafolio:salida-proyectos', { detail: pedido }));
      if (!pedido.tomado) seguir();
    },
    [N, medir, prepararPasaje, pintarPuerta, ambientar]
  );
  refVolver.current = volverDeProyectos;
  refPasar.current = pasarAProyectos;

  // ---- zoom de una portada ---------------------------------------------------------------
  useEffect(() => {
    refDetalle.current = detalle;
    refEscena.current?.ponerDetalle(detalle ?? -1);
    if (detalle !== null) refEscena.current?.cerrarMedio();
    if (detalle === null) {
      setPunto(-1);
      return undefined;
    }
    // el primer punto se abre solo: enseña que se pueden tocar
    const primero = setTimeout(() => setPunto(0), 650);
    // cualquier scroll (rueda, flechas, arrastre) cierra el zoom: nunca atrapa a nadie
    const y0 = window.scrollY;
    const alScroll = () => {
      if (Math.abs(window.scrollY - y0) > 6) setDetalle(null);
    };
    window.addEventListener('scroll', alScroll, { passive: true });
    return () => {
      clearTimeout(primero);
      window.removeEventListener('scroll', alScroll);
    };
  }, [detalle, escenaN]);
  useEffect(() => {
    if (escenaLista) refEscena.current?.ponerPuerta(CENTRO_VANO[0], CENTRO_VANO[1], MITAD_ANCHO_VANO);
  }, [escenaN, escenaLista]);

  // Menú del header (vista previa o clic): el scroll salta de golpe y la cinta también.
  useEffect(
    () =>
      alCambiarTeletransporte(() => {
        const m = medir();
        if (!m) return;
        cortarAnimacion();
        refObjetivo.current = faseDeProgreso(-m.caja.top / m.largo, N);
        refAsentado.current = hitoCercano(refObjetivo.current, N);
        refEscena.current?.saltarA(refObjetivo.current);
      }),
    [medir, cortarAnimacion, N]
  );

  // ---- intro de agentes: el plano de lo que va a entrar -------------------------------------
  // Mide dónde va a quedar cada cosa (en px del panel) con la sección ya entrada: se pone el
  // panel en su estado final sin transiciones, se mide y se vuelve, todo en el mismo cuadro (no
  // llega a pintarse). Las portadas salen de la escena, con su forma curva en perspectiva.
  const medirPlano = useCallback(() => {
    const panel = refPanel.current;
    if (!panel) return null;
    const base = panel.getBoundingClientRect();
    const esquinasDe = (el) => {
      const r = el.getBoundingClientRect();
      const x0 = r.left - base.left;
      const y0 = r.top - base.top;
      const x1 = r.right - base.left;
      const y1 = r.bottom - base.top;
      return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    };
    const de = (selector) => panel.querySelector(`.${selector}`);
    const capas = [];
    // `revela`: qué cosa real aparece cuando su agente termina de dibujar la caja
    const sumar = (nombre, el, revela = null) => {
      if (!el) return;
      const q = esquinasDe(el);
      if (q[2][0] - q[0][0] > 4 && q[2][1] - q[0][1] > 4) capas.push({ nombre, puntos: q, revela });
    };
    const entroAntes = panel.dataset.entro;
    panel.dataset.midiendo = 'true';
    panel.dataset.entro = 'true';
    panel.getBoundingClientRect();
    refTitular.current?.querySelectorAll(`.${styles.renglon}`).forEach((el, i) => sumar(`Titular ${i + 1}`, el, { tipo: 'renglon', i }));
    const escena = refEscena.current;
    if (escena) {
      const frente = Math.round(refObjetivo.current);
      // sólo la del frente: las que siguen quedan ocultas hasta que se scrollee hacia ellas (y se
      // construyen al llegar, ver "obras")
      const q = escena.esquinasFinales(frente, ENTERA);
      if (q) capas.push({ nombre: `Portada ${hitos[frente].anio}`, puntos: q, revela: { tipo: 'portada', i: frente } });
      // cada parte de la portada del frente (navegación, título, foto, diorama…) la dibuja un
      // agente: se ve dentro de su caja (ver uZonas en EscenaReel)
      (refZonas.current[frente] ?? []).forEach((z, k) => {
        if (k >= 10) return;
        const q = escena.esquinasFinales(frente, z);
        if (q) capas.push({ nombre: z.nombre, puntos: q, revela: { tipo: 'zona', portada: frente, k } });
      });
    }
    sumar('Ficha', de(styles.ficha), { tipo: 'ficha' });
    sumar('Año', de(styles.fichaAnio), { tipo: 'fila', clase: styles.fichaAnio });
    sumar('Título', de(styles.fichaTitulo), { tipo: 'fila', clase: styles.fichaTitulo });
    sumar('Texto', de(styles.fichaTexto), { tipo: 'fila', clase: styles.fichaTexto });
    sumar('Regla de años', de(styles.regla), { tipo: 'regla' });
    // vuelve a como estaba (al desarmar, la sección está entrada: dejarla en 'false' la escondía de golpe)
    panel.dataset.entro = entroAntes;
    panel.getBoundingClientRect();
    delete panel.dataset.midiendo;
    return { capas, ancho: base.width, alto: base.height };
  }, [hitos]);

  useEffect(() => {
    if (intro !== 'esperando') return undefined;
    // Las portadas salen de la escena 3D: se la pide ya (si todavía no estaba armada) y se mide en
    // cuanto está. Si se midiera sin ella, ningún agente dibujaría las portadas y aparecerían
    // recién al final. Si tarda demasiado, no se la espera más de 6 s.
    setCerca(true);
    const medirYa = () => {
      const plano = medirPlano();
      setIntro(plano ? { ...plano, sentido: 'armar' } : null);
    };
    // y también sus partes (título, foto, diorama…), que se miden al componer su imagen: sin
    // ellas los agentes dibujaban la card en blanco y las partes aparecían de golpe al final
    const inicio = performance.now();
    let espera = 0;
    const intentar = () => {
      const frente = Math.round(refObjetivo.current);
      const listo = escenaLista && (refZonas.current[frente]?.length ?? 0) > 0;
      if (listo || performance.now() - inicio > 6000) medirYa();
      else espera = setTimeout(intentar, 100);
    };
    intentar();
    return () => clearTimeout(espera);
  }, [intro, escenaLista, medirPlano]);
  // si algo hizo entrar la sección por otro lado (la vuelta desde Proyectos), la intro sobra
  useEffect(() => {
    if (entro && intro === 'esperando') setIntro(null);
  }, [entro, intro]);
  // Mientras se arma el plano la página no se mueve (y la sección queda justo a pantalla
  // completa): si no, la rueda seguiría de largo por los hitos y la intro se perdería.
  const soltarIntro = useCallback(() => {
    refTrabaIntro.current?.soltar();
    refTrabaIntro.current = null;
    delete document.documentElement.dataset.sinIman;
  }, []);
  const enCurso = intro !== null && intro !== 'esperando';
  useEffect(() => {
    const contenedor = refContenedor.current;
    if (!enCurso || !contenedor) return undefined;
    document.documentElement.dataset.sinIman = 'true';
    const traba = trabarScroll();
    traba.mover(Math.round(contenedor.getBoundingClientRect().top + window.scrollY));
    refTrabaIntro.current = traba;
    return soltarIntro;
  }, [enCurso, soltarIntro]);
  const alFundirIntro = useCallback(() => {
    soltarIntro();
    // la del frente queda construida (también si sus partes no llegaron a medirse, porque la
    // imagen se compuso después): si no, enseguida arrancaba una obra sobre ella y parecía que todo
    // se volvía a armar
    const frente = Math.round(refObjetivo.current);
    refConstruidas.current.add(frente);
    ponerZonas(frente);
    (refIntroActual.current?.capas ?? []).forEach((capa) => {
      if (capa.revela?.tipo === 'zona') refConstruidas.current.add(capa.revela.portada);
    });
    setEntro(true);
  }, [soltarIntro]);

  // Lo real se esconde (al desarmar, con el plano ya encima): el titular baja por renglones y las
  // portadas se hunden; recién después la sección queda "sin entrar" (lista para armarse otra vez).
  const ocultarEntrada = useCallback((animado = true) => {
    refEntro.current = false;
    const lineas = refTitular.current?.querySelectorAll('[data-linea]') ?? [];
    const portadas = refEscena.current?.portadas ?? [];
    portadas.forEach((p) => gsap.killTweensOf(p.entrada));
    if (!animado) {
      portadas.forEach((p) => (p.entrada.t = 0));
      setEntro(false);
      return;
    }
    gsap.to(lineas, { yPercent: 108, duration: 0.55, ease: 'power3.in', stagger: 0.06 });
    portadas.forEach((p) => gsap.to(p.entrada, { t: 0, duration: 0.6, ease: 'power3.in' }));
    gsap.delayedCall(0.62, () => setEntro(false));
  }, []);
  // Durante la intro, cada cosa real se ve DENTRO de su caja mientras el agente la dibuja: empieza
  // en la esquina y se va descubriendo a medida que la caja crece (al desarmar, se tapa al revés).
  // Lo de la página se recorta con clip-path; las portadas (WebGL) se recortan en el lienzo con la
  // forma de cada caja, en perspectiva.
  const refPrerevelado = useRef(false);
  const refRecortes = useRef(new Map()); // portada → forma de su caja (px del panel)
  const refZonas = useRef([]); // por portada: sus partes (título, foto, diorama…), en fracciones
  // Portadas ya construidas por los agentes (en esta pasada por la sección): las demás se ven en
  // blanco, sólo el papel, hasta que llegan al frente y los agentes las arman.
  const refConstruidas = useRef(new Set());
  const conObras = () => Boolean(refConIntro.current) && !refReducido.current;
  // La puerta de "Hoy" no se abre hasta que los agentes terminan de construir esa portada.
  const refPuertaCerrada = useRef(() => false);
  refPuertaCerrada.current = () => conObras() && refEntro.current && !refConstruidas.current.has(N - 1);
  const ponerZonas = (i) => {
    const u = refEscena.current?.portadas[i]?.material.uniforms;
    const zonas = refZonas.current[i];
    if (!u || !zonas) return;
    if (!conObras()) {
      u.uConZonas.value = 0;
      return;
    }
    // si la intro en curso no trae las partes de esta portada (se midieron tarde), no quedan
    // tapadas: se ven dentro de la caja de la card
    const sinAgente =
      refIntroCorriendo.current && !(refIntroActual.current?.capas ?? []).some((c) => c.revela?.tipo === 'zona' && c.revela.portada === i);
    const hecha = refConstruidas.current.has(i) || sinAgente;
    zonas.slice(0, 10).forEach((z, k) => {
      u.uZonas.value[k].set(z.x0, z.y0, z.x1, z.y1);
      u.uZonasT.value[k] = hecha ? 1 : 0;
    });
    u.uConZonas.value = 1;
  };
  const pintarRecorteLienzo = useCallback(() => {
    const lienzo = refLienzo.current;
    if (!lienzo) return;
    const partes = [...refRecortes.current.values()].map((q) => `M${q.map(([px, py]) => `${px.toFixed(1)} ${py.toFixed(1)}`).join(' L')} Z`);
    lienzo.style.clipPath = partes.length ? `path('${partes.join(' ')}')` : 'polygon(0 0, 0 0, 0 0)';
  }, []);
  const recortar = (el, t) => {
    if (!el) return;
    if (t >= 0.999) {
      el.style.clipPath = '';
      return;
    }
    const resto = ((1 - Math.max(0, t)) * 100).toFixed(2);
    el.style.clipPath = `inset(0 ${resto}% ${resto}% 0)`;
  };
  const revelarCapa = useCallback(
    (revela, t, puntos) => {
      const panel = refPanel.current;
      if (!revela || !panel) return;
      refPrerevelado.current = true;
      if (revela.tipo === 'renglon') {
        const renglon = refTitular.current?.querySelectorAll(`.${styles.renglon}`)[revela.i];
        // y: 0 también: GSAP lee el translateY(108%) del CSS como píxeles (y), no como yPercent
        if (renglon) gsap.set(renglon.querySelector('[data-linea]'), { y: 0, yPercent: 0 });
        recortar(renglon, t);
      } else if (revela.tipo === 'portada') {
        const p = refEscena.current?.portadas[revela.i];
        if (!p) return;
        gsap.killTweensOf(p.entrada);
        p.entrada.t = t > 0.001 ? 1 : 0;
        if (t > 0.001 && puntos) refRecortes.current.set(revela.i, puntos);
        else refRecortes.current.delete(revela.i);
        pintarRecorteLienzo();
      } else if (revela.tipo === 'zona') {
        const u = refEscena.current?.portadas[revela.portada]?.material.uniforms;
        if (u) u.uZonasT.value[revela.k] = Math.max(0, Math.min(1, t));
      } else if (revela.tipo === 'ficha') {
        const ficha = panel.querySelector(`.${styles.ficha}`);
        if (ficha) gsap.set(ficha, { opacity: 1, y: 0 });
        recortar(ficha, t);
      } else if (revela.tipo === 'fila') {
        recortar(panel.querySelector(`.${revela.clase}`), t);
      } else if (revela.tipo === 'regla') {
        const regla = panel.querySelector(`.${styles.regla}`);
        const pista = panel.querySelector(`.${styles.pista}`);
        if (regla) gsap.set(regla, { opacity: 1, xPercent: -50, x: 0, y: 0 });
        recortar(regla, t);
        if (pista) gsap.set(pista, { opacity: t >= 0.999 ? 1 : 0, xPercent: -50, x: 0, y: 0 });
      }
    },
    [pintarRecorteLienzo]
  );
  // al empezar: armando, lo que todavía no tiene caja va tapado; desarmando, todo está a la vista
  const prepararRevelado = useCallback(
    (sentido, capas) => {
      const panel = refPanel.current;
      if (!panel) return;
      refRecortes.current.clear();
      const enZonas = new Set(capas.filter((capa) => capa.revela?.tipo === 'zona').map((capa) => capa.revela.portada));
      enZonas.forEach((i) => {
        const u = refEscena.current?.portadas[i]?.material.uniforms;
        if (!u) return;
        (refZonas.current[i] ?? []).slice(0, 10).forEach((z, k) => {
          u.uZonas.value[k].set(z.x0, z.y0, z.x1, z.y1);
          u.uZonasT.value[k] = sentido === 'armar' ? 0 : 1;
        });
        u.uConZonas.value = 1;
      });
      if (sentido === 'armar') {
        [styles.fichaAnio, styles.fichaTitulo, styles.fichaTexto].forEach((c) => recortar(panel.querySelector(`.${c}`), 0));
        pintarRecorteLienzo();
      } else {
        capas.forEach((capa) => {
          if (capa.revela?.tipo === 'portada') refRecortes.current.set(capa.revela.i, capa.puntos);
        });
      }
    },
    [pintarRecorteLienzo]
  );
  // terminada la intro, lo revelado a mano vuelve a quedar en manos del CSS (que ya coincide)
  const limpiarRevelado = useCallback(() => {
    const panel = refPanel.current;
    if (!panel) return;
    refRecortes.current.clear();
    if (refLienzo.current) refLienzo.current.style.clipPath = '';
    refEscena.current?.portadas.forEach((_, i) => ponerZonas(i));
    panel.querySelectorAll(`.${styles.renglon}`).forEach((el) => (el.style.clipPath = ''));
    // y la posición que se le puso a cada renglón para verlo en su caja: si quedaba, le ganaba al CSS
    // que lo esconde y, al volver a bajar, el titular ya estaba a la vista antes de la intro
    gsap.set(panel.querySelectorAll('[data-linea]'), { clearProps: 'transform' });
    const cosas = [styles.ficha, styles.regla, styles.pista, styles.fichaAnio, styles.fichaTitulo, styles.fichaTexto].map((c) => panel.querySelector(`.${c}`)).filter(Boolean);
    cosas.forEach((el) => (el.style.clipPath = ''));
    gsap.set(cosas, { clearProps: 'opacity,transform' });
  }, []);
  // al desarmar, el plano ya cubre todo: desde acá cada cosa se esconde con su caja (revelarCapa)
  const alOcultarIntro = useCallback(() => {
    refEntro.current = false;
  }, []);

  // Al subir hacia el hero: el plano se desarma. Si se sale de golpe (el menú del header, o una
  // vista previa), no hay animación: la sección sólo queda lista para armarse otra vez.
  const refDesarmar = useRef(null);
  refDesarmar.current = () => {
    const contenedor = refContenedor.current;
    if (!contenedor || !refEntro.current || intro !== null || refTransicion.current) return;
    const arriba = contenedor.getBoundingClientRect().top + window.scrollY;
    const deGolpe = estaCongelado() || window.scrollY < arriba - window.innerHeight * 0.5;
    if (deGolpe || reducido) {
      ocultarEntrada(false);
      return;
    }
    const plano = medirPlano();
    if (!plano) {
      ocultarEntrada(false);
      return;
    }
    setIntro({ ...plano, sentido: 'desarmar' });
  };

  useEffect(() => {
    if (intro && intro !== 'esperando') prepararRevelado(intro.sentido, intro.capas);
  }, [intro, prepararRevelado]);

  const refIntroCorriendo = useRef(false);
  refIntroCorriendo.current = intro !== null;
  const refIntroActual = useRef(null);
  refIntroActual.current = intro && intro !== 'esperando' ? intro : refIntroActual.current;

  // ---- obras: los agentes arman las portadas al avanzar y las desarman al volver -------------
  // Construidas quedan las portadas de 0 hasta el "frente" (F). Al salir del hito F hacia
  // adelante, los agentes arman la F+1: la card, sus partes y las líneas de su ficha. Al salir del
  // hito F hacia atrás, desarman la F, en orden inverso. Es la misma obra (siempre sobre F+1, con
  // avance q de 0 a 1) yendo para un lado o para el otro. El scroll sólo la dispara: trabajan a su
  // ritmo (SEG_POR_UNIDAD), scrollear no los apura.
  const refObraScroll = useRef(null);
  const [obra, setObra] = useState(null); // { hito, capas, ancho, alto, clave }
  const refObra = useRef(null);
  refObra.current = obra;
  const refMostrado = useRef(0);
  refMostrado.current = mostrado;
  const FILAS_FICHA = [
    ['Año', styles.fichaAnio],
    ['Título', styles.fichaTitulo],
    ['Texto', styles.fichaTexto],
  ];
  // Las capas de la obra y su plan: cada una espera sólo a las anteriores que se le superponen
  // (la card a nadie; cada parte, a la card y a las partes que pisa; las líneas de la ficha, a la
  // card), así lo que no se pisa se dibuja en paralelo. `tramo`: [inicio, fin] en unidades (1 =
  // lo que tarda un agente en dibujar su caja). Se escalonan un poco para que no salgan todos juntos.
  const ESCALON = 0.2;
  const capasDeObra = (i) => {
    const zonas = (refZonas.current[i] ?? []).slice(0, 10);
    const capas = [
      { nombre: `Portada ${hitos[i].anio}`, revela: { tipo: 'carta' }, caja: { x0: 0, y0: 0, x1: 1, y1: 1 } },
      ...zonas.map((z, k) => ({ nombre: z.nombre, revela: { tipo: 'zona', k, z }, caja: z })),
      ...FILAS_FICHA.map(([nombre, clase]) => ({ nombre, revela: { tipo: 'fila', clase } })),
    ];
    const pisa = (a, b) => {
      if (!a.caja || !b.caja) return a.revela.tipo === 'carta' || b.revela.tipo === 'carta';
      return a.caja.x0 < b.caja.x1 - 1e-4 && b.caja.x0 < a.caja.x1 - 1e-4 && a.caja.y0 < b.caja.y1 - 1e-4 && b.caja.y0 < a.caja.y1 - 1e-4;
    };
    let anterior = -ESCALON;
    capas.forEach((capa, j) => {
      let inicio = anterior + ESCALON;
      for (let k = 0; k < j; k++) if (pisa(capas[k], capa)) inicio = Math.max(inicio, capas[k].tramo[1]);
      capa.tramo = [inicio, inicio + 1];
      anterior = inicio;
      // su agente: uno que no esté ocupado en ese tramo (incluida su vuelta a la pelotita)
      const ocupado = (a) => capas.slice(0, j).some((c) => c.agente === a && c.tramo[1] + 0.7 > inicio);
      capa.agente = j % AGENTES.length;
      for (let a = 0; a < AGENTES.length; a++) {
        const candidato = (j + a) % AGENTES.length;
        if (!ocupado(candidato)) {
          capa.agente = candidato;
          break;
        }
      }
    });
    return capas;
  };
  // cuánto tarda la obra de una portada, en segundos
  const duracionObra = (i) => {
    const capas = refObra.current?.hito === i ? refObra.current.capas : capasDeObra(i);
    return Math.max(SEG_MIN, Math.max(...capas.map((c) => c.tramo[1])) * SEG_POR_UNIDAD);
  };
  const soltarObra = (i, hecha) => {
    const p = refEscena.current?.portadas[i];
    if (p) {
      p.material.uniforms.uCorte.value = 1;
      if (!hecha) p.entrada.t = 0;
    }
    ponerZonas(i);
    const panel = refPanel.current;
    FILAS_FICHA.forEach(([, c]) => {
      const el = panel?.querySelector(`.${c}`);
      if (el) el.style.clipPath = '';
    });
  };
  // la obra en curso: sobre qué portada (siempre F+1) y cuánto va (0..1, por tiempo)
  const refAvance = useRef(null); // { hito, q, ultimo }
  // sentido del último movimiento del scroll (1 adelante, -1 atrás) y la fase del cuadro anterior
  const refSentido = useRef({ fase: null, sentido: 1 });
  const refFrente = useRef(null); // F: construidas de 0 a F (null = todavía no se sabe)
  const SEG_POR_UNIDAD = 0.85;
  const SEG_MIN = 2.5;
  // fija el frente: construidas 0..F. Las que se suman de golpe aparecen con un fundido; las que
  // se sacan de golpe se apagan solas (ver el fundido de alCuadro).
  const ponerFrente = (F) => {
    const escena = refEscena.current;
    refFrente.current = F;
    const hechas = refConstruidas.current;
    for (let i = 0; i < N; i++) {
      const debe = i <= F;
      if (debe === hechas.has(i)) continue;
      if (debe) {
        hechas.add(i);
        const p = escena?.portadas[i];
        if (p && p.entrada.t < 1) gsap.to(p.entrada, { t: 1, duration: 0.8, ease: 'expo.out', overwrite: true });
      } else hechas.delete(i);
      ponerZonas(i);
    }
  };
  const construirEnCuadro = (fase) => {
    const escena = refEscena.current;
    const panel = refPanel.current;
    if (!escena || !panel) return;
    const ahora = performance.now();
    if (refFrente.current === null) {
      const hechas = [...refConstruidas.current];
      ponerFrente(hechas.length ? Math.max(...hechas) : Math.round(fase));
    }
    let F = refFrente.current;
    let av = refAvance.current;
    const mov = refSentido.current;
    if (mov.fase !== null && fase - mov.fase > 1e-4) mov.sentido = 1;
    else if (mov.fase !== null && fase - mov.fase < -1e-4) mov.sentido = -1;
    mov.fase = fase;
    // hasta dónde tendría que estar construido: saliendo del hito F hacia adelante, F+1; hacia
    // atrás, F-1 (con un margen, para que parado en el hito no se dispare nada)
    const deseado = fase > F + 0.002 ? Math.ceil(fase - 0.002) : fase < F - 0.002 ? Math.floor(fase + 0.002) : F;
    if (av) {
      // si se fue lejos de la obra (ya pasó la portada, o volvió más de un hito), se resuelve de
      // golpe para que la que queda a la vista sea la que se arma
      if (fase > av.hito + 0.5) {
        ponerFrente(av.hito);
        soltarObra(av.hito, true);
        av = null;
      } else if (fase < av.hito - 1.5) {
        soltarObra(av.hito, false);
        av = null;
      }
      F = refFrente.current;
    }
    // una obra nueva arranca sólo si el scroll va para ese lado (o ya se llegó al otro hito): si
    // no, parado a mitad de camino después de desarmar, volvería a armar enseguida
    const llego = Math.abs(fase - deseado) < 0.002;
    if (!av && deseado > F && (mov.sentido > 0 || llego)) {
      if (deseado - F > 1) ponerFrente(deseado - 1);
      av = { hito: refFrente.current + 1, q: 0, ultimo: ahora };
    } else if (!av && deseado < F && (mov.sentido < 0 || llego)) {
      if (F - deseado > 1) ponerFrente(deseado + 1);
      // la del frente pasa a ser obra: completa, y los agentes la desarman
      const h = refFrente.current;
      ponerFrente(h - 1);
      av = { hito: h, q: 1, ultimo: ahora };
    }
    let enCurso = null;
    if (av) {
      const dt = Math.min(0.1, Math.max(0, (ahora - av.ultimo) / 1000));
      av.ultimo = ahora;
      // hacia dónde: lo dice el sentido del scroll (yendo hacia la portada, la arman; volviendo,
      // la desarman); quieto, siguen con lo que estaban. En los hitos de los extremos, sin dudas.
      let meta = mov.sentido > 0 ? 1 : 0;
      if (fase >= av.hito - 0.002) meta = 1;
      else if (fase <= av.hito - 1 + 0.002) meta = 0;
      const paso = dt / duracionObra(av.hito);
      av.q = meta > av.q ? Math.min(1, av.q + paso) : Math.max(0, av.q - paso);
      if (av.q >= 1 && meta === 1) {
        ponerFrente(av.hito);
        soltarObra(av.hito, true);
        av = null;
      } else if (av.q <= 0 && meta === 0) {
        soltarObra(av.hito, false);
        av = null;
      } else {
        enCurso = { i: av.hito, p: av.q };
      }
    }
    refAvance.current = av;
    // a la vista de las pruebas (sólo en desarrollo)
    if (process.env.NODE_ENV !== 'production') window.__obra = { fase, frente: refFrente.current, deseado, hito: av?.hito ?? null, q: av?.q ?? null };
    const antes = refObra.current;
    if (antes && antes.hito !== enCurso?.i && !refConstruidas.current.has(antes.hito)) soltarObra(antes.hito, false);
    if (!enCurso) {
      if (antes) {
        refObra.current = null;
        setObra(null);
      }
      return;
    }
    const { i, p } = enCurso;
    const zonasN = Math.min(10, refZonas.current[i]?.length ?? 0);
    const clave = `${i}-${zonasN}`;
    if (antes?.clave !== clave) {
      const base = panel.getBoundingClientRect();
      ponerZonas(i);
      refObra.current = { hito: i, capas: capasDeObra(i), ancho: base.width, alto: base.height, clave };
      setObra(refObra.current);
    }
    const portada = escena.portadas[i];
    gsap.killTweensOf(portada.entrada);
    portada.entrada.t = 1;
    const u = portada.material.uniforms;
    const obraActual = refObraScroll.current;
    if (!obraActual || obraActual.capas !== refObra.current.capas) {
      // recién montada: este cuadro todavía no tiene dónde dibujar. Armando, la card espera
      // tapada; desarmando, sigue entera hasta que los agentes empiezan
      const entera = p >= 0.999;
      u.uCorte.value = entera ? 1 : 0;
      if (entera) u.uZonasT.value.fill(1);
      return;
    }
    const base = panel.getBoundingClientRect();
    const capas = refObra.current.capas;
    const quads = capas.map(({ revela }) => {
      if (revela.tipo === 'carta') return (t) => escena.esquinas(i, { x0: 0, y0: 0, x1: t, y1: t });
      if (revela.tipo === 'zona') {
        const { z } = revela;
        return (t) => escena.esquinas(i, { x0: z.x0, y0: z.y0, x1: z.x0 + (z.x1 - z.x0) * t, y1: z.y0 + (z.y1 - z.y0) * t });
      }
      // las líneas de la ficha: sólo cuando la ficha ya muestra este hito
      if (refMostrado.current !== i) return null;
      const r = panel.querySelector(`.${revela.clase}`)?.getBoundingClientRect();
      if (!r || r.width < 4) return null;
      const x0 = r.left - base.left;
      const y0 = r.top - base.top;
      const x1 = r.right - base.left;
      const y1 = r.bottom - base.top;
      return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    });
    obraActual.actualizar(p, quads, (j, t) => {
      const { revela } = capas[j];
      if (revela.tipo === 'carta') u.uCorte.value = Math.max(0, Math.min(1, t));
      else if (revela.tipo === 'zona') u.uZonasT.value[revela.k] = Math.max(0, Math.min(1, t));
      else if (revela.tipo === 'fila') {
        const el = panel.querySelector(`.${revela.clase}`);
        if (refMostrado.current === i) recortar(el, t);
        else if (el) el.style.clipPath = '';
      }
    });
  };
  const refConstruirEnCuadro = useRef(construirEnCuadro);
  refConstruirEnCuadro.current = construirEnCuadro;

  const refSentidoIntro = useRef('armar');
  refSentidoIntro.current = intro && intro !== 'esperando' ? intro.sentido : refSentidoIntro.current;
  const alTerminarIntro = useCallback(() => {
    const desarmada = refSentidoIntro.current === 'desarmar';
    setIntro(null);
    if (desarmada) {
      // todo ya escondido capa por capa: la sección queda "sin entrar", lista para armarse
      refEntro.current = false;
      refEscena.current?.portadas.forEach((p) => {
        gsap.killTweensOf(p.entrada);
        p.entrada.t = 0;
      });
      setEntro(false);
      refConstruidas.current.clear();
      refAvance.current = null;
      refFrente.current = null;
      refSentido.current = { fase: null, sentido: 1 };
      limpiarRevelado();
      refPrerevelado.current = false;
      // desarmado el plano, se sigue subiendo hasta el hero
      soltarIntro();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [soltarIntro, limpiarRevelado]);

  // Entrada, una sola vez: el titular sube por renglones y se lee entero; recién después asoman
  // las portadas, escalonadas, y lo tapan a medias.
  useEffect(() => {
    if (!entro) return undefined;
    refEntro.current = true;
    const lineas = refTitular.current?.querySelectorAll('[data-linea]') ?? [];
    if (reducido) {
      gsap.set(lineas, { yPercent: 0 });
      refEscena.current?.portadas.forEach((p) => (p.entrada.t = 1));
      refEscena.current?.dibujar();
      return undefined;
    }
    if (refPrerevelado.current) {
      // La intro ya lo fue mostrando capa por capa: se limpia lo puesto a mano y queda el CSS (que
      // con la sección entrada lo muestra). Fuera de un contexto de GSAP a propósito: al revertirlo
      // (cuando la sección se desarma), restauraba los renglones a la vista y, al volver a bajar,
      // el titular ya estaba puesto antes de la intro.
      limpiarRevelado();
      refPrerevelado.current = false;
      return undefined;
    }
    const contexto = gsap.context(() => {
      gsap.fromTo(lineas, { yPercent: 125 }, { yPercent: 0, duration: 1.15, ease: 'expo.out', stagger: 0.09 });
    });
    return () => contexto.revert();
  }, [entro, reducido, limpiarRevelado]);
  useEffect(() => {
    if (!entro || !escenaLista) return;
    const portadas = refEscena.current?.portadas ?? [];
    if (reducido) {
      portadas.forEach((p) => (p.entrada.t = 1));
      refEscena.current?.dibujar();
      return;
    }
    // de la que está al frente hacia afuera
    const centro = Math.round(refObjetivo.current);
    portadas.forEach((p, i) => {
      if (p.entrada.t >= 1) return;
      // sin construir, queda oculta hasta que se scrollee hacia ella (ver alCuadro)
      if (conObras() && !refConstruidas.current.has(i)) return;
      gsap.to(p.entrada, { t: 1, duration: 1.25, ease: 'expo.out', delay: 0.75 + Math.abs(i - centro) * 0.1, overwrite: true });
    });
  }, [entro, escenaN, escenaLista, reducido]);

  // ---- imán: al quedar quieto el scroll, la cinta se asienta en el hito más cercano --------
  useEffect(() => {
    let espera = 0;
    let dedos = 0;
    // hacia dónde venía el scroll (+1 bajando, -1 subiendo): decide para qué lado se resuelve el final
    let sentido = 1;
    let ultimoY = window.scrollY;
    const asentar = () => {
      // con el dedo apoyado o el mouse arrastrando manda quien arrastra: asentar ahí era tirarle
      // el scroll hacia atrás en cada pausa del gesto
      if (dedos > 0 || refArrastre.current || refAnimacion.current || refDetalle.current !== null || document.documentElement.dataset.sinIman) return;
      const m = medir();
      if (!m) return;
      const alto = window.innerHeight;
      if (m.caja.top > 1) {
        // Entre el hero y la sección no se queda a mitad de camino: bajando, con que la hoja
        // haya asomado, termina de subir; subiendo, vuelve al hero.
        if (m.caja.top < alto * (sentido > 0 ? 0.9 : 0.4)) scrollA(m.arriba);
        else if (sentido < 0 && m.caja.top < alto - 2 && m.arriba - alto >= 0) scrollA(m.arriba - alto);
        return;
      }
      if (m.caja.bottom < alto - 1) {
        // el panel ya se despegó: bajando se termina de pasar a Proyectos; subiendo, con casi todo
        // el panel a la vista, se vuelve a "Hoy"
        if (m.caja.bottom > alto * 0.74) scrollA(sentido > 0 ? m.fin : m.arriba + m.largo);
        return;
      }
      // En la cola ("Hoy" fijo, Proyectos asomando): con un empujón decidido hacia abajo se pasa
      // a Proyectos; si no, se vuelve a "Hoy". Quedarse a mitad dejaba la regla de años tapada.
      const enCola = -m.caja.top - m.largo;
      if (m.cola > 0 && enCola > 2) {
        if (refPuertaCerrada.current()) irA(N - 1);
        else if (sentido > 0 && enCola > Math.min(m.cola * 0.4, alto * 0.12)) pasarAProyectos();
        else irA(N - 1);
        return;
      }
      // un avance corto pero decidido (un giro de rueda, un deslizamiento) va al hito siguiente;
      // volver siempre al más cercano obligaba a recorrer media pantalla para pasar de hito
      irA(hitoDestino(faseDeProgreso(-m.caja.top / m.largo, N), refAsentado.current, N));
    };
    const programar = () => {
      // con la puerta cerrada el scroll no pasa de "Hoy" (ni con un envión largo)
      if (refPuertaCerrada.current() && !refTransicion.current && !estaCongelado()) {
        const m = medir();
        const tope = m ? m.arriba + m.largo : null;
        if (tope !== null && window.scrollY > tope + 1 && window.scrollY < m.fin + window.innerHeight) {
          window.scrollTo({ top: tope, behavior: 'instant' });
        }
      }
      const y = window.scrollY;
      const previo = ultimoY;
      if (y !== ultimoY) sentido = y > ultimoY ? 1 : -1;
      ultimoY = y;
      if (y < previo) refVolver.current?.(previo, y);
      clearTimeout(espera);
      espera = setTimeout(asentar, ESPERA_IMAN_MS);
    };
    // Un gesto real corta la animación en curso: nunca se pelea con quien scrollea.
    const alGirar = (evento) => {
      if (Math.abs(evento.deltaY) > 4) cortarAnimacion();
    };
    const alTocar = (evento) => {
      dedos = evento.touches.length;
      if (dedos) cortarAnimacion();
      else programar();
    };
    // en "Hoy" con la puerta cerrada, la rueda hacia abajo no hace nada (Lenis no toma el gesto)
    const frenarEnPuerta = (evento) => {
      if (evento.deltaY <= 0 || !refPuertaCerrada.current() || refTransicion.current) return;
      const m = medir();
      if (m && window.scrollY >= m.arriba + m.largo - 2 && window.scrollY < m.fin) evento.preventDefault();
    };
    window.addEventListener('wheel', frenarEnPuerta, { passive: false, capture: true });
    window.addEventListener('scroll', programar, { passive: true });
    window.addEventListener('wheel', alGirar, { passive: true });
    window.addEventListener('touchstart', alTocar, { passive: true });
    window.addEventListener('touchend', alTocar, { passive: true });
    window.addEventListener('touchcancel', alTocar, { passive: true });
    return () => {
      clearTimeout(espera);
      cortarAnimacion();
      window.removeEventListener('wheel', frenarEnPuerta, { capture: true });
      window.removeEventListener('scroll', programar);
      window.removeEventListener('wheel', alGirar);
      window.removeEventListener('touchstart', alTocar);
      window.removeEventListener('touchend', alTocar);
      window.removeEventListener('touchcancel', alTocar);
    };
  }, [medir, scrollA, irA, cortarAnimacion, pasarAProyectos, N]);

  // ---- teclado: flechas = un hito; Inicio y Fin = primero y último -------------------------
  const refActivo = useRef(0);
  refActivo.current = activo;
  useEffect(() => {
    const alTecla = (evento) => {
      if (evento.defaultPrevented || evento.altKey || evento.ctrlKey || evento.metaKey) return;
      const objetivo = evento.target;
      if (objetivo instanceof HTMLElement && (objetivo.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(objetivo.tagName))) return;
      const m = medir();
      // sólo con el panel fijo en pantalla
      if (!m || m.caja.top > 1 || m.caja.bottom < window.innerHeight - 1) return;
      const i = refActivo.current;
      if (evento.key === 'Escape' && refDetalle.current !== null) {
        setDetalle(null);
        return;
      }
      if (evento.key === 'Enter' && refDetalle.current === null && !(objetivo instanceof HTMLElement && objetivo.closest('button, a')) && Math.abs(refObjetivo.current - i) < 0.03) {
        setDetalle(i);
        return;
      }
      const destino = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: N - 1 }[evento.key];
      // en los extremos la tecla sigue de largo: no se atrapa a nadie en la sección
      if (destino === undefined || destino < 0 || destino > N - 1 || destino === i) return;
      evento.preventDefault();
      irA(destino);
    };
    window.addEventListener('keydown', alTecla);
    return () => window.removeEventListener('keydown', alTecla);
  }, [medir, irA, N]);

  // ---- arrastre: a la izquierda (o hacia abajo) avanza; mueve el scroll --------------------
  const alApretar = useCallback(
    (evento) => {
      if (evento.button !== 0 || evento.target.closest('button, a, article')) return;
      const m = medir();
      if (!m) return;
      cortarAnimacion();
      refArrastre.current = { id: evento.pointerId, x: evento.clientX, y: evento.clientY, scroll: window.scrollY, medidas: m, activo: false, tactil: evento.pointerType === 'touch' };
    },
    [medir, cortarAnimacion]
  );
  const alMover = useCallback(
    (evento) => {
      const panel = refPanel.current;
      if (panel && evento.pointerType === 'mouse' && !refReducido.current) {
        const caja = panel.getBoundingClientRect();
        refEscena.current?.ponerPuntero(((evento.clientX - caja.left) / caja.width) * 2 - 1, ((evento.clientY - caja.top) / caja.height) * 2 - 1);
      }
      // Sobre la foto de la portada del frente (ya asentada): se abre y reproduce su video.
      const escena = refEscena.current;
      if (panel && escena && evento.pointerType === 'mouse' && !refArrastre.current && !refTransicion.current) {
        const caja = panel.getBoundingClientRect();
        const x = evento.clientX - caja.left;
        const y = evento.clientY - caja.top;
        const abierta = escena.medioAbierto();
        if (abierta >= 0) {
          const q = escena.esquinas(abierta, ENTERA);
          if (!q || !dentroDeCuadrilatero(q, x, y)) escena.cerrarMedio();
        } else {
          // la del frente o, si hay una acercada, esa
          const i = refDetalle.current ?? refActivo.current;
          const hito = hitos[i];
          if ((hito.imagen || hito.video) && Math.abs(refObjetivo.current - i) < 0.03 && refSalida.current < 0.01) {
            const q = escena.esquinas(i, FOTO_UV);
            if (q && dentroDeCuadrilatero(q, x, y)) escena.abrirMedio(i, hito.video ?? null);
          }
        }
      }
      const a = refArrastre.current;
      if (!a || a.id !== evento.pointerId) return;
      // el botón ya no está apretado (se soltó fuera de la ventana, o el navegador no avisó):
      // sin esto, mover el mouse seguía arrastrando la cinta y trababa el scroll
      if (evento.pointerType === 'mouse' && evento.buttons === 0) {
        refArrastre.current = null;
        setArrastrando(false);
        window.dispatchEvent(new Event('scroll'));
        return;
      }
      const dx = evento.clientX - a.x;
      const dy = evento.clientY - a.y;
      if (!a.activo) {
        if (Math.hypot(dx, dy) < 7) return;
        // con el dedo, lo vertical es scroll nativo: sólo se toma el gesto claramente de costado
        if (a.tactil && Math.abs(dx) < Math.abs(dy) * 1.6) {
          refArrastre.current = null;
          return;
        }
        a.activo = true;
        setArrastrando(true);
        try {
          evento.currentTarget.setPointerCapture(a.id);
        } catch {
          /* el puntero ya no existe */
        }
      }
      const hitosMovidos = hitosDeArrastre(dx, a.tactil ? 0 : dy, window.innerWidth, window.innerHeight);
      const paso = a.medidas.largo / Math.max(1, N - 1);
      const destino = limitar(a.scroll + hitosMovidos * paso, a.medidas.arriba, a.medidas.arriba + a.medidas.largo);
      window.scrollTo({ top: destino, behavior: 'instant' });
    },
    [N, hitos]
  );
  const alSoltar = useCallback(
    (evento) => {
      const a = refArrastre.current;
      if (!a || a.id !== evento.pointerId) return;
      refArrastre.current = null;
      // también al cancelarse (pointercancel): la captura no queda colgada
      if (evento.currentTarget.hasPointerCapture?.(a.id)) evento.currentTarget.releasePointerCapture(a.id);
      if (a.activo) setArrastrando(false);
      // Un toque sin arrastre sobre una tarjeta de al lado lleva a ese hito.
      if (!a.activo && evento.type === 'pointerup') {
        const caja = evento.currentTarget.getBoundingClientRect();
        const tocada = refEscena.current?.portadaEn(evento.clientX - caja.left, evento.clientY - caja.top) ?? -1;
        if (refDetalle.current !== null) {
          // con una portada acercada, un toque fuera de ella la devuelve a su lugar
          if (tocada !== refDetalle.current) setDetalle(null);
          return;
        }
        if (tocada >= 0 && tocada !== refActivo.current) {
          irA(tocada);
          return;
        }
        // la del frente, ya asentada: se acerca
        if (tocada === refActivo.current && Math.abs(refObjetivo.current - tocada) < 0.03) {
          setDetalle(tocada);
          return;
        }
      }
      // En cualquier otro caso el imán la asienta (apretar había cortado el asentamiento en
      // curso, y sin esto la cinta quedaba a mitad de camino): avisa como si el scroll recién
      // se hubiera detenido.
      window.dispatchEvent(new Event('scroll'));
    },
    [irA]
  );
  // Red de seguridad: si el puntero se suelta donde el panel no se entera, el arrastre no queda
  // colgado (colgado, el imán no actuaba más).
  useEffect(() => {
    const soltar = () => {
      if (!refArrastre.current) return;
      refArrastre.current = null;
      setArrastrando(false);
      window.dispatchEvent(new Event('scroll'));
    };
    window.addEventListener('pointerup', soltar);
    window.addEventListener('pointercancel', soltar);
    window.addEventListener('blur', soltar);
    return () => {
      window.removeEventListener('pointerup', soltar);
      window.removeEventListener('pointercancel', soltar);
      window.removeEventListener('blur', soltar);
    };
  }, []);
  const alSalir = useCallback(() => {
    refEscena.current?.ponerPuntero(0, 0);
    refEscena.current?.cerrarMedio();
  }, []);

  // El dibujo de la nota: el mismo diorama, vivo, encuadrado en el objeto del que habla (el SVG
  // entero con otro viewBox, en su propio shadow root: sus piezas se siguen moviendo).
  useEffect(() => {
    const marco = refRecorte.current;
    const lugar = detalle !== null && punto >= 0 ? puntosHitos[hitos[detalle].id]?.[punto] : null;
    if (!marco || !lugar) return undefined;
    let vigente = true;
    pedirSvg(`/hitos/diorama-${hitos[detalle].id}-${claro ? 'claro' : 'oscuro'}.svg`).then(
      (texto) => {
        if (!vigente) return;
        const raiz = raizDe(marco);
        raiz.innerHTML = ESTILO_SOMBRA + texto;
        const svg = raiz.querySelector('svg');
        if (!svg) return;
        const sx = limitar(lugar.x * 800 - RECORTE.w / 2, 0, 800 - RECORTE.w);
        const sy = limitar(lugar.y * 600 - RECORTE.h / 2, 0, 600 - RECORTE.h);
        svg.setAttribute('viewBox', `${sx.toFixed(1)} ${sy.toFixed(1)} ${RECORTE.w} ${RECORTE.h}`);
        svg.removeAttribute('width');
        svg.removeAttribute('height');
      },
      () => {}
    );
    return () => {
      vigente = false;
    };
  }, [detalle, punto, claro, hitos]);

  // ---- ficha del hito: la vieja se apaga en su lugar y la nueva sube por renglones ---------
  useEffect(() => {
    if (activo === mostrado) return undefined;
    setEstadoFicha('saliendo');
    let cuadro = 0;
    const cambio = setTimeout(
      () => {
        setMostrado(activo);
        setEstadoFicha('oculta');
        // dos cuadros: el contenido nuevo tiene que pintarse oculto antes de animarse
        cuadro = requestAnimationFrame(() => {
          cuadro = requestAnimationFrame(() => setEstadoFicha('visible'));
        });
      },
      reducido ? 0 : SALIDA_FICHA_MS
    );
    return () => {
      clearTimeout(cambio);
      cancelAnimationFrame(cuadro);
    };
  }, [activo, mostrado, reducido]);
  // si el efecto anterior se cortó a mitad de camino, la ficha no queda oculta
  useEffect(() => {
    if (activo === mostrado && estadoFicha !== 'visible') {
      const id = requestAnimationFrame(() => setEstadoFicha('visible'));
      return () => cancelAnimationFrame(id);
    }
    return undefined;
  }, [activo, mostrado, estadoFicha]);

  const hito = hitos[mostrado];
  const actual = hitos[activo];

  return (
    <section id="sobre-mi" ref={refContenedor} className={styles.contenedor} style={{ '--pasos': N - 1 }} aria-labelledby="titulo-sobre-mi">
      {/* sólo para medir la cola (ver medir) */}
      <div className={styles.cola} data-cola aria-hidden="true" />
      {/* La puerta por la que se pasa a Proyectos: una hoja igual a la del dibujo, apoyada sobre el
          vano. Va debajo del panel (que tiene el vano recortado), así sólo se la ve por el hueco. */}
      <div ref={refPortal} className={styles.portal} data-activo="false" data-claro={claro} aria-hidden="true">
        <div className={styles.vano} style={{ width: HOJA.w, height: HOJA.h }}>
          <span className={styles.bruma} />
          <span className={styles.jamba} />
          <span className={styles.hoja}>
            <span className={styles.cuarteron} />
            <span className={styles.cuarteron} />
            <span className={styles.picaporte} />
          </span>
        </div>
      </div>
      <div
        ref={refPanel}
        className={styles.panel}
        style={{ '--acento': actual.acento, '--total': N - 1 }}
        data-entro={entro}
        data-inicio={activo === 0}
        data-arrastrando={arrastrando}
        data-reducido={reducido}
        data-detalle={detalle !== null}
        onPointerDown={alApretar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        onPointerLeave={alSalir}
      >
        <div className={styles.luz} aria-hidden="true" />
        <div className={styles.grano} aria-hidden="true" />

        <h2 id="titulo-sobre-mi" ref={refTitular} className={styles.titular} style={{ '--letras': Math.max(...TITULAR.map((renglon) => renglon.length)) }}>
          <span className={styles.soloLectores}>Sobre mí: </span>
          {TITULAR.map((renglon) => (
            <span key={renglon} className={styles.renglon}>
              <span data-linea>{renglon}</span>
            </span>
          ))}
        </h2>

        <canvas ref={refLienzo} className={styles.lienzo} role="img" aria-label={`Portada del hito ${actual.anio}: ${actual.titulo}. ${actual.resumen}`} />

        {/* El diorama de la portada del frente, animado: una imagen SVG (la anima el navegador,
            fuera del hilo principal) apoyada sobre la tarjeta con una matriz de perspectiva. */}
        <div ref={refVivo} className={styles.vivo} data-visible="false" aria-hidden="true">
          {FRANJAS.map((k) => (
            <div key={k} className={styles.franja} style={{ width: anchoDeFranja(k), height: ZONA_VIVA.h }}>
              <canvas />
              <div className={styles.dibujo} style={{ left: DIORAMA.x - ZONA_VIVA.x - k * ANCHO_FRANJA, top: DIORAMA.y - ZONA_VIVA.y, width: DIORAMA.w, height: DIORAMA.h }} />
            </div>
          ))}
        </div>

        {/* Lo que se ve: la ficha del hito que está al frente. El texto completo de todos los
            hitos va en la lista de abajo, para lectores de pantalla y buscadores. */}
        <article className={styles.ficha} data-estado={estadoFicha} aria-hidden="true">
          {/* la marca del hito, fija en la esquina de la ficha (no viaja con los renglones) */}
          <span className={styles.fichaMarca} />
          <p className={styles.fichaAnio} data-renglon="1">
            {hito.anio}
          </p>
          <h3 className={styles.fichaTitulo} data-renglon="2">
            {hito.titulo}
          </h3>
          <p className={styles.fichaTexto} data-renglon="3">
            <Descripcion texto={hito.descripcion} />
          </p>
          <p className={styles.fichaPista} data-renglon="3">
            Tocá la portada para acercarla
          </p>
        </article>

        {/* Zoom de una portada: marcas sobre el diorama y la nota del punto elegido. */}
        <div ref={refPuntos} className={styles.puntos}>
          {(detalle !== null ? (puntosHitos[hitos[detalle].id] ?? []) : []).map((p, n) => (
            <button key={p.titulo} type="button" className={styles.punto} aria-pressed={n === punto} aria-label={p.titulo} onClick={() => setPunto(n === punto ? -1 : n)} />
          ))}
        </div>
        <div ref={refNota} className={styles.nota} data-visible={detalle !== null && punto >= 0} aria-live="polite">
          {detalle !== null && punto >= 0 && puntosHitos[hitos[detalle].id]?.[punto] ? (
            <div key={`${detalle}-${punto}`} className={styles.notaCaja}>
              <div ref={refRecorte} className={styles.notaDibujo} style={{ aspectRatio: `${RECORTE.w} / ${RECORTE.h}` }} aria-hidden="true" />
              <p className={styles.notaTitulo}>{puntosHitos[hitos[detalle].id][punto].titulo}</p>
              <p className={styles.notaTexto}>{puntosHitos[hitos[detalle].id][punto].texto}</p>
            </div>
          ) : null}
        </div>
        {/* Visor de cámara sobre la foto o el video abierto en una portada: sólo líneas (lo ubica
            alCuadro). No se toca: no tiene controles. */}
        <div ref={refHud} className={styles.hud} style={{ width: VISOR.w, height: VISOR.h }} data-visible="false" data-video="false" aria-hidden="true">
          <span className={styles.visorEsquina} />
          <span className={styles.visorEsquina} />
          <span className={styles.visorEsquina} />
          <span className={styles.visorEsquina} />
          <span className={styles.visorMira} />
          <span className={styles.visorFoco} />
          <span className={styles.visorRegla} />
          <span className={styles.visorAvance} />
          <span className={styles.visorTiempo} data-tiempo>
            00:00:00
          </span>
        </div>
        <button type="button" className={styles.volver} tabIndex={detalle !== null ? 0 : -1} aria-hidden={detalle === null} onClick={() => setDetalle(null)}>
          <span aria-hidden="true">←</span> Volver al recorrido
        </button>
        <p className={styles.ayuda} aria-hidden="true">
          Tocá los puntos del dibujo
        </p>

        <nav className={styles.regla} aria-label="Etapas">
          <span className={styles.riel} aria-hidden="true">
            <span className={styles.cursor} />
          </span>
          <ol className={styles.etapas}>
            {hitos.map((h, i) => (
              <li key={h.id}>
                <button type="button" className={styles.etapa} aria-current={i === activo ? 'step' : undefined} onClick={() => irA(i)}>
                  <span className={styles.marca} aria-hidden="true" />
                  <span className={styles.etapaTexto}>{h.anio}</span>
                  <span className={styles.soloLectores}>: {h.titulo}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <p className={styles.pista} aria-hidden="true">
          {movil ? 'Deslizá para recorrer' : 'Scrolleá o arrastrá para recorrer'}
        </p>

        <p className={styles.soloLectores} aria-live="polite">
          Hito {activo + 1} de {N}: {actual.anio}, {actual.titulo}
        </p>
        <ol className={styles.soloLectores}>
          {hitos.map((h) => (
            <li key={h.id}>
              <h3>
                {h.anio}: {h.titulo}
              </h3>
              <p>{h.descripcion.replaceAll('**', '')}</p>
            </li>
          ))}
        </ol>
        {obra && !intro ? <ObraScroll key={obra.clave} ref={refObraScroll} capas={obra.capas} ancho={obra.ancho} alto={obra.alto} /> : null}
        {intro && intro !== 'esperando' ? (
          <IntroAgentes
            key={intro.sentido}
            capas={intro.capas}
            ancho={intro.ancho}
            alto={intro.alto}
            sentido={intro.sentido}
            alFundir={alFundirIntro}
            alOcultar={alOcultarIntro}
            alCapa={revelarCapa}
            alTerminar={alTerminarIntro}
          />
        ) : null}
      </div>
      {/* La luz (u oscuridad) del otro lado de la puerta: sale del vano y envuelve la pantalla al cruzar. */}
      <div ref={refResplandor} className={styles.resplandor} aria-hidden="true" />
    </section>
  );
}
