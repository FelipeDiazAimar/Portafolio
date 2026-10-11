'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import PiezaDesarmable from '../PiezaDesarmable.jsx';
import { cuerpoOscuro, azulEmisivo, cianEmisivo } from '../materiales.js';
import { crearPantalla } from '../pantallaCanvas.js';
import { dibujarBandera } from '../dibujarBandera.js';
import { PARTES } from '../simboloUtn.js';
import { desplazamientoBandera } from '../ondaBandera.js';

const ANCHO_TELA = 2.3;
const ALTO_TELA = 1.45;
const SEGMENTOS_X = 36;
const SEGMENTOS_Y = 18;
// El símbolo se modela con alto 1; esto es su alto real en la escena.
const ALTO_SIMBOLO = 1.5;
const PROFUNDIDAD_BARRAS = 0.085;
const PROFUNDIDAD_ARCOS = 0.08;

// Una parte del símbolo (barra o medio anillo) como forma 2D de three.
function formaDeParte(parte) {
  const forma = new THREE.Shape();
  if (parte.tipo === 'rect') {
    forma.moveTo(parte.x0, parte.y0);
    forma.lineTo(parte.x1, parte.y0);
    forma.lineTo(parte.x1, parte.y1);
    forma.lineTo(parte.x0, parte.y1);
    forma.closePath();
  } else {
    const [desde, hasta] = parte.mitad === 'inferior' ? [Math.PI, Math.PI * 2] : [0, Math.PI];
    forma.absarc(parte.cx, parte.cy, parte.r1, desde, hasta, false);
    forma.absarc(parte.cx, parte.cy, parte.r0, hasta, desde, true);
  }
  return forma;
}

// Las barras son un poco más gruesas que los arcos: así las caras de los arcos
// quedan dentro del volumen de las barras donde se solapan y no hay parpadeo
// (z-fighting) entre caras coplanares.
function crearGeometriasSimbolo() {
  return PARTES.map((parte) => {
    const profundidad = parte.tipo === 'rect' ? PROFUNDIDAD_BARRAS : PROFUNDIDAD_ARCOS;
    const geometria = new THREE.ExtrudeGeometry(formaDeParte(parte), {
      depth: profundidad,
      curveSegments: 48,
      bevelEnabled: true,
      bevelThickness: 0.006,
      bevelSize: 0.006,
      bevelSegments: 2,
    });
    geometria.translate(0, 0, -profundidad / 2);
    return geometria;
  });
}

export default function Escena1Bandera({ activa, reducido }) {
  const tela = useMemo(() => {
    const geometria = new THREE.PlaneGeometry(ANCHO_TELA, ALTO_TELA, SEGMENTOS_X, SEGMENTOS_Y);
    // El borde izquierdo (u = 0) queda en el asta.
    geometria.translate(ANCHO_TELA / 2, 0, 0);
    return { geometria, base: geometria.attributes.position.array.slice() };
  }, []);
  const lienzo = useMemo(() => {
    const l = crearPantalla(1024, Math.round((1024 * ALTO_TELA) / ANCHO_TELA));
    dibujarBandera(l.ctx, l.ancho, l.alto);
    l.textura.needsUpdate = true;
    return l;
  }, []);
  const simbolo = useMemo(crearGeometriasSimbolo, []);

  const tiempo = useRef(0);
  const refAro = useRef(null);
  const refSimbolo = useRef(null);
  const yaDibujada = useRef(false);

  useEffect(
    () => () => {
      tela.geometria.dispose();
      lienzo.textura.dispose();
      simbolo.forEach((geometria) => geometria.dispose());
    },
    [tela, lienzo, simbolo]
  );

  useFrame((_, delta) => {
    if (!activa) return;
    // Con movimiento reducido la bandera se dibuja una vez, quieta.
    if (reducido && yaDibujada.current) return;
    if (!reducido) tiempo.current += Math.min(delta, 0.05);
    const t = tiempo.current;

    const posiciones = tela.geometria.attributes.position;
    for (let i = 0; i < posiciones.count; i += 1) {
      const u = tela.base[i * 3] / ANCHO_TELA;
      const v = tela.base[i * 3 + 1] / ALTO_TELA + 0.5;
      posiciones.setZ(i, desplazamientoBandera(u, v, t));
    }
    posiciones.needsUpdate = true;
    tela.geometria.computeVertexNormals();
    yaDibujada.current = true;

    if (!reducido) {
      if (refAro.current) refAro.current.rotation.z = t * 0.35;
      // El símbolo flota apenas, como suspendido en el portal.
      if (refSimbolo.current) refSimbolo.current.position.y = Math.sin(t * 1.4) * 0.035;
    }
  });

  return (
    <group position={[0, -0.15, 0]} rotation={[0, -0.35, 0]} scale={0.78}>
      {/* Plataforma */}
      <PiezaDesarmable posicion={[0, -1.1, 0]} semilla={1}>
        <mesh material={cuerpoOscuro}>
          <cylinderGeometry args={[1.8, 1.8, 0.08, 64]} />
        </mesh>
        <mesh position={[0, 0.045, 0]} rotation={[Math.PI / 2, 0, 0]} material={azulEmisivo}>
          <torusGeometry args={[1.8, 0.018, 12, 96]} />
        </mesh>
      </PiezaDesarmable>

      {/* Asta */}
      <PiezaDesarmable posicion={[-1.5, 0.2, 0]} semilla={2}>
        <mesh material={cuerpoOscuro}>
          <cylinderGeometry args={[0.035, 0.035, 2.6, 16]} />
        </mesh>
        <mesh position={[0, 1.33, 0]} material={cianEmisivo}>
          <sphereGeometry args={[0.065, 20, 20]} />
        </mesh>
      </PiezaDesarmable>

      {/* Bandera: el borde izquierdo de la tela queda pegado al asta */}
      <PiezaDesarmable posicion={[-1.465, 0.675, 0]} semilla={3}>
        <mesh geometry={tela.geometria}>
          <meshStandardMaterial
            map={lienzo.textura}
            emissiveMap={lienzo.textura}
            emissive="#ffffff"
            emissiveIntensity={0.35}
            roughness={0.8}
            side={THREE.DoubleSide}
          />
        </mesh>
      </PiezaDesarmable>

      {/* Portal: queda detrás de la bandera y se revela al girar el modelo */}
      <PiezaDesarmable posicion={[0.35, 0.3, -1.3]} semilla={4}>
        <mesh material={azulEmisivo}>
          <torusGeometry args={[1.3, 0.055, 20, 120]} />
        </mesh>
        <mesh ref={refAro} material={cianEmisivo}>
          <torusGeometry args={[1.18, 0.012, 8, 120]} />
        </mesh>
        <mesh>
          <circleGeometry args={[1.25, 64]} />
          <meshBasicMaterial color="#2b5cff" transparent opacity={0.16} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
        </mesh>
      </PiezaDesarmable>

      {/* Símbolo de la UTN, extruido, dentro del portal */}
      <PiezaDesarmable posicion={[0.35, 0.3, -1.3]} semilla={5}>
        <group ref={refSimbolo} scale={ALTO_SIMBOLO}>
          {simbolo.map((geometria, i) => (
            <mesh key={i} geometry={geometria}>
              <meshStandardMaterial color="#c9dbff" emissive="#5b8cff" emissiveIntensity={1.1} metalness={0.3} roughness={0.35} />
            </mesh>
          ))}
        </group>
      </PiezaDesarmable>
    </group>
  );
}
