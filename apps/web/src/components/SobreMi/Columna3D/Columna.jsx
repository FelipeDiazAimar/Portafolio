'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RADIO_HALO, RADIO_TUBO } from '@/lib/columna/geometria.js';
import { llenadoDe } from '@/lib/columna/recorrido.js';
import { curvaColumna } from './curva.js';
import { crearMaterialColumna } from './shaderColumna.js';

// El eje luminoso: un tubo fino (núcleo) y uno más grueso aditivo (halo) que da el
// resplandor aunque el bloom esté apagado.
export default function Columna({ n, refTramo, colores, reducido }) {
  const curva = curvaColumna(n);
  const geoNucleo = useMemo(() => new THREE.TubeGeometry(curva, 400, RADIO_TUBO, 12, false), [curva]);
  const geoHalo = useMemo(() => new THREE.TubeGeometry(curva, 200, RADIO_HALO, 12, false), [curva]);
  const nucleo = useMemo(() => crearMaterialColumna(), []);
  const halo = useMemo(() => crearMaterialColumna({ intensidad: 0.25, aditivo: true }), []);

  useEffect(() => {
    [nucleo, halo].forEach((material) => {
      material.uniforms.uColor.value.set(colores.acento);
      material.uniforms.uApagado.value.set(colores.apagado);
    });
  }, [nucleo, halo, colores]);

  useEffect(
    () => () => {
      geoNucleo.dispose();
      geoHalo.dispose();
      nucleo.dispose();
      halo.dispose();
    },
    [geoNucleo, geoHalo, nucleo, halo]
  );

  useFrame((_, delta) => {
    const llenado = llenadoDe(refTramo.current, n);
    [nucleo, halo].forEach((material) => {
      material.uniforms.uLlenado.value = llenado;
      // Con movimiento reducido los pulsos quedan quietos.
      if (!reducido) material.uniforms.uTiempo.value += Math.min(delta, 0.05);
    });
  });

  return (
    <>
      <mesh geometry={geoNucleo} material={nucleo} />
      <mesh geometry={geoHalo} material={halo} />
    </>
  );
}
