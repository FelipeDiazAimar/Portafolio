'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment, Lightformer, RoundedBox, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import PiezaDesarmable from '../PiezaDesarmable.jsx';
import { crearPantalla } from '../pantallaCanvas.js';
import { valorMultimetro } from '../paletas.js';
import { dibujarDiagnostico, dibujarLcd, dibujarPantallaTelefono, dibujarTapete } from '../texturasBanco.js';
import { anclarEnMesa, construirRam } from './modelos.js';
import { RELACION_PANTALLA, agregarManzana, crearManzana, materialManzana, prepararPantalla } from './macbook.js';
import { Banana, Cable, LARGO_PUNTA, Punta } from './banco/Cables.jsx';
import { Destornillador, Palanca, Pinzas } from './banco/Accesorios.jsx';

const RUTA_MAC = '/modelos/macbook.glb';
const RUTA_PLACA = '/modelos/placa-am4.glb';
const RUTA_MULTIMETRO = '/modelos/multimetro.glb';
const RUTA_RAM = '/modelos/ram-ddr5.glb';
const RUTA_TELEFONO = '/modelos/iphone-x.glb';

// Escalas (unidades del banco por unidad de cada modelo) elegidas para que los
// tamaños se parezcan a los reales: notebook de 35 cm, multímetro de 16 cm...
const ESCALA_MAC = 2.0 / 35.5;
const ESCALA_PLACA = 1.6 / 4.8;
const ESCALA_MULTIMETRO = 0.93 / 16.5;
const ESCALA_RAM = 0.8 / 1.383;
const ESCALA_TELEFONO = 0.9 / 226;

// Posiciones sobre el tapete (marco del banco: x a la derecha, z hacia el frente).
const POS_MAC = [-1.2, 0, -0.6];
const GIRO_MAC = 0.35;
const POS_PLACA = [0.7, 0, 0.6];
const GIRO_PLACA = 0.25;
const POS_MULTIMETRO = [2.1, 0, -0.5];
const GIRO_MULTIMETRO = -0.5;
const POS_RAM = [-0.55, 0, 1.2];
const POS_TELEFONO = [-1.95, 0, 1.2];
// Capa de pantalla sobre el vidrio del teléfono (unidades del modelo).
const PANTALLA_TELEFONO = { ancho: 98, alto: 212 };

// Dónde tocan las puntas: dos contactos del conector de alimentación de la placa
// (en el espacio de la placa: x, altura y z hacia el frente).
const CONTACTOS = [
  [1.945, 0.235, -0.62],
  [1.945, 0.235, -1.15],
];
// Entradas del multímetro (en su espacio): COM y V Ω, con la altura del borde del cuerpo.
const ENTRADAS = [
  { x: 0.27, y: 0.3, z: 5.52, color: '#101114' },
  { x: 2.15, y: 0.3, z: 5.58, color: '#c4151c' },
];
const INCLINACION_PUNTA = [-0.5, 0, -0.45];
// Sobre el visor del multímetro: va un plano con la lectura que cambia.
const VISOR = { x: 0, y: 0.43, z: -5.08, ancho: 5.5, alto: 2.15 };

const aBanco = (p, modelo, escala, pos, giro) => {
  const x = (p[0] - modelo.cx) * escala;
  const y = (p[1] - modelo.minY) * escala;
  const z = (p[2] - modelo.cz) * escala;
  const c = Math.cos(giro);
  const s = Math.sin(giro);
  return [pos[0] + x * c + z * s, pos[1] + y, pos[2] - x * s + z * c];
};

