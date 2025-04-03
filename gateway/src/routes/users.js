const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { param, body } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');
const logger = require('../utils/logger');

const router = express.Router();

// URL del servicio de usuarios
const userServiceUrl = process.env.USER_SERVICE_URL || 'http://user-service:3002';

/**
 * @swagger
 * tags:
 *   name: Usuarios
 *   description: API para gestión de usuarios
 */

/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     summary: Obtener lista de usuarios
 *     tags: [Usuarios]
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
 *     responses:
 *       200:
 *         description: Lista de usuarios
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido - No tiene permisos
 *       500:
 *         description: Error del servidor
 */
router.get(
  '/',
  createProxyMiddleware({
    target: userServiceUrl,
    pathRewrite: {
      '^/api/v1/users': '/api/users',
    },
    changeOrigin: true,
    onProxyReq: (proxyReq, req, res) => {
      // Agregar header con información del usuario autenticado
      if (req.user) {
        proxyReq.setHeader('X-User-Id', req.user.id);
        proxyReq.setHeader('X-User-Role', req.user.role);
      }
    },
    onError: (err, req, res) => {
      logger.error('Error al proxy usuarios:', err);
      res.status(500).json({ message: 'Error al conectar con el servicio de usuarios' });
    },
  })
);

/**
 * @swagger
 * /api/v1/users/{id}:
 *   get:
 *     summary: Obtener un usuario por ID
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
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
 *       403:
 *         description: Prohibido - No tiene permisos
 *       404:
 *         description: Usuario no encontrado
 *       500:
 *         description: Error del servidor
 */
router.get(
  '/:id',
  [
    param('id').isMongoId().withMessage('ID de usuario inválido'),
    validateRequest,
  ],
  createProxyMiddleware({
    target: userServiceUrl,
    pathRewrite: {
      '^/api/v1/users': '/api/users',
    },
    changeOrigin: true,
  })
);

/**
 * @swagger
 * /api/v1/users/{id}:
 *   put:
 *     summary: Actualizar un usuario
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
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
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Usuario actualizado
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido - No tiene permisos
 *       404:
 *         description: Usuario no encontrado
 *       500:
 *         description: Error del servidor
 */
router.put(
  '/:id',
  [
    param('id').isMongoId().withMessage('ID de usuario inválido'),
    body('name').optional().notEmpty().withMessage('El nombre no puede estar vacío'),
    body('email').optional().isEmail().withMessage('Email inválido'),
    validateRequest,
  ],
  createProxyMiddleware({
    target: userServiceUrl,
    pathRewrite: {
      '^/api/v1/users': '/api/users',
    },
    changeOrigin: true,
  })
);

/**
 * @swagger
 * /api/v1/users/{id}:
 *   delete:
 *     summary: Eliminar un usuario
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Usuario eliminado
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido - No tiene permisos
 *       404:
 *         description: Usuario no encontrado
 *       500:
 *         description: Error del servidor
 */
router.delete(
  '/:id',
  [
    param('id').isMongoId().withMessage('ID de usuario inválido'),
    validateRequest,
  ],
  createProxyMiddleware({
    target: userServiceUrl,
    pathRewrite: {
      '^/api/v1/users': '/api/users',
    },
    changeOrigin: true,
  })
);

module.exports = router;