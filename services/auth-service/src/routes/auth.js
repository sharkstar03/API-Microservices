const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const validateRequest = require('../middleware/validateRequest');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

/**
 * Registro de nuevo usuario
 */
router.post(
  '/register',
  [
    body('name')
      .notEmpty().withMessage('El nombre es requerido')
      .isLength({ min: 2, max: 50 }).withMessage('El nombre debe tener entre 2 y 50 caracteres'),
    body('email')
      .isEmail().withMessage('El email no es válido')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
    validateRequest,
  ],
  authController.register
);

/**
 * Inicio de sesión
 */
router.post(
  '/login',
  [
    body('email')
      .isEmail().withMessage('El email no es válido')
      .normalizeEmail(),
    body('password')
      .notEmpty().withMessage('La contraseña es requerida'),
    validateRequest,
  ],
  authController.login
);

/**
 * Cerrar sesión
 */
router.post('/logout', authenticate, authController.logout);

/**
 * Renovar token de acceso usando refresh token
 */
router.post(
  '/refresh-token',
  [
    body('refreshToken')
      .notEmpty().withMessage('El refresh token es requerido'),
    validateRequest,
  ],
  authController.refreshToken
);

/**
 * Solicitar restablecimiento de contraseña
 */
router.post(
  '/forgot-password',
  [
    body('email')
      .isEmail().withMessage('El email no es válido')
      .normalizeEmail(),
    validateRequest,
  ],
  authController.forgotPassword
);

/**
 * Restablecer contraseña
 */
router.post(
  '/reset-password',
  [
    body('token')
      .notEmpty().withMessage('El token es requerido'),
    body('password')
      .isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
    validateRequest,
  ],
  authController.resetPassword
);

/**
 * Verificar correo electrónico
 */
router.get('/verify-email/:token', authController.verifyEmail);

/**
 * Validar token JWT
 */
router.get('/validate', authenticate, authController.validate);

/**
 * Cambiar contraseña (usuario autenticado)
 */
router.post(
  '/change-password',
  authenticate,
  [
    body('currentPassword')
      .notEmpty().withMessage('La contraseña actual es requerida'),
    body('newPassword')
      .isLength({ min: 6 }).withMessage('La nueva contraseña debe tener al menos 6 caracteres')
      .custom((value, { req }) => {
        if (value === req.body.currentPassword) {
          throw new Error('La nueva contraseña debe ser diferente a la actual');
        }
        return true;
      }),
    validateRequest,
  ],
  authController.changePassword
);

module.exports = router;