'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import PiezaDesarmable from '../PiezaDesarmable.jsx';
import { crearPantalla } from '../pantallaCanvas.js';
import { alturaDestornillador, giroDestornillador, ledEncendido, CANTIDAD_LEDS } from '../cicloBanco.js';
import { paletaEscena, valorMultimetro } from '../paletas.js';
import { dibujarTeclas } from '../dibujarTeclas.js';
import {
  dibujarDiagnostico,
  dibujarLcd,
  dibujarPantallaTelefono,
  dibujarPlacaReparacion,
  dibujarSelector,
  dibujarTapete,
} from '../texturasBanco.js';
import Notebook from './banco/Notebook.jsx';
import Multimetro, { Cable, Punta, JACKS, Y_JACKS, Z_JACKS } from './banco/Multimetro.jsx';
import PlacaReparacion from './banco/PlacaReparacion.jsx';
import { MemoriaRAM, Palanca, Pinzas, Telefono } from './banco/Accesorios.jsx';

// Posiciones sobre el tapete (marco del banco: x a la derecha, z hacia el frente).
const POS_MULTIMETRO = [1.55, 0, -0.45];
const POS_PLACA = [0.35, 0.02, 0.2];
// Tornillo de la placa que aprieta el destornillador (ya en coordenadas del banco).
const POS_TORNILLO = [0.95, 0.075, 0.72];
const ALTURA_LEVANTADO = 0.5;
// Puntas de prueba sobre los contactos del conector flex.
const PUNTA_ROJA = [0.62, 0.07, 0.6];
const PUNTA_NEGRA = [0.15, 0.07, 0.62];
const REPOSO_LCD = 0.25;

// Los puntos de cada cable: desde la banana del multímetro, tendido sobre la
// mesa, hasta el extremo del mango de su punta de prueba.
const jack = (i) => [POS_MULTIMETRO[0] + JACKS[i].x, Y_JACKS + 0.03, POS_MULTIMETRO[2] + Z_JACKS];
const CABLE_ROJO = [jack(2), [1.76, 0.1, 0.3], [1.5, 0.04, 0.7], [1.1, 0.05, 1.0], [0.8, 0.25, 0.95], [0.504, 0.457, 0.8375]];
const CABLE_NEGRO = [jack(1), [1.5, 0.1, 0.45], [1.0, 0.04, 1.05], [0.5, 0.05, 1.05], [0.2, 0.25, 0.95], [0.034, 0.457, 0.8575]];

