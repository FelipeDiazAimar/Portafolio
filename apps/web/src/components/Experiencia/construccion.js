// Construcción en tiempo real (inspirada en igloo.inc): el pasillo no está "ya hecho", se arma
// delante tuyo a medida que avanzás.
//
// Cada pasillo tiene su obra: un frente que avanza a lo largo del pasillo (un plano perpendicular a
// su eje) por delante de la cámara. Adelante del frente, todo (piso, paredes, techo, muebles y
// objetos) existe sólo como esqueleto: una retícula blanca de 20 cm pegada a la forma de cada cosa,
// más el contorno de las superficies que se ven de canto, así se adivina cada objeto en 3D. Al
// llegar el frente, cada baldosa de 40 cm se vuelve sólida por separado. Primero se arman piso,
// paredes y techo (demora 0) y un poco después muebles y objetos; lo bajo antes que lo alto. Lo que
// queda atrás se desarma: en el recorrido inmersivo con la misma animación al revés (primero los
// objetos y lo alto, después la estructura); con el scroll, al instante y sin que se note, porque la
// cámara mira hacia adelante (y si volvés, lo de atrás reaparece hecho en el acto). Así sólo existe
// lo que se ve y lo que se está armando adelante.
//
// Se inyecta con onBeforeCompile en los materiales de la escena (Standard, Physical, Basic): no hay
// geometría extra, el esqueleto lo dibuja el mismo material.
import * as THREE from 'three';
import { BORDE_DESTACADO, DECLARACIONES_PALETA, PALETA, uniformsPaleta } from './paleta.js';

const BALDOSA = 2.5; // baldosas por metro al materializarse (40 cm)
const RETICULA = 5.0; // líneas por metro del esqueleto (20 cm)
const ADELANTE = 10; // cuánto se adelanta el frente a la cámara (m)
const ALCANCE = 3; // hasta dónde, más allá de cada frente, se ve el esqueleto (m): lo lejano no se anticipa

const DECLARACIONES = /* glsl */ `
uniform vec2 uOrigenC;
uniform vec2 uDirC;
uniform float uConstruidoC;
uniform float uDesdeC;
uniform float uDemoraC;
uniform vec3 uTrazoC;
varying vec3 vMundoC;
float hashC(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
`;

// frenteC: metros que separan este punto del borde de la obra (< 0 = esqueleto o nada). La obra
// va de uDesdeC (frente de atrás, que desarma) a uConstruidoC (frente de adelante, que arma).
const RECORTE = /* glsl */ `
float avanceC = dot(vMundoC.xz - uOrigenC, uDirC);
float azarC = hashC(floor(vMundoC * ${BALDOSA.toFixed(1)} + 0.001)) * 0.9;
float frenteC = min(
  uConstruidoC - avanceC - uDemoraC - vMundoC.y * 0.22 - azarC,
  avanceC - uDesdeC - uDemoraC - vMundoC.y * 0.22 - azarC
);
if (frenteC < -${ALCANCE.toFixed(1)}) discard;
`;

// el esqueleto: líneas de la retícula en los ejes que varían sobre la superficie y, si hay normal,
// el contorno; el resto del fragmento no existe
const esqueleto = (conNormal) => /* glsl */ `
if (frenteC < 0.0) {
  vec3 qC = vMundoC * ${RETICULA.toFixed(1)};
  vec3 dC = abs(fract(qC + 0.5) - 0.5);
  vec3 wC = fwidth(qC);
  // líneas de ~1 px que se apagan donde la retícula se vuelve demasiado densa (lejos o de canto)
  vec3 lC = (1.0 - smoothstep(wC * 0.25, wC * 0.9, dC)) * step(vec3(0.004), wC) * (1.0 - smoothstep(0.08, 0.22, wC));
  float lineaC = max(lC.x, max(lC.y, lC.z));
  ${conNormal ? 'lineaC = max(lineaC, smoothstep(0.78, 0.93, 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)))));' : ''}
  if (lineaC < 0.3) discard;
  float lejosC = smoothstep(-${ALCANCE.toFixed(1)}, -1.0, frenteC);
  #ifdef USE_FOG
    vec3 baseC = fogColor;
  #else
    vec3 baseC = vec3(0.0);
  #endif
  gl_FragColor = vec4(mix(baseC, uTrazoC, lejosC * lineaC), 1.0);
  #include <fog_fragment>
  return;
}
`;

function inyectar(material, uniforms, demora, destacado = false) {
  const conNormal = !!material.isMeshStandardMaterial;
  material.onBeforeCompile = (shader) => {
    // la estructura (demora 0) queda neutra con un tinte del acento; el resto toma los acentos
    const estructura = demora === 0;
    Object.assign(shader.uniforms, uniforms, { uDemoraC: { value: demora }, uVivoP: { value: estructura ? 0 : 1 }, uTinteP: { value: estructura ? 0.1 : 0 }, uDestacadoP: { value: destacado ? 1 : 0 } });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMundoC;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 mundoC = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          mundoC = instanceMatrix * mundoC;
        #endif
        vMundoC = (modelMatrix * mundoC).xyz;`,
      );
    let f = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${DECLARACIONES}\n${DECLARACIONES_PALETA}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${PALETA}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${RECORTE}`);
    f = conNormal
      ? f.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${esqueleto(true)}`)
      : f.replace(RECORTE, `${RECORTE}\n${esqueleto(false)}`);
    if (conNormal) f = f.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${BORDE_DESTACADO}`);
    shader.fragmentShader = f;
  };
  material.customProgramCacheKey = () => `construccion|${conNormal ? 1 : 0}`;
  material.needsUpdate = true;
}

