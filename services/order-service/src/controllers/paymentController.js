const Order = require('../models/Order');
const { publishOrderEvent } = require('../messaging/publisher');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');
const crypto = require('crypto');

/**
 * Procesar webhook de pasarela de pago
 */
exports.processWebhook = async (req, res, next) => {
  try {
    const { type, data } = req.body;
    logger.info(`Webhook recibido: ${type}`);
    
    // Verificar firma del webhook (implementación específica por pasarela)
    // Este es un ejemplo genérico
    const isValid = verifyWebhookSignature(req);
    
    if (!isValid) {
      logger.warn('Firma de webhook inválida');
      return res.status(400).json({ status: 'error', message: 'Firma inválida' });
    }
    
    // Procesar según el tipo de evento
    switch (type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(data);
        break;
      case 'payment_intent.failed':
        await handlePaymentFailure(data);
        break;
      case 'payment_intent.refunded':
        await handlePaymentRefund(data);
        break;
      default:
        logger.info(`Tipo de evento no procesado: ${type}`);
    }
    
    // Responder al webhook
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Error al procesar webhook:', error);
    // Siempre responder con éxito para evitar reintentos
    res.status(200).json({ received: true, error: error.message });
  }
};

/**
 * Obtener métodos de pago disponibles
 */
exports.getPaymentMethods = async (req, res, next) => {
  try {
    // Lista de métodos de pago disponibles
    // Esto podría obtenerse dinámicamente de un servicio o configuración
    const paymentMethods = [
      {
        id: 'credit_card',
        name: 'Tarjeta de Crédito',
        description: 'Pagar con tarjeta Visa, Mastercard, American Express',
        icon: 'credit-card',
        enabled: true,
      },
      {
        id: 'paypal',
        name: 'PayPal',
        description: 'Pagar con tu cuenta de PayPal',
        icon: 'paypal',
        enabled: true,
      },
      {
        id: 'bank_transfer',
        name: 'Transferencia Bancaria',
        description: 'Pagar mediante transferencia bancaria',
        icon: 'bank',
        enabled: true,
      },
      {
        id: 'cash',
        name: 'Efectivo',
        description: 'Pagar en efectivo al recibir el pedido',
        icon: 'cash',
        enabled: true,
      },
    ];
    
    res.status(200).json({
      status: 'success',
      data: {
        methods: paymentMethods,
      },
    });
  } catch (error) {
    logger.error('Error al obtener métodos de pago:', error);
    next(error);
  }
};

/**
 * Procesar un pago
 */
exports.processPayment = async (req, res, next) => {
  try {
    const { orderId, method, paymentDetails } = req.body;
    
    // Buscar orden
    const order = await Order.findById(orderId);
    
    if (!order) {
      return next(new AppError('Orden no encontrada', 404));
    }
    
    // Verificar permisos
    const isOwner = req.user.id === order.userId;
    
    if (!isOwner && req.user.role !== 'admin') {
      return next(new AppError('No tienes permiso para procesar este pago', 403));
    }
    
    // Verificar si la orden ya está pagada
    if (order.payment && order.payment.status === 'completed') {
      return next(new AppError('Esta orden ya ha sido pagada', 400));
    }
    
    // Verificar si la orden está cancelada
    if (order.status === 'cancelled') {
      return next(new AppError('No se puede pagar una orden cancelada', 400));
    }
    
    // Procesar pago según el método
    const paymentResult = await processPaymentByMethod(method, order, paymentDetails);
    
    // Actualizar información de pago en la orden
    order.updatePayment({
      method: method,
      transactionId: paymentResult.transactionId,
      amount: order.total,
      status: paymentResult.status,
      provider: paymentResult.provider,
      notes: paymentResult.notes,
      paidAt: paymentResult.status === 'completed' ? new Date() : undefined,
    });
    
    // Si el pago está completado, actualizar estado de la orden
    if (paymentResult.status === 'completed') {
      order.updateStatus('paid', 'Pago recibido y confirmado');
      
      // Publicar evento de pago completado
      await publishOrderEvent('order.paid', {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        userId: order.userId,
        total: order.total,
        method: method,
        transactionId: paymentResult.transactionId,
        items: order.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        paidAt: order.payment.paidAt,
      });
    } else if (paymentResult.status === 'pending') {
      order.updateStatus('payment_pending', 'Pago en proceso');
    }
    
    // Guardar cambios
    await order.save();
    
    res.status(200).json({
      status: 'success',
      data: {
        payment: paymentResult,
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
          payment: order.payment,
        },
      },
    });
  } catch (error) {
    logger.error(`Error al procesar pago para orden ${req.body.orderId}:`, error);
    next(error);
  }
};

