const pino = require('pino');

// Determinar el nivel de log basado en el entorno
const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Configuración base para todos los loggers
const baseLogger = pino({
  level,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});

/**
 * Crea un logger para un servicio específico
 * @param {string} serviceName - Nombre del servicio
 * @returns {Object} - Instancia del logger
 */
const createServiceLogger = (serviceName) => {
  return baseLogger.child({ service: serviceName });
};

// Exportar logger base y función para crear loggers específicos
module.exports = {
  // Logger por defecto
  info: baseLogger.info.bind(baseLogger),
  error: baseLogger.error.bind(baseLogger),
  warn: baseLogger.warn.bind(baseLogger),
  debug: baseLogger.debug.bind(baseLogger),
  
  // Crear logger específico
  createServiceLogger,
  
  // Instancia base para uso avanzado
  baseLogger,
};