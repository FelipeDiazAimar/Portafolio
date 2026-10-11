'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import PiezaDesarmable from '../PiezaDesarmable.jsx';
import { crearPantalla } from '../pantallaCanvas.js';
import { CANTIDAD_LEDS, alturaDestornillador, giroDestornillador, ledEncendido } from '../cicloBanco.js';
import { dibujarDiagnostico, dibujarPlacaReparacion, dibujarTapete } from '../texturasBanco.js';

const COLORES_LED = ['#ff4a4a', '#46f0cd', '#ffcf4a', '#5b8cff'];
const POSICION_TORNILLO = [0.95, 0.04, 0.5];
// Cuánto sube el destornillador cuando está levantado.
const ALTURA_LEVANTADO = 0.5;

// Mallas instanciadas de los LEDs de la placa: una sola llamada de dibujo y un
// color por instancia; el brillo se apaga o prende cambiando el color.
function Leds({ material, refLeds }) {
  const malla = useRef(null);
  const colores = useMemo(() => Array.from({ length: CANTIDAD_LEDS }, (_, i) => new THREE.Color(COLORES_LED[i % COLORES_LED.length])), []);
  const apagado = useMemo(() => new THREE.Color('#10151c'), []);
  useLayoutEffect(() => {
    const aux = new THREE.Object3D();
    for (let i = 0; i < CANTIDAD_LEDS; i += 1) {
      const fila = Math.floor(i / 6);
      const columna = i % 6;
      aux.position.set(-0.5 + columna * 0.2, fila === 0 ? 0.3 : -0.3, 0.05);
      aux.updateMatrix();
      malla.current.setMatrixAt(i, aux.matrix);
      malla.current.setColorAt(i, apagado);
    }
    malla.current.instanceMatrix.needsUpdate = true;
    malla.current.instanceColor.needsUpdate = true;
  }, [apagado]);
  // La escena le pasa a esta malla una función para refrescar los colores.
  refLeds.current = (t) => {
    for (let i = 0; i < CANTIDAD_LEDS; i += 1) malla.current.setColorAt(i, ledEncendido(i, t) ? colores[i] : apagado);
    malla.current.instanceColor.needsUpdate = true;
  };
  return (
    <instancedMesh ref={malla} args={[undefined, material, CANTIDAD_LEDS]}>
      <sphereGeometry args={[0.04, 14, 14]} />
    </instancedMesh>
  );
}

