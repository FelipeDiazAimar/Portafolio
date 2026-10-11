import * as THREE from 'three';

// Prepara un modelo .glb para armar y desarmar: clona la escena, saca cada pieza
// de su padre (conservando su lugar en el espacio del modelo) y mide el modelo
// para llevarlo a un tamaño y un centro fijos. `elegirPadre` devuelve el nodo
// cuyos hijos son las piezas (o una lista de nodos que ya son piezas).
// El resultado se usa así: <group scale={escala} position={-centro*escala}> por
// cada pieza, dentro de una <PiezaDesarmable> sin escala (la caída va en metros
// de la escena, no del modelo).
export function separarPiezas(escena, { anchoObjetivo, elegirPiezas }) {
  const raiz = escena.clone(true);
  raiz.updateMatrixWorld(true);
  const piezas = elegirPiezas(raiz);
  piezas.forEach((pieza) => {
    // Sin esto la pieza perdería la transformación de sus padres al sacarla.
    pieza.updateWorldMatrix(true, false);
    const mundo = pieza.matrixWorld.clone();
    pieza.removeFromParent();
    pieza.matrix.copy(mundo);
    pieza.matrix.decompose(pieza.position, pieza.quaternion, pieza.scale);
    pieza.updateMatrixWorld(true);
  });

  const caja = new THREE.Box3();
  piezas.forEach((pieza) => caja.union(new THREE.Box3().setFromObject(pieza)));
  const tamano = caja.getSize(new THREE.Vector3());
  const centro = caja.getCenter(new THREE.Vector3());
  const escala = anchoObjetivo / Math.max(tamano.x, tamano.z);

  return {
    escala,
    centro,
    tamano,
    piezas: piezas.map((objeto) => {
      const c = new THREE.Box3().setFromObject(objeto).getCenter(new THREE.Vector3());
      // Centro de la pieza en unidades de la escena, respecto del centro del modelo.
      return { objeto, centro: c.sub(centro).multiplyScalar(escala).toArray() };
    }),
  };
}
