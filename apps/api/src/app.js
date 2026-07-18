const express = require('express');
const corsMiddleware = require('./middlewares/cors');
const errorHandler = require('./middlewares/errorHandler');
const proyectosRoutes = require('./routes/proyectos.routes');
const contactoRoutes = require('./routes/contacto.routes');

const app = express();

app.use(corsMiddleware);
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/proyectos', proyectosRoutes);
app.use('/api/contacto', contactoRoutes);

app.use(errorHandler);

module.exports = app;
