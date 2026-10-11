'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import PiezaDesarmable from '../PiezaDesarmable.jsx';
import { crearPantalla } from '../pantallaCanvas.js';
import { dibujarPantalla } from '../dibujarPantalla.js';
import {
  DURACION_APERTURA,
  DURACION_TOTAL,
  RETRASO_PANTALLA,
  estadoPantalla,
  factorLuzPantalla,
  progresoApertura,
} from '../pantallaNotebook.js';
import { separarPiezas } from './modelos.js';
import { BASE, BISAGRA, RELACION_PANTALLA, TAPA, agregarManzana, crearManzana, materialManzana, prepararPantalla } from './macbook.js';

const RUTA = '/modelos/macbook.glb';
const ANCHO = 2.9;
const PIXELES_ANCHO = 1280;
// Cuánto se levanta la tapa del teclado mientras está cerrada (unidades del
// modelo) para no atravesar las teclas.
const ALTURA_TAPA_CERRADA = 0.5;
// Intensidad de la luz que sale de la pantalla cuando está a pleno.
const LUZ_PANTALLA = 40;

// La tapa se abre sólo la primera vez que aparece la escena en toda la sesión;
// después (por ejemplo al volver de otro hito) ya aparece abierta.
let yaSeAbrio = false;

// Las piezas que se desarman: la tapa entera (con la pantalla) y cada pieza de la base.
function elegirPiezas(raiz) {
  const base = raiz.getObjectByName(BASE);
  const tapa = raiz.getObjectByName(TAPA);
  return [tapa, ...base.children].filter(Boolean);
}

export default function Escena0Notebook({ activa, reducido, claro = false }) {
  const { scene } = useGLTF(RUTA);
  const manzana = useMemo(() => crearManzana(), []);
  const modelo = useMemo(() => {
    const separado = separarPiezas(scene, { anchoObjetivo: ANCHO, elegirPiezas });
    const tapa = separado.piezas.find(({ objeto }) => objeto.name === TAPA).objeto;
    const pantalla = prepararPantalla(tapa);
    agregarManzana(tapa, pantalla, materialManzana(manzana.textura));
    // La bisagra marca el eje de giro de la tapa.
    const bisagra = new THREE.Box3().setFromObject(tapa.getObjectByName(BISAGRA)).getCenter(new THREE.Vector3());
    // Ángulo con que la tapa queda apoyada sobre el teclado: el que lleva el
    // centro de la pantalla a la horizontal, hacia el frente, desde la bisagra.
    const v = pantalla.centroPantalla.clone().sub(bisagra);
    return { ...separado, ...pantalla, tapa, bisagra, anguloCerrada: Math.atan2(v.y, v.z) };
  }, [scene, manzana]);

  const pantallaCanvas = useMemo(() => crearPantalla(PIXELES_ANCHO, Math.round(PIXELES_ANCHO / RELACION_PANTALLA)), []);
  const materialPantalla = useMemo(
    () => new THREE.MeshBasicMaterial({ map: pantallaCanvas.textura, toneMapped: false }),
    [pantallaCanvas]
  );
  const objetivoLuz = useMemo(() => new THREE.Object3D(), []);

  const refTapa = useRef(null);
  const refLuz = useRef(null);
  const ultimaClave = useRef('');
  const yaMarcada = useRef(false);

  // Reloj de la escena. Con movimiento reducido todo aparece ya en su estado
  // final; si la tapa ya se abrió antes, arranca abierta (y la pantalla, apagada).
  const tiempoInicial = reducido ? DURACION_TOTAL + RETRASO_PANTALLA + 5 : yaSeAbrio ? DURACION_APERTURA : 0;
  const tiempo = useRef(tiempoInicial);
  const aperturaInicial = useRef(progresoApertura(tiempoInicial)).current;

  useEffect(() => {
    modelo.panel.material = materialPantalla;
    return () => {
      pantallaCanvas.textura.dispose();
      manzana.textura.dispose();
      materialPantalla.dispose();
    };
  }, [modelo, materialPantalla, pantallaCanvas, manzana]);

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
    refTapa.current.rotation.x = modelo.anguloCerrada * (1 - apertura);
    refTapa.current.position.y = ALTURA_TAPA_CERRADA * (1 - apertura);

    // La pantalla arranca un poco después de empezar a abrir la tapa.
    const estado = estadoPantalla(t - RETRASO_PANTALLA);
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
      dibujarPantalla(pantallaCanvas.ctx, pantallaCanvas.ancho, pantallaCanvas.alto, estado);
      pantallaCanvas.textura.needsUpdate = true;
    }
  });

  const { escala, centro, piezas, bisagra, tapa, normal, centroPantalla, anguloCerrada } = modelo;
  // Luz y su blanco, en el espacio del modelo y relativos a la bisagra (van
  // dentro del grupo que gira con la tapa).
  const desdeBisagra = centroPantalla.clone().sub(bisagra);
  const posicionLuz = desdeBisagra.clone().addScaledVector(normal, 1).toArray();
  const posicionBlanco = desdeBisagra.clone().addScaledVector(normal, 12).toArray();

  return (
    <group position={[0, 0.1, 0]} rotation={[0, -0.5, 0]}>
      {/* La luz azul del sitio tiñe los blancos: en la variante clara se suma una luz neutra. */}
      {claro ? <directionalLight position={[3, 5, 4]} intensity={2.4} color="#ffffff" /> : null}
      <directionalLight position={[-3, 4, 5]} intensity={0.9} color="#ffffff" />
      {piezas.map(({ objeto, centro: c }, i) => (
        <PiezaDesarmable key={objeto.uuid} centro={c} semilla={i + 1}>
          <group scale={escala} position={[-centro.x * escala, -centro.y * escala, -centro.z * escala]}>
            {objeto === tapa ? (
              <group position={bisagra.toArray()}>
                <group
                  ref={refTapa}
                  rotation={[anguloCerrada * (1 - aperturaInicial), 0, 0]}
                  position={[0, ALTURA_TAPA_CERRADA * (1 - aperturaInicial), 0]}
                >
                  <group position={[-bisagra.x, -bisagra.y, -bisagra.z]}>
                    <primitive object={objeto} />
                  </group>
                  <spotLight
                    ref={refLuz}
                    position={posicionLuz}
                    target={objetivoLuz}
                    angle={0.95}
                    penumbra={1}
                    distance={10}
                    decay={1.3}
                    color="#7fa6ff"
                    intensity={0}
                  />
                  <primitive object={objetivoLuz} position={posicionBlanco} />
                </group>
              </group>
            ) : (
              <primitive object={objeto} />
            )}
          </group>
        </PiezaDesarmable>
      ))}
    </group>
  );
}
