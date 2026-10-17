'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import PiezaDesarmable from '../PiezaDesarmable.jsx';
import ZoomEscena from '../ZoomEscena.jsx';
import { fraccionExplosion } from '../cicloPC.js';
import { colocarPieza, construirRam, separarPiezas } from './modelos.js';

const RUTA_PLACA = '/modelos/placa-am4.glb';
const RUTA_CPU = '/modelos/cpu-9800x3d.glb';
const RUTA_RAM = '/modelos/ram-ddr5.glb';
const RUTA_GPU = '/modelos/grafica-rtx3080.glb';
const ANCHO = 2.7;
// Cuánto se separa cada pieza de la placa en la vista explotada.
const SEPARACION = 1.7;

// Posiciones en el espacio de la placa (unidades del modelo, y hacia arriba, z
// hacia el frente). Se midieron sobre el modelo: socket, ranuras de RAM y PCIe.
const BASE_CPU = [0.325, 0.162, -0.757];
const BASES_RAM = [
  [1.36, 0.3, -0.781],
  [1.53, 0.3, -0.781],
];
const BASE_GPU = [-0.45, -0.338, 1.25];

// Las piezas de la placa son los hijos de "motherboard" más la ranura mini PCIe.
// La placa en sí (el circuito impreso) es la pieza `Object_4`.
function elegirPiezas(raiz) {
  const placa = raiz.getObjectByName('motherboard_65');
  const mini = raiz.getObjectByName('mini pcie_66');
  return [...placa.children, mini].filter(Boolean);
}

// Número estable a partir del nombre (para repartir alturas sin azar).
function hash(texto) {
  let h = 0;
  for (let i = 0; i < texto.length; i += 1) h = (h * 31 + texto.charCodeAt(i)) % 9973;
  return h / 9973;
}

// Pieza que se separa de la placa en vertical (y un poco hacia afuera) durante
// la vista explotada. La fracción la calcula la escena una vez por cuadro.
function Flotante({ centro, objeto, fraccion, fijo, children }) {
  const grupo = useRef(null);
  const elevacion = useMemo(() => objeto.userData.elevacion ?? 0.35 + hash(objeto.name) * 0.9, [objeto]);
  // Las piezas que encajan en la placa (procesador, memorias, gráfica) sólo suben, sin correrse de lado.
  const lateral = objeto.userData.soloVertical ? 0 : 0.35;
  useFrame(() => {
    const f = fijo ? 0 : fraccion.current;
    grupo.current.position.set(centro[0] * f * lateral, f * SEPARACION * elevacion, centro[2] * f * lateral);
  });
  return <group ref={grupo}>{children}</group>;
}

export default function Escena3PC({ activa, reducido }) {
  const placa = useGLTF(RUTA_PLACA).scene;
  const cpu = useGLTF(RUTA_CPU).scene;
  const ram = useGLTF(RUTA_RAM).scene;
  const gpu = useGLTF(RUTA_GPU).scene;
  const modelo = useMemo(() => {
    // El modelo de la RAM es una lámina: se le arma un cuerpo con volumen.
    const moduloRam = construirRam(ram);
    // La carcasa de la gráfica es de metal claro y la luz de estudio la lava: se oscurece un poco.
    gpu.traverse((nodo) => {
      if (nodo.isMesh && !nodo.material.userData.atenuado) {
        nodo.material.color.multiplyScalar(0.55);
        nodo.material.userData.atenuado = true;
      }
    });
    const extras = [
      // Procesador apoyado en el socket (queda plano, igual que la placa).
      colocarPieza(cpu, { nombre: 'cpu', escala: 0.2, base: BASE_CPU, elevacion: 0.55, soloVertical: true }),
      // Memorias paradas en sus ranuras: giradas para quedar de canto, con los contactos abajo.
      ...BASES_RAM.map((base, i) =>
        colocarPieza(moduloRam, { nombre: `ram${i}`, escala: 2.06, rotacion: [0, 0, -Math.PI / 2], base, elevacion: 0.8 + i * 0.1, soloVertical: true })
      ),
      // Gráfica parada en la ranura PCIe, con los ventiladores hacia el frente.
      colocarPieza(gpu, { nombre: 'gpu', escala: 12, rotacion: [-Math.PI / 2, 0, 0], espejoY: true, base: BASE_GPU, elevacion: 0.55, soloVertical: true }),
    ];
    return separarPiezas(placa, { anchoObjetivo: ANCHO, elegirPiezas, extras });
  }, [placa, cpu, ram, gpu]);
  const fraccion = useRef(0);
  const tiempo = useRef(0);

  useFrame((_, delta) => {
    if (!activa) return;
    // Con movimiento reducido la placa queda armada y quieta.
    if (reducido) {
      fraccion.current = 0;
      return;
    }
    tiempo.current += Math.min(delta, 0.05);
    fraccion.current = fraccionExplosion(tiempo.current);
  });

  const { escala, centro, piezas } = modelo;
  return (
    <ZoomEscena activa={activa}>
    <group position={[0.1, 0.05, 0]} rotation={[0.42, -0.45, 0]}>
      {/* Iluminación de estudio: paneles de luz que se reflejan en los metales. */}
      <directionalLight position={[3, 6, 7]} intensity={0.9} color="#ffffff" />
      <directionalLight position={[-5, 2, 4]} intensity={0.35} color="#dfe8ff" />

      {piezas.map(({ objeto, centro: c }, i) => (
        <Flotante key={objeto.uuid} centro={c} objeto={objeto} fraccion={fraccion} fijo={objeto.name === 'Object_4'}>
          <PiezaDesarmable centro={c} semilla={i + 1}>
            <group scale={escala} position={[-centro.x * escala, -centro.y * escala, -centro.z * escala]}>
              <primitive object={objeto} />
            </group>
          </PiezaDesarmable>
        </Flotante>
      ))}
    </group>
    </ZoomEscena>
  );
}
