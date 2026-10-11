'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CANTIDAD_LEDS, ledEncendido } from '../../cicloBanco.js';
import { PLACA_REPARACION, ZONAS_REPARACION, capacitoresPlaca, ledsReparacion, resistenciasSMD } from '../../disposicionReparacion.js';

const Y = PLACA_REPARACION.grosor / 2; // cara de arriba de la placa
const COLORES_LED = ['#ff4a4a', '#46f0cd', '#ffcf4a', '#5b8cff'];

// Pines de un integrado: una malla instanciada con `n` patitas a cada lado.
function Pines({ lados, n, ancho, fondo, material }) {
  const malla = useRef(null);
  const total = lados.length * n;
  useLayoutEffect(() => {
    const aux = new THREE.Object3D();
    let k = 0;
    for (const lado of lados) {
      for (let i = 0; i < n; i += 1) {
        const t = (i / (n - 1) - 0.5) * 0.82;
        const [x, z, giro] = {
          norte: [t * ancho, -fondo / 2 - 0.012, 0],
          sur: [t * ancho, fondo / 2 + 0.012, 0],
          oeste: [-ancho / 2 - 0.012, t * fondo, Math.PI / 2],
          este: [ancho / 2 + 0.012, t * fondo, Math.PI / 2],
        }[lado];
        aux.position.set(x, 0.006, z);
        aux.rotation.set(0, giro, 0);
        aux.updateMatrix();
        malla.current.setMatrixAt(k, aux.matrix);
        k += 1;
      }
    }
    malla.current.instanceMatrix.needsUpdate = true;
  }, [lados, n, ancho, fondo]);
  return (
    <instancedMesh ref={malla} args={[undefined, material, total]}>
      <boxGeometry args={[0.012, 0.006, 0.03]} />
    </instancedMesh>
  );
}

// Malla instanciada de cajitas posicionadas en el plano de la placa, con un color
// por instancia (tonos variados para que no se vea una tira idéntica).
function Cajitas({ lista, tamano, material, colores, y }) {
  const malla = useRef(null);
  useLayoutEffect(() => {
    const aux = new THREE.Object3D();
    const c = new THREE.Color();
    lista.forEach((it, i) => {
      aux.position.set(it.x, y, it.z);
      aux.updateMatrix();
      malla.current.setMatrixAt(i, aux.matrix);
      malla.current.setColorAt(i, c.set(colores[i % colores.length]));
    });
    malla.current.instanceMatrix.needsUpdate = true;
    malla.current.instanceColor.needsUpdate = true;
  }, [lista, colores, y]);
  return (
    <instancedMesh ref={malla} args={[undefined, material, lista.length]}>
      <boxGeometry args={tamano} />
    </instancedMesh>
  );
}

function Capacitores({ lista, mats }) {
  const cuerpos = useRef(null);
  const tapas = useRef(null);
  useLayoutEffect(() => {
    const aux = new THREE.Object3D();
    lista.forEach((c, i) => {
      aux.position.set(c.x, Y + c.h / 2, c.z);
      aux.scale.set(c.r, c.h, c.r);
      aux.updateMatrix();
      cuerpos.current.setMatrixAt(i, aux.matrix);
      aux.position.set(c.x, Y + c.h + 0.001, c.z);
      aux.scale.set(c.r * 0.9, 0.004, c.r * 0.9);
      aux.updateMatrix();
      tapas.current.setMatrixAt(i, aux.matrix);
    });
    cuerpos.current.instanceMatrix.needsUpdate = true;
    tapas.current.instanceMatrix.needsUpdate = true;
  }, [lista]);
  return (
    <>
      <instancedMesh ref={cuerpos} args={[undefined, mats.capacitor, lista.length]}>
        <cylinderGeometry args={[1, 1, 1, 20]} />
      </instancedMesh>
      <instancedMesh ref={tapas} args={[undefined, mats.acero, lista.length]}>
        <cylinderGeometry args={[1, 1, 1, 20]} />
      </instancedMesh>
    </>
  );
}

