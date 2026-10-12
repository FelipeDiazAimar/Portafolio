'use client';

// Muro decorativo de portadas para el fondo del panel de Proyectos.
// Usa ThreeDMarquee con las imágenes del catálogo local.
import { useMemo } from 'react';
import { ThreeDMarquee } from '@/components/ui/3d-marquee.jsx';
import { listarProyectos } from '@/lib/proyectos';
import useConsulta from '@/hooks/useConsulta';
import estilos from './MuroProyectos.module.css';

// Cantidad recortada para celular.
const MINIMO_CELULAR = 16;
// Punto de corte que define el diseño de celular.
const CONSULTA_CELULAR = '(max-width: 768px)';

// Fondo animado que ocupa todo el .panel del contenedor.
// Encima del muro se pinta una capa de oscurecido radial.
export default function MuroProyectos({ excluirSlug }) {
  // Detecta si la vista es de celular.
  const esCelular = useConsulta(CONSULTA_CELULAR);

  // Construye la lista final de imágenes (memorizada por vista).
  const imagenesFinales = useMemo(() => {
    // Lee el catálogo ordenado de proyectos, excluyendo el del primer plano.
    const proyectos = listarProyectos().filter((proyecto) => proyecto.slug !== excluirSlug);
    // Logo único de cada proyecto (portada como respaldo), sin repetir.
    const imagenesBase = proyectos
      .map((proyecto) => proyecto.imagenes?.logo ?? proyecto.imagenes?.portada)
      .filter(Boolean);
    // En celular recorta a 16 imágenes (con 13 queda tal cual).
    if (esCelular) return imagenesBase.slice(0, MINIMO_CELULAR);
    return imagenesBase;
  }, [esCelular, excluirSlug]);

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
