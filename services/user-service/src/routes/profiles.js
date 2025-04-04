const express = require('express');
const { param, body } = require('express-validator');
const profileController = require('../controllers/profileController');
const validateRequest = require('../middleware/validateRequest');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Profiles
 *   description: API para gestión de perfiles de usuario
 */

/**
 * @swagger
 * /api/profiles/{userId}:
 *   get:
 *     summary: Obtener perfil de un usuario
 *     description: Retorna el perfil detallado de un usuario
 *     tags: [Profiles]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Perfil del usuario
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
  profileController.getProfile
);

/**
 * @swagger
 * /api/profiles/{userId}:
 *   put:
 *     summary: Actualizar perfil de un usuario
 *     description: Actualiza la información de perfil de un usuario
 *     tags: [Profiles]
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
 *             properties:
 *               firstName:
 *                 type: string
 *                 description: Nombre del usuario
 *               lastName:
 *                 type: string
 *                 description: Apellido del usuario
 *               phoneNumber:
 *                 type: string
 *                 description: Número de teléfono
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *                 description: Fecha de nacimiento
 *               gender:
 *                 type: string
 *                 enum: [male, female, other, prefer_not_to_say]
 *                 description: Género
 *               bio:
 *                 type: string
 *                 description: Biografía o descripción
 *               profession:
 *                 type: string
 *                 description: Profesión
 *               company:
 *                 type: string
 *                 description: Empresa
 *               website:
 *                 type: string
 *                 description: Sitio web personal
 *               isPublic:
 *                 type: boolean
 *                 description: Si el perfil es público
 *               socialProfiles:
 *                 type: object
 *                 description: Perfiles de redes sociales
 *     responses:
 *       200:
 *         description: Perfil actualizado correctamente
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
  '/:userId',
  [
    authenticate,
    authorize(['admin', 'self']),
    param('userId').isString().withMessage('ID de usuario inválido'),
    body('firstName').optional().isString().withMessage('Nombre inválido'),
    body('lastName').optional().isString().withMessage('Apellido inválido'),
    body('phoneNumber').optional().isString().withMessage('Número de teléfono inválido'),
    body('dateOfBirth').optional().isISO8601().withMessage('Fecha de nacimiento inválida'),
    body('gender').optional().isIn(['male', 'female', 'other', 'prefer_not_to_say']).withMessage('Género inválido'),
    body('bio').optional().isString().isLength({ max: 500 }).withMessage('Biografía inválida (máximo 500 caracteres)'),
    body('profession').optional().isString().withMessage('Profesión inválida'),
    body('company').optional().isString().withMessage('Empresa inválida'),
    body('website').optional().isURL().withMessage('Sitio web inválido'),
    body('isPublic').optional().isBoolean().withMessage('El valor de isPublic debe ser booleano'),
    validateRequest,
  ],
  profileController.updateProfile
);

/**
 * @swagger
 * /api/profiles/{userId}/interests:
 *   put:
 *     summary: Actualizar intereses del usuario
 *     description: Actualiza la lista de intereses del usuario
 *     tags: [Profiles]
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
 *               - interests
 *             properties:
 *               interests:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Lista de intereses
 *     responses:
 *       200:
 *         description: Intereses actualizados correctamente
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
  '/:userId/interests',
  [
    authenticate,
    authorize(['admin', 'self']),
    param('userId').isString().withMessage('ID de usuario inválido'),
    body('interests').isArray().withMessage('Debe proporcionar un array de intereses'),
    validateRequest,
  ],
  profileController.updateInterests
);

/**
 * @swagger
 * /api/profiles/{userId}/skills:
 *   put:
 *     summary: Actualizar habilidades del usuario
 *     description: Actualiza la lista de habilidades del usuario
 *     tags: [Profiles]
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
 *               - skills
 *             properties:
 *               skills:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Lista de habilidades
 *     responses:
 *       200:
 *         description: Habilidades actualizadas correctamente
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
  '/:userId/skills',
  [
    authenticate,
    authorize(['admin', 'self']),
    param('userId').isString().withMessage('ID de usuario inválido'),
    body('skills').isArray().withMessage('Debe proporcionar un array de habilidades'),
    validateRequest,
  ],
  profileController.updateSkills
);

/**
 * @swagger
 * /api/profiles/{userId}/avatar:
 *   put:
 *     summary: Actualizar avatar del usuario
 *     description: Actualiza la URL del avatar del usuario
 *     tags: [Profiles]
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
 *               - avatarUrl
 *             properties:
 *               avatarUrl:
 *                 type: string
 *                 description: URL del avatar
 *     responses:
 *       200:
 *         description: Avatar actualizado correctamente
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
  '/:userId/avatar',
  [
    authenticate,
    authorize(['admin', 'self']),
    param('userId').isString().withMessage('ID de usuario inválido'),
    body('avatarUrl').isURL().withMessage('Debe proporcionar una URL válida'),
    validateRequest,
  ],
  profileController.updateAvatar
);

module.exports = router;