// LEDs de estado: un zócalo y una gotita de color que se prende y se apaga
// (`refLeds.current(t)` repinta los colores; lo llama la escena).
function Leds({ lista, mats, refLeds }) {
  const gotas = useRef(null);
  const apagado = useMemo(() => new THREE.Color('#161a20'), []);
  const colores = useMemo(() => lista.map((_, i) => new THREE.Color(COLORES_LED[i % COLORES_LED.length])), [lista]);
  useLayoutEffect(() => {
    const aux = new THREE.Object3D();
    lista.forEach((led, i) => {
      aux.position.set(led.x, Y + 0.022, led.z);
      aux.updateMatrix();
      gotas.current.setMatrixAt(i, aux.matrix);
      gotas.current.setColorAt(i, apagado);
    });
    gotas.current.instanceMatrix.needsUpdate = true;
    gotas.current.instanceColor.needsUpdate = true;
  }, [lista, apagado]);
  refLeds.current = (t) => {
    for (let i = 0; i < CANTIDAD_LEDS; i += 1) gotas.current.setColorAt(i, ledEncendido(i, t) ? colores[i] : apagado);
    gotas.current.instanceColor.needsUpdate = true;
  };
  return (
    <>
      <Cajitas lista={lista} tamano={[0.07, 0.014, 0.07]} material={mats.plasticoClaro} colores={['#d8d8d2']} y={Y + 0.007} />
      <instancedMesh ref={gotas} args={[undefined, mats.led, lista.length]}>
        <sphereGeometry args={[0.03, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </instancedMesh>
    </>
  );
}

// Placa en reparación, con sus componentes: USB, tres integrados con patitas,
// conector flex, inductor, resistencias, capacitores, LEDs y tornillo.
export default function PlacaReparacion({ mats, refLeds }) {
  const resistencias = useMemo(resistenciasSMD, []);
  const capacitores = useMemo(capacitoresPlaca, []);
  const leds = useMemo(ledsReparacion, []);
  const z = ZONAS_REPARACION;

  return (
    <group>
      <mesh material={mats.placa}>
        <boxGeometry args={[PLACA_REPARACION.ancho, PLACA_REPARACION.grosor, PLACA_REPARACION.fondo]} />
      </mesh>
      {/* Agujeros de fijación con anillo dorado en las esquinas. */}
      {[[-0.72, -0.47], [0.72, -0.47], [-0.72, 0.47], [0.72, 0.47]].map(([x, zz]) => (
        <mesh key={`${x}${zz}`} position={[x, Y + 0.001, zz]} rotation={[-Math.PI / 2, 0, 0]} material={mats.oro}>
          <ringGeometry args={[0.018, 0.04, 20]} />
        </mesh>
      ))}

      {/* Conector USB: caja de acero con la ranura negra y la lengüeta. */}
      <group position={[z.usb.x, Y + 0.05, z.usb.z]}>
        <mesh material={mats.acero}>
          <boxGeometry args={[z.usb.ancho, 0.1, z.usb.fondo]} />
        </mesh>
        <mesh position={[-z.usb.ancho / 2 - 0.001, 0, 0]} material={mats.oscuro}>
          <boxGeometry args={[0.004, 0.07, z.usb.fondo * 0.78]} />
        </mesh>
        <mesh position={[-z.usb.ancho / 2 + 0.01, 0, 0]} material={mats.azulUSB}>
          <boxGeometry args={[0.02, 0.012, z.usb.fondo * 0.6]} />
        </mesh>
      </group>

      {/* Integrado grande, con marca de pin 1, y sus patitas por los cuatro lados. */}
      <group position={[z.chipGrande.x, Y + 0.02, z.chipGrande.z]}>
        <mesh material={mats.chip}>
          <boxGeometry args={[0.34, 0.04, 0.34]} />
        </mesh>
        <mesh position={[-0.12, 0.0215, -0.12]} rotation={[-Math.PI / 2, 0, 0]} material={mats.blanco}>
          <circleGeometry args={[0.014, 12]} />
        </mesh>
        <mesh position={[0.02, 0.0215, 0.03]} rotation={[-Math.PI / 2, 0, 0]} material={mats.marca}>
          <planeGeometry args={[0.18, 0.04]} />
        </mesh>
        <Pines lados={['norte', 'sur', 'oeste', 'este']} n={14} ancho={0.34} fondo={0.34} material={mats.acero} />
      </group>

      {/* Integrado medio con tapa metálica. */}
      <group position={[z.chipMedio.x, Y + 0.018, z.chipMedio.z]}>
        <mesh material={mats.chip}>
          <boxGeometry args={[0.26, 0.036, 0.26]} />
        </mesh>
        <mesh position={[0, 0.0195, 0]} material={mats.acero}>
          <boxGeometry args={[0.16, 0.004, 0.16]} />
        </mesh>
      </group>

      {/* Integrado chico de dos filas de patitas. */}
      <group position={[z.chipChico.x, Y + 0.015, z.chipChico.z]}>
        <mesh material={mats.chip}>
          <boxGeometry args={[0.16, 0.03, 0.16]} />
        </mesh>
        <mesh position={[-0.05, 0.0165, -0.05]} rotation={[-Math.PI / 2, 0, 0]} material={mats.blanco}>
          <circleGeometry args={[0.01, 10]} />
        </mesh>
        <Pines lados={['oeste', 'este']} n={6} ancho={0.16} fondo={0.16} material={mats.acero} />
      </group>

      {/* Conector flex: cuerpo claro, traba negra y contactos dorados. */}
      <group position={[z.flex.x, Y + 0.025, z.flex.z]}>
        <mesh material={mats.plasticoClaro}>
          <boxGeometry args={[0.6, 0.05, 0.085]} />
        </mesh>
        <mesh position={[0, 0.0275, -0.01]} material={mats.oscuro}>
          <boxGeometry args={[0.58, 0.006, 0.045]} />
        </mesh>
        <mesh position={[0, 0.0255, 0.03]} material={mats.oro}>
          <boxGeometry args={[0.56, 0.003, 0.012]} />
        </mesh>
      </group>

      {/* Inductor: núcleo oscuro con bobinado de cobre. */}
      <group position={[z.bobina.x, Y + 0.04, z.bobina.z]}>
        <mesh material={mats.oscuro}>
          <cylinderGeometry args={[0.085, 0.09, 0.08, 24]} />
        </mesh>
        <mesh position={[0, 0.042, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.cobre}>
          <torusGeometry args={[0.055, 0.016, 10, 28]} />
        </mesh>
      </group>

      {/* Tornillo con arandela en su agujero. */}
      <group position={[z.tornillo.x, Y, z.tornillo.z]}>
        <mesh position={[0, 0.006, 0]} material={mats.acero}>
          <cylinderGeometry args={[0.058, 0.058, 0.012, 24]} />
        </mesh>
        <mesh position={[0, 0.022, 0]} material={mats.acero}>
          <cylinderGeometry args={[0.04, 0.04, 0.022, 20]} />
        </mesh>
        <mesh position={[0, 0.034, 0]} material={mats.oscuro}>
          <boxGeometry args={[0.05, 0.004, 0.012]} />
        </mesh>
        <mesh position={[0, 0.034, 0]} material={mats.oscuro}>
          <boxGeometry args={[0.012, 0.004, 0.05]} />
        </mesh>
      </group>

      <Cajitas lista={resistencias} tamano={[0.07, 0.016, 0.035]} material={mats.resistencia} colores={['#1a1c21', '#2a2c33', '#15171b', '#3a3520']} y={Y + 0.008} />
      <Capacitores lista={capacitores} mats={mats} />
      <Leds lista={leds} mats={mats} refLeds={refLeds} />
    </group>
  );
}
