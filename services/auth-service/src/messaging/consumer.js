const amqp = require('amqplib');
const logger = require('../utils/logger');

// Configuración
const EXCHANGE_NAME = 'user_events';
const QUEUE_NAME = 'auth_service_queue';
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';

// Variable para mantener la conexión
let connection = null;
let channel = null;

/**
 * Configura el consumidor de mensajes
 */
const setupMessageConsumer = async () => {
  try {
    // Conectar a RabbitMQ
    connection = await amqp.connect(RABBITMQ_URL);
    
    // Manejar eventos de error y cierre
    connection.on('error', (err) => {
      logger.error('Error en conexión RabbitMQ consumer:', err);
      channel = null;
      connection = null;
    });
    
    connection.on('close', () => {
      logger.info('Conexión RabbitMQ consumer cerrada');
      channel = null;
      connection = null;
      // Reintentar conexión después de un tiempo
      setTimeout(() => setupMessageConsumer(), 5000);
    });

    // Crear canal
    channel = await connection.createChannel();
    
    // Configurar prefetch (número de mensajes que procesa simultáneamente)
    await channel.prefetch(1);
    
    // Declarar exchange
    await channel.assertExchange(EXCHANGE_NAME, 'topic', {
      durable: true,
    });
    
    // Declarar cola
    const { queue } = await channel.assertQueue(QUEUE_NAME, {
      durable: true,
      // Configurar Dead Letter Exchange para mensajes fallidos
      arguments: {
        'x-dead-letter-exchange': `${EXCHANGE_NAME}_dlx`,
        'x-dead-letter-routing-key': 'dead.letter',
      },
    });
    
    // Eventos a los que se suscribe este servicio
    const bindingPatterns = [
      'user.role_updated',
      'user.deactivated',
      'user.reactivated',
      'user.deleted'
    ];
    
    // Enlazar cola con exchange usando los patrones definidos
    for (const pattern of bindingPatterns) {
      await channel.bindQueue(queue, EXCHANGE_NAME, pattern);
      logger.info(`Suscrito a: ${pattern}`);
    }
    
    // Configurar consumidor
    await channel.consume(queue, handleMessage, {
      noAck: false, // Requerir confirmación explícita
    });
    
    logger.info(`Consumidor de mensajes RabbitMQ iniciado: ${QUEUE_NAME}`);
  } catch (error) {
    logger.error('Error al configurar consumidor RabbitMQ:', error);
    // Reintentar conexión después de un tiempo
    setTimeout(() => setupMessageConsumer(), 5000);
  }
};

/**
 * Maneja los mensajes recibidos
 * @param {Object} msg - Mensaje recibido
 */
const handleMessage = async (msg) => {
  if (!msg) return;
  
  try {
    // Parsear mensaje
    const content = JSON.parse(msg.content.toString());
    const { event, data } = content;
    
    logger.debug(`Mensaje recibido: ${event}`);
    
    // Procesar según el tipo de evento
    switch (event) {
      case 'user.role_updated':
        await handleRoleUpdated(data);
        break;
      case 'user.deactivated':
        await handleUserDeactivated(data);
        break;
      case 'user.reactivated':
        await handleUserReactivated(data);
        break;
      case 'user.deleted':
        await handleUserDeleted(data);
        break;
      default:
        logger.warn(`Tipo de evento no manejado: ${event}`);
    }
    
    // Confirmar procesamiento exitoso
    channel.ack(msg);
  } catch (error) {
    logger.error('Error al procesar mensaje:', error);
    
    // Si es un error de parseo o un error no recuperable, rechazar sin requeue
    if (error instanceof SyntaxError) {
      channel.nack(msg, false, false);
    } else {
      // Para otros errores, requeue para reintentar
      channel.nack(msg, false, true);
    }
  }
};

/**
 * Maneja el evento de actualización de rol de usuario
 * @param {Object} data - Datos del evento
 */
const handleRoleUpdated = async (data) => {
  const { userId, role } = data;
  logger.info(`Usuario ${userId} actualizado a rol: ${role}`);
  
  // Aquí iría la lógica para actualizar el rol en la base de datos local
  // Por ejemplo:
  // await User.findByIdAndUpdate(userId, { role });
};

/**
 * Maneja el evento de desactivación de usuario
 * @param {Object} data - Datos del evento
 */
const handleUserDeactivated = async (data) => {
  const { userId } = data;
  logger.info(`Usuario ${userId} desactivado`);
  
  // Aquí iría la lógica para desactivar al usuario en la base de datos local
  // Por ejemplo:
  // await User.findByIdAndUpdate(userId, { isActive: false });
};

/**
 * Maneja el evento de reactivación de usuario
 * @param {Object} data - Datos del evento
 */
const handleUserReactivated = async (data) => {
  const { userId } = data;
  logger.info(`Usuario ${userId} reactivado`);
  
  // Aquí iría la lógica para reactivar al usuario en la base de datos local
  // Por ejemplo:
  // await User.findByIdAndUpdate(userId, { isActive: true });
};

/**
 * Maneja el evento de eliminación de usuario
 * @param {Object} data - Datos del evento
 */
const handleUserDeleted = async (data) => {
  const { userId } = data;
  logger.info(`Usuario ${userId} eliminado`);
  
  // Aquí iría la lógica para eliminar o marcar como eliminado al usuario
  // Por ejemplo:
  // await User.findByIdAndDelete(userId);
  // O mejor para mantener integridad referencial:
  // await User.findByIdAndUpdate(userId, { isDeleted: true });
};

module.exports = {
  setupMessageConsumer,
};