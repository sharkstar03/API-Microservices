const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

/**
 * Verifica si el usuario tiene los roles requeridos.
 *
 * Aquí no hay colección de usuarios propia (este servicio es catálogo en MySQL),
 * así que la comprobación se hace solo con el rol que viaja en el JWT.
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

      if (!allowedRoles.includes(req.user.role)) {
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
