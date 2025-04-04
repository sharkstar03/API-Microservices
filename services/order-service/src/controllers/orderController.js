const Order = require('../models/Order');
const { publishOrderEvent } = require('../messaging/publisher');
const axios = require('axios');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

// URLs de servicios
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:3002';
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://product-service:3003';

/**
 * Obtener todas las órdenes (con paginación)
 */
exports.getAllOrders = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status;
    const fromDate = req.query.fromDate;
    const toDate = req.query.toDate;
    const search = req.query.search;
    
    // Construir query
    let query = {};
    
    // Filtro por estado
    if (status) {
      query.status = status;
    }
    
    // Filtro por rango de fechas
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }
    
    // Búsqueda por texto
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { "items.name": { $regex: search, $options: 'i' } }
      ];
    }
    
    // Ejecutar consultas
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
    
    const total = await Order.countDocuments(query);
    
    res.status(200).json({
      status: 'success',
      results: orders.length,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
      data: {
        orders,
      },
    });
  } catch (error) {
    logger.error('Error al obtener órdenes:', error);
    next(error);
  }
};

/**
 * Obtener órdenes de un usuario específico
 */
exports.getUserOrders = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status;
    
    // Construir query
    let query = { userId };
    
    // Filtro por estado
    if (status) {
      query.status = status;
    }
    
    // Ejecutar consultas
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
    
    const total = await Order.countDocuments(query);
    
    res.status(200).json({
      status: 'success',
      results: orders.length,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
      data: {
        orders,
      },
    });
  } catch (error) {
    logger.error(`Error al obtener órdenes del usuario ${req.params.userId}:`, error);
    next(error);
  }
};

/**
 * Obtener una orden por ID
 */
exports.getOrderById = async (req, res, next) => {
  try {
    const orderId = req.params.id;
    
    const order = await Order.findById(orderId);
    
    if (!order) {
      return next(new AppError('Orden no encontrada', 404));
    }
    
    // Verificar permisos (admin o propio usuario)
    if (req.user.role !== 'admin' && req.user.id !== order.userId) {
      return next(new AppError('No tienes permiso para ver esta orden', 403));
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        order,
      },
    });
  } catch (error) {
    logger.error(`Error al obtener orden ${req.params.id}:`, error);
    next(error);
  }
};

/**
 * Crear una nueva orden
 */