/**
 * Verificar estado de un pago
 */
exports.verifyPayment = async (req, res, next) => {
  try {
    const paymentId = req.params.id;
    
    // Buscar orden por ID de transacción
    const order = await Order.findOne({ 'payment.transactionId': paymentId });
    
    if (!order) {
      return next(new AppError('Pago no encontrado', 404));
    }
    
    // Verificar permisos
    const isOwner = req.user.id === order.userId;
    
    if (!isOwner && req.user.role !== 'admin') {
      return next(new AppError('No tienes permiso para verificar este pago', 403));
    }
    
    // Para una implementación real, consultaríamos con la pasarela de pagos
    // Aquí simulamos la verificación
    const paymentStatus = order.payment.status;
    
    res.status(200).json({
      status: 'success',
      data: {
        paymentId,
        orderNumber: order.orderNumber,
        status: paymentStatus,
        amount: order.payment.amount,
        method: order.payment.method,
        paidAt: order.payment.paidAt,
      },
    });
  } catch (error) {
    logger.error(`Error al verificar pago ${req.params.id}:`, error);
    next(error);
  }
};

/**
 * Procesar un reembolso
 */
exports.processRefund = async (req, res, next) => {
  try {
    const paymentId = req.params.id;
    const { amount, reason } = req.body;
    
    // Buscar orden por ID de transacción
    const order = await Order.findOne({ 'payment.transactionId': paymentId });
    
    if (!order) {
      return next(new AppError('Pago no encontrado', 404));
    }
    
    // Verificar si el pago está completado
    if (order.payment.status !== 'completed') {
      return next(new AppError('No se puede reembolsar un pago que no está completado', 400));
    }
    
    // Calcular monto a reembolsar (total o parcial)
    const refundAmount = amount || order.payment.amount;
    
    // Para una implementación real, procesaríamos el reembolso con la pasarela
    // Aquí simulamos el reembolso
    const refundResult = {
      success: true,
      transactionId: `ref_${crypto.randomBytes(8).toString('hex')}`,
      amount: refundAmount,
      status: 'completed',
    };
    
    if (refundResult.success) {
      // Actualizar estado del pago
      order.payment.status = 'refunded';
      
      // Si es reembolso total, actualizar estado de la orden
      if (refundAmount >= order.total) {
        order.updateStatus('refunded', reason || 'Reembolso procesado');
      } else {
        // Si es parcial, agregar nota
        if (order.adminNotes) {
          order.adminNotes += `\n${new Date().toISOString()} - Reembolso parcial: ${refundAmount}. Motivo: ${reason || 'No especificado'}`;
        } else {
          order.adminNotes = `${new Date().toISOString()} - Reembolso parcial: ${refundAmount}. Motivo: ${reason || 'No especificado'}`;
        }
      }
      
      // Guardar cambios
      await order.save();
      
      // Publicar evento de reembolso
      await publishOrderEvent('order.refunded', {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        userId: order.userId,
        amount: refundAmount,
        reason,
        items: order.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        refundedAt: new Date().toISOString(),
      });
      
      res.status(200).json({
        status: 'success',
        data: {
          refund: refundResult,
          order: {
            id: order._id,
            orderNumber: order.orderNumber,
            status: order.status,
            payment: order.payment,
          },
        },
      });
    } else {
      return next(new AppError('No se pudo procesar el reembolso', 500));
    }
  } catch (error) {
    logger.error(`Error al procesar reembolso ${req.params.id}:`, error);
    next(error);
  }
};

// Funciones auxiliares

/**
 * Verificar firma del webhook
 */
function verifyWebhookSignature(req) {
  // Implementación específica por pasarela de pago
  // Este es un ejemplo genérico que siempre devuelve true
  return true;
}

/**
 * Manejar evento de pago exitoso
 */
