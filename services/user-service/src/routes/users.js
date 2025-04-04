const express = require('express');
const { param, body, query } = require('express-validator');
const userController = require('../controllers/userController');
const validateRequest = require('../middleware/validateRequest');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: API para gestión de usuarios
 */

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Obtener todos los usuarios
 *     description: Retorna una lista paginada de usuarios
 *     tags: [Users]
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
 *         description: Texto para buscar en nombre o email
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [user, admin, premium]
 *         description: Filtrar por rol
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filtrar por estado activo/inactivo
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
 *     responses:
 *       200:
 *         description: Lista de usuarios
 *       401:
 *         description: No autorizado
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
    query('role').optional().isIn(['user', 'admin', 'premium']).withMessage('Rol no válido'),
    query('isActive').optional().isBoolean().withMessage('isActive debe ser un valor booleano'),
    query('sortField').optional().isString().withMessage('Campo de ordenamiento no válido'),
    query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Orden debe ser "asc" o "desc"'),
    validateRequest,
  ],
  userController.getAllUsers
);

/**
 * @swagger
 * /api/users/search:
 *   get:
 *     summary: Buscar usuarios
 *     description: Búsqueda de usuarios por diferentes criterios
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: Texto para buscar en nombre o email
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [user, admin, premium]
 *         description: Filtrar por rol
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         description: Filtrar por estado
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Número máximo de resultados
 *     responses:
 *       200:
 *         description: Resultados de la búsqueda
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.get(
  '/search',
  [
    authenticate,
    authorize('admin'),
    query('query').optional().isString(),
    query('role').optional().isIn(['user', 'admin', 'premium']).withMessage('Rol no válido'),
    query('status').optional().isIn(['active', 'inactive']).withMessage('Estado debe ser "active" o "inactive"'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('El límite debe ser un número entre 1 y 50'),
    validateRequest,
  ],
  userController.searchUsers
);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Obtener un usuario por ID
 *     description: Retorna un usuario específico por su ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Datos del usuario
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Usuario no encontrado
 *       500:
 *         description: Error del servidor
 */
router.get(
  '/:id',
  [
    authenticate,
    authorize(['admin', 'self']),
    param('id').isString().withMessage('ID de usuario inválido'),
    validateRequest,
  ],
  userController.getUserById
);

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Crear un nuevo usuario
 *     description: Crea un nuevo usuario en el sistema
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - email
 *               - name
 *             properties:
 *               userId:
 *                 type: string
 *                 description: ID externo del usuario
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email del usuario
 *               name:
 *                 type: string
 *                 description: Nombre completo del usuario
 *               role:
 *                 type: string
 *                 enum: [user, admin, premium]
 *                 description: Rol del usuario
 *     responses:
 *       201:
 *         description: Usuario creado correctamente
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       409:
 *         description: El usuario ya existe
 *       500:
 *         description: Error del servidor
 */
router.post(
  '/',
  [
    authenticate,
    authorize('admin'),
    body('userId').isString().withMessage('Se requiere un ID de usuario válido'),
    body('email').isEmail().withMessage('Se requiere un email válido'),
    body('name').isString().withMessage('Se requiere un nombre válido'),
    body('role').optional().isIn(['user', 'admin', 'premium']).withMessage('Rol no válido'),
    validateRequest,
  ],
  userController.createUser
);

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Actualizar un usuario
 *     description: Actualiza la información de un usuario existente
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
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
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nombre completo del usuario
 *               role:
 *                 type: string
 *                 enum: [user, admin, premium]
 *                 description: Rol del usuario
 *               isActive:
 *                 type: boolean
 *                 description: Estado del usuario
 *               preferences:
 *                 type: object
 *                 description: Preferencias del usuario
 *     responses:
 *       200:
 *         description: Usuario actualizado correctamente
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Usuario no encontrado
 *       500:
 *         description: Error del servidor
 */
router.put(
  '/:id',
  [
    authenticate,
    authorize(['admin', 'self']),
    param('id').isString().withMessage('ID de usuario inválido'),
    body('name').optional().isString().withMessage('Nombre inválido'),
    body('role').optional().isIn(['user', 'admin', 'premium']).withMessage('Rol no válido')
      .custom((value, { req }) => {
        // Solo admin puede cambiar roles
        if (req.user.role !== 'admin') {
          throw new Error('No tienes permisos para cambiar el rol');
        }
        return true;
      }),
    body('isActive').optional().isBoolean().withMessage('Estado inválido')
      .custom((value, { req }) => {
        // Solo admin puede desactivar cuentas
        if (req.user.role !== 'admin') {
          throw new Error('No tienes permisos para cambiar el estado');
        }
        return true;
      }),
    validateRequest,
  ],
  userController.updateUser
);

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Eliminar un usuario
 *     description: Elimina un usuario del sistema (soft delete)
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Usuario eliminado correctamente
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Usuario no encontrado
 *       500:
 *         description: Error del servidor
 */
router.delete(
  '/:id',
  [
    authenticate,
    authorize('admin'),
    param('id').isString().withMessage('ID de usuario inválido'),
    validateRequest,
  ],
  userController.deleteUser
);

module.exports = router;