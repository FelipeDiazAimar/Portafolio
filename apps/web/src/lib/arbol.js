// Diseño del árbol de habilidades circular (vista alternativa del xilófono). Puro: sin three ni
// DOM, para poder probarlo.
//
// Un núcleo al centro; alrededor, un nodo por categoría ("hub"); de cada hub salen ramas
// ("cadenas") que se abren en abanico hacia afuera, y cada rama lleva sus tecnologías en
// anillos concéntricos. Cada tecnología es una de las 64 barras del xilófono, que en el árbol
// pasa a ser una esfera de vidrio sobre el plano (ver radioEsfera).
//
// Coordenadas en el espacio del eje del modelo: el árbol yace en el plano x-z (y es la altura).

// Medidas de la barra del xilófono (semiejes, en su espacio local). En el árbol la barra se
// deforma hasta ser una esfera (ver radioEsfera).
export const BARRA = { semiX: 0.1, semiY: 0.2, semiZ: 1.25 };

export const ARBOL = {
  // radio de cada nivel de la rama (el nivel 0 es el más cercano al centro)
  anillos: [3.1, 4.15, 5.2],
  // radio de los nodos de categoría: alternan entre dos distancias para que sus aros, que llevan
  // el nombre de la categoría, no se pisen entre vecinos
  radioHub: [1.55, 2.15],
  radioEtiqueta: 6.0,
  // ángulo libre entre una categoría y la siguiente
  hueco: 0.08,
  alturas: [0, 0.05, 0.1],
  // radio de la esfera de cada tecnología
  radioEsfera: 0.3,
};

// Devuelve:
//  nodos[barra]   → { barra, tecnologia, categoria (índice de hub), cadena, nivel, angulo,
//                     theta (giro en y para que la barra mire hacia afuera), x, y, z }
//  hubs[k]        → { id, nombre, angulo, x, y, z, etiqueta: {x, y, z}, barras: [] }
//  aristas[i]     → { de: [x, y, z], a: [x, y, z], hub, barra (-1 si es núcleo→hub) }
//  rutas[barra]   → índices de las aristas del camino núcleo → hub → … → esa barra
//  recorrido      → barras en el orden en que las recorre la luz (rama por rama, hacia afuera)
// `orden[barra]` = índice de la tecnología que lleva esa barra.
export function disposicionArbol(categorias, orden, tecnologias, cfg = ARBOL) {
  const porId = new Map(tecnologias.map((t, i) => [t.id, i]));
  const barraDe = new Map(orden.map((tecnologia, barra) => [tecnologia, barra]));
  const niveles = cfg.anillos.length;

  // categorías con sus tecnologías; las que ninguna nombra van a una categoría "Otras"
  const usadas = new Set();
  const grupos = categorias.map((categoria) => {
    const ids = [];
    categoria.tecnologias.forEach((id) => {
      if (porId.has(id) && !usadas.has(id)) {
        usadas.add(id);
        ids.push(id);
      }
    });
    return { id: categoria.id, nombre: categoria.nombre, ids };
  });
  const resto = tecnologias.map((t) => t.id).filter((id) => !usadas.has(id));
  if (resto.length) grupos.push({ id: 'otras', nombre: 'Otras', ids: resto });

  const cadenasDe = grupos.map((g) => Math.max(1, Math.ceil(g.ids.length / niveles)));
  const totalCadenas = cadenasDe.reduce((suma, c) => suma + c, 0);
  const porCadena = (Math.PI * 2 - cfg.hueco * grupos.length) / totalCadenas;

  const nodos = new Array(orden.length);
  const hubs = [];
  const aristas = [];
  const rutas = new Array(orden.length);
  const recorrido = [];

  let angulo = -Math.PI / 2; // la primera categoría arranca arriba
  grupos.forEach((g, k) => {
    const cadenas = cadenasDe[k];
    const a0 = angulo + cfg.hueco / 2;
    const ancho = porCadena * cadenas;
    const medio = a0 + ancho / 2;
    const radioHub = Array.isArray(cfg.radioHub) ? cfg.radioHub[k % cfg.radioHub.length] : cfg.radioHub;
    const hub = {
      id: g.id,
      nombre: g.nombre,
      angulo: medio,
      x: Math.cos(medio) * radioHub,
      y: 0,
      z: Math.sin(medio) * radioHub,
      etiqueta: { x: Math.cos(medio) * cfg.radioEtiqueta, y: 0.15, z: Math.sin(medio) * cfg.radioEtiqueta },
      barras: [],
    };
    hubs.push(hub);
    const aristaHub = aristas.length;
    aristas.push({ de: [0, 0, 0], a: [hub.x, hub.y, hub.z], hub: k, barra: -1 });

    // reparto salteado: la rama c lleva las tecnologías c, c + cadenas, c + 2·cadenas…
    const ramas = Array.from({ length: cadenas }, () => []);
    g.ids.forEach((id, j) => ramas[j % cadenas].push(id));
    ramas.forEach((ids, c) => {
      const phi = a0 + ((c + 0.5) / cadenas) * ancho;
      let previo = [hub.x, hub.y, hub.z];
      let ruta = [aristaHub];
      ids.forEach((id, nivel) => {
        const barra = barraDe.get(porId.get(id));
        const radio = cfg.anillos[Math.min(nivel, niveles - 1)];
        const posicion = [Math.cos(phi) * radio, cfg.alturas[nivel] ?? 0, Math.sin(phi) * radio];
        nodos[barra] = {
          barra,
          tecnologia: porId.get(id),
          categoria: k,
          cadena: c,
          nivel,
          angulo: phi,
          theta: Math.PI / 2 - phi,
          x: posicion[0],
          y: posicion[1],
          z: posicion[2],
        };
        aristas.push({ de: previo, a: posicion, hub: k, barra });
        ruta = [...ruta, aristas.length - 1];
        rutas[barra] = ruta;
        previo = posicion;
        hub.barras.push(barra);
        recorrido.push(barra);
      });
    });
    angulo += ancho + cfg.hueco;
  });

  return { nodos, hubs, aristas, rutas, recorrido, cfg };
}
