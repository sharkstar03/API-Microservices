const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Redis = require('ioredis');
const User = require('../models/User');
const Token = require('../models/Token');
const { publishUserEvent } = require('../messaging/publisher');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

// Cliente Redis para lista negra de tokens
const redis = new Redis(process.env.REDIS_URL);

/**
 * Registro de nuevo usuario
 */
exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Verificar si el usuario ya existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        status: 'error',
        message: 'El email ya está registrado',
      });
    }

    // Crear nuevo usuario
    const user = new User({
      name,
      email,
      password,
    });

    // Generar token de verificación de email
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.verificationToken = verificationToken;

    // Guardar usuario
    await user.save();

    // Crear token de verificación en la colección de tokens
    await Token.create({
      userId: user._id,
      token: verificationToken,
      type: 'verification',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
    });

    // Publicar evento de usuario creado
    await publishUserEvent('user.created', {
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    });

    // Enviar email de verificación (simulado en el log)
    logger.info(`Email de verificación enviado a: ${email} con token: ${verificationToken}`);

    // Enviar respuesta
    res.status(201).json({
      status: 'success',
      message: 'Usuario registrado correctamente. Por favor verifica tu email.',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    logger.error('Error en registro:', error);
    next(error);
  }
};

/**
 * Inicio de sesión
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Verificar si el usuario existe y seleccionar el campo password explícitamente
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Credenciales inválidas',
      });
    }

    // Verificar si la cuenta está bloqueada
    if (user.accountLocked) {
      if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
        return res.status(401).json({
          status: 'error',
          message: 'Cuenta bloqueada temporalmente por múltiples intentos fallidos',
          lockedUntil: user.accountLockedUntil,
        });
      } else {
        // Desbloquear si ya pasó el tiempo
        user.accountLocked = false;
        user.failedLoginAttempts = 0;
        await user.save();
      }
    }

    // Verificar si la contraseña es correcta
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      // Registrar intento fallido
      await user.recordLoginAttempt(false);
      
      return res.status(401).json({
        status: 'error',
        message: 'Credenciales inválidas',
      });
    }

    // Verificar si el email está verificado
    if (!user.emailVerified) {
      return res.status(401).json({
        status: 'error',
        message: 'Por favor verifica tu email antes de iniciar sesión',
      });
    }

    // Verificar si la cuenta está activa
    if (!user.isActive) {
      return res.status(401).json({
        status: 'error',
        message: 'Tu cuenta ha sido desactivada',
      });
    }

    // Registrar inicio de sesión exitoso
    await user.recordLoginAttempt(true);

    // Generar tokens
    const token = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();

    // Guardar refresh token en la base de datos
    await Token.create({
      userId: user._id,
      token: refreshToken,
      type: 'refresh',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    // Publicar evento de inicio de sesión
    await publishUserEvent('user.login', {
      userId: user._id.toString(),
      timestamp: new Date().toISOString(),
    });

    // Enviar respuesta
    res.status(200).json({
      status: 'success',
      message: 'Inicio de sesión exitoso',
      data: {
        token,
        refreshToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    logger.error('Error en login:', error);
    next(error);
  }
};

/**
 * Cerrar sesión
 */
exports.logout = async (req, res, next) => {
  try {
    const { user } = req;
    const authHeader = req.headers.authorization;
    const token = authHeader.split(' ')[1];

    // Agregar el token a la lista negra en Redis
    // TTL basado en el tiempo de expiración del token
    const decodedToken = jwt.decode(token);
    const expiryTime = decodedToken.exp - Math.floor(Date.now() / 1000);
    
    // Solo añadir a la lista negra si aún no ha expirado
    if (expiryTime > 0) {
      await redis.set(`bl_${token}`, '1', 'EX', expiryTime);
    }

    // Invalidar todos los refresh tokens del usuario
    await Token.invalidateTokens(user.id, 'refresh');

    // Publicar evento de cierre de sesión
    await publishUserEvent('user.logout', {
      userId: user.id,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      status: 'success',
      message: 'Sesión cerrada correctamente',
    });
  } catch (error) {
    logger.error('Error en logout:', error);
    next(error);
  }
};

