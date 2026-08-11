const { Op } = require('sequelize');
const { Category, Product } = require('../models');
const { publishProductEvent } = require('../messaging/publisher');
const { redis, CACHE_EXPIRATION, clearCachePattern } = require('../utils/cache');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

// Los productos también se invalidan: sus respuestas incluyen la categoría.
const invalidateCategoryCache = async () => {
  await Promise.all([
    clearCachePattern('categories:*'),
    clearCachePattern('category:*'),
    clearCachePattern('products:*'),
  ]);
};

/**
 * Construye un árbol jerárquico a partir de una lista plana de categorías
 * @param {Array} categories - Categorías en formato plano
 * @param {string|null} parentId - ID del padre en el nivel actual
 */
const buildCategoryTree = (categories, parentId = null) => {
  return categories
    .filter((category) => category.parentId === parentId)
    .map((category) => ({
      ...category.toJSON(),
      children: buildCategoryTree(categories, category.id),
    }));
};

/**
 * Obtener todas las categorías (plano o en árbol)
 */
exports.getAllCategories = async (req, res, next) => {
  try {
    const onlyActive = req.query.onlyActive === 'true';
    const asTree = req.query.tree === 'true';

    const cacheKey = `categories:${onlyActive}:${asTree}`;

    const cachedResults = await redis.get(cacheKey);
    if (cachedResults) {
      logger.debug('Categorías obtenidas de caché');
      return res.status(200).json(JSON.parse(cachedResults));
    }

    const whereClause = {};
    if (onlyActive) {
      whereClause.isActive = true;
    }

    const categories = await Category.findAll({
      where: whereClause,
      order: [['sortOrder', 'ASC'], ['name', 'ASC']],
    });

    const response = {
      status: 'success',
      results: categories.length,
      data: {
        categories: asTree ? buildCategoryTree(categories) : categories,
      },
    };

    await redis.set(cacheKey, JSON.stringify(response), 'EX', CACHE_EXPIRATION);

    res.status(200).json(response);
  } catch (error) {
    logger.error('Error al obtener categorías:', error);
    next(new AppError('Error al obtener las categorías', 500));
  }
};

/**
 * Obtener una categoría por ID o slug
 */
exports.getCategoryById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const cacheKey = `category:${id}`;

    const cachedCategory = await redis.get(cacheKey);
    if (cachedCategory) {
      logger.debug('Categoría obtenida de caché');
      return res.status(200).json(JSON.parse(cachedCategory));
    }

    // Permitir búsqueda tanto por UUID como por slug
    const category = await Category.findOne({
      where: {
        [Op.or]: [{ id }, { slug: id }],
      },
      include: [
        {
          model: Category,
          as: 'children',
          attributes: ['id', 'name', 'slug'],
          required: false,
        },
      ],
    });

    if (!category) {
      return next(new AppError('Categoría no encontrada', 404));
    }

    const response = {
      status: 'success',
      data: { category },
    };

    await redis.set(cacheKey, JSON.stringify(response), 'EX', CACHE_EXPIRATION);

    res.status(200).json(response);
  } catch (error) {
    logger.error('Error al obtener categoría:', error);
    next(new AppError('Error al obtener la categoría', 500));
  }
};

/**
 * Crear una categoría (solo admin)
 */
exports.createCategory = async (req, res, next) => {
  try {
    const { parentId } = req.body;

    // Verificar que la categoría padre exista
    if (parentId) {
      const parent = await Category.findByPk(parentId);
      if (!parent) {
        return next(new AppError('La categoría padre no existe', 400));
      }
    }

    const category = await Category.create({
      ...req.body,
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });

    await invalidateCategoryCache();

    await publishProductEvent('category.created', {
      categoryId: category.id,
      name: category.name,
      slug: category.slug,
      parentId: category.parentId,
    });

    logger.info(`Categoría creada: ${category.name}`);

    res.status(201).json({
      status: 'success',
      data: { category },
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return next(new AppError('Ya existe una categoría con ese slug', 409));
    }
    logger.error('Error al crear categoría:', error);
    next(new AppError('Error al crear la categoría', 500));
  }
};

/**
 * Actualizar una categoría (solo admin)
 */
exports.updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { parentId } = req.body;

    const category = await Category.findByPk(id);
    if (!category) {
      return next(new AppError('Categoría no encontrada', 404));
    }

    // Una categoría no puede ser su propio padre
    if (parentId && parentId === id) {
      return next(new AppError('Una categoría no puede ser su propia categoría padre', 400));
    }

    if (parentId) {
      const parent = await Category.findByPk(parentId);
      if (!parent) {
        return next(new AppError('La categoría padre no existe', 400));
      }
    }

    await category.update({
      ...req.body,
      updatedBy: req.user.id,
    });

    await invalidateCategoryCache();
    await redis.del(`category:${category.slug}`);

    await publishProductEvent('category.updated', {
      categoryId: category.id,
      name: category.name,
      slug: category.slug,
      parentId: category.parentId,
    });

    logger.info(`Categoría actualizada: ${category.name}`);

    res.status(200).json({
      status: 'success',
      data: { category },
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return next(new AppError('Ya existe una categoría con ese slug', 409));
    }
    logger.error('Error al actualizar categoría:', error);
    next(new AppError('Error al actualizar la categoría', 500));
  }
};

/**
 * Eliminar una categoría (soft delete, solo admin)
 */
exports.deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const category = await Category.findByPk(id);
    if (!category) {
      return next(new AppError('Categoría no encontrada', 404));
    }

    // No permitir borrar categorías con productos asociados
    const productCount = await Product.count({ where: { categoryId: id } });
    if (productCount > 0) {
      return next(
        new AppError(
          `No se puede eliminar: la categoría tiene ${productCount} producto(s) asociado(s)`,
          409
        )
      );
    }

    // No permitir borrar categorías con subcategorías
    const childCount = await Category.count({ where: { parentId: id } });
    if (childCount > 0) {
      return next(
        new AppError(
          `No se puede eliminar: la categoría tiene ${childCount} subcategoría(s)`,
          409
        )
      );
    }

    const { name, slug } = category;
    await category.destroy(); // Soft delete (paranoid: true)

    await invalidateCategoryCache();
    await redis.del(`category:${slug}`);

    await publishProductEvent('category.deleted', {
      categoryId: id,
      name,
      slug,
    });

    logger.info(`Categoría eliminada: ${name}`);

    res.status(200).json({
      status: 'success',
      message: 'Categoría eliminada correctamente',
    });
  } catch (error) {
    logger.error('Error al eliminar categoría:', error);
    next(new AppError('Error al eliminar la categoría', 500));
  }
};
