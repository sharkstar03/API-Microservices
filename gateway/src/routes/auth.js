const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { body } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');
const logger = require('../utils/logger');

const router = express.Router();

// URL del servicio de autenticación
const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';

/**
 * @swagger
 * tags:
 *   name: Autenticación
 *   description: API para gestión de autenticación
 */

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Iniciar sesión de usuario
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Usuario autenticado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   type: object
 *       401:
 *         description: Credenciales inválidas
 *       500:
 *         description: Error del servidor
 */
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Debe proporcionar un email válido'),
    body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
    validateRequest,
  ],
  createProxyMiddleware({
    target: authServiceUrl,
    pathRewrite: {
      '^/api/v1/auth/login': '/api/auth/login',
    },
    changeOrigin: true,
    onProxyReq: (proxyReq, req, res) => {
      // Modificar la solicitud si es necesario
      logger.debug(`Proxy solicitud de login para: ${req.body.email}`);
    },
    onProxyRes: (proxyRes, req, res) => {
      // Capturar y transformar la respuesta si es necesario
      logger.debug(`Respuesta del proxy auth: ${proxyRes.statusCode}`);
    },
    onError: (err, req, res) => {
      logger.error('Error al proxy login:', err);
      res.status(500).json({ message: 'Error al conectar con el servicio de autenticación' });
    },
  })
);

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Registrar nuevo usuario
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       201:
 *         description: Usuario creado correctamente
 *       400:
 *         description: Datos de entrada inválidos
 *       409:
 *         description: El usuario ya existe
 *       500:
 *         description: Error del servidor
 */
router.post(
  '/register',
  [
    body('name').notEmpty().withMessage('El nombre es requerido'),
    body('email').isEmail().withMessage('Debe proporcionar un email válido'),
    body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
    validateRequest,
  ],
  createProxyMiddleware({
    target: authServiceUrl,
    pathRewrite: {
      '^/api/v1/auth/register': '/api/auth/register',
    },
    changeOrigin: true,
  })
);

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Cerrar sesión de usuario
 *     tags: [Autenticación]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sesión cerrada correctamente
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.post(
  '/logout',
  createProxyMiddleware({
    target: authServiceUrl,
    pathRewrite: {
      '^/api/v1/auth/logout': '/api/auth/logout',
    },
    changeOrigin: true,
  })
);

/**
 * @swagger
 * /api/v1/auth/refresh-token:
 *   post:
 *     summary: Renovar token de acceso
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token renovado correctamente
 *       401:
 *         description: Token inválido o expirado
 *       500:
 *         description: Error del servidor
 */
router.post(
  '/refresh-token',
  [
    body('refreshToken').notEmpty().withMessage('El refreshToken es requerido'),
    validateRequest,
  ],
  createProxyMiddleware({
    target: authServiceUrl,
    pathRewrite: {
      '^/api/v1/auth/refresh-token': '/api/auth/refresh-token',
    },
    changeOrigin: true,
  })
);

module.exports = router;