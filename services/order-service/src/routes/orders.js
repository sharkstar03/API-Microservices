const express = require('express');
const { param, body, query } = require('express-validator');
const orderController = require('../controllers/orderController');
const validateRequest = require('../middleware/validateRequest');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: API para gestión de órdenes
 */

/**
 * @swagger
 * /api/orders:
 *   get:
 *     summary: Obtener todas las órdenes
 *     description: Retorna una lista paginada de órdenes
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Número de elementos por página
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filtrar por estado
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha inicial para filtrar
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha final para filtrar
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar por número de orden, email o producto
 *     responses:
 *       200:
 *         description: Lista de órdenes
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Acceso prohibido
 *       500:
 *         description: Error del servidor
 */
router.get(
  '/',
  [
    authenticate,
    authorize('admin'),
    query('page').optional().isInt({ min: 1 }).withMessage('La página debe ser un número entero positivo'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('El límite debe ser un número entre 1 y 100'),
    query('status').optional().isString().withMessage('Estado no válido'),
    query('fromDate').optional().isDate().withMessage('Fecha inicial no válida'),
    query('toDate').optional().isDate().withMessage('Fecha final no válida'),
    validateRequest,
  ],
  orderController.getAllOrders
);

/**
 * @swagger
 * /api/orders/user/{userId}:
 *   get:
 *     summary: Obtener órdenes de un usuario
 *     description: Retorna las órdenes de un usuario específico
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: a
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Número de elementos por página
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filtrar por estado
 *     responses:
 *       200:
 *         description: Lista de órdenes del usuario
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Acceso prohibido
 *       404:
 *         description: Usuario no encontrado
 *       500:
 *         description: Error del servidor
 */
router.get(
  '/user/:userId',
  [
    authenticate,
    authorize(['admin', 'self']),
    param('userId').isString().withMessage('ID de usuario inválido'),
    query('page').optional().isInt({ min: 1 }).withMessage('La página debe ser un número entero positivo'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('El límite debe ser un número entre 1 y 100'),
    query('status').optional().isString().withMessage('Estado no válido'),
    validateRequest,
  ],
  orderController.getUserOrders
);

/**
 * @swagger
 * /api/orders/{id}:
 *   get:
 *     summary: Obtener una orden por ID
 *     description: Retorna una orden específica por su ID
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la orden
 *     responses:
 *       200:
 *         description: Datos de la orden
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
  '/:id',
  [
    authenticate,
    // La autorización se manejará en el controlador
    param('id').isMongoId().withMessage('ID de orden inválido'),
    validateRequest,
  ],
  orderController.getOrderById
);

/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Crear una nueva orden
 *     description: Crea una nueva orden en el sistema
 *     tags: [Orders]
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
 *               - shippingAddress
 *             properties:
 *               items:
 *                 type: array
 *                 description: Lista de productos
 *                 items:
 *                   type: object
 *                   required:
 *                     - productId
 *                     - quantity
 *                   properties:
 *                     productId:
 *                       type: string
 *                       description: ID del producto
 *                     quantity:
 *                       type: integer
 *                       description: Cantidad
 *               shippingAddress:
 *                 type: object
 *                 description: Dirección de envío
 *               billingAddress:
 *                 type: object
 *                 description: Dirección de facturación
 *               payment:
 *                 type: object
 *                 description: Información de pago
 *               shipping:
 *                 type: object
 *                 description: Información de envío
 *               notes:
 *                 type: string
 *                 description: Notas generales
 *               customerNotes:
 *                 type: string
 *                 description: Notas del cliente
 *     responses:
 *       201:
 *         description: Orden creada correctamente
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.post(
  '/',
  [
    authenticate,
    body('items').isArray({ min: 1 }).withMessage('Se requiere al menos un producto'),
    body('items.*.productId').isString().withMessage('ID de producto inválido'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('La cantidad debe ser mayor a cero'),
    body('shippingAddress').notEmpty().withMessage('Se requiere dirección de envío'),
    body('shippingAddress.name').notEmpty().withMessage('El nombre es requerido'),
    body('shippingAddress.addressLine1').notEmpty().withMessage('La dirección es requerida'),
    body('shippingAddress.city').notEmpty().withMessage('La ciudad es requerida'),
    body('shippingAddress.state').notEmpty().withMessage('El estado es requerido'),
    body('shippingAddress.postalCode').notEmpty().withMessage('El código postal es requerido'),
    body('shippingAddress.country').notEmpty().withMessage('El país es requerido'),
    validateRequest,
  ],
  orderController.createOrder
);

/**
 * @swagger
 * /api/orders/{id}/status:
 *   put:
 *     summary: Actualizar estado de una orden
 *     description: Actualiza el estado de una orden existente
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 description: Nuevo estado de la orden
 *               notes:
 *                 type: string
 *                 description: Notas sobre el cambio de estado
 *     responses:
 *       200:
 *         description: Estado actualizado correctamente
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
  '/:id/status',
  [
    authenticate,
    authorize('admin'),
    param('id').isMongoId().withMessage('ID de orden inválido'),
    body('status').notEmpty().withMessage('El estado es requerido'),
    validateRequest,
  ],
  orderController.updateOrderStatus
);

/**
 * @swagger
 * /api/orders/{id}/payment:
 *   put:
 *     summary: Actualizar información de pago
 *     description: Actualiza la información de pago de una orden
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *             required:
 *               - method
 *               - status
 *             properties:
 *               method:
 *                 type: string
 *                 description: Método de pago
 *               status:
 *                 type: string
 *                 description: Estado del pago
 *               transactionId:
 *                 type: string
 *                 description: ID de la transacción
 *     responses:
 *       200:
 *         description: Pago actualizado correctamente
 *       400:
 *         description: Datos */