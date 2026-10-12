'use client';

// Muro decorativo de portadas para el fondo del panel de Proyectos.
// Usa ThreeDMarquee con las imágenes del catálogo local.
import { useMemo } from 'react';
import { ThreeDMarquee } from '@/components/ui/3d-marquee.jsx';
import { listarProyectos } from '@/lib/proyectos';
import useConsulta from '@/hooks/useConsulta';
import estilos from './MuroProyectos.module.css';

// Cantidad mínima de imágenes en escritorio.
const MINIMO_ESCRITORIO = 32;
// Cantidad recortada para celular.
const MINIMO_CELULAR = 16;
// Punto de corte que define el diseño de celular.
const CONSULTA_CELULAR = '(max-width: 768px)';

// Repite la lista base hasta alcanzar el mínimo pedido.
// Si la lista base está vacía, devuelve una lista vacía.
function repetirHastaMinimo(listaBase, minimo) {
  if (!Array.isArray(listaBase) || listaBase.length === 0) return [];
  let listaRepetida = [...listaBase];
  while (listaRepetida.length < minimo) {
    listaRepetida = [...listaRepetida, ...listaBase];
  }
  return listaRepetida;
}

// Fondo animado que ocupa todo el .panel del contenedor.
// Encima del muro se pinta una capa de oscurecido radial.
export default function MuroProyectos() {
  // Detecta si la vista es de celular.
  const esCelular = useConsulta(CONSULTA_CELULAR);

  // Construye la lista final de imágenes (memorizada por vista).
  const imagenesFinales = useMemo(() => {
    // Lee el catálogo ordenado de proyectos.
    const proyectos = listarProyectos();
    // Extrae la portada y la vista móvil de cada proyecto.
    const imagenesBase = proyectos.flatMap((proyecto) => (
      [proyecto.imagenes?.portada, proyecto.imagenes?.movil].filter(Boolean)
    ));
    // Repite el arreglo hasta tener al menos 32 elementos.
    const imagenesRepetidas = repetirHastaMinimo(imagenesBase, MINIMO_ESCRITORIO);
    // En celular recorta a 16 imágenes.
    if (esCelular) return imagenesRepetidas.slice(0, MINIMO_CELULAR);
    return imagenesRepetidas;
  }, [esCelular]);

  return (
    <div className={estilos.muro} aria-hidden="true">
      <ThreeDMarquee
        images={imagenesFinales}
        className={`${estilos.marquesina} h-full w-full rounded-none max-sm:h-full`}
      />
      <div className={estilos.oscurecido} aria-hidden="true" />
    </div>
  );
}
