const { submitContacto } = require('../services/contacto.service');

async function postContacto(req, res, next) {
  try {
    const resultado = await submitContacto(req.body);
    res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
}

module.exports = { postContacto };