exports.createOrder = async (req, res, next) => {
  try {
    const {
      items,
      shippingAddress,
      billingAddress,
      payment,
      shipping,
      notes,
      customerNotes,
    } = req.body;
    
    // Verificar elementos de la orden
    if (!items || !Array.isArray(items) || items.length === 0) {
      return next(new AppError('La orden debe tener al menos un producto', 400));
    }
    
    // Verificar direcciones
    if (!shippingAddress) {
      return next(new AppError('Se requiere dirección de envío', 400));
    }
    
    // Obtener información del usuario (opcional: verificar si existe)
    let userEmail = req.body.email || req.user.email;
    
    // Validar productos y obtener información actualizada
    const validatedItems = await validateOrderItems(items);
    
    // Crear orden con los datos iniciales
    const order = new Order({
      userId: req.user.id,
      email: userEmail,
      items: validatedItems,
      shippingAddress,
      billingAddress: billingAddress || shippingAddress, // Usar dirección de envío si no se proporciona la de facturación
      subtotal: 0, // Se calculará
      taxAmount: 0, // Se calculará
      discountAmount: 0,
      shippingAmount: shipping ? shipping.cost : 0,
      total: 0, // Se calculará
      payment: payment || {
        method: 'pending',
        amount: 0, // Se actualizará
        status: 'pending',
      },
      shipping: shipping || {
        method: 'standard',
        cost: 0,
        status: 'pending',
      },
      notes,
      customerNotes,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    
    // Calcular totales
    order.calculateTotals();
    
    // Actualizar monto de pago
    if (order.payment) {
      order.payment.amount = order.total;
    }
    
    // Establecer estado inicial
    const initialStatus = payment && payment.method === 'credit_card' ? 'payment_pending' : 'pending';
    order.status = initialStatus;
    
    // Guardar orden
    await order.save();
    
    // Publicar evento de orden creada
    await publishOrderEvent('order.created', {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      userId: order.userId,
      total: order.total,
      status: order.status,
      items: order.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
      createdAt: order.createdAt,
    });
    
    res.status(201).json({
      status: 'success',
      data: {
        order,
      },
    });
  } catch (error) {
    logger.error('Error al crear orden:', error);
    next(error);
  }
};

/**
 * Actualizar estado de una orden
 */
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const orderId = req.params.id;
    const { status, notes } = req.body;
    
    // Verificar estados válidos
    const validStatuses = [
      'pending', 'processing', 'payment_pending', 'paid',
      'shipped', 'delivered', 'completed', 'cancelled',
      'refunded', 'failed', 'on_hold'
    ];
    
    if (!validStatuses.includes(status)) {
      return next(new AppError('Estado de orden no válido', 400));
    }
    
    // Buscar orden
    const order = await Order.findById(orderId);
    
    if (!order) {
      return next(new AppError('Orden no encontrada', 404));
    }
    
    // Verificar permisos (solo admin puede cambiar estado)
    if (req.user.role !== 'admin') {
      return next(new AppError('No tienes permiso para actualizar esta orden', 403));
    }
    
    // Actualizar estado
    order.updateStatus(status, notes);
    await order.save();
    
    // Publicar evento de estado actualizado
    await publishOrderEvent('order.status_updated', {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      prevStatus: order.status,
      newStatus: status,
      userId: order.userId,
      updatedAt: new Date().toISOString(),
    });
    
    // Eventos específicos por estado
    if (status === 'paid') {
      await publishOrderEvent('order.paid', {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        userId: order.userId,
        total: order.total,
        items: order.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        paidAt: order.payment.paidAt,
      });
    } else if (status === 'cancelled') {
      await publishOrderEvent('order.cancelled', {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        userId: order.userId,
        items: order.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        cancelledAt: order.cancelledAt,
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        order,
      },
    });
  } catch (error) {
    logger.error(`Error al actualizar estado de orden ${req.params.id}:`, error);
    next(error);
  }
};

/**
 * Actualizar información de pago
 */
exports.updatePayment = async (req, res, next) => {
  try {
    const orderId = req.params.id;
    const paymentInfo = req.body;
    
    // Buscar orden
    const order = await Order.findById(orderId);
    
    if (!order) {
      return next(new AppError('Orden no encontrada', 404));
    }
    
    // Verificar permisos
    const isAdmin = req.user.role === 'admin';
    const isOwner = req.user.id === order.userId;
    
    if (!isAdmin && !isOwner) {
      return next(new AppError('No tienes permiso para actualizar esta orden', 403));
    }
    
    // Actualizar información de pago
    order.updatePayment(paymentInfo);
    await order.save();
    
    // Si el pago se completó, publicar evento
    if (paymentInfo.status === 'completed') {
      await publishOrderEvent('order.paid', {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        userId: order.userId,
        total: order.total,
        items: order.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        paidAt: order.payment.paidAt,
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        order,
      },
    });
  } catch (error) {
    logger.error(`Error al actualizar pago de orden ${req.params.id}:`, error);
    next(error);
  }
};

/**
 * Actualizar información de envío
 */
exports.updateShipping = async (req, res, next) => {
  try {
    const orderId = req.params.id;
    const shippingInfo = req.body;
    
    // Buscar orden
    const order = await Order.findById(orderId);
    
    if (!order) {
      return next(new AppError('Orden no encontrada', 404));
    }
    
    // Verificar permisos (solo admin puede actualizar envío)
    if (req.user.role !== 'admin') {
      return next(new AppError('No tienes permiso para actualizar esta orden', 403));
    }
    
    // Actualizar información de envío
    order.updateShipping(shippingInfo);
    await order.save();
    
    // Publicar evento si cambió el estado del envío
    if (shippingInfo.status === 'shipped' || shippingInfo.status === 'delivered') {
      await publishOrderEvent(`order.${shippingInfo.status}`, {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        userId: order.userId,
        trackingNumber: order.shipping.trackingNumber,
        carrier: order.shipping.carrier,
        updatedAt: new Date().toISOString(),
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        order,
      },
    });
  } catch (error) {
    logger.error(`Error al actualizar envío de orden ${req.params.id}:`, error);
    next(error);
  }
};

