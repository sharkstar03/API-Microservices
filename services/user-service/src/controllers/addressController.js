const User = require('../models/User');
const Address = require('../models/Address');
const { publishUserEvent } = require('../messaging/publisher');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

/**
 * Obtener todas las direcciones de un usuario
 */
exports.getUserAddresses = async (req, res, next) => {
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
    
    // Obtener direcciones
    const addresses = await Address.find({ 
      userId: user._id,
      isActive: true 
    }).sort({ isDefault: -1, createdAt: -1 });
    
    res.status(200).json({
      status: 'success',
      results: addresses.length,
      data: {
        addresses: addresses.map(address => address.formatResponse()),
      },
    });
  } catch (error) {
    logger.error(`Error al obtener direcciones del usuario ${req.params.userId}:`, error);
    next(error);
  }
};

/**
 * Obtener una dirección específica
 */
exports.getAddress = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const addressId = req.params.addressId;
    
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
    
    // Obtener dirección
    const address = await Address.findOne({ 
      _id: addressId,
      userId: user._id,
      isActive: true
    });
    
    if (!address) {
      return next(new AppError('Dirección no encontrada', 404));
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        address: address.formatResponse(),
      },
    });
  } catch (error) {
    logger.error(`Error al obtener dirección ${req.params.addressId}:`, error);
    next(error);
  }
};

/**
 * Crear una nueva dirección
 */
exports.createAddress = async (req, res, next) => {
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
    
    // Validar datos requeridos
    const requiredFields = ['name', 'addressLine1', 'city', 'state', 'postalCode', 'country'];
    for (const field of requiredFields) {
      if (!req.body[field]) {
        return next(new AppError(`El campo ${field} es requerido`, 400));
      }
    }
    
    // Verificar si es la primera dirección para marcarla como predeterminada
    const existingAddresses = await Address.find({ 
      userId: user._id,
      type: req.body.type || 'shipping',
      isActive: true
    });
    
    const isDefault = req.body.isDefault !== undefined 
      ? req.body.isDefault 
      : existingAddresses.length === 0;
    
    // Crear dirección
    const address = new Address({
      userId: user._id,
      type: req.body.type || 'shipping',
      isDefault,
      name: req.body.name,
      addressLine1: req.body.addressLine1,
      addressLine2: req.body.addressLine2,
      city: req.body.city,
      state: req.body.state,
      postalCode: req.body.postalCode,
      country: req.body.country,
      phoneNumber: req.body.phoneNumber,
      instructions: req.body.instructions,
      coordinates: req.body.coordinates,
    });
    
    await address.save();
    
    // Si esta dirección es predeterminada, actualizar otras direcciones
    if (isDefault) {
      await Address.updateMany(
        { 
          userId: user._id, 
          type: address.type, 
          _id: { $ne: address._id },
          isDefault: true
        },
        { isDefault: false }
      );
    }
    
    // Publicar evento
    await publishUserEvent('user.address_added', {
      userId: user._id.toString(),
      externalUserId: user.userId,
      addressId: address._id.toString(),
      addressType: address.type,
      createdAt: new Date().toISOString(),
    });
    
    res.status(201).json({
      status: 'success',
      data: {
        address: address.formatResponse(),
      },
    });
  } catch (error) {
    logger.error(`Error al crear dirección para el usuario ${req.params.userId}:`, error);
    next(error);
  }
};

/**
 * Actualizar una dirección
 */
exports.updateAddress = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const addressId = req.params.addressId;
    
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
    
    // Obtener dirección
    const address = await Address.findOne({ 
      _id: addressId,
      userId: user._id,
      isActive: true
    });
    
    if (!address) {
      return next(new AppError('Dirección no encontrada', 404));
    }
    
    // Actualizar dirección
    const updateData = { ...req.body };
    delete updateData.userId; // No permitir cambiar el usuario
    
    // Si se está cambiando a dirección predeterminada
    const isChangingDefault = updateData.isDefault !== undefined && 
                             updateData.isDefault !== address.isDefault &&
                             updateData.isDefault === true;
    
    // Actualizar campos
    await address.updateDetails(updateData);
    
    // Si se cambió a predeterminada, actualizar otras direcciones
    if (isChangingDefault) {
      await Address.updateMany(
        { 
          userId: user._id, 
          type: address.type, 
          _id: { $ne: address._id },
          isDefault: true
        },
        { isDefault: false }
      );
    }
    
    // Publicar evento
    await publishUserEvent('user.address_updated', {
      userId: user._id.toString(),
      externalUserId: user.userId,
      addressId: address._id.toString(),
      updatedFields: Object.keys(updateData),
      updatedAt: new Date().toISOString(),
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        address: address.formatResponse(),
      },
    });
  } catch (error) {
    logger.error(`Error al actualizar dirección ${req.params.addressId}:`, error);
    next(error);
  }
};

/**
 * Eliminar una dirección (soft delete)
 */
exports.deleteAddress = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const addressId = req.params.addressId;
    
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
    
    // Obtener dirección
    const address = await Address.findOne({ 
      _id: addressId,
      userId: user._id
    });
    
    if (!address) {
      return next(new AppError('Dirección no encontrada', 404));
    }
    
    // Soft delete
    address.isActive = false;
    await address.save();
    
    // Si era predeterminada, hacer otra predeterminada
    if (address.isDefault) {
      const nextDefault = await Address.findOne({
        userId: user._id,
        type: address.type,
        isActive: true
      }).sort({ createdAt: -1 });
      
      if (nextDefault) {
        nextDefault.isDefault = true;
        await nextDefault.save();
      }
    }
    
    // Publicar evento
    await publishUserEvent('user.address_removed', {
      userId: user._id.toString(),
      externalUserId: user.userId,
      addressId: address._id.toString(),
      removedAt: new Date().toISOString(),
    });
    
    res.status(200).json({
      status: 'success',
      message: 'Dirección eliminada correctamente',
    });
  } catch (error) {
    logger.error(`Error al eliminar dirección ${req.params.addressId}:`, error);
    next(error);
  }
};

/**
 * Establecer una dirección como predeterminada
 */
exports.setDefaultAddress = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const addressId = req.params.addressId;
    
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
    
    // Obtener dirección
    const address = await Address.findOne({ 
      _id: addressId,
      userId: user._id,
      isActive: true
    });
    
    if (!address) {
      return next(new AppError('Dirección no encontrada', 404));
    }
    
    // Establecer como predeterminada
    await address.setAsDefault();
    
    // Publicar evento
    await publishUserEvent('user.address_default_changed', {
      userId: user._id.toString(),
      externalUserId: user.userId,
      addressId: address._id.toString(),
      addressType: address.type,
      updatedAt: new Date().toISOString(),
    });
    
    res.status(200).json({
      status: 'success',
      message: 'Dirección establecida como predeterminada',
      data: {
        address: address.formatResponse(),
      },
    });
  } catch (error) {
    logger.error(`Error al establecer dirección ${req.params.addressId} como predeterminada:`, error);
    next(error);
  }
};