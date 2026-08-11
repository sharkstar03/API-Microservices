const express = require('express');
const { body, param, query } = require('express-validator');
const userController = require('../controllers/userController');
const validateRequest = require('../middleware/validateRequest');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

// Todas las rutas de gestión de cuentas requieren autenticación
router.use(authenticate);

/**
 * Listar cuentas (solo admin)
 */
router.get(
  '/',
  [
    authorize('admin'),
    query('page').optional().isInt({ min: 1 }).withMessage('La página debe ser un número entero positivo'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('El límite debe ser un número entre 1 y 100'),
    query('role').optional().isIn(['user', 'admin', 'premium']).withMessage('Rol no válido'),
    query('isActive').optional().isBoolean().withMessage('isActive debe ser true o false'),
    validateRequest,
  ],
  userController.getAllUsers
);

/**
 * Obtener una cuenta por ID (admin o el propio usuario)
 */
router.get(
  '/:id',
  [
    param('id').isMongoId().withMessage('ID de usuario inválido'),
    validateRequest,
    authorize(['admin', 'self']),
  ],
  userController.getUserById
);

/**
 * Actualizar el rol de una cuenta (solo admin)
 */
router.patch(
  '/:id/role',
  [
    authorize('admin'),
    param('id').isMongoId().withMessage('ID de usuario inválido'),
    body('role')
      .isIn(['user', 'admin', 'premium']).withMessage('El rol debe ser user, admin o premium'),
    validateRequest,
  ],
  userController.updateUserRole
);

/**
 * Activar o desactivar una cuenta (solo admin)
 */
router.patch(
  '/:id/status',
  [
    authorize('admin'),
    param('id').isMongoId().withMessage('ID de usuario inválido'),
    body('isActive')
      .isBoolean().withMessage('isActive debe ser true o false'),
    validateRequest,
  ],
  userController.updateUserStatus
);

/**
 * Eliminar una cuenta (solo admin)
 */
router.delete(
  '/:id',
  [
    authorize('admin'),
    param('id').isMongoId().withMessage('ID de usuario inválido'),
    validateRequest,
  ],
  userController.deleteUser
);

module.exports = router;
