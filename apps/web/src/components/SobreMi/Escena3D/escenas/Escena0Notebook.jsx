'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import PiezaDesarmable from '../PiezaDesarmable.jsx';
import { cuerpoOscuro, azulEmisivo } from '../materiales.js';
import { crearPantalla } from '../pantallaCanvas.js';
import { dibujarPantalla, dibujarLogo } from '../dibujarPantalla.js';
import { dibujarTeclas } from '../dibujarTeclas.js';
import { COLUMNAS, TOTAL_TECLAS, indiceDeLetra } from '../tecladoQwerty.js';
import {
  DURACION_APERTURA,
  DURACION_TOTAL,
  RETRASO_PANTALLA,
  estadoPantalla,
  factorLuzPantalla,
  progresoApertura,
  teclaPresionada,
} from '../pantallaNotebook.js';

const COLOR_TECLA = new THREE.Color('#1c2433');
const COLOR_PRESIONADA = new THREE.Color('#5b8cff');
const RELACION = 2.95 / 1.95;
const PIXELES_ANCHO = 1024;
// Tapa abierta (rotación sobre la bisagra, en radianes) y cuánto se levanta del
// teclado mientras está cerrada para no atravesar las teclas.
const ANGULO_ABIERTA = -1.75;
const ALTURA_TAPA_CERRADA = 0.05;
// Intensidad de la luz que sale de la pantalla cuando está a pleno.
const LUZ_PANTALLA = 35;

// La tapa se abre sólo la primera vez que aparece la escena en toda la sesión;
// después (por ejemplo al volver de otro hito) ya aparece abierta.
let yaSeAbrio = false;

function posicionTecla(i) {
  const columna = i % COLUMNAS;
  const fila = Math.floor(i / COLUMNAS);
  return [(columna - (COLUMNAS - 1) / 2) * 0.245, 0, -0.55 + fila * 0.24];
}

// Las 60 teclas son UNA malla instanciada (una sola draw call). Cada cuadro,
// sólo si cambió la tecla hundida, se baja esa instancia y se tiñe de azul.
// Encima va una lámina transparente con las letras (QWERTY).
function Teclado({ refPresionada, leyendas }) {
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
    <>
      <instancedMesh ref={malla} args={[undefined, undefined, TOTAL_TECLAS]}>
        <boxGeometry args={[0.2, 0.05, 0.2]} />
        <meshStandardMaterial color="#ffffff" metalness={0.4} roughness={0.5} />
      </instancedMesh>
      {/* 12 columnas × 0,245 de ancho y 5 filas × 0,24 de fondo, centrada en la fila 2. */}
      <mesh position={[0, 0.0262, -0.07]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12 * 0.245, 5 * 0.24]} />
        <meshBasicMaterial map={leyendas.textura} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </>
  );
}

