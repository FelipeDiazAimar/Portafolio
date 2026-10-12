import {
  SiNextdotjs,
  SiReact,
  SiVite,
  SiTypescript,
  SiJavascript,
  SiTailwindcss,
  SiShadcnui,
  SiMui,
  SiFramer,
  SiReactquery,
  SiNodedotjs,
  SiExpress,
  SiSocketdotio,
  SiGo,
  SiPython,
  SiFlask,
  SiPhp,
  SiSupabase,
  SiPostgresql,
  SiMysql,
  SiSqlite,
  SiSequelize,
  SiFirebase,
  SiSap,
  SiGooglegemini,
  SiMercadopago,
  SiCloudflare,
  SiWhatsapp,
  SiElectron,
  SiExpo,
  SiDocker,
  SiKubernetes,
  SiVercel,
  SiRender,
} from 'react-icons/si';
import { TECNOLOGIAS } from '@/data/tecnologias.js';
import estilos from './iconosTecnologias.module.css';

// Mapa de nombre de componente -> componente real de react-icons/si.
export const ICONOS = {
  SiNextdotjs,
  SiReact,
  SiVite,
  SiTypescript,
  SiJavascript,
  SiTailwindcss,
  SiShadcnui,
  SiMui,
  SiFramer,
  SiReactquery,
  SiNodedotjs,
  SiExpress,
  SiSocketdotio,
  SiGo,
  SiPython,
  SiFlask,
  SiPhp,
  SiSupabase,
  SiPostgresql,
  SiMysql,
  SiSqlite,
  SiSequelize,
  SiFirebase,
  SiSap,
  SiGooglegemini,
  SiMercadopago,
  SiCloudflare,
  SiWhatsapp,
  SiElectron,
  SiExpo,
  SiDocker,
  SiKubernetes,
  SiVercel,
  SiRender,
};

// Muestra el ícono de la tecnología con el `id` dado.
// Si `icono` es null o no existe en el mapa, muestra la `sigla` como alternativa.
export function IconoTecnologia({ id, className }) {
  const tecnologia = TECNOLOGIAS.find((t) => t.id === id) ?? null;

  // Identificador desconocido: no se muestra nada.
  if (!tecnologia) return null;

  const ComponenteIcono = tecnologia.icono ? ICONOS[tecnologia.icono] : null;

  // Sin ícono disponible: alternativa textual con la sigla.
  if (!ComponenteIcono) {
    const claseSigla = className ? `${estilos.sigla} ${className}` : estilos.sigla;
    return (
      <span className={claseSigla} title={tecnologia.nombre} aria-label={tecnologia.nombre}>
        {tecnologia.sigla}
      </span>
    );
  }

  return <ComponenteIcono className={className} title={tecnologia.nombre} aria-label={tecnologia.nombre} />;
}
