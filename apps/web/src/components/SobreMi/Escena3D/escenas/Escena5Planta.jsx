'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Line } from '@react-three/drei';
import * as THREE from 'three';
import PiezaDesarmable from '../PiezaDesarmable.jsx';
import { crearPantalla } from '../pantallaCanvas.js';
import {
  CAJAS,
  LARGO,
  RUTA,
  S_ESCANER,
  VELOCIDAD,
  distanciaCaja,
  estadoPlanta,
  progresoEscaneo,
  puntoEnRuta,
  tiempoCinta,
} from '../cicloPlanta.js';
import { dibujarCinta, dibujarCodigo, dibujarEtiquetaAmpliada, dibujarPanelSap } from '../texturasPlanta.js';
import { dibujarTablero } from '../dibujarTablero.js';

// Medidas de la planta (marco de la escena: y hacia arriba, x a la derecha, z al frente).
const ALTO_CINTA = 0.45;
const ANCHO_CINTA = 0.7;
const TAM_CAJA = 0.4;
// Cuántas veces se repite la textura de la cinta por unidad de largo.
const REPETICION = 2.5;
// Reloj con movimiento reducido: una foto fija de la secuencia ya completa.
const T_QUIETO = S_ESCANER / VELOCIDAD + 11.5;

const X_ESCANER = RUTA[0][0] + S_ESCANER;
const Z_ESCANER = RUTA[0][1];

// Cámara: la escena se acerca a la caja que está en el escáner (en vez de mover la
// cámara, que ya la maneja el control de giro). `FOCO` es esa caja.
const GIRO = new THREE.Euler(0.62, -0.62, 0);
const ESCALA_BASE = 0.68;
const ESCALA_ZOOM = 1.3;
const POSICION_BASE = new THREE.Vector3(0.25, -0.3, 0);
const FOCO = new THREE.Vector3(X_ESCANER, ALTO_CINTA + TAM_CAJA / 2, Z_ESCANER);
// Dónde queda el foco en pantalla cuando el zoom está al máximo.
const FOCO_EN_PANTALLA = new THREE.Vector3(-0.05, -0.85, 0);
const POSICION_ZOOM = FOCO_EN_PANTALLA.clone().sub(FOCO.clone().multiplyScalar(ESCALA_ZOOM).applyEuler(GIRO));

// Convierte un desplazamiento en pantalla (con el zoom al máximo) a coordenadas de la escena.
const GIRO_INVERSO = new THREE.Quaternion().setFromEuler(GIRO).invert();
const enEscena = (x, y, z = 0) => new THREE.Vector3(x, y, z).applyQuaternion(GIRO_INVERSO).divideScalar(ESCALA_ZOOM).add(FOCO);
const POS_ETIQUETA = enEscena(-1.0, 0.95);
const POS_SAP = enEscena(1.2, 1.85);
const POS_TABLERO = enEscena(1.05, 1.75);
const TAM_ETIQUETA = [1.7, 1.06];
const TAM_SAP = [2.1, 1.31];
const TAM_TABLERO = [2.5, 1.53];
// Dónde está el QR dentro de la etiqueta (a la derecha, un poco arriba del centro).
const POS_QR = enEscena(-1.0 + 0.36, 0.95 + 0.1);

const SEGMENTOS = RUTA.slice(1).map(([x1, z1], i) => {
  const [x0, z0] = RUTA[i];
  return { x0, z0, x1, z1, largo: Math.hypot(x1 - x0, z1 - z0), giro: i === 0 ? 0 : Math.PI / 2 };
});

const suavizar = (f) => f * f * (3 - 2 * f);
const aux = new THREE.Vector3();

