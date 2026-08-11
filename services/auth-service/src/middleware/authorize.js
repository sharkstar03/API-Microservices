const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

/**
 * Verifica si el usuario tiene los roles requeridos.
 * El rol 'self' permite que un usuario consulte su propia cuenta.
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
                     req.params.id &&
                     req.params.id === req.user.id;

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
