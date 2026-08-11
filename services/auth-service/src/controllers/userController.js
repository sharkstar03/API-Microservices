const User = require('../models/User');
const Token = require('../models/Token');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');
const { publishUserEvent } = require('../messaging/publisher');

// Este controlador toca credenciales y estado de la cuenta (rol, activación,
// bloqueo). El perfil visible del usuario (avatar, direcciones) vive en el
// user-service.

/**
 * Listar cuentas (solo admin)
 */
exports.getAllUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.role) {
      filter.role = req.query.role;
    }
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }
    if (req.query.search) {
      const search = new RegExp(req.query.search, 'i');
      filter.$or = [{ name: search }, { email: search }];
    }

    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);

    res.status(200).json({
      status: 'success',
      results: users.length,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      data: { users },
    });
  } catch (error) {
    logger.error('Error al listar usuarios:', error);
    next(new AppError('Error al obtener la lista de usuarios', 500));
  }
};

/**
 * Obtener una cuenta por ID (admin o el propio usuario)
 */
exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return next(new AppError('Usuario no encontrado', 404));
    }

    res.status(200).json({
      status: 'success',
      data: { user },
    });
  } catch (error) {
    logger.error('Error al obtener usuario:', error);
    next(new AppError('Error al obtener el usuario', 500));
  }
};

/**
 * Actualizar el rol de una cuenta (solo admin)
 */
exports.updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return next(new AppError('Usuario no encontrado', 404));
    }

    // Evitar que un admin se quite a sí mismo los permisos por accidente
    if (user._id.toString() === req.user.id && role !== 'admin') {
      return next(new AppError('No puedes cambiar tu propio rol de administrador', 400));
    }

    user.role = role;
    await user.save();

    await publishUserEvent('user.role_updated', {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      updatedBy: req.user.id,
    });

    logger.info(`Rol actualizado para ${user.email}: ${role}`);

    res.status(200).json({
      status: 'success',
      message: 'Rol actualizado correctamente',
      data: { user },
    });
  } catch (error) {
    logger.error('Error al actualizar rol:', error);
    next(new AppError('Error al actualizar el rol del usuario', 500));
  }
};

/**
 * Activar o desactivar una cuenta (solo admin)
 */
exports.updateUserStatus = async (req, res, next) => {
  try {
    const { isActive } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return next(new AppError('Usuario no encontrado', 404));
    }

    // Evitar que un admin se desactive a sí mismo
    if (user._id.toString() === req.user.id && !isActive) {
      return next(new AppError('No puedes desactivar tu propia cuenta', 400));
    }

    user.isActive = isActive;

    // Al reactivar una cuenta se limpia el bloqueo por intentos fallidos
    if (isActive) {
      user.accountLocked = false;
      user.accountLockedUntil = undefined;
      user.failedLoginAttempts = 0;
    }

    await user.save();

    // Al desactivar, revocar los refresh tokens activos
    if (!isActive) {
      await Token.deleteMany({ userId: user._id });
    }

    await publishUserEvent(isActive ? 'user.activated' : 'user.deactivated', {
      userId: user._id.toString(),
      email: user.email,
      updatedBy: req.user.id,
    });

    logger.info(`Cuenta ${isActive ? 'activada' : 'desactivada'}: ${user.email}`);

    res.status(200).json({
      status: 'success',
      message: `Cuenta ${isActive ? 'activada' : 'desactivada'} correctamente`,
      data: { user },
    });
  } catch (error) {
    logger.error('Error al actualizar estado:', error);
    next(new AppError('Error al actualizar el estado de la cuenta', 500));
  }
};

/**
 * Eliminar una cuenta (solo admin)
 */
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return next(new AppError('Usuario no encontrado', 404));
    }

    if (user._id.toString() === req.user.id) {
      return next(new AppError('No puedes eliminar tu propia cuenta', 400));
    }

    const { _id, email } = user;
    await user.deleteOne();

    // Limpiar los refresh tokens asociados
    await Token.deleteMany({ userId: _id });

    await publishUserEvent('user.deleted', {
      userId: _id.toString(),
      email,
      deletedBy: req.user.id,
    });

    logger.info(`Cuenta eliminada: ${email}`);

    res.status(200).json({
      status: 'success',
      message: 'Cuenta eliminada correctamente',
    });
  } catch (error) {
    logger.error('Error al eliminar usuario:', error);
    next(new AppError('Error al eliminar la cuenta', 500));
  }
};
