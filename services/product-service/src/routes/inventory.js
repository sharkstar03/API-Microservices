const express = require('express');
const { body, param, query } = require('express-validator');
const inventoryController = require('../controllers/inventoryController');
const validateRequest = require('../middleware/validateRequest');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Inventario
 *   description: Control de stock y reservas
 */

// Todas las operaciones de inventario requieren autenticación
router.use(authenticate);

/**
 * @swagger
 * /api/inventory:
 *   get:
 *     summary: Listar el inventario
 *     tags: [Inventario]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: lowStock
 *         schema:
 *           type: boolean
 *         description: Filtrar solo productos por debajo del umbral de stock
 *     responses:
 *       200:
 *         description: Lista de registros de inventario
 *       403:
 *         description: Sin permisos
 */
router.get(
  '/',
  authorize(['admin']),
  [
    query('page').optional().isInt({ min: 1 }).withMessage('La página debe ser un número entero positivo'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('El límite debe ser un número entre 1 y 100'),
    query('inStock').optional().isBoolean().withMessage('inStock debe ser true o false'),
    query('lowStock').optional().isBoolean().withMessage('lowStock debe ser true o false'),
    validateRequest,
  ],
  inventoryController.getAllInventory
);

/**
 * @swagger
 * /api/inventory/{productId}:
 *   get:
 *     summary: Obtener el inventario de un producto
 *     tags: [Inventario]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Inventario del producto
 *       404:
 *         description: Inventario no encontrado
 */
router.get(
  '/:productId',
  [
    param('productId').isUUID().withMessage('ID de producto inválido'),
    validateRequest,
  ],
  inventoryController.getInventoryByProduct
);

/**
 * @swagger
 * /api/inventory/{productId}:
 *   put:
 *     summary: Ajustar la configuración de inventario de un producto
 *     tags: [Inventario]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Inventario actualizado
 *       404:
 *         description: Producto no encontrado
 */
router.put(
  '/:productId',
  authorize(['admin']),
  [
    param('productId').isUUID().withMessage('ID de producto inválido'),
    body('quantity').optional().isInt({ min: 0 }).withMessage('La cantidad no puede ser negativa'),
    body('lowStockThreshold').optional().isInt({ min: 0 }).withMessage('El umbral no puede ser negativo'),
    body('backorderAllowed').optional().isBoolean().withMessage('backorderAllowed debe ser true o false'),
    body('backorderLimit').optional().isInt({ min: 0 }).withMessage('El límite no puede ser negativo'),
    body('warehouseLocation').optional().isString(),
    body('sku').optional().isString(),
    validateRequest,
  ],
  inventoryController.updateInventory
);

/**
 * @swagger
 * /api/inventory/{productId}/restock:
 *   post:
 *     summary: Reponer stock
 *     tags: [Inventario]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stock repuesto
 */
router.post(
  '/:productId/restock',
  authorize(['admin']),
  [
    param('productId').isUUID().withMessage('ID de producto inválido'),
    body('quantity').isInt({ min: 1 }).withMessage('La cantidad debe ser un entero mayor que cero'),
    validateRequest,
  ],
  inventoryController.addStock
);

/**
 * @swagger
 * /api/inventory/{productId}/reserve:
 *   post:
 *     summary: Reservar stock
 *     description: Usado por el order-service al crear una orden
 *     tags: [Inventario]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stock reservado
 *       400:
 *         description: Stock insuficiente
 */
router.post(
  '/:productId/reserve',
  authorize(['admin', 'system']),
  [
    param('productId').isUUID().withMessage('ID de producto inválido'),
    body('quantity').isInt({ min: 1 }).withMessage('La cantidad debe ser un entero mayor que cero'),
    validateRequest,
  ],
  inventoryController.reserveStock
);

/**
 * @swagger
 * /api/inventory/{productId}/release:
 *   post:
 *     summary: Liberar una reserva de stock
 *     description: Usado por el order-service al cancelar una orden
 *     tags: [Inventario]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Reserva liberada
 */
router.post(
  '/:productId/release',
  authorize(['admin', 'system']),
  [
    param('productId').isUUID().withMessage('ID de producto inválido'),
    body('quantity').isInt({ min: 1 }).withMessage('La cantidad debe ser un entero mayor que cero'),
    validateRequest,
  ],
  inventoryController.releaseStock
);

module.exports = router;
