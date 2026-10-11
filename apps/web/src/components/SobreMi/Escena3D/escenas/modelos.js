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
export function colocarPieza(escena, { nombre, escala = 1, rotacion = [0, 0, 0], base, elevacion, soloVertical = false, espejoY = false }) {
  const pivote = new THREE.Group();
  pivote.name = nombre;
  pivote.userData.elevacion = elevacion;
  pivote.userData.soloVertical = soloVertical;
  const contenido = escena.clone(true);
  // Espejo en el eje y del modelo: para darle la vuelta a una pieza sin que
  // cambie de lado lo que ya miraba al frente.
  if (espejoY) contenido.scale.y *= -1;
  pivote.add(contenido);
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

// Módulo de memoria RAM con volumen. El modelo es una lámina sin espesor con la
// imagen del módulo: se le arma un cuerpo de disipador (una caja oscura) y la
// imagen va en las dos caras, cada una derecha vista desde su lado. El resultado
// es un grupo plano en x–z (largo en z) con los contactos del lado +x.
export function construirRam(escena) {
  const frente = escena.clone(true);
  frente.updateMatrixWorld(true);
  const caja = new THREE.Box3().setFromObject(frente);
  const tamano = caja.getSize(new THREE.Vector3());
  const c = caja.getCenter(new THREE.Vector3());
  const grosor = tamano.x * 0.2;

  const grupo = new THREE.Group();
  grupo.name = "ram";
  const cara = new THREE.Group();
  cara.add(frente);
  cara.position.y = grosor / 2;
  grupo.add(cara);

  // El dorso es la misma lámina girada media vuelta sobre su eje largo.
  const dorso = new THREE.Group();
  const lamina = escena.clone(true);
  lamina.position.set(-c.x, -c.y, -c.z);
  dorso.add(lamina);
  dorso.position.set(c.x, c.y - grosor / 2, c.z);
  dorso.rotation.z = Math.PI;
  grupo.add(dorso);

  // Cuerpo del disipador: un poco más corto del lado de los contactos, que quedan a la vista.
  const cuerpo = new THREE.Mesh(
    // Más fino que la distancia entre las láminas: si no, comparten plano con ellas y parpadean.
    new THREE.BoxGeometry(tamano.x * 0.93, grosor * 0.9, tamano.z * 0.99),
    new THREE.MeshStandardMaterial({ color: "#14151a", roughness: 0.45, metalness: 0.6 })
  );
  cuerpo.position.set(c.x - tamano.x * 0.035, c.y - grosor / 2 + grosor / 2, c.z);
  cuerpo.position.y = c.y;
  grupo.add(cuerpo);
  return grupo;
}
