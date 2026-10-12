'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { ancla, longitudHasta, vertebra } from '@/lib/columna/geometria.js';
import { activoDe, llenadoDe } from '@/lib/columna/recorrido.js';
import { curvaColumna } from './curva.js';

const Z = new THREE.Vector3(0, 0, 1);

// Un anillo por hito, perpendicular a la columna, y una "costilla" que lo une con su
// modelo. Apagado → encendido (con un destello) cuando la luz lo pasa; el del hito
// actual late despacio.
export default function Vertebras({ n, refTramo, colores, reducido }) {
  const curva = curvaColumna(n);
  const datos = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => {
        const { centro } = vertebra(i, n);
        const { posicion } = ancla(i, n);
        const fraccion = longitudHasta(i, n);
        const tangente = curva.getTangentAt(fraccion);
        const centro3 = new THREE.Vector3(centro.x, centro.y, centro.z);
        const hacia = new THREE.Vector3(posicion.x, posicion.y, posicion.z).sub(centro3);
        return {
          centro: centro3,
          giro: new THREE.Quaternion().setFromUnitVectors(Z, tangente),
          fraccion,
          // La costilla llega hasta un poco más de la mitad: no atraviesa el modelo.
          costilla: [centro3.toArray(), centro3.clone().addScaledVector(hacia, 0.55).toArray()],
        };
      }),
    [n, curva]
  );
  const geoAnillo = useMemo(() => new THREE.TorusGeometry(0.42, 0.035, 12, 64), []);
  const materiales = useMemo(
    () => datos.map(() => new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false })),
    [datos]
  );
  const refAnillos = useRef([]);
  const encendidaDesde = useRef(datos.map(() => -1));
  const base = useMemo(() => new THREE.Color(colores.acento), [colores.acento]);
  const apagado = useMemo(() => new THREE.Color(colores.apagado), [colores.apagado]);

  useEffect(
    () => () => {
      geoAnillo.dispose();
      materiales.forEach((m) => m.dispose());
    },
    [geoAnillo, materiales]
  );

  useFrame(({ clock }) => {
    const tramo = refTramo.current;
    const llenado = llenadoDe(tramo, n);
    const activo = activoDe(tramo);
    const ahora = clock.elapsedTime;
    datos.forEach((dato, i) => {
      const encendida = llenado >= dato.fraccion - 1e-6;
      if (encendida && encendidaDesde.current[i] < 0) encendidaDesde.current[i] = ahora;
      if (!encendida) encendidaDesde.current[i] = -1;
      const destello = encendida && !reducido ? Math.max(0, 1 - (ahora - encendidaDesde.current[i]) / 0.3) : 0;
      const latido = !reducido && tramo.tipo === 'estancia' && i === activo ? 0.5 + 0.5 * Math.sin((ahora * 2 * Math.PI) / 2.4) : 0;
      const material = materiales[i];
      material.color.copy(encendida ? base : apagado).multiplyScalar(encendida ? 2 + destello * 3 + latido : 1);
      material.opacity = encendida ? 1 : 0.25;
      const anillo = refAnillos.current[i];
      if (anillo) anillo.scale.setScalar(1 + latido * 0.08);
    });
  });

  return datos.map((dato, i) => (
    <group key={i}>
      <mesh
        ref={(malla) => {
          refAnillos.current[i] = malla;
        }}
        position={dato.centro}
        quaternion={dato.giro}
        geometry={geoAnillo}
        material={materiales[i]}
      />
      <Line points={dato.costilla} color={colores.acento} lineWidth={1.5} transparent opacity={0.45} />
    </group>
  ));
}
