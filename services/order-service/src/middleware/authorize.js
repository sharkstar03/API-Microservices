const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

/**
 * Verifica si el usuario tiene los roles requeridos.
 *
 * El rol 'self' cubre las rutas /user/:userId. La propiedad de una orden
 * concreta la comprueban los controladores comparando req.user.id con
 * order.userId, así que aquí no hace falta tocar la base de datos.
 *
 * @param {string|Array} roles - Rol o array de roles permitidos
 */
const authorize = (roles) => {
  return (req, res, next) => {
    try {
      // Peticiones internas entre servicios
      if (req.user && req.user.isSystem) {
        return next();
      }

      const allowedRoles = Array.isArray(roles) ? roles : [roles];

      if (!req.user || !req.user.id) {
        return next(new AppError('No tienes permisos para realizar esta acción', 403));
      }

      const hasRole = allowedRoles.includes(req.user.role);
      const isSelf = allowedRoles.includes('self') &&
                     req.params.userId &&
                     req.params.userId === req.user.id;

      if (!hasRole && !isSelf) {
        return next(new AppError('No tienes permisos para realizar esta acción', 403));
      }

      next();
    } catch (error) {
      logger.error('Error en autorización:', error);
      next(new AppError('Error al verificar permisos', 500));
    }
  };
};

module.exports = authorize;
