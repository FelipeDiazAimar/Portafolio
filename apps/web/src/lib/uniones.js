// Fundido de las uniones entre secciones (sin DOM, para poder probarlo).
//
// Cada sección a pantalla completa se funde con el color de la página por sus bordes, pero SOLO
// mientras ese borde se ve: con la sección ocupando toda la vista el fundido mide 0 y el contenido
// queda intacto. Si el degradado fuera fijo, el borde de arriba oscurecería siempre el primer
// tramo de la sección, también en reposo.

// `top` y `bottom`: rect de la sección respecto de la ventana (getBoundingClientRect). `vh`: alto de
// la ventana. `fraccion`: cuánto de la ventana puede llegar a medir el fundido (0..1).
// Devuelve el alto (px) del fundido de arriba y del de abajo.
export function bandasDeUnion(top, bottom, vh, fraccion = 0.4) {
  const tope = vh * fraccion;
  const limitar = (v) => Math.min(tope, Math.max(0, v));
  return {
    // el borde de arriba se ve cuando la sección empieza más abajo del tope de la ventana
    arriba: Math.round(limitar(top)),
    // el de abajo, cuando termina más arriba del pie de la ventana
    abajo: Math.round(limitar(vh - bottom)),
  };
}

// Paradas de la curva suave (smoothstep) del fundido: fracción del largo de la banda → opacidad.
export const PARADAS_FUNDIDO = [
  [0, 0],
  [0.1, 0.028],
  [0.2, 0.104],
  [0.35, 0.282],
  [0.5, 0.5],
  [0.65, 0.718],
  [0.8, 0.896],
  [0.9, 0.972],
  [1, 1],
];

// `mask-image` con los dos fundidos (variables CSS `--banda-arriba` y `--banda-abajo`, en px).
// Transparente en el borde y opaco hacia adentro, con curva suave: un degradado lineal deja un
// escalón visible donde empieza.
export function mascaraDeUnion(arriba = true, abajo = true) {
  const parar = (alfa) => (alfa === 1 ? '#000' : `rgba(0, 0, 0, ${alfa})`);
  const partes = [];
  if (arriba) {
    PARADAS_FUNDIDO.forEach(([k, alfa]) => {
      const posicion = k === 0 ? '0' : k === 1 ? 'var(--banda-arriba)' : `calc(var(--banda-arriba) * ${k})`;
      partes.push(`${alfa === 0 ? 'transparent' : parar(alfa)} ${posicion}`);
    });
  } else {
    partes.push('#000 0');
  }
  if (abajo) {
    [...PARADAS_FUNDIDO].reverse().forEach(([k, alfa]) => {
      const posicion = k === 0 ? '100%' : k === 1 ? 'calc(100% - var(--banda-abajo))' : `calc(100% - var(--banda-abajo) * ${k})`;
      partes.push(`${alfa === 0 ? 'transparent' : parar(alfa)} ${posicion}`);
    });
  } else {
    partes.push('#000 100%');
  }
  return `linear-gradient(to bottom, ${partes.join(', ')})`;
}
