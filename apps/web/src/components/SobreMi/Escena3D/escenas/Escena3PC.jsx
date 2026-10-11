'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment, Lightformer, useGLTF } from '@react-three/drei';
import PiezaDesarmable from '../PiezaDesarmable.jsx';
import { fraccionExplosion } from '../cicloPC.js';
import { separarPiezas } from './modelos.js';

const RUTA = '/modelos/placa-am4.glb';
const ANCHO = 2.7;
// Cuánto se separa cada pieza de la placa en la vista explotada.
const SEPARACION = 2.1;

// Las piezas son los hijos de la placa ("motherboard") más la ranura mini PCIe.
// La placa en sí (el circuito impreso) es la pieza `Object_4`.
function elegirPiezas(raiz) {
  const placa = raiz.getObjectByName('motherboard_65');
  const mini = raiz.getObjectByName('mini pcie_66');
  return [...placa.children, mini].filter(Boolean);
}

// Número estable a partir del nombre (para repartir alturas y sentidos sin azar).
function hash(texto) {
  let h = 0;
  for (let i = 0; i < texto.length; i += 1) h = (h * 31 + texto.charCodeAt(i)) % 9973;
  return h / 9973;
}

// Pieza que se separa de la placa en vertical (y un poco hacia afuera) durante
// la vista explotada. La fracción la calcula la escena una vez por cuadro.
function Flotante({ centro, nombre, fraccion, fijo, children }) {
  const grupo = useRef(null);
  const elevacion = useMemo(() => 0.35 + hash(nombre) * 0.9, [nombre]);
  useFrame(() => {
    const f = fijo ? 0 : fraccion.current;
    grupo.current.position.set(centro[0] * f * 0.35, f * SEPARACION * elevacion, centro[2] * f * 0.35);
  });
  return <group ref={grupo}>{children}</group>;
}

export default function Escena3PC({ activa, reducido }) {
  const { scene } = useGLTF(RUTA);
  const modelo = useMemo(() => separarPiezas(scene, { anchoObjetivo: ANCHO, elegirPiezas }), [scene]);
  const fraccion = useRef(0);
  const tiempo = useRef(0);

  useEffect(() => {
    // El clon comparte geometrías y materiales con el original (que useGLTF
    // guarda en caché): no se liberan acá.
    return undefined;
  }, [modelo]);

  useFrame((_, delta) => {
    if (!activa) return;
    // Con movimiento reducido la placa queda armada y quieta.
    if (reducido) {
      fraccion.current = 0;
      return;
    }
    tiempo.current += Math.min(delta, 0.05);
    fraccion.current = fraccionExplosion(tiempo.current);
  });

  const { escala, centro, piezas } = modelo;
  return (
    <group position={[0.1, 0.05, 0]} rotation={[0.42, -0.45, 0]}>
      {/* Iluminación de estudio: paneles de luz que se reflejan en los metales. */}
      <Environment resolution={512} frames={1} environmentIntensity={0.75}>
        <color attach="background" args={['#8190a6']} />
        <Lightformer form="rect" intensity={9} color="#ffffff" position={[0, 6, 5]} rotation-x={Math.PI / 2.2} scale={[14, 6, 1]} />
        <Lightformer form="rect" intensity={6} color="#f4f7ff" position={[0, 1, 9]} scale={[16, 9, 1]} />
        <Lightformer form="rect" intensity={4} color="#7fe6ff" position={[-7, 1, 1]} rotation-y={Math.PI / 2} scale={[9, 5, 1]} />
        <Lightformer form="rect" intensity={4} color="#b9ccff" position={[7, 1, 2]} rotation-y={-Math.PI / 2} scale={[9, 5, 1]} />
      </Environment>
      <directionalLight position={[3, 6, 7]} intensity={0.9} color="#ffffff" />
      <directionalLight position={[-5, 2, 4]} intensity={0.35} color="#dfe8ff" />

      {piezas.map(({ objeto, centro: c }, i) => (
        <Flotante key={objeto.uuid} centro={c} nombre={objeto.name} fraccion={fraccion} fijo={objeto.name === 'Object_4'}>
          <PiezaDesarmable centro={c} semilla={i + 1}>
            <group scale={escala} position={[-centro.x * escala, -centro.y * escala, -centro.z * escala]}>
              <primitive object={objeto} />
            </group>
          </PiezaDesarmable>
        </Flotante>
      ))}
    </group>
  );
}
