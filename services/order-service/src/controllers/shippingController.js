const Order = require('../models/Order');
const { publishOrderEvent } = require('../messaging/publisher');
const axios = require('axios');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

// URL del servicio de productos
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://product-service:3003';

/**
 * Obtener métodos de envío disponibles
 */
exports.getShippingMethods = async (req, res, next) => {
  try {
    const { country, postalCode } = req.query;
    
    // En una implementación real, consultaríamos una API o base de datos
    // para obtener los métodos disponibles según la ubicación
    
    // Lista de métodos de envío disponibles
    const shippingMethods = [
      {
        id: 'standard',
        name: 'Envío Estándar',
        description: 'Entrega en 3-5 días hábiles',
        price: 5.99,
        estimatedDeliveryDays: 5,
        icon: 'truck',
        availableForCountry: !country || ['US', 'CA', 'MX', 'ES'].includes(country),
      },
      {
        id: 'express',
        name: 'Envío Express',
        description: 'Entrega en 1-2 días hábiles',
        price: 12.99,
        estimatedDeliveryDays: 2,
        icon: 'truck-fast',
        availableForCountry: !country || ['US', 'CA', 'ES'].includes(country),
      },
      {
        id: 'international',
        name: 'Envío Internacional',
        description: 'Entrega en 7-14 días hábiles',
        price: 25.99,
        estimatedDeliveryDays: 14,
        icon: 'globe',
        availableForCountry: country && !['US', 'CA', 'MX', 'ES'].includes(country),
      },
      {
        id: 'pickup',
        name: 'Recoger en Tienda',
        description: 'Recoge tu pedido en nuestras tiendas',
        price: 0,
        estimatedDeliveryDays: 1,
        icon: 'store',
        availableForCountry: true,
      },
    ];
    
    // Filtrar métodos disponibles según el país
    const availableMethods = shippingMethods.filter(method => method.availableForCountry);
    
    res.status(200).json({
      status: 'success',
      data: {
        methods: availableMethods,
      },
    });
  } catch (error) {
    logger.error('Error al obtener métodos de envío:', error);
    next(error);
  }
};

/**
 * Calcular costos de envío
 */
exports.calculateShipping = async (req, res, next) => {
  try {
    const { items, destination, shippingMethod = 'standard' } = req.body;
    
    // Obtener información de productos para calcular peso y dimensiones
    const productInfo = await getProductsInfo(items);
    
    // Calcular peso total
    const totalWeight = calculateTotalWeight(items, productInfo);
    
    // Obtener tarifa base según el método de envío
    const baseRate = getShippingBaseRate(shippingMethod);
    
    // Calcular tarifa según peso
    const weightRate = calculateWeightRate(totalWeight);
    
    // Calcular tarifa según distancia/zona
    const distanceRate = calculateDistanceRate(destination);
    
    // Cálculo final del costo de envío
    const shippingCost = baseRate + weightRate + distanceRate;
    
    // Estimación de entrega
    const estimatedDelivery = calculateEstimatedDelivery(shippingMethod);
    
    res.status(200).json({
      status: 'success',
      data: {
        shippingMethod,
        cost: shippingCost,
        currency: 'USD',
        estimatedDelivery,
        details: {
          baseRate,
          weightRate,
          distanceRate,
          totalWeight,
        },
      },
    });
  } catch (error) {
    logger.error('Error al calcular costos de envío:', error);
    next(error);
  }
};

/**
 * Rastrear envío
 */
exports.trackShipment = async (req, res, next) => {
  try {
    const { trackingNumber } = req.params;
    
    // Buscar orden por número de seguimiento
    const order = await Order.findOne({ 'shipping.trackingNumber': trackingNumber });
    
    if (!order) {
      return next(new AppError('Envío no encontrado', 404));
    }
    
    // En una implementación real, consultaríamos con la API del transportista
    // Aquí generamos información de tracking simulada
    
    const trackingInfo = generateTrackingInfo(order, trackingNumber);
    
    res.status(200).json({
      status: 'success',
      data: {
        tracking: trackingInfo,
      },
    });
  } catch (error) {
    logger.error(`Error al rastrear envío ${req.params.trackingNumber}:`, error);
    next(error);
  }
};

/**
 * Obtener información de envío de una orden
 */
exports.getOrderShipping = async (req, res, next) => {
  try {
    const orderId = req.params.orderId;
    
    // Buscar orden
    const order = await Order.findById(orderId);
    
    if (!order) {
      return next(new AppError('Orden no encontrada', 404));
    }
    
    // Verificar permisos
    const isOwner = req.user.id === order.userId;
    
    if (!isOwner && req.user.role !== 'admin') {
      return next(new AppError('No tienes permiso para ver esta información', 403));
    }
    
    // Si no hay información de envío
    if (!order.shipping) {
      return next(new AppError('Esta orden no tiene información de envío', 404));
    }
    
    // Generar información de tracking si está disponible
    let trackingInfo = null;
    if (order.shipping.trackingNumber) {
      trackingInfo = generateTrackingInfo(order, order.shipping.trackingNumber);
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        shipping: order.shipping,
        trackingInfo,
        shippingAddress: order.shippingAddress,
      },
    });
  } catch (error) {
    logger.error(`Error al obtener información de envío de orden ${req.params.orderId}:`, error);
    next(error);
  }
};

/**
 * Actualizar información de envío de una orden
 */
