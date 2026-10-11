'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { colorArcoiris } from '../../paletas.js';

// Material de las luces RGB: no lo afecta la iluminación (brilla solo) y toma el
// color de cada vértice. Es uno solo para todas las tiras y anillos.
const materialRGB = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });

// Pinta cada vértice con el color del arcoíris según una coordenada: `f(vértice)`
// da una posición de 0 a 1 a lo largo de la tira o alrededor del anillo.
function pintar(geometria, fraccion) {
  const posicion = geometria.attributes.position;
  const colores = new Float32Array(posicion.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < posicion.count; i += 1) {
    c.set(colorArcoiris(fraccion(posicion.getX(i), posicion.getY(i), posicion.getZ(i))));
    colores.set([c.r, c.g, c.b], i * 3);
  }
  geometria.setAttribute('color', new THREE.BufferAttribute(colores, 3));
  return geometria;
}

// Tira de luz RGB fija: una caja con muchos cortes a lo largo de `eje`, de modo
// que el degradado del arcoíris se reparte parejo de punta a punta. `fase` corre
// el punto de partida del arcoíris (para que tiras vecinas no queden iguales).
export function TiraRGB({ tamano, eje = 'x', fase = 0, posicion, rotacion }) {
  const geometria = useMemo(() => {
    const [x, y, z] = tamano;
    const cortes = 48;
    const g = new THREE.BoxGeometry(x, y, z, eje === 'x' ? cortes : 1, eje === 'y' ? cortes : 1, eje === 'z' ? cortes : 1);
    const largo = { x, y, z }[eje];
    return pintar(g, (vx, vy, vz) => fase + ({ x: vx, y: vy, z: vz }[eje] / largo + 0.5));
  }, [tamano, eje, fase]);
  return <mesh geometry={geometria} material={materialRGB} position={posicion} rotation={rotacion} />;
}

// Anillo de luz RGB fijo: un toro cuyo color recorre todo el arcoíris alrededor.
export function AnilloRGB({ radio, tubo, posicion, rotacion, fase = 0 }) {
  const geometria = useMemo(() => {
    const g = new THREE.TorusGeometry(radio, tubo, 10, 64);
    return pintar(g, (vx, vy) => fase + (Math.atan2(vy, vx) / (Math.PI * 2) + 0.5));
  }, [radio, tubo, fase]);
  return <mesh geometry={geometria} material={materialRGB} position={posicion} rotation={rotacion} />;
}
