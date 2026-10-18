import { Box3, CapsuleGeometry, Euler, InstancedBufferAttribute, InstancedBufferGeometry, Quaternion, SphereGeometry } from 'three';

// Hélice de barras (de helix.ts del original, MIT). Las barras van en una cinta: al avanzar la
// fase cada una se desliza por la hélice y vuelve a entrar por abajo, así una cantidad fija de
// barras se lee como una columna sin fin. Escribe en los buffers sin crear objetos.

const envolver = (a, n) => ((a % n) + n) % n;

export function escribirHelice(fase, altoBarra, cfg, posiciones, rotaciones, euler, cuaternion) {
  const inclinacion = Math.atan2(altoBarra, cfg.radio * cfg.caidaInclinacion);
  const mitad = ((cfg.cantidad - 1) * altoBarra) / 2;
  for (let i = 0; i < cfg.cantidad; i += 1) {
    const s = envolver(i + fase, cfg.cantidad);
    const theta = s * cfg.pasoTheta + cfg.desfaseTheta;
    posiciones[i * 3] = cfg.radio * Math.cos(theta);
    posiciones[i * 3 + 1] = s * altoBarra - mitad;
    posiciones[i * 3 + 2] = cfg.radio * Math.sin(theta);
    euler.set(inclinacion, -theta, 0);
    cuaternion.setFromEuler(euler);
    rotaciones[i * 4] = cuaternion.x;
    rotaciones[i * 4 + 1] = cuaternion.y;
    rotaciones[i * 4 + 2] = cuaternion.z;
    rotaciones[i * 4 + 3] = cuaternion.w;
  }
}

// Barra lisa: una cápsula con muchos segmentos de contorno pero uno solo a lo largo, con las
// medidas del modelo del original (0,2 de grosor, 0,4 de alto, 2,5 de largo). El modelo traía
// pocos polígonos y al hacer zoom se veían sus lados rectos. Sección elíptica: se arma redonda
// de radio 0,2 y se aplana en x. Un solo segmento a lo largo es a propósito: con más (probé 10
// y 40) las tiras quedan de pocos píxeles de ancho y, en triángulos tan finos, la GPU calcula
// mal el detalle de las texturas: el logo, el nombre y el fondo refractado salen rayados.
export function crearBarra() {
  const barra = new CapsuleGeometry(0.2, 2.1, 24, 96, 1);
  barra.rotateX(Math.PI / 2); // de vertical (y) a lo largo de z
  barra.scale(0.5, 1, 1);
  return barra;
}

// Esferas del árbol: una malla propia (una esfera necesita muchos segmentos) que comparte con la
// barra todos los atributos por instancia (posición, giro, tinte, habilidad, golpe, resalte,
// filtro). `aEsfera` es la dirección unitaria de cada vértice (en una esfera unidad, su posición).
export function crearGeometriaEsferas(base) {
  const esfera = new SphereGeometry(1, 44, 30);
  const geometria = new InstancedBufferGeometry();
  geometria.index = esfera.index;
  geometria.setAttribute('position', esfera.getAttribute('position'));
  geometria.setAttribute('normal', esfera.getAttribute('normal'));
  geometria.setAttribute('uv', esfera.getAttribute('uv'));
  geometria.setAttribute('aEsfera', esfera.getAttribute('position'));
  ['aPos', 'aRot', 'aTintOffset', 'aSkill', 'aStrikeTime', 'aResalte', 'aActiva'].forEach((nombre) => geometria.setAttribute(nombre, base.getAttribute(nombre)));
  geometria.instanceCount = base.instanceCount;
  return geometria;
}

// Geometría instanciada a partir de la barra del modelo: una instancia por lugar de la hélice.
// `habilidadDe(i)` da el índice en el atlas de logos de la barra i.
export function armarGeometria(modelo, cfg, habilidadDe) {
  modelo.computeBoundingBox();
  const caja = modelo.boundingBox;
  const alto = caja.max.y - caja.min.y;
  const posiciones = new Float32Array(cfg.cantidad * 3);
  const rotaciones = new Float32Array(cfg.cantidad * 4);
  escribirHelice(0, alto, cfg, posiciones, rotaciones, new Euler(0, 0, 0, 'YXZ'), new Quaternion());
  const desfasesTinte = new Float32Array(cfg.cantidad);
  const habilidades = new Float32Array(cfg.cantidad);
  for (let i = 0; i < cfg.cantidad; i += 1) {
    desfasesTinte[i] = i / cfg.cantidad;
    habilidades[i] = habilidadDe(i);
  }

  const geometria = new InstancedBufferGeometry();
  geometria.index = modelo.index;
  geometria.setAttribute('position', modelo.getAttribute('position'));
  geometria.setAttribute('normal', modelo.getAttribute('normal'));
  geometria.setAttribute('uv', modelo.getAttribute('uv'));
  geometria.setAttribute('aPos', new InstancedBufferAttribute(posiciones, 3));
  geometria.setAttribute('aRot', new InstancedBufferAttribute(rotaciones, 4));
  geometria.setAttribute('aTintOffset', new InstancedBufferAttribute(desfasesTinte, 1));
  geometria.setAttribute('aSkill', new InstancedBufferAttribute(habilidades, 1));
  // -1e9 = nunca golpeada: el vaivén queda en 0
  const golpes = new InstancedBufferAttribute(new Float32Array(cfg.cantidad).fill(-1e9), 1);
  geometria.setAttribute('aStrikeTime', golpes);
  const resaltes = new InstancedBufferAttribute(new Float32Array(cfg.cantidad), 1);
  geometria.setAttribute('aResalte', resaltes);
  // 1 = de la categoría filtrada (o sin filtro), 0 = apagada
  const activas = new InstancedBufferAttribute(new Float32Array(cfg.cantidad).fill(1), 1);
  geometria.setAttribute('aActiva', activas);
  geometria.instanceCount = cfg.cantidad;

  return { geometria, caja: new Box3().copy(caja), alto, posiciones, rotaciones, golpes, resaltes, activas };
}
