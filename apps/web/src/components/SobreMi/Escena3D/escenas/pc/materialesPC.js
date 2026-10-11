import * as THREE from 'three';
import { crearPantalla } from '../../pantallaCanvas.js';
import { dibujarPCB, dibujarIHS, dibujarPinesSocket, dibujarCepillado } from '../../texturasPlaca.js';
import { PLACA } from '../../disposicionPlaca.js';

// Un lienzo → una textura. `datos` = true para mapas que no son color (relieve,
// rugosidad): no deben pasar por la conversión de espacio de color.
function textura(ancho, alto, dibujar, { datos = false, repetir = false } = {}) {
  const l = crearPantalla(ancho, alto);
  dibujar(l.ctx, ancho, alto);
  if (datos) l.textura.colorSpace = THREE.NoColorSpace;
  if (repetir) l.textura.wrapS = l.textura.wrapT = THREE.RepeatWrapping;
  l.textura.needsUpdate = true;
  return l.textura;
}

// Aspa de ventilador en coordenadas unitarias: una hoz (borde de ataque curvo que
// ensancha hacia afuera y borde de fuga que vuelve) extruida con un poco de grosor
// y bisel. Se escala al radio de cada ventilador y se comparte entre todos.
function crearAspa() {
  const forma = new THREE.Shape();
  forma.moveTo(0.16, -0.05);
  forma.bezierCurveTo(0.42, -0.13, 0.78, -0.22, 1.0, -0.1);
  forma.bezierCurveTo(1.03, 0.04, 0.92, 0.2, 0.6, 0.27);
  forma.bezierCurveTo(0.4, 0.31, 0.2, 0.24, 0.16, 0.1);
  forma.closePath();
  const geometria = new THREE.ExtrudeGeometry(forma, {
    depth: 0.025,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 2,
    curveSegments: 18,
  });
  geometria.translate(0, 0, -0.0125);
  return geometria;
}

// Texturas y materiales (PBR) de toda la PC. Se crean una vez por escena y se
// liberan juntos con `liberarMateriales`.
export function crearMateriales() {
  const pcbColor = textura(2048, Math.round((2048 * PLACA.alto) / PLACA.ancho), (c, w, h) => dibujarPCB(c, w, h, 'color'));
  const pcbRelieve = textura(2048, Math.round((2048 * PLACA.alto) / PLACA.ancho), (c, w, h) => dibujarPCB(c, w, h, 'relieve'), { datos: true });
  const ihs = textura(512, 512, dibujarIHS);
  const pines = textura(512, 512, dibujarPinesSocket);
  const cepillado = textura(512, 512, dibujarCepillado, { datos: true, repetir: true });

  const materiales = {
    pcb: new THREE.MeshStandardMaterial({ color: '#8a8a8a', map: pcbColor, bumpMap: pcbRelieve, bumpScale: 2.2, roughness: 0.82, metalness: 0, envMapIntensity: 0.15 }),
    // Aluminio cepillado plateado (aletas del cooler, panel de entradas).
    aluminio: new THREE.MeshStandardMaterial({ color: '#c3cad4', metalness: 1, roughness: 0.4, roughnessMap: cepillado, envMapIntensity: 1.25 }),
    // Aluminio anodizado oscuro (disipadores de la placa).
    anodizado: new THREE.MeshStandardMaterial({ color: '#343a43', metalness: 0.95, roughness: 0.42, roughnessMap: cepillado, envMapIntensity: 1.2 }),
    acero: new THREE.MeshStandardMaterial({ color: '#c7ccd4', metalness: 1, roughness: 0.26, envMapIntensity: 1.3 }),
    oro: new THREE.MeshStandardMaterial({ color: '#d6ab4a', metalness: 1, roughness: 0.27, envMapIntensity: 1.2 }),
    plasticoNegro: new THREE.MeshStandardMaterial({ color: '#0a0b0e', roughness: 0.45, metalness: 0.05, envMapIntensity: 0.5 }),
    plasticoGris: new THREE.MeshStandardMaterial({ color: '#23262c', roughness: 0.52, metalness: 0.05, envMapIntensity: 0.45 }),
    condensador: new THREE.MeshStandardMaterial({ color: '#13151a', roughness: 0.4, metalness: 0.35, envMapIntensity: 0.6 }),
    zocalo: new THREE.MeshStandardMaterial({ map: pines, roughness: 0.35, metalness: 0.7, envMapIntensity: 1.1 }),
    tapaChip: new THREE.MeshStandardMaterial({ map: ihs, metalness: 0.92, roughness: 0.3, envMapIntensity: 1.4 }),
    sustratoChip: new THREE.MeshStandardMaterial({ color: '#1f5a36', roughness: 0.6, metalness: 0.1, envMapIntensity: 0.4 }),
    ram: new THREE.MeshStandardMaterial({ color: '#0e131a', roughness: 0.5, metalness: 0.1, envMapIntensity: 0.4 }),
    // Carcasa de la tarjeta gráfica: metal oscuro con brillo, y aspas de plástico
    // oscuro semibrillante.
    carcasa: new THREE.MeshStandardMaterial({ color: '#1b1e25', metalness: 0.75, roughness: 0.34, envMapIntensity: 1.1 }),
    aspa: new THREE.MeshStandardMaterial({ color: '#171a20', metalness: 0.15, roughness: 0.32, envMapIntensity: 0.9, side: THREE.DoubleSide }),
    geometriaAspa: crearAspa(),
    azulUSB: new THREE.MeshStandardMaterial({ color: '#1f5cff', roughness: 0.45, metalness: 0.1 }),
  };
  return { materiales, texturas: [pcbColor, pcbRelieve, ihs, pines, cepillado] };
}

export function liberarMateriales({ materiales, texturas }) {
  Object.values(materiales).forEach((m) => m.dispose());
  texturas.forEach((t) => t.dispose());
}
