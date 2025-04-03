const logger = require('../utils/logger');

/**
 * Middleware centralizado para manejo de errores
 * Registra errores y devuelve respuestas de error estandarizadas
 */
const errorHandler = (err, req, res, next) => {
  // Registrar el error
  logger.error(`Error: ${err.message}`, {
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.user ? req.user.id : 'no-auth',
  });

  // Determinar el código de estado HTTP
  let statusCode = err.statusCode || 500;
  
  // Formatear la respuesta de error
  const errorResponse = {
    status: 'error',
    message: statusCode === 500 ? 'Error interno del servidor' : err.message,
  };

  // Agregar detalles adicionales en entornos de desarrollo
  if (process.env.NODE_ENV === 'development' && err.stack) {
    errorResponse.stack = err.stack;
    
    // Si hay detalles específicos del error, incluirlos
    if (err.details) {
      errorResponse.details = err.details;
    }
  }

  // Si es un error de servicio externo, proporcionar información sobre el servicio
  if (err.service) {
    errorResponse.service = err.service;
  }

  // Si es un error de validación, incluir los errores específicos
  if (err.name === 'ValidationError' && err.errors) {
    errorResponse.errors = err.errors;
  }

  // Devolver respuesta JSON con el código de estado apropiado
  res.status(statusCode).json(errorResponse);
};

module.exports = errorHandler;