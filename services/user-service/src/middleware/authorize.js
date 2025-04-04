const AppError = require('../utils/AppError');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Middleware de autorización
 * Verifica si el usuario tiene los roles requeridos
 * @param {string|Array} roles - Rol o array de roles permitidos
 */
const authorize = (roles) => {
  return async (req, res, next) => {
    try {
      // Si es una petición interna de sistema, permitir todo
      if (req.user && req.user.isSystem) {
        return next();
      }

      const allowedRoles = Array.isArray(roles) ? roles : [roles];

      // Si no hay usuario autenticado, denegar acceso
      if (!req.user || !req.user.id) {
        return next(new AppError('No tienes permisos para realizar esta acción', 403));
      }

      // Verificar si el usuario tiene uno de los roles permitidos
      const hasRole = allowedRoles.includes(req.user.role);

      // Caso especial para 'self' - acceso a recursos propios
      const isSelf = allowedRoles.includes('self') && 
                     req.params.userId && 
                     (req.params.userId === req.user.id || 
                      req.params.id === req.user.id);

      if (!hasRole && !isSelf) {
        // Si no tiene el rol necesario, verificamos en la base de datos
        if (req.user.role !== 'admin') {
          // Solo verificamos en DB si no es admin (para evitar consultas innecesarias)
          const userId = req.params.userId || req.params.id;
          
          if (userId) {
            const user = await User.findOne({ 
              $or: [
                { _id: userId },
                { userId: userId }
              ]
            });

            // Si el usuario existe y el ID en MongoDB coincide con el del token, permitir
            if (user && user._id.toString() === req.user.id) {
              return next();
            }
          }
        }

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