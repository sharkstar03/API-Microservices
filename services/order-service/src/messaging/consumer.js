const amqp = require('amqplib');
const Order = require('../models/Order');
const logger = require('../utils/logger');

// Configuración
const EXCHANGE_NAME = 'user_events';
const PRODUCT_EXCHANGE = 'product_events';
const QUEUE_NAME = 'order_service_queue';
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
    
    // Declarar exchanges
    await channel.assertExchange(EXCHANGE_NAME, 'topic', {
      durable: true,
    });
    
    await channel.assertExchange(PRODUCT_EXCHANGE, 'topic', {
      durable: true,
    });
    
    // Declarar cola para eventos de usuarios
    const { queue: userQueue } = await channel.assertQueue(`${QUEUE_NAME}_users`, {
      durable: true,
      // Configurar Dead Letter Exchange para mensajes fallidos
      arguments: {
        'x-dead-letter-exchange': `${EXCHANGE_NAME}_dlx`,
        'x-dead-letter-routing-key': 'dead.letter',
      },
    });
    
    // Declarar cola para eventos de productos
    const { queue: productQueue } = await channel.assertQueue(`${QUEUE_NAME}_products`, {
      durable: true,
      // Configurar Dead Letter Exchange para mensajes fallidos
      arguments: {
        'x-dead-letter-exchange': `${PRODUCT_EXCHANGE}_dlx`,
        'x-dead-letter-routing-key': 'dead.letter',
      },
    });
    
    // Eventos de usuarios a los que se suscribe este servicio
    const userBindingPatterns = [
      'user.deleted',
      'user.deactivated'
    ];
    
    // Eventos de productos a los que se suscribe este servicio
    const productBindingPatterns = [
      'product.updated',
      'product.deleted',
      'product.inventory.updated'
    ];
    
    // Enlazar colas con exchanges usando los patrones definidos
    for (const pattern of userBindingPatterns) {
      await channel.bindQueue(userQueue, EXCHANGE_NAME, pattern);
      logger.info(`Suscrito a: ${pattern}`);
    }
    
    for (const pattern of productBindingPatterns) {
      await channel.bindQueue(productQueue, PRODUCT_EXCHANGE, pattern);
      logger.info(`Suscrito a: ${pattern}`);
    }
    
    // Configurar consumidores
    await channel.consume(userQueue, handleUserMessage, {
      noAck: false, // Requerir confirmación explícita
    });
    
    await channel.consume(productQueue, handleProductMessage, {
      noAck: false, // Requerir confirmación explícita
    });
    
    logger.info(`Consumidores de mensajes RabbitMQ iniciados`);
  } catch (error) {
    logger.error('Error al configurar consumidor RabbitMQ:', error);
    // Reintentar conexión después de un tiempo
    setTimeout(() => setupMessageConsumer(), 5000);
  }
};

/**
 * Maneja los mensajes de eventos de usuarios
 * @param {Object} msg - Mensaje recibido
 */