/**
 * Renovar token de acceso usando refresh token
 */
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    // Verificar si el refresh token existe y es válido
    const tokenDoc = await Token.findValidToken(refreshToken, 'refresh');
    
    if (!tokenDoc) {
      return res.status(401).json({
        status: 'error',
        message: 'Refresh token inválido o expirado',
      });
    }

    // Verificar si el usuario existe
    const user = await User.findById(tokenDoc.userId);
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        status: 'error',
        message: 'Usuario no encontrado o inactivo',
      });
    }

    // Generar nuevo token de acceso
    const newAccessToken = user.generateAuthToken();

    // Generar nuevo refresh token
    const newRefreshToken = user.generateRefreshToken();

    // Marcar el refresh token actual como usado
    await tokenDoc.markAsUsed();

    // Guardar nuevo refresh token
    await Token.create({
      userId: user._id,
      token: newRefreshToken,
      type: 'refresh',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    res.status(200).json({
      status: 'success',
      data: {
        token: newAccessToken,
        refreshToken: newRefreshToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    logger.error('Error en refresh token:', error);
    next(error);
  }
};

/**
 * Solicitar restablecimiento de contraseña
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Buscar usuario por email
    const user = await User.findOne({ email });
    
    // No revelar si el usuario existe o no por seguridad
    if (!user) {
      return res.status(200).json({
        status: 'success',
        message: 'Si el email está registrado, recibirás instrucciones para restablecer tu contraseña.',
      });
    }

    // Generar token de reset
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Guardar token en la base de datos
    await Token.create({
      userId: user._id,
      token: resetToken,
      type: 'reset',
      expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000), // 1 hora
    });

    // Enviar email con instrucciones (simulado en log)
    logger.info(`Email de restablecimiento enviado a: ${email} con token: ${resetToken}`);

    res.status(200).json({
      status: 'success',
      message: 'Si el email está registrado, recibirás instrucciones para restablecer tu contraseña.',
    });
  } catch (error) {
    logger.error('Error en forgot password:', error);
    next(error);
  }
};

/**
 * Restablecer contraseña
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    // Verificar si el token existe y es válido
    const resetToken = await Token.findValidToken(token, 'reset');
    
    if (!resetToken) {
      return res.status(400).json({
        status: 'error',
        message: 'Token inválido o expirado',
      });
    }

    // Buscar usuario
    const user = await User.findById(resetToken.userId);
    
    if (!user) {
      return res.status(400).json({
        status: 'error',
        message: 'Usuario no encontrado',
      });
    }

    // Actualizar contraseña
    user.password = password;
    await user.save();

    // Marcar token como usado
    await resetToken.markAsUsed();

    // Invalidar tokens de sesión existentes
    await Token.invalidateTokens(user._id, 'refresh');

    // Publicar evento de cambio de contraseña
    await publishUserEvent('user.password_reset', {
      userId: user._id.toString(),
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      status: 'success',
      message: 'Contraseña restablecida correctamente',
    });
  } catch (error) {
    logger.error('Error en reset password:', error);
    next(error);
  }
};

/**
 * Verificar correo electrónico
 */
exports.verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;

    // Verificar si el token existe y es válido
    const verificationToken = await Token.findValidToken(token, 'verification');
    
    if (!verificationToken) {
      return res.status(400).json({
        status: 'error',
        message: 'Token de verificación inválido o expirado',
      });
    }

    // Buscar usuario
    const user = await User.findById(verificationToken.userId);
    
    if (!user) {
      return res.status(400).json({
        status: 'error',
        message: 'Usuario no encontrado',
      });
    }

    // Marcar email como verificado
    user.emailVerified = true;
    user.verificationToken = undefined;
    await user.save();

    // Marcar token como usado
    await verificationToken.markAsUsed();

    // Publicar evento de email verificado
    await publishUserEvent('user.email_verified', {
      userId: user._id.toString(),
      email: user.email,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      status: 'success',
      message: 'Email verificado correctamente',
    });
  } catch (error) {
    logger.error('Error en verificación de email:', error);
    next(error);
  }
};

/**
 * Validar token JWT
 */
exports.validate = async (req, res) => {
  // El middleware authenticate ya verificó el token, así que solo respondemos con éxito
  res.status(200).json({
    valid: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
    },
  });
};

/**
 * Cambiar contraseña (usuario autenticado)
 */
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Buscar usuario
    const user = await User.findById(userId).select('+password');
    
    if (!user) {
      return next(new AppError('Usuario no encontrado', 404));
    }

    // Verificar contraseña actual
    const isPasswordValid = await user.comparePassword(currentPassword);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Contraseña actual incorrecta',
      });
    }

    // Actualizar contraseña
    user.password = newPassword;
    await user.save();

    // Invalidar tokens de sesión existentes excepto el actual
    await Token.invalidateTokens(user._id, 'refresh');

    // Publicar evento de cambio de contraseña
    await publishUserEvent('user.password_changed', {
      userId: user._id.toString(),
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      status: 'success',
      message: 'Contraseña actualizada correctamente',
    });
  } catch (error) {
    logger.error('Error en cambio de contraseña:', error);
    next(error);
  }
};