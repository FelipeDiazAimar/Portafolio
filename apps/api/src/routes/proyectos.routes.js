const { Router } = require('express');
const { getProyectos } = require('../controllers/proyectos.controller');

const router = Router();
router.get('/', getProyectos);

module.exports = router;