async function handlePaymentSuccess(data) {
  const { orderId, transactionId } = data;
  
  // Buscar orden
  const order = await Order.findById(orderId);
  
  if (!order) {
    logger.error(`Orden no encontrada para pago: ${orderId}`);
    return;
  }
  
  // Actualizar información de pago
  order.updatePayment({
    transactionId,
    status: 'completed',
    paidAt: new Date(),
  });
  
  // Actualizar estado de la orden
  order.updateStatus('paid', 'Pago recibido y confirmado por webhook');
  await order.save();
  
  // Publicar evento
  await publishOrderEvent('order.paid', {
    orderId: order._id.toString(),
    orderNumber: order.orderNumber,
    userId: order.userId,
    total: order.total,
    transactionId,
    paidAt: order.payment.paidAt,
  });
  
  logger.info(`Pago exitoso procesado para orden: ${orderId}`);
}

/**
 * Manejar evento de pago fallido
 */
async function handlePaymentFailure(data) {
  const { orderId, transactionId, errorMessage } = data;
  
  // Buscar orden
  const order = await Order.findById(orderId);
  
  if (!order) {
    logger.error(`Orden no encontrada para pago fallido: ${orderId}`);
    return;
  }
  
  // Actualizar información de pago
  order.updatePayment({
    transactionId,
    status: 'failed',
    notes: errorMessage,
  });
  
  // Actualizar estado de la orden
  order.updateStatus('payment_pending', `Pago fallido: ${errorMessage}`);
  await order.save();
  
  logger.info(`Pago fallido procesado para orden: ${orderId}`);
}

/**
 * Manejar evento de reembolso
 */
async function handlePaymentRefund(data) {
  const { orderId, transactionId, amount } = data;
  
  // Buscar orden
  const order = await Order.findById(orderId);
  
  if (!order) {
    logger.error(`Orden no encontrada para reembolso: ${orderId}`);
    return;
  }
  
  // Actualizar información de pago
  order.payment.status = 'refunded';
  
  // Si es reembolso total, actualizar estado de la orden
  if (amount >= order.total) {
    order.updateStatus('refunded', 'Reembolso procesado por webhook');
  } else {
    // Si es parcial, agregar nota
    if (order.adminNotes) {
      order.adminNotes += `\n${new Date().toISOString()} - Reembolso parcial por webhook: ${amount}`;
    } else {
      order.adminNotes = `${new Date().toISOString()} - Reembolso parcial por webhook: ${amount}`;
    }
  }
  
  await order.save();
  
  // Publicar evento
  await publishOrderEvent('order.refunded', {
    orderId: order._id.toString(),
    orderNumber: order.orderNumber,
    userId: order.userId,
    amount,
    refundedAt: new Date().toISOString(),
  });
  
  logger.info(`Reembolso procesado para orden: ${orderId}`);
}

/**
 * Procesar pago según el método
 */
async function processPaymentByMethod(method, order, paymentDetails) {
  // En una implementación real, aquí integraríamos con pasarelas de pago
  // Este es un ejemplo simplificado para fines de demostración
  
  switch (method) {
    case 'credit_card':
      // Simular procesamiento de tarjeta de crédito
      return {
        success: true,
        transactionId: `cc_${crypto.randomBytes(8).toString('hex')}`,
        status: 'completed', // O 'pending' según el caso
        provider: 'stripe',
        notes: 'Pago con tarjeta procesado correctamente',
      };
      
    case 'paypal':
      // Simular procesamiento con PayPal
      return {
        success: true,
        transactionId: `pp_${crypto.randomBytes(8).toString('hex')}`,
        status: 'completed',
        provider: 'paypal',
        notes: 'Pago con PayPal procesado correctamente',
      };
      
    case 'bank_transfer':
      // Las transferencias bancarias normalmente son pendientes
      return {
        success: true,
        transactionId: `bt_${crypto.randomBytes(8).toString('hex')}`,
        status: 'pending',
        provider: 'bank',
        notes: 'Por favor, complete la transferencia usando la referencia proporcionada',
      };
      
    case 'cash':
      // Pago en efectivo contra entrega
      return {
        success: true,
        transactionId: `cash_${crypto.randomBytes(8).toString('hex')}`,
        status: 'pending',
        provider: 'cash',
        notes: 'Pago pendiente contra entrega',
      };
      
    default:
      throw new AppError(`Método de pago no soportado: ${method}`, 400);
  }
}