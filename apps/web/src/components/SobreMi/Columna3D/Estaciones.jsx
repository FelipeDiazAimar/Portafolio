'use client';

import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ancla } from '@/lib/columna/geometria.js';
import EscalaResponsiva from '../Escena3D/EscalaResponsiva.jsx';
import { ProveedorDesarme } from '../Escena3D/useDesarme.jsx';
import { cargadorEscena } from '../Escena3D/escenas/index.js';
import { fijarOculto } from '../Escena3D/ocultarRenderizables.js';
import Silueta from './Silueta.jsx';
import { ContextoMundo, Precompilar, useCompiladorMundo } from './precompilacion.jsx';

// Un grupo por hito en su ancla. El activo y sus vecinos montan la escena real (los
// vecinos quietos: `activa` = false); los lejanos, una silueta. La escena de origen de
// un viaje se dispersa mientras la cámara despega.
// `oculta`: montada pero todavía sin mostrarse (ver Estaciones).
function Estacion({ hito, indice, n, cercana, oculta, activa, dispersa, visita, reducido, claro, fraccion, color, registrar, alLista }) {
  const { posicion, angulo } = useMemo(() => ancla(indice, n), [indice, n]);
  const cargar = cargadorEscena(hito.id);
  const Escena = useMemo(() => (cargar ? lazy(cargar) : null), [cargar]);
  const silueta = <Silueta anio={hito.anio} color={color} reducido={reducido} />;
  return (
    <group
      ref={(grupo) => registrar(indice, grupo)}
      userData={{ estacion: indice }}
      visible={!oculta}
      position={[posicion.x, posicion.y, posicion.z]}
      rotation={[0, angulo, 0]}
    >
      {cercana && Escena ? (
        <ProveedorDesarme desarmado={dispersa} reducido={reducido}>
          <EscalaResponsiva fraccion={fraccion}>
            <Suspense fallback={silueta}>
              {/* `modelo`: lo que se oculta en un salto largo del minimapa. */}
              <group userData={{ modelo: true }}>
                <Escena key={visita} activa={activa} reducido={reducido} claro={claro} />
              </group>
              <Precompilar alLista={alLista} />
            </Suspense>
          </EscalaResponsiva>
        </ProveedorDesarme>
      ) : (
        silueta
      )}
    </group>
  );
}

// Cuánto después de llegar a un hito se empieza a preparar el cambio de vecinos.
const DEMORA_VECINOS_MS = 1200;
// Cada cuánto se revisa si las escenas nuevas ya están listas, y cuánto se las espera.
const REVISION_MS = 100;
const ESPERA_MAXIMA_MS = 6000;

const vecinosDe = (centro, n) => {
  const conjunto = new Set();
  for (let i = centro - 1; i <= centro + 1; i += 1) if (i >= 0 && i < n) conjunto.add(i);
  return conjunto;
};

