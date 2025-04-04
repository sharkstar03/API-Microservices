const express = require('express');
const { param, body } = require('express-validator');
const addressController = require('../controllers/addressController');
const validateRequest = require('../middleware/validateRequest');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Addresses
 *   description: API para gestión de direcciones de usuario
 */

/**
 * @swagger
 * /api/addresses/{userId}:
 *   get:
 *     summary: Obtener direcciones de un usuario
 *     description: Retorna todas las direcciones de un usuario
 *     tags: [Addresses]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Lista de direcciones
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Usuario no encontrado
 *       500:
 *         description: Error del servidor
 */
router.get(
  '/:userId',
  [
    authenticate,
    authorize(['admin', 'self']),
    param('userId').isString().withMessage('ID de usuario inválido'),
    validateRequest,
  ],
  addressController.getUserAddresses
);

/**
 * @swagger
 * /api/addresses/{userId}/{addressId}:
 *   get:
 *     summary: Obtener una dirección específica
 *     description: Retorna una dirección específica de un usuario
 *     tags: [Addresses]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario
 *       - in: path
 *         name: addressId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la dirección
 *     responses:
 *       200:
 *         description: Datos de la dirección
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Usuario o dirección no encontrados
 *       500:
 *         description: Error del servidor
 */
router.get(
  '/:userId/:addressId',
  [
    authenticate,
    authorize(['admin', 'self']),
    param('userId').isString().withMessage('ID de usuario inválido'),
    param('addressId').isMongoId().withMessage('ID de dirección inválido'),
    validateRequest,
  ],
  addressController.getAddress
);

/**
 * @swagger
 * /api/addresses/{userId}:
 *   post:
 *     summary: Crear una nueva dirección
 *     description: Agrega una nueva dirección para un usuario
 *     tags: [Addresses]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - addressLine1
 *               - city
 *               - state
 *               - postalCode
 *               - country
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [shipping, billing, home, work, other]
 *                 description: Tipo de dirección
 *               isDefault:
 *                 type: boolean
 *                 description: Si es la dirección predeterminada
 *               name:
 *                 type: string
 *                 description: Nombre de la dirección (ej. "Casa", "Oficina")
 *               addressLine1:
 *                 type: string
 *                 description: Línea 1 de la dirección
 *               addressLine2:
 *                 type: string
 *                 description: Línea 2 de la dirección
 *               city:
 *                 type: string
 *                 description: Ciudad
 *               state:
 *                 type: string
 *                 description: Estado o provincia
 *               postalCode:
 *                 type: string
 *                 description: Código postal
 *               country:
 *                 type: string
 *                 description: País
 *               phoneNumber:
 *                 type: string
 *                 description: Número de teléfono
 *               instructions:
 *                 type: string
 *                 description: Instrucciones de entrega
 *               coordinates:
 *                 type: object
 *                 properties:
 *                   latitude:
 *                     type: number
 *                   longitude:
 *                     type: number
 *     responses:
 *       201:
 *         description: Dirección creada correctamente
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Usuario no encontrado
 *       500:
 *         description: Error del servidor
 */
router.post(
  '/:userId',
  [
    authenticate,
    authorize(['admin', 'self']),
    param('userId').isString().withMessage('ID de usuario inválido'),
    body('type').optional().isIn(['shipping', 'billing', 'home', 'work', 'other']).withMessage('Tipo de dirección inválido'),
    body('isDefault').optional().isBoolean().withMessage('isDefault debe ser un booleano'),
    body('name').notEmpty().withMessage('El nombre es requerido'),
    body('addressLine1').notEmpty().withMessage('La línea 1 de dirección es requerida'),
    body('city').notEmpty().withMessage('La ciudad es requerida'),
    body('state').notEmpty().withMessage('El estado es requerido'),
    body('postalCode').notEmpty().withMessage('El código postal es requerido'),
    body('country').notEmpty().withMessage('El país es requerido'),
    validateRequest,
  ],
  addressController.createAddress
);

/**
 * @swagger
 * /api/addresses/{userId}/{addressId}:
 *   put:
 *     summary: Actualizar una dirección
 *     description: Actualiza los datos de una dirección existente
 *     tags: [Addresses]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario
 *       - in: path
 *         name: addressId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la dirección
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [shipping, billing, home, work, other]
 *                 description: Tipo de dirección
 *               isDefault:
 *                 type: boolean
 *                 description: Si es la dirección predeterminada
 *               name:
 *                 type: string
 *                 description: Nombre de la dirección
 *               addressLine1:
 *                 type: string
 *                 description: Línea 1 de la dirección
 *               addressLine2:
 *                 type: string
 *                 description: Línea 2 de la dirección
 *               city:
 *                 type: string
 *                 description: Ciudad
 *               state:
 *                 type: string
 *                 description: Estado o provincia
 *               postalCode:
 *                 type: string
 *                 description: Código postal
 *               country:
 *                 type: string
 *                 description: País
 *               phoneNumber:
 *                 type: string
 *                 description: Número de teléfono
 *               instructions:
 *                 type: string
 *                 description: Instrucciones de entrega
 *     responses:
 *       200:
 *         description: Dirección actualizada correctamente
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Usuario o dirección no encontrados
 *       500:
 *         description: Error del servidor
 */
router.put(
  '/:userId/:addressId',
  [
    authenticate,
    authorize(['admin', 'self']),
    param('userId').isString().withMessage('ID de usuario inválido'),
    param('addressId').isMongoId().withMessage('ID de dirección inválido'),
    body('type').optional().isIn(['shipping', 'billing', 'home', 'work', 'other']).withMessage('Tipo de dirección inválido'),
    body('isDefault').optional().isBoolean().withMessage('isDefault debe ser un booleano'),
    validateRequest,
  ],
  addressController.updateAddress
);

/**
 * @swagger
 * /api/addresses/{userId}/{addressId}:
 *   delete:
 *     summary: Eliminar una dirección
 *     description: Elimina una dirección de un usuario
 *     tags: [Addresses]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario
 *       - in: path
 *         name: addressId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la dirección
 *     responses:
 *       200:
 *         description: Dirección eliminada correctamente
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Usuario o dirección no encontrados
 *       500:
 *         description: Error del servidor
 */
router.delete(
  '/:userId/:addressId',
  [
    authenticate,
    authorize(['admin', 'self']),
    param('userId').isString().withMessage('ID de usuario inválido'),
    param('addressId').isMongoId().withMessage('ID de dirección inválido'),
    validateRequest,
  ],
  addressController.deleteAddress
);

/**
 * @swagger
 * /api/addresses/{userId}/{addressId}/default:
 *   put:
 *     summary: Establecer dirección como predeterminada
 *     description: Marca una dirección como predeterminada para un tipo
 *     tags: [Addresses]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario
 *       - in: path
 *         name: addressId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la dirección
 *     responses:
 *       200:
 *         description: Dirección establecida como predeterminada
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Usuario o dirección no encontrados
 *       500:
 *         description: Error del servidor
 */
router.put(
  '/:userId/:addressId/default',
  [
    authenticate,
    authorize(['admin', 'self']),
    param('userId').isString().withMessage('ID de usuario inválido'),
    param('addressId').isMongoId().withMessage('ID de dirección inválido'),
    validateRequest,
  ],
  addressController.setDefaultAddress
);

module.exports = router;