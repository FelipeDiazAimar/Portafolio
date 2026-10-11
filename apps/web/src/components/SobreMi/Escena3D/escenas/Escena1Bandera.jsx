'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import PiezaDesarmable from '../PiezaDesarmable.jsx';
import { cuerpoOscuro } from '../materiales.js';
import { crearPantalla } from '../pantallaCanvas.js';
import { dibujarBandera } from '../dibujarBandera.js';
import { PARTES } from '../simboloUtn.js';
import { desplazamientoBandera } from '../ondaBandera.js';
import { progresoEntrada } from '../entrada.js';

const ANCHO_TELA = 2.3;
const ALTO_TELA = 1.45;
const SEGMENTOS_X = 48;
const SEGMENTOS_Y = 24;
// El símbolo se modela con alto 1; esto es su alto real en la escena.
const ALTO_SIMBOLO = 1.4;
const PROFUNDIDAD_BARRAS = 0.085;
const PROFUNDIDAD_ARCOS = 0.08;
// El símbolo aparece un rato después de la bandera.
const RETRASO_SIMBOLO = 1.6;
const DURACION_SIMBOLO = 1.1;
// Una tela real se acorta al ondular (el largo del paño no cambia) y cuelga un
// poco por su propio peso hacia la punta.
const ACORTAMIENTO = 1.1;
const CAIDA_PUNTA = 0.1;

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
  // Negro, pero con brillo: así reacciona a las luces azules y se lee por los
  // bordes y el bisel aun sobre el fondo oscuro. Empieza invisible.
  const materialSimbolo = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#04050a', metalness: 0.25, roughness: 0.28, transparent: true, opacity: 0 }),
    []
  );

  const tiempo = useRef(0);
  const refSimbolo = useRef(null);
  const yaDibujada = useRef(false);

  useEffect(
    () => () => {
      tela.geometria.dispose();
      lienzo.textura.dispose();
      simbolo.forEach((geometria) => geometria.dispose());
      materialSimbolo.dispose();
    },
    [tela, lienzo, simbolo, materialSimbolo]
  );

  useFrame((_, delta) => {
    if (!activa) return;
    // Con movimiento reducido todo se dibuja una vez, quieto y ya visible.
    if (reducido && yaDibujada.current) return;
    if (!reducido) tiempo.current += Math.min(delta, 0.05);
    const t = tiempo.current;

    const posiciones = tela.geometria.attributes.position;
    for (let i = 0; i < posiciones.count; i += 1) {
      const x0 = tela.base[i * 3];
      const y0 = tela.base[i * 3 + 1];
      const u = x0 / ANCHO_TELA;
      const v = y0 / ALTO_TELA + 0.5;
      const dz = desplazamientoBandera(u, v, t);
      posiciones.setXYZ(i, x0 - ACORTAMIENTO * dz * dz, y0 - CAIDA_PUNTA * u * u, dz);
    }
    posiciones.needsUpdate = true;
    tela.geometria.computeVertexNormals();

    // El símbolo se materializa después de la bandera: aparece y crece un poco.
    const entrada = reducido ? 1 : progresoEntrada(t, RETRASO_SIMBOLO, DURACION_SIMBOLO);
    materialSimbolo.opacity = entrada;
    if (refSimbolo.current) {
      refSimbolo.current.visible = entrada > 0.001;
      refSimbolo.current.scale.setScalar(ALTO_SIMBOLO * (0.7 + 0.3 * entrada));
    }
    yaDibujada.current = true;
  });

  return (
    <group position={[-0.4, -0.17, 0]} rotation={[0, -0.35, 0]} scale={0.85}>
      {/* Mástil largo, sin remate */}
      <PiezaDesarmable posicion={[-1.5, 0.2, 0]} semilla={2}>
        <mesh material={cuerpoOscuro}>
          <cylinderGeometry args={[0.035, 0.035, 3.6, 16]} />
        </mesh>
      </PiezaDesarmable>

      {/* Bandera: el borde izquierdo de la tela queda pegado al mástil, cerca de la punta */}
      <PiezaDesarmable posicion={[-1.465, 1.125, 0]} semilla={3}>
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

      {/* Símbolo de la UTN: sólo las formas, extruidas y en negro, al lado de la bandera */}
      <PiezaDesarmable posicion={[1.8, 0.45, 0]} semilla={5}>
        <group ref={refSimbolo} visible={false}>
          {simbolo.map((geometria, i) => (
            <mesh key={i} geometry={geometria} material={materialSimbolo} />
          ))}
        </group>
      </PiezaDesarmable>
    </group>
  );
}
