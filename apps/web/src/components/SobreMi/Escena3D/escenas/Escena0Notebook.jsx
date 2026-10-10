'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import PiezaDesarmable from '../PiezaDesarmable.jsx';
import { cuerpoOscuro, azulEmisivo } from '../materiales.js';
import { crearPantalla } from '../pantallaCanvas.js';
import { dibujarPantalla } from '../dibujarPantalla.js';
import { estadoPantalla, teclaPresionada, DURACION_TOTAL } from '../pantallaNotebook.js';

const COLUMNAS = 12;
const FILAS = 5;
const TOTAL_TECLAS = COLUMNAS * FILAS;
const COLOR_TECLA = new THREE.Color('#1c2433');
const COLOR_PRESIONADA = new THREE.Color('#5b8cff');
const RELACION = 2.95 / 1.95;
const PIXELES_ANCHO = 1024;

function posicionTecla(i) {
  const columna = i % COLUMNAS;
  const fila = Math.floor(i / COLUMNAS);
  return [(columna - (COLUMNAS - 1) / 2) * 0.245, 0, -0.55 + fila * 0.24];
}

// Las 60 teclas son UNA malla instanciada (una sola draw call). Cada cuadro,
// sólo si cambió la tecla hundida, se baja esa instancia y se tiñe de azul.
function Teclado({ refPresionada }) {
  const malla = useRef(null);
  const auxiliar = useMemo(() => new THREE.Object3D(), []);
  const anterior = useRef(-1);

  function poner(i, y, color) {
    if (i < 0) return;
    const [x, , z] = posicionTecla(i);
    auxiliar.position.set(x, y, z);
    auxiliar.updateMatrix();
    malla.current.setMatrixAt(i, auxiliar.matrix);
    malla.current.setColorAt(i, color);
  }

  useEffect(() => {
    for (let i = 0; i < TOTAL_TECLAS; i += 1) poner(i, 0, COLOR_TECLA);
    malla.current.instanceMatrix.needsUpdate = true;
    malla.current.instanceColor.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame(() => {
    const actual = refPresionada.current;
    if (actual === anterior.current) return;
    poner(anterior.current, 0, COLOR_TECLA);
    poner(actual, -0.03, COLOR_PRESIONADA);
    anterior.current = actual;
    malla.current.instanceMatrix.needsUpdate = true;
    malla.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={malla} args={[undefined, undefined, TOTAL_TECLAS]}>
      <boxGeometry args={[0.2, 0.05, 0.2]} />
      <meshStandardMaterial color="#ffffff" metalness={0.4} roughness={0.5} />
    </instancedMesh>
  );
}

export default function Escena0Notebook({ activa, reducido }) {
  const pantalla = useMemo(() => crearPantalla(PIXELES_ANCHO, Math.round(PIXELES_ANCHO / RELACION)), []);
  // Con movimiento reducido se muestra directamente el estado final.
  const tiempo = useRef(reducido ? DURACION_TOTAL + 5 : 0);
  const refTecla = useRef(-1);
  const ultimaClave = useRef('');

  useEffect(() => () => pantalla.textura.dispose(), [pantalla]);

  useFrame((_, delta) => {
    if (!activa) return;
    // `delta` acotado: al volver de una pestaña oculta el guion no salta.
    if (!reducido) tiempo.current += Math.min(delta, 0.05);
    const t = tiempo.current;
    const estado = estadoPantalla(t);
    refTecla.current = reducido ? -1 : teclaPresionada(t, TOTAL_TECLAS);

    // Sólo se redibuja la pantalla si cambió algo visible.
    const clave = [
      estado.fase,
      estado.progreso.toFixed(2),
      estado.apertura.toFixed(2),
      estado.lineas.join('/'),
      estado.cursorVisible,
    ].join('|');
    if (clave !== ultimaClave.current) {
      ultimaClave.current = clave;
      dibujarPantalla(pantalla.ctx, pantalla.ancho, pantalla.alto, estado);
      pantalla.textura.needsUpdate = true;
    }
  });

  return (
    <group position={[0, -0.2, 0]} rotation={[0, -0.5, 0]}>
      <PiezaDesarmable semilla={1}>
        <mesh position={[0, -0.5, 0]} material={cuerpoOscuro}>
          <boxGeometry args={[3.2, 0.14, 2.2]} />
        </mesh>
        <mesh position={[0, -0.575, 1.1]} material={azulEmisivo}>
          <boxGeometry args={[2.4, 0.012, 0.02]} />
        </mesh>
      </PiezaDesarmable>

      <PiezaDesarmable posicion={[0, -0.405, 0]} semilla={2} giro={[0.4, 0.6, 0.2]}>
        <Teclado refPresionada={refTecla} />
      </PiezaDesarmable>

      <PiezaDesarmable posicion={[0, -0.428, 0.78]} semilla={3} giro={[0.2, -0.5, 0.3]}>
        <mesh>
          <boxGeometry args={[1.0, 0.012, 0.6]} />
          <meshStandardMaterial color="#0a1a26" emissive="#3de0ff" emissiveIntensity={0.12} metalness={0.5} roughness={0.4} />
        </mesh>
      </PiezaDesarmable>

      {/* Tapa: bisagra atrás, abierta ~100°. El grupo interno lleva la
          rotación fija; PiezaDesarmable sólo mueve y gira la tapa al desarmar. */}
      <PiezaDesarmable posicion={[0, -0.43, -1.1]} semilla={4} giro={[0.7, 0.5, 0]}>
        <group rotation={[-1.75, 0, 0]}>
          <mesh position={[0, 0.03, 1.1]} material={cuerpoOscuro}>
            <boxGeometry args={[3.2, 0.06, 2.2]} />
          </mesh>
          <mesh position={[0, -0.002, 1.1]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[2.95, 1.95]} />
            <meshBasicMaterial map={pantalla.textura} toneMapped={false} />
          </mesh>
        </group>
      </PiezaDesarmable>
    </group>
  );
}
