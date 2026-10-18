'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { TECNOLOGIAS, tecnologiaPorId } from '@/data/tecnologias.js';
import { IconoTecnologia } from './iconosTecnologias.jsx';
import HudTecnologiasMovil from './HudTecnologiasMovil.jsx';
import styles from './HudTecnologias.module.css';

// Franja inferior de la vista del proyecto: una fila de todas las tecnologías que se
// desplaza hacia la izquierda, con las del proyecto señaladas (color pleno, más grandes, con
// su nombre y esquinas de mira). La vista (position:absolute, con --acento y --alto-hud) la
// contiene.
//
// Al apuntar la franja, las tecnologías del proyecto entran a la fila por la derecha, todas
// juntas, una al lado de la otra y con el aspecto de las demás (la misma cola). Pasan una vez
// y se van como cualquier ítem.
const SEPARACION = 44; // px entre ítems
const COPIAS = 3; // veces que se repite la lista para llenar el ancho
const ENTRE_TANDAS_MS = 3500;
// Mientras se apunta la franja la fila corre más rápido (px/s).
const VELOCIDAD_NORMAL = 40;
const VELOCIDAD_APUNTANDO = 105;
// Lupa tipo dock de macOS al pasar el mouse: cada ítem crece según su cercanía al cursor y
// empuja a los vecinos para no encimarse. MINIMO = lo que ocupa un ítem (ícono + separación);
// el más cercano llega a CRECIMIENTO veces su tamaño.
const MINIMO = 70;
const CRECIMIENTO = 1.7;
const MAXIMO = MINIMO * CRECIMIENTO;
const ALCANCE = MINIMO * Math.PI;

