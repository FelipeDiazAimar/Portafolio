'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { llenadoDe } from '@/lib/columna/recorrido.js';
import { curvaColumna } from './curva.js';

const VIDA_S = 1.2;
const POR_CUADRO = 6;

const vertexShader = /* glsl */ `
  attribute float vida;
  uniform float uTamano;
  varying float vVida;
  void main() {
    vVida = vida;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uTamano * vida * (300.0 / max(-mv.z, 0.1));
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vVida;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5 || vVida <= 0.0) discard;
    gl_FragColor = vec4(uColor * 2.0, vVida * (1.0 - d * 2.0));
  }
`;

// Chispas que suelta la cabeza de luz mientras avanza. Viven en el espacio de la
// columna: se quedan donde nacieron y, como el mundo se mueve, dibujan la estela.
export default function Estela({ n, refTramo, color, cantidad = 240 }) {
  const curva = curvaColumna(n);
  const datos = useMemo(
    () => ({
      posicion: new Float32Array(cantidad * 3),
      velocidad: new Float32Array(cantidad * 3),
      vida: new Float32Array(cantidad),
      siguiente: 0,
    }),
    [cantidad]
  );
  const geometria = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(datos.posicion, 3));
    g.setAttribute('vida', new THREE.BufferAttribute(datos.vida, 1));
    // Se mueven todo el tiempo: una esfera envolvente fija y grande evita que se recorten.
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 30, 0), 80);
    return g;
  }, [datos]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        uniforms: { uTamano: { value: 0.05 }, uColor: { value: new THREE.Color(color) } },
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

  const cabeza = useRef(new THREE.Vector3());
  const anterior = useRef(null);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    curva.getPointAt(llenadoDe(refTramo.current, n), cabeza.current);
    const rapidez = anterior.current && dt > 0 ? anterior.current.distanceTo(cabeza.current) / dt : 0;
    anterior.current = (anterior.current ?? new THREE.Vector3()).copy(cabeza.current);

    if (rapidez > 0.3) {
      const nuevas = Math.min(POR_CUADRO, Math.ceil(rapidez * dt * 20));
      for (let k = 0; k < nuevas; k += 1) {
        const i = datos.siguiente;
        datos.siguiente = (i + 1) % cantidad;
        const angulo = Math.random() * Math.PI * 2;
        const fuerza = 0.2 + Math.random() * 0.4;
        datos.posicion.set([cabeza.current.x, cabeza.current.y, cabeza.current.z], i * 3);
        datos.velocidad.set(
          [Math.cos(angulo) * fuerza, (Math.random() - 0.5) * 0.4 * fuerza, Math.sin(angulo) * fuerza],
          i * 3
        );
        datos.vida[i] = 1;
      }
    }
    for (let i = 0; i < cantidad; i += 1) {
      if (datos.vida[i] <= 0) continue;
      datos.vida[i] = Math.max(0, datos.vida[i] - dt / VIDA_S);
      datos.posicion[i * 3] += datos.velocidad[i * 3] * dt;
      datos.posicion[i * 3 + 1] += datos.velocidad[i * 3 + 1] * dt;
      datos.posicion[i * 3 + 2] += datos.velocidad[i * 3 + 2] * dt;
    }
    geometria.attributes.position.needsUpdate = true;
    geometria.attributes.vida.needsUpdate = true;
  });

  return <points geometry={geometria} material={material} frustumCulled={false} />;
}
