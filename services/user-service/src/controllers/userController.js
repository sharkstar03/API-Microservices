const User = require('../models/User');
const Profile = require('../models/Profile');
const Address = require('../models/Address');
const { publishUserEvent } = require('../messaging/publisher');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

/**
 * Obtener todos los usuarios (con paginación)
 */
exports.getAllUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const sortField = req.query.sortField || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    
    let query = { isDeleted: false };
    
    // Filtro por rol
    if (req.query.role) {
      query.role = req.query.role;
    }
    
    // Filtro por estado
    if (req.query.isActive !== undefined) {
      query.isActive = req.query.isActive === 'true';
    }
    
    // Filtro por texto
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    
    // Configurar ordenamiento
    const sort = {};
    sort[sortField] = sortOrder;
    
    // Ejecutar consulta con paginación
    const users = await User.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit);
    
    // Contar total de documentos
    const total = await User.countDocuments(query);
    
    res.status(200).json({
      status: 'success',
      results: users.length,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
      data: {
        users: users.map(user => user.formatResponse()),
      },
    });
  } catch (error) {
    logger.error('Error al obtener usuarios:', error);
    next(error);
  }
};

/**
 * Obtener un usuario por ID
 */
exports.getUserById = async (req, res, next) => {
  try {
    const userId = req.params.id;
    
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
    
    res.status(200).json({
      status: 'success',
      data: {
        user: user.formatResponse(),
      },
    });
  } catch (error) {
    logger.error(`Error al obtener usuario ${req.params.id}:`, error);
    next(error);
  }
};

/**
 * Crear un nuevo usuario
 */
exports.createUser = async (req, res, next) => {
  try {
    const { userId, email, name, role } = req.body;

    // Verificar si el usuario ya existe
    const existingUser = await User.findOne({ 
      $or: [
        { userId: userId },
        { email: email }
      ]
    });
    
    if (existingUser) {
      return next(new AppError('El usuario ya existe con ese ID o email', 409));
    }

    // Crear nuevo usuario
    const newUser = new User({
      userId,
      email,
      name,
      role: role || 'user',
      metadata: {
        registrationIP: req.ip,
        userAgent: req.headers['user-agent'],
        registrationSource: 'admin-api',
      },
    });

    // Guardar usuario
    await newUser.save();
    
    // Crear perfil básico
    const profile = new Profile({
      userId: newUser._id,
      firstName: name.split(' ')[0],
      lastName: name.split(' ').slice(1).join(' '),
    });
    
    await profile.save();
    
    // Publicar evento de usuario creado
    await publishUserEvent('user.created', {
      userId: newUser._id.toString(),
      externalUserId: newUser.userId,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      createdAt: newUser.createdAt,
    });

    res.status(201).json({
      status: 'success',
      data: {
        user: newUser.formatResponse(),
      },
    });
  } catch (error) {
    logger.error('Error al crear usuario:', error);
    next(error);
  }
};

/**
 * Actualizar un usuario
 */
exports.updateUser = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const { name, role, isActive, preferences } = req.body;
    
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
    
    // Actualizar campos
    if (name) user.name = name;
    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    if (preferences) {
      user.preferences = {
        ...user.preferences,
        ...preferences,
      };
    }
    
    // Guardar cambios
    await user.save();
    
    // Publicar evento de usuario actualizado
    await publishUserEvent('user.updated', {
      userId: user._id.toString(),
      externalUserId: user.userId,
      updatedFields: Object.keys(req.body),
      updatedAt: new Date().toISOString(),
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        user: user.formatResponse(),
      },
    });
  } catch (error) {
    logger.error(`Error al actualizar usuario ${req.params.id}:`, error);
    next(error);
  }
};

/**
 * Eliminar un usuario (soft delete)
 */
exports.deleteUser = async (req, res, next) => {
  try {
    const userId = req.params.id;
    
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
    
    // Soft delete
    user.isActive = false;
    user.isDeleted = true;
    await user.save();
    
    // Publicar evento de usuario eliminado
    await publishUserEvent('user.deleted', {
      userId: user._id.toString(),
      externalUserId: user.userId,
      deletedAt: new Date().toISOString(),
    });
    
    res.status(200).json({
      status: 'success',
      message: 'Usuario eliminado correctamente',
    });
  } catch (error) {
    logger.error(`Error al eliminar usuario ${req.params.id}:`, error);
    next(error);
  }
};

/**
 * Buscar usuarios por criterios
 */
exports.searchUsers = async (req, res, next) => {
  try {
    const { query, role, status, limit = 10 } = req.query;
    
    let searchQuery = { isDeleted: false };
    
    // Filtro de texto
    if (query) {
      searchQuery.$or = [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
      ];
    }
    
    // Filtro por rol
    if (role) {
      searchQuery.role = role;
    }
    
    // Filtro por estado
    if (status) {
      searchQuery.isActive = status === 'active';
    }
    
    const users = await User.find(searchQuery)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10));
    
    res.status(200).json({
      status: 'success',
      results: users.length,
      data: {
        users: users.map(user => user.formatResponse()),
      },
    });
  } catch (error) {
    logger.error('Error al buscar usuarios:', error);
    next(error);
  }
};