function HudEscritorio({ proyecto }) {
  const slug = proyecto?.slug ?? '';
  const reduceMotion = useReducedMotion();

  // Ralentiza la fila 2,5 s después de cada cambio de proyecto.
  const [reciente, setReciente] = useState(true);
  useEffect(() => {
    setReciente(true);
    const t = setTimeout(() => setReciente(false), 2500);
    return () => clearTimeout(t);
  }, [slug]);
  const [encima, setEncima] = useState(false);
  const velocidad = reduceMotion ? 0 : reciente ? 10 : encima ? VELOCIDAD_APUNTANDO : VELOCIDAD_NORMAL;

  const enStack = useMemo(() => new Set(proyecto?.stack ?? []), [proyecto]);
  const pila = useMemo(
    () => (Array.isArray(proyecto?.stack) ? proyecto.stack.map((id) => tecnologiaPorId(id)).filter(Boolean) : []),
    [proyecto]
  );

  // La fila es una cola de ítems { k (clave única), id, inyectada }. El que sale por la
  // izquierda vuelve al final de la cola (salvo los de una tanda, que se descartan).
  const refClave = useRef(0);
  const [cola, setCola] = useState(() =>
    Array.from({ length: COPIAS }).flatMap(() => TECNOLOGIAS.map((t) => ({ k: ++refClave.current, id: t.id, inyectada: false })))
  );
  const refCola = useRef(cola);
  const refContenedor = useRef(null);
  const refPista = useRef(null);
  const refItems = useRef(new Map());
  const refDesplazamiento = useRef(0);
  const refVelocidad = useRef(0);
  const refRotando = useRef(0);
  const refUltimaTanda = useRef(0);
  const refPuntero = useRef(null);

  const pintar = useCallback(() => {
    const pista = refPista.current;
    if (pista) pista.style.transform = `translate3d(${-refDesplazamiento.current}px, 0, 0)`;
  }, []);

  // Al rotar, el primer ítem se quita del DOM y se corre la fila en el mismo instante (antes
  // de pintar), para que no haya un salto.
  useLayoutEffect(() => {
    refCola.current = cola;
    if (refRotando.current > 0) {
      refDesplazamiento.current -= refRotando.current;
      refRotando.current = 0;
    }
    pintar();
  }, [cola, pintar]);

  // Lupa: sólo se recorren los ítems que están a la vista. Los valores se suavizan en cada
  // ítem para que crezcan y vuelvan sin saltos.
  const aplicarLupa = useCallback((dt) => {
    const contenedor = refContenedor.current;
    if (!contenedor) return;
    const ancho = contenedor.clientWidth;
    const puntero = refPuntero.current;
    const suavizado = 1 - Math.exp(-dt / 0.09);
    for (const item of refCola.current) {
      const elemento = refItems.current.get(item.k);
      if (!elemento) continue;
      const centro = elemento.offsetLeft - refDesplazamiento.current + elemento.offsetWidth / 2;
      if (centro < -MAXIMO * 2 || centro > ancho + MAXIMO * 2) continue;
      let escalaObjetivo = 1;
      let corrimientoObjetivo = 0;
      if (puntero !== null) {
        const distancia = centro - puntero;
        if (Math.abs(distancia) < ALCANCE) {
          const radianes = (distancia / MINIMO) * 0.5;
          escalaObjetivo = 1 + (CRECIMIENTO - 1) * Math.cos(radianes);
          corrimientoObjetivo = 2 * (MAXIMO - MINIMO) * Math.sin(radianes);
        } else {
          corrimientoObjetivo = (distancia > 0 ? 2 : -2) * (MAXIMO - MINIMO);
        }
      }
      const estado = elemento.__lupa ?? (elemento.__lupa = { escala: 1, corrimiento: 0 });
      estado.escala += (escalaObjetivo - estado.escala) * suavizado;
      estado.corrimiento += (corrimientoObjetivo - estado.corrimiento) * suavizado;
      if (Math.abs(estado.escala - 1) < 0.002 && Math.abs(estado.corrimiento) < 0.2 && puntero === null) {
        if (elemento.style.getPropertyValue('--lupa')) {
          elemento.style.removeProperty('--lupa');
          elemento.style.removeProperty('--dx');
          elemento.style.zIndex = '';
        }
        continue;
      }
      elemento.style.setProperty('--lupa', estado.escala.toFixed(3));
      elemento.style.setProperty('--dx', `${estado.corrimiento.toFixed(1)}px`);
      elemento.style.zIndex = estado.escala > 1.05 ? '2' : '';
    }
  }, []);

  useEffect(() => {
    let cuadro = 0;
    let ultimo = null;
    const paso = (ahora) => {
      if (ultimo === null) ultimo = ahora;
      const dt = Math.min(Math.max(0, ahora - ultimo) / 1000, 0.1);
      ultimo = ahora;
      refVelocidad.current += (velocidad - refVelocidad.current) * (1 - Math.exp(-dt / 0.25));
      refDesplazamiento.current += refVelocidad.current * dt;
      pintar();
      aplicarLupa(dt);
      const primero = refCola.current[0];
      const elemento = primero ? refItems.current.get(primero.k) : null;
      if (elemento && refRotando.current === 0) {
        const ancho = elemento.offsetWidth + SEPARACION;
        if (refDesplazamiento.current >= ancho) {
          refRotando.current = ancho;
          setCola((previa) => {
            const [saliente, ...resto] = previa;
            return saliente.inyectada ? resto : [...resto, { k: ++refClave.current, id: saliente.id, inyectada: false }];
          });
        }
      }
      cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [velocidad, pintar, aplicarLupa]);

  // Otro proyecto: se descartan las tandas que quedaran del anterior.
  useEffect(() => {
    setCola((previa) => (previa.some((item) => item.inyectada) ? previa.filter((item) => !item.inyectada) : previa));
  }, [slug]);

  // Apuntar la franja: las tecnologías del proyecto se suman a la cola, justo pasando el
  // borde derecho (fuera de pantalla), así entran solas y sin correr nada de lo que se ve.
  const alApuntar = () => {
    setEncima(true);
    const ahora = Date.now();
    if (reduceMotion || pila.length === 0 || ahora - refUltimaTanda.current < ENTRE_TANDAS_MS) return;
    refUltimaTanda.current = ahora;
    const ancho = refContenedor.current?.clientWidth ?? 0;
    const actual = refCola.current;
    let indice = actual.length;
    for (let i = 0; i < actual.length; i += 1) {
      const elemento = refItems.current.get(actual[i].k);
      if (elemento && elemento.offsetLeft - refDesplazamiento.current >= ancho) {
        indice = i;
        break;
      }
    }
    const lote = pila.map((t) => ({ k: ++refClave.current, id: t.id, inyectada: true }));
    setCola([...actual.slice(0, indice), ...lote, ...actual.slice(indice)]);
  };

  return (
    <div
      className={styles.hud}
      onPointerEnter={alApuntar}
      onPointerMove={(e) => {
        const caja = refContenedor.current?.getBoundingClientRect();
        if (caja) refPuntero.current = e.clientX - caja.left;
      }}
      onPointerLeave={() => {
        refPuntero.current = null;
        setEncima(false);
      }}
    >
      <span className={styles.rotulo}>STACK</span>
      <div className={styles.carrusel} ref={refContenedor} aria-label="Tecnologías" role="list">
        <div className={styles.pista} ref={refPista}>
          {cola.map((item) => {
            const tecnologia = tecnologiaPorId(item.id);
            const activa = enStack.has(item.id);
            return (
              <span
                key={item.k}
                ref={(elemento) => {
                  if (elemento) refItems.current.set(item.k, elemento);
                  else refItems.current.delete(item.k);
                }}
                role="listitem"
                className={styles.logo}
                data-activa={activa ? 'true' : 'false'}
                title={tecnologia?.nombre}
              >
                <IconoTecnologia id={item.id} />
                {activa && <small className={styles.nombre}>{tecnologia?.nombre}</small>}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Celular: un carrusel que se desliza con el dedo (como el de categorías de Habilidades), con la lupa
// siguiendo el dedo. En PC, la fila automática de siempre.
export function HudTecnologias({ proyecto }) {
  const [movil, setMovil] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const leer = () => setMovil(mq.matches);
    leer();
    mq.addEventListener('change', leer);
    return () => mq.removeEventListener('change', leer);
  }, []);
  return movil ? <HudTecnologiasMovil proyecto={proyecto} /> : <HudEscritorio proyecto={proyecto} />;
}

export default HudTecnologias;
