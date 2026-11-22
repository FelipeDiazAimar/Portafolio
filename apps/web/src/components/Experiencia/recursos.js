// Carga de assets reales del pasillo (Poly Haven, ver data/pasilloAssets.js):
// - modelos .glb optimizados (meshopt + WebP), con caché: cada id se baja una sola vez y se
//   clona para cada aparición (comparte geometría y materiales);
// - texturas PBR (diffuse, normal, ARM) para pisos, paredes y estanterías.
// Todo es asíncrono: la escena se arma enseguida y las cosas aparecen cuando llegan.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const BASE = '/pasillo';

// `medidaDe(id)`: medidas reales [ancho, alto, fondo] (m) según Poly Haven, para corregir modelos
// que vienen exportados en otra escala (p. ej. steel_frame_shelves_01 viene ×10).
export function crearRecursos(renderer, medidaDe = () => null) {
  const cargador = new GLTFLoader();
  cargador.setMeshoptDecoder(MeshoptDecoder);
  const texturas = new THREE.TextureLoader();
  const modelos = new Map(); // id -> Promise<Object3D normalizado>
  const juegos = new Map(); // id -> Promise<{ map, normalMap, arm }>
  const anisotropia = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  let destruido = false;

  // Modelo con la base en y = 0 y centrado en x/z; sombras activadas.
  function modelo(id) {
    if (!modelos.has(id)) {
      modelos.set(
        id,
        cargador.loadAsync(`${BASE}/m/${id}.glb`).then((gltf) => {
          const raiz = gltf.scene;
          raiz.updateMatrixWorld(true);
          let caja = new THREE.Box3().setFromObject(raiz);
          const real = medidaDe(id);
          if (real) {
            const tam = caja.getSize(new THREE.Vector3());
            const factor = Math.max(...real) / Math.max(tam.x, tam.y, tam.z);
            if (factor > 1.4 || factor < 0.7) {
              raiz.scale.multiplyScalar(factor);
              raiz.updateMatrixWorld(true);
              caja = new THREE.Box3().setFromObject(raiz);
            }
          }
          const centro = caja.getCenter(new THREE.Vector3());
          const envoltorio = new THREE.Group();
          raiz.position.sub(new THREE.Vector3(centro.x, caja.min.y, centro.z));
          envoltorio.add(raiz);
          envoltorio.traverse((o) => {
            if (!o.isMesh) return;
            o.castShadow = true;
            o.receiveShadow = true;
            const lista = Array.isArray(o.material) ? o.material : [o.material];
            for (const m of lista) {
              for (const clave of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap']) if (m[clave]) m[clave].anisotropy = anisotropia;
              // el vidrio de Poly Haven viene con transmisión, que obliga a dibujar toda la escena otra
              // vez en cada cuadro (la mitad del costo del pasillo): pasa a vidrio transparente
              // común, que con el mapa de entorno sigue reflejando
              if (m.transmission > 0) {
                m.transmission = 0;
                m.transparent = true;
                m.opacity = Math.min(m.opacity, 0.28);
                m.depthWrite = false;
              }
            }
          });
          envoltorio.userData.medidas = caja.getSize(new THREE.Vector3());
          return envoltorio;
        }),
      );
    }
    return modelos.get(id);
  }

  async function instancia(id) {
    const plantilla = await modelo(id);
    if (destruido) return null;
    const copia = plantilla.clone(true);
    copia.userData.medidas = plantilla.userData.medidas;
    copia.userData.id = id;
    return copia;
  }

  function cargarTextura(url, color) {
    return new Promise((resolver) => {
      texturas.load(
        url,
        (t) => {
          t.wrapS = THREE.RepeatWrapping;
          t.wrapT = THREE.RepeatWrapping;
          t.anisotropy = anisotropia;
          if (color) t.colorSpace = THREE.SRGBColorSpace;
          resolver(t);
        },
        undefined,
        () => resolver(null),
      );
    });
  }

  function juego(id) {
    if (!juegos.has(id)) {
      juegos.set(
        id,
        Promise.all([cargarTextura(`${BASE}/t/${id}_diff.webp`, true), cargarTextura(`${BASE}/t/${id}_nor.webp`), cargarTextura(`${BASE}/t/${id}_arm.webp`)]).then(([map, normalMap, arm]) => ({ map, normalMap, arm })),
      );
    }
    return juegos.get(id);
  }

  // Material PBR que se completa cuando llegan las texturas (mientras, color liso).
  function materialPBR(id, { color = '#9a9a9a', vertexColors = false, escalaNormal = 1, rugosidad = 1, metal = 1 } = {}) {
    const material = new THREE.MeshStandardMaterial({ color, vertexColors, roughness: 0.8, metalness: 0 });
    juego(id).then(({ map, normalMap, arm }) => {
      if (destruido) return;
      if (map) {
        material.map = map;
        material.color.set(vertexColors ? '#ffffff' : '#ffffff');
      }
      if (normalMap) {
        material.normalMap = normalMap;
        material.normalScale.set(escalaNormal, escalaNormal);
      }
      if (arm) {
        material.aoMap = arm;
        material.roughnessMap = arm;
        material.metalnessMap = arm;
        material.roughness = rugosidad;
        material.metalness = metal;
      }
      material.needsUpdate = true;
    });
    return material;
  }

  return {
    instancia,
    precargar: (ids) => Promise.all(ids.map((id) => modelo(id).catch(() => null))),
    materialPBR,
    destruir() {
      destruido = true;
      for (const p of modelos.values())
        p.then((m) =>
          m.traverse((o) => {
            if (!o.isMesh) return;
            o.geometry.dispose();
            const lista = Array.isArray(o.material) ? o.material : [o.material];
            for (const mat of lista) {
              for (const clave of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap']) mat[clave]?.dispose();
              mat.dispose();
            }
          }),
        ).catch(() => {});
      for (const p of juegos.values()) p.then((j) => Object.values(j).forEach((t) => t?.dispose()));
    },
  };
}
