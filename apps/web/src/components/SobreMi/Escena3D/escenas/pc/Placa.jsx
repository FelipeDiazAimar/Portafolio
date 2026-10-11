'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { PLACA, ZONAS, RANURAS_DIMM, condensadores, tornillos } from '../../disposicionPlaca.js';
import { azulEmisivo, cianEmisivo } from '../../materiales.js';
import { PilaAletas, Tornillo } from './Piezas.jsx';

// La cara con componentes de la placa está en z = Z0.
const Z0 = PLACA.grosor / 2;

// Condensadores sólidos: cuerpo cilíndrico oscuro y tapa de acero, ambos como
// mallas instanciadas (una llamada de dibujo cada una).
function Condensadores({ materiales }) {
  const cuerpos = useRef(null);
  const tapas = useRef(null);
  const lista = useMemo(condensadores, []);
  useLayoutEffect(() => {
    const aux = new THREE.Object3D();
    lista.forEach((c, i) => {
      aux.rotation.set(Math.PI / 2, 0, 0);
      aux.position.set(c.x, c.y, Z0 + c.h / 2);
      aux.scale.set(c.r, c.h, c.r);
      aux.updateMatrix();
      cuerpos.current.setMatrixAt(i, aux.matrix);
      aux.position.set(c.x, c.y, Z0 + c.h + 0.002);
      aux.scale.set(c.r * 0.88, 0.006, c.r * 0.88);
      aux.updateMatrix();
      tapas.current.setMatrixAt(i, aux.matrix);
    });
    cuerpos.current.instanceMatrix.needsUpdate = true;
    tapas.current.instanceMatrix.needsUpdate = true;
  }, [lista]);
  return (
    <>
      <instancedMesh ref={cuerpos} args={[undefined, materiales.condensador, lista.length]}>
        <cylinderGeometry args={[1, 1, 1, 20]} />
      </instancedMesh>
      <instancedMesh ref={tapas} args={[undefined, materiales.acero, lista.length]}>
        <cylinderGeometry args={[1, 1, 1, 20]} />
      </instancedMesh>
    </>
  );
}

function Tornillos({ materiales }) {
  return tornillos().map((t, i) => <Tornillo key={i} posicion={[t.x, t.y, Z0 + 0.01]} materiales={materiales} />);
}

// Panel de entradas (I/O): chapa de aluminio con los conectores traseros.
function PanelEntradas({ materiales }) {
  const z = ZONAS.io;
  const xCara = z.cx - z.ancho / 2;
  const altoCuerpo = 0.3;
  const puerto = (key, y, zc, ancho, alto, material, hueco = true) => (
    <group key={key} position={[xCara - 0.03, y, zc]}>
      <mesh material={material}>
        <boxGeometry args={[0.06, ancho, alto]} />
      </mesh>
      {hueco ? (
        <mesh position={[-0.032, 0, 0]} material={materiales.plasticoNegro}>
          <boxGeometry args={[0.006, ancho * 0.78, alto * 0.62]} />
        </mesh>
      ) : null}
    </group>
  );
  return (
    <group>
      <mesh position={[z.cx, z.cy, Z0 + altoCuerpo / 2]} material={materiales.aluminio}>
        <boxGeometry args={[z.ancho, z.alto, altoCuerpo]} />
      </mesh>
      {/* Dos Ethernet, cuatro USB azules y dos negros, HDMI y tres jacks de audio. */}
      {puerto('eth1', z.cy + 0.5, Z0 + 0.19, 0.2, 0.14, materiales.acero)}
      {puerto('eth2', z.cy + 0.27, Z0 + 0.19, 0.2, 0.14, materiales.acero)}
      {puerto('usb1', z.cy + 0.5, Z0 + 0.06, 0.14, 0.07, materiales.azulUSB)}
      {puerto('usb2', z.cy + 0.33, Z0 + 0.06, 0.14, 0.07, materiales.azulUSB)}
      {puerto('usb3', z.cy + 0.16, Z0 + 0.06, 0.14, 0.07, materiales.azulUSB)}
      {puerto('usb4', z.cy, Z0 + 0.06, 0.14, 0.07, materiales.azulUSB)}
      {puerto('usb5', z.cy - 0.17, Z0 + 0.06, 0.14, 0.07, materiales.plasticoNegro)}
      {puerto('usb6', z.cy - 0.34, Z0 + 0.06, 0.14, 0.07, materiales.plasticoNegro)}
      {puerto('hdmi', z.cy - 0.1, Z0 + 0.19, 0.2, 0.08, materiales.plasticoNegro)}
      {[0.47, 0.57, 0.67].map((dy, i) => (
        <mesh
          key={`audio${i}`}
          position={[xCara - 0.025, z.cy - dy, Z0 + 0.19]}
          rotation={[0, 0, Math.PI / 2]}
          material={[materiales.oro, materiales.aluminio, materiales.plasticoNegro][i]}
        >
          <cylinderGeometry args={[0.035, 0.035, 0.05, 20]} />
        </mesh>
      ))}
    </group>
  );
}

