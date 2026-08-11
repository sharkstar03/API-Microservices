const { Op } = require('sequelize');
const { Inventory, Product, sequelize } = require('../models');
const { publishProductEvent } = require('../messaging/publisher');
const { clearCachePattern } = require('../utils/cache');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

// Añade los campos calculados que el modelo expone como métodos
const serializeInventory = (inventory) => ({
  ...inventory.toJSON(),
  availableStock: inventory.getAvailableStock(),
  lowStock: inventory.isLowStock(),
});

// Lo consume el order-service para sincronizar disponibilidad
const publishInventoryUpdate = async (inventory) => {
  await publishProductEvent('product.inventory.updated', {
    productId: inventory.productId,
    quantity: inventory.quantity,
    reservedQuantity: inventory.reservedQuantity,
    availableStock: inventory.getAvailableStock(),
    inStock: inventory.inStock,
    lowStock: inventory.isLowStock(),
  });
};

/**
 * Listar inventario (solo admin)
 */
exports.getAllInventory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    const whereClause = {};

    if (req.query.inStock !== undefined) {
      whereClause.inStock = req.query.inStock === 'true';
    }

    // Filtro de stock bajo: quantity <= lowStockThreshold
    if (req.query.lowStock === 'true') {
      whereClause.quantity = {
        [Op.lte]: sequelize.col('Inventory.lowStockThreshold'),
      };
    }

    const { count, rows } = await Inventory.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'sku'],
          required: false,
        },
      ],
      order: [['updatedAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    res.status(200).json({
      status: 'success',
      results: rows.length,
      pagination: {
        total: count,
        page,
        limit,
        pages: Math.ceil(count / limit),
      },
      data: {
        inventory: rows.map(serializeInventory),
      },
    });
  } catch (error) {
    logger.error('Error al listar inventario:', error);
    next(new AppError('Error al obtener el inventario', 500));
  }
};

/**
 * Obtener el inventario de un producto
 */
exports.getInventoryByProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;

    const inventory = await Inventory.findOne({
      where: { productId },
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'sku'],
          required: false,
        },
      ],
    });

    if (!inventory) {
      return next(new AppError('Inventario no encontrado para este producto', 404));
    }

    res.status(200).json({
      status: 'success',
      data: { inventory: serializeInventory(inventory) },
    });
  } catch (error) {
    logger.error('Error al obtener inventario:', error);
    next(new AppError('Error al obtener el inventario', 500));
  }
};

/**
 * Ajustar la configuración del inventario de un producto (solo admin)
 */
exports.updateInventory = async (req, res, next) => {
  try {
    const { productId } = req.params;

    const product = await Product.findByPk(productId);
    if (!product) {
      return next(new AppError('Producto no encontrado', 404));
    }

    // Crear el registro si el producto aún no tiene inventario
    let inventory = await Inventory.findOne({ where: { productId } });
    if (!inventory) {
      inventory = await Inventory.create({ productId, ...req.body, lastUpdatedBy: req.user.id });
    } else {
      await inventory.update({ ...req.body, lastUpdatedBy: req.user.id });
    }

    await clearCachePattern('products:*');
    await clearCachePattern(`product:${productId}`);

    await publishInventoryUpdate(inventory);

    logger.info(`Inventario actualizado para el producto ${productId}`);

    res.status(200).json({
      status: 'success',
      data: { inventory: serializeInventory(inventory) },
    });
  } catch (error) {
    logger.error('Error al actualizar inventario:', error);
    next(new AppError('Error al actualizar el inventario', 500));
  }
};

/**
 * Reponer stock (solo admin)
 */
exports.addStock = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;

    const inventory = await Inventory.findOne({ where: { productId } });
    if (!inventory) {
      return next(new AppError('Inventario no encontrado para este producto', 404));
    }

    await inventory.addStock(quantity);
    inventory.lastUpdatedBy = req.user.id;
    await inventory.save();

    await clearCachePattern('products:*');
    await clearCachePattern(`product:${productId}`);

    await publishInventoryUpdate(inventory);

    logger.info(`Stock repuesto para ${productId}: +${quantity} unidades`);

    res.status(200).json({
      status: 'success',
      message: `Se agregaron ${quantity} unidades al inventario`,
      data: { inventory: serializeInventory(inventory) },
    });
  } catch (error) {
    // Los métodos del modelo lanzan Error con mensajes de validación de negocio
    if (error.message && error.message.includes('cantidad')) {
      return next(new AppError(error.message, 400));
    }
    logger.error('Error al reponer stock:', error);
    next(new AppError('Error al reponer el stock', 500));
  }
};

/**
 * Reservar stock (uso interno entre servicios o admin)
 */
exports.reserveStock = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;

    const inventory = await Inventory.findOne({ where: { productId } });
    if (!inventory) {
      return next(new AppError('Inventario no encontrado para este producto', 404));
    }

    await inventory.reserveStock(quantity);

    await clearCachePattern('products:*');
    await clearCachePattern(`product:${productId}`);

    await publishInventoryUpdate(inventory);

    logger.info(`Stock reservado para ${productId}: ${quantity} unidades`);

    res.status(200).json({
      status: 'success',
      message: `Se reservaron ${quantity} unidades`,
      data: { inventory: serializeInventory(inventory) },
    });
  } catch (error) {
    if (error.message && (error.message.includes('stock') || error.message.includes('cantidad'))) {
      return next(new AppError(error.message, 400));
    }
    logger.error('Error al reservar stock:', error);
    next(new AppError('Error al reservar el stock', 500));
  }
};

/**
 * Liberar una reserva de stock (uso interno entre servicios o admin)
 */
exports.releaseStock = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;

    const inventory = await Inventory.findOne({ where: { productId } });
    if (!inventory) {
      return next(new AppError('Inventario no encontrado para este producto', 404));
    }

    // reduceStock con isReserved = true libera la reserva sin tocar el stock real
    await inventory.reduceStock(quantity, true);

    await clearCachePattern('products:*');
    await clearCachePattern(`product:${productId}`);

    await publishInventoryUpdate(inventory);

    logger.info(`Reserva liberada para ${productId}: ${quantity} unidades`);

    res.status(200).json({
      status: 'success',
      message: `Se liberaron ${quantity} unidades reservadas`,
      data: { inventory: serializeInventory(inventory) },
    });
  } catch (error) {
    if (error.message && (error.message.includes('reservada') || error.message.includes('cantidad'))) {
      return next(new AppError(error.message, 400));
    }
    logger.error('Error al liberar reserva:', error);
    next(new AppError('Error al liberar la reserva', 500));
  }
};
