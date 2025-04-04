const amqp = require('amqplib');
const { Product, Inventory } = require('../models');
const Redis = require('ioredis');
const logger = require('../utils/logger');

// Cliente Redis para invalidar caché
const redis = new Redis(process.env.REDIS_URL);

// Configuración
const EXCHANGE_NAME = 'order_events';
const QUEUE_NAME = 'product_service_queue';
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
      'order.created',
      'order.paid',
      'order.cancelled',
      'order.refunded',
      'order.item.added',
      'order.item.removed'
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
      case 'order.created':
        await handleOrderCreated(data);
        break;
      case 'order.paid':
        await handleOrderPaid(data);
        break;
      case 'order.cancelled':
        await handleOrderCancelled(data);
        break;
      case 'order.refunded':
        await handleOrderRefunded(data);
        break;
      case 'order.item.added':
        await handleOrderItemAdded(data);
        break;
      case 'order.item.removed':
        await handleOrderItemRemoved(data);
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
 * Maneja el evento cuando se crea una orden
 * @param {Object} data - Datos del evento
 */
const handleOrderCreated = async (data) => {
  const { items } = data;
  logger.info(`Orden creada con ${items.length} productos`);
  
  // Reservar inventario para cada producto
  for (const item of items) {
    const { productId, quantity } = item;
    
    try {
      // Buscar inventario del producto
      const inventory = await Inventory.findOne({ where: { productId } });
      
      if (!inventory) {
        logger.warn(`Inventario no encontrado para el producto: ${productId}`);
        continue;
      }
      
      // Reservar stock
      await inventory.reserveStock(quantity);
      logger.debug(`Stock reservado para producto ${productId}: ${quantity} unidades`);
    } catch (error) {
      logger.error(`Error al reservar stock para el producto ${productId}:`, error);
      // Aquí podríamos enviar un evento de error para notificar al servicio de órdenes
    }
  }
};

/**
 * Maneja el evento cuando se paga una orden
 * @param {Object} data - Datos del evento
 */
const handleOrderPaid = async (data) => {
  const { items } = data;
  logger.info(`Orden pagada con ${items.length} productos`);
  
  // Convertir reservas en reducciones reales de stock
  for (const item of items) {
    const { productId, quantity } = item;
    
    try {
      // Buscar inventario del producto
      const inventory = await Inventory.findOne({ where: { productId } });
      
      if (!inventory) {
        logger.warn(`Inventario no encontrado para el producto: ${productId}`);
        continue;
      }
      
      // Reducir stock y liberar reserva
      await inventory.reduceStock(quantity, true); // true indica que es una liberación de reserva
      await inventory.reduceStock(quantity, false); // false indica reducción real del stock
      
      // Invalidar caché
      await redis.del(`product:${productId}`);
      
      logger.debug(`Stock actualizado para producto ${productId}`);
    } catch (error) {
      logger.error(`Error al actualizar stock para el producto ${productId}:`, error);
    }
  }
};

/**
 * Maneja el evento cuando se cancela una orden
 * @param {Object} data - Datos del evento
 */
const handleOrderCancelled = async (data) => {
  const { items } = data;
  logger.info(`Orden cancelada con ${items.length} productos`);
  
  // Liberar reservas de inventario
  for (const item of items) {
    const { productId, quantity } = item;
    
    try {
      // Buscar inventario del producto
      const inventory = await Inventory.findOne({ where: { productId } });
      
      if (!inventory) {
        logger.warn(`Inventario no encontrado para el producto: ${productId}`);
        continue;
      }
      
      // Liberar reserva
      await inventory.reduceStock(quantity, true); // true indica que es una liberación de reserva
      
      logger.debug(`Reserva liberada para producto ${productId}: ${quantity} unidades`);
    } catch (error) {
      logger.error(`Error al liberar reserva para el producto ${productId}:`, error);
    }
  }
};

/**
 * Maneja el evento cuando se reembolsa una orden
 * @param {Object} data - Datos del evento
 */
const handleOrderRefunded = async (data) => {
  const { items } = data;
  logger.info(`Orden reembolsada con ${items.length} productos`);
  
  // Restaurar inventario
  for (const item of items) {
    const { productId, quantity } = item;
    
    try {
      // Buscar inventario del producto
      const inventory = await Inventory.findOne({ where: { productId } });
      
      if (!inventory) {
        logger.warn(`Inventario no encontrado para el producto: ${productId}`);
        continue;
      }
      
      // Incrementar stock
      await inventory.addStock(quantity);
      
      // Invalidar caché
      await redis.del(`product:${productId}`);
      
      logger.debug(`Stock restaurado para producto ${productId}: ${quantity} unidades`);
    } catch (error) {
      logger.error(`Error al restaurar stock para el producto ${productId}:`, error);
    }
  }
};

/**
 * Maneja el evento cuando se agrega un item a una orden
 * @param {Object} data - Datos del evento
 */
const handleOrderItemAdded = async (data) => {
  const { productId, quantity } = data;
  logger.info(`Item agregado a orden: producto ${productId}, cantidad ${quantity}`);
  
  try {
    // Buscar inventario del producto
    const inventory = await Inventory.findOne({ where: { productId } });
    
    if (!inventory) {
      logger.warn(`Inventario no encontrado para el producto: ${productId}`);
      return;
    }
    
    // Reservar stock
    await inventory.reserveStock(quantity);
    logger.debug(`Stock reservado para producto ${productId}: ${quantity} unidades`);
  } catch (error) {
    logger.error(`Error al reservar stock para el producto ${productId}:`, error);
  }
};

/**
 * Maneja el evento cuando se elimina un item de una orden
 * @param {Object} data - Datos del evento
 */
const handleOrderItemRemoved = async (data) => {
  const { productId, quantity } = data;
  logger.info(`Item eliminado de orden: producto ${productId}, cantidad ${quantity}`);
  
  try {
    // Buscar inventario del producto
    const inventory = await Inventory.findOne({ where: { productId } });
    
    if (!inventory) {
      logger.warn(`Inventario no encontrado para el producto: ${productId}`);
      return;
    }
    
    // Liberar reserva
    await inventory.reduceStock(quantity, true); // true indica que es una liberación de reserva
    logger.debug(`Reserva liberada para producto ${productId}: ${quantity} unidades`);
  } catch (error) {
    logger.error(`Error al liberar reserva para el producto ${productId}:`, error);
  }
};

module.exports = {
  setupMessageConsumer,
};