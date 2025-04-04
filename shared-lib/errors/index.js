const { StatusCodes } = require('http-status-codes');

/**
 * Error base para la aplicación
 */
class AppError extends Error {
  constructor(message, statusCode = StatusCodes.INTERNAL_SERVER_ERROR, details = null, service = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true; // Indica si es un error operacional conocido
    this.details = details;
    this.service = service;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error de validación (400 Bad Request)
 */
class ValidationError extends AppError {
  constructor(message = 'Datos de entrada inválidos', details = null, service = null) {
    super(message, StatusCodes.BAD_REQUEST, details, service);
    this.name = 'ValidationError';
  }
}

/**
 * Error de autenticación (401 Unauthorized)
 */
class AuthenticationError extends AppError {
  constructor(message = 'No autorizado. Por favor inicie sesión', details = null, service = null) {
    super(message, StatusCodes.UNAUTHORIZED, details, service);
    this.name = 'AuthenticationError';
  }
}

/**
 * Error de autorización (403 Forbidden)
 */
class AuthorizationError extends AppError {
  constructor(message = 'No tiene permisos para realizar esta acción', details = null, service = null) {
    super(message, StatusCodes.FORBIDDEN, details, service);
    this.name = 'AuthorizationError';
  }
}

/**
 * Error de recurso no encontrado (404 Not Found)
 */
class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado', details = null, service = null) {
    super(message, StatusCodes.NOT_FOUND, details, service);
    this.name = 'NotFoundError';
  }
}

/**
 * Error de conflicto (409 Conflict)
 */
class ConflictError extends AppError {
  constructor(message = 'Conflicto en el recurso', details = null, service = null) {
    super(message, StatusCodes.CONFLICT, details, service);
    this.name = 'ConflictError';
  }
}

/**
 * Error de servicio (500 Internal Server Error)
 */
class ServiceError extends AppError {
  constructor(message = 'Error interno del servicio', details = null, service = null) {
    super(message, StatusCodes.INTERNAL_SERVER_ERROR, details, service);
    this.name = 'ServiceError';
  }
}

/**
 * Error de dependencia externa (502 Bad Gateway)
 */
class ExternalServiceError extends AppError {
  constructor(message = 'Error en servicio externo', details = null, service = null) {
    super(message, StatusCodes.BAD_GATEWAY, details, service);
    this.name = 'ExternalServiceError';
  }
}

/**
 * Error de timeout (504 Gateway Timeout)
 */
class TimeoutError extends AppError {
  constructor(message = 'Tiempo de espera excedido', details = null, service = null) {
    super(message, StatusCodes.GATEWAY_TIMEOUT, details, service);
    this.name = 'TimeoutError';
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  ServiceError,
  ExternalServiceError,
  TimeoutError
};