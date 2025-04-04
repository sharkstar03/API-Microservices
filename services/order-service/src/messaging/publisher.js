const amqp = require('amqplib');
const logger = require('../utils/logger');

// Configuración
const EXCHANGE_NAME = 'order_events';
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';

// Variable para mantener la conexión
let channel = null;

/**
 * Inicializa la conexión a RabbitMQ y crea el canal
 */
const setupChannel = async () => {
  if (channel) return channel;

  try {
    // Conectar a RabbitMQ
    const connection = await amqp.connect(RABBITMQ_URL);
    
    // Manejar eventos de error y cierre
    connection.on('error', (err) => {
      logger.error('Error en conexión RabbitMQ:', err);
      channel = null;
    });
    
    connection.on('close', () => {
      logger.info('Conexión RabbitMQ cerrada');
      channel = null;
      // Reintentar conexión después de un tiempo
      setTimeout(() => setupChannel(), 5000);
    });

    // Crear canal
    channel = await connection.createChannel();
    
    // Declarar exchange
    await channel.assertExchange(EXCHANGE_NAME, 'topic', {
      durable: true,
    });
    
    logger.info('Conexión RabbitMQ establecida');
    return channel;
  } catch (error) {
    logger.error('Error al configurar canal RabbitMQ:', error);
    channel = null;
    // Reintentar conexión después de un tiempo
    setTimeout(() => setupChannel(), 5000);
    throw error;
  }
};

/**
 * Publica un evento relacionado con órdenes
 * @param {string} routingKey - Clave de enrutamiento (ej: 'order.created')
 * @param {Object} data - Datos del evento
 */
const publishOrderEvent = async (routingKey, data) => {
  try {
    // Asegurar que tenemos un canal
    const ch = await setupChannel();
    
    // Construir mensaje
    const message = {
      event: routingKey,
      data,
      timestamp: new Date().toISOString(),
    };
    
    // Publicar mensaje
    const success = ch.publish(
      EXCHANGE_NAME,
      routingKey,
      Buffer.from(JSON.stringify(message)),
      {
        persistent: true,  // Mensaje persistente
        contentType: 'application/json',
      }
    );
    
    if (success) {
      logger.debug(`Evento publicado: ${routingKey}`);
    } else {
      logger.warn(`No se pudo publicar el evento: ${routingKey}`);
    }
    
    return success;
  } catch (error) {
    logger.error(`Error al publicar evento ${routingKey}:`, error);
    throw error;
  }
};

module.exports = {
  setupChannel,
  publishOrderEvent,
};