// Tramo de cinta: marco de acero, la banda con ranuras que se mueve y luces de borde.
function Cinta({ segmento, textura, mats }) {
  const { x0, z0, x1, z1, largo, giro } = segmento;
  const largoTotal = largo + ANCHO_CINTA;
  return (
    <group position={[(x0 + x1) / 2, 0, (z0 + z1) / 2]} rotation={[0, giro, 0]}>
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
      <mesh position={[0, ALTO_CINTA - 0.065, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[largoTotal - 0.04, ANCHO_CINTA - 0.04]} />
        <meshStandardMaterial map={textura} roughness={0.8} />
      </mesh>
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
    const etiquetaAmpliada = crear(1024, 640, (ctx, w, h) => dibujarEtiquetaAmpliada(ctx, w, h));
    const panelSap = crear(1280, 800, (ctx, w, h) => dibujarPanelSap(ctx, w, h));
    const tablero = crear(1400, 860, (ctx, w, h) => dibujarTablero(ctx, w, h));
    const codigo = crear(512, 256, dibujarCodigo).textura;
    const std = (opciones) => new THREE.MeshStandardMaterial(opciones);
    const mats = {
      acero: std({ color: claro ? '#8a96ab' : '#3a4458', metalness: 0.6, roughness: 0.45 }),
      oscuro: std({ color: '#161a23', roughness: 0.7 }),
      luz: new THREE.MeshBasicMaterial({ color: '#5aa2ff', toneMapped: false }),
      carton: std({ color: '#c79a62', roughness: 0.8 }),
      cintaCaja: std({ color: '#efe9d6', roughness: 0.6 }),
      etiquetaCaja: new THREE.MeshBasicMaterial({ map: codigo, toneMapped: false }),
      etiquetaAmpliada: new THREE.MeshBasicMaterial({ map: etiquetaAmpliada.textura, transparent: true, depthWrite: false, depthTest: false, toneMapped: false }),
      panelSap: new THREE.MeshBasicMaterial({ map: panelSap.textura, transparent: true, depthWrite: false, depthTest: false, toneMapped: false }),
      tablero: new THREE.MeshBasicMaterial({ map: tablero.textura, transparent: true, depthWrite: false, depthTest: false, toneMapped: false }),
      dato: new THREE.MeshBasicMaterial({ color: '#3de0c0', depthTest: false, toneMapped: false }),
      marco: new THREE.LineBasicMaterial({ color: '#6fa8ff', transparent: true, opacity: 0 }),
      laser: new THREE.MeshBasicMaterial({
        color: '#7fb4ff',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
      contenedor: std({ color: '#1f6bff', metalness: 0.2, roughness: 0.55 }),
      ventana: new THREE.MeshBasicMaterial({ color: '#0b1220', toneMapped: false }),
    };
    return {
      texturas,
      mats,
      etiquetaAmpliada,
      panelSap,
      tablero,
      cintas: SEGMENTOS.map((s) => cinta(s.largo)),
      marcoCaja: new THREE.EdgesGeometry(new THREE.BoxGeometry(TAM_CAJA * 1.18, TAM_CAJA * 1.18, TAM_CAJA * 1.18)),
    };
  }, [claro]);
  const { mats, cintas, etiquetaAmpliada, panelSap, tablero, marcoCaja } = recursos;

  const tiempo = useRef(reducido ? T_QUIETO : 0);
  const refEscena = useRef(null);
  const refCajas = useRef([]);
  const refLaser = useRef(null);
  const refEtiqueta = useRef(null);
  const refSap = useRef(null);
  const refTablero = useRef(null);
  const refConexion = useRef(null);
  const refDatos = useRef([]);
  const claves = useRef({ etiqueta: '', sap: '', tablero: '' });

  useEffect(
    () => () => {
      recursos.texturas.forEach((t) => t.dispose());
      Object.values(recursos.mats).forEach((m) => m.dispose());
      recursos.marcoCaja.dispose();
    },
    [recursos]
  );

  useFrame((_, delta) => {
    if (!activa) return;
    if (!reducido) tiempo.current += Math.min(delta, 0.05);
    const t = tiempo.current;
    const estado = estadoPlanta(t);

    // Zoom: la escena crece y se corre para dejar la caja del escáner al centro.
    const z = estado.zoom;
    const grupo = refEscena.current;
    grupo.scale.setScalar(ESCALA_BASE + (ESCALA_ZOOM - ESCALA_BASE) * z);
    grupo.position.lerpVectors(POSICION_BASE, POSICION_ZOOM, z);

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
    }
    mats.laser.opacity = Math.max(laser, estado.escaneo > 0 && estado.escaneo < 1 ? 0.9 : 0) * 0.85;
    if (refLaser.current) refLaser.current.scale.y = 0.4 + 0.6 * mats.laser.opacity;
    // Marco azul alrededor de la caja que se analiza.
    mats.marco.opacity = estado.etiqueta;

    // Etiqueta ampliada: aparece junto a la caja y se redibuja sólo si cambió algo.
    const claveEtiqueta = `${estado.etiqueta > 0}|${Math.round(estado.escaneo * 60)}|${Math.round(estado.lectura * 30)}`;
    if (claveEtiqueta !== claves.current.etiqueta) {
      claves.current.etiqueta = claveEtiqueta;
      dibujarEtiquetaAmpliada(etiquetaAmpliada.ctx, etiquetaAmpliada.ancho, etiquetaAmpliada.alto, estado);
      etiquetaAmpliada.textura.needsUpdate = true;
    }
    mats.etiquetaAmpliada.opacity = estado.etiqueta;
    refEtiqueta.current.visible = estado.etiqueta > 0.01;
    refEtiqueta.current.scale.setScalar(0.85 + 0.15 * estado.etiqueta);

    // Panel de SAP.
    const claveSap = `${estado.sap > 0}|${Math.round(estado.registro * 40)}`;
    if (claveSap !== claves.current.sap) {
      claves.current.sap = claveSap;
      dibujarPanelSap(panelSap.ctx, panelSap.ancho, panelSap.alto, estado);
      panelSap.textura.needsUpdate = true;
    }
    mats.panelSap.opacity = estado.sap;
    refSap.current.visible = estado.sap > 0.01;
    refSap.current.scale.setScalar(0.85 + 0.15 * estado.sap);

    // Tablero de trazabilidad: se arma widget por widget.
    const claveTablero = `${estado.tablero > 0}|${Math.round(estado.construccion * 90)}`;
    if (claveTablero !== claves.current.tablero) {
      claves.current.tablero = claveTablero;
      dibujarTablero(tablero.ctx, tablero.ancho, tablero.alto, estado);
      tablero.textura.needsUpdate = true;
    }
    mats.tablero.opacity = estado.tablero;
    refTablero.current.visible = estado.tablero > 0.01;
    refTablero.current.scale.setScalar(0.88 + 0.12 * estado.tablero);

    // Dato: sale del QR y sube al panel de SAP, con una estela de puntos.
    refDatos.current.forEach((punto, k) => {
      const f = Math.min(1, Math.max(0, estado.subida * 1.25 - k * 0.1));
      const visible = f > 0 && f < 1;
      punto.visible = visible;
      if (!visible) return;
      aux.lerpVectors(POS_QR, POS_SAP, suavizar(f));
      aux.y += Math.sin(Math.PI * f) * 0.35;
      punto.position.copy(aux);
      punto.scale.setScalar((1 - k * 0.18) * (1 - 0.4 * f));
    });
    if (refConexion.current) refConexion.current.material.opacity = estado.etiqueta * 0.45;

    // La banda parece avanzar: la textura se desplaza a la velocidad de las cajas.
    const desplazamiento = -((tiempoCinta(t) * VELOCIDAD * REPETICION) % 1);
    cintas.forEach((textura) => {
      textura.offset.x = desplazamiento;
    });
  });

  return (
    // `key` por variante: al cambiar de tema se recrean materiales y texturas.
    <group ref={refEscena} key={claro ? 'claro' : 'oscuro'} position={POSICION_BASE.toArray()} rotation={[GIRO.x, GIRO.y, GIRO.z]} scale={ESCALA_BASE}>
      <directionalLight position={[3, 6, 4]} intensity={claro ? 2.2 : 1.5} color="#ffffff" />

      {/* Cintas transportadoras. */}
      <PiezaDesarmable semilla={2}>
        <Cinta segmento={SEGMENTOS[0]} textura={cintas[0]} mats={mats} />
      </PiezaDesarmable>
      <PiezaDesarmable semilla={3}>
        <Cinta segmento={SEGMENTOS[1]} textura={cintas[1]} mats={mats} />
      </PiezaDesarmable>

      {/* Escáner: pórtico sobre la cinta, con un lector y el láser que destella. */}
      <PiezaDesarmable semilla={4}>
        <group position={[X_ESCANER, 0, Z_ESCANER]}>
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

      {/* Contenedor de salida. */}
      <PiezaDesarmable semilla={5}>
        <group position={[RUTA.at(-1)[0], 0, RUTA.at(-1)[1] - 0.8]}>
          <mesh position={[0, 0.45, 0]} material={mats.contenedor}>
            <boxGeometry args={[1.0, 0.9, 1.0]} />
          </mesh>
          <mesh position={[0, 0.45, 0.51]} material={mats.ventana}>
            <boxGeometry args={[0.8, 0.6, 0.02]} />
          </mesh>
        </group>
      </PiezaDesarmable>

      {/* Cajas: cada una con su etiqueta; la que está en el escáner se marca con un recuadro. */}
      <PiezaDesarmable semilla={6}>
        {Array.from({ length: CAJAS }, (_, i) => (
          <group key={i} ref={(nodo) => { refCajas.current[i] = nodo; }}>
            <mesh material={mats.carton}>
              <boxGeometry args={[TAM_CAJA, TAM_CAJA, TAM_CAJA]} />
            </mesh>
            <mesh position={[0, TAM_CAJA / 2 + 0.002, 0]} material={mats.cintaCaja}>
              <boxGeometry args={[0.07, 0.004, TAM_CAJA]} />
            </mesh>
            <mesh position={[0.07, TAM_CAJA / 2 + 0.004, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} material={mats.etiquetaCaja}>
              <planeGeometry args={[0.2, 0.1]} />
            </mesh>
            {i === 0 ? <lineSegments geometry={marcoCaja} material={mats.marco} /> : null}
          </group>
        ))}
      </PiezaDesarmable>

      {/* Etiqueta ampliada, panel de SAP y el dato que sube de uno al otro. */}
      <PiezaDesarmable semilla={7}>
        <group position={POS_ETIQUETA.toArray()}>
          <Billboard>
            <group ref={refEtiqueta} visible={false}>
              <mesh material={mats.etiquetaAmpliada} renderOrder={10}>
                <planeGeometry args={TAM_ETIQUETA.map((v) => v / ESCALA_ZOOM)} />
              </mesh>
            </group>
          </Billboard>
        </group>
        <group position={POS_SAP.toArray()}>
          <Billboard>
            <group ref={refSap} visible={false}>
              <mesh material={mats.panelSap} renderOrder={11}>
                <planeGeometry args={TAM_SAP.map((v) => v / ESCALA_ZOOM)} />
              </mesh>
            </group>
          </Billboard>
        </group>
        <group position={POS_TABLERO.toArray()}>
          <Billboard>
            <group ref={refTablero} visible={false}>
              <mesh material={mats.tablero} renderOrder={11}>
                <planeGeometry args={TAM_TABLERO.map((v) => v / ESCALA_ZOOM)} />
              </mesh>
            </group>
          </Billboard>
        </group>
        <Line ref={refConexion} points={[FOCO.toArray(), POS_ETIQUETA.toArray()]} color="#6fa8ff" lineWidth={1.5} transparent opacity={0} />
        {[0, 1, 2, 3].map((k) => (
          <mesh key={k} ref={(nodo) => { refDatos.current[k] = nodo; }} visible={false} material={mats.dato} renderOrder={12}>
            <sphereGeometry args={[0.05, 12, 12]} />
          </mesh>
        ))}
      </PiezaDesarmable>
    </group>
  );
}
