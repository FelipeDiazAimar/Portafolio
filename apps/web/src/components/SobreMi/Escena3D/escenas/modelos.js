import * as THREE from 'three';

// Prepara un modelo .glb para armar y desarmar: clona la escena, saca cada pieza
// de su padre (conservando su lugar en el espacio del modelo) y mide el modelo
// para llevarlo a un tamaño y un centro fijos. `elegirPadre` devuelve el nodo
// cuyos hijos son las piezas (o una lista de nodos que ya son piezas).
// El resultado se usa así: <group scale={escala} position={-centro*escala}> por
// cada pieza, dentro de una <PiezaDesarmable> sin escala (la caída va en metros
// de la escena, no del modelo).
export function separarPiezas(escena, { anchoObjetivo, elegirPiezas, extras = [] }) {
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

  // Las piezas extra (otros modelos ya colocados en el espacio de este) se
  // mueven con el resto pero no cuentan para medir el modelo.
  return {
    escala,
    centro,
    tamano,
    piezas: [...piezas, ...extras].map((objeto) => {
      const c = new THREE.Box3().setFromObject(objeto).getCenter(new THREE.Vector3());
      // Centro de la pieza en unidades de la escena, respecto del centro del modelo.
      return { objeto, centro: c.sub(centro).multiplyScalar(escala).toArray() };
    }),
  };
}

// Clona un modelo y lo deja listo para encajar en otro: lo escala y gira, y apoya
// el centro de su base en "base" (en el espacio del modelo que lo recibe).
export function colocarPieza(escena, { nombre, escala = 1, rotacion = [0, 0, 0], base, elevacion }) {
  const pivote = new THREE.Group();
  pivote.name = nombre;
  pivote.userData.elevacion = elevacion;
  pivote.add(escena.clone(true));
  pivote.scale.setScalar(escala);
  pivote.rotation.set(...rotacion);
  pivote.updateMatrixWorld(true);
  const caja = new THREE.Box3().setFromObject(pivote);
  const centro = caja.getCenter(new THREE.Vector3());
  pivote.position.set(base[0] - centro.x, base[1] - caja.min.y, base[2] - centro.z);
  pivote.updateMatrixWorld(true);
  return pivote;
}

// Clona un modelo y mide dónde tiene que ir para quedar apoyado sobre la mesa:
// devuelve la copia, su centro en x y z y su altura mínima (en unidades del
// modelo). Se usa como <group scale={s} position={[-cx*s, -minY*s, -cz*s]}>.
export function anclarEnMesa(escena) {
  const raiz = escena.clone(true);
  raiz.updateMatrixWorld(true);
  const caja = new THREE.Box3().setFromObject(raiz);
  const centro = caja.getCenter(new THREE.Vector3());
  return { raiz, caja, cx: centro.x, cz: centro.z, minY: caja.min.y };
}
