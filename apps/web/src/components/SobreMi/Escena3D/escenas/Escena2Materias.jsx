'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import PiezaDesarmable from '../PiezaDesarmable.jsx';
import { crearPantalla } from '../pantallaCanvas.js';
import { MATERIAS, T_FIN_TILDES, brilloTarjeta, escalaTilde, progresoSello, progresoTilde } from '../cicloMaterias.js';
import {
  BARRA,
  CASILLA,
  dibujarBarraLlena,
  dibujarBaseSello,
  dibujarHaloTarjeta,
  dibujarRellenoCasilla,
  dibujarResplandor,
  dibujarTarjeta,
  dibujarTilde,
} from '../texturasMaterias.js';

const COLUMNAS = 4;
const FILAS = 3;
const ANCHO_T = 1.12;
const ALTO_T = 0.66;
const HUECO = 0.13;
const GROSOR_T = 0.05;
const DIENTES = 44;
const RADIO_SELLO = 0.5;
// Orden de dibujo de las capas transparentes de cada tarjeta. Three las ordena por
// la distancia al centro de cada objeto, y la casilla (a la izquierda del centro)
// puede quedar "más lejos" que el frente según el ángulo de la cámara: sin un
// orden explícito el frente la tapaba. Menor se dibuja antes.
const ORDEN = { halo: 0, frente: 1, relleno: 2, barra: 2, tilde: 3, resplandor: 5 };

// Altura del escudo sobre el disco del sello (su ancho sale de la proporción de la imagen).
const ALTO_ESCUDO = 0.7;
const PROPORCION_ESCUDO = 1181 / 1483;

const acotar = (x) => Math.min(1, Math.max(0, x));

function posicionTarjeta(i) {
  const fila = Math.floor(i / COLUMNAS);
  const columna = i % COLUMNAS;
  return [(columna - (COLUMNAS - 1) / 2) * (ANCHO_T + HUECO), ((FILAS - 1) / 2 - fila) * (ALTO_T + HUECO), 0];
}

// Plano anclado por su borde izquierdo: escalándolo en x y recortando la textura
// (`repeat.x`) por el mismo factor se "revela" el dibujo de izquierda a derecha
// sin deformarlo.
function geometriaDeRevelado() {
  const g = new THREE.PlaneGeometry(1, 1);
  g.translate(0.5, 0, 0);
  return g;
}

// Borde dentado del sello: cuñas repartidas en círculo, en una malla instanciada.
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

