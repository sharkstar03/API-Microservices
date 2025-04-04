/**
 * Clase personalizada para errores de la aplicación
 * Permite definir mensajes de error y códigos de estado HTTP personalizados
 */
class AppError extends Error {
    /**
     * Constructor para AppError
     * @param {string} message - Mensaje de error
     * @param {number} statusCode - Código de estado HTTP (por defecto 500)
     * @param {Object} details - Detalles adicionales del error
     * @param {string} service - Nombre del servicio donde ocurrió el error
     */
    constructor(message, statusCode = 500, details = null, service = 'user-service') {
      super(message);
      this.statusCode = statusCode;
      this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
      this.isOperational = true; // Indica si es un error operacional conocido
      this.details = details;
      this.service = service;
  
      // Capturar la pila de llamadas (stack trace)
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  module.exports = AppError;