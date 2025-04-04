const express = require('express');
const { param, body, query } = require('express-validator');
const productController = require('../controllers/productController');
const validateRequest = require('../middleware/validateRequest');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Products
 *   description: API para gestión de productos
 */

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Obtener todos los productos
 *     description: Retorna una lista paginada de productos con filtros
 *     tags: [Products]
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
 *         description: Texto para buscar en nombre, descripción o SKU
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: ID de la categoría para filtrar
 *       - in: query
 *         name: brand
 *         schema:
 *           type: string
 *         description: Nombre de marca para filtrar
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Precio mínimo
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Precio máximo
 *       - in: query
 *         name: sortField
 *         schema:
 *           type: string
 *           default: createdAt
 *         description: Campo para ordenar resultados
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Orden ascendente o descendente
 *       - in: query
 *         name: onlyActive
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Filtrar solo productos activos
 *     responses:
 *       200:
 *         description: Lista de productos
 *       500:
 *         description: Error del servidor
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('La página debe ser un número entero positivo'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('El límite debe ser un número entre 1 y 100'),
    query('minPrice').optional().isFloat({ min: 0 }).withMessage('El precio mínimo debe ser mayor o igual a cero'),
    query('maxPrice').optional().isFloat({ min: 0 }).withMessage('El precio máximo debe ser mayor o igual a cero'),
    query('sortField').optional().isString().withMessage('Campo de ordenamiento no válido'),
    query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Orden debe ser "asc" o "desc"'),
    query('onlyActive').optional().isBoolean().withMessage('onlyActive debe ser un valor booleano'),
    validateRequest,
  ],
  productController.getAllProducts
);

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Obtener un producto por ID o slug
 *     description: Retorna un producto específico por su ID o slug
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID o slug del producto
 *     responses:
 *       200:
 *         description: Datos del producto
 *       404:
 *         description: Producto no encontrado
 *       500:
 *         description: Error del servidor
 */
router.get(
  '/:id',
  [
    param('id').isString().withMessage('ID o slug de producto inválido'),
    validateRequest,
  ],
  productController.getProductById
);

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Crear un nuevo producto
 *     description: Crea un nuevo producto en el sistema
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sku
 *               - name
 *               - price
 *             properties:
 *               sku:
 *                 type: string
 *                 description: Código SKU único del producto
 *               name:
 *                 type: string
 *                 description: Nombre del producto
 *               description:
 *                 type: string
 *                 description: Descripción detallada
 *               shortDescription:
 *                 type: string
 *                 description: Descripción corta
 *               price:
 *                 type: number
 *                 description: Precio regular
 *               salePrice:
 *                 type: number
 *                 description: Precio de oferta
 *               onSale:
 *                 type: boolean
 *                 description: Si está en oferta
 *               categoryId:
 *                 type: string
 *                 description: ID de la categoría
 *               brand:
 *                 type: string
 *                 description: Marca del producto
 *               weight:
 *                 type: number
 *                 description: Peso del producto
 *               dimensions:
 *                 type: object
 *                 description: Dimensiones (largo, ancho, alto)
 *               attributes:
 *                 type: object
 *                 description: Atributos adicionales
 *               tags:
 *                 type: array
 *                 description: Etiquetas
 *               featuredImage:
 *                 type: string
 *                 description: URL de la imagen destacada
 *               isActive:
 *                 type: boolean
 *                 description: Si está activo
 *               isFeatured:
 *                 type: boolean
 *                 description: Si es destacado
 *               isDigital:
 *                 type: boolean
 *                 description: Si es producto digital
 *               downloadUrl:
 *                 type: string
 *                 description: URL de descarga (para productos digitales)
 *               metaTitle:
 *                 type: string
 *                 description: Título para SEO
 *               metaDescription:
 *                 type: string
 *                 description: Descripción para SEO
 *               inventory:
 *                 type: object
 *                 description: Datos de inventario
 *               images:
 *                 type: array
 *                 description: Imágenes adicionales
 *     responses:
 *       201:
 *         description: Producto creado correctamente
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       409:
 *         description: El producto ya existe
 *       500:
 *         description: Error del servidor
 */
router.post(
  '/',
  [
    authenticate,
    authorize(['admin']),
    body('sku').isString().notEmpty().withMessage('SKU es requerido'),
    body('name').isString().notEmpty().withMessage('Nombre es requerido'),
    body('price').isFloat({ min: 0 }).withMessage('Precio debe ser un número mayor o igual a cero'),
    body('salePrice').optional().isFloat({ min: 0 }).withMessage('Precio de oferta debe ser un número mayor o igual a cero'),
    body('categoryId').optional().isUUID().withMessage('ID de categoría no válido'),
    validateRequest,
  ],
  productController.createProduct
);

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Actualizar un producto
 *     description: Actualiza la información de un producto existente
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del producto
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nombre del producto
 *               description:
 *                 type: string
 *                 description: Descripción detallada
 *               price:
 *                 type: number
 *                 description: Precio regular
 *               salePrice:
 *                 type: number
 *                 description: Precio de oferta
 *               onSale:
 *                 type: boolean
 *                 description: Si está en oferta
 *               categoryId:
 *                 type: string
 *                 description: ID de la categoría
 *               isActive:
 *                 type: boolean
 *                 description: Si está activo
 *               inventory:
 *                 type: object
 *                 description: Datos de inventario
 *               images:
 *                 type: array
 *                 description: Imágenes
 *               replaceImages:
 *                 type: boolean
 *                 description: Si se deben reemplazar todas las imágenes
 *     responses:
 *       200:
 *         description: Producto actualizado correctamente
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Producto no encontrado
 *       500:
 *         description: Error del servidor
 */
router.put(
  '/:id',
  [
    authenticate,
    authorize(['admin']),
    param('id').isUUID().withMessage('ID de producto inválido'),
    body('price').optional().isFloat({ min: 0 }).withMessage('Precio debe ser un número mayor o igual a cero'),
    body('salePrice').optional().isFloat({ min: 0 }).withMessage('Precio de oferta debe ser un número mayor o igual a cero'),
    body('categoryId').optional().isUUID().withMessage('ID de categoría no válido'),
    validateRequest,
  ],
  productController.updateProduct
);

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Eliminar un producto
 *     description: Elimina un producto del sistema (soft delete)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del producto
 *     responses:
 *       200:
 *         description: Producto eliminado correctamente
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Producto no encontrado
 *       500:
 *         description: Error del servidor
 */
router.delete(
  '/:id',
  [
    authenticate,
    authorize(['admin']),
    param('id').isUUID().withMessage('ID de producto inválido'),
    validateRequest,
  ],
  productController.deleteProduct
);

module.exports = router;