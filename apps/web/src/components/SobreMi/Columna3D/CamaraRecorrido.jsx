'use client';

import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { poseCamara } from '@/lib/columna/recorrido.js';
import { vistaParaAltura } from '../Escena3D/vista.js';

// Desplazamiento del encuadre (fracción del ancho/alto) según dónde va el modelo.
const DESPLAZAMIENTO = {
  izquierda: { x: 0.22, y: 0 },
  derecha: { x: -0.22, y: 0 },
  arriba: { x: 0, y: 0.2 },
};

// Conduce la cámara durante los viajes y la deja en la pose canónica al llegar. Una vez
// "anclada" en un hito, la suelta: ahí manda el OrbitControls de siempre (ControlGiro).
// También corre el encuadre hacia el lado del modelo con `setViewOffset` (es un
// desplazamiento de proyección: el picking de las escenas sigue siendo correcto).
export default function CamaraRecorrido({ n, refTramo, lado, opciones, reducido }) {
  const anclada = useRef(false);
  const mira = useRef(new THREE.Vector3());
  const giro = useRef(0);
  const corrimiento = useRef({ x: 0, y: 0 });
  const auxiliar = useRef(new THREE.Vector3());

  useFrame((estado, delta) => {
    const { camera, size, controls } = estado;
    const dt = Math.min(delta, 0.05);
    const tramo = refTramo.current;
    const { distancia } = vistaParaAltura(size.height);

    const objetivo = DESPLAZAMIENTO[lado] ?? DESPLAZAMIENTO.izquierda;
    const k = reducido ? 1 : 1 - Math.exp(-4 * dt);
    corrimiento.current.x += (objetivo.x - corrimiento.current.x) * k;
    corrimiento.current.y += (objetivo.y - corrimiento.current.y) * k;
    camera.setViewOffset(
      size.width,
      size.height,
      corrimiento.current.x * size.width,
      corrimiento.current.y * size.height,
      size.width,
      size.height
    );

    // El grafo de Hoy todavía tiene la cámara: se espera a que la suelte.
    if (controls?.giroLibre) {
      camera.updateProjectionMatrix();
      return;
    }

    if (tramo.tipo === 'estancia' && anclada.current) {
      // Ya llegó: sólo se corrige la distancia si cambió el alto del canvas.
      if (Math.abs(camera.position.length() - distancia) > 0.01) camera.position.setLength(distancia);
      camera.updateProjectionMatrix();
      return;
    }

    anclada.current = false;
    if (controls) controls.enabled = false;
    const pose = poseCamara(tramo, distancia, n, opciones);
    const f = reducido ? 1 : 1 - Math.exp(-6 * dt);
    const destino = auxiliar.current.set(...pose.posicion);
    camera.position.lerp(destino, f);
    mira.current.lerp(destino.set(...pose.mira), f);
    camera.fov += (pose.fov - camera.fov) * f;
    giro.current += (pose.giroZ - giro.current) * f;
    camera.lookAt(mira.current);
    camera.rotateZ(giro.current);
    camera.updateProjectionMatrix();

    if (tramo.tipo === 'estancia') {
      const error =
        camera.position.distanceTo(auxiliar.current.set(...pose.posicion)) +
        mira.current.length() +
        Math.abs(camera.fov - pose.fov) +
        Math.abs(giro.current);
      if (error < 0.01) {
        camera.position.set(...pose.posicion);
        mira.current.set(0, 0, 0);
        camera.fov = pose.fov;
        giro.current = 0;
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
        anclada.current = true;
        if (controls) {
          controls.target.set(0, 0, 0);
          controls.enabled = true;
          controls.update();
        }
      }
    }
  });

  return null;
}