export default function Escena4Banco({ activa, reducido, claro = false }) {
  const mac = useGLTF(RUTA_MAC).scene;
  const placa = useGLTF(RUTA_PLACA).scene;
  const multimetro = useGLTF(RUTA_MULTIMETRO).scene;
  const ram = useGLTF(RUTA_RAM).scene;
  const telefono = useGLTF(RUTA_TELEFONO).scene;

  const recursos = useMemo(() => {
    const texturas = [];
    const crear = (ancho, alto, dibujar) => {
      const l = crearPantalla(ancho, alto);
      dibujar(l.ctx, ancho, alto);
      l.textura.needsUpdate = true;
      texturas.push(l.textura);
      return l;
    };
    const lcd = crear(550, 215, (ctx, w, h) => dibujarLcd(ctx, w, h, valorMultimetro(0)));
    const tapeteTex = crear(1536, 1000, (ctx, w, h) => dibujarTapete(ctx, w, h, claro)).textura;
    const manzana = crearManzana();
    texturas.push(manzana.textura);
    const std = (opciones) => new THREE.MeshStandardMaterial(opciones);
    const mats = {
      tapete: std({ map: tapeteTex, color: claro ? '#ffffff' : '#6f8f84', emissiveMap: tapeteTex, emissive: claro ? '#000000' : '#2fbf80', emissiveIntensity: claro ? 0 : 0.16, roughness: 0.85 }),
      pantallaMac: new THREE.MeshBasicMaterial({
        map: crear(1280, Math.round(1280 / RELACION_PANTALLA), (ctx, w, h) => dibujarDiagnostico(ctx, w, h, claro)).textura,
        toneMapped: false,
      }),
      manzana: materialManzana(manzana.textura),
      lcd: new THREE.MeshBasicMaterial({ map: lcd.textura, toneMapped: false }),
      goma: std({ color: '#15171c', roughness: 0.85 }),
      mango: std({ color: '#1f6bff', roughness: 0.35, emissive: '#1240a8', emissiveIntensity: 0.5 }),
      acero: std({ color: '#c9d1de', metalness: 0.9, roughness: 0.28, emissive: '#2a313f', emissiveIntensity: 0.4 }),
      plasticoClaro: std({ color: '#e5e2d6', roughness: 0.55 }),
      pantallaTelefono: new THREE.MeshBasicMaterial({
        map: crear(512, 1108, (ctx, w, h) => dibujarPantallaTelefono(ctx, w, h, claro)).textura,
        transparent: true,
        alphaTest: 0.5,
        toneMapped: false,
      }),
    };
    return { texturas, mats, lcd };
  }, [claro]);
  const { mats, lcd } = recursos;

  // Los cuatro modelos, apoyados sobre la mesa. La MacBook lleva la pantalla de
  // diagnóstico y la manzana; la RAM se ve de los dos lados.
  const modelos = useMemo(() => {
    const macBanco = anclarEnMesa(mac);
    const pantallaMac = prepararPantalla(macBanco.raiz);
    pantallaMac.panel.material = mats.pantallaMac;
    const tapa = macBanco.raiz.getObjectByName('VCQqxpxkUlzqcJI');
    agregarManzana(tapa, pantallaMac, mats.manzana);
    return {
      mac: macBanco,
      placa: anclarEnMesa(placa),
      multimetro: anclarEnMesa(multimetro),
      ram: anclarEnMesa(construirRam(ram)),
      telefono: anclarEnMesa(telefono),
    };
  }, [mac, placa, multimetro, ram, telefono, mats]);

  // Puntas de prueba sobre la placa y cables hasta las entradas del multímetro.
  const conexiones = useMemo(() => {
    const euler = new THREE.Euler(...INCLINACION_PUNTA);
    const haciaMango = new THREE.Vector3(0, 1, 0).applyEuler(euler);
    return CONTACTOS.map((contacto, i) => {
      const punta = aBanco(contacto, modelos.placa, ESCALA_PLACA, POS_PLACA, GIRO_PLACA);
      const mango = new THREE.Vector3(...punta).addScaledVector(haciaMango, LARGO_PUNTA);
      const e = ENTRADAS[i];
      const entrada = aBanco([e.x, e.y, e.z], modelos.multimetro, ESCALA_MULTIMETRO, POS_MULTIMETRO, GIRO_MULTIMETRO);
      const arriba = [entrada[0], entrada[1] + 0.06, entrada[2]];
      const salida = new THREE.Vector3(...arriba).add(
        new THREE.Vector3(Math.sin(GIRO_MULTIMETRO), 0, Math.cos(GIRO_MULTIMETRO)).multiplyScalar(0.18)
      );
      const medio = new THREE.Vector3().lerpVectors(salida, mango, 0.5);
      medio.y = 0.04;
      const aproximacion = mango.clone().addScaledVector(haciaMango, 0.2);
      return {
        color: e.color,
        punta,
        entrada,
        cable: [arriba, [salida.x, 0.04, salida.z], [medio.x, 0.04, medio.z], aproximacion.toArray(), mango.toArray()],
      };
    });
  }, [modelos]);

  const tiempo = useRef(0);
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
    // La lectura del multímetro oscila un poco; sólo se redibuja si cambió.
    const valor = valorMultimetro(reducido ? 0.25 : tiempo.current);
    if (valor !== ultimoLcd.current) {
      ultimoLcd.current = valor;
      dibujarLcd(lcd.ctx, lcd.ancho, lcd.alto, valor);
      lcd.textura.needsUpdate = true;
    }
  });

  const encaje = (m, escala) => [-m.cx * escala, -m.minY * escala, -m.cz * escala];

  return (
    // `key` por variante: al cambiar de tema se recrean los materiales y las texturas.
    <group key={claro ? 'claro' : 'oscuro'} position={[0.05, -0.25, 0]} rotation={[0.62, -0.28, 0]} scale={0.63}>
      <Environment resolution={512} frames={1} environmentIntensity={0.75}>
        <color attach="background" args={['#8190a6']} />
        <Lightformer form="rect" intensity={9} color="#ffffff" position={[0, 6, 5]} rotation-x={Math.PI / 2.2} scale={[14, 6, 1]} />
        <Lightformer form="rect" intensity={6} color="#f4f7ff" position={[0, 1, 9]} scale={[16, 9, 1]} />
        <Lightformer form="rect" intensity={4} color="#7fe6ff" position={[-7, 1, 1]} rotation-y={Math.PI / 2} scale={[9, 5, 1]} />
        <Lightformer form="rect" intensity={4} color="#b9ccff" position={[7, 1, 2]} rotation-y={-Math.PI / 2} scale={[9, 5, 1]} />
      </Environment>
      {/* La luz azul del sitio tiñe los blancos: luz neutra para que se vean los colores. */}
      <directionalLight position={[3, 6, 5]} intensity={claro ? 2.0 : 1.1} color="#ffffff" />

      {/* Tapete de corte: la base de todo. */}
      <PiezaDesarmable semilla={1}>
        <RoundedBox args={[5.0, 0.05, 3.1]} radius={0.02} smoothness={3} position={[0, -0.025, 0]} material={mats.tapete} />
      </PiezaDesarmable>

      {/* Notebook abierta mostrando el diagnóstico. */}
      <PiezaDesarmable semilla={2}>
        <group position={POS_MAC} rotation={[0, GIRO_MAC, 0]}>
          <group scale={ESCALA_MAC} position={encaje(modelos.mac, ESCALA_MAC)}>
            <primitive object={modelos.mac.raiz} />
          </group>
        </group>
      </PiezaDesarmable>

      {/* Placa que se está probando con el multímetro. */}
      <PiezaDesarmable semilla={3}>
        <group position={POS_PLACA} rotation={[0, GIRO_PLACA, 0]}>
          <group scale={ESCALA_PLACA} position={encaje(modelos.placa, ESCALA_PLACA)}>
            <primitive object={modelos.placa.raiz} />
          </group>
        </group>
      </PiezaDesarmable>

      {/* Multímetro con sus dos cables y las puntas de prueba sobre la placa. */}
      <PiezaDesarmable semilla={5}>
        <group position={POS_MULTIMETRO} rotation={[0, GIRO_MULTIMETRO, 0]}>
          <group scale={ESCALA_MULTIMETRO} position={encaje(modelos.multimetro, ESCALA_MULTIMETRO)}>
            <primitive object={modelos.multimetro.raiz} />
            <mesh position={[VISOR.x, VISOR.y, VISOR.z]} rotation={[-Math.PI / 2, 0, 0]} material={mats.lcd}>
              <planeGeometry args={[VISOR.ancho, VISOR.alto]} />
            </mesh>
          </group>
        </group>
        {conexiones.map(({ color, punta, entrada, cable }) => (
          <group key={color}>
            <Cable puntos={cable} color={color} />
            <Banana posicion={entrada} color={color} mats={mats} />
            <Punta posicion={punta} color={color} inclinacion={INCLINACION_PUNTA} mats={mats} />
          </group>
        ))}
      </PiezaDesarmable>

      {/* Memoria RAM suelta sobre la mesa. */}
      <PiezaDesarmable semilla={6}>
        <group position={POS_RAM} rotation={[0, -0.15, 0]}>
          <group scale={ESCALA_RAM} rotation={[0, Math.PI / 2, 0]}>
            <group position={encaje(modelos.ram, 1)}>
              <primitive object={modelos.ram.raiz} />
            </group>
          </group>
        </group>
      </PiezaDesarmable>

      {/* Teléfono en reparación, palanca, pinzas y destornillador. */}
      <PiezaDesarmable semilla={7}>
        <group position={POS_TELEFONO} rotation={[0, 0.5, 0]}>
          <group scale={ESCALA_TELEFONO} position={encaje(modelos.telefono, ESCALA_TELEFONO)}>
            <primitive object={modelos.telefono.raiz} />
            <mesh position={[modelos.telefono.cx, modelos.telefono.caja.max.y + 0.25, modelos.telefono.cz]} rotation={[-Math.PI / 2, 0, 0]} material={mats.pantallaTelefono}>
              <planeGeometry args={[PANTALLA_TELEFONO.ancho, PANTALLA_TELEFONO.alto]} />
            </mesh>
          </group>
        </group>
        <group position={[-0.65, 0, 0.5]} rotation={[0, -0.1, 0]}>
          <Palanca mats={mats} />
        </group>
        <group position={[0.45, 0, -1.1]} rotation={[0, 0.5, 0]}>
          <Pinzas mats={mats} />
        </group>
        <group position={[1.8, 0, 1.0]} rotation={[0, -0.15, 0]}>
          <Destornillador mats={mats} />
        </group>
      </PiezaDesarmable>
    </group>
  );
}
