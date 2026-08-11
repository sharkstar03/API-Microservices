const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { param, body, query } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');
const logger = require('../utils/logger');

const router = express.Router();

// URL del servicio de órdenes
const orderServiceUrl = process.env.ORDER_SERVICE_URL || 'http://order-service:3004';

/**
 * Configuración común del proxy hacia el order-service.
 * El gateway expone /api/v1/orders y el servicio escucha en /api/orders.
 */
const orderProxy = (pathRewrite) =>
  createProxyMiddleware({
    target: orderServiceUrl,
    pathRewrite,
    changeOrigin: true,
    onProxyReq: (proxyReq, req) => {
      // Propagar la identidad del usuario autenticado al servicio
      if (req.user) {
        proxyReq.setHeader('X-User-Id', req.user.id);
        proxyReq.setHeader('X-User-Role', req.user.role);
      }
    },
    onError: (err, req, res) => {
      logger.error('Error al proxy órdenes:', err);
      res.status(502).json({ message: 'Error al conectar con el servicio de órdenes' });
    },
  });

const toOrders = { '^/api/v1/orders': '/api/orders' };
const toPayments = { '^/api/v1/orders/payments': '/api/payments' };
const toShipping = { '^/api/v1/orders/shipping': '/api/shipping' };

/**
 * @swagger
 * tags:
 *   name: Órdenes
 *   description: API para gestión de órdenes, pagos y envíos
 */

// Pagos y envíos van antes que /:id para que no los capture
router.use('/payments', orderProxy(toPayments));
router.use('/shipping', orderProxy(toShipping));

/**
 * @swagger
 * /api/v1/orders:
 *   get:
 *     summary: Listar órdenes (solo admin)
 *     tags: [Órdenes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filtrar por estado de la orden
 *     responses:
 *       200:
 *         description: Lista de órdenes
 *       403:
 *         description: Sin permisos
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('La página debe ser un número entero positivo'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('El límite debe ser un número entre 1 y 100'),
    validateRequest,
  ],
  orderProxy(toOrders)
);

/**
 * @swagger
 * /api/v1/orders/user/{userId}:
 *   get:
 *     summary: Obtener las órdenes de un usuario
 *     tags: [Órdenes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de órdenes del usuario
 *       403:
 *         description: Sin permisos
 */
router.get(
  '/user/:userId',
  [
    param('userId').notEmpty().withMessage('El ID de usuario es requerido'),
    validateRequest,
  ],
  orderProxy(toOrders)
);

/**
 * @swagger
 * /api/v1/orders/{id}:
 *   get:
 *     summary: Obtener una orden por ID
 *     tags: [Órdenes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Datos de la orden
 *       404:
 *         description: Orden no encontrada
 */
router.get(
  '/:id',
  [
    param('id').isMongoId().withMessage('ID de orden inválido'),
    validateRequest,
  ],
  orderProxy(toOrders)
);

/**
 * @swagger
 * /api/v1/orders:
 *   post:
 *     summary: Crear una orden
 *     tags: [Órdenes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Orden creada
 *       400:
 *         description: Datos inválidos
 */
router.post(
  '/',
  [
    body('items')
      .isArray({ min: 1 }).withMessage('La orden debe incluir al menos un producto'),
    body('items.*.productId')
      .notEmpty().withMessage('El ID del producto es requerido'),
    body('items.*.quantity')
      .isInt({ min: 1 }).withMessage('La cantidad debe ser un entero mayor que cero'),
    validateRequest,
  ],
  orderProxy(toOrders)
);

/**
 * @swagger
 * /api/v1/orders/{id}/status:
 *   patch:
 *     summary: Actualizar el estado de una orden
 *     tags: [Órdenes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estado actualizado
 */
router.patch(
  '/:id/status',
  [
    param('id').isMongoId().withMessage('ID de orden inválido'),
    body('status').notEmpty().withMessage('El estado es requerido'),
    validateRequest,
  ],
  orderProxy(toOrders)
);

/**
 * @swagger
 * /api/v1/orders/{id}/cancel:
 *   post:
 *     summary: Cancelar una orden
 *     tags: [Órdenes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Orden cancelada
 */
router.post(
  '/:id/cancel',
  [
    param('id').isMongoId().withMessage('ID de orden inválido'),
    validateRequest,
  ],
  orderProxy(toOrders)
);

module.exports = router;
