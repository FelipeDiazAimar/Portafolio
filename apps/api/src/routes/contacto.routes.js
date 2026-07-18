const { Router } = require('express');
const { postContacto } = require('../controllers/contacto.controller');

const router = Router();
router.post('/', postContacto);

module.exports = router;