/**
 * Agregar elemento a una orden existente
 */
exports.addOrderItem = async (req, res, next) => {
  try {
    const orderId = req.params.id;
    const { productId, quantity } = req.body;
    
    if (!productId || !quantity || quantity <= 0) {
      return next(new AppError('Se requiere ID de producto y cantidad válida', 400));
    }
    
    // Buscar orden
    const order = await Order.findById(orderId);
    
    if (!order) {
      return next(new AppError('Orden no encontrada', 404));
    }
    
    // Verificar si la orden ya está procesada o completada
    if (['shipped', 'delivered', 'completed', 'cancelled', 'refunded'].includes(order.status)) {
      return next(new AppError('No se puede modificar una orden en este estado', 400));
    }
    
    // Verificar permisos
    const isAdmin = req.user.role === 'admin';
    const isOwner = req.user.id === order.userId;
    
    if (!isAdmin && !isOwner) {
      return next(new AppError('No tienes permiso para modificar esta orden', 403));
    }
    
    // Obtener información del producto
    const productInfo = await getProductInfo(productId);
    
    // Crear item
    const newItem = {
      productId,
      sku: productInfo.sku,
      name: productInfo.name,
      price: productInfo.price,
      salePrice: productInfo.salePrice || 0,
      quantity: quantity,
      subtotal: 0, // Se calculará
      taxes: 0, // Se asume por ahora
      discount: 0, // Se asume por ahora
      total: 0, // Se calculará
      image: productInfo.featuredImage,
      isDigital: productInfo.isDigital || false,
      weight: productInfo.weight || 0,
    };
    
    // Añadir item a la orden
    order.addItem(newItem);
    await order.save();
    
    // Publicar evento
    await publishOrderEvent('order.item.added', {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      userId: order.userId,
      productId,
      quantity,
      updatedAt: new Date().toISOString(),
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        order,
      },
    });
  } catch (error) {
    logger.error(`Error al añadir item a orden ${req.params.id}:`, error);
    next(error);
  }
};

/**
 * Eliminar elemento de una orden
 */
exports.removeOrderItem = async (req, res, next) => {
  try {
    const orderId = req.params.id;
    const { productId } = req.params;
    
    // Buscar orden
    const order = await Order.findById(orderId);
    
    if (!order) {
      return next(new AppError('Orden no encontrada', 404));
    }
    
    // Verificar si la orden ya está procesada o completada
    if (['shipped', 'delivered', 'completed', 'cancelled', 'refunded'].includes(order.status)) {
      return next(new AppError('No se puede modificar una orden en este estado', 400));
    }
    
    // Verificar permisos
    const isAdmin = req.user.role === 'admin';
    const isOwner = req.user.id === order.userId;
    
    if (!isAdmin && !isOwner) {
      return next(new AppError('No tienes permiso para modificar esta orden', 403));
    }
    
    // Verificar si el producto existe en la orden
    const item = order.items.find(item => item.productId === productId);
    
    if (!item) {
      return next(new AppError('Producto no encontrado en la orden', 404));
    }
    
    // Guardar la cantidad para el evento
    const quantity = item.quantity;
    
    // Eliminar item de la orden
    order.removeItem(productId);
    await order.save();
    
    // Publicar evento
    await publishOrderEvent('order.item.removed', {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      userId: order.userId,
      productId,
      quantity,
      updatedAt: new Date().toISOString(),
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        order,
      },
    });
  } catch (error) {
    logger.error(`Error al eliminar item de orden ${req.params.id}:`, error);
    next(error);
  }
};

/**
 * Aplicar un código de descuento
 */
