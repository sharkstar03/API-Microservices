const jwt = require('jsonwebtoken');
const Redis = require('ioredis');
const axios = require('axios');
const logger = require('../utils/logger');

// Configuración del cliente Redis
const redis = new Redis(process.env.REDIS_URL);

/**
 * Middleware de autenticación
 * Verifica el token JWT en las cabeceras y valida su autenticidad
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Obtener el token del header Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Token de autenticación no proporcionado' });
    }

    const token = authHeader.split(' ')[1];

    // Verificar si el token está en la lista negra (logout)
    const isBlacklisted = await redis.exists(`bl_${token}`);
    if (isBlacklisted) {
      return res.status(401).json({ message: 'Token inválido o expirado' });
    }

    // Verificar y decodificar el token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verificar si el usuario aún existe y está activo
    try {
      const authServiceUrl = process.env.AUTH_SERVICE_URL;
      const response = await axios.get(`${authServiceUrl}/api/auth/validate`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.data.valid) {
        throw new Error('Usuario no válido');
      }
    } catch (error) {
      logger.error('Error al validar el usuario con el servicio de autenticación:', error);
      return res.status(401).json({ message: 'Usuario no válido o token expirado' });
    }

    // Guardar la información del usuario en el objeto request
    req.user = decoded;
    next();
  } catch (error) {
    logger.error('Error en middleware de autenticación:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Token inválido' });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expirado' });
    }
    
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
};

module.exports = authMiddleware;