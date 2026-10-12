'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ancla, longitudHasta, vertebra } from '@/lib/columna/geometria.js';
import { activoDe, llenadoDe } from '@/lib/columna/recorrido.js';
import { curvaColumna } from './curva.js';

const Z = new THREE.Vector3(0, 0, 1);
// Costilla curva: comba leve hacia arriba, tubo fino y halo aditivo chicos
// (7 costillas, geometría mínima para no pesar en el cuadro).
const COMBA_ARRIBA = 0.35;
const SEGMENTOS_COSTILLA = 20;
const RADIO_COSTILLA = 0.02;
const RADIO_HALO_COSTILLA = 0.06;

// Un anillo por hito, perpendicular a la columna, y una "costilla" curva que lo
// une con su modelo. Apagado → encendido (con un destello) cuando la luz lo
// pasa; el del hito actual late despacio.
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
        // La costilla llega hasta un poco más de la mitad: no atraviesa el modelo.
        const fin = centro3.clone().addScaledVector(hacia, 0.55);
        return {
          centro: centro3,
          giro: new THREE.Quaternion().setFromUnitVectors(Z, tangente),
          fraccion,
          inicio: centro3,
          fin,
        };
      }),
    [n, curva]
  );
  // Una cuadrática por costilla: del anillo al modelo con leve comba hacia
  // arriba. Tubo fino (núcleo) + tubo grueso aditivo (halo).
  const costillas = useMemo(
    () =>
      datos.map((dato) => {
        const medio = dato.inicio.clone().lerp(dato.fin, 0.5);
        medio.y += COMBA_ARRIBA;
        const curvaCostilla = new THREE.QuadraticBezierCurve3(dato.inicio.clone(), medio, dato.fin.clone());
        return {
          curva: curvaCostilla,
          geoNucleo: new THREE.TubeGeometry(curvaCostilla, SEGMENTOS_COSTILLA, RADIO_COSTILLA, 6, false),
          geoHalo: new THREE.TubeGeometry(curvaCostilla, SEGMENTOS_COSTILLA, RADIO_HALO_COSTILLA, 6, false),
        };
      }),
    [datos]
  );
  const geoAnillo = useMemo(() => new THREE.TorusGeometry(0.42, 0.035, 12, 64), []);
  const materiales = useMemo(
    () => datos.map(() => new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false })),
    [datos]
  );
  const matCostilla = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, toneMapped: false }), []);
  const matHaloCostilla = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    []
  );
  const matPulso = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false }), []);
  const geoPulso = useMemo(() => new THREE.SphereGeometry(0.07, 8, 8), []);
  const refAnillos = useRef([]);
  const refPulsos = useRef([]);
  const encendidaDesde = useRef(datos.map(() => -1));
  const base = useMemo(() => new THREE.Color(colores.acento), [colores.acento]);
  const apagado = useMemo(() => new THREE.Color(colores.apagado), [colores.apagado]);

  useEffect(() => {
    matCostilla.color.set(colores.acento).multiplyScalar(2);
    matHaloCostilla.color.set(colores.acento);
    matPulso.color.set(colores.acento).multiplyScalar(3);
  }, [matCostilla, matHaloCostilla, matPulso, colores.acento]);

  useEffect(
    () => () => {
      geoAnillo.dispose();
      materiales.forEach((m) => m.dispose());
      costillas.forEach((c) => {
        c.geoNucleo.dispose();
        c.geoHalo.dispose();
      });
      matCostilla.dispose();
      matHaloCostilla.dispose();
      matPulso.dispose();
      geoPulso.dispose();
    },
    [geoAnillo, materiales, costillas, matCostilla, matHaloCostilla, matPulso, geoPulso]
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
    // Pulso de luz que viaja del anillo al modelo. Quieto con reducido (ni se
    // monta el mesh, pero se guarda el guardia por si cambia la preferencia).
    if (!reducido) {
      costillas.forEach((costilla, i) => {
        const pulso = refPulsos.current[i];
        if (!pulso) return;
        const t = (ahora * 0.35 + i / costillas.length) % 1;
        costilla.curva.getPoint(t, pulso.position);
        pulso.scale.setScalar(0.6 + 0.4 * Math.sin(t * Math.PI));
      });
    }
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
      <mesh geometry={costillas[i].geoNucleo} material={matCostilla} />
      <mesh geometry={costillas[i].geoHalo} material={matHaloCostilla} />
      {reducido ? null : (
        <mesh
          ref={(malla) => {
            refPulsos.current[i] = malla;
          }}
          geometry={geoPulso}
          material={matPulso}
        />
      )}
    </group>
  ));
}