// Las escenas se montan y se quitan a medida que se avanza, y cada una trae sus luces: al
// cambiar cuántas luces visibles hay, three recompila los shaders de TODO lo que está a la
// vista y el dibujo se congela (segundos). Por eso el cambio de vecinos se hace por etapas,
// con el viaje ya terminado: la escena nueva se monta oculta, se compila el mundo tal como
// va a quedar (con la nueva y sin la que se va) y recién entonces se la muestra y se quita
// la otra. Durante un viaje el conjunto no cambia.
export default function Estaciones({ hitos, activo, tipo, indiceViaje, origen, visitas, reducido, claro, fraccion, color, ocultarModelos = false }) {
  const n = hitos.length;
  const compilarMundo = useCompiladorMundo();
  const refsGrupo = useRef(new Map());
  const registrar = useCallback((indice, grupo) => {
    if (grupo) refsGrupo.current.set(indice, grupo);
    else refsGrupo.current.delete(indice);
  }, []);
  // En un salto largo por el minimapa los modelos no se ven (y no se dibujan): el viaje es
  // rápido y no tiene sentido mostrar escenas que se cruzan en un instante. Se ocultan sus
  // mallas y no los grupos, para no cambiar la cuenta de luces del mundo. Las escenas que
  // se montan durante el salto se ocultan en la siguiente pasada.
  useEffect(() => {
    const aplicar = (oculto) =>
      refsGrupo.current.forEach((grupo) => {
        grupo.traverse((o) => {
          if (o.userData?.modelo) fijarOculto(o, oculto, 'ocultoPorSalto');
        });
      });
    if (!ocultarModelos) {
      aplicar(false);
      return undefined;
    }
    aplicar(true);
    const id = setInterval(() => aplicar(true), 200);
    return () => {
      clearInterval(id);
      aplicar(false);
    };
  }, [ocultarModelos]);
  // Sólo están montadas las escenas del hito donde se está parado y las de los hitos de arriba y de abajo: el
  // resto se desmonta (una escena oculta igual seguía animándose y pesando). Volver a un hito lejano vuelve
  // a cargarla.
  const listas = useRef(new Set());
  const marcarLista = useCallback((indice) => listas.current.add(indice), []);

  // `base`: las escenas que se muestran (sus vecinos). `preparando`: el hito hacia el que
  // se está armando el siguiente conjunto.
  const [base, setBase] = useState(activo);
  const [preparando, setPreparando] = useState(null);

  useEffect(() => {
    if (tipo !== 'estancia') return undefined;
    if (activo === base) {
      setPreparando(null);
      return undefined;
    }
    const id = setTimeout(() => setPreparando(activo), DEMORA_VECINOS_MS);
    return () => clearTimeout(id);
  }, [tipo, activo, base]);

  // Los dos extremos del tramo en curso siempre están montados y a la vista (en un salto
  // largo por el minimapa pueden quedar fuera del conjunto: ahí se paga el tirón).
  const desde = tipo === 'viaje' ? indiceViaje : activo;
  const hasta = tipo === 'viaje' ? indiceViaje + 1 : activo;
  const vecinosBase = useMemo(() => vecinosDe(base, n), [base, n]);
  const vecinosNuevos = useMemo(() => (preparando === null ? null : vecinosDe(preparando, n)), [preparando, n]);

  useEffect(() => {
    if (preparando === null || !vecinosNuevos) return undefined;
    const nuevas = [...vecinosNuevos].filter((i) => !vecinosBase.has(i));
    const quitadas = [...vecinosBase].filter((i) => !vecinosNuevos.has(i));
    // Una escena que ya estuvo montada y se volvió a montar no está lista por haberlo estado.
    nuevas.forEach((i) => listas.current.delete(i));
    let vivo = true;
    const inicio = Date.now();
    const revisar = setInterval(() => {
      const todas = nuevas.every((i) => listas.current.has(i));
      if (!todas && Date.now() - inicio < ESPERA_MAXIMA_MS) return;
      clearInterval(revisar);
      const grupos = (indices) => indices.map((i) => refsGrupo.current.get(i)).filter(Boolean);
      compilarMundo(grupos(nuevas), grupos(quitadas)).then(() => {
        if (!vivo) return;
        setBase(preparando);
        setPreparando(null);
      });
    }, REVISION_MS);
    return () => {
      vivo = false;
      clearInterval(revisar);
    };
  }, [preparando, vecinosNuevos, vecinosBase, compilarMundo]);

  return (
    <ContextoMundo.Provider value={compilarMundo}>
      {hitos.map((hito, i) => {
        const enBase = vecinosBase.has(i) || i === desde || i === hasta;
        const enPreparacion = vecinosNuevos?.has(i) ?? false;
        return (
          <Estacion
            key={hito.id}
            hito={hito}
            indice={i}
            n={n}
            cercana={enBase || enPreparacion}
            oculta={!enBase}
            activa={tipo === 'estancia' && i === activo}
            dispersa={!reducido && tipo === 'viaje' && i === origen}
            visita={visitas[i]}
            reducido={reducido}
            claro={claro}
            fraccion={fraccion}
            color={color}
            registrar={registrar}
            alLista={() => marcarLista(i)}
          />
        );
      })}
    </ContextoMundo.Provider>
  );
}
