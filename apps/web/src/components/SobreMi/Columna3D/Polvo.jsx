'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { EXTRA, altoTotal } from '@/lib/columna/geometria.js';

const vertexShader = /* glsl */ `
  attribute float fase;
  uniform float uTiempo;
  uniform float uTamano;
  varying float vAlfa;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uTamano * (300.0 / max(-mv.z, 0.1));
    vAlfa = 0.35 * (0.6 + 0.4 * sin(uTiempo * 0.8 + fase)) * exp(-pow(-mv.z * 0.03, 2.0));
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlfa;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(uColor, vAlfa * (1.0 - d * 2.0));
  }
`;

// Polvo que flota alrededor de la columna (un cilindro de radio 2 a 12) y parpadea
// despacio. Está en el espacio de la columna: el parallax sale solo al moverse el mundo.
export default function Polvo({ n, color, cantidad = 1200, reducido }) {
  const geometria = useMemo(() => {
    const posicion = new Float32Array(cantidad * 3);
    const fase = new Float32Array(cantidad);
    const desde = -EXTRA;
    const alto = altoTotal(n) + 2 * EXTRA;
    for (let i = 0; i < cantidad; i += 1) {
      const angulo = Math.random() * Math.PI * 2;
      const radio = 2 + Math.random() * 10;
      posicion.set([Math.cos(angulo) * radio, desde + Math.random() * alto, Math.sin(angulo) * radio], i * 3);
      fase[i] = Math.random() * Math.PI * 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(posicion, 3));
    g.setAttribute('fase', new THREE.BufferAttribute(fase, 1));
    return g;
  }, [n, cantidad]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTiempo: { value: 0 }, uTamano: { value: 0.04 }, uColor: { value: new THREE.Color(color) } },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  useEffect(() => {
    // `Color.set` devuelve el color (no una limpieza): con llaves no se retorna nada.
    material.uniforms.uColor.value.set(color);
  }, [material, color]);
  useEffect(
    () => () => {
      geometria.dispose();
      material.dispose();
    },
    [geometria, material]
  );
  useFrame((_, delta) => {
    if (!reducido) material.uniforms.uTiempo.value += Math.min(delta, 0.05);
  });
  return <points geometry={geometria} material={material} />;
}
