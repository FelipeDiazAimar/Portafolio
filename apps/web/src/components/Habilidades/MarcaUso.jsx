import { listarProyectos } from '@/lib/proyectos.js';
import estilos from './MarcaUso.module.css';

// Proyectos donde se usó cada tecnología: nombre corto (lo que va antes del " · ") y cantidad.
let usos = null;
function proyectosDe(id) {
  if (!usos) {
    usos = new Map();
    for (const proyecto of listarProyectos()) {
      for (const tec of proyecto.stack ?? []) {
        if (!usos.has(tec)) usos.set(tec, []);
        usos.get(tec).push(proyecto.titulo);
      }
    }
  }
  return usos.get(id) ?? [];
}

const MAX = 4;

// Marca de puntería sobre la barra resaltada de la hélice: una línea guía en L que sale de la barra,
// termina en una cruz y lleva escritos los proyectos donde se usó esa tecnología. La posición la
// mueve el motor 3D cuadro a cuadro sobre `refMarca` (transform y data-visible), sin pasar por React;
// acá sólo cambia el contenido cuando cambia la tecnología.
export default function MarcaUso({ refMarca, tecnologia }) {
  const lista = tecnologia ? proyectosDe(tecnologia.id) : [];
  const visibles = lista.slice(0, MAX);
  const resto = lista.length - visibles.length;
  return (
    <div ref={refMarca} className={estilos.marca} data-visible="false" aria-hidden="true">
      {tecnologia && (
        <div key={tecnologia.id} className={estilos.contenido}>
          <svg className={estilos.trazo} viewBox="-8 -68 108 76" width="108" height="76" focusable="false">
            <path className={estilos.guia} d="M0 0 L84 -58" pathLength="1" />
            <path className={estilos.cruz} d="M0 -4 V4 M-4 0 H4" />
            <path className={estilos.cruz} d="M84 -62 V-54 M80 -58 H88" />
          </svg>
          <div className={estilos.texto} data-texto>
            {visibles.join(' · ')}
            {resto > 0 ? ` · +${resto} más` : ''}
          </div>
        </div>
      )}
    </div>
  );
}
