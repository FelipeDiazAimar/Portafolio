'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { RADIO_ANCLA, transformacionMundo } from '@/lib/columna/geometria.js';
import { OPCIONES_ESCRITORIO, OPCIONES_MOVIL, estadoDe, estadoLineal } from '@/lib/columna/recorrido.js';
import LucesAzules from '../Escena3D/LucesAzules.jsx';
import ControlGiro from '../Escena3D/ControlGiro.jsx';
import { DISTANCIA_MINIMA, FOV } from '../Escena3D/vista.js';
import { esEscenaFija, limiteDeGiro } from '../Escena3D/escenas/index.js';
import { leerColores } from './colores.js';
import Columna from './Columna.jsx';
import Vertebras from './Vertebras.jsx';
import Estaciones from './Estaciones.jsx';
import Estela from './Estela.jsx';
import Polvo from './Polvo.jsx';
import Efectos from './Efectos.jsx';
import CamaraRecorrido from './CamaraRecorrido.jsx';
import { ContextoCompositor } from './precompilacion.jsx';
import EntornoMundo from './EntornoMundo.jsx';

// Hitos cuyas escenas usan el entorno de estudio (PC y banco de trabajo).
const IDS_CON_ENTORNO = [3, 4];

// Mueve y gira todo el mundo para que el hito del estado `s` quede en el origen
// mirando a la cámara: Mundo = T(0,0,-R) · Ry(-θ) · T(-c).
function Rig({ n, refTramo, reducido, lineal = false, children }) {
  const refPivote = useRef(null);
  const refContenido = useRef(null);
  useFrame(() => {
    const t = transformacionMundo(lineal ? estadoLineal(refTramo.current) : estadoDe(refTramo.current, { reducido }), n);
    refPivote.current.rotation.y = t.rotacionY;
    refContenido.current.position.set(...t.contenido);
  });
  return (
    <group ref={refPivote} position={[0, 0, -RADIO_ANCLA]}>
      <group ref={refContenido}>{children}</group>
    </group>
  );
}

function Niebla({ color }) {
  const scene = useThree((estado) => estado.scene);
  useEffect(() => {
    scene.fog = new THREE.FogExp2(color, 0.035);
    return () => {
      scene.fog = null;
    };
  }, [scene, color]);
  return null;
}

// Escalones de rendimiento (nunca vuelven a subir en la sesión):
// 1 → sin bloom (queda el halo aditivo); 2 → menos chispas y polvo; 3 → dpr 1.
export default function MundoColumna({ hitos, refTramo, activo, tipo, indiceViaje, ocultarModelos, origen, visitas, lado, esMovil, reducido, claro, visible, onError, alModeloListo }) {
  const n = hitos.length;
  const [colores, setColores] = useState(() => leerColores(claro));
  useEffect(() => setColores(leerColores(claro)), [claro]);
  const [nivel, setNivel] = useState(0);
  const desmontando = useRef(false);
  useEffect(() => {
    desmontando.current = false;
    return () => {
      desmontando.current = true;
    };
  }, []);
  const idActivo = hitos[activo].id;
  const refCompositor = useRef(null);
  const centros = useMemo(() => hitos.map((h, i) => (IDS_CON_ENTORNO.includes(h.id) ? i : -1)).filter((i) => i >= 0), [hitos]);

  return (
    <Canvas
      dpr={nivel >= 3 ? 1 : [1, 1.75]}
      frameloop={visible ? 'always' : 'never'}
      camera={{ position: [0, 0.7, DISTANCIA_MINIMA], fov: FOV, near: 0.1, far: 200 }}
      gl={{ alpha: true, antialias: true }}
      style={{ position: 'absolute', inset: 0 }}
      onCreated={({ gl }) => {
        // Leer el log de cada programa obliga a esperar su compilación en el acto.
        gl.debug.checkShaderErrors = false;
        const lienzo = gl.domElement;
        lienzo.addEventListener('webglcontextlost', (evento) => {
          // R3F fuerza la pérdida del contexto al desmontar el canvas: eso no es un fallo.
          if (desmontando.current || !lienzo.isConnected) return;
          evento.preventDefault();
          onError();
        });
      }}
    >
      <PerformanceMonitor onDecline={() => setNivel((previo) => Math.min(3, previo + 1))} />
      <Niebla color={colores.fondo} />
      {/* Las luces quedan fuera del mundo: iluminan al hito actual igual que antes. */}
      <LucesAzules />
      <EntornoMundo refTramo={refTramo} reducido={reducido} centros={centros} />
      <ControlGiro quieto={reducido} girable={!esEscenaFija(idActivo)} limiteAzimut={limiteDeGiro(idActivo)} />
      <CamaraRecorrido
        n={n}
        refTramo={refTramo}
        lado={lado}
        opciones={esMovil ? OPCIONES_MOVIL : OPCIONES_ESCRITORIO}
        reducido={reducido}
        salto={ocultarModelos}
      />
      <ContextoCompositor.Provider value={refCompositor}>
      <Rig n={n} refTramo={refTramo} reducido={reducido} lineal={ocultarModelos}>
        <Columna n={n} refTramo={refTramo} colores={colores} reducido={reducido} />
        {/* los arcos que unen cada modelo con la línea de tiempo no se ven durante los viajes */}
        <Vertebras n={n} refTramo={refTramo} colores={colores} reducido={reducido} ocultarCostillas={ocultarModelos || tipo === 'viaje'} />
        {reducido ? null : <Estela n={n} refTramo={refTramo} color={colores.acento} cantidad={nivel >= 2 ? 60 : 240} />}
        <Polvo n={n} color={colores.acento} cantidad={nivel >= 2 ? 400 : 1200} reducido={reducido} />
        <Estaciones
          hitos={hitos}
          activo={activo}
          tipo={tipo}
          indiceViaje={indiceViaje}
          ocultarModelos={ocultarModelos}
          origen={origen}
          visitas={visitas}
          reducido={reducido}
          claro={claro}
          fraccion={esMovil ? 1 : 0.5}
          color={colores.acento}
          alModeloListo={alModeloListo}
        />
      </Rig>
      </ContextoCompositor.Provider>
      {nivel >= 1 ? null : <Efectos claro={claro} refCompositor={refCompositor} />}
    </Canvas>
  );
}
