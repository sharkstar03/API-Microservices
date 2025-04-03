const rateLimit = require('express-rate-limit');
const Redis = require('ioredis');
const logger = require('../utils/logger');

// Cliente Redis para almacenar contadores de tasa de límite
const redis = new Redis(process.env.REDIS_URL);

/**
 * Store personalizado para usar Redis con el limitador de tasa
 */
const redisStore = {
  /**
   * Incrementa el contador para la clave especificada
   * @param {string} key - Clave única para el limitador (basada en IP o identificador de usuario)
   * @param {function} cb - Función callback
   */
  increment: function (key, cb) {
    redis
      .multi()
      .incr(key)
      .pttl(key)
      .exec((err, results) => {
        if (err) {
          logger.error('Error en Redis durante rate limiting:', err);
          return cb(err);
        }
        
        const counter = results[0][1];
        
        // Si es el primer incremento, establecer el tiempo de expiración (1 hora)
        if (counter === 1) {
          redis.expire(key, 60 * 60);
        }
        
        cb(null, {
          totalHits: counter,
          resetTime: Date.now() + results[1][1],
        });
      });
  },
  
  /**
   * Decrementa el contador (usado para revertir incrementos en casos especiales)
   * @param {string} key - Clave única
   */
  decrement: function (key) {
    redis.decrby(key, 1).catch(err => {
      logger.error('Error al decrementar contador en Redis:', err);
    });
  },
  
  /**
   * Restablece el contador para la clave especificada
   * @param {string} key - Clave única
   */
  resetKey: function (key) {
    redis.del(key).catch(err => {
      logger.error('Error al restablecer clave en Redis:', err);
    });
  },
};

/**
 * Configuración del middleware de límite de tasa (rate limiting)
 * Limita el número de solicitudes por IP
 */
const rateLimitMiddleware = rateLimit({
  store: redisStore,
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Límite de 100 solicitudes por ventana por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Demasiadas solicitudes, por favor intente más tarde.',
  },
  // Función para generar claves personalizadas basadas en el usuario autenticado o la IP
  keyGenerator: (req) => {
    // Si el usuario está autenticado, usar su ID como parte de la clave
    if (req.user && req.user.id) {
      return `ratelimit_${req.user.id}`;
    }
    // De lo contrario, usar la IP
    return `ratelimit_${req.ip}`;
  },
  // Función para determinar si se debe omitir el límite (por ejemplo, para algunos usuarios premium)
  skip: (req) => {
    // Ejemplo: omitir para usuarios premium
    return req.user && req.user.role === 'premium';
  },
});

module.exports = rateLimitMiddleware;