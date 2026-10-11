'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import PiezaDesarmable from '../PiezaDesarmable.jsx';
import { crearPantalla } from '../pantallaCanvas.js';
import {
  CAJAS,
  LARGO,
  RUTA,
  S_ESCANER,
  VELOCIDAD,
  brilloSap,
  distanciaCaja,
  faseCodigo,
  progresoEscaneo,
  puntoEnRuta,
} from '../cicloPlanta.js';
import { dibujarCinta, dibujarCodigo, dibujarSap, dibujarSuelo } from '../texturasPlanta.js';

// Medidas de la planta (marco de la escena: y hacia arriba, x a la derecha, z al frente).
const ALTO_CINTA = 0.45;
const ANCHO_CINTA = 0.7;
const TAM_CAJA = 0.4;
const SAP = new THREE.Vector3(-0.9, 2.15, -1.05);
// Cuántas veces se repite la textura de la cinta por unidad de largo.
const REPETICION = 2.5;
// Reloj inicial con movimiento reducido: una foto fija con cajas repartidas.
const T_QUIETO = 3.4;

const SEGMENTOS = RUTA.slice(1).map(([x1, z1], i) => {
  const [x0, z0] = RUTA[i];
  return { x0, z0, x1, z1, largo: Math.hypot(x1 - x0, z1 - z0), giro: i === 0 ? 0 : Math.PI / 2 };
});

const suavizar = (f) => f * f * (3 - 2 * f);

