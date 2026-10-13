import * as THREE from 'three';

// Dónde está el nodo "yo" del grafo de Hoy, en coordenadas del mundo. Lo escribe el
// grafo en cada cuadro mientras está activo; lo lee la última costilla para terminar
// exactamente en él (el grafo se encuadra moviendo y escalando su vista, así que un
// punto fijo de la estación no coincide con el nodo).
export const puntaYo = { visible: false, mundo: new THREE.Vector3() };
