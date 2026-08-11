const express = require('express');
const { body, param, query } = require('express-validator');
const categoryController = require('../controllers/categoryController');
const validateRequest = require('../middleware/validateRequest');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Categorías
 *   description: Gestión del catálogo de categorías
 */

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Listar categorías
 *     tags: [Categorías]
 *     parameters:
 *       - in: query
 *         name: tree
 *         schema:
 *           type: boolean
 *         description: Devolver las categorías en estructura jerárquica
 *       - in: query
 *         name: onlyActive
 *         schema:
 *           type: boolean
 *         description: Filtrar solo categorías activas
 *     responses:
 *       200:
 *         description: Lista de categorías
 *       500:
 *         description: Error del servidor
 */
router.get(
  '/',
  [
    query('tree').optional().isBoolean().withMessage('tree debe ser true o false'),
    query('onlyActive').optional().isBoolean().withMessage('onlyActive debe ser true o false'),
    validateRequest,
  ],
  categoryController.getAllCategories
);

/**
 * @swagger
 * /api/categories/{id}:
 *   get:
 *     summary: Obtener una categoría por ID o slug
 *     tags: [Categorías]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: UUID o slug de la categoría
 *     responses:
 *       200:
 *         description: Datos de la categoría
 *       404:
 *         description: Categoría no encontrada
 */
router.get(
  '/:id',
  [
    param('id').notEmpty().withMessage('El identificador es requerido'),
    validateRequest,
  ],
  categoryController.getCategoryById
);

/**
 * @swagger
 * /api/categories:
 *   post:
 *     summary: Crear una categoría
 *     tags: [Categorías]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Categoría creada
 *       400:
 *         description: Datos inválidos
 *       403:
 *         description: Sin permisos
 *       409:
 *         description: El slug ya existe
 */
router.post(
  '/',
  authenticate,
  authorize(['admin']),
  [
    body('name')
      .notEmpty().withMessage('El nombre es requerido')
      .isLength({ max: 100 }).withMessage('El nombre no puede superar los 100 caracteres'),
    body('description').optional().isString(),
    body('slug').optional().isSlug().withMessage('El slug no es válido'),
    body('parentId').optional().isUUID().withMessage('El ID de la categoría padre no es válido'),
    body('isActive').optional().isBoolean().withMessage('isActive debe ser true o false'),
    body('sortOrder').optional().isInt().withMessage('sortOrder debe ser un número entero'),
    validateRequest,
  ],
  categoryController.createCategory
);

/**
 * @swagger
 * /api/categories/{id}:
 *   put:
 *     summary: Actualizar una categoría
 *     tags: [Categorías]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Categoría actualizada
 *       404:
 *         description: Categoría no encontrada
 */
router.put(
  '/:id',
  authenticate,
  authorize(['admin']),
  [
    param('id').isUUID().withMessage('ID de categoría inválido'),
    body('name').optional().isLength({ max: 100 }).withMessage('El nombre no puede superar los 100 caracteres'),
    body('description').optional().isString(),
    body('slug').optional().isSlug().withMessage('El slug no es válido'),
    body('parentId').optional().isUUID().withMessage('El ID de la categoría padre no es válido'),
    body('isActive').optional().isBoolean().withMessage('isActive debe ser true o false'),
    body('sortOrder').optional().isInt().withMessage('sortOrder debe ser un número entero'),
    validateRequest,
  ],
  categoryController.updateCategory
);

/**
 * @swagger
 * /api/categories/{id}:
 *   delete:
 *     summary: Eliminar una categoría
 *     tags: [Categorías]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Categoría eliminada
 *       409:
 *         description: La categoría tiene productos o subcategorías asociadas
 */
router.delete(
  '/:id',
  authenticate,
  authorize(['admin']),
  [
    param('id').isUUID().withMessage('ID de categoría inválido'),
    validateRequest,
  ],
  categoryController.deleteCategory
);

module.exports = router;