function Vrm({ materiales }) {
  const s = ZONAS.vrmSuperior;
  const i = ZONAS.vrmIzquierdo;
  return (
    <group>
      <mesh position={[s.cx, s.cy, Z0 + 0.035]} material={materiales.anodizado}>
        <boxGeometry args={[s.ancho, s.alto, 0.07]} />
      </mesh>
      <PilaAletas
        n={13}
        largo={s.ancho - 0.06}
        eje="x"
        tamano={[0.032, s.alto - 0.04, 0.1]}
        material={materiales.anodizado}
        posicion={[s.cx, s.cy, Z0 + 0.12]}
      />
      <mesh position={[s.cx, s.cy - s.alto / 2 + 0.012, Z0 + 0.075]} material={cianEmisivo}>
        <boxGeometry args={[s.ancho * 0.9, 0.012, 0.012]} />
      </mesh>

      <mesh position={[i.cx, i.cy, Z0 + 0.035]} material={materiales.anodizado}>
        <boxGeometry args={[i.ancho, i.alto, 0.07]} />
      </mesh>
      <PilaAletas
        n={9}
        largo={i.alto - 0.06}
        eje="y"
        tamano={[i.ancho - 0.03, 0.032, 0.1]}
        material={materiales.anodizado}
        posicion={[i.cx, i.cy, Z0 + 0.12]}
      />
      {/* Heatpipe que une los dos disipadores. */}
      <mesh position={[-0.98, 0.82, Z0 + 0.19]} material={materiales.acero}>
        <cylinderGeometry args={[0.022, 0.022, 0.32, 16]} />
      </mesh>
      <mesh position={[-0.98, 0.66, Z0 + 0.19]} rotation={[Math.PI / 2, 0, 0]} material={materiales.acero}>
        <sphereGeometry args={[0.022, 12, 12]} />
      </mesh>
    </group>
  );
}

// Zócalo LGA: base de plástico, cuadrícula de pines, marco y palanca de acero.
// El procesador (con su tapa) es una pieza aparte, para poder separarlo.
function Zocalo({ materiales }) {
  const z = ZONAS.socket;
  const lado = z.ancho;
  const marco = 0.045;
  return (
    <group position={[z.cx, z.cy, Z0]}>
      <mesh position={[0, 0, 0.022]} material={materiales.plasticoGris}>
        <boxGeometry args={[lado, lado, 0.044]} />
      </mesh>
      <mesh position={[0, 0, 0.046]} material={materiales.zocalo}>
        <planeGeometry args={[lado * 0.72, lado * 0.72]} />
      </mesh>
      {[
        [0, lado / 2 - marco / 2, lado, marco],
        [0, -lado / 2 + marco / 2, lado, marco],
        [-lado / 2 + marco / 2, 0, marco, lado - marco * 2],
        [lado / 2 - marco / 2, 0, marco, lado - marco * 2],
      ].map(([x, y, ancho, alto], i) => (
        <mesh key={i} position={[x, y, 0.052]} material={materiales.acero}>
          <boxGeometry args={[ancho, alto, 0.016]} />
        </mesh>
      ))}
      <mesh position={[-lado / 2 - 0.03, 0.12, 0.06]} rotation={[0, 0, Math.PI / 2]} material={materiales.acero}>
        <cylinderGeometry args={[0.012, 0.012, 0.3, 12]} />
      </mesh>
      <mesh position={[-lado / 2 - 0.03, 0.27, 0.06]} material={materiales.acero}>
        <sphereGeometry args={[0.022, 12, 12]} />
      </mesh>
    </group>
  );
}