export default function Escena4Banco({ activa, reducido, claro = false }) {
  const paleta = paletaEscena(claro);

  const recursos = useMemo(() => {
    const texturas = [];
    const crear = (ancho, alto, dibujar) => {
      const l = crearPantalla(ancho, alto);
      dibujar(l.ctx, ancho, alto);
      l.textura.needsUpdate = true;
      texturas.push(l.textura);
      return l;
    };
    const lcd = crear(512, 256, (ctx, w, h) => dibujarLcd(ctx, w, h, valorMultimetro(0)));
    const tapeteTex = crear(1536, 1000, (ctx, w, h) => dibujarTapete(ctx, w, h, claro)).textura;
    const std = (opciones) => new THREE.MeshStandardMaterial(opciones);
    const mats = {
      tapete: std({ map: tapeteTex, emissiveMap: tapeteTex, emissive: claro ? '#000000' : '#2fbf80', emissiveIntensity: claro ? 0 : 0.55, roughness: 0.85 }),
      chasis: std({ color: paleta.chasis, metalness: claro ? 0.2 : 0.6, roughness: claro ? 0.45 : 0.4 }),
      hueco: std({ color: claro ? '#b9c0cd' : '#07090e', roughness: 0.7 }),
      tecla: std({ color: '#ffffff', metalness: 0.1, roughness: 0.45 }),
      leyendas: new THREE.MeshBasicMaterial({
        map: crear(960, 343, (ctx, w, h) => dibujarTeclas(ctx, w, h, paleta.teclaTexto)).textura,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
      trackpad: std({ color: claro ? '#d5dae3' : '#10131a', metalness: 0.3, roughness: 0.5 }),
      diagnostico: new THREE.MeshBasicMaterial({ map: crear(1024, 640, (ctx, w, h) => dibujarDiagnostico(ctx, w, h, claro)).textura, toneMapped: false }),
      logo: new THREE.MeshBasicMaterial({ color: claro ? '#8d96a8' : '#3a4560', toneMapped: false }),
      oscuro: std({ color: '#0c0e14', metalness: 0.3, roughness: 0.5 }),
      led: new THREE.MeshBasicMaterial({ color: '#3de0c0', toneMapped: false }),
      goma: std({ color: '#15171c', roughness: 0.85 }),
      amarillo: std({ color: '#f5c518', metalness: 0.15, roughness: 0.42, emissive: '#7a5c00', emissiveIntensity: 0.35 }),
      lcd: new THREE.MeshBasicMaterial({ map: lcd.textura, toneMapped: false }),
      rojo: std({ color: '#c4151c', roughness: 0.45 }),
      boton: std({ color: '#3a3f4a', roughness: 0.5, metalness: 0.2 }),
      selector: new THREE.MeshBasicMaterial({ map: crear(512, 512, dibujarSelector).textura, toneMapped: false }),
      perilla: std({ color: '#25282f', metalness: 0.5, roughness: 0.4 }),
      blanco: std({ color: '#f5f5ee', roughness: 0.5, emissive: '#707068', emissiveIntensity: 0.3 }),
      acero: std({ color: '#c9d1de', metalness: 0.9, roughness: 0.28, emissive: '#2a313f', emissiveIntensity: 0.4 }),
      placa: std({ map: crear(768, 512, dibujarPlacaReparacion).textura, roughness: 0.5, metalness: 0.1 }),
      oro: std({ color: '#e0bc4a', metalness: 1, roughness: 0.3, emissive: '#6a5410', emissiveIntensity: 0.5 }),
      azulUSB: std({ color: '#1f5cff', roughness: 0.45 }),
      chip: std({ color: '#0b0c10', roughness: 0.45, metalness: 0.15 }),
      marca: new THREE.MeshBasicMaterial({ color: '#4b505c', toneMapped: false }),
      plasticoClaro: std({ color: '#e5e2d6', roughness: 0.55 }),
      cobre: std({ color: '#c9783a', metalness: 0.9, roughness: 0.35, emissive: '#4a2410', emissiveIntensity: 0.5 }),
      resistencia: std({ color: '#ffffff', roughness: 0.5, metalness: 0.1 }),
      capacitor: std({ color: '#171c2e', roughness: 0.4, metalness: 0.35 }),
      telefono: std({ color: claro ? '#c7cbd6' : '#262932', metalness: 0.8, roughness: 0.3, emissive: '#1a1e28', emissiveIntensity: 0.4 }),
      pantallaTelefono: new THREE.MeshBasicMaterial({ map: crear(512, 1024, (ctx, w, h) => dibujarPantallaTelefono(ctx, w, h, claro)).textura, toneMapped: false }),
      mango: std({ color: '#1f6bff', roughness: 0.35, emissive: '#1240a8', emissiveIntensity: 0.5 }),
      ram: std({ color: '#0f1a14', roughness: 0.5, metalness: 0.1 }),
    };
    return { texturas, mats, lcd };
  }, [claro, paleta]);

  const { mats, lcd } = recursos;
  const tiempo = useRef(0);
  const refDestornillador = useRef(null);
  const refGiro = useRef(null);
  const refSelector = useRef(null);
  const refLeds = useRef(null);
  const ultimaClave = useRef('');
  const ultimoLcd = useRef('');

  useEffect(
    () => () => {
      recursos.texturas.forEach((t) => t.dispose());
      Object.values(recursos.mats).forEach((m) => m.dispose());
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

    // La lectura del multímetro oscila un poco; sólo se redibuja si cambió.
    const valor = valorMultimetro(reducido ? REPOSO_LCD : t);
    if (valor !== ultimoLcd.current) {
      ultimoLcd.current = valor;
      const ctx = lcd.ctx;
      dibujarLcd(ctx, lcd.ancho, lcd.alto, valor);
      lcd.textura.needsUpdate = true;
    }

    // Destornillador: baja al tornillo, lo aprieta girando y vuelve a subir. Con
    // movimiento reducido queda apoyado sobre el tornillo.
    const altura = reducido ? 0 : alturaDestornillador(t);
    if (refDestornillador.current) refDestornillador.current.position.y = POS_TORNILLO[1] + altura * ALTURA_LEVANTADO;
    if (refGiro.current) refGiro.current.rotation.y = reducido ? 0 : giroDestornillador(t);
    if (refSelector.current) refSelector.current.rotation.y = 0.9;
  });

  return (
    // `key` por variante: al cambiar de tema se recrean los materiales y las mallas
    // instanciadas (teclas, capacitores…) tienen que armarse de nuevo desde cero.
    <group key={claro ? 'claro' : 'oscuro'} position={[0.05, -0.1, 0]} rotation={[0.62, -0.28, 0]} scale={0.74}>
      {/* La luz azul del sitio tiñe los blancos: en la variante clara se suma una luz neutra. */}
      {claro ? <directionalLight position={[3, 6, 5]} intensity={2.2} color="#ffffff" /> : null}
      {/* Tapete de corte: la base de todo. */}
      <PiezaDesarmable semilla={1}>
        <RoundedBox args={[3.9, 0.05, 2.5]} radius={0.02} smoothness={3} position={[0, -0.025, 0]} material={mats.tapete} />
      </PiezaDesarmable>

      {/* Notebook con teclado, abierta y mostrando el diagnóstico. */}
      <PiezaDesarmable semilla={2}>
        <group position={[-0.95, 0, -0.35]} rotation={[0, 0.18, 0]}>
          <Notebook mats={mats} paleta={paleta} />
        </group>
      </PiezaDesarmable>

      {/* Placa en reparación. */}
      <PiezaDesarmable semilla={3}>
        <group position={POS_PLACA} rotation={[0, -0.22, 0]}>
          <PlacaReparacion mats={mats} refLeds={refLeds} />
        </group>
      </PiezaDesarmable>

      {/* Destornillador: baja y aprieta el tornillo de la placa. */}
      <PiezaDesarmable semilla={4}>
        <group ref={refDestornillador} position={POS_TORNILLO}>
          <group ref={refGiro}>
            <mesh position={[0, 0.07, 0]} material={mats.acero}>
              <cylinderGeometry args={[0.012, 0.012, 0.3, 14]} />
            </mesh>
            <mesh position={[0, 0.02, 0]} material={mats.acero}>
              <boxGeometry args={[0.045, 0.02, 0.012]} />
            </mesh>
            <mesh position={[0, 0.42, 0]} material={mats.mango}>
              <cylinderGeometry args={[0.07, 0.06, 0.5, 24]} />
            </mesh>
            <mesh position={[0, 0.7, 0]} material={mats.goma}>
              <sphereGeometry args={[0.07, 20, 20]} />
            </mesh>
            {[0.3, 0.38, 0.46, 0.54].map((y) => (
              <mesh key={y} position={[0, y, 0]} material={mats.goma}>
                <cylinderGeometry args={[0.073, 0.073, 0.02, 24]} />
              </mesh>
            ))}
          </group>
        </group>
      </PiezaDesarmable>

      {/* Multímetro con sus dos cables y puntas de prueba sobre la placa. */}
      <PiezaDesarmable semilla={5}>
        <group position={POS_MULTIMETRO}>
          <Multimetro mats={mats} refSelector={refSelector} />
        </group>
        <Cable puntos={CABLE_ROJO} color="#c4151c" />
        <Cable puntos={CABLE_NEGRO} color="#101114" />
        <Punta posicion={PUNTA_ROJA} color="#c4151c" mats={mats} />
        <Punta posicion={PUNTA_NEGRA} color="#15171c" mats={mats} />
      </PiezaDesarmable>

      {/* Teléfono en reparación, palanca, memoria RAM suelta, pinzas y tornillos. */}
      <PiezaDesarmable semilla={6}>
        <group position={[-1.35, 0, 0.95]} rotation={[0, 0.5, 0]}>
          <Telefono mats={mats} />
        </group>
        <group position={[-0.8, 0, 0.62]} rotation={[0, -0.1, 0]}>
          <Palanca mats={mats} />
        </group>
        <group position={[-0.3, 0, 1.02]} rotation={[0, -0.12, 0]}>
          <MemoriaRAM mats={mats} />
        </group>
        <group position={[0.2, 0, -0.95]} rotation={[0, 0.5, 0]}>
          <Pinzas mats={mats} />
        </group>
        {[[-0.4, -0.9], [-0.28, -1.0], [-0.52, -1.0], [-0.34, -0.8]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.016, z]} rotation={[Math.PI / 2, 0, i]} material={mats.acero}>
            <cylinderGeometry args={[0.03, 0.03, 0.02, 16]} />
          </mesh>
        ))}
      </PiezaDesarmable>
    </group>
  );
}