export function crearConstruccion({ reducido = false } = {}) {
  const obras = [];
  // color del trazo del esqueleto: claro sobre fondos oscuros, oscuro sobre fondos claros
  const trazo = { value: new THREE.Color(1, 1, 1) };

  // una obra por pasillo (`pasillo` de armarRecorrido). `base`: el punto del camino de la cámara
  // (en metros) que corresponde al comienzo del pasillo, así el avance se mide sobre el recorrido
  // real y no proyectando la cámara sobre el eje (desde otro pasillo eso daba cerca cosas lejanas).
  // `paleta`: [acento principal, acento secundario].
  function obra(i, pasillo, { base = 0, paleta = ['#5b8cff'] } = {}) {
    obras[i] = {
      base,
      construido: reducido ? 1e4 : 0,
      desde: -1e4,
      origen: pasillo.inicio,
      dir: pasillo.dir,
      uniforms: {
        uOrigenC: { value: new THREE.Vector2(...pasillo.inicio) },
        uDirC: { value: new THREE.Vector2(...pasillo.dir) },
        uConstruidoC: { value: reducido ? 1e4 : 0 },
        uDesdeC: { value: -1e4 },
        uTrazoC: trazo,
        ...uniformsPaleta(paleta),
      },
    };
    return obras[i];
  }

  function preparar(material, i, demora = 1.2, destacado = false) {
    if (!material) return true;
    const clave = destacado ? `${i}*` : i;
    if (material.userData.construccion !== undefined) return material.userData.construccion === clave;
    if (!(material.isMeshStandardMaterial || material.isMeshBasicMaterial)) return true;
    material.userData.construccion = clave;
    inyectar(material, obras[i].uniforms, demora, destacado);
    return true;
  }

  // prepara los materiales de `objeto` para la obra `i`; un material que ya pertenece a otra obra se
  // clona (los pasillos no comparten el frente)
  // `destacado`: objetos interactivos (más color del pasillo y borde encendido); lo marcado como
  // `vitrina` sólo se prepara así
  function aplicar(objeto, i, demora = 1.2, { destacado = false } = {}) {
    objeto.traverse((o) => {
      if (!o.isMesh || o.userData.sinConstruccion) return;
      if (destacado) o.userData.vitrina = true;
      else if (o.userData.vitrina) return;
      const lista = Array.isArray(o.material) ? o.material : [o.material];
      const nuevos = lista.map((m) => {
        if (preparar(m, i, demora, destacado)) return m;
        const copia = m.clone();
        delete copia.userData.construccion;
        preparar(copia, i, demora, destacado);
        return copia;
      });
      o.material = Array.isArray(o.material) ? nuevos : nuevos[0];
    });
  }

  let previo = null;
  return {
    // según el color de fondo (el de la niebla)
    fijarFondo(color) {
      const luminancia = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
      if (luminancia > 0.35) trazo.value.setRGB(0.05, 0.06, 0.08);
      else trazo.value.setRGB(1, 1, 1);
    },
    obra,
    preparar,
    aplicar,
    // `hasta`: la última obra que puede avanzar (la del pasillo en el que estás, o la siguiente
    // mientras doblás); las de más adelante esperan, así no se arma el pasillo que viene antes de
    // tiempo. `libre`: recorrido inmersivo (se puede mirar para atrás); `mirada`: hacia dónde mira la
    // cámara, en el piso.
    cuadro({ t, s, hasta, libre, mirada }) {
      // con el tiempo real (no el dt recortado de la escena): con cuadros lentos la obra no se atrasa
      const dt = previo === null ? 0 : Math.min(0.25, Math.max(0, t - previo));
      previo = t;
      if (reducido) return;
      const acercar = (valor, meta) => {
        const falta = meta - valor;
        const paso = (2.6 + Math.abs(falta) * 0.6) * dt;
        return Math.abs(falta) <= paso ? meta : valor + Math.sign(falta) * paso;
      };
      for (let i = 0; i < obras.length; i++) {
        const o = obras[i];
        if (!o) continue;
        // dónde está la cámara respecto del comienzo de este pasillo, medido sobre el recorrido
        const avance = s - o.base;
        let construido;
        if (libre) {
          // se arma (o se desarma, animado) hacia donde mirás y se desarma a tus espaldas
          const m = mirada.x * o.dir[0] + mirada.y * o.dir[1];
          construido = acercar(Math.max(o.construido, avance - 1.5), avance + (m > -0.3 ? ADELANTE : 3));
          o.desde = acercar(Math.min(o.desde, avance - 1.5), avance - (m < 0.3 ? ADELANTE : 3.5));
        } else {
          // scroll: adelante se arma (y si retrocedés, lo lejano se desarma) animado; atrás, al
          // instante, siempre fuera de cuadro (el borde real queda ~1,6 m más adelante por el
          // escalonado de baldosas y la altura)
          construido = acercar(Math.max(o.construido, avance - 1.5), avance + ADELANTE);
          o.desde = avance - 4.5;
        }
        // (como el avance es la distancia real por el recorrido, el pasillo siguiente empieza a
        // armarse recién cuando su comienzo está a menos de ADELANTE metros: al llegar al cruce ya
        // se ve hecho)
        o.construido = construido;
        o.uniforms.uConstruidoC.value = o.construido;
        o.uniforms.uDesdeC.value = o.desde;
      }
    },
  };
}
