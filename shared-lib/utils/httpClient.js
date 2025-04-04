const axios = require('axios');
const logger = require('./logger');
const { ExternalServiceError, TimeoutError } = require('../errors');

// Crear cliente HTTP con configuración base
const client = axios.create({
  timeout: 10000, // 10 segundos por defecto
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para solicitudes
client.interceptors.request.use(
  (config) => {
    // Agregar header para identificar el servicio que hace la solicitud
    config.headers['X-Service-Name'] = process.env.SERVICE_NAME || 'microservice';
    
    // Agregar tracing ID si existe en el contexto actual
    if (process.env.TRACING_ID) {
      config.headers['X-Tracing-ID'] = process.env.TRACING_ID;
    }
    
    // Aplicar seguridad para solicitudes entre servicios si se proporciona una clave API
    if (process.env.INTERNAL_API_KEY) {
      config.headers['X-API-KEY'] = process.env.INTERNAL_API_KEY;
    }

    // Registrar la solicitud (versión reducida)
    logger.debug({
      url: config.url,
      method: config.method,
      service: config.headers['X-Service-Name'],
    }, 'HTTP Request');

    return config;
  },
  (error) => {
    // Registrar errores en la preparación de la solicitud
    logger.error({
      error: error.message,
    }, 'HTTP Request Configuration Error');
    return Promise.reject(error);
  }
);

// Interceptor para respuestas
client.interceptors.response.use(
  (response) => {
    // Registrar respuesta exitosa (versión reducida)
    logger.debug({
      url: response.config.url,
      method: response.config.method,
      status: response.status,
      duration: response.headers['x-response-time'] || 'unknown',
    }, 'HTTP Response Success');
    
    return response;
  },
  (error) => {
    // Crear mensaje de error apropiado
    let customError;
    
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      customError = new TimeoutError(
        `Tiempo de espera excedido al conectar con ${error.config?.url || 'servicio externo'}`,
        {
          url: error.config?.url,
          method: error.config?.method,
          timeout: error.config?.timeout,
        }
      );
    } else if (error.response) {
      // El servidor respondió con un código de estado fuera del rango 2xx
      const responseData = error.response.data || {};
      customError = new ExternalServiceError(
        responseData.message || `Error en servicio externo: ${error.response.status}`,
        {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response.status,
          data: responseData,
        }
      );
    } else if (error.request) {
      // La solicitud se realizó pero no se recibió respuesta
      customError = new ExternalServiceError(
        `No se recibió respuesta al conectar con ${error.config?.url || 'servicio externo'}`,
        {
          url: error.config?.url,
          method: error.config?.method,
          request: error.request,
        }
      );
    } else {
      // Error al configurar la solicitud
      customError = new ExternalServiceError(
        `Error al realizar la solicitud: ${error.message}`,
        { message: error.message }
      );
    }
    
    // Registrar el error
    logger.error({
      url: error.config?.url,
      method: error.config?.method,
      error: customError,
      originalError: error.message,
    }, 'HTTP Request Error');
    
    return Promise.reject(customError);
  }
);

module.exports = client;