const handleUserMessage = async (msg) => {
  if (!msg) return;
  
  try {
    // Parsear mensaje
    const content = JSON.parse(msg.content.toString());
    const { event, data } = content;
    
    logger.debug(`Mensaje de usuario recibido: ${event}`);
    
    // Procesar según el tipo de evento
    switch (event) {
      case 'user.deleted':
        await handleUserDeleted(data);
        break;
      case 'user.deactivated':
        await handleUserDeactivated(data);
        break;
      default:
        logger.warn(`Tipo de evento de usuario no manejado: ${event}`);
    }
    
    // Confirmar procesamiento exitoso
    channel.ack(msg);
  } catch (error) {
    logger.error('Error al procesar mensaje de usuario:', error);
    
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
 * Maneja los mensajes de eventos de productos
 * @param {Object} msg - Mensaje recibido
 */
const handleProductMessage = async (msg) => {
  if (!msg) return;
  
  try {
    // Parsear mensaje
    const content = JSON.parse(msg.content.toString());
    const { event, data } = content;
    
    logger.debug(`Mensaje de producto recibido: ${event}`);
    
    // Procesar según el tipo de evento
    switch (event) {
      case 'product.updated':
        await handleProductUpdated(data);
        break;
      case 'product.deleted':
        await handleProductDeleted(data);
        break;
      case 'product.inventory.updated':
        await handleInventoryUpdated(data);
        break;
      default:
        logger.warn(`Tipo de evento de producto no manejado: ${event}`);
    }
    
    // Confirmar procesamiento exitoso
    channel.ack(msg);
  } catch (error) {
    logger.error('Error al procesar mensaje de producto:', error);
    
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
 * Maneja el evento cuando un usuario es eliminado
 * @param {Object} data - Datos del evento
 */
const handleUserDeleted = async (data) => {
  const { userId } = data;
  logger.info(`Usuario eliminado: ${userId}`);
  
  try {
    // Marcar órdenes como anónimas o preservar para historial
    // No eliminar órdenes pero actualizar para reflejar usuario eliminado
    await Order.updateMany(
      { userId },
      { 
        $set: { 
          'metadata.userDeleted': true,
          'metadata.userDeletedAt': new Date(),
        },
      }
    );
    
    logger.info(`Órdenes actualizadas para el usuario eliminado: ${userId}`);
  } catch (error) {
    logger.error(`Error al procesar eliminación de usuario ${userId}:`, error);
  }
};

/**
 * Maneja el evento cuando un usuario es desactivado
 * @param {Object} data - Datos del evento
 */
const handleUserDeactivated = async (data) => {
  const { userId } = data;
  logger.info(`Usuario desactivado: ${userId}`);
  
  try {
    // Poner en espera órdenes pendientes
    await Order.updateMany(
      { 
        userId,
        status: { $in: ['pending', 'processing', 'payment_pending'] }
      },
      { 
        $set: { 
          status: 'on_hold',
          'metadata.userDeactivated': true,
          'metadata.userDeactivatedAt': new Date(),
        },
      }
    );
    
    logger.info(`Órdenes puestas en espera para el usuario desactivado: ${userId}`);
  } catch (error) {
    logger.error(`Error al procesar desactivación de usuario ${userId}:`, error);
  }
};

/**
 * Maneja el evento cuando un producto es actualizado
 * @param {Object} data - Datos del evento
 */
const handleProductUpdated = async (data) => {
  const { productId, name, price } = data;
  logger.info(`Producto actualizado: ${productId}`);
  
  try {
    // Actualizar información del producto en órdenes pendientes
    if (name || price) {
      const updateData = {};
      
      if (name) updateData['items.$[elem].name'] = name;
      if (price) updateData['items.$[elem].price'] = price;
      
      await Order.updateMany(
        { 
          'items.productId': productId,
          status: { $in: ['pending', 'processing', 'payment_pending'] }
        },
        { 
          $set: updateData,
        },
        {
          arrayFilters: [{ 'elem.productId': productId }],
        }
      );
      
      // Recalcular totales para las órdenes afectadas
      const affectedOrders = await Order.find({
        'items.productId': productId,
        status: { $in: ['pending', 'processing', 'payment_pending'] }
      });
      
      for (const order of affectedOrders) {
        order.calculateTotals();
        await order.save();
      }
      
      logger.info(`Órdenes actualizadas para el producto: ${productId}`);
    }
  } catch (error) {
    logger.error(`Error al procesar actualización de producto ${productId}:`, error);
  }
};

/**
 * Maneja el evento cuando un producto es eliminado
 * @param {Object} data - Datos del evento
 */
const handleProductDeleted = async (data) => {
  const { productId } = data;
  logger.info(`Producto eliminado: ${productId}`);
  
  try {
    // Marcar el producto como no disponible en órdenes pendientes
    await Order.updateMany(
      { 
        'items.productId': productId,
        status: { $in: ['pending', 'processing', 'payment_pending'] }
      },
      { 
        $set: { 
          'items.$[elem].metadata.productDeleted': true,
          'items.$[elem].metadata.productDeletedAt': new Date(),
        },
      },
      {
        arrayFilters: [{ 'elem.productId': productId }],
      }
    );
    
    logger.info(`Órdenes actualizadas para el producto eliminado: ${productId}`);
  } catch (error) {
    logger.error(`Error al procesar eliminación de producto ${productId}:`, error);
  }
};

/**
 * Maneja el evento cuando se actualiza el inventario de un producto
 * @param {Object} data - Datos del evento
 */
const handleInventoryUpdated = async (data) => {
  const { productId, inStock } = data;
  logger.info(`Inventario actualizado: ${productId}, en stock: ${inStock}`);
  
  try {
    // Si el producto está agotado, marcar en órdenes pendientes
    if (inStock === false) {
      await Order.updateMany(
        { 
          'items.productId': productId,
          status: { $in: ['pending', 'processing', 'payment_pending'] }
        },
        { 
          $set: { 
            'items.$[elem].metadata.outOfStock': true,
            'items.$[elem].metadata.outOfStockAt': new Date(),
          },
        },
        {
          arrayFilters: [{ 'elem.productId': productId }],
        }
      );
      
      logger.info(`Órdenes actualizadas para producto agotado: ${productId}`);
    }
  } catch (error) {
    logger.error(`Error al procesar actualización de inventario ${productId}:`, error);
  }
};

module.exports = {
  setupMessageConsumer,
};