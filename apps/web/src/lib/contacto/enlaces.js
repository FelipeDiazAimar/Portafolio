// Enlaces de salida del contacto y estado según la hora de Argentina.
export function urlWhatsApp(numero, texto) {
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

export function urlCorreo(correo, asunto, cuerpo) {
  return `mailto:${correo}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
}

export function horaArgentina(fecha = new Date()) {
  const hora = new Intl.DateTimeFormat('es-AR', {
    hour: 'numeric',
    hourCycle: 'h23',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(fecha);
  return Number(hora);
}

export function estadoPorHora(hora) {
  const durmiendo = hora < 9 || hora >= 23;
  return {
    durmiendo,
    texto: durmiendo ? 'Ahora duermo, respondo a las 9' : 'Respondo en menos de 1 h',
  };
}
