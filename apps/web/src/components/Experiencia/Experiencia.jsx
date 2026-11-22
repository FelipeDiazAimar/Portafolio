'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TRABAJOS } from '@/data/experiencia.js';
import { armarRecorrido } from '@/lib/pasillo.js';
import { hayWebGL } from '@/lib/soporteWebGL.js';
import useTema from '@/hooks/useTema.js';
import useUnionSeccion from '@/hooks/useUnionSeccion.js';
import ExperienciaPlana from './ExperienciaPlana.jsx';
import MapaRadar from './MapaRadar.jsx';
import DetalleObjeto from './DetalleObjeto.jsx';
import Joystick from './Joystick.jsx';
import styles from './Experiencia.module.css';

// Alto de scroll por metro de pasillo (en svh): define qué tan rápido se camina.
const SVH_POR_METRO = 6;

// "Experiencia": un pasillo 3D por trabajo, recorrido en primera persona con el scroll. A los
// costados, estanterías y cosas de cada trabajo hasta el techo, y entre ellas los objetos con
// tooltip: al tocar uno, la cámara gira y se acerca a verlo en detalle (el scroll la devuelve).
// Al final de cada pasillo se dobla y aparece el siguiente. Sin WebGL o con movimiento reducido, la lista plana.
// Marcas de escaneo sobre los objetos interactivos cercanos (como en igloo.inc): puntos de la forma
// del objeto con una cruz y su distancia en cm, unidos por líneas finas.
function dibujarEscaneo(lienzo, proyecciones, visibilidad) {
  if (!lienzo) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = lienzo.clientWidth;
  const h = lienzo.clientHeight;
  if (lienzo.width !== Math.round(w * dpr) || lienzo.height !== Math.round(h * dpr)) {
    lienzo.width = Math.round(w * dpr);
    lienzo.height = Math.round(h * dpr);
  }
  const ctx = lienzo.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (visibilidad < 0.02) return;
  ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textBaseline = 'middle';
  // sólo el objeto más cerca del centro de la pantalla (si no, las marcas se enciman)
  let elegido = null;
  let mejor = Infinity;
  for (const p of proyecciones) {
    if (!p.visible || !p.marcas || p.marcas.length < 9) continue;
    const d = Math.hypot(p.x - w / 2, p.y - h / 2) + p.distancia * 40;
    if (d < mejor) {
      mejor = d;
      elegido = p;
    }
  }
  for (const p of elegido ? [elegido] : []) {
    const m = p.marcas;
    const alfa = visibilidad * p.opacidad * Math.min(1, (7 - p.distancia) / 2.5);
    if (alfa < 0.02) continue;
    const n = m.length / 3;
    ctx.strokeStyle = `rgba(255,255,255,${(0.55 * alfa).toFixed(3)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k < n; k++) (k ? ctx.lineTo : ctx.moveTo).call(ctx, m[k * 3], m[k * 3 + 1]);
    ctx.closePath();
    // una diagonal, como un trazado de medición
    if (n >= 4) {
      ctx.moveTo(m[0], m[1]);
      ctx.lineTo(m[Math.floor(n / 2) * 3], m[Math.floor(n / 2) * 3 + 1]);
    }
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${(0.95 * alfa).toFixed(3)})`;
    ctx.fillStyle = `rgba(255,255,255,${(0.9 * alfa).toFixed(3)})`;
    for (let k = 0; k < n; k++) {
      const x = m[k * 3];
      const y = m[k * 3 + 1];
      ctx.beginPath();
      ctx.moveTo(x - 4, y);
      ctx.lineTo(x + 4, y);
      ctx.moveTo(x, y - 4);
      ctx.lineTo(x, y + 4);
      ctx.stroke();
      const izquierda = x < p.x;
      ctx.textAlign = izquierda ? 'right' : 'left';
      ctx.fillText(String(m[k * 3 + 2]), x + (izquierda ? -7 : 7), y - 7);
    }
  }
}

export default function Experiencia() {
  const [plano, setPlano] = useState(false);
  useEffect(() => {
    if (!hayWebGL() || window.matchMedia('(prefers-reduced-motion: reduce)').matches) setPlano(true);
  }, []);
  const alFallar = useCallback(() => setPlano(true), []);
  return plano ? <ExperienciaPlana trabajos={TRABAJOS} /> : <Pasillo trabajos={TRABAJOS} alFallar={alFallar} />;
}

