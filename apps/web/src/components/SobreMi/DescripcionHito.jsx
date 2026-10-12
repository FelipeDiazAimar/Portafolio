import { dividirResaltado } from '@/lib/resaltado.js';
import { useMemo } from 'react';
import BioDibujada from './BioDibujada.jsx';
import styles from './DescripcionHito.module.css';

// La biografía se escribe a trazo cuando el detalle se abre (ver BioDibujada). El
// texto real está siempre en el DOM para los lectores de pantalla.
export default function DescripcionHito({ hito, visible }) {
  const partes = useMemo(() => dividirResaltado(hito.descripcion), [hito.descripcion]);
  return (
    <div className={`${styles.descripcion} ${visible ? styles.visible : ''}`}>
      <BioDibujada key={hito.id} partes={partes} visible={visible} />
      {hito.credito ? (
        <p className={styles.credito}>
          <a href={hito.credito.url} target="_blank" rel="noopener noreferrer">
            {hito.credito.texto}
          </a>
        </p>
      ) : null}
    </div>
  );
}
