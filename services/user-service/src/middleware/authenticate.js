const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

/**
 * Middleware de autenticación
 * Verifica el token JWT y establece req.user
 */
const authenticate = async (req, res, next) => {
  try {
    // 1) Verificar si el token existe
    let token;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.headers['x-api-key']) {
      // Para uso interno entre servicios
      const apiKey = req.headers['x-api-key'];
      if (apiKey === process.env.INTERNAL_API_KEY) {
        req.user = {
          id: 'system',
          role: 'system',
          isSystem: true
        };
        return next();
      }
    }

    if (!token) {
      return next(new AppError('No has iniciado sesión. Por favor inicia sesión para acceder.', 401));
    }

    // 2) Verificar y decodificar el token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3) Extraer información del usuario del token decodificado
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role
    };

    // 4) Puede añadirse una verificación opcional con el servicio de auth
    // para verificar si el token sigue siendo válido (no en lista negra)

    next();
  } catch (error) {
    logger.error('Error en autenticación:', error);

    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Token inválido. Por favor inicia sesión nuevamente.', 401));
    }

    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Tu sesión ha expirado. Por favor inicia sesión nuevamente.', 401));
    }

    return next(new AppError('Error al autenticar. Por favor inicia sesión nuevamente.', 401));
  }
};

module.exports = authenticate;