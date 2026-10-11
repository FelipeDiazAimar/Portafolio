'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CAPAS, activacion, conexionesRed, expansionCapa, nodosRed } from '../../constelacion.js';

const CANTIDAD_PULSOS = 90;
const CANTIDAD_PARTICULAS = 520;

const salida = (x) => 1 - (1 - x) ** 3;

// Número pseudoaleatorio estable (misma semilla → mismo valor).
function azar(semilla) {
  const s = Math.sin(semilla * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

// Red neuronal que sale del núcleo: capas de nodos con halo, todas las conexiones
// entre capas, una onda de activación que la cruza y pulsos de luz que viajan por
// ella, con un campo de partículas alrededor. Todo depende de `tiempo.current`.
export default function RedNeuronal({ tiempo, claro, luz }) {
  const nodos = useMemo(() => nodosRed(), []);
  const conexiones = useMemo(() => conexionesRed(), []);
  const porCapa = useMemo(() => CAPAS.slice(0, -1).map((_, c) => conexiones.filter((x) => x.capa === c)), [conexiones]);
  // Cada pulso recorre un camino de un nodo por capa, elegido de forma estable.
  const caminos = useMemo(() => {
    const inicios = CAPAS.map((_, i) => CAPAS.slice(0, i).reduce((a, b) => a + b, 0));
    return Array.from({ length: CANTIDAD_PULSOS }, (_, k) =>
      CAPAS.map((cantidad, c) => inicios[c] + Math.floor(azar(k * 7.7 + c * 3.1) * cantidad))
    );
  }, []);
  const particulas = useMemo(() => {
    const posiciones = new Float32Array(CANTIDAD_PARTICULAS * 3);
    for (let i = 0; i < CANTIDAD_PARTICULAS; i += 1) {
      const radio = 2.2 + azar(i * 1.3) * 3.2;
      const u = azar(i * 2.1) * 2 - 1;
      const fi = azar(i * 3.7) * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      posiciones.set([radio * r * Math.cos(fi), radio * u * 0.8, radio * r * Math.sin(fi)], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
    return g;
  }, []);

  const recursos = useMemo(() => {
    // La mezcla aditiva sobre un fondo claro se vería blanca: ahí se usa la normal.
    const aditivo = { transparent: true, depthWrite: false, blending: claro ? THREE.NormalBlending : THREE.AdditiveBlending, toneMapped: false };
    return {
      nodo: new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
      halo: new THREE.MeshBasicMaterial({ color: '#4d8dff', opacity: claro ? 0.22 : 0.35, ...aditivo }),
      pulso: new THREE.MeshBasicMaterial({ color: claro ? '#0b3d91' : '#d6e8ff', ...aditivo }),
      puntos: new THREE.PointsMaterial({ color: claro ? '#2f6fe6' : '#9fc2ff', size: 0.045, opacity: 0, ...aditivo }),
      lineas: CAPAS.slice(0, -1).map((_, c) => new THREE.LineBasicMaterial({ color: new THREE.Color().setHSL(0.6 - c * 0.025, 1, claro ? 0.4 : 0.62), opacity: 0, ...aditivo })),
      geoNodo: new THREE.SphereGeometry(1, 20, 14),
      geoPulso: new THREE.SphereGeometry(1, 8, 6),
    };
  }, [claro]);

  // Un buffer de segmentos por par de capas (se reescribe mientras la red se expande).
  const geometriasLineas = useMemo(
    () =>
      porCapa.map((lista) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lista.length * 6), 3));
        return g;
      }),
    [porCapa]
  );

  const refNodos = useRef(null);
  const refHalos = useRef(null);
  const refPulsos = useRef(null);
  const refPuntos = useRef(null);
  const posiciones = useRef(nodos.map(() => new THREE.Vector3()));
  const aux = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const ultimaExpansion = useRef(-1);

  useLayoutEffect(() => {
    // Los instancedMesh necesitan color por instancia desde el primer cuadro.
    nodos.forEach((_, i) => {
      refNodos.current.setColorAt(i, color.set('#ffffff'));
      refHalos.current.setColorAt(i, color.set('#4d8dff'));
    });
  }, [nodos, color]);

  useEffect(
    () => () => {
      Object.values(recursos).forEach((r) => (Array.isArray(r) ? r.forEach((m) => m.dispose()) : r.dispose()));
      geometriasLineas.forEach((g) => g.dispose());
      particulas.dispose();
    },
    [recursos, geometriasLineas, particulas]
  );

  useFrame(() => {
    const t = tiempo.current;
    const exp = CAPAS.map((_, c) => salida(expansionCapa(c, t)));
    const act = CAPAS.map((_, c) => activacion(c, t));

    // Nodos y halos: salen del centro, brillan cuando pasa la onda.
    nodos.forEach((nodo, i) => {
      const e = exp[nodo.capa];
      const a = act[nodo.capa] * e;
      const p = posiciones.current[i].set(nodo.posicion[0] * e, nodo.posicion[1] * e, nodo.posicion[2] * e);
      aux.position.copy(p);
      aux.scale.setScalar(Math.max(0.0001, (0.07 + 0.07 * a) * e));
      aux.updateMatrix();
      refNodos.current.setMatrixAt(i, aux.matrix);
      refNodos.current.setColorAt(i, color.setHSL(0.58 - 0.06 * a, 1, claro ? 0.38 + 0.12 * a : 0.55 + 0.4 * a));
      aux.scale.setScalar(Math.max(0.0001, (0.16 + 0.34 * a) * e));
      aux.updateMatrix();
      refHalos.current.setMatrixAt(i, aux.matrix);
      refHalos.current.setColorAt(i, color.setHSL(0.6 - 0.05 * a, 1, 0.45 + 0.2 * a));
    });
    refNodos.current.instanceMatrix.needsUpdate = true;
    refHalos.current.instanceMatrix.needsUpdate = true;
    refNodos.current.instanceColor.needsUpdate = true;
    refHalos.current.instanceColor.needsUpdate = true;

    // Conexiones: siguen a los nodos mientras se expanden y se encienden con la onda.
    const completa = CAPAS.every((_, c) => expansionCapa(c, t) >= 1);
    if (!completa || ultimaExpansion.current < 1) {
      porCapa.forEach((lista, c) => {
        const buffer = geometriasLineas[c].attributes.position;
        lista.forEach((cx, k) => {
          const a = posiciones.current[cx.a];
          const b = posiciones.current[cx.b];
          buffer.setXYZ(k * 2, a.x, a.y, a.z);
          buffer.setXYZ(k * 2 + 1, b.x, b.y, b.z);
        });
        buffer.needsUpdate = true;
      });
      ultimaExpansion.current = completa ? 1 : 0;
    }
    recursos.lineas.forEach((material, c) => {
      material.opacity = Math.min(exp[c], exp[c + 1]) * (claro ? 0.12 + 0.35 * Math.max(act[c], act[c + 1]) : 0.16 + 0.5 * Math.max(act[c], act[c + 1]));
    });

    // Pulsos: viajan de la primera a la última capa por su camino.
    for (let k = 0; k < CANTIDAD_PULSOS; k += 1) {
      const progreso = ((t * 0.5 + k * 0.137) % 1) * (CAPAS.length - 1);
      const capa = Math.min(CAPAS.length - 2, Math.floor(progreso));
      const f = progreso - capa;
      const a = posiciones.current[caminos[k][capa]];
      const b = posiciones.current[caminos[k][capa + 1]];
      const visible = Math.min(exp[capa], exp[capa + 1]) > 0.98;
      aux.position.set(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, a.z + (b.z - a.z) * f);
      aux.scale.setScalar(visible ? 0.034 : 0.0001);
      aux.updateMatrix();
      refPulsos.current.setMatrixAt(k, aux.matrix);
    }
    refPulsos.current.instanceMatrix.needsUpdate = true;

    // Partículas: aparecen con la red y giran muy despacio.
    recursos.puntos.opacity = 0.75 * exp[Math.floor(CAPAS.length / 2)];
    if (refPuntos.current) refPuntos.current.rotation.y = t * 0.05;
  });

  return (
    <group>
      <instancedMesh ref={refHalos} args={[recursos.geoNodo, recursos.halo, nodos.length]} frustumCulled={false} />
      <instancedMesh ref={refNodos} args={[recursos.geoNodo, recursos.nodo, nodos.length]} frustumCulled={false} />
      {geometriasLineas.map((geometria, c) => (
        <lineSegments key={c} geometry={geometria} material={recursos.lineas[c]} frustumCulled={false} />
      ))}
      <instancedMesh ref={refPulsos} args={[recursos.geoPulso, recursos.pulso, CANTIDAD_PULSOS]} frustumCulled={false} />
      <points ref={refPuntos} geometry={particulas} material={recursos.puntos} frustumCulled={false} />
    </group>
  );
}
