// Paleta del pasillo: como los conectores de la entrada de Proyectos, todo va en negro, blanco y
// los colores propios del trabajo. Se aplica en el shader sobre el color base de cada material
// (textura + color + colores de vértice), sin tocar las texturas:
//   - lo neutro (maderas, metales, papel, plástico gris) pasa a la escala de grises del portafolio,
//     conservando su luminosidad y su detalle;
//   - lo que tenía color vivo (lomos de libros, etiquetas, cables, luces) toma uno de los acentos
//     del pasillo, según su tono original (los cálidos el primero, los fríos el segundo), con la
//     misma luminosidad que tenía.
// La estructura (piso, paredes, techo) queda neutra con un tinte apenas del acento.
import * as THREE from 'three';

export const DECLARACIONES_PALETA = /* glsl */ `
uniform vec3 uAcento1P;
uniform vec3 uAcento2P;
uniform float uVivoP;
uniform float uTinteP;
uniform float uTono1P;
uniform float uTono2P;
uniform float uDestacadoP;
float distTonoP(float a, float b) { float d = abs(a - b); return min(d, 6.0 - d); }
`;

export const PALETA = /* glsl */ `
{
  vec3 cP = diffuseColor.rgb;
  float lumP = dot(cP, vec3(0.2126, 0.7152, 0.0722));
  float maxP = max(cP.r, max(cP.g, cP.b));
  float cromaP = maxP - min(cP.r, min(cP.g, cP.b));
  float tonoP = 0.0;
  if (cromaP > 1e-4) {
    if (maxP == cP.r) tonoP = mod((cP.g - cP.b) / cromaP, 6.0);
    else if (maxP == cP.g) tonoP = (cP.b - cP.r) / cromaP + 2.0;
    else tonoP = (cP.r - cP.g) / cromaP + 4.0;
  }
  // el acento más parecido en tono (lo que ya era del color del pasillo, lo sigue siendo)
  vec3 acentoP = distTonoP(tonoP, uTono1P) <= distTonoP(tonoP, uTono2P) ? uAcento1P : uAcento2P;
  float lumAP = max(dot(acentoP, vec3(0.2126, 0.7152, 0.0722)), 0.03);
  vec3 vivoP = acentoP * clamp(lumP / lumAP, 0.3, 1.5);
  vec3 tinteP = mix(vec3(0.97, 0.98, 1.0), uAcento1P / max(max(uAcento1P.r, max(uAcento1P.g, uAcento1P.b)), 1e-3), max(uTinteP, uDestacadoP * 0.4));
  vec3 neutroP = mix(vec3(0.004, 0.0045, 0.006), vec3(0.88, 0.89, 0.91), clamp(lumP * 1.08, 0.0, 1.0)) * tinteP;
  // los objetos interactivos toman el acento con menos color de partida
  diffuseColor.rgb = mix(neutroP, vivoP, smoothstep(0.16 - uDestacadoP * 0.1, 0.34 - uDestacadoP * 0.16, cromaP) * uVivoP);
}
`;

// Borde encendido de los objetos interactivos: un contorno del acento según el ángulo de vista.
export const BORDE_DESTACADO = /* glsl */ `
if (uDestacadoP > 0.5) {
  float rimP = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.6);
  totalEmissiveRadiance += uAcento1P * rimP * 1.4;
}
`;

const tonoDe = (color) => {
  const { r, g, b } = color;
  const max = Math.max(r, g, b);
  const croma = max - Math.min(r, g, b);
  if (croma < 1e-4) return 0;
  if (max === r) return (((g - b) / croma) % 6 + 6) % 6;
  if (max === g) return (b - r) / croma + 2;
  return (r - g) / croma + 4;
};

// uniforms de la paleta de un pasillo: [acento principal, acento secundario] en hex
export function uniformsPaleta(colores) {
  const [a, b] = colores;
  const uno = new THREE.Color(a);
  const dos = new THREE.Color(b ?? a);
  return {
    uAcento1P: { value: uno },
    uAcento2P: { value: dos },
    uTono1P: { value: tonoDe(uno) },
    uTono2P: { value: tonoDe(dos) },
  };
}
