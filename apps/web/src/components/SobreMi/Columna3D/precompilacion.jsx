'use client';

import { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { Object3D } from 'three';
import { useThree } from '@react-three/fiber';

// Compositor del bloom (si lo hay): las escenas se dibujan en su buffer, no en pantalla, y
// three arma programas distintos según el destino. Se precompila contra ese mismo buffer.
export const ContextoCompositor = createContext({ current: null });

// `compilarMundo(mostrar, ocultar)` (lo provee Estaciones): ver useCompiladorMundo.
export const ContextoMundo = createContext(null);

// Tiempos (ms desde que la escena monta) de cada pasada: las escenas arman parte de sus
// mallas y texturas después de montar, así que se repite hasta cubrirlas. La escena se da
// por lista cuando termina la segunda.
const PASADAS_MS = [0, 600, 1800];
const PASADA_LISTA = 1;
// Entre texturas, para que subirlas a la GPU no junte un tirón.
const ENTRE_TEXTURAS_MS = 30;

// three arma un programa de shaders por cada combinación de material y estado del mundo
// (cuántas luces visibles hay, entorno, niebla, destino de render). Si el estado cambia, TODOS
// los materiales a la vista necesitan programa nuevo en ese mismo cuadro y el dibujo se
// congela esperando la compilación. Esto compila todo el mundo para un estado futuro
// —`mostrar` y `ocultar` son las estaciones que van a aparecer o a irse, y se fuerzan un
// instante para que cuenten (o no) sus luces— y avisa cuando los programas están listos.
// Armar los programas cuesta CPU (three escribe shaders de ~100 KB por cada uno): hacerlo de
// una vez eran tareas de hasta 800 ms, así que se reparte en lotes de pocos milisegundos.
const PRESUPUESTO_MS = 6;
const OBJETOS_POR_LLAMADA = 3;
const ENTRE_LOTES_MS = 16;

export function useCompiladorMundo() {
  const gl = useThree((estado) => estado.gl);
  const camera = useThree((estado) => estado.camera);
  const scene = useThree((estado) => estado.scene);
  const refCompositor = useContext(ContextoCompositor);
  return useCallback(
    (mostrar = [], ocultar = []) =>
      new Promise((resolver) => {
        // Un objeto por cada combinación de materiales: el programa depende de eso.
        const objetos = [];
        const vistos = new Set();
        scene.traverse((o) => {
          if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite) || !o.material) return;
          const materiales = Array.isArray(o.material) ? o.material : [o.material];
          const clave = `${materiales.map((m) => m.uuid).join()}${o.isInstancedMesh ? 'i' : ''}${o.isSkinnedMesh ? 's' : ''}`;
          if (vistos.has(clave)) return;
          vistos.add(clave);
          objetos.push(o);
        });
        // Contenedor suelto (no está en la escena): sólo sirve para pasarle a compile() un
        // puñado de objetos sin cambiarles el padre.
        const contenedor = new Object3D();
        const esperas = [];

        const compilarLote = (lote) => {
          const previos = [...mostrar, ...ocultar].map((objeto) => [objeto, objeto.visible]);
          const anterior = gl.getRenderTarget();
          try {
            mostrar.forEach((objeto) => {
              objeto.visible = true;
            });
            ocultar.forEach((objeto) => {
              objeto.visible = false;
            });
            const buffer = refCompositor.current?.inputBuffer;
            if (buffer) gl.setRenderTarget(buffer);
            contenedor.children = lote;
            // La parte que arma los programas es síncrona; sólo la espera es asíncrona.
            esperas.push(gl.compileAsync(contenedor, camera, scene).catch(() => {}));
          } catch {
            // Sin precompilación el costo vuelve a pagarse al primer dibujo, como antes.
          } finally {
            gl.setRenderTarget(anterior);
            previos.forEach(([objeto, visible]) => {
              objeto.visible = visible;
            });
          }
        };

        const paso = () => {
          const inicio = performance.now();
          while (objetos.length && performance.now() - inicio < PRESUPUESTO_MS) {
            compilarLote(objetos.splice(0, OBJETOS_POR_LLAMADA));
          }
          if (objetos.length) setTimeout(paso, ENTRE_LOTES_MS);
          else Promise.all(esperas).then(() => resolver());
        };
        paso();
      }),
    [gl, camera, scene, refCompositor]
  );
}

function texturasDe(objeto) {
  const texturas = new Set();
  objeto.traverse((o) => {
    const materiales = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const material of materiales) {
      for (const valor of Object.values(material)) {
        if (valor?.isTexture) texturas.add(valor);
      }
    }
  });
  return [...texturas];
}

// Va dentro de la escena de una estación: compila los shaders del mundo con esa estación
// presente (en paralelo, sin frenar el hilo) y sube sus texturas mientras está fuera de
// cuadro. Sin esto, todo eso ocurría la primera vez que la escena entraba en cuadro: justo
// al llegar, con un congelamiento de cientos de milisegundos a varios segundos.
// `alLista` avisa cuando la escena ya está compilada y puede mostrarse sin tirones.
export function Precompilar({ alLista }) {
  const marca = useRef(null);
  const gl = useThree((estado) => estado.gl);
  const compilarMundo = useContext(ContextoMundo);

  useEffect(() => {
    const objeto = marca.current?.parent;
    if (!objeto || !compilarMundo) return undefined;
    // La estación (grupo con userData.estacion) que contiene esta escena.
    let estacion = objeto;
    while (estacion && estacion.userData?.estacion === undefined) estacion = estacion.parent;
    let vivo = true;
    const temporizadores = new Set();
    const despues = (fn, ms) => {
      const id = setTimeout(() => {
        temporizadores.delete(id);
        if (vivo) fn();
      }, ms);
      temporizadores.add(id);
    };

    const subirTexturas = (pendientes) => {
      const textura = pendientes.shift();
      if (!textura) return;
      try {
        gl.initTexture(textura);
      } catch {
        // Una textura que no se pudo subir se sube sola al dibujarse.
      }
      despues(() => subirTexturas(pendientes), ENTRE_TEXTURAS_MS);
    };

    PASADAS_MS.forEach((ms, numero) => {
      despues(() => {
        compilarMundo(estacion ? [estacion] : [], []).then(() => {
          if (vivo && numero === PASADA_LISTA) alLista?.();
        });
        subirTexturas(texturasDe(objeto));
      }, ms);
    });
    return () => {
      vivo = false;
      temporizadores.forEach(clearTimeout);
    };
    // alLista cambia en cada render del padre: no debe reiniciar las pasadas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, compilarMundo]);

  return <object3D ref={marca} />;
}
