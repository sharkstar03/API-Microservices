const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { param, body, query } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');
const logger = require('../utils/logger');

const router = express.Router();

// URL del servicio de productos
const productServiceUrl = process.env.PRODUCT_SERVICE_URL || 'http://product-service:3003';

/**
 * Configuración común del proxy hacia el product-service.
 * El gateway expone /api/v1/products y el servicio escucha en /api/products.
 */
const productProxy = (pathRewrite) =>
  createProxyMiddleware({
    target: productServiceUrl,
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
      logger.error('Error al proxy productos:', err);
      res.status(502).json({ message: 'Error al conectar con el servicio de productos' });
    },
  });

const toProducts = { '^/api/v1/products': '/api/products' };
const toCategories = { '^/api/v1/products/categories': '/api/categories' };
const toInventory = { '^/api/v1/products/inventory': '/api/inventory' };

/**
 * @swagger
 * tags:
 *   name: Productos
 *   description: API para gestión del catálogo de productos
 */

/**
 * @swagger
 * /api/v1/products/categories:
 *   get:
 *     summary: Listar categorías
 *     tags: [Productos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tree
 *         schema:
 *           type: boolean
 *         description: Devolver las categorías en estructura jerárquica
 *     responses:
 *       200:
 *         description: Lista de categorías
 *       401:
 *         description: No autorizado
 */
// Las rutas de categorías e inventario van antes que /:id para que no las capture
router.use('/categories', productProxy(toCategories));

/**
 * @swagger
 * /api/v1/products/inventory/{productId}:
 *   get:
 *     summary: Consultar el inventario de un producto
 *     tags: [Productos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Inventario del producto
 *       404:
 *         description: Inventario no encontrado
 */
router.use('/inventory', productProxy(toInventory));

/**
 * @swagger
 * /api/v1/products:
 *   get:
 *     summary: Listar productos
 *     tags: [Productos]
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
 *         name: search
 *         schema:
 *           type: string
 *         description: Búsqueda por nombre, descripción o SKU
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filtrar por ID de categoría
 *     responses:
 *       200:
 *         description: Lista de productos
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('La página debe ser un número entero positivo'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('El límite debe ser un número entre 1 y 100'),
    query('minPrice').optional().isFloat({ min: 0 }).withMessage('El precio mínimo no puede ser negativo'),
    query('maxPrice').optional().isFloat({ min: 0 }).withMessage('El precio máximo no puede ser negativo'),
    validateRequest,
  ],
  productProxy(toProducts)
);

/**
 * @swagger
 * /api/v1/products/{id}:
 *   get:
 *     summary: Obtener un producto por ID o slug
 *     tags: [Productos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: UUID o slug del producto
 *     responses:
 *       200:
 *         description: Datos del producto
 *       404:
 *         description: Producto no encontrado
 */
router.get(
  '/:id',
  [
    param('id').notEmpty().withMessage('El identificador del producto es requerido'),
    validateRequest,
  ],
  productProxy(toProducts)
);

/**
 * @swagger
 * /api/v1/products:
 *   post:
 *     summary: Crear un producto
 *     tags: [Productos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Producto creado
 *       400:
 *         description: Datos inválidos
 *       403:
 *         description: Sin permisos
 */
router.post(
  '/',
  [
    body('name').notEmpty().withMessage('El nombre del producto es requerido'),
    body('price').isFloat({ min: 0 }).withMessage('El precio debe ser un número positivo'),
    body('categoryId').optional().isUUID().withMessage('El ID de categoría no es válido'),
    validateRequest,
  ],
  productProxy(toProducts)
);

/**
 * @swagger
 * /api/v1/products/{id}:
 *   put:
 *     summary: Actualizar un producto
 *     tags: [Productos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Producto actualizado
 *       404:
 *         description: Producto no encontrado
 */
router.put(
  '/:id',
  [
    param('id').isUUID().withMessage('ID de producto inválido'),
    body('price').optional().isFloat({ min: 0 }).withMessage('El precio debe ser un número positivo'),
    body('categoryId').optional().isUUID().withMessage('El ID de categoría no es válido'),
    validateRequest,
  ],
  productProxy(toProducts)
);

/**
 * @swagger
 * /api/v1/products/{id}:
 *   delete:
 *     summary: Eliminar un producto
 *     tags: [Productos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Producto eliminado
 *       404:
 *         description: Producto no encontrado
 */
router.delete(
  '/:id',
  [
    param('id').isUUID().withMessage('ID de producto inválido'),
    validateRequest,
  ],
  productProxy(toProducts)
);

module.exports = router;
