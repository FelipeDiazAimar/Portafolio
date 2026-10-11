'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import PiezaDesarmable from '../PiezaDesarmable.jsx';
import { crearPantalla } from '../pantallaCanvas.js';
import { MATERIAS, T_FIN_TILDES, brilloTarjeta, escalaTilde, progresoSello, progresoTilde } from '../cicloMaterias.js';
import { CASILLA_X, dibujarResplandor, dibujarSello, dibujarTarjeta, dibujarTilde } from '../texturasMaterias.js';
import { azulEmisivo, cianEmisivo } from '../materiales.js';

const COLUMNAS = 4;
const FILAS = 3;
const ANCHO_T = 1.12;
const ALTO_T = 0.66;
const HUECO = 0.13;
const GROSOR_T = 0.05;
const DIENTES = 44;
const RADIO_SELLO = 0.5;

// Las tarjetas se ubican en una grilla centrada en el origen.
function posicionTarjeta(i) {
  const fila = Math.floor(i / COLUMNAS);
  const columna = i % COLUMNAS;
  return [(columna - (COLUMNAS - 1) / 2) * (ANCHO_T + HUECO), ((FILAS - 1) / 2 - fila) * (ALTO_T + HUECO), 0];
}

// Borde dentado del sello: pequeñas cuñas repartidas en círculo, como una malla
// instanciada (una sola llamada de dibujo).
function Dientes({ material }) {
  const malla = useRef(null);
  useLayoutEffect(() => {
    const aux = new THREE.Object3D();
    for (let i = 0; i < DIENTES; i += 1) {
      const a = (i / DIENTES) * Math.PI * 2;
      aux.position.set(Math.cos(a) * (RADIO_SELLO + 0.055), Math.sin(a) * (RADIO_SELLO + 0.055), 0);
      aux.rotation.set(0, 0, a);
      aux.updateMatrix();
      malla.current.setMatrixAt(i, aux.matrix);
    }
    malla.current.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={malla} args={[undefined, material, DIENTES]}>
      <boxGeometry args={[0.055, 0.045, 0.075]} />
    </instancedMesh>
  );
}

export default function Escena2Materias({ activa, reducido }) {
  const recursos = useMemo(() => {
    const texturas = [];
    const crear = (ancho, alto, dibujar) => {
      const l = crearPantalla(ancho, alto);
      dibujar(l.ctx, ancho, alto);
      l.textura.needsUpdate = true;
      texturas.push(l.textura);
      return l.textura;
    };
    // Una textura y un material por tarjeta: así cada una puede brillar sola.
    const tarjetas = MATERIAS.map((nombre) => {
      const textura = crear(512, Math.round((512 * ALTO_T) / ANCHO_T), (ctx, w, h) => dibujarTarjeta(ctx, w, h, nombre));
      return new THREE.MeshStandardMaterial({ map: textura, emissive: '#2ee6c0', emissiveIntensity: 0, roughness: 0.55, metalness: 0.2 });
    });
    const tilde = new THREE.MeshBasicMaterial({ map: crear(256, 256, dibujarTilde), transparent: true, depthWrite: false, toneMapped: false });
    const sello = crear(512, 512, dibujarSello);
    const resplandor = new THREE.MeshBasicMaterial({
      map: crear(256, 256, dibujarResplandor),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const metal = new THREE.MeshStandardMaterial({ color: '#b9c6e6', metalness: 1, roughness: 0.3, envMapIntensity: 1 });
    // Tapa del sello con su dibujo; el resto del cilindro, metal.
    const tapaSello = new THREE.MeshStandardMaterial({ map: sello, roughness: 0.4, metalness: 0.35, emissiveMap: sello, emissive: '#ffffff', emissiveIntensity: 0.45 });
    const dorso = new THREE.MeshStandardMaterial({ color: '#16295f', metalness: 0.5, roughness: 0.4 });
    return { texturas, tarjetas, tilde, resplandor, metal, tapaSello, dorso };
  }, []);

  const tiempo = useRef(reducido ? T_FIN_TILDES + 20 : 0);
  const refsTarjeta = useRef([]);
  const refsTilde = useRef([]);
  const refSello = useRef(null);
  const refResplandor = useRef(null);
  const refLuz = useRef(null);

  useEffect(
    () => () => {
      recursos.texturas.forEach((t) => t.dispose());
      recursos.tarjetas.forEach((m) => m.dispose());
      [recursos.tilde, recursos.resplandor, recursos.metal, recursos.tapaSello, recursos.dorso].forEach((m) => m.dispose());
    },
    [recursos]
  );

  useFrame((_, delta) => {
    if (!activa) return;
    if (!reducido) tiempo.current += Math.min(delta, 0.05);
    const t = tiempo.current;

    for (let i = 0; i < MATERIAS.length; i += 1) {
      const p = progresoTilde(i, t);
      recursos.tarjetas[i].emissiveIntensity = 0.7 * brilloTarjeta(p);
      const tilde = refsTilde.current[i];
      if (tilde) {
        tilde.visible = p > 0;
        tilde.scale.setScalar(Math.max(0.0001, escalaTilde(p)));
      }
      // Las tarjetas flotan apenas, cada una en su fase.
      const tarjeta = refsTarjeta.current[i];
      if (tarjeta) tarjeta.position.z = reducido ? 0 : Math.sin(t * 1.1 + i * 0.9) * 0.025;
    }

    const sello = progresoSello(t);
    if (refSello.current) {
      refSello.current.visible = sello > 0.001;
      refSello.current.scale.setScalar(Math.max(0.001, sello));
      // Entra girando y se asienta de frente, con un vaivén lento.
      refSello.current.rotation.y = (1 - sello) * Math.PI * 2 + (reducido ? 0 : Math.sin(t * 0.7) * 0.22);
      refSello.current.position.y = reducido ? 0 : Math.sin(t * 1.4) * 0.04;
    }
    if (refResplandor.current) {
      refResplandor.current.visible = sello > 0.001;
      const pulso = reducido ? 1 : 1 + Math.sin(t * 2.1) * 0.06;
      refResplandor.current.scale.setScalar(Math.max(0.001, sello * pulso));
    }
    if (refLuz.current) refLuz.current.intensity = 7 * sello;
  });

  return (
    <group position={[0, 0, 0]} rotation={[0.1, -0.22, 0]} scale={0.8}>
      {MATERIAS.map((nombre, i) => (
        <PiezaDesarmable key={nombre} posicion={posicionTarjeta(i)} semilla={i + 1}>
          <group ref={(g) => { refsTarjeta.current[i] = g; }}>
            <mesh material={recursos.tarjetas[i]}>
              <boxGeometry args={[ANCHO_T, ALTO_T, GROSOR_T]} />
            </mesh>
            <mesh
              ref={(m) => { refsTilde.current[i] = m; }}
              position={[(CASILLA_X - 0.5) * ANCHO_T, 0, GROSOR_T / 2 + 0.004]}
              material={recursos.tilde}
              visible={false}
            >
              <planeGeometry args={[0.34, 0.34]} />
            </mesh>
          </group>
        </PiezaDesarmable>
      ))}

      {/* Sello de Cambridge: aparece cuando todas las materias están tildadas. */}
      <PiezaDesarmable posicion={[0, 0, 0.55]} semilla={20}>
        <mesh ref={refResplandor} position={[0, 0, -0.08]} material={recursos.resplandor} visible={false}>
          <planeGeometry args={[3.2, 3.2]} />
        </mesh>
        <group ref={refSello} visible={false}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={[recursos.metal, recursos.tapaSello, recursos.dorso]}>
            <cylinderGeometry args={[RADIO_SELLO, RADIO_SELLO, 0.07, 64]} />
          </mesh>
          <mesh position={[0, 0, 0.0]} material={azulEmisivo}>
            <torusGeometry args={[RADIO_SELLO, 0.03, 14, 72]} />
          </mesh>
          <mesh position={[0, 0, 0.0]} material={cianEmisivo}>
            <torusGeometry args={[RADIO_SELLO * 0.62, 0.008, 8, 64]} />
          </mesh>
          <Dientes material={recursos.metal} />
          <pointLight ref={refLuz} position={[0, 0, 1.2]} color="#7fa6ff" intensity={0} distance={7} />
        </group>
      </PiezaDesarmable>
    </group>
  );
}