export default function Escena2Materias({ activa, reducido, claro = false }) {
  // El escudo de Cambridge es una imagen PNG con transparencia (la escena espera
  // a que cargue; ver el <Suspense> de EscenaCanvas).
  const escudo = useLoader(THREE.TextureLoader, '/cambridge-escudo.png');

  const recursos = useMemo(() => {
    const texturas = [];
    const crear = (ancho, alto, dibujar) => {
      const l = crearPantalla(ancho, alto);
      dibujar(l.ctx, ancho, alto);
      l.textura.needsUpdate = true;
      texturas.push(l.textura);
      return l.textura;
    };
    const clonar = (textura) => {
      const c = textura.clone();
      c.needsUpdate = true;
      texturas.push(c);
      return c;
    };

    const ancho = 1024;
    const alto = Math.round((ancho * ALTO_T) / ANCHO_T);
    const rellenoTex = crear(256, 256, dibujarRellenoCasilla);
    const tildeTex = crear(256, 256, dibujarTilde);
    const barraTex = crear(512, 48, dibujarBarraLlena);
    const haloTex = crear(512, Math.round((512 * ALTO_T) / ANCHO_T), dibujarHaloTarjeta);

    const cuerpo = new THREE.MeshStandardMaterial({ color: '#0a1020', metalness: 0.55, roughness: 0.38 });
    const relleno = new THREE.MeshBasicMaterial({ map: rellenoTex, transparent: true, depthWrite: false, toneMapped: false });

    const tarjetas = MATERIAS.map((nombre, i) => {
      const frente = new THREE.MeshStandardMaterial({
        // Las tarjetas son siempre de vidrio oscuro: en tema claro las blancas se perdían contra
        // el fondo claro, con su texto.
        map: crear(ancho, alto, (ctx, w, h) => dibujarTarjeta(ctx, w, h, nombre, i, false)),
        transparent: true,
        roughness: 0.42,
        metalness: 0.15,
      });
      const tildeMapa = clonar(tildeTex);
      const barraMapa = clonar(barraTex);
      return {
        frente,
        tilde: new THREE.MeshBasicMaterial({ map: tildeMapa, transparent: true, depthWrite: false, toneMapped: false }),
        tildeMapa,
        barra: new THREE.MeshBasicMaterial({ map: barraMapa, transparent: true, depthWrite: false, toneMapped: false }),
        barraMapa,
        halo: new THREE.MeshBasicMaterial({
          map: haloTex,
          color: '#46f0cd',
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      };
    });

    const resplandor = new THREE.MeshBasicMaterial({
      map: crear(256, 256, dibujarResplandor),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    // Oro del escudo (con un poco de emisión: sin entorno de reflejos un metal puro se vería negro).
    const metal = new THREE.MeshStandardMaterial({ color: '#f2c230', metalness: 0.7, roughness: 0.32, emissive: '#9a6f00', emissiveIntensity: 0.5 });
    const oroBrillante = new THREE.MeshStandardMaterial({ color: '#ffd84d', metalness: 0.5, roughness: 0.25, emissive: '#ffb400', emissiveIntensity: 0.9 });
    const baseSello = new THREE.MeshStandardMaterial({ map: crear(512, 512, dibujarBaseSello), roughness: 0.42, metalness: 0.35 });
    const dorso = new THREE.MeshStandardMaterial({ color: '#7a0d14', metalness: 0.4, roughness: 0.45 });

    escudo.colorSpace = THREE.SRGBColorSpace;
    escudo.anisotropy = 8;
    const materialEscudo = new THREE.MeshStandardMaterial({
      map: escudo,
      transparent: true,
      alphaTest: 0.02,
      roughness: 0.5,
      metalness: 0.1,
      emissiveMap: escudo,
      emissive: '#ffffff',
      emissiveIntensity: 0.3,
    });

    return {
      texturas,
      cuerpo,
      relleno,
      tarjetas,
      resplandor,
      metal,
      oroBrillante,
      baseSello,
      dorso,
      materialEscudo,
      geometriaRevelado: geometriaDeRevelado(),
    };
  }, [escudo, claro]);

  const tiempo = useRef(reducido ? T_FIN_TILDES + 20 : 0);
  const refsTarjeta = useRef([]);
  const refsRelleno = useRef([]);
  const refsTilde = useRef([]);
  const refsBarra = useRef([]);
  const refSello = useRef(null);
  const refResplandor = useRef(null);
  const refLuz = useRef(null);

  useEffect(
    () => () => {
      recursos.texturas.forEach((t) => t.dispose());
      recursos.tarjetas.forEach((t) => [t.frente, t.tilde, t.barra, t.halo].forEach((m) => m.dispose()));
      [recursos.cuerpo, recursos.relleno, recursos.resplandor, recursos.metal, recursos.oroBrillante, recursos.baseSello, recursos.dorso, recursos.materialEscudo].forEach((m) => m.dispose());
      recursos.geometriaRevelado.dispose();
      // El escudo lo cachea `useLoader` y se reutiliza si la escena vuelve a montarse: no se libera acá.
    },
    [recursos]
  );

  const ladoCasilla = CASILLA.lado * ALTO_T;
  const tamanoRelleno = ladoCasilla / 0.62;
  const xCasilla = (CASILLA.x - 0.5) * ANCHO_T;
  const anchoBarra = (BARRA.x1 - BARRA.x0) * ANCHO_T;
  const altoBarra = BARRA.alto * ALTO_T;
  const xBarra = (BARRA.x0 - 0.5) * ANCHO_T;
  const yBarra = (0.5 - BARRA.y) * ALTO_T;

  useFrame((_, delta) => {
    if (!activa) return;
    if (!reducido) tiempo.current += Math.min(delta, 0.05);
    const t = tiempo.current;

    for (let i = 0; i < MATERIAS.length; i += 1) {
      const p = progresoTilde(i, t);
      const mats = recursos.tarjetas[i];
      mats.halo.opacity = 0.85 * brilloTarjeta(p);

      // La casilla se llena (salta un poco), luego se dibuja la tilde y la barra se llena.
      const relleno = refsRelleno.current[i];
      if (relleno) {
        const pr = acotar(p / 0.55);
        relleno.visible = pr > 0;
        relleno.scale.setScalar(Math.max(0.0001, escalaTilde(pr)) * tamanoRelleno);
      }
      const pt = acotar((p - 0.35) / 0.65);
      const tilde = refsTilde.current[i];
      if (tilde) {
        tilde.visible = pt > 0;
        tilde.scale.set(Math.max(0.0001, pt) * ladoCasilla * 0.95, ladoCasilla * 0.95, 1);
        mats.tildeMapa.repeat.x = Math.max(0.0001, pt);
      }
      const barra = refsBarra.current[i];
      if (barra) {
        barra.visible = p > 0;
        barra.scale.set(Math.max(0.0001, p) * anchoBarra, altoBarra, 1);
        mats.barraMapa.repeat.x = Math.max(0.0001, p);
      }

      // Las tarjetas flotan apenas, cada una en su fase.
      const tarjeta = refsTarjeta.current[i];
      if (tarjeta) tarjeta.position.z = reducido ? 0 : Math.sin(t * 1.1 + i * 0.9) * 0.025;
    }

    const sello = progresoSello(t);
    if (refSello.current) {
      refSello.current.visible = sello > 0.001;
      refSello.current.scale.setScalar(Math.max(0.001, sello));
      // Entra con un giro corto (nunca de espaldas) y se asienta de frente, con un vaivén lento.
      refSello.current.rotation.y = -(1 - sello) * 1.1 + (reducido ? 0 : Math.sin(t * 0.7) * 0.2);
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
    // `key` por variante: al cambiar de tema se recrean los materiales de las tarjetas.
    <group key={claro ? 'claro' : 'oscuro'} rotation={[0.1, -0.22, 0]} scale={0.8}>
      {/* La luz azul del sitio tiñe los blancos: en la variante clara se suma una luz neutra. */}
      {claro ? <directionalLight position={[2, 4, 6]} intensity={1.8} color="#ffffff" /> : null}
      {MATERIAS.map((nombre, i) => (
        <PiezaDesarmable key={nombre} posicion={posicionTarjeta(i)} semilla={i + 1}>
          <group ref={(g) => { refsTarjeta.current[i] = g; }}>
            {/* Halo luminoso detrás: se enciende al tildarse. */}
            <mesh position={[0, 0, -GROSOR_T / 2 - 0.01]} material={recursos.tarjetas[i].halo} renderOrder={ORDEN.halo}>
              <planeGeometry args={[ANCHO_T * 1.22, ALTO_T * 1.22]} />
            </mesh>
            <RoundedBox args={[ANCHO_T, ALTO_T, GROSOR_T]} radius={0.065} smoothness={4} material={recursos.cuerpo} />
            <mesh position={[0, 0, GROSOR_T / 2 + 0.002]} material={recursos.tarjetas[i].frente} renderOrder={ORDEN.frente}>
              <planeGeometry args={[ANCHO_T, ALTO_T]} />
            </mesh>
            <mesh
              ref={(m) => { refsRelleno.current[i] = m; }}
              position={[xCasilla, 0, GROSOR_T / 2 + 0.006]}
              material={recursos.relleno}
              renderOrder={ORDEN.relleno}
              visible={false}
            >
              <planeGeometry args={[1, 1]} />
            </mesh>
            <mesh
              ref={(m) => { refsTilde.current[i] = m; }}
              position={[xCasilla - (ladoCasilla * 0.95) / 2, 0, GROSOR_T / 2 + 0.01]}
              geometry={recursos.geometriaRevelado}
              material={recursos.tarjetas[i].tilde}
              renderOrder={ORDEN.tilde}
              visible={false}
            />
            <mesh
              ref={(m) => { refsBarra.current[i] = m; }}
              position={[xBarra, yBarra, GROSOR_T / 2 + 0.006]}
              geometry={recursos.geometriaRevelado}
              material={recursos.tarjetas[i].barra}
              renderOrder={ORDEN.barra}
              visible={false}
            />
          </group>
        </PiezaDesarmable>
      ))}

      {/* Sello de Cambridge con su escudo: aparece cuando todas las materias están tildadas. */}
      <PiezaDesarmable posicion={[0, 0, 0.55]} semilla={20}>
        <mesh ref={refResplandor} position={[0, 0, -0.08]} material={recursos.resplandor} renderOrder={ORDEN.resplandor} visible={false}>
          <planeGeometry args={[3.2, 3.2]} />
        </mesh>
        <group ref={refSello} visible={false}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={[recursos.metal, recursos.baseSello, recursos.dorso]}>
            <cylinderGeometry args={[RADIO_SELLO, RADIO_SELLO, 0.07, 64]} />
          </mesh>
          <mesh material={recursos.oroBrillante}>
            <torusGeometry args={[RADIO_SELLO, 0.03, 14, 72]} />
          </mesh>
          <mesh material={recursos.oroBrillante}>
            <torusGeometry args={[RADIO_SELLO * 0.66, 0.008, 8, 64]} />
          </mesh>
          <Dientes material={recursos.metal} />
          <mesh position={[0, 0, 0.044]} material={recursos.materialEscudo}>
            <planeGeometry args={[ALTO_ESCUDO * PROPORCION_ESCUDO, ALTO_ESCUDO]} />
          </mesh>
        </group>
        {/* Fuera del sello (que se oculta): una luz oculta cambiaría la cuenta de luces del
            mundo y obligaría a recompilar todos los shaders. */}
        <pointLight ref={refLuz} position={[0, 0, 1.2]} color="#ffcf80" intensity={0} distance={7} />
      </PiezaDesarmable>
    </group>
  );
}
