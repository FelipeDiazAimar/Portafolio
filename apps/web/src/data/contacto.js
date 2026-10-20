// Datos de contacto (los mismos del CV) y mensajes predefinidos del slide.
export const NUMERO_WHATSAPP = '5493564690844';
export const CORREO = 'felipediazaimar@gmail.com';

// `icono` es la clave del ícono en components/Contacto/iconos.jsx.
export const DATOS_CONTACTO = [
  { id: 'whatsapp', icono: 'whatsapp', etiqueta: 'WhatsApp', valor: '+54 9 3564 690844', corto: '+54 9 3564 690844', copiar: '+54 9 3564 690844' },
  { id: 'email', icono: 'email', etiqueta: 'Email', valor: CORREO, corto: CORREO, copiar: CORREO },
  { id: 'linkedin', icono: 'linkedin', etiqueta: 'LinkedIn', valor: 'linkedin.com/in/felipe-aimar', corto: '/in/felipe-aimar', copiar: 'https://www.linkedin.com/in/felipe-aimar' },
  { id: 'github', icono: 'github', etiqueta: 'GitHub', valor: 'github.com/FelipeDiazAimar', corto: '/FelipeDiazAimar', copiar: 'https://github.com/FelipeDiazAimar' },
  { id: 'ubicacion', icono: 'ubicacion', etiqueta: 'Ubicación', valor: 'San Francisco, Córdoba, Argentina', corto: 'San Francisco, Córdoba, AR', copiar: 'San Francisco, Córdoba, Argentina' },
  { id: 'horario', icono: 'horario', etiqueta: 'Disponibilidad', valor: 'Full time · jornada completa', corto: 'Full time', copiar: 'Disponibilidad full time' },
];

export const MENSAJES = {
  proyecto: { chip: 'Proyecto', texto: 'Hola Felipe, vi tu portafolio y tengo un proyecto en mente. ¿Charlamos esta semana?', asunto: 'Tengo un proyecto' },
  colab: { chip: 'Colaboración', texto: 'Hola Felipe, me encantó tu trabajo. ¿Te interesa que colaboremos en algo juntos?', asunto: 'Colaboración' },
  saludo: { chip: 'Solo saludar', texto: 'Hola Felipe, solo pasaba a decirte que tu portafolio está buenísimo. ¡Saludos!', asunto: 'Hola' },
  empresa: { chip: 'Queremos trabajar con vos', texto: 'Hola Felipe, somos un equipo y queremos trabajar con vos. ¿Hablamos esta semana?', asunto: 'Queremos trabajar con vos' },
};

export const MENSAJE_NERVIOSO = 'Hola Felipe, perdón, me puse nervioso… ¿empezamos de nuevo?';
