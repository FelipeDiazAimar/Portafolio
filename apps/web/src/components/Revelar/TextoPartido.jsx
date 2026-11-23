// Texto partido en letras o palabras (el SplitType de Lusion, pero en React: los spans los arma el
// render y no se toca el DOM a mano). Cada unidad va en una máscara (`rv-u`, overflow oculto) con
// su contenido (`rv-i`) que el Revelador sube desde abajo, atado al scroll.
// `modo`: 'letras' | 'palabras'. El texto completo queda en aria-label.
import { Fragment } from 'react';

export default function TextoPartido({ texto, modo = 'letras', como: Etiqueta = 'span', className, ...resto }) {
  const palabras = String(texto).split(/(\s+)/);
  return (
    <Etiqueta className={className} aria-label={texto} {...resto}>
      {palabras.map((p, i) => {
        if (/^\s+$/.test(p)) return <Fragment key={i}> </Fragment>;
        if (!p) return null;
        if (modo === 'palabras') {
          return (
            <span key={i} className="rv-u" aria-hidden="true">
              <span className="rv-i">{p}</span>
            </span>
          );
        }
        return (
          <span key={i} className="rv-p" aria-hidden="true">
            {[...p].map((c, j) => (
              <span key={j} className="rv-u">
                <span className="rv-i">{c}</span>
              </span>
            ))}
          </span>
        );
      })}
    </Etiqueta>
  );
}
