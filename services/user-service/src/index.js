require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const mongoose = require('mongoose');
const { setupMessageConsumer } = require('./messaging/consumer');
const logger = require('./utils/logger');

// Rutas
const userRoutes = require('./routes/users');
const profileRoutes = require('./routes/profiles');
const addressRoutes = require('./routes/addresses');

// Inicializar app
const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Conexión a MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://mongodb:27017/users', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    logger.info(`MongoDB conectado: ${conn.connection.host}`);
  } catch (error) {
    logger.error(`Error al conectar a MongoDB: ${error.message}`);
    process.exit(1);
  }
};

// Rutas de la API
app.use('/api/users', userRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/addresses', addressRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', message: 'User Service is running!' });
});

// Métricas para Prometheus
app.get('/metrics', (req, res) => {
  res.status(200).send('# Métricas disponibles para Prometheus');
});

// Manejo de errores
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(err.statusCode || 500).json({
    status: 'error',
    message: err.message || 'Error interno del servidor',
  });
});

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
});

// Iniciar el servidor
const server = app.listen(PORT, async () => {
  await connectDB();
  logger.info(`Servicio de usuarios corriendo en http://localhost:${PORT}`);
  
  // Iniciar consumidores de mensajes
  try {
    await setupMessageConsumer();
    logger.info('Consumidor de mensajes RabbitMQ iniciado');
  } catch (error) {
    logger.error(`Error al iniciar consumidor de mensajes: ${error.message}`);
  }
});

// Manejo de excepciones no capturadas
process.on('uncaughtException', (error) => {
  logger.error('Excepción no capturada:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Promesa rechazada no manejada:', reason);
});

// Manejo de señales de terminación
process.on('SIGTERM', () => {
  logger.info('SIGTERM recibido. Cerrando servidor...');
  server.close(() => {
    logger.info('Servidor cerrado.');
    mongoose.connection.close(false, () => {
      logger.info('Conexión a MongoDB cerrada.');
      process.exit(0);
    });
  });
});

module.exports = app; // Para pruebas