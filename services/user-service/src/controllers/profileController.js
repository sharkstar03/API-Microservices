const User = require('../models/User');
const Profile = require('../models/Profile');
const { publishUserEvent } = require('../messaging/publisher');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

/**
 * Obtener perfil de un usuario
 */
exports.getProfile = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    
    // Obtener usuario para verificar que existe
    const user = await User.findOne({ 
      $or: [
        { _id: userId },
        { userId: userId }
      ],
      isDeleted: false
    });
    
    if (!user) {
      return next(new AppError('Usuario no encontrado', 404));
    }
    
    // Obtener perfil (o crear uno básico si no existe)
    let profile = await Profile.findOne({ userId: user._id });
    
    if (!profile) {
      profile = new Profile({
        userId: user._id,
        firstName: user.name.split(' ')[0],
        lastName: user.name.split(' ').slice(1).join(' '),
      });
      await profile.save();
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        profile,
        user: user.formatResponse(),
      },
    });
  } catch (error) {
    logger.error(`Error al obtener perfil del usuario ${req.params.userId}:`, error);
    next(error);
  }
};

/**
 * Actualizar perfil de un usuario
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    
    // Obtener usuario para verificar que existe
    const user = await User.findOne({ 
      $or: [
        { _id: userId },
        { userId: userId }
      ],
      isDeleted: false
    });
    
    if (!user) {
      return next(new AppError('Usuario no encontrado', 404));
    }
    
    // Obtener perfil (o crear uno básico si no existe)
    let profile = await Profile.findOne({ userId: user._id });
    
    if (!profile) {
      profile = new Profile({
        userId: user._id,
        firstName: user.name.split(' ')[0],
        lastName: user.name.split(' ').slice(1).join(' '),
      });
    }
    
    // Actualizar campos del perfil
    const profileData = { ...req.body };
    
    // Asegurar que no se modifique el userId
    delete profileData.userId;
    
    // Actualizar campos del perfil
    await profile.updateProfileDetails(profileData);
    
    // Si se actualizó el nombre, actualizar también el nombre en el usuario
    if (profileData.firstName || profileData.lastName) {
      const firstName = profileData.firstName || profile.firstName || '';
      const lastName = profileData.lastName || profile.lastName || '';
      const fullName = `${firstName} ${lastName}`.trim();
      
      if (fullName) {
        user.name = fullName;
        await user.save();
      }
    }
    
    // Publicar evento de perfil actualizado
    await publishUserEvent('user.profile_updated', {
      userId: user._id.toString(),
      externalUserId: user.userId,
      updatedFields: Object.keys(profileData),
      updatedAt: new Date().toISOString(),
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        profile,
        user: user.formatResponse(),
      },
    });
  } catch (error) {
    logger.error(`Error al actualizar perfil del usuario ${req.params.userId}:`, error);
    next(error);
  }
};

/**
 * Actualizar intereses del usuario
 */
exports.updateInterests = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const { interests } = req.body;
    
    if (!interests || !Array.isArray(interests)) {
      return next(new AppError('Se requiere un array de intereses', 400));
    }
    
    // Obtener usuario para verificar que existe
    const user = await User.findOne({ 
      $or: [
        { _id: userId },
        { userId: userId }
      ],
      isDeleted: false
    });
    
    if (!user) {
      return next(new AppError('Usuario no encontrado', 404));
    }
    
    // Obtener perfil (o crear uno básico si no existe)
    let profile = await Profile.findOne({ userId: user._id });
    
    if (!profile) {
      profile = new Profile({
        userId: user._id,
        firstName: user.name.split(' ')[0],
        lastName: user.name.split(' ').slice(1).join(' '),
      });
    }
    
    // Actualizar intereses
    await profile.addInterests(interests);
    
    // Publicar evento
    await publishUserEvent('user.interests_updated', {
      userId: user._id.toString(),
      externalUserId: user.userId,
      interests: profile.interests,
      updatedAt: new Date().toISOString(),
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        interests: profile.interests,
      },
    });
  } catch (error) {
    logger.error(`Error al actualizar intereses del usuario ${req.params.userId}:`, error);
    next(error);
  }
};

/**
 * Actualizar habilidades del usuario
 */
exports.updateSkills = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const { skills } = req.body;
    
    if (!skills || !Array.isArray(skills)) {
      return next(new AppError('Se requiere un array de habilidades', 400));
    }
    
    // Obtener usuario para verificar que existe
    const user = await User.findOne({ 
      $or: [
        { _id: userId },
        { userId: userId }
      ],
      isDeleted: false
    });
    
    if (!user) {
      return next(new AppError('Usuario no encontrado', 404));
    }
    
    // Obtener perfil (o crear uno básico si no existe)
    let profile = await Profile.findOne({ userId: user._id });
    
    if (!profile) {
      profile = new Profile({
        userId: user._id,
        firstName: user.name.split(' ')[0],
        lastName: user.name.split(' ').slice(1).join(' '),
      });
    }
    
    // Actualizar habilidades
    await profile.addSkills(skills);
    
    // Publicar evento
    await publishUserEvent('user.skills_updated', {
      userId: user._id.toString(),
      externalUserId: user.userId,
      skills: profile.skills,
      updatedAt: new Date().toISOString(),
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        skills: profile.skills,
      },
    });
  } catch (error) {
    logger.error(`Error al actualizar habilidades del usuario ${req.params.userId}:`, error);
    next(error);
  }
};

/**
 * Subir avatar de perfil (solo actualiza la URL)
 */
exports.updateAvatar = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const { avatarUrl } = req.body;
    
    if (!avatarUrl) {
      return next(new AppError('Se requiere la URL del avatar', 400));
    }
    
    // Obtener usuario para verificar que existe
    const user = await User.findOne({ 
      $or: [
        { _id: userId },
        { userId: userId }
      ],
      isDeleted: false
    });
    
    if (!user) {
      return next(new AppError('Usuario no encontrado', 404));
    }
    
    // Obtener perfil (o crear uno básico si no existe)
    let profile = await Profile.findOne({ userId: user._id });
    
    if (!profile) {
      profile = new Profile({
        userId: user._id,
        firstName: user.name.split(' ')[0],
        lastName: user.name.split(' ').slice(1).join(' '),
      });
    }
    
    // Actualizar avatar
    profile.avatarUrl = avatarUrl;
    await profile.save();
    
    // Publicar evento
    await publishUserEvent('user.avatar_updated', {
      userId: user._id.toString(),
      externalUserId: user.userId,
      avatarUrl: profile.avatarUrl,
      updatedAt: new Date().toISOString(),
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        avatarUrl: profile.avatarUrl,
      },
    });
  } catch (error) {
    logger.error(`Error al actualizar avatar del usuario ${req.params.userId}:`, error);
    next(error);
  }
};