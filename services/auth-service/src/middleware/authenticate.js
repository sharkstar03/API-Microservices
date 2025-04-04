const jwt = require('jsonwebtoken');
const Redis = require('ioredis');
const User = require('../models/User');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

// Cliente Redis para lista negra de tokens
const redis = new Redis(process.env.REDIS_URL);

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
    }

    if (!token) {
      return next(new AppError('No has iniciado sesión. Por favor inicia sesión para acceder.', 401));
    }

    // 2) Verificar si el token está en la lista negra (logout)
    const isBlacklisted = await redis.exists(`bl_${token}`);
    if (isBlacklisted) {
      return next(new AppError('Token inválido o expirado. Por favor inicia sesión nuevamente.', 401));
    }

    // 3) Verificar y decodificar el token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 4) Verificar si el usuario aún existe
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new AppError('El usuario al que pertenece este token ya no existe.', 401));
    }

    // 5) Verificar si el usuario está activo
    if (!user.isActive) {
      return next(new AppError('Tu cuenta ha sido desactivada. Contacta al soporte.', 401));
    }

    // 6) Verificar si la cuenta está bloqueada
    if (user.accountLocked && user.accountLockedUntil > new Date()) {
      return next(new AppError('Tu cuenta está bloqueada temporalmente. Intenta más tarde.', 401));
    }

    // Acceso concedido, guardar usuario en la solicitud
    req.user = {
      id: user._id,
      email: user.email,
      role: user.role,
    };
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