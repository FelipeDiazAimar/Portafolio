const { CONTACT_EMAIL_TO } = require('../config/env');

async function submitContacto({ nombre, email, mensaje } = {}) {
  if (!nombre || !email || !mensaje) {
    const err = new Error('Faltan campos requeridos: nombre, email, mensaje');
    err.status = 400;
    throw err;
  }

  console.log(`[contacto] Nuevo mensaje para ${CONTACT_EMAIL_TO || '(sin destino configurado)'}:`, {
    nombre,
    email,
    mensaje,
  });

  return { recibido: true };
}

module.exports = { submitContacto };
