const cors = require('cors');
const { ALLOWED_ORIGINS } = require('../config/env');

module.exports = cors({
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
});
