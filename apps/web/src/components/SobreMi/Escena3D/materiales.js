import * as THREE from 'three';

// Materiales compartidos por todas las escenas, para que se vean como una serie.
export const cuerpoOscuro = new THREE.MeshStandardMaterial({
  color: '#1a2230',
  metalness: 0.35,
  roughness: 0.4,
});

export const azulEmisivo = new THREE.MeshStandardMaterial({
  color: '#5b8cff',
  emissive: '#5b8cff',
  emissiveIntensity: 1.8,
  roughness: 0.4,
});

export const cianEmisivo = new THREE.MeshStandardMaterial({
  color: '#3de0ff',
  emissive: '#3de0ff',
  emissiveIntensity: 1.6,
  roughness: 0.4,
});