export default function Escena0Notebook({ activa, reducido }) {
  const pantalla = useMemo(() => crearPantalla(PIXELES_ANCHO, Math.round(PIXELES_ANCHO / RELACION)), []);
  const leyendas = useMemo(() => {
    const lienzo = crearPantalla(960, 392);
    dibujarTeclas(lienzo.ctx, lienzo.ancho, lienzo.alto);
    lienzo.textura.needsUpdate = true;
    return lienzo;
  }, []);
  const logoTapa = useMemo(() => {
    const lienzo = crearPantalla(256, 256);
    dibujarLogo(lienzo.ctx, 128, 128, 150, '#eaf2ff');
    lienzo.textura.needsUpdate = true;
    return lienzo;
  }, []);
  const objetivoLuz = useMemo(() => new THREE.Object3D(), []);

  const refTapa = useRef(null);
  const refLuz = useRef(null);
  const refTecla = useRef(-1);
  const ultimaClave = useRef('');
  const yaMarcada = useRef(false);

  // Reloj de la escena. Con movimiento reducido todo aparece ya en su estado
  // final; si la tapa ya se abrió antes, arranca abierta (y la pantalla, apagada).
  const tiempoInicial = reducido ? DURACION_TOTAL + RETRASO_PANTALLA + 5 : yaSeAbrio ? DURACION_APERTURA : 0;
  const tiempo = useRef(tiempoInicial);
  // Posición inicial de la tapa: se fija una sola vez (si cambiara entre
  // renders, R3F la volvería a aplicar y la tapa saltaría).
  const aperturaInicial = useRef(progresoApertura(tiempoInicial)).current;

  useEffect(
    () => () => {
      pantalla.textura.dispose();
      leyendas.textura.dispose();
      logoTapa.textura.dispose();
    },
    [pantalla, leyendas, logoTapa]
  );

  useFrame((_, delta) => {
    if (!activa) return;
    // La tapa se abre recién cuando la escena está a la vista, no mientras se
    // precarga fuera de pantalla.
    if (!yaMarcada.current) {
      yaMarcada.current = true;
      yaSeAbrio = true;
    }
    // `delta` acotado: al volver de una pestaña oculta el guion no salta.
    if (!reducido) tiempo.current += Math.min(delta, 0.05);
    const t = tiempo.current;

    const apertura = progresoApertura(t);
    refTapa.current.rotation.x = ANGULO_ABIERTA * apertura;
    refTapa.current.position.y = ALTURA_TAPA_CERRADA * (1 - apertura);

    // La pantalla arranca un poco después de empezar a abrir la tapa.
    const tPantalla = t - RETRASO_PANTALLA;
    const estado = estadoPantalla(tPantalla);
    refTecla.current = reducido ? -1 : indiceDeLetra(teclaPresionada(tPantalla));
    // La pantalla ilumina hacia donde apunta, con la fuerza de lo que muestra.
    if (refLuz.current) refLuz.current.intensity = LUZ_PANTALLA * factorLuzPantalla(estado) * apertura;

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

      <PiezaDesarmable posicion={[0, -0.405, 0]} semilla={2}>
        <Teclado refPresionada={refTecla} leyendas={leyendas} />
      </PiezaDesarmable>

      <PiezaDesarmable posicion={[0, -0.428, 0.78]} semilla={3}>
        <mesh>
          <boxGeometry args={[1.0, 0.012, 0.6]} />
          <meshStandardMaterial color="#030405" metalness={0.2} roughness={0.55} />
        </mesh>
      </PiezaDesarmable>

      {/* Tapa: bisagra atrás. El grupo interno lleva la apertura (se anima en
          useFrame); PiezaDesarmable sólo mueve y gira la tapa al desarmar. */}
      <PiezaDesarmable posicion={[0, -0.43, -1.1]} semilla={4}>
        <group
          ref={refTapa}
          rotation={[ANGULO_ABIERTA * aperturaInicial, 0, 0]}
          position={[0, ALTURA_TAPA_CERRADA * (1 - aperturaInicial), 0]}
        >
          <mesh position={[0, 0.03, 1.1]} material={cuerpoOscuro}>
            <boxGeometry args={[3.2, 0.06, 2.2]} />
          </mesh>
          {/* Pantalla (cara interior de la tapa). */}
          <mesh position={[0, -0.002, 1.1]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[2.95, 1.95]} />
            <meshBasicMaterial map={pantalla.textura} toneMapped={false} />
          </mesh>
          {/* Logo en la cara exterior; el giro de 180° lo deja derecho visto desde atrás. */}
          <mesh position={[0, 0.0625, 1.1]} rotation={[-Math.PI / 2, 0, Math.PI]}>
            <planeGeometry args={[0.75, 0.75]} />
            <meshBasicMaterial map={logoTapa.textura} transparent depthWrite={false} toneMapped={false} />
          </mesh>
          {/* Luz que sale de la pantalla en la dirección en que apunta (hacia -y
              de la tapa). Al ir dentro del grupo de la tapa, gira con ella. */}
          <spotLight
            ref={refLuz}
            position={[0, -0.3, 1.1]}
            target={objetivoLuz}
            angle={0.95}
            penumbra={1}
            distance={10}
            decay={1.3}
            color="#7fa6ff"
            intensity={0}
          />
          <primitive object={objetivoLuz} position={[0, -6, 1.1]} />
        </group>
      </PiezaDesarmable>
    </group>
  );
}
