const rateLimit = require('express-rate-limit');
const Redis = require('ioredis');
const logger = require('../utils/logger');

const redis = new Redis(process.env.REDIS_URL);

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000;
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100;

/**
 * Store en Redis para que el contador se comparta entre instancias del gateway.
 * express-rate-limit 6 espera que increment devuelva una promesa.
 */
const createRedisStore = (prefix, windowMs) => ({
  increment: async (key) => {
    const redisKey = `${prefix}:${key}`;
    try {
      const results = await redis.multi().incr(redisKey).pttl(redisKey).exec();
      const totalHits = results[0][1];
      let ttl = results[1][1];

      // pttl devuelve -1 cuando la clave no tiene expiracion asignada todavia
      if (ttl < 0) {
        await redis.pexpire(redisKey, windowMs);
        ttl = windowMs;
      }

      return { totalHits, resetTime: new Date(Date.now() + ttl) };
    } catch (error) {
      logger.error('Error en Redis durante rate limiting:', error);
      // Si Redis falla no bloqueamos el trafico: se deja pasar la peticion
      return { totalHits: 1, resetTime: new Date(Date.now() + windowMs) };
    }
  },

  decrement: async (key) => {
    try {
      await redis.decrby(`${prefix}:${key}`, 1);
    } catch (error) {
      logger.error('Error al decrementar contador en Redis:', error);
    }
  },

  resetKey: async (key) => {
    try {
      await redis.del(`${prefix}:${key}`);
    } catch (error) {
      logger.error('Error al restablecer clave en Redis:', error);
    }
  },
});

/**
 * Limite general del API. Se aplica despues de authMiddleware, asi que puede
 * contar por usuario en vez de por IP.
 */
const rateLimitMiddleware = rateLimit({
  store: createRedisStore('ratelimit', WINDOW_MS),
  windowMs: WINDOW_MS,
  max: MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Demasiadas solicitudes, por favor intente más tarde.',
  },
  keyGenerator: (req) => (req.user && req.user.id ? `user_${req.user.id}` : `ip_${req.ip}`),
  skip: (req) => req.user && req.user.role === 'premium',
});

/**
 * Limite estricto para login, registro y recuperacion de contraseña. Va por IP
 * porque en estas rutas todavia no hay usuario autenticado, y es lo que frena
 * un ataque de fuerza bruta contra credenciales.
 */
const authRateLimitMiddleware = rateLimit({
  store: createRedisStore('ratelimit_auth', 15 * 60 * 1000),
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Demasiados intentos. Espera unos minutos antes de volver a probar.',
  },
  keyGenerator: (req) => `ip_${req.ip}`,
});

module.exports = rateLimitMiddleware;
module.exports.rateLimitMiddleware = rateLimitMiddleware;
module.exports.authRateLimitMiddleware = authRateLimitMiddleware;
