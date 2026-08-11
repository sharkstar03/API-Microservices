const Redis = require('ioredis');
const logger = require('./logger');

const redis = new Redis(process.env.REDIS_URL);

const CACHE_EXPIRATION = 60 * 15; // 15 minutos

/**
 * Invalida todas las claves que coincidan con un patrón.
 *
 * Ojo: redis.del('products:*') no sirve. DEL no interpreta comodines y borra
 * solo una clave con ese nombre literal. Hay que recorrer el keyspace con SCAN
 * (no bloqueante, al contrario que KEYS) y borrar las coincidencias.
 *
 * @param {string} pattern - Patrón glob (ej: 'products:*')
 * @returns {Promise<number>} Número de claves eliminadas
 */
const clearCachePattern = (pattern) => {
  return new Promise((resolve, reject) => {
    const stream = redis.scanStream({ match: pattern, count: 100 });
    const pipeline = redis.pipeline();
    let deleted = 0;

    stream.on('data', (keys) => {
      keys.forEach((key) => {
        pipeline.del(key);
        deleted += 1;
      });
    });

    stream.on('end', async () => {
      try {
        if (deleted > 0) {
          await pipeline.exec();
          logger.debug(`Caché invalidada: ${deleted} claves con patrón ${pattern}`);
        }
        resolve(deleted);
      } catch (error) {
        reject(error);
      }
    });

    stream.on('error', reject);
  });
};

module.exports = {
  redis,
  CACHE_EXPIRATION,
  clearCachePattern,
};
