const amqp = require('amqplib');
const User = require('../models/User');
const logger = require('../utils/logger');

// Configuración
const EXCHANGE_NAME = 'user_events';
const QUEUE_NAME = 'user_service_queue';
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
      'user.created',
      'user.email_verified',
      'user.deleted',
      'user.role_updated',
      'user.account_locked',
      'user.account_unlocked'
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
      case 'user.created':
        await handleUserCreated(data);
        break;
      case 'user.email_verified':
        await handleEmailVerified(data);
        break;
      case 'user.deleted':
        await handleUserDeleted(data);
        break;
      case 'user.role_updated':
        await handleRoleUpdated(data);
        break;
      case 'user.account_locked':
        await handleAccountLocked(data);
        break;
      case 'user.account_unlocked':
        await handleAccountUnlocked(data);
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
 * Maneja el evento de creación de usuario en el servicio de autenticación
 * @param {Object} data - Datos del evento
 */
const handleUserCreated = async (data) => {
  const { userId, email, name, role, createdAt } = data;
  logger.info(`Nuevo usuario creado en Auth Service: ${email}`);
  
  try {
    // Verificar si ya existe en nuestro sistema
    const existingUser = await User.findOne({ 
      $or: [
        { userId: userId },
        { email: email }
      ]
    });
    
    if (existingUser) {
      logger.warn(`Usuario ${email} ya existe en User Service`);
      return;
    }
    
    // Crear usuario en nuestro sistema
    const newUser = new User({
      userId,
      email,
      name,
      role: role || 'user',
      isActive: true,
      isVerified: false, // Por defecto, esperará confirmación
      metadata: {
        registrationSource: 'auth-service',
      },
    });
    
    await newUser.save();
    logger.info(`Usuario ${email} sincronizado desde Auth Service`);
  } catch (error) {
    logger.error(`Error al sincronizar usuario ${email}:`, error);
    throw error; // Propagar error para reintentar
  }
};

/**
 * Maneja el evento de verificación de email
 * @param {Object} data - Datos del evento
 */
const handleEmailVerified = async (data) => {
  const { userId, email } = data;
  logger.info(`Email verificado para usuario ${email}`);
  
  try {
    // Buscar usuario
    const user = await User.findOne({ userId });
    
    if (!user) {
      logger.warn(`Usuario ${userId} no encontrado para actualizar verificación de email`);
      return;
    }
    
    // Actualizar estado de verificación
    user.isVerified = true;
    await user.save();
    
    logger.info(`Estado de verificación actualizado para ${email}`);
  } catch (error) {
    logger.error(`Error al actualizar verificación de email para ${userId}:`, error);
    throw error;
  }
};

/**
 * Maneja el evento de eliminación de usuario
 * @param {Object} data - Datos del evento
 */
const handleUserDeleted = async (data) => {
  const { userId } = data;
  logger.info(`Usuario ${userId} eliminado en Auth Service`);
  
  try {
    // Buscar usuario
    const user = await User.findOne({ userId });
    
    if (!user) {
      logger.warn(`Usuario ${userId} no encontrado para eliminar`);
      return;
    }
    
    // Soft delete
    user.isActive = false;
    user.isDeleted = true;
    await user.save();
    
    logger.info(`Usuario ${userId} marcado como eliminado en User Service`);
  } catch (error) {
    logger.error(`Error al marcar usuario ${userId} como eliminado:`, error);
    throw error;
  }
};

/**
 * Maneja el evento de actualización de rol
 * @param {Object} data - Datos del evento
 */
const handleRoleUpdated = async (data) => {
  const { userId, role } = data;
  logger.info(`Rol actualizado para usuario ${userId}: ${role}`);
  
  try {
    // Buscar usuario
    const user = await User.findOne({ userId });
    
    if (!user) {
      logger.warn(`Usuario ${userId} no encontrado para actualizar rol`);
      return;
    }
    
    // Actualizar rol
    user.role = role;
    await user.save();
    
    logger.info(`Rol actualizado para usuario ${userId} en User Service`);
  } catch (error) {
    logger.error(`Error al actualizar rol para usuario ${userId}:`, error);
    throw error;
  }
};

/**
 * Maneja el evento de bloqueo de cuenta
 * @param {Object} data - Datos del evento
 */
const handleAccountLocked = async (data) => {
  const { userId, reason, lockedUntil } = data;
  logger.info(`Cuenta bloqueada para usuario ${userId}. Razón: ${reason}`);
  
  try {
    // Buscar usuario
    const user = await User.findOne({ userId });
    
    if (!user) {
      logger.warn(`Usuario ${userId} no encontrado para bloquear cuenta`);
      return;
    }
    
    // Actualizar estado
    user.isActive = false;
    await user.save();
    
    logger.info(`Usuario ${userId} desactivado en User Service por bloqueo de cuenta`);
  } catch (error) {
    logger.error(`Error al desactivar cuenta para usuario ${userId}:`, error);
    throw error;
  }
};

/**
 * Maneja el evento de desbloqueo de cuenta
 * @param {Object} data - Datos del evento
 */
const handleAccountUnlocked = async (data) => {
  const { userId } = data;
  logger.info(`Cuenta desbloqueada para usuario ${userId}`);
  
  try {
    // Buscar usuario
    const user = await User.findOne({ userId });
    
    if (!user) {
      logger.warn(`Usuario ${userId} no encontrado para desbloquear cuenta`);
      return;
    }
    
    // Actualizar estado
    user.isActive = true;
    await user.save();
    
    logger.info(`Usuario ${userId} reactivado en User Service`);
  } catch (error) {
    logger.error(`Error al reactivar cuenta para usuario ${userId}:`, error);
    throw error;
  }
};

module.exports = {
  setupMessageConsumer,
};