// Tramo de cinta: marco de acero, rodillos en los extremos y la banda con ranuras que se mueve.
function Cinta({ segmento, textura, mats }) {
  const { x0, z0, x1, z1, largo, giro } = segmento;
  const largoTotal = largo + ANCHO_CINTA;
  return (
    <group position={[(x0 + x1) / 2, 0, (z0 + z1) / 2]} rotation={[0, giro, 0]}>
      {/* Patas y larguero. */}
      {[-1, 1].flatMap((lado) =>
        [-0.4, 0.4].map((f) => (
          <mesh key={`${lado}${f}`} position={[f * largo, ALTO_CINTA / 2 - 0.02, lado * (ANCHO_CINTA / 2 + 0.02)]} material={mats.acero}>
            <boxGeometry args={[0.06, ALTO_CINTA - 0.04, 0.05]} />
          </mesh>
        ))
      )}
      {[-1, 1].map((lado) => (
        <mesh key={lado} position={[0, ALTO_CINTA - 0.05, lado * (ANCHO_CINTA / 2 + 0.02)]} material={mats.acero}>
          <boxGeometry args={[largoTotal, 0.09, 0.05]} />
        </mesh>
      ))}
      <mesh position={[0, ALTO_CINTA - 0.1, 0]} material={mats.oscuro}>
        <boxGeometry args={[largoTotal - 0.04, 0.06, ANCHO_CINTA]} />
      </mesh>
      {/* Banda. */}
      <mesh position={[0, ALTO_CINTA - 0.065, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[largoTotal - 0.04, ANCHO_CINTA - 0.04]} />
        <meshStandardMaterial map={textura} roughness={0.8} />
      </mesh>
      {/* Luces de borde. */}
      {[-1, 1].map((lado) => (
        <mesh key={lado} position={[0, ALTO_CINTA - 0.012, lado * (ANCHO_CINTA / 2 + 0.02)]} material={mats.luz}>
          <boxGeometry args={[largoTotal - 0.1, 0.012, 0.012]} />
        </mesh>
      ))}
    </group>
  );
}

export default function Escena5Planta({ activa, reducido, claro = false }) {
  const recursos = useMemo(() => {
    const texturas = [];
    const crear = (ancho, alto, dibujar) => {
      const l = crearPantalla(ancho, alto);
      dibujar(l.ctx, ancho, alto);
      l.textura.needsUpdate = true;
      texturas.push(l.textura);
      return l;
    };
    const cinta = (largo) => {
      const l = crear(256, 128, dibujarCinta);
      l.textura.wrapS = THREE.RepeatWrapping;
      l.textura.repeat.set(largo * REPETICION, 1);
      return l.textura;
    };
    const sap = crear(512, 512, dibujarSap).textura;
    const codigo = crear(512, 256, dibujarCodigo).textura;
    const std = (opciones) => new THREE.MeshStandardMaterial(opciones);
    const mats = {
      suelo: std({ map: crear(1400, 1000, (ctx, w, h) => dibujarSuelo(ctx, w, h, claro)).textura, roughness: 0.9 }),
      acero: std({ color: claro ? '#8a96ab' : '#3a4458', metalness: 0.6, roughness: 0.45 }),
      oscuro: std({ color: '#161a23', roughness: 0.7 }),
      luz: new THREE.MeshBasicMaterial({ color: '#5aa2ff', toneMapped: false }),
      carton: std({ color: '#c79a62', roughness: 0.8 }),
      cintaCaja: std({ color: '#efe9d6', roughness: 0.6 }),
      etiqueta: new THREE.MeshBasicMaterial({ map: codigo, toneMapped: false }),
      codigoVuela: new THREE.MeshBasicMaterial({ map: codigo, transparent: true, depthWrite: false, toneMapped: false }),
      sapLado: std({ color: '#0b3a9e', emissive: '#1a5cff', emissiveIntensity: 1, metalness: 0.3, roughness: 0.4 }),
      sapCara: new THREE.MeshBasicMaterial({ map: sap, toneMapped: false }),
      anillo: new THREE.MeshBasicMaterial({ color: '#6fa8ff', transparent: true, opacity: 0.55, toneMapped: false }),
      pod: std({ color: '#0f2f6e', emissive: '#3de0c0', emissiveIntensity: 0.9, roughness: 0.35 }),
      laser: new THREE.MeshBasicMaterial({
        color: '#7fb4ff',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
      cabina: std({ color: claro ? '#b9c3d6' : '#232c3e', roughness: 0.6 }),
      ventana: new THREE.MeshBasicMaterial({ color: '#7fb4ff', toneMapped: false }),
      contenedor: std({ color: '#1f6bff', metalness: 0.2, roughness: 0.55 }),
    };
    return { texturas, mats, cintas: SEGMENTOS.map((s) => cinta(s.largo)) };
  }, [claro]);
  const { mats, cintas } = recursos;

  const tiempo = useRef(reducido ? T_QUIETO : 0);
  const refCajas = useRef([]);
  const refCodigos = useRef([]);
  const refLaser = useRef(null);
  const refSap = useRef(null);
  const refPods = useRef([]);
  const refAnillo = useRef(null);

  useEffect(
    () => () => {
      recursos.texturas.forEach((t) => t.dispose());
      Object.values(recursos.mats).forEach((m) => m.dispose());
    },
    [recursos]
  );

  useFrame((estado, delta) => {
    if (!activa) return;
    if (!reducido) tiempo.current += Math.min(delta, 0.05);
    const t = tiempo.current;

    // Cajas: avanzan por la ruta; aparecen y desaparecen achicándose en los extremos.
    let laser = 0;
    for (let i = 0; i < CAJAS; i += 1) {
      const s = distanciaCaja(i, t);
      const p = puntoEnRuta(s);
      const caja = refCajas.current[i];
      const escala = suavizar(Math.min(1, s / 0.3, (LARGO - s) / 0.3));
      caja.position.set(p.x, ALTO_CINTA + (TAM_CAJA / 2) * escala, p.z);
      caja.rotation.y = p.giro;
      caja.scale.setScalar(Math.max(escala, 0.001));
      laser = Math.max(laser, progresoEscaneo(s));

      // Código de trazabilidad: sale de la caja ya leída y vuela hacia el nodo SAP.
      const codigo = refCodigos.current[i];
      const fase = faseCodigo(s);
      codigo.visible = fase > 0;
      if (fase > 0) {
        const f = suavizar(fase);
        codigo.position.set(
          p.x + (SAP.x - p.x) * f,
          ALTO_CINTA + TAM_CAJA + 0.25 + (SAP.y - (ALTO_CINTA + TAM_CAJA + 0.25)) * f + Math.sin(Math.PI * fase) * 0.6,
          p.z + (SAP.z - p.z) * f
        );
        codigo.scale.setScalar(0.62 * (1 - 0.55 * fase));
        codigo.quaternion.copy(estado.camera.quaternion);
      }
    }
    mats.laser.opacity = laser * 0.85;
    if (refLaser.current) refLaser.current.scale.y = 0.4 + 0.6 * laser;

    // Nodo SAP: gira despacio y destella cuando llega un código; los "pods" orbitan.
    const brillo = brilloSap(t);
    mats.sapLado.emissiveIntensity = 0.7 + 2.2 * brillo;
    mats.anillo.opacity = 0.35 + 0.5 * brillo;
    if (refSap.current) refSap.current.rotation.y = t * 0.5;
    if (refAnillo.current) refAnillo.current.rotation.z = t * 0.6;
    refPods.current.forEach((pod, i) => {
      const a = t * 0.9 + (i * Math.PI * 2) / 3;
      pod.position.set(Math.cos(a) * 0.95, 0.12 * Math.sin(t * 1.3 + i), Math.sin(a) * 0.95);
      pod.rotation.set(t * 0.8, t * 0.6, 0);
    });

    // La banda parece avanzar: la textura se desplaza a la velocidad de las cajas.
    cintas.forEach((textura) => {
      textura.offset.x = -((t * VELOCIDAD * REPETICION) % 1);
    });
  });

  const xEscaner = RUTA[0][0] + S_ESCANER;
  const zEscaner = RUTA[0][1];

  return (
    // `key` por variante: al cambiar de tema se recrean materiales y texturas.
    <group key={claro ? 'claro' : 'oscuro'} position={[0.2, -0.3, 0]} rotation={[0.62, -0.62, 0]} scale={0.6}>
      <directionalLight position={[3, 6, 4]} intensity={claro ? 2.2 : 1.5} color="#ffffff" />

      {/* Piso de la planta. */}
      <PiezaDesarmable semilla={1}>
        <mesh position={[0, -0.06, -0.2]} material={mats.suelo}>
          <boxGeometry args={[5.4, 0.12, 4.6]} />
        </mesh>
      </PiezaDesarmable>

      {/* Cintas transportadoras. */}
      <PiezaDesarmable semilla={2}>
        <Cinta segmento={SEGMENTOS[0]} textura={cintas[0]} mats={mats} />
      </PiezaDesarmable>
      <PiezaDesarmable semilla={3}>
        <Cinta segmento={SEGMENTOS[1]} textura={cintas[1]} mats={mats} />
      </PiezaDesarmable>

      {/* Escáner: pórtico sobre la cinta, con un lector y el láser que destella. */}
      <PiezaDesarmable semilla={4}>
        <group position={[xEscaner, 0, zEscaner]}>
          {[-1, 1].map((lado) => (
            <mesh key={lado} position={[0, 0.8, lado * 0.5]} material={mats.acero}>
              <boxGeometry args={[0.12, 1.6, 0.1]} />
            </mesh>
          ))}
          <mesh position={[0, 1.6, 0]} material={mats.acero}>
            <boxGeometry args={[0.16, 0.12, 1.12]} />
          </mesh>
          <mesh position={[0, 1.5, 0]} material={mats.oscuro}>
            <boxGeometry args={[0.28, 0.16, 0.34]} />
          </mesh>
          <mesh position={[0, 1.41, 0]} material={mats.luz}>
            <boxGeometry args={[0.2, 0.02, 0.26]} />
          </mesh>
          <mesh ref={refLaser} position={[0, ALTO_CINTA + 0.5, 0]} rotation={[0, Math.PI / 2, 0]} material={mats.laser}>
            <planeGeometry args={[0.8, 1.0]} />
          </mesh>
        </group>
      </PiezaDesarmable>

      {/* Cabina de control y contenedor de salida. */}
      <PiezaDesarmable semilla={5}>
        <group position={[-2.35, 0, -1.55]}>
          <mesh position={[0, 0.45, 0]} material={mats.cabina}>
            <boxGeometry args={[0.9, 0.9, 0.7]} />
          </mesh>
          <mesh position={[0.2, 0.55, 0.36]} material={mats.ventana}>
            <boxGeometry args={[0.36, 0.22, 0.02]} />
          </mesh>
          <mesh position={[0, 0.94, 0]} material={mats.acero}>
            <boxGeometry args={[1.0, 0.06, 0.8]} />
          </mesh>
        </group>
        <group position={[RUTA.at(-1)[0], 0, RUTA.at(-1)[1] - 0.8]}>
          <mesh position={[0, 0.45, 0]} material={mats.contenedor}>
            <boxGeometry args={[1.0, 0.9, 1.0]} />
          </mesh>
          <mesh position={[0, 0.45, 0.51]} material={mats.oscuro}>
            <boxGeometry args={[0.8, 0.6, 0.02]} />
          </mesh>
        </group>
      </PiezaDesarmable>

      {/* Nodo SAP: prisma hexagonal con el cartel, anillo de datos y los pods que orbitan. */}
      <PiezaDesarmable semilla={6}>
        <group position={SAP.toArray()}>
          <group ref={refSap}>
            <mesh material={[mats.sapLado, mats.sapCara, mats.sapLado]}>
              <cylinderGeometry args={[0.55, 0.55, 0.26, 6]} />
            </mesh>
          </group>
          <mesh ref={refAnillo} rotation={[Math.PI / 2.6, 0, 0]} material={mats.anillo}>
            <torusGeometry args={[0.8, 0.012, 8, 64]} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} ref={(nodo) => { refPods.current[i] = nodo; }} material={mats.pod}>
              <boxGeometry args={[0.15, 0.15, 0.15]} />
            </mesh>
          ))}
        </group>
        <Line points={[[xEscaner, 1.45, zEscaner], SAP.toArray()]} color="#6fa8ff" lineWidth={1.5} transparent opacity={0.4} />
      </PiezaDesarmable>

      {/* Cajas con su etiqueta y los códigos que viajan al nodo. */}
      <PiezaDesarmable semilla={7}>
        {Array.from({ length: CAJAS }, (_, i) => (
          <group key={i} ref={(nodo) => { refCajas.current[i] = nodo; }}>
            <mesh material={mats.carton}>
              <boxGeometry args={[TAM_CAJA, TAM_CAJA, TAM_CAJA]} />
            </mesh>
            <mesh position={[0, TAM_CAJA / 2 + 0.002, 0]} material={mats.cintaCaja}>
              <boxGeometry args={[0.07, 0.004, TAM_CAJA]} />
            </mesh>
            <mesh position={[0.07, TAM_CAJA / 2 + 0.004, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} material={mats.etiqueta}>
              <planeGeometry args={[0.2, 0.1]} />
            </mesh>
          </group>
        ))}
        {Array.from({ length: CAJAS }, (_, i) => (
          <mesh key={i} ref={(nodo) => { refCodigos.current[i] = nodo; }} visible={false} material={mats.codigoVuela}>
            <planeGeometry args={[0.7, 0.35]} />
          </mesh>
        ))}
      </PiezaDesarmable>
    </group>
  );
}