export default function Escena4Banco({ activa, reducido }) {
  const recursos = useMemo(() => {
    const texturas = [];
    const crear = (ancho, alto, dibujar) => {
      const l = crearPantalla(ancho, alto);
      dibujar(l.ctx, ancho, alto);
      l.textura.needsUpdate = true;
      texturas.push(l.textura);
      return l.textura;
    };
    return {
      texturas,
      tapete: (() => {
        const mapa = crear(1536, 1000, dibujarTapete);
        // Emisión verde: la luz azul del sitio lo teñía y se veía azul, no verde.
        return new THREE.MeshStandardMaterial({ map: mapa, emissiveMap: mapa, emissive: '#2fbf80', emissiveIntensity: 0.55, roughness: 0.85, metalness: 0 });
      })(),
      diagnostico: new THREE.MeshBasicMaterial({ map: crear(1024, 640, dibujarDiagnostico), toneMapped: false }),
      placa: new THREE.MeshStandardMaterial({ map: crear(768, 512, dibujarPlacaReparacion), roughness: 0.55, metalness: 0.15 }),
      carcasa: new THREE.MeshStandardMaterial({ color: '#1d2230', metalness: 0.6, roughness: 0.4 }),
      metal: new THREE.MeshStandardMaterial({ color: '#c9d1de', metalness: 0.9, roughness: 0.28, emissive: '#2a313f', emissiveIntensity: 0.4 }),
      oscuro: new THREE.MeshStandardMaterial({ color: '#0c0e14', metalness: 0.3, roughness: 0.5 }),
      mango: new THREE.MeshStandardMaterial({ color: '#1f6bff', metalness: 0.2, roughness: 0.35, emissive: '#1240a8', emissiveIntensity: 0.5 }),
      goma: new THREE.MeshStandardMaterial({ color: '#12151c', roughness: 0.8, metalness: 0 }),
      led: new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
      amarillo: new THREE.MeshStandardMaterial({ color: '#f5c518', metalness: 0.2, roughness: 0.45, emissive: '#7a5c00', emissiveIntensity: 0.4 }),
      pantallaMulti: new THREE.MeshBasicMaterial({ color: '#9ff0b0', toneMapped: false }),
    };
  }, []);

  const tiempo = useRef(0);
  const refDestornillador = useRef(null);
  const refGiro = useRef(null);
  const refLeds = useRef(null);
  const ultimaClave = useRef('');

  useEffect(
    () => () => {
      recursos.texturas.forEach((t) => t.dispose());
      Object.entries(recursos).forEach(([clave, valor]) => {
        if (clave !== 'texturas') valor.dispose();
      });
    },
    [recursos]
  );

  useFrame((_, delta) => {
    if (!activa) return;
    if (!reducido) tiempo.current += Math.min(delta, 0.05);
    const t = tiempo.current;

    // Los LEDs sólo se repintan cuando alguno cambia de estado.
    const clave = Array.from({ length: CANTIDAD_LEDS }, (_, i) => (reducido ? 1 : ledEncendido(i, t) ? 1 : 0)).join('');
    if (clave !== ultimaClave.current && refLeds.current) {
      ultimaClave.current = clave;
      refLeds.current(reducido ? 1.7 : t);
    }

    // Destornillador: baja al tornillo, lo aprieta girando y vuelve a subir. Con
    // movimiento reducido queda apoyado sobre el tornillo.
    const altura = reducido ? 0 : alturaDestornillador(t);
    if (refDestornillador.current) refDestornillador.current.position.y = POSICION_TORNILLO[1] + altura * ALTURA_LEVANTADO;
    if (refGiro.current) refGiro.current.rotation.y = reducido ? 0 : giroDestornillador(t);
  });

  return (
    <group position={[0.05, -0.1, 0]} rotation={[0.62, -0.28, 0]} scale={0.78}>
      {/* Tapete de corte: la base de todo. */}
      <PiezaDesarmable semilla={1}>
        <RoundedBox args={[3.9, 0.05, 2.5]} radius={0.02} smoothness={3} position={[0, -0.025, 0]} material={recursos.tapete} />
      </PiezaDesarmable>

      {/* Notebook abierta, mostrando el diagnóstico. */}
      <PiezaDesarmable semilla={2}>
        <group position={[-0.95, 0, -0.35]} rotation={[0, 0.18, 0]}>
          <RoundedBox args={[1.5, 0.05, 1.0]} radius={0.02} smoothness={3} position={[0, 0.025, 0.2]} material={recursos.carcasa} />
          <mesh position={[0, 0.052, 0.34]} material={recursos.oscuro}>
            <boxGeometry args={[1.25, 0.004, 0.46]} />
          </mesh>
          <mesh position={[0, 0.054, 0.62]} material={recursos.metal}>
            <boxGeometry args={[0.45, 0.003, 0.26]} />
          </mesh>
          <group position={[0, 0.05, -0.3]} rotation={[-1.2, 0, 0]}>
            <RoundedBox args={[1.5, 0.95, 0.04]} radius={0.02} smoothness={3} position={[0, 0.475, 0]} material={recursos.carcasa} />
            <mesh position={[0, 0.475, 0.022]} material={recursos.diagnostico}>
              <planeGeometry args={[1.38, 0.82]} />
            </mesh>
          </group>
        </group>
      </PiezaDesarmable>

      {/* Placa en reparación con LEDs que parpadean. */}
      <PiezaDesarmable semilla={3}>
        <group position={[0.35, 0.02, 0.2]} rotation={[0, -0.22, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} material={recursos.placa}>
            <boxGeometry args={[1.6, 1.07, 0.04]} />
          </mesh>
          <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.022, 0]}>
            <Leds material={recursos.led} refLeds={refLeds} />
          </group>
          {/* Chips sobre la placa. */}
          {[[-0.45, 0, 0.3], [0.1, 0, -0.1], [0.5, 0, 0.1]].map(([x, , z], i) => (
            <mesh key={i} position={[x, 0.07, z]} material={recursos.oscuro}>
              <boxGeometry args={[0.28 - i * 0.04, 0.06, 0.24 - i * 0.03]} />
            </mesh>
          ))}
          {/* Tornillo que aprieta el destornillador. */}
          <mesh position={[POSICION_TORNILLO[0] - 0.35, 0.045, POSICION_TORNILLO[2] - 0.2]} material={recursos.metal}>
            <cylinderGeometry args={[0.06, 0.06, 0.05, 20]} />
          </mesh>
        </group>
      </PiezaDesarmable>

      {/* Destornillador: baja y aprieta el tornillo de la placa. */}
      <PiezaDesarmable semilla={4}>
        <group ref={refDestornillador} position={POSICION_TORNILLO}>
          <group ref={refGiro}>
            <mesh position={[0, 0.07, 0]} material={recursos.metal}>
              <cylinderGeometry args={[0.012, 0.012, 0.3, 14]} />
            </mesh>
            <mesh position={[0, 0.02, 0]} material={recursos.metal}>
              <boxGeometry args={[0.045, 0.02, 0.012]} />
            </mesh>
            <mesh position={[0, 0.42, 0]} material={recursos.mango}>
              <cylinderGeometry args={[0.07, 0.06, 0.5, 24]} />
            </mesh>
            <mesh position={[0, 0.7, 0]} material={recursos.goma}>
              <sphereGeometry args={[0.07, 20, 20]} />
            </mesh>
            {[0.3, 0.38, 0.46, 0.54].map((y) => (
              <mesh key={y} position={[0, y, 0]} material={recursos.goma}>
                <cylinderGeometry args={[0.073, 0.073, 0.02, 24]} />
              </mesh>
            ))}
          </group>
        </group>
      </PiezaDesarmable>

      {/* Multímetro. */}
      <PiezaDesarmable semilla={5}>
        <group position={[1.5, 0, -0.55]} rotation={[0, -0.4, 0]}>
          <RoundedBox args={[0.7, 0.14, 1.0]} radius={0.04} smoothness={3} position={[0, 0.07, 0]} material={recursos.amarillo} />
          <mesh position={[0, 0.145, -0.27]} material={recursos.oscuro}>
            <boxGeometry args={[0.5, 0.01, 0.3]} />
          </mesh>
          <mesh position={[0, 0.152, -0.27]} material={recursos.pantallaMulti}>
            <planeGeometry args={[0.4, 0.2]} />
          </mesh>
          <mesh position={[0, 0.16, 0.18]} material={recursos.goma}>
            <cylinderGeometry args={[0.16, 0.16, 0.03, 28]} />
          </mesh>
          <mesh position={[0, 0.18, 0.18]} material={recursos.metal}>
            <boxGeometry args={[0.04, 0.012, 0.15]} />
          </mesh>
          {[-0.2, 0, 0.2].map((x) => (
            <mesh key={x} position={[x, 0.12, 0.46]} material={recursos.oscuro}>
              <cylinderGeometry args={[0.035, 0.035, 0.1, 14]} />
            </mesh>
          ))}
        </group>
      </PiezaDesarmable>

      {/* Pinzas y tornillos sueltos. */}
      <PiezaDesarmable semilla={6}>
        <group position={[-0.1, 0.02, 0.95]} rotation={[0, 0.5, 0]}>
          {[-0.014, 0.014].map((z) => (
            <mesh key={z} position={[0, 0.012, z]} rotation={[0, z * 5, 0]} material={recursos.metal}>
              <boxGeometry args={[0.8, 0.012, 0.018]} />
            </mesh>
          ))}
        </group>
        {[[0.45, 0.88], [0.58, 0.97], [0.72, 0.86], [0.64, 1.07]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.016, z]} rotation={[Math.PI / 2, 0, i]} material={recursos.metal}>
            <cylinderGeometry args={[0.03, 0.03, 0.02, 16]} />
          </mesh>
        ))}
      </PiezaDesarmable>
    </group>
  );
}
