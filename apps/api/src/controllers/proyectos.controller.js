const { listProyectos } = require('../services/proyectos.service');

async function getProyectos(req, res, next) {
  try {
    const proyectos = await listProyectos();
    res.json({ proyectos });
  } catch (err) {
    next(err);
  }
}

module.exports = { getProyectos };