function ConectorEPS({ materiales }) {
  const z = ZONAS.eps;
  return (
    <group position={[z.cx, z.cy, Z0]}>
      <mesh position={[0, 0, 0.055]} material={materiales.plasticoNegro}>
        <boxGeometry args={[z.ancho, z.alto, 0.11]} />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[-0.15 + (i % 4) * 0.1, i < 4 ? 0.03 : -0.03, 0.112]} material={materiales.oro}>
          <boxGeometry args={[0.05, 0.04, 0.004]} />
        </mesh>
      ))}
      <mesh position={[0, z.alto / 2 + 0.01, 0.08]} material={materiales.plasticoGris}>
        <boxGeometry args={[0.14, 0.02, 0.05]} />
      </mesh>
    </group>
  );
}

function Dimms({ materiales }) {
  const z = ZONAS.dimm;
  return (
    <group>
      {RANURAS_DIMM.map((x, i) => (
        <group key={x} position={[x, z.cy, Z0]}>
          <mesh position={[0, 0, 0.05]} material={i % 2 ? materiales.plasticoNegro : materiales.plasticoGris}>
            <boxGeometry args={[0.1, 1.2, 0.1]} />
          </mesh>
          <mesh position={[0, 0, 0.102]} material={materiales.oro}>
            <boxGeometry args={[0.012, 1.1, 0.004]} />
          </mesh>
          {/* Trabas de los dos extremos. */}
          {[0.62, -0.62].map((y) => (
            <mesh key={y} position={[0, y, 0.06]} material={materiales.plasticoNegro}>
              <boxGeometry args={[0.1, 0.05, 0.12]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function ConectorATX({ materiales }) {
  const z = ZONAS.atx24;
  return (
    <group position={[z.cx, z.cy, Z0]}>
      <mesh position={[0, 0, 0.06]} material={materiales.plasticoNegro}>
        <boxGeometry args={[z.ancho, z.alto, 0.12]} />
      </mesh>
      {Array.from({ length: 24 }, (_, i) => (
        <mesh key={i} position={[(i % 2) * 0.07 - 0.035, -0.31 + Math.floor(i / 2) * 0.056, 0.122]} material={materiales.oro}>
          <boxGeometry args={[0.038, 0.034, 0.004]} />
        </mesh>
      ))}
      <mesh position={[-z.ancho / 2 - 0.012, 0, 0.09]} material={materiales.plasticoGris}>
        <boxGeometry args={[0.024, 0.2, 0.05]} />
      </mesh>
    </group>
  );
}

function Chipset({ materiales }) {
  const z = ZONAS.chipset;
  return (
    <group position={[z.cx, z.cy, Z0]}>
      <mesh position={[0, 0, 0.03]} material={materiales.anodizado}>
        <boxGeometry args={[z.ancho, z.alto, 0.06]} />
      </mesh>
      <PilaAletas n={11} largo={z.ancho - 0.1} eje="x" tamano={[0.03, z.alto - 0.1, 0.045]} material={materiales.anodizado} posicion={[0, 0, 0.082]} />
      <mesh position={[0, 0, 0.112]} material={azulEmisivo}>
        <torusGeometry args={[0.12, 0.012, 10, 40]} />
      </mesh>
      <mesh position={[0, 0, 0.112]} material={materiales.acero}>
        <cylinderGeometry args={[0.07, 0.07, 0.012, 24]} />
      </mesh>
    </group>
  );
}

function Sata({ materiales }) {
  const z = ZONAS.sata;
  return (
    <group position={[z.cx, z.cy, Z0]}>
      {Array.from({ length: 6 }, (_, i) => (
        <group key={i} position={[(i % 2) * 0.13 - 0.065, 0.2 - Math.floor(i / 2) * 0.17, 0.04]}>
          <mesh material={materiales.plasticoNegro}>
            <boxGeometry args={[0.1, 0.13, 0.08]} />
          </mesh>
          <mesh position={[0, 0, 0.042]} material={materiales.plasticoGris}>
            <boxGeometry args={[0.07, 0.1, 0.004]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function RanurasPCIe({ materiales }) {
  const ranura = (zona, key) => (
    <group key={key} position={[zona.cx, zona.cy, Z0]}>
      <mesh position={[0, 0, 0.045]} material={materiales.plasticoNegro}>
        <boxGeometry args={[zona.ancho, zona.alto, 0.09]} />
      </mesh>
      <mesh position={[0, 0, 0.092]} material={materiales.oro}>
        <boxGeometry args={[zona.ancho * 0.94, 0.022, 0.004]} />
      </mesh>
      <mesh position={[0, 0, 0.098]} material={materiales.acero}>
        <boxGeometry args={[zona.ancho + 0.012, zona.alto + 0.016, 0.012]} />
      </mesh>
      <mesh position={[0, 0, 0.1]} material={materiales.plasticoNegro}>
        <boxGeometry args={[zona.ancho - 0.04, zona.alto - 0.045, 0.012]} />
      </mesh>
      <mesh position={[zona.ancho / 2 + 0.018, 0, 0.06]} material={materiales.plasticoGris}>
        <boxGeometry args={[0.035, zona.alto - 0.02, 0.08]} />
      </mesh>
    </group>
  );
  return (
    <>
      {ranura(ZONAS.pcie1, 'pcie1')}
      {ranura(ZONAS.pcie2, 'pcie2')}
    </>
  );
}

function Bateria({ materiales }) {
  const z = ZONAS.bateria;
  return (
    <group position={[z.cx, z.cy, Z0]}>
      <mesh position={[0, 0, 0.018]} rotation={[Math.PI / 2, 0, 0]} material={materiales.plasticoNegro}>
        <cylinderGeometry args={[0.125, 0.125, 0.036, 32]} />
      </mesh>
      <mesh position={[0, 0, 0.05]} rotation={[Math.PI / 2, 0, 0]} material={materiales.acero}>
        <cylinderGeometry args={[0.1, 0.1, 0.03, 32]} />
      </mesh>
    </group>
  );
}

// Todo lo que va fijo a la placa. Las piezas que se pueden sacar (procesador,
// cooler, RAM, tarjeta gráfica, SSD) son componentes aparte.
export default function Placa({ materiales }) {
  return (
    <group>
      <mesh material={materiales.pcb}>
        <boxGeometry args={[PLACA.ancho, PLACA.alto, PLACA.grosor]} />
      </mesh>
      <PanelEntradas materiales={materiales} />
      <Vrm materiales={materiales} />
      <Zocalo materiales={materiales} />
      <ConectorEPS materiales={materiales} />
      <Dimms materiales={materiales} />
      <ConectorATX materiales={materiales} />
      <Chipset materiales={materiales} />
      <Sata materiales={materiales} />
      <RanurasPCIe materiales={materiales} />
      <Bateria materiales={materiales} />
      <Condensadores materiales={materiales} />
      <Tornillos materiales={materiales} />
    </group>
  );
}
