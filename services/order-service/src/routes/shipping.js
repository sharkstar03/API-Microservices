const express = require('express');
const { param, body, query } = require('express-validator');
const shippingController = require('../controllers/shippingController');
const validateRequest = require('../middleware/validateRequest');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Shipping
 *   description: API para gestión de envíos
 */

/**
 * @swagger
 * /api/shipping/methods:
 *   get:
 *     summary: Obtener métodos de envío disponibles
 *     description: Retorna los métodos de envío disponibles
 *     tags: [Shipping]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: country
 *         schema:
 *           type: string
 *         description: País de destino
 *       - in: query
 *         name: postalCode
 *         schema:
 *           type: string
 *         description: Código postal
 *     responses:
 *       200:
 *         description: Lista de métodos de envío
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.get(
  '/methods',
  [
    authenticate,
    query('country').optional().isString().withMessage('País inválido'),
    query('postalCode').optional().isString().withMessage('Código postal inválido'),
    validateRequest,
  ],
  shippingController.getShippingMethods
);

/**
 * @swagger
 * /api/shipping/calculate:
 *   post:
 *     summary: Calcular costos de envío
 *     description: Calcula los costos de envío basados en la dirección y productos
 *     tags: [Shipping]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *               - destination
 *             properties:
 *               items:
 *                 type: array
 *                 description: Lista de productos
 *               destination:
 *                 type: object
 *                 description: Dirección de destino
 *               shippingMethod:
 *                 type: string
 *                 description: Método de envío seleccionado
 *     responses:
 *       200:
 *         description: Costos de envío calculados
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.post(
  '/calculate',
  [
    authenticate,
    body('items').isArray().withMessage('Se requiere lista de productos'),
    body('items.*.productId').isString().withMessage('ID de producto inválido'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('La cantidad debe ser mayor a cero'),
    body('destination').notEmpty().withMessage('Se requiere dirección de destino'),
    body('destination.country').notEmpty().withMessage('El país es requerido'),
    body('destination.postalCode').notEmpty().withMessage('El código postal es requerido'),
    validateRequest,
  ],
  shippingController.calculateShipping
);

/**
 * @swagger
 * /api/shipping/track/{trackingNumber}:
 *   get:
 *     summary: Rastrear envío
 *     description: Obtiene información de seguimiento de un envío
 *     tags: [Shipping]
 *     parameters:
 *       - in: path
 *         name: trackingNumber
 *         required: true
 *         schema:
 *           type: string
 *         description: Número de seguimiento
 *     responses:
 *       200:
 *         description: Información de seguimiento
 *       404:
 *         description: Envío no encontrado
 *       500:
 *         description: Error del servidor
 */
router.get(
  '/track/:trackingNumber',
  [
    param('trackingNumber').isString().withMessage('Número de seguimiento inválido'),
    validateRequest,
  ],
  shippingController.trackShipment
);

/**
 * @swagger
 * /api/shipping/orders/{orderId}:
 *   get:
 *     summary: Obtener información de envío de una orden
 *     description: Retorna detalles de envío para una orden específica
 *     tags: [Shipping]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la orden
 *     responses:
 *       200:
 *         description: Información de envío
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Acceso prohibido
 *       404:
 *         description: Orden no encontrada
 *       500:
 *         description: Error del servidor
 */
router.get(
  '/orders/:orderId',
  [
    authenticate,
    param('orderId').isMongoId().withMessage('ID de orden inválido'),
    validateRequest,
  ],
  shippingController.getOrderShipping
);

/**
 * @swagger
 * /api/shipping/orders/{orderId}/update:
 *   put:
 *     summary: Actualizar información de envío de una orden
 *     description: Actualiza el estado y detalles de envío de una orden
 *     tags: [Shipping]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la orden
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 description: Estado del envío
 *               trackingNumber:
 *                 type: string
 *                 description: Número de seguimiento
 *               carrier:
 *                 type: string
 *                 description: Empresa transportista
 *               estimatedDelivery:
 *                 type: string
 *                 format: date
 *                 description: Fecha estimada de entrega
 *               notes:
 *                 type: string
 *                 description: Notas adicionales
 *     responses:
 *       200:
 *         description: Información de envío actualizada
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Acceso prohibido
 *       404:
 *         description: Orden no encontrada
 *       500:
 *         description: Error del servidor
 */
router.put(
  '/orders/:orderId/update',
  [
    authenticate,
    authorize('admin'),
    param('orderId').isMongoId().withMessage('ID de orden inválido'),
    validateRequest,
  ],
  shippingController.updateOrderShipping
);

module.exports = router;