const { validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { AuthenticationError, ValidationError } = require('../errors');
const logger = require('../utils/logger');

/**
 * Middleware para validar solicitudes con express-validator
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ValidationError('Datos de entrada inválidos', {
      errors: errors.array().map(error => ({
        field: error.param,
        message: error.msg
      }))
    }));
  }
  next();
};

/**
 * Middleware de autenticación genérico
 */
const authenticate = (req, res, next) => {
  try {
    // Verificar si el token existe
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
      return next(new AuthenticationError('No has iniciado sesión. Por favor inicia sesión para acceder.'));
    }

    // Verificar y decodificar el token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Extraer información del usuario del token decodificado
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (error) {
    logger.error('Error en autenticación:', error);

    if (error.name === 'JsonWebTokenError') {
      return next(new AuthenticationError('Token inválido. Por favor inicia sesión nuevamente.'));
    }

    if (error.name === 'TokenExpiredError') {
      return next(new AuthenticationError('Tu sesión ha expirado. Por favor inicia sesión nuevamente.'));
    }

    return next(new AuthenticationError('Error al autenticar. Por favor inicia sesión nuevamente.'));
  }
};

/**
 * Middleware para registrar detalles de la solicitud
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Registrar información de la solicitud
  logger.info({
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: req.user ? req.user.id : 'anonymous',
  }, 'Solicitud recibida');

  // Añadir evento al finalizar la respuesta
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    logger.info({
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: duration,
      userId: req.user ? req.user.id : 'anonymous',
    }, 'Solicitud completada');
  });

  next();
};

/**
 * Middleware para manejo centralizado de errores
 */
const errorHandler = (err, req, res, next) => {
  // Si no es un error operacional, puede ser un error interno no controlado
  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'Error interno del servidor';

  // Registrar error
  logger.error({
    err: {
      name: err.name,
      message: err.message,
      stack: err.stack,
      details: err.details,
      service: err.service
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userId: req.user ? req.user.id : 'anonymous',
    }
  }, 'Error en la solicitud');

  // Responder al cliente
  const errorResponse = {
    status: err.status || 'error',
    message,
  };

  // Incluir detalles adicionales en entornos de desarrollo
  if (process.env.NODE_ENV === 'development' && err.details) {
    errorResponse.details = err.details;
    
    if (err.stack) {
      errorResponse.stack = err.stack;
    }
  }

  res.status(statusCode).json(errorResponse);
};

module.exports = {
  validateRequest,
  authenticate,
  requestLogger,
  errorHandler,
};