exports.updateOrderShipping = async (req, res, next) => {
  try {
    const orderId = req.params.orderId;
    const shippingInfo = req.body;
    
    // Buscar orden
    const order = await Order.findById(orderId);
    
    if (!order) {
      return next(new AppError('Orden no encontrada', 404));
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
        shippedAt: order.shipping.shippedAt,
        deliveredAt: order.shipping.deliveredAt,
        updatedAt: new Date().toISOString(),
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        shipping: order.shipping,
      },
    });
  } catch (error) {
    logger.error(`Error al actualizar envío de orden ${req.params.orderId}:`, error);
    next(error);
  }
};

// Funciones auxiliares

/**
 * Obtener información de productos desde el servicio de productos
 */
async function getProductsInfo(items) {
  try {
    // En una implementación real, haríamos una llamada al servicio de productos
    // para obtener información detallada de cada producto
    
    // Array para almacenar información
    const productInfo = {};
    
    // Obtener información en paralelo
    const promises = items.map(async (item) => {
      try {
        const response = await axios.get(`${PRODUCT_SERVICE_URL}/api/products/${item.productId}`);
        
        if (response.data && response.data.data && response.data.data.product) {
          productInfo[item.productId] = response.data.data.product;
        }
      } catch (error) {
        logger.error(`Error al obtener información del producto ${item.productId}:`, error);
        // Si falla, guardar información básica
        productInfo[item.productId] = {
          id: item.productId,
          weight: 0.5, // Peso por defecto en kg
          dimensions: { width: 10, height: 10, depth: 10 }, // Dimensiones por defecto en cm
        };
      }
    });
    
    await Promise.all(promises);
    
    return productInfo;
  } catch (error) {
    logger.error('Error al obtener información de productos:', error);
    throw error;
  }
}

/**
 * Calcular peso total de los productos
 */
function calculateTotalWeight(items, productInfo) {
  return items.reduce((total, item) => {
    const product = productInfo[item.productId];
    const weight = product?.weight || 0.5; // Peso por defecto si no está disponible
    return total + (weight * item.quantity);
  }, 0);
}

/**
 * Obtener tarifa base según el método de envío
 */
function getShippingBaseRate(method) {
  const rates = {
    standard: 5.99,
    express: 12.99,
    international: 25.99,
    pickup: 0,
  };
  
  return rates[method] || rates.standard;
}

/**
 * Calcular tarifa según el peso
 */
function calculateWeightRate(weight) {
  // Tarifa base para los primeros 5 kg
  if (weight <= 5) {
    return 0;
  }
  
  // Tarifa adicional por cada kg extra
  const extraWeight = weight - 5;
  return extraWeight * 1.5;
}

/**
 * Calcular tarifa según la distancia o zona
 */
function calculateDistanceRate(destination) {
  // Simplificado: basado en el país
  const countryRates = {
    'US': 0,
    'CA': 5,
    'MX': 8,
    'ES': 15,
  };
  
  return countryRates[destination.country] || 20; // Tasa por defecto para países no listados
}

/**
 * Calcular fecha estimada de entrega
 */
function calculateEstimatedDelivery(method) {
  const deliveryDays = {
    standard: 5,
    express: 2,
    international: 14,
    pickup: 1,
  };
  
  const days = deliveryDays[method] || deliveryDays.standard;
  
  // Calcular fecha de entrega estimada
  const estimatedDate = new Date();
  estimatedDate.setDate(estimatedDate.getDate() + days);
  
  return estimatedDate.toISOString().split('T')[0]; // Formato YYYY-MM-DD
}

/**
 * Generar información de tracking simulada
 */
function generateTrackingInfo(order, trackingNumber) {
  // Estado actual del envío
  const shippingStatus = order.shipping.status;
  
  // Fecha de creación de la orden
  const orderDate = order.createdAt;
  
  // Fecha de envío (si existe)
  const shippedDate = order.shipping.shippedAt || new Date(orderDate.getTime() + 2 * 24 * 60 * 60 * 1000);
  
  // Fecha estimada de entrega
  const estimatedDelivery = order.shipping.estimatedDelivery || new Date(orderDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  // Fecha de entrega (si existe)
  const deliveredDate = order.shipping.deliveredAt;
  
  // Generar eventos de tracking según el estado
  const events = [];
  
  // Siempre añadir evento de orden recibida
  events.push({
    date: orderDate.toISOString(),
    status: 'order_received',
    description: 'Orden recibida y procesando',
    location: 'Centro de Distribución',
  });
  
  // Si está al menos en procesamiento, añadir evento
  if (['processing', 'shipped', 'delivered'].includes(shippingStatus)) {
    events.push({
      date: new Date(orderDate.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'processing',
      description: 'Pedido en preparación',
      location: 'Centro de Distribución',
    });
  }
  
  // Si está enviado o entregado, añadir evento de envío
  if (['shipped', 'delivered'].includes(shippingStatus)) {
    events.push({
      date: shippedDate.toISOString(),
      status: 'shipped',
      description: 'Pedido enviado',
      location: 'Centro de Distribución',
    });
    
    // Añadir evento intermedio de transporte
    events.push({
      date: new Date(shippedDate.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'in_transit',
      description: 'En camino al destino',
      location: 'Centro de Transporte',
    });
  }
  
  // Si está entregado, añadir evento de entrega
  if (shippingStatus === 'delivered' && deliveredDate) {
    events.push({
      date: deliveredDate.toISOString(),
      status: 'delivered',
      description: 'Pedido entregado',
      location: order.shippingAddress.city,
    });
  }
  
  // Ordenar eventos por fecha
  events.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Construir objeto de tracking
  return {
    trackingNumber,
    carrier: order.shipping.carrier || 'Express Delivery',
    status: shippingStatus,
    estimatedDelivery: estimatedDelivery.toISOString().split('T')[0],
    events,
    lastUpdate: events[events.length - 1].date,
  };
}