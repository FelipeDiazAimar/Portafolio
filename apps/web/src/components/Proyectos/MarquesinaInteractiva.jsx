'use client';

import estilos from './MarquesinaInteractiva.module.css';

// Marquesina interactiva de logos con el look 3D del marquee original.
// El padre entrega los logos ya filtrados; aquí no se filtra nada.
// Son 2 copias del mismo array para que el loop del CSS sea seamless.
export default function MarquesinaInteractiva({ logos, activoSlug, alElegir, alSalir }) {
  const lista = Array.isArray(logos) ? logos : [];

  // Dos copias idénticas del mismo array: el CSS desplaza la pista
  // translateX(-50%) y el ×2 hace el loop seamless.
  const copias = [0, 1];

  // Una celda por logo: accesible por teclado y táctil.
  const renderizarCelda = (proyecto, copia) => {
    const esActiva = proyecto.slug === activoSlug;
    return (
      <div
        key={`${proyecto.slug}-${copia}`}
        className={estilos.celda}
        role="button"
        tabIndex={0}
        aria-label={proyecto.titulo}
        data-slug={proyecto.slug}
        data-activa={esActiva ? 'true' : 'false'}
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') alElegir(proyecto.slug);
        }}
        onFocus={() => alElegir(proyecto.slug)}
        onClick={() => alElegir(proyecto.slug)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            alElegir(proyecto.slug);
          }
        }}
      >
        <img
          className={estilos.logo}
          src={proyecto.logo}
          alt={proyecto.titulo}
          draggable={false}
        />
      </div>
    );
  };

  return (
    <div
      style={{
        overflow: 'hidden',
        perspective: '1200px',
        maskImage:
          'linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)',
        WebkitMaskImage:
          'linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)',
      }}
    >
      <div
        className={estilos.pista}
        style={{
          transform: 'rotateX(55deg) rotateY(0deg) rotateZ(-45deg)',
          transformStyle: 'preserve-3d',
        }}
        onPointerLeave={() => alSalir()}
      >
        {copias.map((copia) => (
          <div key={`columna-${copia}`} className={estilos.columna}>
            {lista.map((proyecto) => renderizarCelda(proyecto, copia))}
          </div>
        ))}
      </div>
    </div>
  );
}
