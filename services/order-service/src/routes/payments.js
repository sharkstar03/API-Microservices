const express = require('express');
const { param, body } = require('express-validator');
const paymentController = require('../controllers/paymentController');
const validateRequest = require('../middleware/validateRequest');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: API para gestión de pagos
 */

/**
 * @swagger
 * /api/payments/webhook:
 *   post:
 *     summary: Webhook para pagos
 *     description: Recibe notificaciones de pasarelas de pago
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook procesado correctamente
 *       400:
 *         description: Datos inválidos
 *       500:
 *         description: Error del servidor
 */
router.post(
  '/webhook',
  paymentController.processWebhook
);

/**
 * @swagger
 * /api/payments/methods:
 *   get:
 *     summary: Obtener métodos de pago disponibles
 *     description: Retorna los métodos de pago disponibles para el usuario
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de métodos de pago
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.get(
  '/methods',
  [
    authenticate,
  ],
  paymentController.getPaymentMethods
);

/**
 * @swagger
 * /api/payments/process:
 *   post:
 *     summary: Procesar un pago
 *     description: Inicia el proceso de pago para una orden
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderId
 *               - method
 *             properties:
 *               orderId:
 *                 type: string
 *                 description: ID de la orden
 *               method:
 *                 type: string
 *                 description: Método de pago
 *               paymentDetails:
 *                 type: object
 *                 description: Detalles específicos del método de pago
 *     responses:
 *       200:
 *         description: Pago procesado correctamente o pendiente
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Orden no encontrada
 *       500:
 *         description: Error del servidor
 */
router.post(
  '/process',
  [
    authenticate,
    body('orderId').isMongoId().withMessage('ID de orden inválido'),
    body('method').notEmpty().withMessage('El método de pago es requerido'),
    validateRequest,
  ],
  paymentController.processPayment
);

/**
 * @swagger
 * /api/payments/{id}/verify:
 *   post:
 *     summary: Verificar estado de un pago
 *     description: Verifica el estado actual de un pago
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del pago o transacción
 *     responses:
 *       200:
 *         description: Estado del pago
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Pago no encontrado
 *       500:
 *         description: Error del servidor
 */
router.post(
  '/:id/verify',
  [
    authenticate,
    param('id').isString().withMessage('ID de pago inválido'),
    validateRequest,
  ],
  paymentController.verifyPayment
);

/**
 * @swagger
 * /api/payments/{id}/refund:
 *   post:
 *     summary: Solicitar reembolso
 *     description: Inicia un proceso de reembolso para un pago
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del pago o transacción
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Monto a reembolsar (si es parcial)
 *               reason:
 *                 type: string
 *                 description: Motivo del reembolso
 *     responses:
 *       200:
 *         description: Reembolso procesado correctamente o pendiente
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Acceso prohibido
 *       404:
 *         description: Pago no encontrado
 *       500:
 *         description: Error del servidor
 */
router.post(
  '/:id/refund',
  [
    authenticate,
    authorize('admin'),
    param('id').isString().withMessage('ID de pago inválido'),
    validateRequest,
  ],
  paymentController.processRefund
);

module.exports = router;