function Pasillo({ trabajos, alFallar }) {
  const recorrido = useMemo(() => armarRecorrido(trabajos), [trabajos]);
  const { tema } = useTema();
  const refSeccion = useRef(null);
  const refEscenario = useRef(null);
  const refLienzo = useRef(null);
  const refEscena = useRef(null);
  const refPuntos = useRef([]);
  const refMapa = useRef(null);
  // recorrido libre: puntero bloqueado (el mouse mueve la mirada) y objeto en la mira
  const [bloqueado, setBloqueado] = useState(false);
  const [mira, setMira] = useState(-1);
  const refMira = useRef(-1);
  const refSoltadoAProposito = useRef(false);
  const refPista = useRef(null);
  const refLuz = useRef(null);
  const refPosicionDeScroll = useRef(() => window.scrollY);
  // controles del recorrido libre: se muestran con H
  const [verControles, setVerControles] = useState(false);
  const refEscaneo = useRef(null);
  const [libre, setLibre] = useState(false);
  const refLibre = useRef(false);
  refLibre.current = libre;
  const [tactil, setTactil] = useState(false);
  useEffect(() => {
    setTactil(window.matchMedia('(pointer: coarse)').matches);
  }, []);
  const [actual, setActual] = useState(0);
  const [activo, setActivo] = useState(null);
  const [foco, setFoco] = useState(null);
  const refActual = useRef(0);
  const refFoco = useRef(null);
  // el borde de arriba se funde con la página mientras entra (no hay corte contra Proyectos)
  useUnionSeccion(refSeccion, { arriba: true, abajo: false, fraccion: 0.35 });
  refFoco.current = foco;

  const objetos = useMemo(
    () => trabajos.flatMap((t, i) => t.objetos.map((o, n) => ({ ...o, clave: `${t.id}-${n}`, pasillo: i, acento: t.acento }))),
    [trabajos],
  );

  // escena + scroll (three se carga aparte, cuando la sección se monta)
  useEffect(() => {
    let cancelado = false;
    let limpiar = () => {};
    import('./EscenaPasillo.js').then(({ crearEscenaPasillo }) => {
      if (cancelado) return;
      const seccion = refSeccion.current;
      const escenario = refEscenario.current;
      const lienzo = refLienzo.current;
      let escena;
      try {
        escena = crearEscenaPasillo({
          lienzo,
          trabajos,
          recorrido,
          tema: document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark',
          alPerder: alFallar,
          alSoltar: () => setFoco(null),
          // al mirar un objeto la cámara va frente a él: la página acompaña (sin animación)
          alIrA: (s) => window.scrollTo(0, refPosicionDeScroll.current(s)),
          alCuadro: ({ proyecciones, s, pasillo, mezcla, foco: enFoco, camara, luz }) => {
            // final: la luz de la puerta llena la pantalla y al terminar es el color de la página
            if (refLuz.current) {
              const anterior = Number(refLuz.current.dataset.luz ?? -1);
              if (Math.abs(anterior - luz) > 0.002) {
                refLuz.current.dataset.luz = String(luz);
                refLuz.current.style.opacity = Math.min(1, luz * 1.6).toFixed(3);
                // primero blanco puro; en el último tramo, el fondo de la página
                const fundido = Math.max(0, (luz - 0.62) / 0.38);
                refLuz.current.style.setProperty('--fundido', fundido.toFixed(3));
                escenario.style.setProperty('--interfaz', (1 - Math.min(1, luz * 2.2)).toFixed(3));
              }
            }
            proyecciones.forEach((p, i) => {
              const el = refPuntos.current[i];
              if (!el) return;
              // mientras se mira un objeto de cerca, los puntos se van
              const opacidad = enFoco >= 0 ? 0 : p.opacidad * (1 - mezcla);
              if (!p.visible || opacidad < 0.02) {
                if (el.style.visibility !== 'hidden') el.style.visibility = 'hidden';
                return;
              }
              el.style.visibility = 'visible';
              el.style.opacity = opacidad.toFixed(3);
              el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
              const lado = p.x < escenario.clientWidth * 0.38 ? 'izq' : p.x > escenario.clientWidth * 0.62 ? 'der' : 'centro';
              if (el.dataset.lado !== lado) el.dataset.lado = lado;
              const abajo = p.y < escenario.clientHeight * 0.32 ? 'true' : 'false';
              if (el.dataset.abajo !== abajo) el.dataset.abajo = abajo;
            });
            // etiquetas que se pisan: la del objeto más lejano esconde el texto (queda el punto)
            const ocupados = [];
            proyecciones
              .map((p, i) => ({ p, i }))
              .filter(({ p }) => p.visible && p.opacidad > 0.02)
              .sort((x, y) => x.p.distancia - y.p.distancia)
              .forEach(({ p, i }) => {
                const el = refPuntos.current[i];
                if (!el) return;
                const ancho = (Number(el.dataset.ancho) || (el.dataset.ancho = el.querySelector('[data-etiqueta]')?.offsetWidth ?? 120)) + 30;
                const x0 = el.dataset.lado === 'der' ? p.x - ancho : p.x - 12;
                const caja = [x0, p.y - 14, x0 + ancho, p.y + 14];
                const choca = ocupados.some((o) => caja[0] < o[2] && caja[2] > o[0] && caja[1] < o[3] && caja[3] > o[1]);
                const valor = choca ? 'oculta' : 'visible';
                if (el.dataset.texto !== valor) el.dataset.texto = valor;
                if (!choca) ocupados.push(caja);
              });
            dibujarEscaneo(refEscaneo.current, proyecciones, enFoco >= 0 ? 0 : 1 - mezcla);
            refMapa.current?.actualizar({ s, camara });
            if (refLibre.current && refFoco.current === null) {
              const enMira = escena.objetoCentro();
              if (enMira !== refMira.current) {
                refMira.current = enMira;
                setMira(enMira);
                escena.resaltar(enMira);
              }
            }
            if (refPista.current) refPista.current.dataset.oculta = s > 1.5 || refLibre.current ? 'true' : 'false';
            if (pasillo !== refActual.current) {
              refActual.current = pasillo;
              setActual(pasillo);
              setActivo(null);
            }
          },
        });
      } catch {
        alFallar();
        return;
      }
      refEscena.current = escena;
      const alRendimiento = (e) => escena.fijarRendimiento(Boolean(e.detail));
      window.addEventListener('portafolio:rendimiento', alRendimiento);

      const medir = () => escena.tamano(escenario.clientWidth, escenario.clientHeight);
      const avance = () => {
        const r = seccion.getBoundingClientRect();
        const recorrible = r.height - window.innerHeight;
        const u = recorrible > 0 ? Math.min(1, Math.max(0, -r.top / recorrible)) : 0;
        return u * recorrido.largo;
      };
      medir();
      escena.irA(avance(), true);
      const alScroll = () => escena.irA(avance());
      const observadorTam = new ResizeObserver(() => {
        medir();
        alScroll();
      });
      observadorTam.observe(escenario);
      window.addEventListener('scroll', alScroll, { passive: true });

      // sólo dibuja mientras la sección está a la vista
      const observadorVista = new IntersectionObserver(
        ([entrada]) => {
          if (entrada.isIntersecting) escena.arrancar();
          else escena.frenar();
        },
        { rootMargin: '200px 0px' },
      );
      observadorVista.observe(seccion);

      // mirada con el puntero (sólo con mouse) y manito sobre los objetos que se pueden tocar
      const sobreInterfaz = (e) => e.target.closest?.('button, a, [data-panel], [role="tooltip"]');
      let arrastre = null;
      let resaltado = -1;
      const alMover = (e) => {
        if (refLibre.current && arrastre && arrastre.id === e.pointerId) {
          escena.girarMirada((e.clientX - arrastre.x) * 0.0042, (e.clientY - arrastre.y) * 0.0042);
          arrastre.x = e.clientX;
          arrastre.y = e.clientY;
          return;
        }
        // en el recorrido libre manda la mira (el centro), no la posición del mouse
        if (refLibre.current || e.pointerType !== 'mouse') return;
        const r = escenario.getBoundingClientRect();
        escena.mirar(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
        if (sobreInterfaz(e)) return;
        const bajo = refFoco.current === null ? escena.objetoEn(e.clientX - r.left, e.clientY - r.top) : -1;
        escenario.style.cursor = bajo >= 0 ? 'pointer' : '';
        if (bajo !== resaltado) {
          resaltado = bajo;
          escena.resaltar(bajo);
        }
      };
      const alSalir = () => {
        escena.mirar(0, 0);
        escena.acercar(false);
        resaltado = -1;
        escena.resaltar(-1);
      };
      // tocar un objeto en 3D (sin arrastrar) lo enfoca; tocar en otro lado vuelve al pasillo
      let inicioToque = null;
      const alApretar = (e) => {
        if (e.button === 2) {
          escena.acercar(true);
          inicioToque = null;
          return;
        }
        inicioToque = sobreInterfaz(e) ? null : { x: e.clientX, y: e.clientY };
        if (refLibre.current && inicioToque && e.pointerType !== 'mouse' && !e.target.closest?.('[data-joystick]')) arrastre = { id: e.pointerId, x: e.clientX, y: e.clientY };
        // recorrido libre con mouse: un clic vuelve a tomar el puntero si se había soltado
        if (refLibre.current && e.pointerType === 'mouse' && e.button === 0 && !sobreInterfaz(e) && document.pointerLockElement !== escenario) escenario.requestPointerLock?.();
      };
      const alSoltarArrastre = (e) => {
        if (e.button === 2) escena.acercar(false);
        if (arrastre?.id === e.pointerId) arrastre = null;
      };
      const sinMenu = (e) => e.preventDefault();
      // rueda en modo libre: empuja hacia adelante / atrás
      const alRueda = (e) => {
        if (!refLibre.current) return;
        e.preventDefault();
        escena.empujar(-e.deltaY * 0.0045);
      };
      const alSoltarPuntero = (e) => {
        if (!inicioToque || Math.hypot(e.clientX - inicioToque.x, e.clientY - inicioToque.y) > 8) return;
        inicioToque = null;
        const r = escenario.getBoundingClientRect();
        const i = escena.objetoEn(e.clientX - r.left, e.clientY - r.top, e.pointerType === 'mouse' ? 0 : 36);
        if (i >= 0 && i !== refFoco.current) {
          escena.enfocar(i);
          setFoco(i);
          setActivo(null);
        } else if (refFoco.current !== null) {
          escena.soltar();
          setFoco(null);
        }
      };
      escenario.addEventListener('pointermove', alMover);
      escenario.addEventListener('pointerleave', alSalir);
      escenario.addEventListener('pointerdown', alApretar);
      escenario.addEventListener('pointerup', alSoltarPuntero);
      window.addEventListener('pointerup', alSoltarArrastre);
      window.addEventListener('pointercancel', alSoltarArrastre);
      escenario.addEventListener('wheel', alRueda, { passive: false });
      escenario.addEventListener('contextmenu', sinMenu);

      limpiar = () => {
        window.removeEventListener('portafolio:rendimiento', alRendimiento);
        observadorTam.disconnect();
        observadorVista.disconnect();
        window.removeEventListener('scroll', alScroll);
        escenario.removeEventListener('pointermove', alMover);
        escenario.removeEventListener('pointerleave', alSalir);
        escenario.removeEventListener('pointerdown', alApretar);
        escenario.removeEventListener('pointerup', alSoltarPuntero);
        window.removeEventListener('pointerup', alSoltarArrastre);
        window.removeEventListener('pointercancel', alSoltarArrastre);
        escenario.removeEventListener('wheel', alRueda);
        escenario.removeEventListener('contextmenu', sinMenu);
        escena.destruir();
        refEscena.current = null;
      };
    });
    return () => {
      cancelado = true;
      limpiar();
    };
  }, [trabajos, recorrido, alFallar]);

  useEffect(() => {
    refEscena.current?.fijarTema(tema);
  }, [tema]);

  // tocar fuera de un punto cierra el tooltip abierto
  useEffect(() => {
    if (activo === null) return undefined;
    const alTocar = (e) => {
      if (!e.target.closest?.('[data-punto]')) setActivo(null);
    };
    const alTecla = (e) => {
      if (e.key === 'Escape') setActivo(null);
    };
    document.addEventListener('pointerdown', alTocar);
    document.addEventListener('keydown', alTecla);
    return () => {
      document.removeEventListener('pointerdown', alTocar);
      document.removeEventListener('keydown', alTecla);
    };
  }, [activo]);

  const soltarFoco = useCallback(() => {
    refEscena.current?.soltar();
    setFoco(null);
    if (refLibre.current && !window.matchMedia('(pointer: coarse)').matches) {
      refSoltadoAProposito.current = false;
      refEscenario.current?.requestPointerLock?.();
    }
  }, []);
  const enfocar = (i) => {
    if (foco === i) {
      soltarFoco();
      return;
    }
    refEscena.current?.enfocar(i);
    setFoco(i);
    setActivo(null);
  };

  // objetos del mismo pasillo que `i` (índices globales), para recorrerlos desde la tarjeta
  const delPasillo = (i) => objetos.map((o, k) => (o.pasillo === objetos[i].pasillo ? k : -1)).filter((k) => k >= 0);
  const irAObjeto = (i) => {
    refEscena.current?.enfocar(i);
    setFoco(i);
  };
  const moverFoco = (paso) => {
    if (foco === null) return;
    const lista = delPasillo(foco);
    const siguiente = lista[(lista.indexOf(foco) + paso + lista.length) % lista.length];
    refEscena.current?.enfocar(siguiente);
    setFoco(siguiente);
  };
  const refMoverFoco = useRef(moverFoco);
  refMoverFoco.current = moverFoco;

  // Escape vuelve al pasillo; ← → pasan al objeto anterior / siguiente
  useEffect(() => {
    if (foco === null) return undefined;
    const alTecla = (e) => {
      if (e.key === 'Escape') soltarFoco();
      else if (e.key === 'ArrowRight') refMoverFoco.current(1);
      else if (e.key === 'ArrowLeft') refMoverFoco.current(-1);
    };
    document.addEventListener('keydown', alTecla);
    return () => document.removeEventListener('keydown', alTecla);
  }, [foco, soltarFoco]);

  // Recorrido libre: se traba el scroll de la página, se camina con WASD / flechas (Shift corre),
  // se mira arrastrando y la rueda empuja. Al salir, el scroll queda donde uno terminó.
  const posicionDeScroll = useCallback(
    (s) => {
      const seccion = refSeccion.current;
      const r = seccion.getBoundingClientRect();
      const recorrible = r.height - window.innerHeight;
      return window.scrollY + r.top + (s / recorrido.largo) * recorrible;
    },
    [recorrido],
  );
  refPosicionDeScroll.current = posicionDeScroll;
  const entrarLibre = () => {
    const seccion = refSeccion.current;
    const escena = refEscena.current;
    if (!seccion || !escena) return;
    // que el pasillo ocupe toda la pantalla
    if (seccion.getBoundingClientRect().top > 0) window.scrollTo(0, posicionDeScroll(0));
    soltarFoco();
    setActivo(null);
    window.__lenis?.stop?.();
    document.documentElement.style.overflow = 'hidden';
    escena.entrarLibre();
    setLibre(true);
    if (!tactil) {
      refSoltadoAProposito.current = false;
      refEscenario.current?.requestPointerLock?.();
    }
  };
  const salirLibre = useCallback(() => {
    const escena = refEscena.current;
    if (!escena) return;
    const s = escena.salirLibre();
    refSoltadoAProposito.current = true;
    if (document.pointerLockElement) document.exitPointerLock();
    refMira.current = -1;
    setMira(-1);
    escena.resaltar(-1);
    document.documentElement.style.overflow = '';
    window.scrollTo(0, posicionDeScroll(s));
    window.__lenis?.start?.();
    setLibre(false);
  }, [posicionDeScroll]);

  useEffect(() => {
    if (!libre) return undefined;
    const teclas = new Set();
    const aplicar = () => {
      const adelante = (teclas.has('w') || teclas.has('arrowup') ? 1 : 0) - (teclas.has('s') || teclas.has('arrowdown') ? 1 : 0);
      const lado = (teclas.has('d') || teclas.has('arrowright') ? 1 : 0) - (teclas.has('a') || teclas.has('arrowleft') ? 1 : 0);
      refEscena.current?.caminar({ adelante, lado, correr: teclas.has('shift') });
    };
    const abajo = (e) => {
      const k = e.key.toLowerCase();
      if (k === 'escape') {
        if (refFoco.current === null) salirLibre();
        return;
      }
      if (k === 'h' && !e.repeat) {
        setVerControles((v) => !v);
        return;
      }
      if (k === 'e' && !e.repeat) {
        if (refFoco.current !== null) {
          // volver a caminar
          refEscena.current?.soltar();
          setFoco(null);
          refSoltadoAProposito.current = false;
          if (!tactil) refEscenario.current?.requestPointerLock?.();
        } else if (refMira.current >= 0) {
          refSoltadoAProposito.current = true;
          if (document.pointerLockElement) document.exitPointerLock();
          refEscena.current?.enfocar(refMira.current);
          setFoco(refMira.current);
        }
        return;
      }
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) {
        e.preventDefault();
        teclas.add(k);
        aplicar();
      }
    };
    const arriba = (e) => {
      teclas.delete(e.key.toLowerCase());
      aplicar();
    };
    const perder = () => {
      teclas.clear();
      aplicar();
    };
    const mirar = (e) => {
      if (document.pointerLockElement === refEscenario.current) refEscena.current?.girarMirada(e.movementX * 0.0022, e.movementY * 0.0022);
    };
    const cambioBloqueo = () => {
      const tomado = document.pointerLockElement === refEscenario.current;
      setBloqueado(tomado);
      // Esc del navegador suelta el puntero: eso es "salir" (salvo que lo hayamos soltado nosotros)
      if (!tomado && !refSoltadoAProposito.current && refFoco.current === null) salirLibre();
      if (tomado) refSoltadoAProposito.current = false;
    };
    document.addEventListener('mousemove', mirar);
    document.addEventListener('pointerlockchange', cambioBloqueo);
    window.addEventListener('keydown', abajo);
    window.addEventListener('keyup', arriba);
    window.addEventListener('blur', perder);
    return () => {
      document.removeEventListener('mousemove', mirar);
      document.removeEventListener('pointerlockchange', cambioBloqueo);
      window.removeEventListener('keydown', abajo);
      window.removeEventListener('keyup', arriba);
      window.removeEventListener('blur', perder);
      refEscena.current?.caminar({});
    };
  }, [libre, salirLibre, tactil]);

  // si el componente se desmonta en modo libre, la página no queda trabada
  useEffect(
    () => () => {
      document.documentElement.style.overflow = '';
      window.__lenis?.start?.();
    },
    [],
  );

  const irATrabajo = (i) => {
    if (refLibre.current) salirLibre();
    const seccion = refSeccion.current;
    if (!seccion) return;
    const r = seccion.getBoundingClientRect();
    const recorrible = r.height - window.innerHeight;
    // un poco adentro del pasillo, así ya se ve el cartel de entrada
    const s = Math.min(recorrido.largo, recorrido.comienzos[i] + (i === 0 ? 0 : 0.8));
    const top = window.scrollY + r.top + (s / recorrido.largo) * recorrible;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  const trabajo = trabajos[actual];

  return (
    <section
      ref={refSeccion}
      id="experiencia"
      className={styles.seccion}
      style={{ height: `calc(100svh + ${Math.round(recorrido.largo * SVH_POR_METRO)}svh)` }}
      aria-labelledby="titulo-experiencia"
    >
      <div ref={refEscenario} className={styles.escenario}>
        <canvas ref={refLienzo} className={styles.lienzo} aria-hidden="true" />
        <div className={styles.vineta} aria-hidden="true" />
        <canvas ref={refEscaneo} className={styles.escaneo} aria-hidden="true" />
        <div ref={refLuz} className={styles.luzFinal} aria-hidden="true" />


        <div className={styles.puntos}>
          {objetos.map((o, i) => {
            const abierto = activo === o.clave;
            const idTooltip = `tooltip-${o.clave}`;
            return (
              <div
                key={o.clave}
                ref={(el) => (refPuntos.current[i] = el)}
                className={styles.punto}
                data-punto
                data-abierto={abierto ? 'true' : 'false'}
                style={{ '--acento': o.acento, visibility: 'hidden' }}
                onMouseEnter={() => {
                  setActivo(o.clave);
                  refEscena.current?.resaltar(i);
                }}
                onMouseLeave={() => {
                  setActivo((a) => (a === o.clave ? null : a));
                  refEscena.current?.resaltar(-1);
                }}
              >
                <button
                  type="button"
                  className={styles.boton}
                  aria-expanded={abierto}
                  aria-describedby={abierto ? idTooltip : undefined}
                  onFocus={() => setActivo(o.clave)}
                  onBlur={() => setActivo((a) => (a === o.clave ? null : a))}
                  onClick={() => enfocar(i)}
                >
                  <span className={styles.nucleo} aria-hidden="true" />
                  <span className={styles.etiqueta} data-etiqueta>
                    {o.titulo}
                  </span>
                </button>
                <div id={idTooltip} role="tooltip" className={styles.tooltip}>
                  <p className={styles.tooltipTitulo}>{o.titulo}</p>
                  <p className={styles.tooltipTexto}>{o.texto}</p>
                  <p className={styles.tooltipStack}>{o.proyecto ? 'Proyecto · tocá para ver el caso' : 'Tocá para ver más'}</p>
                </div>
              </div>
            );
          })}
        </div>

        {foco !== null && objetos[foco] ? (
          <DetalleObjeto
            objeto={objetos[foco]}
            trabajo={trabajos[objetos[foco].pasillo]}
            etapa={objetos[foco].pasillo}
            etapas={trabajos.length}
            hermanos={delPasillo(foco).map((k) => ({ i: k, titulo: objetos[k].titulo, actual: k === foco }))}
            alIr={irAObjeto}
            alAnterior={() => moverFoco(-1)}
            alSiguiente={() => moverFoco(1)}
            alCerrar={soltarFoco}
          />
        ) : null}

        <header className={styles.cabecera} data-enfocado={foco !== null ? 'true' : 'false'}>
          <h2 id="titulo-experiencia" className={styles.titulo}>
            Experiencia
          </h2>
          <div key={trabajo.id} className={styles.tarjeta} style={{ '--acento': trabajo.acento }} aria-live="polite">
            <p className={styles.periodo}>
              <span className={styles.numero}>
                {String(actual + 1).padStart(2, '0')} / {String(trabajos.length).padStart(2, '0')}
              </span>
              {trabajo.periodo}
            </p>
            <h3 className={styles.puesto}>{trabajo.puesto}</h3>
            <p className={styles.lugar}>{trabajo.lugar}</p>
            <p className={styles.resumen}>{trabajo.resumen}</p>
          </div>
        </header>

        <MapaRadar ref={refMapa} recorrido={recorrido} trabajos={trabajos} actual={actual} alElegir={irATrabajo} />

        <button
          type="button"
          className={styles.botonLibre}
          data-libre={libre ? 'true' : 'false'}
          onClick={libre ? salirLibre : entrarLibre}
          aria-pressed={libre}
        >
          <span className={styles.botonLibreIcono} aria-hidden="true">
            {libre ? (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="13" cy="4" r="2" />
                <path d="M9 21l2.5-6.5L14 17v4M7 12l2.5-3.5L13 8l3 3 3 1M10.5 8.5L9 13" />
              </svg>
            )}
          </span>
          <span className={styles.botonLibreTexto}>{libre ? 'Salir' : 'Recorrer libre'}</span>
        </button>

        {libre ? (
          <p className={styles.ayudaLibre} aria-live="polite">
            {tactil ? (
              <>Joystick para caminar · arrastrá para mirar · tocá un objeto para verlo</>
            ) : verControles ? (
              <>
                <kbd>W</kbd>
                <kbd>A</kbd>
                <kbd>S</kbd>
                <kbd>D</kbd> caminar · <kbd>Shift</kbd> correr · mouse para mirar · <kbd>E</kbd> ver lo que apuntás · <kbd>Esc</kbd> salir ·{' '}
                <kbd>H</kbd> ocultar
              </>
            ) : (
              <>
                <kbd>H</kbd> Ver controles
              </>
            )}
          </p>
        ) : null}
        {libre && tactil ? <Joystick alMover={(v) => refEscena.current?.caminar(v)} /> : null}
        {libre && foco === null ? (
          <>
            <span className={styles.mira} data-activa={mira >= 0 ? 'true' : 'false'} aria-hidden="true" />
            {mira >= 0 && objetos[mira] ? (
              tactil ? (
                <button type="button" className={styles.avisoMira} style={{ '--acento': objetos[mira].acento }} onClick={() => enfocar(mira)}>
                  Ver · {objetos[mira].titulo}
                </button>
              ) : (
                <p className={styles.avisoMira} data-tecla="true" style={{ '--acento': objetos[mira].acento }} aria-label={`E para ver ${objetos[mira].titulo}`}>
                  <kbd>E</kbd>
                </p>
              )
            ) : null}
            {!tactil && !bloqueado ? <p className={styles.avisoClic}>Hacé clic para seguir caminando</p> : null}
          </>
        ) : null}

        <p ref={refPista} className={styles.pista} data-oculta="false" aria-hidden="true">
          <span className={styles.rueda} />
          Scrolleá para recorrer el pasillo
        </p>
      </div>

      {/* Para lectores de pantalla: todo el recorrido como lista */}
      <div className={styles.soloLectores}>
        <ExperienciaPlana trabajos={trabajos} comoLista />
      </div>
    </section>
  );
}
