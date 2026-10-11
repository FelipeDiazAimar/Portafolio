'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import PiezaDesarmable from '../PiezaDesarmable.jsx';
import { cuerpoOscuro, azulEmisivo, cianEmisivo } from '../materiales.js';
import { crearPantalla } from '../pantallaCanvas.js';
import { dibujarPlaca } from '../dibujarPlaca.js';
import { fraccionExplosion } from '../cicloPC.js';

// Cuánto se separa cada pieza de su lugar en la vista explotada. Cada pieza sale
// en su propia dirección (`dir`), pensada para que no choquen entre sí.
const SEPARACION = 1.3;

// Grupo que se desplaza `dir * fracción * SEPARACION` y, opcionalmente, hace girar
// algo (ventiladores). La fracción la calcula la escena una vez por cuadro y se
// comparte por referencia.
function Flotante({ dir, fraccion, children }) {
  const grupo = useRef(null);
  useFrame(() => {
    const f = fraccion.current;
    grupo.current.position.set(dir[0] * f * SEPARACION, dir[1] * f * SEPARACION, dir[2] * f * SEPARACION);
  });
  return <group ref={grupo}>{children}</group>;
}

// Ventilador: aspas (cajas finas) sobre un aro. Gira en `useFrame` con el tiempo.
function Ventilador({ radio = 0.36, refAspas }) {
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]} material={cuerpoOscuro}>
        <torusGeometry args={[radio, 0.035, 12, 40]} />
      </mesh>
      <group ref={refAspas}>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <mesh
            key={i}
            position={[Math.cos((i / 7) * Math.PI * 2) * radio * 0.52, Math.sin((i / 7) * Math.PI * 2) * radio * 0.52, 0]}
            rotation={[0.5, 0, (i / 7) * Math.PI * 2]}
            material={cianEmisivo}
          >
            <boxGeometry args={[radio * 0.8, radio * 0.2, 0.015]} />
          </mesh>
        ))}
      </group>
      <mesh rotation={[Math.PI / 2, 0, 0]} material={azulEmisivo}>
        <cylinderGeometry args={[radio * 0.18, radio * 0.18, 0.05, 20]} />
      </mesh>
    </group>
  );
}

