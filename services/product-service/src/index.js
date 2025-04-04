require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { sequelize } = require('./models');
const { setupMessageConsumer } = require('./messaging/consumer');
const logger = require('./utils/logger');

// Rutas
const productRoutes = require('./routes/products');
const categoryRoutes = require('./routes/categories');
const inventoryRoutes = require('./routes/inventory');

// Inicializar app
const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Conexión a MySQL
const connectDB = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Conexión a MySQL establecida correctamente');
    
    // Sincronizar modelos con la base de datos (en desarrollo)
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      logger.info('Modelos sincronizados con la base de datos');
    }
  } catch (error) {
    logger.error(`Error al conectar a MySQL: ${error.message}`);
    process.exit(1);
  }
};

// Rutas de la API
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/inventory', inventoryRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', message: 'Product Service is running!' });
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
  logger.info(`Servicio de productos corriendo en http://localhost:${PORT}`);
  
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
    process.exit(0);
  });
});

module.exports = app; // Para pruebas