exports.applyDiscount = async (req, res, next) => {
  try {
    const orderId = req.params.id;
    const { code } = req.body;
    
    if (!code) {
      return next(new AppError('Se requiere código de descuento', 400));
    }
    
    // Buscar orden
    const order = await Order.findById(orderId);
    
    if (!order) {
      return next(new AppError('Orden no encontrada', 404));
    }
    
    // Verificar si la orden ya está procesada o completada
    if (['shipped', 'delivered', 'completed', 'cancelled', 'refunded'].includes(order.status)) {
      return next(new AppError('No se puede modificar una orden en este estado', 400));
    }
    
    // Verificar permisos
    const isAdmin = req.user.role === 'admin';
    const isOwner = req.user.id === order.userId;
    
    if (!isAdmin && !isOwner) {
      return next(new AppError('No tienes permiso para modificar esta orden', 403));
    }
    
    // Aquí se validaría el código de descuento contra un servicio/API
    // Por simplicidad, simulamos un descuento del 10%
    const discount = {
      code,
      type: 'percentage',
      amount: 10,
      description: 'Descuento del 10%',
    };
    
    // Aplicar descuento
    order.applyDiscount(discount);
    await order.save();
    
    res.status(200).json({
      status: 'success',
      data: {
        order,
      },
    });
  } catch (error) {
    logger.error(`Error al aplicar descuento a orden ${req.params.id}:`, error);
    next(error);
  }
};

/**
 * Cancelar una orden
 */
exports.cancelOrder = async (req, res, next) => {
  try {
    const orderId = req.params.id;
    const { reason } = req.body;
    
    // Buscar orden
    const order = await Order.findById(orderId);
    
    if (!order) {
      return next(new AppError('Orden no encontrada', 404));
    }
    
    // Verificar si la orden puede ser cancelada
    if (['delivered', 'completed', 'cancelled', 'refunded'].includes(order.status)) {
      return next(new AppError('Esta orden no puede ser cancelada', 400));
    }
    
    // Verificar permisos
    const isAdmin = req.user.role === 'admin';
    const isOwner = req.user.id === order.userId;
    
    if (!isAdmin && !isOwner) {
      return next(new AppError('No tienes permiso para cancelar esta orden', 403));
    }
    
    // Si es usuario normal, solo puede cancelar órdenes pendientes o en espera de pago
    if (!isAdmin && !['pending', 'payment_pending'].includes(order.status)) {
      return next(new AppError('No puedes cancelar una orden en este estado', 403));
    }
    
    // Actualizar estado
    order.updateStatus('cancelled', reason || 'Cancelado por el usuario/administrador');
    await order.save();
    
    // Publicar evento
    await publishOrderEvent('order.cancelled', {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      userId: order.userId,
      reason,
      items: order.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
      cancelledAt: order.cancelledAt,
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        order,
      },
    });
  } catch (error) {
    logger.error(`Error al cancelar orden ${req.params.id}:`, error);
    next(error);
  }
};

// Funciones auxiliares

/**
 * Valida elementos de orden y obtiene información actualizada de productos
 */
async function validateOrderItems(items) {
  // Validar cada item
  const validatedItems = [];
  
  for (const item of items) {
    try {
      // Obtener información actualizada del producto
      const productInfo = await getProductInfo(item.productId);
      
      // Verificar stock (se podría hacer aquí o al publicar el evento)
      
      // Crear item validado
      const validatedItem = {
        productId: item.productId,
        sku: productInfo.sku,
        name: productInfo.name,
        price: productInfo.price,
        salePrice: productInfo.salePrice || 0,
        quantity: item.quantity,
        subtotal: 0, // Se calculará posteriormente
        taxes: 0, // Se asume por ahora
        discount: 0, // Se asume por ahora
        total: 0, // Se calculará posteriormente
        image: productInfo.featuredImage,
        isDigital: productInfo.isDigital || false,
        weight: productInfo.weight || 0,
      };
      
      validatedItems.push(validatedItem);
    } catch (error) {
      logger.error(`Error al validar producto ${item.productId}:`, error);
      throw new AppError(`Producto no válido o no disponible: ${item.productId}`, 400);
    }
  }
  
  return validatedItems;
}

/**
 * Obtiene información actualizada de un producto desde el servicio de productos
 */
async function getProductInfo(productId) {
  try {
    const response = await axios.get(`${PRODUCT_SERVICE_URL}/api/products/${productId}`);
    
    if (!response.data || !response.data.data || !response.data.data.product) {
      throw new Error('Respuesta inválida del servicio de productos');
    }
    
    return response.data.data.product;
  } catch (error) {
    logger.error(`Error al obtener información del producto ${productId}:`, error);
    throw new AppError('No se pudo obtener información del producto', 500);
  }
}