export default function Escena3PC({ activa, reducido }) {
  const placa = useMemo(() => {
    const l = crearPantalla(512, 512);
    dibujarPlaca(l.ctx, l.ancho, l.alto);
    l.textura.needsUpdate = true;
    return l;
  }, []);
  const fraccion = useRef(0);
  const tiempo = useRef(0);
  const refAspasCpu = useRef(null);
  const refAspasGpuA = useRef(null);
  const refAspasGpuB = useRef(null);

  useEffect(() => () => placa.textura.dispose(), [placa]);

  useFrame((_, delta) => {
    if (!activa) return;
    // Con movimiento reducido la PC queda armada y quieta.
    if (reducido) {
      fraccion.current = 0;
      return;
    }
    tiempo.current += Math.min(delta, 0.05);
    fraccion.current = fraccionExplosion(tiempo.current);
    const giro = tiempo.current * 9;
    if (refAspasCpu.current) refAspasCpu.current.rotation.z = giro;
    if (refAspasGpuA.current) refAspasGpuA.current.rotation.z = -giro * 1.2;
    if (refAspasGpuB.current) refAspasGpuB.current.rotation.z = -giro * 1.2 + 1;
  });

  return (
    <group position={[0.1, 0.4, 0]} rotation={[0, -0.45, 0]} scale={0.78}>
      {/* Placa madre: el fondo de todo; no se mueve en la vista explotada. */}
      <PiezaDesarmable semilla={1}>
        <mesh>
          <boxGeometry args={[2.5, 2.5, 0.07]} />
          <meshStandardMaterial map={placa.textura} emissiveMap={placa.textura} emissive="#ffffff" emissiveIntensity={0.55} roughness={0.6} metalness={0.2} />
        </mesh>
        <mesh position={[0, 0, 0.04]} material={azulEmisivo}>
          <boxGeometry args={[2.5, 0.015, 0.012]} />
        </mesh>
      </PiezaDesarmable>

      {/* CPU con su cooler: sale hacia el frente */}
      <PiezaDesarmable semilla={2}>
        <Flotante dir={[0.1, 0.55, 1]} fraccion={fraccion}>
          <group position={[0.1, 0.55, 0.07]}>
            <mesh material={cuerpoOscuro}>
              <boxGeometry args={[0.62, 0.62, 0.06]} />
            </mesh>
            <mesh position={[0, 0, 0.035]} material={azulEmisivo}>
              <boxGeometry args={[0.34, 0.34, 0.012]} />
            </mesh>
            <group position={[0, 0, 0.17]}>
              <mesh material={cuerpoOscuro}>
                <boxGeometry args={[0.78, 0.78, 0.2]} />
              </mesh>
              <group position={[0, 0, 0.115]}>
                <Ventilador radio={0.3} refAspas={refAspasCpu} />
              </group>
            </group>
          </group>
        </Flotante>
      </PiezaDesarmable>

      {/* RAM: dos módulos, salen a la derecha y al frente */}
      <PiezaDesarmable semilla={3}>
        <Flotante dir={[1, 0.25, 0.8]} fraccion={fraccion}>
          {[0, 1].map((i) => (
            <group key={i} position={[0.92 + i * 0.17, 0.62, 0.1]}>
              <mesh material={cuerpoOscuro}>
                <boxGeometry args={[0.1, 1.2, 0.05]} />
              </mesh>
              <mesh position={[0, 0.5, 0.03]} material={i ? cianEmisivo : azulEmisivo}>
                <boxGeometry args={[0.06, 0.12, 0.012]} />
              </mesh>
              {[-0.35, -0.1, 0.15].map((y) => (
                <mesh key={y} position={[0, y, 0.03]} material={cuerpoOscuro}>
                  <boxGeometry args={[0.07, 0.16, 0.02]} />
                </mesh>
              ))}
            </group>
          ))}
        </Flotante>
      </PiezaDesarmable>

      {/* GPU: placa ancha con dos ventiladores, sale hacia abajo y al frente */}
      <PiezaDesarmable semilla={4}>
        <Flotante dir={[-0.2, -0.8, 1.1]} fraccion={fraccion}>
          <group position={[-0.1, -0.5, 0.22]}>
            <mesh material={cuerpoOscuro}>
              <boxGeometry args={[2.0, 0.55, 0.3]} />
            </mesh>
            <mesh position={[0, 0.285, 0]} material={azulEmisivo}>
              <boxGeometry args={[2.0, 0.015, 0.31]} />
            </mesh>
            <group position={[-0.5, 0, 0.17]}>
              <Ventilador radio={0.22} refAspas={refAspasGpuA} />
            </group>
            <group position={[0.5, 0, 0.17]}>
              <Ventilador radio={0.22} refAspas={refAspasGpuB} />
            </group>
          </group>
        </Flotante>
      </PiezaDesarmable>

      {/* SSD M.2: sale a la izquierda */}
      <PiezaDesarmable semilla={5}>
        <Flotante dir={[-1, 0.35, 0.7]} fraccion={fraccion}>
          <group position={[-0.8, 0.35, 0.08]}>
            <mesh material={cuerpoOscuro}>
              <boxGeometry args={[0.85, 0.2, 0.04]} />
            </mesh>
            <mesh position={[-0.25, 0, 0.025]} material={cianEmisivo}>
              <boxGeometry args={[0.22, 0.12, 0.012]} />
            </mesh>
            <mesh position={[0.18, 0, 0.025]} material={azulEmisivo}>
              <boxGeometry args={[0.3, 0.12, 0.012]} />
            </mesh>
          </group>
        </Flotante>
      </PiezaDesarmable>

      {/* Fuente de poder: sale hacia abajo */}
      <PiezaDesarmable semilla={6}>
        <Flotante dir={[0.1, -1, 0.3]} fraccion={fraccion}>
          <group position={[0, -1.45, 0.05]}>
            <mesh material={cuerpoOscuro}>
              <boxGeometry args={[1.5, 0.5, 0.7]} />
            </mesh>
            <mesh position={[0, 0, 0.36]} material={azulEmisivo}>
              <boxGeometry args={[0.6, 0.06, 0.012]} />
            </mesh>
            <mesh position={[0.55, 0, 0.36]} material={cianEmisivo}>
              <boxGeometry args={[0.14, 0.14, 0.012]} />
            </mesh>
          </group>
        </Flotante>
      </PiezaDesarmable>
    </group>
  );
}
