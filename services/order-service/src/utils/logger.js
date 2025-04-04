const winston = require('winston');
const path = require('path');

// Configuración de niveles y colores personalizados
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Añadir colores a winston
winston.addColors(colors);

// Formato personalizado para los logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Configuración de los transportes (destinos de los logs)
const transports = [
  // Imprimir en consola
  new winston.transports.Console(),
  
  // Guardar logs de errores en un archivo
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'error.log'),
    level: 'error',
  }),
  
  // Guardar todos los logs en un archivo
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'all.log'),
  }),
];

// Crear la instancia del logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  levels,
  format,
  transports,
});

// Crear stream para morgan
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

module.exports = logger;