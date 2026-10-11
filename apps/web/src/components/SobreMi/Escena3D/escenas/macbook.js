import * as THREE from 'three';
import { crearPantalla } from '../pantallaCanvas.js';
import { dibujarManzanaEn } from '../manzanaPath.js';

// Lógica compartida de la MacBook (.glb) para las escenas que la muestran:
// ubicar su pantalla, ponerle una textura propia y pegarle la manzana en la tapa.

// Nombres de los nodos del modelo (vienen como códigos del original).
export const BASE = 'BoBvWqDHZjAeVrp';
export const TAPA = 'VCQqxpxkUlzqcJI';
export const BISAGRA = 'aXVtPPoMqmRgmzr';
const PANTALLA = 'VQmfhbMzfNAuKAD';
const CASCARA = 'EsQRFXIuhhkXDHc';
// Relación de aspecto de la pantalla (MacBook Pro de 16": 3456 × 2234).
export const RELACION_PANTALLA = 3456 / 2234;

// Textura con la manzana, plateada como la de la tapa real.
export function crearManzana(color = '#d9dde6') {
  const lienzo = crearPantalla(256, 256);
  const { ctx } = lienzo;
  ctx.clearRect(0, 0, 256, 256);
  dibujarManzanaEn(ctx, 128, 128, 256, color);
  lienzo.textura.needsUpdate = true;
  return lienzo;
}

// Pone en el panel de la pantalla las coordenadas de textura (0–1 de punta a
// punta, derecho visto de frente) y mide su orientación: centro, la dirección
// "hacia arriba" sobre la tapa y la normal hacia donde mira. El panel se
// clona: la geometría original queda intacta en la caché de useGLTF.
// `raiz` es cualquier nodo que contenga la tapa (la tapa sola o el modelo entero).
export function prepararPantalla(raiz) {
  const panel = raiz.getObjectByName(PANTALLA);
  panel.updateWorldMatrix(true, false);
  const geometria = panel.geometry.clone();
  panel.geometry = geometria;
  const posicion = geometria.attributes.position;
  const puntos = [];
  for (let i = 0; i < posicion.count; i += 1) {
    puntos.push(new THREE.Vector3().fromBufferAttribute(posicion, i).applyMatrix4(panel.matrixWorld));
  }

  // Eje principal del panel en el plano (y, z): la tapa gira alrededor de x.
  const media = puntos.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(puntos.length);
  let cyy = 0;
  let czz = 0;
  let cyz = 0;
  puntos.forEach((p) => {
    cyy += (p.y - media.y) ** 2;
    czz += (p.z - media.z) ** 2;
    cyz += (p.y - media.y) * (p.z - media.z);
  });
  const angulo = 0.5 * Math.atan2(2 * cyz, cyy - czz);
  const arriba = new THREE.Vector3(0, Math.cos(angulo), Math.sin(angulo));
  if (arriba.y < 0) arriba.negate();
  // Sentido hacia donde mira la pantalla: el que apunta hacia el frente (+z).
  const normal = new THREE.Vector3(0, -arriba.z, arriba.y);
  if (normal.z < 0) normal.negate();

  const caja = new THREE.Box3().setFromPoints(puntos);
  const proyecciones = puntos.map((p) => p.y * arriba.y + p.z * arriba.z);
  const minV = Math.min(...proyecciones);
  const maxV = Math.max(...proyecciones);
  const uv = new Float32Array(posicion.count * 2);
  puntos.forEach((p, i) => {
    uv[i * 2] = (p.x - caja.min.x) / (caja.max.x - caja.min.x);
    uv[i * 2 + 1] = (proyecciones[i] - minV) / (maxV - minV);
  });
  geometria.setAttribute('uv', new THREE.BufferAttribute(uv, 2));

  return { panel, centroPantalla: caja.getCenter(new THREE.Vector3()), arriba, normal };
}

// Pega la manzana en la cara exterior de la tapa, al centro y derecha vista
// desde atrás. Va como hijo de la tapa: gira y cae con ella.
export function agregarManzana(tapa, { centroPantalla, normal, arriba }, material, tamano = 3.2) {
  tapa.updateWorldMatrix(true, false);
  const casco = tapa.getObjectByName(CASCARA);
  casco.updateWorldMatrix(true, false);
  const posicion = casco.geometry.attributes.position;
  const v = new THREE.Vector3();
  // Hasta dónde llega la tapa hacia atrás (cara exterior), medido sobre la normal.
  let fondo = 0;
  for (let i = 0; i < posicion.count; i += 1) {
    v.fromBufferAttribute(posicion, i).applyMatrix4(casco.matrixWorld);
    fondo = Math.min(fondo, v.sub(centroPantalla).dot(normal));
  }
  const z = normal.clone().negate();
  const x = new THREE.Vector3().crossVectors(arriba, z);
  const mundo = new THREE.Matrix4()
    .makeBasis(x, arriba, z)
    .setPosition(centroPantalla.clone().addScaledVector(normal, fondo - 0.04));
  const manzana = new THREE.Mesh(new THREE.PlaneGeometry(tamano, tamano), material);
  manzana.applyMatrix4(new THREE.Matrix4().copy(tapa.matrixWorld).invert().multiply(mundo));
  tapa.add(manzana);
  return manzana;
}

// Material de la manzana: no recibe luz (se ve siempre plateada) y recorta lo transparente.
export function materialManzana(textura) {
  return new THREE.MeshBasicMaterial({ map: textura, transparent: true, alphaTest: 0.4, toneMapped: false });
}
